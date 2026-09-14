import { ConfidenceTier, Order, Outlet, PredictionResult, Product } from '../src/types';

/**
 * Calculates the median of an array of numbers.
 * For odd length: middle element.
 * For even length: average of the two middle elements (rounded to nearest integer).
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

/**
 * Calculates standard deviation of an array of numbers.
 */
export function calculateStdDev(values: number[]): number {
  if (!values || values.length <= 1) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculates difference in whole days between two ISO date strings (date2 - date1)
 */
export function dayDifference(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str + 'T00:00:00Z');
  const d2 = new Date(date2Str + 'T00:00:00Z');
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Adds whole days to an ISO date string (YYYY-MM-DD)
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Determines confidence tier according to specification:
 * - "confident": if there are 5+ orders and the gaps have low spread (standard deviation under roughly 30% of the median gap)
 * - "learning": if there are 2-4 orders or the spread is wide (standard deviation > 30% of median gap)
 * - "cold": if there are 0-1 orders
 */
export function calculateConfidence(
  orderCount: number,
  recentGaps: number[],
  predictedInterval: number
): 'confident' | 'learning' | 'cold' {
  if (orderCount <= 1 || recentGaps.length === 0) {
    return 'cold';
  }

  if (orderCount >= 5) {
    const stdDev = calculateStdDev(recentGaps);
    // Standard deviation under roughly 30% of the median gap
    if (stdDev <= 0.3 * predictedInterval) {
      return 'confident';
    }
    return 'learning';
  }

  // 2 to 4 orders
  return 'learning';
}

/**
 * Computes server-side predictions for all outlet-product pairs with at least one order.
 */
export function computePredictions(
  asOfDate: string,
  outlets: Outlet[],
  products: Product[],
  orders: Order[]
): PredictionResult[] {
  const productMap = new Map(products.map(p => [p.id, p]));
  const outletMap = new Map(outlets.map(o => [o.id, o]));

  // 1. Group orders by outlet_id and product_id
  const pairOrdersMap = new Map<string, Order[]>();
  for (const ord of orders) {
    const key = `${ord.outlet_id}::${ord.product_id}`;
    if (!pairOrdersMap.has(key)) {
      pairOrdersMap.set(key, []);
    }
    pairOrdersMap.get(key)!.push(ord);
  }

  // 2. Pre-calculate route and catalog median intervals across pairs with >= 2 orders
  // Used as fallback for "cold" pairs (0-1 orders)
  const routeProductIntervals = new Map<string, number[]>();
  const productAllIntervals = new Map<string, number[]>();

  for (const [key, ords] of pairOrdersMap.entries()) {
    if (ords.length < 2) continue;
    const [outletId, productId] = key.split('::');
    const outlet = outletMap.get(outletId);
    if (!outlet) continue;

    const sorted = [...ords].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = dayDifference(sorted[i - 1].date, sorted[i].date);
      if (diff > 0) gaps.push(diff);
    }
    if (gaps.length === 0) continue;

    const recentGaps = gaps.slice(-5);
    const med = Math.max(1, calculateMedian(recentGaps));

    const routeKey = `${outlet.route}::${productId}`;
    if (!routeProductIntervals.has(routeKey)) {
      routeProductIntervals.set(routeKey, []);
    }
    routeProductIntervals.get(routeKey)!.push(med);

    if (!productAllIntervals.has(productId)) {
      productAllIntervals.set(productId, []);
    }
    productAllIntervals.get(productId)!.push(med);
  }

  // 3. For EVERY outlet-product pair with at least one order, compute prediction
  const results: PredictionResult[] = [];

  for (const [key, ords] of pairOrdersMap.entries()) {
    if (!ords || ords.length === 0) continue;

    const [outletId, productId] = key.split('::');
    const outlet = outletMap.get(outletId);
    const product = productMap.get(productId);

    if (!outlet || !product) continue;

    // Chronological order sorting
    const sortedOrders = [...ords].sort((a, b) => a.date.localeCompare(b.date));
    const orderCount = sortedOrders.length;
    const lastOrder = sortedOrders[sortedOrders.length - 1];
    const lastOrderDate = lastOrder.date;
    const daysSinceLastOrder = Math.max(0, dayDifference(lastOrderDate, asOfDate));

    // Compute gaps in days between consecutive order dates for that pair
    const gaps: number[] = [];
    for (let i = 1; i < sortedOrders.length; i++) {
      const gap = dayDifference(sortedOrders[i - 1].date, sortedOrders[i].date);
      gaps.push(Math.max(1, gap));
    }

    // predicted_interval: the median of the most recent 5 gaps (or all gaps if fewer than 5)
    const recentGaps = gaps.slice(-5);
    let predictedInterval = recentGaps.length > 0 ? Math.max(1, calculateMedian(recentGaps)) : 0;

    // Confidence calculation
    let confidence: 'confident' | 'learning' | 'cold' = 'cold';
    let routeFallbackUsed = false;

    if (orderCount <= 1) {
      // 0-1 orders = cold
      confidence = 'cold';
      routeFallbackUsed = true;

      // For "cold" pairs, fall back to the median predicted_interval of the same product
      // across other outlets on the same route, if any exist.
      const routeKey = `${outlet.route}::${productId}`;
      const routeIntervals = routeProductIntervals.get(routeKey);

      if (routeIntervals && routeIntervals.length > 0) {
        predictedInterval = Math.max(1, calculateMedian(routeIntervals));
      } else {
        const allProductIntervals = productAllIntervals.get(productId);
        if (allProductIntervals && allProductIntervals.length > 0) {
          predictedInterval = Math.max(1, calculateMedian(allProductIntervals));
        } else {
          predictedInterval = 10; // FMCG typical fallback
        }
      }
    } else {
      confidence = calculateConfidence(orderCount, recentGaps, predictedInterval);
    }

    // predicted_next_date: date of the last order plus predicted_interval
    const predictedNextDate = addDays(lastOrderDate, predictedInterval);
    const daysUntilDue = dayDifference(asOfDate, predictedNextDate);

    // reasoning: a one-line string like "Usually reorders every 9 days, it's been 12" using the actual numbers
    const reasoning = `Usually reorders every ${predictedInterval} days, it's been ${daysSinceLastOrder}.`;

    // Status evaluation
    let status: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' = 'upcoming';
    let statusLabel = '';
    let isDue = false;

    if (daysUntilDue < 0) {
      status = 'overdue';
      const overdueDays = Math.abs(daysUntilDue);
      statusLabel = `Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`;
      isDue = true;
    } else if (daysUntilDue === 0) {
      status = 'due_today';
      statusLabel = 'Due today';
      isDue = true;
    } else if (daysUntilDue === 1) {
      status = 'due_soon';
      statusLabel = 'Due tomorrow';
      isDue = false;
    } else if (daysUntilDue <= 3) {
      status = 'due_soon';
      statusLabel = `In ${daysUntilDue} days`;
      isDue = false;
    } else {
      status = 'upcoming';
      statusLabel = `In ${daysUntilDue} days`;
      isDue = false;
    }

    // Build order history with gaps for row expansion
    const orderHistory = sortedOrders.map((ord, idx) => {
      const prev = idx > 0 ? sortedOrders[idx - 1] : null;
      const gapDays = prev ? dayDifference(prev.date, ord.date) : null;
      const daysAgo = Math.max(0, dayDifference(ord.date, asOfDate));
      return {
        id: ord.id,
        date: ord.date,
        quantity: ord.quantity,
        gap_days: gapDays,
        days_ago: daysAgo,
      };
    }).reverse();

    // Average quantity across recent orders
    const recentOrders = sortedOrders.slice(-5);
    const avgQuantity = Math.round(
      recentOrders.reduce((sum, o) => sum + o.quantity, 0) / recentOrders.length
    );

    results.push({
      outlet_id: outlet.id,
      outlet_name: outlet.name,
      route: outlet.route,
      product_id: product.id,
      product_name: product.name,
      product_unit: product.unit,
      wholesale_price: product.wholesale_price || 500,
      mrp: product.mrp || 650,
      items_per_case: product.items_per_case || 12,
      last_order_date: lastOrderDate,
      days_since_last_order: daysSinceLastOrder,
      predicted_interval: predictedInterval,
      predicted_next_date: predictedNextDate,
      predicted_next_reorder_date: predictedNextDate,
      confidence,
      reasoning,
      status,
      status_label: statusLabel,
      is_due: isDue,
      gaps,
      recent_gaps: recentGaps,
      order_count: orderCount,
      recent_average_quantity: avgQuantity,
      order_history: orderHistory,
      route_fallback_used: routeFallbackUsed,
    });
  }

  // Rank by predicted next-reorder date (soonest first)
  results.sort((a, b) => {
    const dateComp = a.predicted_next_date.localeCompare(b.predicted_next_date);
    if (dateComp !== 0) return dateComp;
    return b.days_since_last_order - a.days_since_last_order;
  });

  return results;
}

/**
 * Storage collection for predictions, keyed by outlet_id and product_id.
 * Allows instant lookup, filtering, and live recomputation whenever a new order is added.
 */
export class PredictionsCollection {
  private collection = new Map<string, PredictionResult>();

  getKey(outletId: string, productId: string): string {
    return `${outletId}_${productId}`;
  }

  get(outletId: string, productId: string): PredictionResult | undefined {
    return this.collection.get(this.getKey(outletId, productId));
  }

  getByKey(key: string): PredictionResult | undefined {
    return this.collection.get(key);
  }

  getAll(): PredictionResult[] {
    return Array.from(this.collection.values()).sort((a, b) => {
      const dateComp = a.predicted_next_date.localeCompare(b.predicted_next_date);
      if (dateComp !== 0) return dateComp;
      return b.days_since_last_order - a.days_since_last_order;
    });
  }

  set(prediction: PredictionResult): void {
    this.collection.set(this.getKey(prediction.outlet_id, prediction.product_id), prediction);
  }

  clear(): void {
    this.collection.clear();
  }

  /**
   * Recomputes all predictions from current dataset and stores them in the collection keyed by outlet_id and product_id.
   */
  syncAll(
    asOfDate: string,
    outlets: Outlet[],
    products: Product[],
    orders: Order[]
  ): PredictionResult[] {
    const list = computePredictions(asOfDate, outlets, products, orders);
    this.collection.clear();
    for (const pred of list) {
      this.set(pred);
    }
    return list;
  }

  /**
   * Recompute automatically whenever a new order is added for an outlet-product pair.
   */
  recomputeOnNewOrder(
    asOfDate: string,
    outletId: string,
    productId: string,
    outlets: Outlet[],
    products: Product[],
    orders: Order[]
  ): { updatedPrediction: PredictionResult | null; allPredictions: PredictionResult[] } {
    const allPredictions = this.syncAll(asOfDate, outlets, products, orders);
    const updatedPrediction = this.get(outletId, productId) || null;
    return { updatedPrediction, allPredictions };
  }
}

export const predictionsCollection = new PredictionsCollection();
