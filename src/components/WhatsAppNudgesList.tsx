import React, { useState } from 'react';
import QRCode from 'qrcode';
import { NudgeRecord, Product, Distributor, Outlet } from '../types';
import {
  MessageSquare,
  CheckCheck,
  Check,
  CheckCircle2,
  Building2,
  Package,
  ArrowRight,
  ShieldCheck,
  X,
  Send,
  Smartphone,
  Smile,
  Paperclip,
  Mic,
  Plus,
} from 'lucide-react';

// Renders every nudge ever sent, oldest first, as an actual WhatsApp-style
// chat — this is the retailer's one persistent place to see the full
// simulated message history, not just what's currently unread.
//
// Two things are simulated here, and both are named explicitly in the UI
// rather than left implicit: replying to a distributor-sent reorder nudge
// from inside the chat, and starting a brand new order by chatting (the
// "+" compose flow). Neither goes over the real WhatsApp Business API —
// see the label strip above the chat window.

type PaymentStage = 'idle' | 'placing' | 'requesting' | 'qr' | 'paid';
type ComposeStage = 'idle' | 'picking_product' | 'picking_qty' | 'placing' | 'done';

interface WhatsAppNudgesListProps {
  nudges: NudgeRecord[];
  distributor: Distributor;
  outlet: Outlet | null;
  products: Product[];
  onConfirmDraftOrder: (nudge: NudgeRecord) => Promise<boolean>;
  onMarkAsRead: (nudgeId: string) => void;
  onMarkAllAsRead?: () => void;
  onComposeOrder: (productId: string, quantity: number) => Promise<boolean>;
}

interface BubbleAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

/** One WhatsApp-style chat bubble. `actions`, if given, render as full-width
 * tappable rows below the content — this is how real WhatsApp Business
 * "quick reply" / interactive-button messages actually look, not a styled
 * app button glued onto a card. */
const Bubble: React.FC<{
  direction: 'in' | 'out';
  children: React.ReactNode;
  time?: string;
  read?: boolean;
  wide?: boolean;
  actions?: BubbleAction[];
}> = ({ direction, children, time, read, wide, actions }) => (
  <div className={`flex ${direction === 'out' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}>
    <div
      className={`${wide ? 'max-w-[92%] sm:max-w-[75%]' : 'max-w-[85%] sm:max-w-[65%]'} rounded-lg shadow-xs text-stone-800 overflow-hidden ${
        direction === 'out' ? 'bg-[#D9FDD3] rounded-tr-sm' : 'bg-white rounded-tl-sm'
      }`}
    >
      <div className="px-3 py-2 text-[13px] leading-snug space-y-1">
        {children}
        {time && (
          <div className="flex items-center justify-end gap-1 pt-0.5">
            <span className="text-[10px] text-stone-400">{time}</span>
            {direction === 'out' && <CheckCheck className={`w-3 h-3 ${read ? 'text-[#53bdeb]' : 'text-stone-400'}`} />}
          </div>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="border-t border-stone-200">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              disabled={a.disabled}
              onClick={a.onClick}
              className={`w-full flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-[#0F766E] hover:bg-stone-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors cursor-pointer ${
                i > 0 ? 'border-t border-stone-200' : ''
              }`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

export const WhatsAppNudgesList: React.FC<WhatsAppNudgesListProps> = ({
  nudges,
  distributor,
  outlet,
  products,
  onConfirmDraftOrder,
  onMarkAsRead,
  onMarkAllAsRead,
  onComposeOrder,
}) => {
  const unreadCount = nudges.filter(n => !n.read).length;
  const sortedNudges = [...nudges].sort((a, b) => (a.sent_at || '').localeCompare(b.sent_at || ''));

  const [paymentStage, setPaymentStage] = useState<Record<string, PaymentStage>>({});
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  // "Start a new order via chat" — a separate flow from responding to a
  // nudge, appended at the bottom of the conversation once started.
  const [composeStage, setComposeStage] = useState<ComposeStage>('idle');
  const [composeProductId, setComposeProductId] = useState<string | null>(null);
  const [composeQuantity, setComposeQuantity] = useState<number | null>(null);
  const [composeCustomQty, setComposeCustomQty] = useState('');
  const [composeError, setComposeError] = useState<string | null>(null);

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

  const startCompose = () => {
    if (composeStage !== 'idle') return;
    setComposeError(null);
    setComposeStage('picking_product');
  };

  const resetCompose = () => {
    setComposeStage('idle');
    setComposeProductId(null);
    setComposeQuantity(null);
    setComposeCustomQty('');
    setComposeError(null);
  };

  const pickComposeProduct = (productId: string) => {
    setComposeProductId(productId);
    setComposeStage('picking_qty');
  };

  const confirmComposeQuantity = async (qty: number) => {
    if (!Number.isFinite(qty) || qty <= 0) {
      setComposeError('Enter a valid quantity greater than 0.');
      return;
    }
    if (!composeProductId) return;
    setComposeError(null);
    setComposeQuantity(qty);
    setComposeStage('placing');
    const ok = await onComposeOrder(composeProductId, qty);
    if (ok) {
      setComposeStage('done');
    } else {
      setComposeError('Could not place the order — please try again.');
      setComposeStage('picking_qty');
    }
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

  const composeProduct = products.find(p => p.id === composeProductId);

  return (
    <div className="space-y-2">
      {/* Simulation label — outside the chat window itself, so it's never
          mistaken for part of the "phone screen" below it. */}
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 bg-stone-100 border border-stone-200 px-3 py-1 rounded-full">
          <Smartphone className="w-3 h-3" />
          <span>Simulated WhatsApp — not sent via the real WhatsApp Business API</span>
        </span>
      </div>

      {/* Phone-frame treatment: makes clear this is meant to read as "what
          your phone would show," not another dashboard card. */}
      <div id="whatsapp-nudges-container" className="bg-[#0B141A] rounded-[28px] p-2 shadow-lg">
        <div className="rounded-[22px] overflow-hidden">
          {/* WhatsApp Header Bar */}
          <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-[#128C7E] flex items-center justify-center font-bold text-white border border-white/30 text-sm shadow-inner">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#075E54] rounded-full" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-white">
                    {distributor.name}
                  </span>
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                </div>
                <p className="text-[11px] text-emerald-200/90 font-medium">online</p>
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

          {/* Chat body — WhatsApp's characteristic tan wallpaper, bubbles
              sitting directly on it rather than each in its own card. */}
          <div
            className="p-3 sm:p-4 space-y-1.5 max-h-[520px] overflow-y-auto"
            style={{
              backgroundColor: '#E5DDD5',
              backgroundImage:
                'radial-gradient(circle at 12px 12px, rgba(0,0,0,0.035) 1.5px, transparent 1.5px)',
              backgroundSize: '28px 28px',
            }}
          >
            {sortedNudges.length === 0 && composeStage === 'idle' && (
              <div className="text-center py-10">
                <MessageSquare className="w-8 h-8 text-stone-400/70 mx-auto mb-2" />
                <p className="text-xs text-stone-500 font-medium max-w-[220px] mx-auto">
                  No messages yet. Reorder reminders will show up here — or tap "+" below to
                  order by chat right now.
                </p>
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
                  <Bubble direction="in">
                    <p>
                      Hello <strong>{outlet?.name || nudge.outlet_name}</strong>! 👋
                    </p>
                    <p className="text-stone-700">{nudge.message}</p>
                  </Bubble>

                  <Bubble
                    direction="in"
                    wide
                    time={timeStr}
                    read={isRead}
                    actions={
                      stage === 'idle'
                        ? [
                            {
                              label: 'Pay via WhatsApp',
                              icon: <Send className="w-3.5 h-3.5" />,
                              onClick: () => {
                                onMarkAsRead(nudge.id);
                                handlePayViaWhatsApp(nudge, subtotal);
                              },
                            },
                          ]
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-extrabold text-stone-900 block truncate">
                            {productLabel}
                          </span>
                          <span className="text-[10px] text-stone-500 block">
                            Suggested, based on your usual order
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-900 bg-[#E7FFDB] px-2 py-0.5 rounded-md shrink-0">
                        {quantity} {unitLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-stone-100">
                      <span className="text-[10px] uppercase font-bold text-stone-400">Total</span>
                      <span className="text-sm font-extrabold text-emerald-950">
                        ₹{subtotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {stage === 'placing' && (
                      <p className="text-[11px] text-stone-500 pt-0.5">Placing order…</p>
                    )}
                    {stage !== 'idle' && stage !== 'placing' && (
                      <p className="text-[11px] text-emerald-700 font-semibold pt-0.5 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Payment in progress below
                      </p>
                    )}
                  </Bubble>

                  {/* Two-way "pay via WhatsApp" exchange — grows as the
                      retailer progresses through it. */}
                  {stage !== 'idle' && stage !== 'placing' && (
                    <>
                      <Bubble direction="out">
                        Requesting payment for {quantity} {unitLabel} of {productLabel} — ₹
                        {subtotal.toLocaleString('en-IN')}…
                      </Bubble>

                      {(stage === 'qr' || stage === 'paid') && (
                        <Bubble
                          direction="in"
                          wide
                          actions={
                            stage === 'qr'
                              ? [
                                  {
                                    label: "I've Paid",
                                    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                                    onClick: () => handleIvePaid(nudge.id),
                                  },
                                ]
                              : undefined
                          }
                        >
                          <div className="text-center space-y-2">
                            {qrDataUrls[nudge.id] ? (
                              <img
                                src={qrDataUrls[nudge.id]}
                                alt="UPI QR Code"
                                className="w-32 h-32 object-contain rounded-lg border border-stone-100 mx-auto"
                              />
                            ) : (
                              <div className="w-32 h-32 flex items-center justify-center text-stone-400 text-[10px] mx-auto">
                                Generating QR…
                              </div>
                            )}
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-stone-500">
                              <Smartphone className="w-3 h-3 text-[#0F766E]" />
                              <span>₹{subtotal.toLocaleString('en-IN')} · Scan to pay</span>
                            </div>
                          </div>
                        </Bubble>
                      )}

                      {stage === 'paid' && (
                        <Bubble direction="in">
                          <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                            Payment received! Your order is confirmed.
                          </span>
                        </Bubble>
                      )}
                    </>
                  )}
                </React.Fragment>
              );
            })}

            {/* Compose-a-new-order flow, started via the "+" button below */}
            {composeStage !== 'idle' && (
              <>
                <Bubble direction="out">Hi! I'd like to place an order 🙂</Bubble>

                {composeStage === 'picking_product' && (
                  <Bubble
                    direction="in"
                    wide
                    actions={products.map(p => ({
                      label: `${p.name} · ₹${p.wholesale_price}/${p.unit}`,
                      onClick: () => pickComposeProduct(p.id),
                    }))}
                  >
                    Sure! Which product would you like to order?
                  </Bubble>
                )}

                {composeProductId && composeStage !== 'picking_product' && (
                  <>
                    <Bubble direction="out">I'd like to order: {composeProduct?.name}</Bubble>

                    {composeStage === 'picking_qty' && (
                      <Bubble
                        direction="in"
                        wide
                        actions={[5, 10, 20].map(q => ({
                          label: `${q} ${composeProduct?.unit || 'cases'}`,
                          onClick: () => confirmComposeQuantity(q),
                        }))}
                      >
                        <p>Great choice! How many {composeProduct?.unit || 'cases'} would you like?</p>
                        {composeError && <p className="text-[11px] text-red-600">{composeError}</p>}
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            id="whatsapp-compose-custom-qty"
                            type="number"
                            min="1"
                            value={composeCustomQty}
                            onChange={e => setComposeCustomQty(e.target.value)}
                            placeholder="Custom qty"
                            className="w-24 text-xs px-2 py-1.5 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0F766E]"
                          />
                          <button
                            type="button"
                            onClick={() => confirmComposeQuantity(Number(composeCustomQty))}
                            className="text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#14B8A6] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Send
                          </button>
                        </div>
                      </Bubble>
                    )}

                    {(composeStage === 'placing' || composeStage === 'done') && (
                      <Bubble direction="out">
                        Please send {composeQuantity} {composeProduct?.unit} of {composeProduct?.name}
                      </Bubble>
                    )}
                    {composeStage === 'placing' && <Bubble direction="in">Placing your order…</Bubble>}
                    {composeStage === 'done' && (
                      <Bubble
                        direction="in"
                        actions={[{ label: 'Place another order', icon: <Plus className="w-3.5 h-3.5" />, onClick: resetCompose }]}
                      >
                        <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          Got it! Your order for {composeQuantity} {composeProduct?.unit} of{' '}
                          {composeProduct?.name} has been placed.
                        </span>
                      </Bubble>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Fake input bar — completes the "this is a chat screen" read,
              and doubles as the entry point into the compose-order flow. */}
          <div className="bg-[#F0F2F5] px-2.5 py-2 flex items-center gap-2 border-t border-stone-300">
            <button
              type="button"
              id="whatsapp-start-compose-btn"
              onClick={startCompose}
              disabled={composeStage !== 'idle'}
              title="Start a new order by chat"
              className="flex-1 flex items-center gap-2 bg-white rounded-full px-3 py-2 text-left text-xs text-stone-400 disabled:opacity-60 cursor-pointer disabled:cursor-default"
            >
              <Smile className="w-4 h-4 text-stone-400 shrink-0" />
              <span className="flex-1">
                {composeStage === 'idle' ? 'Tap to order by chat…' : 'Reply using the buttons above'}
              </span>
              <Paperclip className="w-4 h-4 text-stone-400 shrink-0" />
            </button>
            <button
              type="button"
              onClick={startCompose}
              disabled={composeStage !== 'idle'}
              title="Start a new order"
              className="w-9 h-9 rounded-full bg-[#00A884] text-white flex items-center justify-center shrink-0 disabled:opacity-60 cursor-pointer disabled:cursor-default hover:bg-[#02997a] transition-colors"
            >
              {composeStage === 'idle' ? <Plus className="w-[18px] h-[18px]" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
