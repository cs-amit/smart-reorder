import React, { useState, useMemo } from 'react';
import { Outlet, Product, PredictionResult, ConfidenceTier } from '../types';
import { ConfirmOrderModal } from './ConfirmOrderModal';
import {
  Store,
  Search,
  MapPin,
  Phone,
  User,
  Package,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Send,
  Sparkles,
  Layers,
  Camera,
} from 'lucide-react';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';
import { apiFetch } from '../lib/api';

interface OutletsTabProps {
  outlets: Outlet[];
  products: Product[];
  predictions: PredictionResult[];
  asOfDate: string;
  onRefreshData: () => Promise<void>;
  onLogNudge: (outletId: string, productId: string) => Promise<void>;
  onOpenPhotoImport?: () => void;
}

export const OutletsTab: React.FC<OutletsTabProps> = ({
  outlets,
  products,
  predictions,
  asOfDate,
  onRefreshData,
  onLogNudge,
  onOpenPhotoImport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [expandedProductRow, setExpandedProductRow] = useState<string | null>(null);

  // Modal State for Confirm Order
  const [confirmModalItem, setConfirmModalItem] = useState<PredictionResult | null>(null);
  const [nudgedKeys, setNudgedKeys] = useState<Record<string, string>>({});
  const [nudgeInProgress, setNudgeInProgress] = useState<string | null>(null);

  // Filter outlets by search query
  const filteredOutlets = useMemo(() => {
    return outlets.filter(o => {
      const q = searchQuery.toLowerCase();
      return (
        o.name.toLowerCase().includes(q) ||
        (o.owner && o.owner.toLowerCase().includes(q)) ||
        (o.route && o.route.toLowerCase().includes(q)) ||
        (o.phone && o.phone.includes(q))
      );
    });
  }, [outlets, searchQuery]);

  // Selected outlet object
  const selectedOutlet = useMemo(() => {
    if (!selectedOutletId) return null;
    return outlets.find(o => o.id === selectedOutletId) || null;
  }, [outlets, selectedOutletId]);

  // Predictions for every product that this outlet has ordered
  const outletProductPredictions = useMemo(() => {
    if (!selectedOutletId) return [];
    return predictions.filter(p => p.outlet_id === selectedOutletId);
  }, [predictions, selectedOutletId]);

  // Summary counts per outlet
  const outletProductCounts = useMemo(() => {
    const map = new Map<
      string,
      { totalProducts: number; overdueCount: number; dueTodayCount: number }
    >();
    predictions.forEach(p => {
      const current = map.get(p.outlet_id) || {
        totalProducts: 0,
        overdueCount: 0,
        dueTodayCount: 0,
      };
      current.totalProducts += 1;
      if (p.status === 'overdue' || p.predicted_next_date < asOfDate) {
        current.overdueCount += 1;
      } else if (p.status === 'due_today' || p.predicted_next_date === asOfDate) {
        current.dueTodayCount += 1;
      }
      map.set(p.outlet_id, current);
    });
    return map;
  }, [predictions, asOfDate]);

  const handleSendNudge = async (
    e: React.MouseEvent,
    outletId: string,
    productId: string,
    rowKey: string
  ) => {
    e.stopPropagation();
    try {
      setNudgeInProgress(rowKey);
      await onLogNudge(outletId, productId);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setNudgedKeys(prev => ({ ...prev, [rowKey]: nowStr }));
    } catch (err) {
      console.error('Failed to send nudge:', err);
    } finally {
      setNudgeInProgress(null);
    }
  };

  const handleConfirmOrder = async (orderData: {
    outlet_id: string;
    product_id: string;
    quantity: number;
    date: string;
    source: 'distributor';
  }) => {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || 'Failed to record order');
    }
    await onRefreshData();
  };

  const getConfidenceBadge = (tier: ConfidenceTier) => {
    const normalized = String(tier).toLowerCase();
    switch (normalized) {
      case 'confident':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mr-1.5" />
            Confident
          </span>
        );
      case 'learning':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] mr-1.5" />
            Learning
          </span>
        );
      case 'cold':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mr-1.5" />
            Cold
          </span>
        );
    }
  };

  const getStatusBadge = (item: PredictionResult) => {
    const isOverdue = item.status === 'overdue' || item.predicted_next_date < asOfDate;
    const isDueToday = item.status === 'due_today' || item.predicted_next_date === asOfDate;

    if (isOverdue) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
          <AlertCircle className="w-3 h-3 mr-1 text-[#DC2626]" />
          {item.status_label || 'Overdue'}
        </span>
      );
    }
    if (isDueToday) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
          <Clock className="w-3 h-3 mr-1 text-[#D97706]" />
          Due Today
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
        {item.status_label || `In ${item.predicted_interval - item.days_since_last_order}d`}
      </span>
    );
  };

  // ==========================================
  // VIEW 1: OUTLET DETAIL PAGE
  // ==========================================
  if (selectedOutlet) {
    return (
      <div className="space-y-5 animate-in fade-in duration-150">
        {/* Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            id="back-to-outlets-btn"
            onClick={() => {
              setSelectedOutletId(null);
              setExpandedProductRow(null);
            }}
            className={`${BUTTON_STYLES.secondary} text-xs py-1.5 px-3`}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1 text-[#64748B]" />
            <span>Back to Outlets Directory</span>
          </button>

          <span className="text-xs text-[#64748B] font-medium">
            Outlet Code: <strong className="font-mono text-[#0F172A]">{selectedOutlet.id}</strong>
          </span>
        </div>

        {/* Outlet Header Profile Card */}
        <div className={`${CARD_STYLE} p-5`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]/70 flex items-center justify-center shrink-0 shadow-xs">
                <Store className="w-6 h-6 text-[#0F766E]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg sm:text-xl font-extrabold text-[#0F172A] tracking-tight">
                    {selectedOutlet.name}
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]">
                    Route: {selectedOutlet.route}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#64748B]">
                  {selectedOutlet.owner && (
                    <span className="flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Owner: {selectedOutlet.owner}</span>
                    </span>
                  )}
                  {selectedOutlet.phone && (
                    <span className="flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                      <span className="font-mono">{selectedOutlet.phone}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-center">
                <span className="block text-[#64748B] text-[11px]">Ordered Products</span>
                <span className="font-bold text-[#0F172A] text-base">
                  {outletProductPredictions.length}
                </span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-center">
                <span className="block text-[#64748B] text-[11px]">Next Due Date</span>
                <span className="font-bold text-[#0F766E] font-mono text-xs mt-0.5 block">
                  {outletProductPredictions[0]?.predicted_next_date || asOfDate}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Products Monitored for this Outlet */}
        <div className={`${CARD_STYLE} overflow-hidden`}>
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#0F766E]" />
              <h2 className="text-sm font-bold text-[#0F172A]">
                Reorder Pattern by Product for {selectedOutlet.name}
              </h2>
            </div>
            <span className="text-xs text-[#64748B]">
              Calculated as of <strong className="text-[#0F172A]">{asOfDate}</strong>
            </span>
          </div>

          {outletProductPredictions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#64748B]">
              No past orders on record for this outlet yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase border-b border-[#E2E8F0]">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Wholesale Price</th>
                    <th className="py-3 px-4">Reorders Every</th>
                    <th className="py-3 px-4">Predicted Next Date</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {outletProductPredictions.map(item => {
                    const rowKey = `${item.outlet_id}::${item.product_id}`;
                    const isExpanded = expandedProductRow === rowKey;
                    const nudgeTime = nudgedKeys[rowKey];
                    const isNudging = nudgeInProgress === rowKey;

                    return (
                      <React.Fragment key={rowKey}>
                        <tr
                          id={`outlet-prod-row-${item.product_id}`}
                          onClick={() =>
                            setExpandedProductRow(prev => (prev === rowKey ? null : rowKey))
                          }
                          className={`cursor-pointer hover:bg-[#F8FAFC] transition-colors ${
                            isExpanded ? 'bg-[#F0FDFA]' : ''
                          }`}
                        >
                          {/* Product Name */}
                          <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                            <div className="flex items-center space-x-2">
                              <Package className="w-4 h-4 text-[#0F766E]" />
                              <span>{item.product_name}</span>
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3.5 px-4 text-[#64748B]">
                            ₹{item.wholesale_price}/{item.product_unit}
                          </td>

                          {/* Predicted Interval */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-baseline space-x-1">
                              <span className="font-bold text-[#0F172A] text-sm">
                                {item.predicted_interval}
                              </span>
                              <span className="text-[#64748B] text-xs">days</span>
                            </div>
                            <span className="text-[10px] text-[#64748B]">
                              avg order: {item.recent_average_quantity} {item.product_unit}s
                            </span>
                          </td>

                          {/* Predicted Next Date & Status */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col items-start space-y-1">
                              <span className="font-semibold text-[#0F172A]">
                                {item.predicted_next_reorder_date || item.predicted_next_date}
                              </span>
                              {getStatusBadge(item)}
                            </div>
                          </td>

                          {/* Confidence Badge */}
                          <td className="py-3.5 px-4">
                            {getConfidenceBadge(item.confidence)}
                          </td>

                          {/* Quick Actions */}
                          <td
                            className="py-3.5 px-4 text-right"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                type="button"
                                disabled={isNudging}
                                onClick={e =>
                                  handleSendNudge(e, item.outlet_id, item.product_id, rowKey)
                                }
                                title="Send reorder reminder nudge"
                                className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                  nudgeTime
                                    ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
                                    : 'bg-white hover:bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]'
                                }`}
                              >
                                <Send className="w-3.5 h-3.5 text-[#2563EB]" />
                                <span>{nudgeTime ? `Nudged ${nudgeTime}` : 'Nudge'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setConfirmModalItem(item)}
                                className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold ${BUTTON_STYLES.primary}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                <span>Confirm order</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded details for product: reasoning & history */}
                        {isExpanded && (
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <td colSpan={6} className="p-4 sm:p-5">
                              <div className="space-y-3 max-w-4xl mx-auto">
                                <div className="p-3.5 rounded-xl bg-white border border-[#99F6E4] shadow-2xs flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Sparkles className="w-4 h-4 text-[#0F766E] shrink-0" />
                                    <span className="text-xs font-semibold text-[#0F172A]">
                                      &ldquo;{item.reasoning}&rdquo;
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-[#64748B]">
                                    Based on {item.order_count} past orders
                                  </span>
                                </div>

                                {/* Order history for this pair */}
                                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
                                  <div className="px-3.5 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#0F172A] uppercase tracking-wide">
                                    Order History for {item.product_name}
                                  </div>
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-[#F8FAFC] text-[11px] text-[#64748B] uppercase border-b border-[#E2E8F0]">
                                      <tr>
                                        <th className="py-2 px-3">Order ID</th>
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3">Quantity</th>
                                        <th className="py-2 px-3">Gap From Prior</th>
                                        <th className="py-2 px-3">Days Ago</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E2E8F0]">
                                      {item.order_history.map(ord => (
                                        <tr key={ord.id} className="hover:bg-[#F8FAFC]">
                                          <td className="py-1.5 px-3 font-mono text-[#64748B]">
                                            {ord.id}
                                          </td>
                                          <td className="py-1.5 px-3 font-medium text-[#0F172A]">
                                            {ord.date}
                                          </td>
                                          <td className="py-1.5 px-3 text-[#0F172A]">
                                            {ord.quantity} {item.product_unit}s
                                          </td>
                                          <td className="py-1.5 px-3">
                                            {ord.gap_days !== null ? (
                                              <span className="font-mono text-[#0F766E] font-semibold bg-[#F0FDFA] px-1.5 py-0.5 rounded border border-[#99F6E4]/70">
                                                +{ord.gap_days}d
                                              </span>
                                            ) : (
                                              <span className="text-[#64748B] italic">first</span>
                                            )}
                                          </td>
                                          <td className="py-1.5 px-3 text-[#64748B]">
                                            {ord.days_ago === 0 ? 'Today' : `${ord.days_ago}d ago`}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal for Order Confirmation */}
        <ConfirmOrderModal
          isOpen={Boolean(confirmModalItem)}
          onClose={() => setConfirmModalItem(null)}
          prediction={confirmModalItem}
          outlet={outlets.find(o => o.id === confirmModalItem?.outlet_id)}
          product={products.find(p => p.id === confirmModalItem?.product_id)}
          asOfDate={asOfDate}
          onOrderConfirmed={handleConfirmOrder}
        />
      </div>
    );
  }

  // ==========================================
  // VIEW 2: OUTLETS DIRECTORY LISTING
  // ==========================================
  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className={`${CARD_STYLE} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
              Your Outlets
            </h2>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Click any outlet to see its order history and reorder pattern.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="text-xs text-[#64748B] bg-[#F8FAFC] px-3 py-1.5 rounded-lg border border-[#E2E8F0]">
            Total Outlets: <strong className="text-[#0F766E] font-bold">{outlets.length}</strong>
          </div>
          {onOpenPhotoImport && (
            <button
              id="outlets-import-photo-btn"
              type="button"
              onClick={onOpenPhotoImport}
              className={`${BUTTON_STYLES.primary} text-xs py-1.5 px-3`}
            >
              <Camera className="w-3.5 h-3.5 mr-1" />
              <span>Import from photo</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className={`${CARD_STYLE} p-3.5`}>
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="outlets-search-input"
            type="text"
            placeholder="Search outlet by name, owner, route, or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs sm:text-sm text-[#0F172A] placeholder-[#64748B]/60 focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors"
          />
        </div>
      </div>

      {/* Outlets Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="outlets-directory-grid">
        {filteredOutlets.length === 0 ? (
          <div className="col-span-full py-16 text-center text-[#64748B] text-sm bg-white rounded-xl border border-[#E2E8F0]">
            No outlets found matching &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredOutlets.map(outlet => {
            const stats = outletProductCounts.get(outlet.id) || {
              totalProducts: 0,
              overdueCount: 0,
              dueTodayCount: 0,
            };

            return (
              <div
                key={outlet.id}
                id={`outlet-card-${outlet.id}`}
                onClick={() => setSelectedOutletId(outlet.id)}
                className={`${CARD_STYLE} p-5 hover:border-[#0F766E] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0F766E] group-hover:bg-[#0F766E] group-hover:text-white flex items-center justify-center transition-colors">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#0F172A] group-hover:text-[#0F766E] transition-colors text-sm sm:text-base">
                          {outlet.name}
                        </h3>
                        <span className="text-[11px] text-[#64748B] flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-[#64748B]" />
                          <span>{outlet.route}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                    {outlet.owner && (
                      <div className="flex items-center space-x-1.5 text-[#64748B]">
                        <User className="w-3.5 h-3.5 text-[#64748B]" />
                        <span>Owner: {outlet.owner}</span>
                      </div>
                    )}
                    {outlet.phone && (
                      <div className="flex items-center space-x-1.5 text-[#64748B] font-mono text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-[#64748B]" />
                        <span>{outlet.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Stats & CTA */}
                <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-[#0F172A]">
                      {stats.totalProducts} product{stats.totalProducts !== 1 ? 's' : ''}
                    </span>
                    {stats.overdueCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
                        {stats.overdueCount} due
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#DCFCE7] text-[#16A34A]">
                        Nothing due
                      </span>
                    )}
                  </div>

                  <span className="text-[#0F766E] font-semibold group-hover:translate-x-0.5 transition-transform flex items-center space-x-0.5 text-xs">
                    <span>View Detail</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
