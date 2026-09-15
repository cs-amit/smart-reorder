import React, { useState } from 'react';
import QRCode from 'qrcode';
import { NudgeRecord, Product, Distributor, Outlet } from '../types';
import {
  MessageSquare,
  Sparkles,
  CheckCheck,
  Check,
  CheckCircle2,
  QrCode,
  Building2,
  Package,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  X,
  Clock,
  Send,
  Smartphone,
} from 'lucide-react';

// Renders every nudge ever sent, oldest first — this is the retailer's one
// persistent place to see the full simulated WhatsApp history, not just
// what's currently unread (which used to vanish once marked read).

// Per-nudge "pay via WhatsApp" progress. This is purely local UI state (not
// persisted) that plays out a simulated two-way exchange: the real order
// write happens once, at the transition out of 'idle' — everything after
// that is just the conversation animating forward.
type PaymentStage = 'idle' | 'placing' | 'requesting' | 'qr' | 'paid';

interface WhatsAppNudgesListProps {
  nudges: NudgeRecord[];
  distributor: Distributor;
  outlet: Outlet | null;
  products: Product[];
  onConfirmDraftOrder: (nudge: NudgeRecord) => Promise<boolean>;
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
  const unreadCount = nudges.filter(n => !n.read).length;
  const sortedNudges = [...nudges].sort((a, b) => (a.sent_at || '').localeCompare(b.sent_at || ''));

  const [paymentStage, setPaymentStage] = useState<Record<string, PaymentStage>>({});
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  const handlePayViaWhatsApp = async (nudge: NudgeRecord, amount: number) => {
    setPaymentStage(prev => ({ ...prev, [nudge.id]: 'placing' }));
    const ok = await onConfirmDraftOrder(nudge);
    if (!ok) {
      setPaymentStage(prev => ({ ...prev, [nudge.id]: 'idle' }));
      return;
    }
    setPaymentStage(prev => ({ ...prev, [nudge.id]: 'requesting' }));

    const upiId = distributor.upi_id || 'distributor@upi';
    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      distributor.name
    )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Reorder-${nudge.id}`)}`;

    // Small delay so the "requesting" bubble is visibly its own step before
    // the QR reply arrives — mimics a real back-and-forth rather than
    // everything popping in at once.
    setTimeout(async () => {
      try {
        const url = await QRCode.toDataURL(upiString, {
          width: 220,
          margin: 2,
          color: { dark: '#0F172A', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
        setQrDataUrls(prev => ({ ...prev, [nudge.id]: url }));
      } catch (err) {
        console.error('QR code generation error:', err);
      }
      setPaymentStage(prev => ({ ...prev, [nudge.id]: 'qr' }));
    }, 700);
  };

  const handleIvePaid = (nudgeId: string) => {
    setPaymentStage(prev => ({ ...prev, [nudgeId]: 'paid' }));
  };

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

        {unreadCount > 1 && onMarkAllAsRead && (
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
        {sortedNudges.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-xs text-stone-500 font-medium">
              No reorder reminders yet. They'll show up here as soon as something's due.
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="bg-white/90 text-stone-600 text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-2xs border border-stone-200/60">
              {sortedNudges.length} message{sortedNudges.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {sortedNudges.map(nudge => {
          const prod = products.find(p => p.id === nudge.product_id);
          const quantity = nudge.suggested_quantity || 10;
          const unitPrice = nudge.wholesale_price || prod?.wholesale_price || 500;
          const subtotal = quantity * unitPrice;
          const timeStr = formatTime(nudge.sent_at);
          const isRead = !!nudge.read;
          const stage: PaymentStage = paymentStage[nudge.id] || 'idle';
          const productLabel = nudge.product_name || prod?.name || nudge.product_id;
          const unitLabel = nudge.product_unit || prod?.unit || 'cases';

          return (
          <React.Fragment key={nudge.id}>
            <div
              id={`whatsapp-nudge-bubble-${nudge.id}`}
              className={`max-w-xl mx-auto bg-white rounded-2xl p-4 shadow-sm border space-y-3 relative ${
                isRead ? 'border-[#E0E0E0]/70 opacity-80' : 'border-[#E0E0E0]'
              }`}
            >
              {/* Sender & timestamp header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-[#075E54]">
                    {distributor.name}
                  </span>
                  <span className="text-[10px] text-stone-400">• Automated</span>
                </div>
                {isRead ? (
                  <span className="text-[10px] text-stone-400 font-medium">Read</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onMarkAsRead(nudge.id)}
                    className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors"
                    title="Mark as read"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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

                  {/* Primary CTA: tapping starts the pay-via-WhatsApp exchange below */}
                  {stage === 'idle' && (
                    <button
                      id={`whatsapp-confirm-btn-${nudge.id}`}
                      type="button"
                      onClick={() => {
                        onMarkAsRead(nudge.id);
                        handlePayViaWhatsApp(nudge, subtotal);
                      }}
                      className="bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer border border-[#1ebd56]"
                    >
                      <Send className="w-3.5 h-3.5 text-stone-900" />
                      <span>Pay via WhatsApp</span>
                      <ArrowRight className="w-3 h-3 text-stone-900 ml-0.5" />
                    </button>
                  )}
                  {stage === 'placing' && (
                    <span className="text-[11px] font-semibold text-stone-500 px-2">
                      Placing order…
                    </span>
                  )}
                  {(stage === 'requesting' || stage === 'qr' || stage === 'paid') && (
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Payment started — see below</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Timestamp and checkmark footer — blue double-check only once actually read */}
              <div className="flex items-center justify-end space-x-1 text-[10px] text-stone-400 pt-0.5">
                <span>{timeStr}</span>
                <CheckCheck className={`w-3 h-3 ${isRead ? 'text-[#53bdeb]' : 'text-stone-400'}`} />
              </div>
            </div>

            {/* Two-way simulated "pay via WhatsApp" exchange — grows as the
                retailer progresses, styled as real outgoing/incoming chat bubbles. */}
            {stage !== 'idle' && stage !== 'placing' && (
              <div className="max-w-xl mx-auto space-y-2 px-1">
                {/* Outgoing (retailer) bubble */}
                <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="max-w-[85%] bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-xs text-stone-800 shadow-xs">
                    Requesting payment for {quantity} {unitLabel} of {productLabel} — ₹
                    {subtotal.toLocaleString('en-IN')}…
                  </div>
                </div>

                {/* Incoming (distributor bot) QR reply bubble */}
                {(stage === 'qr' || stage === 'paid') && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="max-w-[85%] bg-white border border-[#E0E0E0] rounded-2xl rounded-tl-sm px-3.5 py-3 shadow-xs space-y-2.5">
                      <span className="text-xs font-bold text-[#075E54]">{distributor.name}</span>
                      {qrDataUrls[nudge.id] ? (
                        <img
                          src={qrDataUrls[nudge.id]}
                          alt="UPI QR Code"
                          className="w-36 h-36 object-contain rounded-lg border border-stone-100 mx-auto"
                        />
                      ) : (
                        <div className="w-36 h-36 flex items-center justify-center text-stone-400 text-[10px] mx-auto">
                          Generating QR…
                        </div>
                      )}
                      <div className="flex items-center justify-center space-x-1.5 text-[10px] text-stone-500">
                        <Smartphone className="w-3 h-3 text-[#0F766E]" />
                        <span>₹{subtotal.toLocaleString('en-IN')} · Scan to pay</span>
                      </div>
                      {stage === 'qr' && (
                        <button
                          id={`whatsapp-ive-paid-btn-${nudge.id}`}
                          type="button"
                          onClick={() => handleIvePaid(nudge.id)}
                          className="w-full bg-[#0F766E] hover:bg-[#14B8A6] text-white font-bold py-2 rounded-xl text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>I've Paid</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Confirmation bubble */}
                {stage === 'paid' && (
                  <div className="flex justify-start animate-in fade-in zoom-in-95 duration-300">
                    <div className="max-w-[85%] bg-[#E7FFDB] border border-[#B2E496] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs font-semibold text-emerald-900 shadow-xs flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Payment received! Your order is confirmed.</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
