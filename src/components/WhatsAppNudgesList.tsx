import React, { useState } from 'react';
import { NudgeRecord, Product, Distributor, Outlet } from '../types';
import {
  MessageSquare,
  Sparkles,
  CheckCheck,
  Check,
  QrCode,
  Building2,
  Package,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  X,
  Clock,
  Send,
} from 'lucide-react';

interface WhatsAppNudgesListProps {
  nudges: NudgeRecord[];
  distributor: Distributor;
  outlet: Outlet | null;
  products: Product[];
  onConfirmDraftOrder: (nudge: NudgeRecord) => void;
  onMarkAsRead: (nudgeId: string) => void;
  onMarkAllAsRead?: () => void;
}

export const WhatsAppNudgesList: React.FC<WhatsAppNudgesListProps> = ({
  nudges,
  distributor,
  outlet,
  products,
  onConfirmDraftOrder,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const unreadNudges = nudges.filter(n => !n.read);

  if (unreadNudges.length === 0) {
    return null;
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return '9:00 AM';
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
    } catch {}
    return '9:00 AM';
  };

  return (
    <div
      id="whatsapp-nudges-container"
      className="bg-[#EFEAE2] rounded-3xl border border-[#D1D7DB] shadow-md overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200"
    >
      {/* WhatsApp Header Bar */}
      <div className="bg-[#075E54] text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          {/* Avatar with WhatsApp online indicator */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#128C7E] flex items-center justify-center font-bold text-white border border-white/30 text-sm shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#075E54] rounded-full" />
          </div>

          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-sm tracking-tight text-white">
                {distributor.name}
              </span>
              <span className="inline-flex items-center text-[10px] bg-emerald-800 text-emerald-100 px-1.5 py-0.2 rounded font-semibold border border-emerald-600">
                <ShieldCheck className="w-2.5 h-2.5 mr-0.5 text-emerald-300" />
                Verified Business
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/90 font-medium">
              Automatic reorder reminder
            </p>
          </div>
        </div>

        {unreadNudges.length > 1 && onMarkAllAsRead && (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="text-[11px] text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-colors font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* WhatsApp Message Body / Chat Stream */}
      <div className="p-4 sm:p-5 space-y-4 max-h-[520px] overflow-y-auto">
        {/* Date separator chip */}
        <div className="flex justify-center">
          <span className="bg-white/90 text-stone-600 text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-2xs border border-stone-200/60">
            TODAY
          </span>
        </div>

        {unreadNudges.map(nudge => {
          const prod = products.find(p => p.id === nudge.product_id);
          const quantity = nudge.suggested_quantity || 10;
          const unitPrice = nudge.wholesale_price || prod?.wholesale_price || 500;
          const subtotal = quantity * unitPrice;
          const timeStr = formatTime(nudge.sent_at);

          return (
            <div
              key={nudge.id}
              id={`whatsapp-nudge-bubble-${nudge.id}`}
              className="max-w-xl mx-auto bg-white rounded-2xl p-4 shadow-sm border border-[#E0E0E0] space-y-3 relative"
            >
              {/* Sender & timestamp header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-[#075E54]">
                    {distributor.name}
                  </span>
                  <span className="text-[10px] text-stone-400">• Automated</span>
                </div>
                <button
                  type="button"
                  onClick={() => onMarkAsRead(nudge.id)}
                  className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors"
                  title="Dismiss nudge"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Message text with reasoning string */}
              <div className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium space-y-1">
                <p>
                  Hello <strong>{outlet?.name || nudge.outlet_name}</strong>! 👋
                </p>
                <p className="text-stone-700">
                  {nudge.message}
                </p>
              </div>

              {/* Pre-attached Draft Order Card (Stage 6 integration) */}
              <div className="bg-[#E7FFDB]/60 border border-[#B2E496] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-stone-900 block">
                        {nudge.product_name || prod?.name || nudge.product_id}
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium">
                        Suggested amount, based on your usual order
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-[#B2E496]">
                    {quantity} {nudge.product_unit || prod?.unit || 'cases'}
                  </span>
                </div>

                {/* Subtotal & Action Button */}
                <div className="flex items-center justify-between pt-2 border-t border-[#B2E496]/60">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">
                      Total
                    </span>
                    <span className="text-sm font-extrabold text-emerald-950">
                      ₹{subtotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Primary CTA button: Tapping takes them straight to confirming that order with UPI QR */}
                  <button
                    id={`whatsapp-confirm-btn-${nudge.id}`}
                    type="button"
                    onClick={() => {
                      onMarkAsRead(nudge.id);
                      onConfirmDraftOrder(nudge);
                    }}
                    className="bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer border border-[#1ebd56]"
                  >
                    <QrCode className="w-3.5 h-3.5 text-stone-900" />
                    <span>Confirm & Pay via UPI</span>
                    <ArrowRight className="w-3 h-3 text-stone-900 ml-0.5" />
                  </button>
                </div>
              </div>

              {/* Timestamp and Double Checkmark footer */}
              <div className="flex items-center justify-end space-x-1 text-[10px] text-stone-400 pt-0.5">
                <span>{timeStr}</span>
                <CheckCheck className="w-3 h-3 text-[#53bdeb]" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
