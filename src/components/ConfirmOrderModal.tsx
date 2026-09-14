import React, { useState } from 'react';
import { PredictionResult, Outlet, Product } from '../types';
import {
  Package,
  CheckCircle2,
  Calendar,
  AlertCircle,
  X,
  Store,
  Truck,
} from 'lucide-react';
import { BUTTON_STYLES } from '../lib/theme';

interface ConfirmOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: PredictionResult | null;
  outlet?: Outlet | null;
  product?: Product | null;
  asOfDate: string;
  onOrderConfirmed: (orderData: {
    outlet_id: string;
    product_id: string;
    quantity: number;
    date: string;
    source: 'distributor';
  }) => Promise<void>;
}

export const ConfirmOrderModal: React.FC<ConfirmOrderModalProps> = ({
  isOpen,
  onClose,
  prediction,
  outlet,
  product,
  asOfDate,
  onOrderConfirmed,
}) => {
  if (!isOpen || !prediction) return null;

  const initialQty =
    prediction.recent_average_quantity > 0
      ? Math.round(prediction.recent_average_quantity)
      : 10;

  const [quantity, setQuantity] = useState<number>(initialQty);
  const [orderDate, setOrderDate] = useState<string>(asOfDate);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wholesalePrice = prediction.wholesale_price || product?.wholesale_price || 0;
  const totalAmount = quantity * wholesalePrice;
  const unit = prediction.product_unit || product?.unit || 'case';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      setErrorMessage('Quantity must be greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const safetyTimer = setTimeout(() => {
        setIsSubmitting(false);
        setErrorMessage('This is taking longer than expected. Please try again.');
      }, 5000);

      await onOrderConfirmed({
        outlet_id: prediction.outlet_id,
        product_id: prediction.product_id,
        quantity,
        date: orderDate,
        source: 'distributor',
      });
      clearTimeout(safetyTimer);
      onClose();
    } catch (err: any) {
      console.error('Failed to confirm order:', err);
      setErrorMessage(err.message || 'Could not place the order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="confirm-order-modal"
        className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4] flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#0F766E]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Confirm This Order</h3>
              <p className="text-xs text-[#64748B]">Placed by you on behalf of the outlet</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Outlet & Product Summary */}
          <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-[#64748B]" />
                <span className="font-bold text-[#0F172A] text-sm">{prediction.outlet_name}</span>
              </div>
              <span className="text-[11px] font-medium text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                Route: {prediction.route}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-[#0F766E]" />
                <span className="font-semibold text-[#0F172A]">{prediction.product_name}</span>
              </div>
              <span className="font-mono text-xs text-[#0F172A]">
                ₹{wholesalePrice}/{unit}
              </span>
            </div>

            <div className="text-[11px] text-[#64748B] pt-1">
              <span className="font-medium text-[#0F172A]">Why now:</span>{' '}
              {prediction.reasoning}
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="order-quantity-input" className="font-bold text-[#0F172A]">
                Quantity ({unit}s)
              </label>
              {prediction.recent_average_quantity > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(Math.round(prediction.recent_average_quantity))}
                  className="text-[11px] text-[#0F766E] hover:text-[#14B8A6] font-medium underline cursor-pointer"
                >
                  Use usual amount ({Math.round(prediction.recent_average_quantity)})
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="px-3 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] font-bold rounded-lg border border-[#E2E8F0] cursor-pointer"
              >
                -
              </button>
              <input
                id="order-quantity-input"
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 py-2 px-3 text-center font-bold text-base bg-white border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#0F766E] focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="px-3 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] font-bold rounded-lg border border-[#E2E8F0] cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Order Date */}
          <div className="space-y-1.5">
            <label htmlFor="order-date-input" className="font-bold text-[#0F172A] flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Order Date</span>
            </label>
            <input
              id="order-date-input"
              type="date"
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:ring-2 focus:ring-[#0F766E] focus:outline-hidden text-xs sm:text-sm font-medium"
            />
          </div>

          {/* Price Calculation Summary */}
          <div className="p-3 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-[#64748B] block">Order Value</span>
              <span className="text-[11px] text-[#64748B] font-mono">
                {quantity} {unit}s × ₹{wholesalePrice}
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-extrabold text-[#0F766E]">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-[#64748B]">
            * Confirming will record this order and immediately update this outlet&apos;s next reorder prediction.
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-confirm-order-btn"
              type="submit"
              disabled={isSubmitting}
              className={`${BUTTON_STYLES.primary} text-xs py-2 px-5`}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>{isSubmitting ? 'Placing order...' : 'Confirm & Place Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
