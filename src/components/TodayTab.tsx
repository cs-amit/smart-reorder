import React, { useState, useMemo } from 'react';
import { PredictionResult, ConfidenceTier, Outlet, Product } from '../types';
import { ConfirmOrderModal } from './ConfirmOrderModal';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  Clock,
  Package,
  Send,
  CheckCircle2,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';
import { apiFetch } from '../lib/api';

interface TodayTabProps {
  predictions: PredictionResult[];
  outlets: Outlet[];
  products: Product[];
  isLoading: boolean;
  asOfDate: string;
  onRefreshData: () => Promise<void>;
  onLogNudge: (outletId: string, productId: string) => Promise<void>;
}

export const TodayTab: React.FC<TodayTabProps> = ({
  predictions,
  outlets,
  products,
  isLoading,
  asOfDate,
  onRefreshData,
  onLogNudge,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [selectedConfidence, setSelectedConfidence] = useState<string>('all');
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

  // Modal State for Confirm Order
  const [confirmModalItem, setConfirmModalItem] = useState<PredictionResult | null>(null);
  const [nudgedKeys, setNudgedKeys] = useState<Record<string, string>>({});
  const [nudgeInProgress, setNudgeInProgress] = useState<string | null>(null);

  // Available routes
  const routes = useMemo(() => {
    const set = new Set<string>();
    predictions.forEach(p => {
      if (p.route) set.add(p.route);
    });
    return Array.from(set).sort();
  }, [predictions]);

  // Filtered & Ranked predictions:
  // "outlets ranked by predicted_next_date (most overdue first)"
  const rankedPredictions = useMemo(() => {
    const filtered = predictions.filter(item => {
      const matchesSearch =
        item.outlet_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.route.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRoute = selectedRoute === 'all' || item.route === selectedRoute;
      const matchesConfidence =
        selectedConfidence === 'all' ||
        String(item.confidence).toLowerCase() === selectedConfidence.toLowerCase();

      return matchesSearch && matchesRoute && matchesConfidence;
    });

    // Rank by predicted_next_date ascending (most overdue first)
    return filtered.sort((a, b) => {
      const dateA = a.predicted_next_date || a.predicted_next_reorder_date || '';
      const dateB = b.predicted_next_date || b.predicted_next_reorder_date || '';
      const cmp = dateA.localeCompare(dateB);
      if (cmp !== 0) return cmp;
      return b.days_since_last_order - a.days_since_last_order;
    });
  }, [predictions, searchQuery, selectedRoute, selectedConfidence]);

  const toggleRow = (key: string) => {
    setExpandedRowKey(prev => (prev === key ? null : key));
  };

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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mr-1.5" />
            Confident
          </span>
        );
      case 'learning':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] mr-1.5" />
            Learning
          </span>
        );
      case 'cold':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
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

  // Quick stats
  const overdueCount = predictions.filter(
    p => p.status === 'overdue' || p.predicted_next_date < asOfDate
  ).length;
  const dueTodayCount = predictions.filter(
    p => p.status === 'due_today' || p.predicted_next_date === asOfDate
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Metric Badges */}
      <div className={`${CARD_STYLE} p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
              Today&apos;s Reorder Radar
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]">
              Ranked Overdue First
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Most overdue outlets first, based on each shop&apos;s usual ordering pattern as of{' '}
            <strong className="text-[#0F172A]">{asOfDate}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] rounded-lg text-xs font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
            <span>{overdueCount} Overdue</span>
          </div>
          <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] rounded-lg text-xs font-bold">
            <Clock className="w-3.5 h-3.5 text-[#D97706]" />
            <span>{dueTodayCount} Due Today</span>
          </div>
          <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] rounded-lg text-xs font-medium">
            <span>{predictions.length} Total Monitored</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={`${CARD_STYLE} p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3`}>
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="today-search-input"
            type="text"
            placeholder="Search outlet, product or route..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs sm:text-sm text-[#0F172A] placeholder-[#64748B]/60 focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E] transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Route Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="text-xs font-medium text-[#64748B]">Route:</span>
            <select
              id="today-route-filter"
              value={selectedRoute}
              onChange={e => setSelectedRoute(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="all">All Routes</option>
              {routes.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Confidence Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-xs font-medium text-[#64748B]">Confidence:</span>
            <select
              id="today-confidence-filter"
              value={selectedConfidence}
              onChange={e => setSelectedConfidence(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="all">All Tiers</option>
              <option value="confident">Confident</option>
              <option value="learning">Learning</option>
              <option value="cold">Cold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Ranked Table */}
      <div className={`${CARD_STYLE} overflow-hidden`}>
        {isLoading ? (
          <div className="py-16 text-center text-[#64748B] text-sm">
            <Clock className="w-6 h-6 mx-auto mb-2 animate-spin text-[#0F766E]" />
            Working out who's due for a reorder...
          </div>
        ) : rankedPredictions.length === 0 ? (
          <div className="py-16 text-center text-[#64748B] text-sm">
            {predictions.length === 0
              ? "No reorder predictions yet — once a few orders are placed for your outlets, they'll show up here."
              : 'Nothing matches your search or filters. Try clearing them.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="today-rankings-table">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="py-3 px-4">Rank / Outlet</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Days Since Last Order</th>
                  <th className="py-3 px-4">Predicted Next Date</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4 text-right">Quick Actions</th>
                  <th className="py-3 px-2 text-center w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs sm:text-sm">
                {rankedPredictions.map((item, index) => {
                  const rowKey = `${item.outlet_id}::${item.product_id}`;
                  const isExpanded = expandedRowKey === rowKey;
                  const isOverdue =
                    item.status === 'overdue' || item.predicted_next_date < asOfDate;
                  const isDueToday =
                    item.status === 'due_today' || item.predicted_next_date === asOfDate;
                  const nudgeTime = nudgedKeys[rowKey];
                  const isNudging = nudgeInProgress === rowKey;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        id={`today-row-${item.outlet_id}-${item.product_id}`}
                        onClick={() => toggleRow(rowKey)}
                        style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                        className={`cursor-pointer transition-colors animate-in fade-in duration-300 fill-mode-both ${
                          isExpanded
                            ? 'bg-[#F0FDFA]'
                            : isOverdue
                            ? 'bg-[#FEF2F2]/60 hover:bg-[#FEE2E2]/70'
                            : isDueToday
                            ? 'bg-[#FFFBEB]/60 hover:bg-[#FEF3C7]/70'
                            : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {/* 1. Rank & Outlet Name */}
                        <td className="py-3.5 px-4 font-medium text-[#0F172A]">
                          <div className="flex items-center space-x-3">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isOverdue
                                  ? 'bg-[#FEE2E2] text-[#DC2626]'
                                  : isDueToday
                                  ? 'bg-[#FEF3C7] text-[#D97706]'
                                  : 'bg-[#F1F5F9] text-[#64748B]'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div>
                              <span className="font-bold text-[#0F172A] block">
                                {item.outlet_name}
                              </span>
                              <span className="text-[11px] text-[#64748B]">
                                Route: {item.route}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Product */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#0F172A]">
                              {item.product_name}
                            </span>
                            <span className="text-[11px] text-[#64748B]">
                              ₹{item.wholesale_price}/{item.product_unit}
                            </span>
                          </div>
                        </td>

                        {/* 3. Days Since Last Order */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-baseline space-x-1">
                            <span
                              className={`font-bold text-sm ${
                                item.days_since_last_order >= item.predicted_interval
                                  ? 'text-[#DC2626] font-extrabold'
                                  : 'text-[#0F172A]'
                              }`}
                            >
                              {item.days_since_last_order}
                            </span>
                            <span className="text-[#64748B] text-xs">days ago</span>
                          </div>
                          <span className="text-[10px] text-[#64748B] block">
                            Last: {item.last_order_date}
                          </span>
                        </td>

                        {/* 4. Predicted Next Date & Status */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start space-y-1">
                            <span className="font-semibold text-[#0F172A]">
                              {item.predicted_next_reorder_date || item.predicted_next_date}
                            </span>
                            {getStatusBadge(item)}
                          </div>
                        </td>

                        {/* 5. Confidence Badge */}
                        <td className="py-3.5 px-4">
                          {getConfidenceBadge(item.confidence)}
                        </td>

                        {/* 6. Quick Action Buttons: Confirm Order & Send Nudge */}
                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end space-x-2">
                            {/* Send Nudge Button */}
                            <button
                              type="button"
                              id={`nudge-btn-${item.outlet_id}-${item.product_id}`}
                              disabled={isNudging}
                              onClick={e =>
                                handleSendNudge(e, item.outlet_id, item.product_id, rowKey)
                              }
                              title="Send reorder nudge via WhatsApp"
                              className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                nudgeTime
                                  ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
                                  : 'bg-white hover:bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]'
                              }`}
                            >
                              <Send className="w-3.5 h-3.5 text-[#2563EB]" />
                              <span>{nudgeTime ? `Nudged ${nudgeTime}` : 'Send nudge'}</span>
                            </button>

                            {/* Confirm Order Button */}
                            <button
                              type="button"
                              id={`confirm-order-btn-${item.outlet_id}-${item.product_id}`}
                              onClick={() => setConfirmModalItem(item)}
                              title="Confirm and place new restock order"
                              className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold ${BUTTON_STYLES.primary}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              <span>Confirm order</span>
                            </button>
                          </div>
                        </td>

                        {/* Expand Chevron */}
                        <td className="py-3.5 px-2 text-center text-[#64748B]">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#0F766E] inline" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#64748B] inline" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded Details: Order History & Reasoning String */}
                      {isExpanded && (
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <td colSpan={7} className="p-4 sm:p-5">
                            <div className="max-w-4xl mx-auto space-y-4">
                              {/* Reasoning Statement Box */}
                              <div className="p-4 rounded-xl bg-white border border-[#99F6E4] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                                    <Sparkles className="w-4 h-4 text-[#0F766E]" />
                                    <span>Prediction Reasoning</span>
                                  </div>
                                  <p className="text-sm font-semibold text-[#0F172A]">
                                    &ldquo;{item.reasoning}&rdquo;
                                  </p>
                                  <p className="text-xs text-[#64748B]">
                                    Reorders every{' '}
                                    <strong className="text-[#0F172A]">
                                      {item.predicted_interval} days
                                    </strong>{' '}
                                    • Usual order size:{' '}
                                    <strong className="text-[#0F172A]">
                                      {item.recent_average_quantity} {item.product_unit}s
                                    </strong>
                                  </p>
                                </div>

                                <div className="flex items-center space-x-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmModalItem(item)}
                                    className={`${BUTTON_STYLES.primary} text-xs py-1.5 px-3`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    <span>Confirm {item.product_name}</span>
                                  </button>
                                </div>
                              </div>

                              {/* Order History Table for this Pair */}
                              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
                                <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                                    <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">
                                      Historical Orders for {item.outlet_name} • {item.product_name}
                                    </span>
                                  </div>
                                  <span className="text-xs text-[#64748B] font-medium">
                                    {item.order_count} Total Historical Order{item.order_count > 1 ? 's' : ''}
                                  </span>
                                </div>

                                {item.order_history && item.order_history.length > 0 ? (
                                  <div className="max-h-52 overflow-y-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead className="bg-[#F8FAFC] text-[11px] text-[#64748B] uppercase sticky top-0 border-b border-[#E2E8F0]">
                                        <tr>
                                          <th className="py-2 px-3">Order ID</th>
                                          <th className="py-2 px-3">Date</th>
                                          <th className="py-2 px-3">Quantity</th>
                                          <th className="py-2 px-3">Gap From Prior Order</th>
                                          <th className="py-2 px-3">Timeline</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#E2E8F0]">
                                        {item.order_history.map(ord => (
                                          <tr key={ord.id} className="hover:bg-[#F8FAFC]">
                                            <td className="py-2 px-3 font-mono font-medium text-[#64748B]">
                                              {ord.id}
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-[#0F172A]">
                                              {ord.date}
                                            </td>
                                            <td className="py-2 px-3 font-medium text-[#0F172A]">
                                              {ord.quantity} {item.product_unit}s
                                            </td>
                                            <td className="py-2 px-3">
                                              {ord.gap_days !== null ? (
                                                <span className="font-mono text-[#0F766E] font-semibold bg-[#F0FDFA] px-1.5 py-0.5 rounded border border-[#99F6E4]/70">
                                                  +{ord.gap_days} days
                                                </span>
                                              ) : (
                                                <span className="text-[#64748B] italic">
                                                  Baseline order
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-[#64748B]">
                                              {ord.days_ago === 0 ? 'Today' : `${ord.days_ago} days ago`}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="py-6 text-center text-xs text-[#64748B]">
                                    No prior orders on record for this outlet-product pair.
                                  </div>
                                )}
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

      {/* Confirm Order Modal */}
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
};
