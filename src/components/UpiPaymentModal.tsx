import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  CheckCircle2,
  Copy,
  Check,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import { Order, Product, Outlet, Distributor } from '../types';

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  product?: Product | null;
  outlet?: Outlet | null;
  distributor?: Distributor | null;
  totalAmount: number;
  onViewHistory?: () => void;
}

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  isOpen,
  onClose,
  order,
  product,
  outlet,
  distributor,
  totalAmount,
  onViewHistory,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isPaymentSimulated, setIsPaymentSimulated] = useState<boolean>(false);
  const [txnRef, setTxnRef] = useState<string>('');

  const upiId = distributor?.upi_id || 'distributor@upi';
  const payeeName = distributor?.name || 'Your Distributor';

  useEffect(() => {
    if (!isOpen || !order) {
      setIsPaymentSimulated(false);
      return;
    }

    // Generate UPI string: upi://pay?pa=<upi_id>&pn=<name>&am=<amount>&cu=INR&tn=<note>
    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      payeeName
    )}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(`Reorder-${order.id}`)}`;

    QRCode.toDataURL(upiString, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('QR code generation error:', err));

    setTxnRef(`UPI${Math.floor(100000000000 + Math.random() * 900000000000)}`);
  }, [isOpen, order, totalAmount, upiId, payeeName]);

  if (!isOpen || !order) return null;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      id="upi-payment-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div
        id="upi-payment-modal-card"
        className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E2E8F0] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Branding Banner */}
        <div className="bg-[#0F766E] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-bold text-white text-xs tracking-wider">
              UPI
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#99F6E4]">
                Demo payment screen
              </div>
              <div className="text-sm font-bold text-white">
                Order placed
              </div>
            </div>
          </div>
          <button
            id="close-upi-modal-btn"
            type="button"
            onClick={onClose}
            className="text-[#CCFBF1] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {isPaymentSimulated ? (
            /* Verified Payment Screen */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-[#0F766E]" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[#0F172A]">
                  Payment marked as done
                </h3>
                <p className="text-xs text-[#64748B] mt-1">
                  Your order is confirmed and sent to your distributor.
                </p>
              </div>

              <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Reference No.:</span>
                  <span className="font-mono font-bold text-[#0F172A]">{txnRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Order ID:</span>
                  <span className="font-mono font-bold text-[#0F172A]">{order.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Amount:</span>
                  <span className="font-bold text-[#0F766E]">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Paid to:</span>
                  <span className="font-medium text-[#0F172A]">{payeeName}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                {onViewHistory && (
                  <button
                    id="view-in-history-btn"
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewHistory();
                    }}
                    className="flex-1 bg-[#0F766E] hover:bg-[#14B8A6] text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <span>View My Orders</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  id="done-reorder-btn"
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* QR Code Payment View */
            <>
              {/* Payee Info & Total */}
              <div className="text-center">
                <div className="inline-flex items-center space-x-1 text-xs text-[#64748B] mb-1">
                  <span>Pay:</span>
                  <strong className="text-[#0F172A] font-medium">{payeeName}</strong>
                </div>
                <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-[#64748B] mt-1">
                  {order.quantity} cases of {product?.name || order.product_name || 'Product'}
                </div>
              </div>

              {/* QR Box */}
              <div className="bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F0] rounded-2xl p-4 flex flex-col items-center justify-center">
                <div className="relative bg-white p-2 rounded-xl shadow-xs border border-[#E2E8F0]">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="UPI QR Code"
                      className="w-52 h-52 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-[#64748B] text-xs">
                      Generating QR code...
                    </div>
                  )}
                  {/* Subtle Center badge */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/95 px-2 py-0.5 rounded shadow-xs border border-[#E2E8F0] text-[10px] font-black text-[#0F766E] tracking-wider">
                      UPI
                    </div>
                  </div>
                </div>

                {/* Scan Guidance */}
                <div className="mt-3 flex items-center space-x-2 text-[#64748B] text-xs">
                  <Smartphone className="w-4 h-4 text-[#0F766E]" />
                  <span>Scan with Google Pay, PhonePe, Paytm, or BHIM</span>
                </div>
              </div>

              {/* UPI ID Copy Line */}
              <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] flex items-center justify-between text-xs">
                <div className="overflow-hidden">
                  <span className="text-[11px] text-[#64748B] block">UPI ID</span>
                  <span className="font-mono font-bold text-[#0F172A] truncate block">
                    {upiId}
                  </span>
                </div>
                <button
                  id="copy-upi-id-btn"
                  type="button"
                  onClick={handleCopyUpi}
                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-[#F1F5F9] text-[#0F172A] font-semibold rounded-lg border border-[#E2E8F0] text-xs transition-colors shrink-0 cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                      <span className="text-[#16A34A]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  id="simulate-payment-success-btn"
                  type="button"
                  onClick={() => setIsPaymentSimulated(true)}
                  className="w-full bg-[#0F766E] hover:bg-[#14B8A6] text-white font-bold py-3 px-4 rounded-xl text-sm shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I&apos;ve Paid</span>
                </button>
                <p className="text-center text-[10px] text-[#64748B]">
                  Demo screen — no real payment is sent.
                </p>

                <div className="flex gap-2">
                  {onViewHistory && (
                    <button
                      id="view-history-shortcut-btn"
                      type="button"
                      onClick={() => {
                        onClose();
                        onViewHistory();
                      }}
                      className="flex-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] font-semibold py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      View My Orders
                    </button>
                  )}
                  <button
                    id="dismiss-upi-modal-btn"
                    type="button"
                    onClick={onClose}
                    className="flex-1 bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] font-semibold py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
