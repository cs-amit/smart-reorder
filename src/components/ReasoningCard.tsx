import React from 'react';
import { PredictionResult } from '../types';
import { CheckCircle2, AlertTriangle, HelpCircle, Activity, ArrowRight } from 'lucide-react';

interface ReasoningCardProps {
  prediction: PredictionResult;
  onQuickOrder?: () => void;
}

export const ReasoningCard: React.FC<ReasoningCardProps> = ({ prediction, onQuickOrder }) => {
  const {
    confidence,
    reasoning,
    recent_gaps,
    predicted_interval,
    days_since_last_order,
    order_count,
    route,
    route_fallback_used,
    product_unit,
    recent_average_quantity,
  } = prediction;

  const getBadgeStyle = () => {
    const normalized = String(confidence).toLowerCase();
    switch (normalized) {
      case 'confident':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-600',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-1" />,
          title: 'High Confidence',
          desc: '5+ historical orders with low interval spread',
        };
      case 'learning':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          icon: <Activity className="w-4 h-4 text-amber-600 inline mr-1" />,
          title: 'Learning Cadence',
          desc: '2 to 4 orders or higher variability between deliveries',
        };
      case 'cold':
      default:
        return {
          bg: 'bg-sky-50 text-sky-800 border-sky-200',
          dot: 'bg-sky-500',
          icon: <HelpCircle className="w-4 h-4 text-sky-600 inline mr-1" />,
          title: 'Cold / New Outlet',
          desc: `Fewer than 2 orders; fallback estimate derived from ${route} route median`,
        };
    }
  };

  const badge = getBadgeStyle();

  return (
    <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 sm:p-5 my-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-stone-200 pb-3 mb-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-stone-500 block mb-1">
            Prediction Reasoning
          </span>
          {/* Exact one-sentence reasoning required by user */}
          <p className="text-base font-semibold text-stone-900 leading-snug">
            &ldquo;{reasoning}&rdquo;
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center ${badge.bg}`}>
            {badge.icon}
            <span>{confidence} Tier</span>
          </div>
          {onQuickOrder && (
            <button
              id={`quick-order-${prediction.outlet_id}-${prediction.product_id}`}
              type="button"
              onClick={onQuickOrder}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <span>Draft Order</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Analytical Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-white p-3 rounded-lg border border-stone-200">
          <span className="text-stone-500 block font-medium">Reorder Rhythm</span>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-lg font-bold text-stone-900">{predicted_interval}</span>
            <span className="text-stone-600 font-medium">days median</span>
          </div>
          <p className="text-stone-500 mt-1 text-[11px]">
            {route_fallback_used
              ? `Route fallback estimate (${route})`
              : `Median of last ${recent_gaps.length} delivery intervals`}
          </p>
        </div>

        <div className="bg-white p-3 rounded-lg border border-stone-200">
          <span className="text-stone-500 block font-medium">Elapsed Since Last Order</span>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className={`text-lg font-bold ${days_since_last_order >= predicted_interval ? 'text-amber-700' : 'text-stone-900'}`}>
              {days_since_last_order}
            </span>
            <span className="text-stone-600 font-medium">days elapsed</span>
          </div>
          <p className="text-stone-500 mt-1 text-[11px]">
            {days_since_last_order >= predicted_interval
              ? `Reorder window reached (${days_since_last_order - predicted_interval}d past median)`
              : `${predicted_interval - days_since_last_order} days remaining in cycle`}
          </p>
        </div>

        <div className="bg-white p-3 rounded-lg border border-stone-200">
          <span className="text-stone-500 block font-medium">Recent Delivery Gaps</span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {recent_gaps.length > 0 ? (
              recent_gaps.map((gap, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 rounded font-mono font-medium text-[11px] ${
                    gap === predicted_interval
                      ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                      : 'bg-stone-100 text-stone-700 border border-stone-200'
                  }`}
                  title={`Interval: ${gap} days`}
                >
                  {gap}d
                </span>
              ))
            ) : (
              <span className="text-stone-400 italic">No previous gaps recorded</span>
            )}
          </div>
          <p className="text-stone-500 mt-1 text-[11px]">
            Avg draft quantity: <strong className="text-stone-800 font-semibold">{recent_average_quantity} {product_unit}s</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
