import React, { useState, useEffect, useMemo } from 'react';
import {
  Retailer,
  Distributor,
  Outlet,
  Product,
  PredictionResult,
  Order,
  ConfidenceTier,
  NudgeRecord,
} from '../types';
import {
  Store,
  Building2,
  CheckCircle2,
  Calendar,
  Layers,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ShoppingBag,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Plus,
  Minus,
  QrCode,
  Search,
  Filter,
  Package,
  History,
  Info,
  Check,
  MessageSquare,
  XCircle,
  Ban,
  Wallet,
} from 'lucide-react';
import { UpiPaymentModal } from './UpiPaymentModal';
import { WhatsAppNudgesList } from './WhatsAppNudgesList';
import {
  placeRetailerOrder,
  cleanPhone,
  fetchNudgesFromDb,
  markNudgeReadInDb,
  cancelOrderInDb,
  fetchOutletLedger,
} from '../lib/firestoreService';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';

interface RetailerHomeScreenProps {
  retailer: Retailer;
  distributor: Distributor;
  outlet?: Outlet | null;
  outlets?: Outlet[];
  products?: Product[];
  predictions?: PredictionResult[];
  orders?: Order[];
  asOfDate?: string;
  wasMatched?: boolean;
  onDisconnect: () => void;
  onOrderPlaced?: () => void;
}

export const RetailerHomeScreen: React.FC<RetailerHomeScreenProps> = ({
  retailer,
  distributor,
  outlet,
  outlets = [],
  products = [],
  predictions = [],
  orders = [],
  asOfDate = '2026-09-05',
  wasMatched,
  onDisconnect,
  onOrderPlaced,
}) => {
  const [activeTab, setActiveTab] = useState<'due' | 'messages' | 'history' | 'account'>('due');

  // Find effective linked outlet
  const effectiveOutlet = useMemo(() => {
    if (outlet) return outlet;
    if (retailer.outlet_id) {
      const found = outlets.find(o => o.id === retailer.outlet_id);
      if (found) return found;
    }
    if (retailer.phone) {
      const cleaned = cleanPhone(retailer.phone);
      const found = outlets.find(o => cleanPhone(o.phone) === cleaned);
      if (found) return found;
    }
    return null;
  }, [outlet, retailer, outlets]);

  // Filter predictions for this outlet
  const outletPredictions = useMemo(() => {
    if (!effectiveOutlet) return [];
    return predictions.filter(p => p.outlet_id === effectiveOutlet.id);
  }, [predictions, effectiveOutlet]);

  // Split due vs upcoming predictions
  const { duePredictions, upcomingPredictions } = useMemo(() => {
    const due: PredictionResult[] = [];
    const upcoming: PredictionResult[] = [];

    outletPredictions.forEach(p => {
      if (p.is_due || p.status === 'overdue' || p.status === 'due_today') {
        due.push(p);
      } else {
        upcoming.push(p);
      }
    });

    // Sort due: overdue first (higher days overdue), then due today
    due.sort((a, b) => a.predicted_next_date.localeCompare(b.predicted_next_date));
    upcoming.sort((a, b) => a.predicted_next_date.localeCompare(b.predicted_next_date));

    return { duePredictions: due, upcomingPredictions: upcoming };
  }, [outletPredictions]);

  // Compute draft quantity from average of last 3 orders
  const getDraftQuantityDetails = (productId: string, predRecentAvg?: number) => {
    if (!effectiveOutlet) {
      return {
        quantity: predRecentAvg || 10,
        last3Quantities: [],
        hasHistory: false,
      };
    }

    const relevant = orders
      .filter(o => o.outlet_id === effectiveOutlet.id && o.product_id === productId && o.status !== 'cancelled')
      .sort((a, b) => b.date.localeCompare(a.date));

    const last3 = relevant.slice(0, 3);
    if (last3.length > 0) {
      const avg = Math.round(last3.reduce((sum, o) => sum + o.quantity, 0) / last3.length);
      return {
        quantity: Math.max(1, avg),
        last3Quantities: last3.map(o => o.quantity),
        hasHistory: true,
      };
    }

    return {
      quantity: predRecentAvg || 10,
      last3Quantities: [],
      hasHistory: false,
    };
  };

  // Editable draft quantities per product
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [isPlacingOrder, setIsPlacingOrder] = useState<Record<string, boolean>>({});
  const [isCancelling, setIsCancelling] = useState<Record<string, boolean>>({});
  const [orderError, setOrderError] = useState<string | null>(null);

  // Active UPI Modal state
  const [isUpiModalOpen, setIsUpiModalOpen] = useState<boolean>(false);
  const [activeUpiOrder, setActiveUpiOrder] = useState<Order | null>(null);
  const [activeUpiProduct, setActiveUpiProduct] = useState<Product | null>(null);
  const [activeUpiTotal, setActiveUpiTotal] = useState<number>(0);

  // Nudges collection for this outlet
  const [nudges, setNudges] = useState<NudgeRecord[]>([]);

  // Fetch nudges for this outlet
  const loadNudges = async () => {
    if (!effectiveOutlet) return;
    try {
      const list = await fetchNudgesFromDb({ outletId: effectiveOutlet.id });
      setNudges(list);
    } catch (err) {
      console.warn('Failed to load nudges for outlet:', err);
    }
  };

  useEffect(() => {
    loadNudges();
  }, [effectiveOutlet, asOfDate]);

  // Credit ledger — read-only on the retailer side; only the distributor
  // records payments (matches how collection actually works in practice).
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [lastPaymentDate, setLastPaymentDate] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveOutlet) return;
    fetchOutletLedger(effectiveOutlet.id, distributor.id)
      .then(data => {
        setCreditBalance(data.balance);
        setLastPaymentDate(data.last_payment_date);
      })
      .catch(err => console.warn('Failed to load ledger for outlet:', err));
  }, [effectiveOutlet, distributor.id, orders]);

  // Confirm draft order from WhatsApp nudge. The payment step for a
  // nudge-originated order happens inline in the chat itself (see
  // WhatsAppNudgesList's two-way pay-via-WhatsApp exchange) rather than the
  // separate UPI modal used elsewhere — so this only places the real order
  // and reports success/failure back to the chat component.
  const handleConfirmNudgeOrder = async (nudge: NudgeRecord): Promise<boolean> => {
    if (!effectiveOutlet) return false;
    const quantity = nudge.suggested_quantity || 10;
    const prod = products.find(p => p.id === nudge.product_id) || {
      id: nudge.product_id,
      name: nudge.product_name || nudge.product_id,
      unit: nudge.product_unit || 'case',
      wholesale_price: nudge.wholesale_price || 500,
      mrp: (nudge.wholesale_price || 500) * 1.2,
      items_per_case: 12,
      category: 'FMCG Wholesale',
    };

    try {
      setOrderError(null);
      await markNudgeReadInDb(nudge.id);
      setNudges(prev =>
        prev.map(n =>
          n.id === nudge.id ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );

      await placeRetailerOrder({
        outlet_id: effectiveOutlet.id,
        outlet_name: effectiveOutlet.name,
        product_id: nudge.product_id,
        product_name: nudge.product_name || prod.name,
        quantity,
        date: asOfDate,
        distributor_id: distributor.id,
      });

      if (onOrderPlaced) {
        onOrderPlaced();
      }
      return true;
    } catch (err: any) {
      console.error('Failed to confirm nudge draft order:', err);
      setOrderError(err?.message || 'Failed to confirm order from nudge. Please try again.');
      return false;
    }
  };

  // Retailer-initiated order via the simulated WhatsApp chat — a distinct
  // path from responding to a distributor-sent nudge. Same real backend
  // write as every other order-placement path in this app; only the origin
  // (a WhatsApp conversation the retailer started, not a dashboard tap or a
  // reply to a nudge) is different.
  const handleComposeWhatsAppOrder = async (productId: string, quantity: number): Promise<boolean> => {
    if (!effectiveOutlet) return false;
    const prod = products.find(p => p.id === productId);
    if (!prod) return false;
    try {
      setOrderError(null);
      await placeRetailerOrder({
        outlet_id: effectiveOutlet.id,
        outlet_name: effectiveOutlet.name,
        product_id: productId,
        product_name: prod.name,
        quantity,
        date: asOfDate,
        distributor_id: distributor.id,
      });
      if (onOrderPlaced) {
        onOrderPlaced();
      }
      return true;
    } catch (err: any) {
      console.error('Failed to place WhatsApp-composed order:', err);
      setOrderError(err?.message || 'Failed to place order. Please try again.');
      return false;
    }
  };

  const handleMarkNudgeRead = async (nudgeId: string) => {
    try {
      await markNudgeReadInDb(nudgeId);
      setNudges(prev =>
        prev.map(n =>
          n.id === nudgeId ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );
    } catch (err) {
      console.error('Failed to mark nudge read:', err);
    }
  };

  const handleMarkAllNudgesRead = async () => {
    try {
      const unreadList = nudges.filter(n => !n.read);
      for (const item of unreadList) {
        await markNudgeReadInDb(item.id);
      }
      setNudges(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all nudges read:', err);
    }
  };

  // Search & filter for order history
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'retailer'>('all');

  // Toggle to show upcoming catalog items
  const [showUpcoming, setShowUpcoming] = useState<boolean>(false);

  // Initialize draft quantities whenever predictions or orders change
  useEffect(() => {
    setDraftQuantities(prev => {
      const next = { ...prev };
      outletPredictions.forEach(p => {
        if (next[p.product_id] === undefined) {
          const details = getDraftQuantityDetails(p.product_id, p.recent_average_quantity);
          next[p.product_id] = details.quantity;
        }
      });
      return next;
    });
  }, [outletPredictions, orders, effectiveOutlet]);

  const handleQuantityChange = (productId: string, delta: number) => {
    setDraftQuantities(prev => {
      const current = prev[productId] !== undefined ? prev[productId] : 1;
      const nextVal = Math.max(1, current + delta);
      return { ...prev, [productId]: nextVal };
    });
  };

  const handleDirectQuantityInput = (productId: string, valStr: string) => {
    const val = parseInt(valStr, 10);
    setDraftQuantities(prev => ({
      ...prev,
      [productId]: isNaN(val) || val < 1 ? 1 : val,
    }));
  };

  // Confirm order action: creates real order doc and opens UPI QR code screen
  const handleConfirmOrder = async (pred: PredictionResult) => {
    if (!effectiveOutlet) return;
    const quantity = draftQuantities[pred.product_id] || pred.recent_average_quantity || 10;
    const prod = products.find(p => p.id === pred.product_id) || {
      id: pred.product_id,
      name: pred.product_name,
      unit: pred.product_unit,
      wholesale_price: pred.wholesale_price,
      mrp: pred.mrp,
      items_per_case: pred.items_per_case,
      category: 'FMCG Wholesale',
    };

    const totalAmount = quantity * pred.wholesale_price;

    setIsPlacingOrder(prev => ({ ...prev, [pred.product_id]: true }));
    setOrderError(null);

    try {
      const newOrder = await placeRetailerOrder({
        outlet_id: effectiveOutlet.id,
        outlet_name: effectiveOutlet.name,
        product_id: pred.product_id,
        product_name: pred.product_name,
        quantity,
        date: asOfDate,
        distributor_id: distributor.id,
      });

      if (onOrderPlaced) {
        onOrderPlaced();
      }

      setActiveUpiOrder(newOrder);
      setActiveUpiProduct(prod);
      setActiveUpiTotal(totalAmount);
      setIsUpiModalOpen(true);
    } catch (err: any) {
      console.error('Failed to confirm retailer order:', err);
      setOrderError(err?.message || 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(prev => ({ ...prev, [pred.product_id]: false }));
    }
  };

  // Cancel an order the distributor placed on this retailer's behalf.
  // Server enforces eligibility (own outlet, distributor-placed only); this
  // just calls it and refreshes orders/predictions on success.
  const handleCancelOrder = async (orderId: string) => {
    setIsCancelling(prev => ({ ...prev, [orderId]: true }));
    setOrderError(null);
    try {
      await cancelOrderInDb(orderId, distributor.id);
      if (onOrderPlaced) {
        onOrderPlaced();
      }
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      setOrderError(err?.message || 'Failed to cancel order. Please try again.');
    } finally {
      setIsCancelling(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Orders for this retailer's outlet, sorted newest first
  const retailerOrders = useMemo(() => {
    if (!effectiveOutlet) return [];
    return orders
      .filter(o => o.outlet_id === effectiveOutlet.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [orders, effectiveOutlet]);

  const filteredHistoryOrders = useMemo(() => {
    return retailerOrders.filter(ord => {
      if (historyFilter === 'retailer' && ord.placed_by !== 'retailer' && ord.source !== 'retailer') {
        return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const pName = ord.product_name?.toLowerCase() || ord.product_id.toLowerCase();
        const oId = ord.id.toLowerCase();
        return pName.includes(q) || oId.includes(q);
      }
      return true;
    });
  }, [retailerOrders, historyFilter, historySearch]);

  const getConfidenceBadge = (confidence: ConfidenceTier) => {
    const norm = confidence?.toLowerCase() || 'cold';
    if (norm === 'confident') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
          Confident
        </span>
      );
    }
    if (norm === 'learning') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
          Learning
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
        Cold
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-0 space-y-6">
      {/* Top Identity Header Card */}
      <div className={`${CARD_STYLE} p-5 sm:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#0F766E] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
                  {effectiveOutlet?.name || retailer.name}
                </h1>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4] text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3 text-[#0F766E]" />
                  <span>Linked</span>
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5 flex items-center space-x-2">
                <span>Your Distributor:</span>
                <strong className="text-[#0F172A] font-semibold">{distributor.name}</strong>
                <span>•</span>
                <span>Route: {effectiveOutlet?.route || distributor.route}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-[#64748B] block font-medium">Data as of</span>
              <span className="text-xs font-mono font-bold text-[#0F172A]">{asOfDate}</span>
            </div>
          </div>
        </div>

        {orderError && (
          <div
            id="retailer-order-error-banner"
            className="mt-4 p-3.5 bg-[#FEE2E2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] flex items-start space-x-2.5"
          >
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">Order Error</strong>
              <span>{orderError}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation Strip */}
        <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center space-x-2 overflow-x-auto">
          <button
            id="tab-due-products-btn"
            type="button"
            onClick={() => setActiveTab('due')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'due'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Products Due for Reorder</span>
            {duePredictions.length > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'due'
                    ? 'bg-white text-[#0F766E]'
                    : 'bg-[#0F766E] text-white'
                }`}
              >
                {duePredictions.length}
              </span>
            )}
          </button>

          <button
            id="tab-messages-btn"
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'messages'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Messages</span>
            {nudges.length > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'messages'
                    ? 'bg-white text-[#0F766E]'
                    : nudges.some(n => !n.read)
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#E2E8F0] text-[#0F172A]'
                }`}
              >
                {nudges.filter(n => !n.read).length || nudges.length}
              </span>
            )}
          </button>

          <button
            id="tab-order-history-btn"
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Order History</span>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'history'
                  ? 'bg-white text-[#0F766E]'
                  : 'bg-[#E2E8F0] text-[#0F172A]'
              }`}
            >
              {retailerOrders.length}
            </span>
          </button>

          <button
            id="tab-account-details-btn"
            type="button"
            onClick={() => setActiveTab('account')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
              activeTab === 'account'
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>My Store</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DUE PRODUCTS */}
      {activeTab === 'due' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Due Products Header & Guidance */}
          <div className="bg-[#F0FDFA] border border-[#99F6E4] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-[#0F766E] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-[#0F766E]">
                  Time to Reorder
                </h2>
                <p className="text-xs text-[#0F766E]/90 mt-0.5">
                  Based on how often you usually order. Quantities are already filled in
                  using the <strong>average of your last 3 orders</strong> — just check and confirm.
                  Ordering here goes straight through the app, no WhatsApp involved — if you'd
                  rather order by chat instead, that's in the <strong>Messages</strong> tab.
                </p>
              </div>
            </div>
            <div className="text-xs font-medium text-[#0F766E] bg-white border border-[#99F6E4] px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-center">
              {duePredictions.length} item{duePredictions.length !== 1 ? 's' : ''} due now
            </div>
          </div>

          {/* List of Products Currently Due */}
          {duePredictions.length > 0 ? (
            <div className="space-y-4">
              {duePredictions.map(pred => {
                const quantity = draftQuantities[pred.product_id] !== undefined
                  ? draftQuantities[pred.product_id]
                  : pred.recent_average_quantity || 10;
                const draftInfo = getDraftQuantityDetails(pred.product_id, pred.recent_average_quantity);
                const itemTotal = quantity * pred.wholesale_price;
                const isOverdue = pred.status === 'overdue';
                const isDueToday = pred.status === 'due_today';

                return (
                  <div
                    key={pred.product_id}
                    id={`due-product-card-${pred.product_id}`}
                    className={`${CARD_STYLE} hover:border-[#0F766E] transition-all p-5 sm:p-6`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      {/* Left: Product Info & Cadence */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base sm:text-lg font-extrabold text-[#0F172A]">
                            {pred.product_name}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#64748B]">
                            {pred.product_unit}
                          </span>
                          {/* Due status badge */}
                          {isOverdue && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
                              <Clock className="w-3 h-3 text-[#DC2626]" />
                              <span>{pred.status_label}</span>
                            </span>
                          )}
                          {isDueToday && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                              <Clock className="w-3 h-3 text-[#D97706]" />
                              <span>Due today</span>
                            </span>
                          )}
                          {getConfidenceBadge(pred.confidence)}
                        </div>

                        {/* Cadence Reasoning String */}
                        <div className="text-xs text-[#64748B] flex items-center space-x-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                          <span>{pred.reasoning}</span>
                        </div>

                        {/* Order History Details / Draft Calculation */}
                        <div className="text-[11px] text-[#64748B] bg-[#F8FAFC] rounded-xl px-3 py-2 border border-[#E2E8F0] inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-[#0F172A]">
                            Suggested quantity:
                          </span>
                          {draftInfo.hasHistory ? (
                            <span>
                              Average of last 3 orders:{' '}
                              <strong className="text-[#0F766E]">
                                {draftInfo.last3Quantities.join(', ')} cases → {draftInfo.quantity} cases
                              </strong>
                            </span>
                          ) : (
                            <span>
                              Based on recent baseline:{' '}
                              <strong className="text-[#0F766E]">{draftInfo.quantity} cases</strong>
                            </span>
                          )}
                          <span>•</span>
                          <span>
                            Wholesale: <strong>₹{pred.wholesale_price}</strong> / {pred.product_unit}
                          </span>
                        </div>
                      </div>

                      {/* Right: Quantity Editor & Confirm Button */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0 bg-[#F8FAFC] sm:bg-transparent p-3 sm:p-0 rounded-xl border border-[#E2E8F0] sm:border-0">
                        {/* Quantity Counter */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-[#64748B] sm:hidden">Quantity:</span>
                          <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
                            <button
                              id={`qty-minus-${pred.product_id}`}
                              type="button"
                              onClick={() => handleQuantityChange(pred.product_id, -1)}
                              disabled={quantity <= 1}
                              className="p-2.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              id={`qty-input-${pred.product_id}`}
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={e =>
                                handleDirectQuantityInput(pred.product_id, e.target.value)
                              }
                              className="w-14 text-center font-extrabold text-sm text-[#0F172A] focus:outline-hidden border-x border-[#E2E8F0] py-1"
                            />
                            <button
                              id={`qty-plus-${pred.product_id}`}
                              type="button"
                              onClick={() => handleQuantityChange(pred.product_id, 1)}
                              className="p-2.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Calculated Subtotal */}
                        <div className="text-right sm:w-28">
                          <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                            Subtotal
                          </span>
                          <span className="text-base font-extrabold text-[#0F172A]">
                            ₹{itemTotal.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Confirm Button */}
                        <button
                          id={`confirm-order-btn-${pred.product_id}`}
                          type="button"
                          disabled={isPlacingOrder[pred.product_id]}
                          onClick={() => handleConfirmOrder(pred)}
                          className={`${BUTTON_STYLES.primary} py-2.5 px-5 text-xs flex items-center justify-center space-x-2 whitespace-nowrap`}
                        >
                          {isPlacingOrder[pred.product_id] ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Placing...</span>
                            </>
                          ) : (
                            <>
                              <QrCode className="w-4 h-4" />
                              <span>Confirm & Pay</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty Due Products State / Nothing Due Yet */
            <div className={`${CARD_STYLE} p-8 text-center space-y-3`}>
              <div className="w-12 h-12 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-[#0F766E]" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A]">
                {outletPredictions.length === 0 ? 'Nothing due yet' : 'All Products are Currently Stocked'}
              </h3>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                {outletPredictions.length === 0
                  ? 'Once a few orders are placed, we\'ll start showing you when to reorder each product.'
                  : "You're all stocked up — nothing is due for reorder today."}
              </p>
              {upcomingPredictions.length > 0 && (
                <div className="pt-2">
                  <button
                    id="toggle-upcoming-btn"
                    type="button"
                    onClick={() => setShowUpcoming(prev => !prev)}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#0F766E] hover:text-[#14B8A6] bg-[#F0FDFA] hover:bg-[#CCFBF1] px-4 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>
                      {showUpcoming
                        ? 'Hide upcoming items'
                        : `See ${upcomingPredictions.length} products coming up`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upcoming Products Toggle Section */}
          {upcomingPredictions.length > 0 && (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  id="upcoming-toggle-header-btn"
                  type="button"
                  onClick={() => setShowUpcoming(prev => !prev)}
                  className="flex items-center space-x-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                >
                  <span>Coming Up Soon ({upcomingPredictions.length})</span>
                  <span className="text-[#64748B]/60 font-normal">
                    {showUpcoming ? '(tap to hide)' : '(tap to see & order early)'}
                  </span>
                </button>
              </div>

              {showUpcoming && (
                <div className="space-y-3">
                  {upcomingPredictions.map(pred => {
                    const quantity = draftQuantities[pred.product_id] !== undefined
                      ? draftQuantities[pred.product_id]
                      : pred.recent_average_quantity || 10;
                    const itemTotal = quantity * pred.wholesale_price;

                    return (
                      <div
                        key={pred.product_id}
                        className={`${CARD_STYLE} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs`}
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-[#0F172A] text-sm">
                              {pred.product_name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-[11px]">
                              {pred.status_label}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B] mt-1">
                            {pred.reasoning} • Pre-filled draft: {quantity} {pred.product_unit}s
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 self-end sm:self-center">
                          <div className="text-right">
                            <span className="font-extrabold text-[#0F172A]">
                              ₹{itemTotal.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleConfirmOrder(pred)}
                            disabled={isPlacingOrder[pred.product_id]}
                            className={`${BUTTON_STYLES.primary} py-1.5 px-3 text-xs flex items-center space-x-1`}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Confirm</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MESSAGES (persistent WhatsApp-styled nudge history — read and unread) */}
      {activeTab === 'messages' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-[#F0FDFA] border border-[#99F6E4] rounded-2xl p-4 sm:p-5 flex items-start space-x-3">
            <MessageSquare className="w-5 h-5 text-[#0F766E] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-[#0F766E]">Messages from {distributor.name}</h2>
              <p className="text-xs text-[#0F766E]/90 mt-0.5">
                Styled to look and act like a real WhatsApp chat, but nothing here is sent via the
                actual WhatsApp Business API — it's a simulation of two things a real integration
                would let you do from your phone without opening this app: reply to a reorder
                reminder, or start a brand new order yourself by chatting. Everything ever sent to
                your store stays here, whether or not you've read it.
              </p>
            </div>
          </div>

          <WhatsAppNudgesList
            nudges={nudges}
            distributor={distributor}
            outlet={effectiveOutlet}
            products={products}
            onConfirmDraftOrder={handleConfirmNudgeOrder}
            onMarkAsRead={handleMarkNudgeRead}
            onMarkAllAsRead={handleMarkAllNudgesRead}
            onComposeOrder={handleComposeWhatsAppOrder}
          />
        </div>
      )}

      {/* TAB 3: ORDER HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Search & Filter Header */}
          <div className={`${CARD_STYLE} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="order-history-search-input"
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search orders by product or order ID..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder-[#64748B]/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                id="history-filter-all-btn"
                type="button"
                onClick={() => setHistoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  historyFilter === 'all'
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                All Orders ({retailerOrders.length})
              </button>
              <button
                id="history-filter-retailer-btn"
                type="button"
                onClick={() => setHistoryFilter('retailer')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  historyFilter === 'retailer'
                    ? 'bg-[#0F766E] text-white'
                    : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Placed by Me
              </button>
            </div>
          </div>

          {/* Order Cards List */}
          {filteredHistoryOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredHistoryOrders.map(ord => {
                const prod = products.find(p => p.id === ord.product_id);
                const unitPrice = prod?.wholesale_price || 0;
                const orderTotal = ord.quantity * unitPrice;
                const isRetailerPlaced = ord.placed_by === 'retailer' || ord.source === 'retailer';
                const isCancelled = ord.status === 'cancelled';
                const isCancellable = ord.placed_by === 'distributor' && !isCancelled;

                return (
                  <div
                    key={ord.id}
                    id={`order-card-${ord.id}`}
                    className={`${CARD_STYLE} p-4 sm:p-5 hover:border-[#0F766E] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCancelled ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Order Details */}
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#0F172A] bg-[#F1F5F9] px-2 py-0.5 rounded-md">
                          #{ord.id}
                        </span>
                        <span className="text-sm font-extrabold text-[#0F172A]">
                          {ord.product_name || prod?.name || ord.product_id}
                        </span>
                        {/* Placed by badge */}
                        {isRetailerPlaced ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                            <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                            <span>Placed by Retailer</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F1F5F9] text-[#64748B]">
                            <span>Added by Distributor</span>
                          </span>
                        )}
                        {/* Cancelled badge */}
                        {isCancelled && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
                            <Ban className="w-3 h-3 text-[#DC2626]" />
                            <span>Cancelled</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                          <span>{ord.date}</span>
                        </span>
                        <span>•</span>
                        <span>
                          Quantity: <strong className="text-[#0F172A]">{ord.quantity}</strong> {prod?.unit || 'cases'}
                        </span>
                        {unitPrice > 0 && (
                          <>
                            <span>•</span>
                            <span>
                              Total Value:{' '}
                              <strong className="text-[#0F766E]">
                                ₹{orderTotal.toLocaleString('en-IN')}
                              </strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions: cancel (distributor-placed only) + View UPI QR */}
                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                      {isCancellable && (
                        <button
                          id={`cancel-order-${ord.id}`}
                          type="button"
                          disabled={isCancelling[ord.id]}
                          onClick={() => handleCancelOrder(ord.id)}
                          className="flex items-center space-x-1.5 text-xs py-1.5 px-3 rounded-xl font-semibold border border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FEE2E2] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {isCancelling[ord.id] ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{isCancelling[ord.id] ? 'Cancelling...' : 'Cancel Order'}</span>
                        </button>
                      )}
                      {!isCancelled && (
                        <button
                          id={`view-qr-${ord.id}`}
                          type="button"
                          onClick={() => {
                            setActiveUpiOrder(ord);
                            setActiveUpiProduct(prod || null);
                            setActiveUpiTotal(orderTotal > 0 ? orderTotal : ord.quantity * 500);
                            setIsUpiModalOpen(true);
                          }}
                          className={`${BUTTON_STYLES.secondary} text-xs py-1.5 px-3`}
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1 text-[#0F766E]" />
                          <span>View UPI QR</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${CARD_STYLE} p-8 text-center space-y-2`}>
              <History className="w-8 h-8 text-[#64748B]/50 mx-auto" />
              <h3 className="text-sm font-bold text-[#0F172A]">No orders found</h3>
              <p className="text-xs text-[#64748B]">
                {historySearch
                  ? 'No orders match your search criteria.'
                  : 'You have not placed any orders yet. Confirm a reorder from the Due Products tab!'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MY STORE */}
      {activeTab === 'account' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Credit Balance Card */}
          <div
            className={`${CARD_STYLE} p-5 sm:p-6 flex items-center justify-between ${
              creditBalance > 0 ? 'border-[#FDE68A] bg-[#FFFBEB]' : ''
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  creditBalance > 0
                    ? 'bg-[#FEF3C7] text-[#D97706]'
                    : 'bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]'
                }`}
              >
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-[#64748B] block">
                  {creditBalance > 0 ? 'You owe your distributor' : 'Credit balance'}
                </span>
                <span
                  className={`text-xl font-extrabold font-mono ${
                    creditBalance > 0 ? 'text-[#D97706]' : 'text-[#16A34A]'
                  }`}
                >
                  ₹{Math.abs(creditBalance).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <span className="text-xs text-[#64748B] text-right">
              {creditBalance <= 0
                ? 'Settled up'
                : lastPaymentDate
                ? `Last payment: ${lastPaymentDate}`
                : 'No payments recorded yet'}
            </span>
          </div>

          {/* Main Identity Card */}
          <div className={`${CARD_STYLE} p-6 sm:p-8 space-y-5`}>
            <div className="flex items-center space-x-3 border-b border-[#E2E8F0] pb-4">
              <ShieldCheck className="w-6 h-6 text-[#0F766E]" />
              <div>
                <h2 className="text-base font-extrabold text-[#0F172A]">
                  Your Store Details
                </h2>
                <p className="text-xs text-[#64748B]">
                  How your store is connected to your distributor
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[11px] mb-0.5">Your Store</span>
                <span className="font-bold text-[#0F172A] text-sm">
                  {effectiveOutlet?.name || retailer.name}
                </span>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[11px] mb-0.5">Your Distributor</span>
                <span className="font-bold text-[#0F172A] text-sm">{distributor.name}</span>
                <span className="text-[#0F766E] block text-[11px] font-medium mt-0.5">
                  Route: {effectiveOutlet?.route || distributor.route}
                </span>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[11px] mb-0.5">Distributor&apos;s Invite Code</span>
                <span className="font-mono font-bold text-[#0F766E] text-sm">
                  {distributor.invite_code || 'Not set'}
                </span>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[11px] mb-0.5">Distributor&apos;s UPI ID</span>
                <span className="font-mono font-bold text-[#0F172A] text-xs">
                  {distributor.upi_id || 'Not set'}
                </span>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] sm:col-span-2">
                <span className="text-[#64748B] block text-[11px] mb-0.5">Your Phone Number</span>
                <span className="font-mono font-bold text-[#0F172A] text-xs">
                  {retailer.phone}
                </span>
              </div>
            </div>

            {/* Connection Status */}
            <div className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-xs text-[#0F766E] flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
              <div>
                {wasMatched ? (
                  <span>
                    You&apos;re connected to your existing store record, matched by your phone number.
                  </span>
                ) : (
                  <span>
                    You&apos;re connected to <strong>{effectiveOutlet?.name}</strong> on the{' '}
                    <em>{effectiveOutlet?.route || distributor.route}</em> route.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Disconnect Control */}
          <div className="flex justify-center pt-2">
            <button
              id="retailer-disconnect-btn"
              type="button"
              onClick={onDisconnect}
              className={`${BUTTON_STYLES.secondary} text-xs py-2.5 px-4`}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2 text-[#64748B]" />
              <span>Unlink From This Distributor</span>
            </button>
          </div>
        </div>
      )}

      {/* UPI-Style QR Visual Confirmation Modal */}
      <UpiPaymentModal
        isOpen={isUpiModalOpen}
        onClose={() => setIsUpiModalOpen(false)}
        order={activeUpiOrder}
        product={activeUpiProduct}
        outlet={effectiveOutlet}
        distributor={distributor}
        totalAmount={activeUpiTotal}
        onViewHistory={() => setActiveTab('history')}
      />
    </div>
  );
};
