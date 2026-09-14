import React, { useState, useMemo } from 'react';
import { NudgeRecord, Outlet, Product } from '../types';
import {
  Bell,
  Search,
  CheckCheck,
  Check,
  Clock,
  Store,
  Package,
  Calendar,
  Filter,
  ShieldAlert,
  Send,
  Sparkles,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { BUTTON_STYLES, CARD_STYLE } from '../lib/theme';
import { apiFetch } from '../lib/api';

interface NudgesTabProps {
  nudges: NudgeRecord[];
  asOfDate: string;
  outlets: Outlet[];
  products: Product[];
  onRefresh: () => Promise<void>;
  onManualNudge?: (outletId: string, productId: string) => Promise<void>;
}

export const NudgesTab: React.FC<NudgesTabProps> = ({
  nudges,
  asOfDate,
  outlets,
  products,
  onRefresh,
  onManualNudge,
}) => {
  const [filterMode, setFilterMode] = useState<'today' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(outlets[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSendNudge = async () => {
    if (!selectedOutletId || !selectedProductId) return;
    setIsSending(true);
    try {
      if (onManualNudge) {
        await onManualNudge(selectedOutletId, selectedProductId);
      } else {
        await apiFetch('/api/nudges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outlet_id: selectedOutletId,
            product_id: selectedProductId,
            date: asOfDate,
            message: customMessage || undefined,
          }),
        });
        await onRefresh();
      }
      setIsSendModalOpen(false);
      setCustomMessage('');
    } catch (err) {
      console.error('Failed to send manual nudge:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Nudges sent today (as of date)
  const todayNudges = useMemo(() => {
    return nudges.filter(n => (n.sent_at || '').startsWith(asOfDate));
  }, [nudges, asOfDate]);

  // Filtered dataset
  const filteredNudges = useMemo(() => {
    const base = filterMode === 'today' ? todayNudges : nudges;

    return base.filter(nudge => {
      // Status filter
      if (statusFilter === 'unread' && nudge.read) return false;
      if (statusFilter === 'read' && !nudge.read) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const oName = (nudge.outlet_name || '').toLowerCase();
        const pName = (nudge.product_name || '').toLowerCase();
        const msg = (nudge.message || '').toLowerCase();
        const route = (nudge.outlet_route || '').toLowerCase();
        return oName.includes(q) || pName.includes(q) || msg.includes(q) || route.includes(q);
      }
      return true;
    });
  }, [nudges, todayNudges, filterMode, statusFilter, searchQuery]);

  const totalToday = todayNudges.length;
  const unreadCount = todayNudges.filter(n => !n.read).length;
  const readCount = todayNudges.filter(n => n.read).length;

  const formatTime = (isoString: string) => {
    if (!isoString) return '--:--';
    try {
      const parts = isoString.split('T');
      if (parts[1]) {
        const timePart = parts[1].substring(0, 5);
        const [hh, mm] = timePart.split(':');
        const h = parseInt(hh, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedH = h % 12 || 12;
        return `${formattedH}:${mm} ${ampm}`;
      }
      return isoString;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${CARD_STYLE} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Nudges Sent Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]/70 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-[#0F172A]">{totalToday}</span>
            <span className="text-xs text-[#64748B] font-medium">on {asOfDate}</span>
          </div>
        </div>

        <div className={`${CARD_STYLE} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Unread on WhatsApp
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-[#D97706]">{unreadCount}</span>
            <span className="text-xs text-[#D97706] font-medium">Awaiting retailer tap</span>
          </div>
        </div>

        <div className={`${CARD_STYLE} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Read / Viewed
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] flex items-center justify-center">
              <CheckCheck className="w-4 h-4 text-[#2563EB]" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-[#2563EB]">{readCount}</span>
            <span className="text-xs text-[#2563EB] font-medium">Viewed by retailer</span>
          </div>
        </div>

        <div className={`${CARD_STYLE} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Converted Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-[#16A34A]">
              {readCount > 0 ? Math.round((readCount / (totalToday || 1)) * 100) : 0}%
            </span>
            <span className="text-xs text-[#16A34A] font-medium">1-tap conversion</span>
          </div>
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className={`${CARD_STYLE} p-3.5`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Day Mode Switcher */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              id="nudges-filter-today-btn"
              type="button"
              onClick={() => setFilterMode('today')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'today'
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Today&apos;s Dispatched ({totalToday})
            </button>
            <button
              id="nudges-filter-all-btn"
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-[#0F766E] text-white shadow-xs'
                  : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              All Nudges Log ({nudges.length})
            </button>
          </div>

          {/* Search Input & Status Filter */}
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg justify-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="nudges-search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search outlet, product, reasoning..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] placeholder-[#64748B]/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            <select
              id="nudges-status-filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="text-xs rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[#0F172A] focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read Only</option>
            </select>

            <button
              id="nudges-refresh-btn"
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              title="Refresh log"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              id="nudges-open-send-modal-btn"
              type="button"
              onClick={() => setIsSendModalOpen(true)}
              className={`${BUTTON_STYLES.primary} text-xs py-1.5 px-3`}
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              <span>Send Nudge</span>
            </button>
          </div>
        </div>
      </div>

      {/* Styled Nudges Log Table */}
      <div className={`${CARD_STYLE} overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-[#0F766E]" />
            <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              {filterMode === 'today' ? `Dispatched Today (${asOfDate})` : 'Historical Dispatch Log'}
            </span>
          </div>
          <span className="text-xs text-[#64748B]">
            Showing {filteredNudges.length} of {filterMode === 'today' ? totalToday : nudges.length} records
          </span>
        </div>

        {filteredNudges.length > 0 ? (
          <div className="divide-y divide-[#E2E8F0]">
            {filteredNudges.map(nudge => {
              const timeStr = formatTime(nudge.sent_at);
              const dateStr = nudge.sent_at?.split('T')[0] || asOfDate;

              return (
                <div
                  key={nudge.id}
                  id={`nudge-row-${nudge.id}`}
                  className="p-4 sm:p-5 hover:bg-[#F8FAFC] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                >
                  {/* Left Column: Timestamp & Outlet */}
                  <div className="space-y-1.5 md:w-60 shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[#64748B] font-semibold bg-[#F1F5F9] px-2 py-0.5 rounded text-[11px] flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-[#64748B]" />
                        <span>{timeStr}</span>
                      </span>
                      {dateStr !== asOfDate && (
                        <span className="text-[10px] text-[#64748B] font-mono">({dateStr})</span>
                      )}
                    </div>
                    <div>
                      <span className="font-extrabold text-[#0F172A] text-sm block">
                        {nudge.outlet_name || nudge.outlet_id}
                      </span>
                      {nudge.outlet_route && (
                        <span className="text-[11px] text-[#64748B]">Route: {nudge.outlet_route}</span>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Product & Reasoning Message */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4]/70 px-2 py-0.5 rounded-md text-xs">
                        {nudge.product_name || nudge.product_id}
                      </span>
                      {nudge.suggested_quantity && (
                        <span className="text-[11px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                          Pre-attached Draft: <strong>{nudge.suggested_quantity} {nudge.product_unit || 'cases'}</strong>
                        </span>
                      )}
                    </div>

                    {/* Reasoning String */}
                    <div className="text-[#0F172A] bg-[#F8FAFC] rounded-xl px-3 py-2 border border-[#E2E8F0] text-xs italic leading-relaxed">
                      &ldquo;{nudge.message}&rdquo;
                    </div>
                  </div>

                  {/* Right Column: Status & WhatsApp Delivery Confirmation */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:w-44 shrink-0">
                    {nudge.read ? (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0] font-bold text-[11px]">
                        <CheckCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span>Read on WhatsApp</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] font-bold text-[11px]">
                        <Check className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>Sent (Unread)</span>
                      </div>
                    )}

                    <span className="text-[10px] text-[#64748B]">WhatsApp Business API</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-[#64748B] text-xs">
            No WhatsApp nudges found matching current criteria.
          </div>
        )}
      </div>

      {/* Manual Nudge Modal */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className={`${CARD_STYLE} max-w-md w-full p-6 space-y-4`}>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-4 h-4 text-[#0F766E]" />
                <h3 className="font-bold text-sm text-[#0F172A]">Send Custom WhatsApp Nudge</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSendModalOpen(false)}
                className="text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748B] font-semibold mb-1">Target Outlet</label>
                <select
                  value={selectedOutletId}
                  onChange={e => setSelectedOutletId(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg p-2 bg-[#F8FAFC]"
                >
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.route})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">Target Product</label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg p-2 bg-[#F8FAFC]"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.wholesale_price}/{p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#64748B] font-semibold mb-1">Custom Message (Optional)</label>
                <textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="e.g. Namaste! Based on your usual restock schedule, your Maggi inventory is likely running low today..."
                  className="w-full border border-[#E2E8F0] rounded-lg p-2 h-20 bg-[#F8FAFC]"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSendModalOpen(false)}
                className={`${BUTTON_STYLES.secondary} text-xs py-1.5 px-3`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleSendNudge}
                className={`${BUTTON_STYLES.primary} text-xs py-1.5 px-3`}
              >
                {isSending ? 'Sending...' : 'Send Nudge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
