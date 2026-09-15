import { describe, it, expect } from 'vitest';
import {
  calculateMedian,
  calculateStdDev,
  calculateConfidence,
  dayDifference,
  addDays,
  computePredictions,
} from './prediction.js';
import { Order, Outlet, Product } from '../src/types.js';

describe('calculateMedian', () => {
  it('returns the middle value for an odd-length array', () => {
    expect(calculateMedian([5, 1, 3])).toBe(3);
  });

  it('averages the two middle values for an even-length array, rounded', () => {
    expect(calculateMedian([8, 9])).toBe(9); // (8+9)/2 = 8.5 -> rounds to 9
    expect(calculateMedian([8, 10])).toBe(9);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateMedian([])).toBe(0);
  });

  it('does not mutate the input array', () => {
    const input = [3, 1, 2];
    calculateMedian(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('calculateStdDev', () => {
  it('returns 0 for a single value or empty array', () => {
    expect(calculateStdDev([5])).toBe(0);
    expect(calculateStdDev([])).toBe(0);
  });

  it('returns 0 for identical values (no spread)', () => {
    expect(calculateStdDev([8, 8, 8, 8])).toBe(0);
  });

  it('computes population standard deviation correctly', () => {
    // mean = 5, variance = ((3)^2+(1)^2+(1)^2+(3)^2)/4 = 5, stdDev = sqrt(5)
    expect(calculateStdDev([2, 4, 6, 8])).toBeCloseTo(Math.sqrt(5), 5);
  });
});

describe('dayDifference / addDays', () => {
  it('computes whole-day differences between ISO dates', () => {
    expect(dayDifference('2026-09-01', '2026-09-10')).toBe(9);
    expect(dayDifference('2026-09-10', '2026-09-01')).toBe(-9);
    expect(dayDifference('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('adds/subtracts whole days, including across month boundaries', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
    expect(addDays('2026-09-05', -10)).toBe('2026-08-26');
  });

  it('round-trips with dayDifference', () => {
    const start = '2026-09-05';
    const shifted = addDays(start, 17);
    expect(dayDifference(start, shifted)).toBe(17);
  });
});

describe('calculateConfidence', () => {
  it('is cold with 0 or 1 orders regardless of gaps', () => {
    expect(calculateConfidence(0, [], 10)).toBe('cold');
    expect(calculateConfidence(1, [], 10)).toBe('cold');
  });

  it('is learning with 2-4 orders even when gaps are perfectly tight', () => {
    expect(calculateConfidence(3, [8, 8], 8)).toBe('learning');
    expect(calculateConfidence(4, [8, 8, 8], 8)).toBe('learning');
  });

  it('is confident with 5+ orders and gap stdDev under 30% of the median', () => {
    // gaps tightly clustered around 8 -> low stdDev relative to interval
    expect(calculateConfidence(6, [8, 9, 8, 9, 8], 8)).toBe('confident');
  });

  it('is learning with 5+ orders but wide gap spread (stdDev over 30% of median)', () => {
    // gaps swing 4..20 around an interval of 12 -> wide relative spread
    expect(calculateConfidence(6, [4, 20, 5, 19, 6], 12)).toBe('learning');
  });
});

describe('computePredictions', () => {
  const outlets: Outlet[] = [
    { id: 'O1', name: 'Ramesh General Store', route: 'Ward Road' },
    { id: 'O2', name: 'Krishna Kirana', route: 'Ward Road' },
    { id: 'O3', name: 'Sai Traders', route: 'Ward Road' },
  ];
  const products: Product[] = [
    { id: 'P1', name: 'Parle-G', unit: 'case', wholesale_price: 480, mrp: 600, items_per_case: 24, category: 'Biscuits' },
  ];

  function mkOrder(id: string, outletId: string, date: string, quantity = 10): Order {
    return { id, outlet_id: outletId, product_id: 'P1', date, quantity };
  }

  it('predicts the next date as last order date + median of recent gaps', () => {
    // O1/P1: orders 8 days apart, last on 2026-09-01 -> next predicted 2026-09-09
    const orders: Order[] = [
      mkOrder('a', 'O1', '2026-08-16'),
      mkOrder('b', 'O1', '2026-08-24'),
      mkOrder('c', 'O1', '2026-09-01'),
    ];
    const [pred] = computePredictions('2026-09-05', outlets, products, orders);
    expect(pred.predicted_interval).toBe(8);
    expect(pred.predicted_next_date).toBe('2026-09-09');
  });

  it('classifies overdue / due today / due soon / upcoming correctly', () => {
    const baseOrders: Order[] = [
      mkOrder('a', 'O1', '2026-08-01'),
      mkOrder('b', 'O1', '2026-08-11'), // 10-day gap
    ];

    // asOfDate exactly on predicted_next_date (2026-08-21) -> due today
    const dueToday = computePredictions('2026-08-21', outlets, products, baseOrders)[0];
    expect(dueToday.status).toBe('due_today');
    expect(dueToday.is_due).toBe(true);

    // asOfDate a day past -> overdue by 1
    const overdue = computePredictions('2026-08-22', outlets, products, baseOrders)[0];
    expect(overdue.status).toBe('overdue');
    expect(overdue.status_label).toBe('Overdue by 1 day');
    expect(overdue.is_due).toBe(true);

    // asOfDate well before -> upcoming, not due
    const upcoming = computePredictions('2026-08-12', outlets, products, baseOrders)[0];
    expect(upcoming.status).toBe('upcoming');
    expect(upcoming.is_due).toBe(false);
  });

  it('falls back to the route median interval for a cold (single-order) pair', () => {
    // O1 and O2 (both Ward Road) have an established ~8-day P1 rhythm.
    // O3 (also Ward Road) has exactly one P1 order -> should borrow ~8, not
    // some arbitrary default, and should be flagged as a route fallback.
    const orders: Order[] = [
      mkOrder('a', 'O1', '2026-08-08'), mkOrder('b', 'O1', '2026-08-16'), mkOrder('c', 'O1', '2026-08-24'),
      mkOrder('d', 'O2', '2026-08-09'), mkOrder('e', 'O2', '2026-08-17'), mkOrder('f', 'O2', '2026-08-25'),
      mkOrder('g', 'O3', '2026-08-20'),
    ];
    const predictions = computePredictions('2026-09-01', outlets, products, orders);
    const cold = predictions.find(p => p.outlet_id === 'O3')!;

    expect(cold.confidence).toBe('cold');
    expect(cold.route_fallback_used).toBe(true);
    expect(cold.predicted_interval).toBe(8);
  });

  it('never produces a prediction for an outlet-product pair with zero orders', () => {
    const orders: Order[] = [mkOrder('a', 'O1', '2026-08-08')];
    const predictions = computePredictions('2026-09-01', outlets, products, orders);
    expect(predictions.some(p => p.outlet_id === 'O2')).toBe(false);
    expect(predictions.some(p => p.outlet_id === 'O3')).toBe(false);
  });

  it('ranks results soonest predicted_next_date first', () => {
    const orders: Order[] = [
      // O1: last order 2026-08-20, ~8-day gap -> next ~2026-08-28
      mkOrder('a', 'O1', '2026-08-04'), mkOrder('b', 'O1', '2026-08-12'), mkOrder('c', 'O1', '2026-08-20'),
      // O2: last order 2026-08-30, ~5-day gap -> next ~2026-09-04 (later)
      mkOrder('d', 'O2', '2026-08-20'), mkOrder('e', 'O2', '2026-08-25'), mkOrder('f', 'O2', '2026-08-30'),
    ];
    const predictions = computePredictions('2026-09-01', outlets, products, orders);
    expect(predictions[0].outlet_id).toBe('O1');
    expect(predictions[1].outlet_id).toBe('O2');
    expect(predictions[0].predicted_next_date.localeCompare(predictions[1].predicted_next_date)).toBeLessThan(0);
  });
});
