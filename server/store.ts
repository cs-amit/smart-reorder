import { db, adminAuth, FieldValue } from './firebaseAdmin.js';
import { Distributor, Order, Outlet, Product, Retailer, NudgeRecord, LedgerEntry } from '../src/types.js';
import seedDataRaw from '../src/data/seedData.json' with { type: 'json' };

export const DEMO_DIST_ID = 'usr_dist_demo1';
export const DEMO_RETAILER_ID = 'usr_ret_demo1';

export interface ServerUser {
  uid: string;
  email: string;
  role: 'distributor' | 'retailer';
  name?: string;
  created_at: string;
  is_demo?: boolean;
}

interface SeedDataType {
  as_of_date: string;
  distributor: Distributor;
  products: Product[];
  outlets: Outlet[];
  orders: Order[];
}

const seedData = seedDataRaw as SeedDataType;
export const SEED_AS_OF_DATE = seedData.as_of_date || '2026-09-05';

function cleanPhone(p: string = ''): string {
  const digits = p.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function randomCode(prefix: string, len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Users
// ============================================================================

export async function getUser(uid: string): Promise<ServerUser | null> {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? (snap.data() as ServerUser) : null;
}

export async function getUserByEmail(email: string): Promise<ServerUser | null> {
  const q = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
  if (q.empty) return null;
  return q.docs[0].data() as ServerUser;
}

export async function createUserProfile(user: ServerUser): Promise<void> {
  await db.collection('users').doc(user.uid).set(user);
}

// ============================================================================
// Distributors
// ============================================================================

export async function getDistributor(distributorId: string): Promise<Distributor | null> {
  const snap = await db.collection('distributors').doc(distributorId).get();
  return snap.exists ? (snap.data() as Distributor) : null;
}

export async function saveDistributor(dist: Distributor): Promise<void> {
  await db.collection('distributors').doc(dist.id).set(dist, { merge: true });
}

export async function findDistributorByInviteCode(code: string): Promise<Distributor | null> {
  const normalized = code.trim().toLowerCase();
  const q = await db.collection('distributors').get();
  const match = q.docs.find(d => (d.data().invite_code || '').toLowerCase() === normalized);
  return match ? (match.data() as Distributor) : null;
}

/**
 * Each distributor has their own "as of" date override (a demo/testing
 * convenience for previewing predictions on a different date), stored on
 * their own distributor document. This must never be a single shared value —
 * otherwise any signed-in user shifting "today" would shift it for every
 * other distributor's predictions too.
 */
export async function getAsOfDate(distributorId: string): Promise<string> {
  const dist = await getDistributor(distributorId);
  return dist?.as_of_date_override || SEED_AS_OF_DATE;
}

export async function setAsOfDate(distributorId: string, date: string): Promise<void> {
  await db.collection('distributors').doc(distributorId).set(
    { as_of_date_override: date },
    { merge: true }
  );
}

export async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode('FMCG');
    const existing = await findDistributorByInviteCode(code);
    if (!existing) return code;
  }
  return randomCode('FMCG', 6);
}

// ============================================================================
// Outlets
// ============================================================================

export async function getOutlets(distributorId: string): Promise<Outlet[]> {
  const q = await db.collection('outlets').where('distributor_id', '==', distributorId).get();
  return q.docs.map(d => d.data() as Outlet);
}

export async function saveOutlet(outlet: Outlet): Promise<Outlet> {
  const withId: Outlet = { ...outlet, id: outlet.id || genId('O') };
  await db.collection('outlets').doc(withId.id).set(withId, { merge: true });
  return withId;
}

export async function findOutletByPhone(distributorId: string, phone: string): Promise<Outlet | null> {
  const target = cleanPhone(phone);
  if (!target) return null;
  const outlets = await getOutlets(distributorId);
  return outlets.find(o => cleanPhone(o.phone) === target) || null;
}

export async function getOutletById(outletId: string): Promise<Outlet | null> {
  const snap = await db.collection('outlets').doc(outletId).get();
  return snap.exists ? (snap.data() as Outlet) : null;
}

// ============================================================================
// Products
// ============================================================================

export async function getProducts(distributorId: string): Promise<Product[]> {
  const q = await db.collection('products').where('distributor_id', '==', distributorId).get();
  return q.docs.map(d => d.data() as Product);
}

export async function saveProduct(product: Product): Promise<Product> {
  const withId: Product = { ...product, id: product.id || genId('P') };
  await db.collection('products').doc(withId.id).set(withId, { merge: true });
  return withId;
}

// ============================================================================
// Orders
// ============================================================================

export async function getOrders(distributorId: string): Promise<Order[]> {
  const q = await db.collection('orders').where('distributor_id', '==', distributorId).get();
  return q.docs.map(d => d.data() as Order);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const doc = await db.collection('orders').doc(orderId).get();
  return doc.exists ? (doc.data() as Order) : null;
}

export async function cancelOrder(orderId: string): Promise<void> {
  await db.collection('orders').doc(orderId).set(
    { status: 'cancelled', cancelled_at: new Date().toISOString() },
    { merge: true }
  );
}

// ============================================================================
// Credit ledger — an append-only log of charges (goods supplied on credit,
// one per order placed) and payments (recorded by the distributor when a
// retailer settles up). Outstanding balance is always the sum, computed on
// read rather than cached, so it can never drift out of sync with the log —
// entry counts per outlet are small enough that this is cheap. This is
// deliberately independent of the simulated UPI/WhatsApp-pay screens (which
// represent an on-the-spot payment for one order) — the ledger tracks the
// running "goods supplied vs. cash collected" relationship overall, the way
// a real distributor-retailer credit relationship actually works.
// ============================================================================

export async function addLedgerEntry(entry: Omit<LedgerEntry, 'id' | 'created_at'>): Promise<LedgerEntry> {
  const withId: LedgerEntry = { ...entry, id: genId('LEDGER'), created_at: new Date().toISOString() };
  await db.collection('ledger_entries').doc(withId.id).set(withId);
  return withId;
}

export async function getLedgerEntries(outletId: string): Promise<LedgerEntry[]> {
  const q = await db.collection('ledger_entries').where('outlet_id', '==', outletId).get();
  return q.docs.map(d => d.data() as LedgerEntry).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getOutletBalance(outletId: string): Promise<number> {
  const entries = await getLedgerEntries(outletId);
  return entries.reduce((sum, e) => sum + (e.type === 'charge' ? e.amount : -e.amount), 0);
}

/**
 * Balances for every outlet under a distributor in one query, rather than
 * one Firestore read per outlet — used to show a balance column across the
 * whole outlets list without an N+1 fetch pattern.
 */
export async function getOutletBalancesByDistributor(distributorId: string): Promise<Record<string, number>> {
  const q = await db.collection('ledger_entries').where('distributor_id', '==', distributorId).get();
  const balances: Record<string, number> = {};
  for (const doc of q.docs) {
    const entry = doc.data() as LedgerEntry;
    const delta = entry.type === 'charge' ? entry.amount : -entry.amount;
    balances[entry.outlet_id] = (balances[entry.outlet_id] || 0) + delta;
  }
  return balances;
}

export async function addOrder(order: Order): Promise<Order> {
  const withId: Order = { ...order, id: order.id || genId('ORD') };
  await db.collection('orders').doc(withId.id).set(withId);
  return withId;
}

export async function addOrdersBatch(orders: Order[]): Promise<Order[]> {
  const batch = db.batch();
  const withIds = orders.map(o => ({ ...o, id: o.id || genId('ORD') }));
  for (const ord of withIds) {
    batch.set(db.collection('orders').doc(ord.id), ord);
  }
  await batch.commit();
  return withIds;
}

// ============================================================================
// Retailers
// ============================================================================

export async function getRetailer(uid: string): Promise<Retailer | null> {
  const snap = await db.collection('retailers').doc(uid).get();
  return snap.exists ? (snap.data() as Retailer) : null;
}

export async function saveRetailer(retailer: Retailer): Promise<void> {
  await db.collection('retailers').doc(retailer.uid).set(retailer, { merge: true });
}

export async function unlinkRetailer(uid: string): Promise<void> {
  await db.collection('retailers').doc(uid).set(
    { linked_distributor_id: FieldValue.delete(), outlet_id: FieldValue.delete() },
    { merge: true }
  );
}

export async function findRetailerByPhone(phone: string): Promise<Retailer | null> {
  const target = cleanPhone(phone);
  if (!target) return null;
  const q = await db.collection('retailers').get();
  const match = q.docs.find(d => cleanPhone(d.data().phone) === target);
  return match ? (match.data() as Retailer) : null;
}

// ============================================================================
// Nudges
// ============================================================================

export async function getNudges(distributorId: string): Promise<NudgeRecord[]> {
  const q = await db.collection('nudges').where('distributor_id', '==', distributorId).get();
  return q.docs
    .map(d => d.data() as NudgeRecord)
    .sort((a, b) => (b.sent_at || '').localeCompare(a.sent_at || ''));
}

export async function getNudgeById(nudgeId: string): Promise<NudgeRecord | null> {
  const doc = await db.collection('nudges').doc(nudgeId).get();
  return doc.exists ? (doc.data() as NudgeRecord) : null;
}

export async function saveNudge(nudge: NudgeRecord): Promise<NudgeRecord> {
  const withId: NudgeRecord = { ...nudge, id: nudge.id || genId('NUDGE') };
  await db.collection('nudges').doc(withId.id).set(withId, { merge: true });
  return withId;
}

export async function markNudgeRead(nudgeId: string): Promise<void> {
  await db.collection('nudges').doc(nudgeId).set(
    { read: true, read_at: new Date().toISOString() },
    { merge: true }
  );
}

export async function markNudgesReadForOutlet(distributorId: string, outletId: string): Promise<void> {
  const nudges = await getNudges(distributorId);
  const batch = db.batch();
  const readAt = new Date().toISOString();
  for (const n of nudges) {
    if (n.outlet_id === outletId && !n.read) {
      batch.set(db.collection('nudges').doc(n.id), { read: true, read_at: readAt }, { merge: true });
    }
  }
  await batch.commit();
}

// ============================================================================
// Demo account seed / reset
// ============================================================================

export async function resetDemoAccount(): Promise<void> {
  // Wipe any existing demo-owned outlets/products/orders/nudges (from prior demo runs)
  const collections: Array<{ name: string; field: string }> = [
    { name: 'outlets', field: 'distributor_id' },
    { name: 'products', field: 'distributor_id' },
    { name: 'orders', field: 'distributor_id' },
    { name: 'nudges', field: 'distributor_id' },
    { name: 'ledger_entries', field: 'distributor_id' },
  ];

  for (const { name, field } of collections) {
    const q = await db.collection(name).where(field, '==', DEMO_DIST_ID).get();
    if (q.empty) continue;
    const batch = db.batch();
    q.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  // Re-seed fresh demo data in one batch
  const batch = db.batch();

  const demoDist: Distributor = {
    ...seedData.distributor,
    id: DEMO_DIST_ID,
    distributor_id: DEMO_DIST_ID,
    uid: DEMO_DIST_ID,
    name: 'Anand Distributors (Demo Account)',
    route: seedData.distributor.route || 'Ward Road',
    invite_code: seedData.distributor.invite_code || 'FMCG-8392',
    is_demo: true,
    has_completed_onboarding: true,
  };
  batch.set(db.collection('distributors').doc(DEMO_DIST_ID), demoDist);

  for (const p of seedData.products) {
    batch.set(db.collection('products').doc(p.id), { ...p, distributor_id: DEMO_DIST_ID });
  }
  for (const o of seedData.outlets) {
    batch.set(db.collection('outlets').doc(o.id), { ...o, distributor_id: DEMO_DIST_ID });
  }
  seedData.orders.forEach((ord, idx) => {
    let source: 'distributor' | 'retailer' | 'ocr_import' = 'distributor';
    if (idx % 12 === 0) source = 'ocr_import';
    else if (idx % 5 === 0 || idx % 7 === 0) source = 'retailer';
    batch.set(db.collection('orders').doc(ord.id), { ...ord, distributor_id: DEMO_DIST_ID, source });
  });

  const demoRetailer: Retailer = {
    id: DEMO_RETAILER_ID,
    uid: DEMO_RETAILER_ID,
    name: 'Ramesh General Store',
    phone: '+91 98220 11244',
    linked_distributor_id: DEMO_DIST_ID,
    outlet_id: 'O1',
    joined_at: new Date().toISOString(),
  };
  batch.set(db.collection('retailers').doc(DEMO_RETAILER_ID), demoRetailer, { merge: true });

  await batch.commit();
}

/** Seeds the demo account only if it doesn't exist yet (safe to call on every server start) */
export async function ensureDemoAccountSeeded(): Promise<void> {
  const existing = await getDistributor(DEMO_DIST_ID);
  if (!existing) {
    await resetDemoAccount();
  }
  await ensureDemoAuthUsersExist();
  await ensureDemoUserProfiles();
}

/**
 * The demo distributor/retailer need real Firebase Auth accounts (not just
 * Firestore documents) so the seeded credentials can actually sign in.
 * Creates them once, with fixed uids matching the seeded Firestore docs.
 */
async function ensureDemoAuthUsersExist(): Promise<void> {
  const demoAuthUsers = [
    { uid: DEMO_DIST_ID, email: 'dist@fmcg.com', password: 'password123', displayName: 'Anand Distributors (Demo Account)' },
    { uid: DEMO_RETAILER_ID, email: 'retailer@kirana.com', password: 'password123', displayName: 'Ramesh General Store' },
  ];
  for (const u of demoAuthUsers) {
    try {
      await adminAuth.getUser(u.uid);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        await adminAuth.createUser(u);
      } else {
        throw err;
      }
    }
  }
}

async function ensureDemoUserProfiles(): Promise<void> {
  const distUser = await getUser(DEMO_DIST_ID);
  if (!distUser) {
    await createUserProfile({
      uid: DEMO_DIST_ID,
      email: 'dist@fmcg.com',
      role: 'distributor',
      name: 'Anand Distributors (Demo Account)',
      created_at: new Date().toISOString(),
      is_demo: true,
    });
  }
  const retUser = await getUser(DEMO_RETAILER_ID);
  if (!retUser) {
    await createUserProfile({
      uid: DEMO_RETAILER_ID,
      email: 'retailer@kirana.com',
      role: 'retailer',
      name: 'Ramesh General Store',
      created_at: new Date().toISOString(),
      is_demo: true,
    });
  }
}

// ============================================================================
// Rate limiting — a fixed-window counter per (uid, action), stored in
// Firestore rather than in-memory. An in-memory counter would silently stop
// working on Vercel: each serverless invocation can land in a fresh
// container with no memory of prior requests, so limits would only "work"
// by accident on a warm instance. This is deliberately simple (a single
// document read + conditional write, not a sliding window or a transaction)
// — for a course-scale demo the race-condition risk of two truly concurrent
// requests both slipping through is an acceptable trade for staying free
// and dependency-free.
// ============================================================================

export async function checkRateLimit(
  uid: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const docId = `${action}_${uid}`;
  const ref = db.collection('rate_limits').doc(docId);
  const snap = await ref.get();
  const now = Date.now();

  const data = snap.exists ? (snap.data() as { count: number; windowStart: number }) : null;
  const windowExpired = !data || now - data.windowStart > windowMs;

  if (windowExpired) {
    await ref.set({ count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, resetAt: new Date(now + windowMs).toISOString() };
  }

  if (data.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(data.windowStart + windowMs).toISOString(),
    };
  }

  await ref.set({ count: data.count + 1, windowStart: data.windowStart }, { merge: true });
  return {
    allowed: true,
    remaining: limit - data.count - 1,
    resetAt: new Date(data.windowStart + windowMs).toISOString(),
  };
}
