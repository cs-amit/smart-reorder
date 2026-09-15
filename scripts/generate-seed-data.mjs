#!/usr/bin/env node
/**
 * Regenerates the Smart Reorder demo seed data from one parameterized plan,
 * anchored to a target "as of" date, and writes it to all three places that
 * need to stay in sync:
 *   - app/src/data/seedData.json   (what the app actually loads)
 *   - smart_reorder_seed_data.json (repo-root reference copy)
 *   - smart_reorder_seed_orders.csv (repo-root reference copy)
 *
 * Usage:
 *   node scripts/generate-seed-data.mjs 2026-09-17
 *
 * If the demo date drifts before a presentation, rerun this with a new date
 * instead of hand-editing JSON — "due today" will line up naturally again.
 *
 * Design notes (why the plan looks the way it does):
 *   - Outlet/product catalog and route assignments are unchanged from the
 *     original seed — only how much each outlet orders was widened.
 *   - Two outlets are deliberately left minimal, per CLAUDE.md's own seed
 *     spec: Sai Traders (O4) keeps exactly one order (demonstrates the
 *     "Cold, 0-1 orders" tier falling back to the route's median interval —
 *     verified live that route_fallback_used comes back true for it), and
 *     City Mart (O8) keeps zero orders (demonstrates the empty-history /
 *     "nothing due yet" retailer state). Don't add orders to either.
 *   - Every other outlet now carries 3-4 of the 5 products instead of 1-2,
 *     so the dashboard's "Today's Reorders" list has real breadth instead
 *     of ~10 pairs total across 8 outlets.
 *   - Confidence tiers are engineered deliberately, not random: outlets
 *     tagged "confident" get 6+ orders per pair with tight gap variance
 *     (stdDev well under the engine's 30%-of-median threshold); "learning"
 *     outlets get 3 orders per pair with wide variance, which alone forces
 *     the Learning tier regardless of spread (engine rule: 2-4 orders =
 *     Learning). daysSinceLast is hand-picked per pair to spread outcomes
 *     across overdue / due today / due soon / upcoming when computed
 *     against AS_OF_DATE, so the live demo dashboard shows a realistic mix
 *     rather than everything landing in one bucket.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const APP_ROOT = path.resolve(__dirname, '..');

const AS_OF_DATE = process.argv[2] || '2026-09-17';
if (!/^\d{4}-\d{2}-\d{2}$/.test(AS_OF_DATE)) {
  console.error(`Invalid date "${AS_OF_DATE}" — expected YYYY-MM-DD.`);
  process.exit(1);
}

const distributor = {
  id: 'D1',
  name: 'Anand Distributors, Ward Road',
  upi_id: 'ananddistributors@icici',
  phone: '+91 98201 45892',
  location: 'Ward Road, Commercial Complex, Shop #14',
};

const products = [
  { id: 'P1', name: 'Parle-G Biscuits (family pack)', unit: 'case', wholesale_price: 480, mrp: 600, items_per_case: 24, category: 'Biscuits & Confectionery' },
  { id: 'P2', name: 'Surf Excel Detergent 1kg', unit: 'case', wholesale_price: 1450, mrp: 1720, items_per_case: 12, category: 'Home & Laundry Care' },
  { id: 'P3', name: 'Maggi Noodles (12-pack)', unit: 'case', wholesale_price: 840, mrp: 1020, items_per_case: 16, category: 'Packaged Foods' },
  { id: 'P4', name: 'Dove Soap (bar, 6-pack)', unit: 'case', wholesale_price: 1120, mrp: 1380, items_per_case: 12, category: 'Personal Hygiene' },
  { id: 'P5', name: 'Colgate Toothpaste 200g', unit: 'case', wholesale_price: 760, mrp: 920, items_per_case: 20, category: 'Oral Care' },
];

const outlets = [
  { id: 'O1', name: 'Ramesh General Store', route: 'Ward Road', owner: 'Ramesh Gupta', phone: '+91 98220 11244' },
  { id: 'O2', name: 'Krishna Kirana', route: 'Ward Road', owner: 'Krishna Murthy', phone: '+91 98450 33819' },
  { id: 'O3', name: 'New Bombay Stores', route: 'Ward Road', owner: 'Farhan Ansari', phone: '+91 98902 44710' },
  { id: 'O4', name: 'Sai Traders', route: 'Ward Road', owner: 'Sanjay Patel', phone: '+91 98113 88201' },
  { id: 'O5', name: 'Anand Provision Store', route: 'Station Road', owner: 'Anand Verma', phone: '+91 98721 99042' },
  { id: 'O6', name: 'Lucky General Stores', route: 'Station Road', owner: 'Lakhwinder Singh', phone: '+91 98334 77150' },
  { id: 'O7', name: 'Ganesh Kirana', route: 'Station Road', owner: 'Ganesh Hegde', phone: '+91 98661 55302' },
  { id: 'O8', name: 'City Mart', route: 'Station Road', owner: 'Deepak Shah', phone: '+91 98440 22690' },
];

// Deterministic PRNG (mulberry32) so regeneration is reproducible — same
// AS_OF_DATE always produces the same orders, no surprise reshuffling.
function mulberry32(seed) {
  return function rand() {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260917);

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function jitter(base, spread) {
  if (spread <= 0) return base;
  return Math.round(base + (rand() * 2 - 1) * spread);
}

// [outletId, productId, interval, gapVariance, qtyBase, qtySpread, daysSinceLast, orderCount]
const plan = [
  // Ward Road — Confident
  ['O1', 'P1', 8, 1, 10, 1, 9, 13],
  ['O1', 'P2', 14, 2, 6, 1, 14, 8],
  ['O1', 'P3', 9, 1, 10, 1, 3, 12],
  ['O1', 'P4', 20, 2, 4, 1, 8, 6],
  ['O2', 'P1', 8, 1, 8, 1, 6, 10],
  ['O2', 'P3', 9, 1, 8, 1, 10, 11],
  ['O2', 'P5', 16, 2, 4, 1, 5, 6],
  // Ward Road — Learning (wide variance, few orders)
  ['O3', 'P2', 14, 5, 6, 2, 16, 3],
  ['O3', 'P5', 17, 4, 4, 1, 6, 3],
  // Ward Road — Cold (unchanged from spec: exactly one order)
  ['O4', 'P1', 8, 0, 8, 0, 11, 1],
  // Station Road — Confident
  ['O5', 'P1', 8, 1, 9, 1, 5, 9],
  ['O5', 'P2', 14, 2, 7, 1, 15, 9],
  ['O5', 'P4', 20, 2, 5, 1, 19, 6],
  ['O6', 'P3', 9, 1, 11, 1, 2, 12],
  ['O6', 'P5', 16, 2, 3, 1, 17, 6],
  ['O6', 'P1', 8, 1, 9, 1, 7, 8],
  // Station Road — Learning
  ['O7', 'P4', 22, 5, 3, 1, 24, 3],
  ['O7', 'P2', 14, 4, 5, 1, 8, 3],
  // O8 (City Mart) — zero orders, unchanged: demonstrates the empty-history
  // "nothing due yet" retailer state.
];

const orders = [];
for (const [outletId, productId, interval, gapVar, qtyBase, qtySpread, daysSinceLast, orderCount] of plan) {
  let date = addDays(AS_OF_DATE, -daysSinceLast);
  const dates = [date];
  for (let i = 1; i < orderCount; i++) {
    const gap = Math.max(3, jitter(interval, gapVar));
    date = addDays(date, -gap);
    dates.push(date);
  }
  dates.reverse();
  for (const d of dates) {
    const qty = Math.max(1, jitter(qtyBase, qtySpread));
    orders.push({ outlet_id: outletId, product_id: productId, date: d, quantity: qty });
  }
}
orders.sort((a, b) => a.date.localeCompare(b.date) || a.outlet_id.localeCompare(b.outlet_id));
orders.forEach((o, i) => { o.id = `ORD${i + 1}`; });

const seed = {
  as_of_date: AS_OF_DATE,
  note: "Order dates are anchored to as_of_date. Regenerate via scripts/generate-seed-data.mjs closer to your actual demo date so 'due today' predictions line up naturally.",
  distributor,
  products,
  outlets,
  orders,
};

// 1. app/src/data/seedData.json — what the app actually loads
writeFileSync(
  path.join(APP_ROOT, 'src/data/seedData.json'),
  JSON.stringify(seed, null, 2) + '\n'
);

// 2. repo-root reference copy (same shape)
writeFileSync(
  path.join(REPO_ROOT, 'smart_reorder_seed_data.json'),
  JSON.stringify(seed, null, 2) + '\n'
);

// 3. repo-root reference CSV
const outletMap = new Map(outlets.map(o => [o.id, o]));
const productMap = new Map(products.map(p => [p.id, p]));
const csvRows = ['order_id,outlet_id,outlet_name,route,product_id,product_name,date,quantity'];
for (const o of orders) {
  const outlet = outletMap.get(o.outlet_id);
  const product = productMap.get(o.product_id);
  csvRows.push(
    [o.id, o.outlet_id, `"${outlet.name}"`, `"${outlet.route}"`, o.product_id, `"${product.name}"`, o.date, o.quantity].join(',')
  );
}
writeFileSync(path.join(REPO_ROOT, 'smart_reorder_seed_orders.csv'), csvRows.join('\n') + '\n');

console.log(`Generated ${orders.length} orders anchored to as_of_date ${AS_OF_DATE}.`);
console.log('Wrote: app/src/data/seedData.json, smart_reorder_seed_data.json, smart_reorder_seed_orders.csv');
