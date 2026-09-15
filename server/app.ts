import express from 'express';
import { adminAuth, db } from './firebaseAdmin.js';
import * as store from './store.js';
import { computePredictions, dayDifference } from './prediction.js';
import { extractOrdersFromImage } from './geminiVision.js';
import { Order, NudgeRecord } from '../src/types.js';

// ============================================================================
// Auth middleware: verifies the Firebase ID token on every protected request.
// The server NEVER trusts a client-supplied uid — only the verified token.
// ============================================================================

export interface AuthedRequest extends express.Request {
  uid?: string;
  userEmail?: string;
}

async function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ success: false, message: 'Not signed in.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.uid = decoded.uid;
    req.userEmail = decoded.email || '';
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
  }
}

/**
 * Resolves which distributor's data a given verified uid should see:
 * - The uid itself if they're a distributor
 * - Their linked distributor if they're a retailer
 * - The demo distributor if the demo distributor is previewing the demo retailer
 */
async function resolveDistributorId(uid: string, previewUid?: string): Promise<string | null> {
  if (previewUid && previewUid === store.DEMO_RETAILER_ID && uid === store.DEMO_DIST_ID) {
    const demoRetailer = await store.getRetailer(store.DEMO_RETAILER_ID);
    return demoRetailer?.linked_distributor_id || null;
  }
  const dist = await store.getDistributor(uid);
  if (dist) return dist.id;
  const retailer = await store.getRetailer(uid);
  return retailer?.linked_distributor_id || null;
}

function getPreviewUid(req: express.Request): string | undefined {
  const raw = req.query.preview_uid;
  return typeof raw === 'string' ? raw : undefined;
}

// ============================================================================
// As-of-date (demo convenience for shifting "today") — scoped per distributor
// (stored on their own distributor doc), never a single shared value. If it
// were shared, any signed-in user could shift "today" for every OTHER
// distributor's predictions too.
// ============================================================================

async function resolveAsOfDate(distributorId: string | null): Promise<string> {
  if (!distributorId) return store.SEED_AS_OF_DATE;
  return store.getAsOfDate(distributorId);
}

/**
 * Orders feeding the prediction engine (gap medians, suggested quantities)
 * must exclude cancelled ones — a cancelled order isn't evidence of a real
 * reorder cycle, and counting it would skew future predictions. The full
 * order list (cancelled included) is still what GET /api/orders returns,
 * so order history stays a complete audit trail.
 */
async function getActiveOrders(distributorId: string): Promise<Order[]> {
  const orders = await store.getOrders(distributorId);
  return orders.filter(o => o.status !== 'cancelled');
}

/**
 * A quantity is only valid if it's a finite positive integer. `!quantity`
 * alone (used previously) only rejects 0/empty — it lets negative numbers
 * and NaN (from non-numeric input) through, since both are "truthy" or
 * silently coerce.
 */
function isPositiveQuantity(raw: unknown): boolean {
  const n = Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0;
}

// ============================================================================
// Nudge generation: for any prediction due today or overdue, without a nudge
// sent in the last 7 days, create one.
// ============================================================================

async function syncNudgesForDistributor(distributorId: string, asOfDate: string): Promise<NudgeRecord[]> {
  const [outlets, products, orders, existingNudges] = await Promise.all([
    store.getOutlets(distributorId),
    store.getProducts(distributorId),
    getActiveOrders(distributorId),
    store.getNudges(distributorId),
  ]);

  if (orders.length === 0) return existingNudges;

  const predictions = computePredictions(asOfDate, outlets, products, orders);
  const toCreate: NudgeRecord[] = [];

  for (const pred of predictions) {
    if (pred.predicted_next_date > asOfDate) continue;

    const pairNudges = existingNudges.filter(
      n => n.outlet_id === pred.outlet_id && n.product_id === pred.product_id
    );
    const hasRecentNudge = pairNudges.some(n => {
      const sentDate = (n.sent_at || '').split('T')[0];
      if (!sentDate) return false;
      const diff = dayDifference(sentDate, asOfDate);
      return diff >= 0 && diff < 7;
    });
    if (hasRecentNudge) continue;

    const outlet = outlets.find(o => o.id === pred.outlet_id);
    const product = products.find(p => p.id === pred.product_id);
    const pairOrders = orders
      .filter(o => o.outlet_id === pred.outlet_id && o.product_id === pred.product_id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const last3 = pairOrders.slice(0, 3);
    const suggestedQty = last3.length > 0
      ? Math.max(1, Math.round(last3.reduce((sum, o) => sum + o.quantity, 0) / last3.length))
      : (pred.recent_average_quantity || 10);

    toCreate.push({
      id: '',
      distributor_id: distributorId,
      outlet_id: pred.outlet_id,
      outlet_name: outlet?.name || pred.outlet_name,
      outlet_route: outlet?.route || pred.route,
      product_id: pred.product_id,
      product_name: product?.name || pred.product_name,
      product_unit: product?.unit || pred.product_unit || 'case',
      message: pred.reasoning,
      sent_at: asOfDate + 'T09:00:00.000Z',
      read: false,
      suggested_quantity: suggestedQty,
      wholesale_price: pred.wholesale_price,
    });
  }

  for (const n of toCreate) {
    await store.saveNudge(n);
  }

  return toCreate.length > 0 ? await store.getNudges(distributorId) : existingNudges;
}

// One-time async bootstrap (as-of-date + demo seed), shared across invocations
// where the runtime keeps the module warm (matters on serverless too).
let initPromise: Promise<void> | null = null;
function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await store.ensureDemoAccountSeeded();
    })().catch(err => {
      initPromise = null; // allow retry on next request if bootstrap failed
      throw err;
    });
  }
  return initPromise;
}

/**
 * Builds the Express app containing only the /api/* routes (no static file
 * serving) — used as-is both by the local dev server (server.ts, which wraps
 * it with static/Vite middleware) and by the Vercel serverless function
 * (api/index.ts, where Vercel serves the static build separately).
 */
export function createApiApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(async (_req, _res, next) => {
    try {
      await ensureInitialized();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', as_of_date: store.SEED_AS_OF_DATE });
  });

  // ==========================================================================
  // Auth: the client authenticates with Firebase Auth directly (email/password)
  // and then calls these endpoints with a verified ID token to create/fetch
  // the Firestore profile (role, business record, etc).
  // ==========================================================================

  app.post('/api/auth/register', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const uid = req.uid!;
      const rateLimit = await store.checkRateLimit(uid, 'register', 10, 60 * 60 * 1000);
      if (!rateLimit.allowed) {
        res.status(429).json({ success: false, message: 'Too many requests — please wait a moment and try again.' });
        return;
      }
      const email = (req.userEmail || '').toLowerCase();
      const { role, name } = req.body || {};
      const finalRole = role === 'retailer' ? 'retailer' : 'distributor';
      const finalName = name ? String(name).trim() : (finalRole === 'distributor' ? 'Wholesale Agency' : 'Kirana Store');

      const existing = await store.getUser(uid);
      const isDemo = uid === store.DEMO_DIST_ID || uid === store.DEMO_RETAILER_ID;

      const userProfile: store.ServerUser = {
        uid,
        email,
        role: finalRole,
        name: finalName,
        created_at: existing?.created_at || new Date().toISOString(),
        is_demo: isDemo,
      };
      await store.createUserProfile(userProfile);

      if (finalRole === 'distributor') {
        let dist = await store.getDistributor(uid);
        if (!dist) {
          const inviteCode = await store.generateUniqueInviteCode();
          dist = {
            id: uid,
            distributor_id: uid,
            uid,
            name: finalName,
            route: '',
            invite_code: inviteCode,
            is_demo: isDemo,
            has_completed_onboarding: false,
            created_at: userProfile.created_at,
          };
          await store.saveDistributor(dist);
        }
        res.status(201).json({ success: true, user: userProfile, distributor: dist });
        return;
      }

      let retailer = await store.getRetailer(uid);
      if (!retailer) {
        retailer = {
          id: uid,
          uid,
          name: finalName,
          phone: '',
          linked_distributor_id: undefined as any,
          joined_at: new Date().toISOString(),
        };
        await store.saveRetailer(retailer);
      }
      res.status(201).json({ success: true, user: userProfile, retailer, distributor: null, outlet: null });
    } catch (err: any) {
      console.error('Register error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to create account.' });
    }
  });

  async function buildSessionResponse(uid: string, _userEmail: string, res: express.Response) {
    const user = await store.getUser(uid);
    if (!user) {
      res.status(404).json({ success: false, message: 'No profile found for this account. Please sign up first.' });
      return;
    }

    if (user.role === 'distributor') {
      const dist = await store.getDistributor(uid);
      res.json({ success: true, user, distributor: dist });
      return;
    }

    const retailer = await store.getRetailer(uid);
    let linkedDist = null;
    let matchedOutlet = null;
    if (retailer?.linked_distributor_id) {
      linkedDist = await store.getDistributor(retailer.linked_distributor_id);
      if (retailer.outlet_id) {
        matchedOutlet = await store.getOutletById(retailer.outlet_id);
      }
    }
    res.json({ success: true, user, retailer, distributor: linkedDist, outlet: matchedOutlet });
  }

  app.post('/api/auth/login', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await buildSessionResponse(req.uid!, req.userEmail || '', res);
    } catch (err: any) {
      console.error('Login session error:', err);
      res.status(500).json({ success: false, message: 'Failed to load your account.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await buildSessionResponse(req.uid!, req.userEmail || '', res);
    } catch (err: any) {
      console.error('Me session error:', err);
      res.status(500).json({ success: false, message: 'Failed to load your account.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    // Firebase Auth sign-out happens client-side; nothing to invalidate server-side.
    res.json({ success: true, message: 'Signed out successfully' });
  });

  // ==========================================================================
  // Business data — all scoped to the verified caller's own distributor
  // ==========================================================================

  app.get('/api/distributor', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    if (!distributorId) {
      res.json({ success: true, as_of_date: store.SEED_AS_OF_DATE, data: null });
      return;
    }
    const [dist, asOfDate] = await Promise.all([
      store.getDistributor(distributorId),
      resolveAsOfDate(distributorId),
    ]);
    res.json({ success: true, as_of_date: asOfDate, data: dist });
  });

  app.post(['/api/distributor', '/api/distributor/setup'], requireAuth, async (req: AuthedRequest, res) => {
    try {
      const uid = req.uid!;
      const existing = await store.getDistributor(uid);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Distributor profile not found.' });
        return;
      }
      const updates = req.body || {};
      const updated = {
        ...existing,
        name: updates.name?.trim() || updates.agency_name?.trim() || existing.name,
        route: updates.route?.trim() ?? existing.route,
        upi_id: updates.upi_id?.trim() ?? existing.upi_id,
        phone: updates.phone?.trim() ?? existing.phone,
        location: updates.location?.trim() ?? existing.location,
        has_completed_onboarding: updates.has_completed_onboarding !== undefined
          ? !!updates.has_completed_onboarding
          : existing.has_completed_onboarding,
      };
      await store.saveDistributor(updated);
      res.json({ success: true, message: 'Distributor profile updated successfully', data: updated });
    } catch (err: any) {
      console.error('Distributor setup error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to save distributor profile.' });
    }
  });

  app.get('/api/products', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    const [data, asOfDate] = await Promise.all([
      distributorId ? store.getProducts(distributorId) : Promise.resolve([]),
      resolveAsOfDate(distributorId),
    ]);
    res.json({ success: true, as_of_date: asOfDate, data });
  });

  app.get('/api/outlets', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    const [outlets, asOfDate, balances] = await Promise.all([
      distributorId ? store.getOutlets(distributorId) : Promise.resolve([]),
      resolveAsOfDate(distributorId),
      distributorId ? store.getOutletBalancesByDistributor(distributorId) : Promise.resolve({}),
    ]);
    const data = outlets.map(o => ({ ...o, credit_balance: balances[o.id] || 0 }));
    res.json({ success: true, as_of_date: asOfDate, data });
  });

  app.get('/api/orders', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    if (!distributorId) {
      res.json({ success: true, as_of_date: store.SEED_AS_OF_DATE, data: [] });
      return;
    }
    const asOfDate = await resolveAsOfDate(distributorId);
    const { outlet_id, product_id, source } = req.query;
    const [orders, outlets, products] = await Promise.all([
      store.getOrders(distributorId),
      store.getOutlets(distributorId),
      store.getProducts(distributorId),
    ]);

    let filtered = orders;
    if (outlet_id && typeof outlet_id === 'string' && outlet_id !== 'all') {
      filtered = filtered.filter(o => o.outlet_id === outlet_id);
    }
    if (product_id && typeof product_id === 'string' && product_id !== 'all') {
      filtered = filtered.filter(o => o.product_id === product_id);
    }
    if (source && typeof source === 'string' && source !== 'all') {
      filtered = filtered.filter(o => (o.source || 'distributor') === source);
    }

    const enriched = filtered.map(ord => {
      const outlet = outlets.find(o => o.id === ord.outlet_id);
      const product = products.find(p => p.id === ord.product_id);
      return {
        ...ord,
        outlet_name: outlet ? outlet.name : ord.outlet_id,
        outlet_route: outlet ? outlet.route : '',
        product_name: product ? product.name : ord.product_id,
        product_unit: product ? product.unit : 'case',
        wholesale_price: product ? product.wholesale_price : 0,
        source: ord.source || 'distributor',
        placed_by: ord.placed_by || (ord.source === 'retailer' ? 'retailer' : (ord.source || 'distributor')),
        status: ord.status || 'placed',
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    res.json({ success: true, as_of_date: asOfDate, data: enriched });
  });

  app.get('/api/nudges', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    if (!distributorId) {
      res.json({ success: true, as_of_date: store.SEED_AS_OF_DATE, total: 0, data: [] });
      return;
    }
    const asOfDate = await resolveAsOfDate(distributorId);
    let list = await syncNudgesForDistributor(distributorId, asOfDate);
    const { outlet_id, product_id, today_only, unread_only } = req.query;
    if (outlet_id && typeof outlet_id === 'string') list = list.filter(n => n.outlet_id === outlet_id);
    if (product_id && typeof product_id === 'string') list = list.filter(n => n.product_id === product_id);
    if (today_only === 'true') list = list.filter(n => (n.sent_at || '').startsWith(asOfDate));
    if (unread_only === 'true') list = list.filter(n => !n.read);
    res.json({ success: true, as_of_date: asOfDate, total: list.length, data: list });
  });

  app.post('/api/nudges', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'No distributor account found for this user.' });
        return;
      }
      const { outlet_id, product_id, message } = req.body;
      const [outlets, products, orders, asOfDate] = await Promise.all([
        store.getOutlets(distributorId),
        store.getProducts(distributorId),
        getActiveOrders(distributorId),
        resolveAsOfDate(distributorId),
      ]);
      const outlet = outlets.find(o => o.id === outlet_id);
      const product = products.find(p => p.id === product_id);
      const predictions = computePredictions(asOfDate, outlets, products, orders);
      const pred = predictions.find(p => p.outlet_id === outlet_id && p.product_id === product_id);

      const pairOrders = orders
        .filter(o => o.outlet_id === outlet_id && o.product_id === product_id)
        .sort((a, b) => b.date.localeCompare(a.date));
      const last3 = pairOrders.slice(0, 3);
      const suggestedQty = last3.length > 0
        ? Math.max(1, Math.round(last3.reduce((sum, o) => sum + o.quantity, 0) / last3.length))
        : (pred?.recent_average_quantity || 10);

      const newNudge = await store.saveNudge({
        id: '',
        distributor_id: distributorId,
        outlet_id,
        outlet_name: outlet?.name || outlet_id,
        outlet_route: outlet?.route || '',
        product_id,
        product_name: product?.name || product_id,
        product_unit: product?.unit || 'case',
        message: message || pred?.reasoning || `Reorder reminder for ${product?.name || product_id}.`,
        sent_at: asOfDate + 'T' + new Date().toISOString().split('T')[1],
        read: false,
        suggested_quantity: suggestedQty,
        wholesale_price: product?.wholesale_price || pred?.wholesale_price || 500,
      });
      res.json({ success: true, data: newNudge, message: `Nudge created for ${newNudge.outlet_name}` });
    } catch (err: any) {
      console.error('Create nudge error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to create nudge.' });
    }
  });

  app.patch('/api/nudges/:id/read', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    // Verify the nudge belongs to the caller's own distributor before mutating it —
    // without this, any authenticated user could flip `read` on any other tenant's
    // nudge just by guessing/enumerating its id.
    const nudge = await store.getNudgeById(req.params.id);
    if (!distributorId || !nudge || nudge.distributor_id !== distributorId) {
      res.status(404).json({ success: false, message: 'Nudge not found.' });
      return;
    }
    await store.markNudgeRead(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/nudges/mark-read', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    if (!distributorId) {
      res.status(400).json({ success: false, message: 'No distributor account found for this user.' });
      return;
    }
    const { id, ids, outlet_id } = req.body;
    const ownNudgeIds = new Set((await store.getNudges(distributorId)).map(n => n.id));
    if (id && ownNudgeIds.has(id)) await store.markNudgeRead(id);
    if (Array.isArray(ids)) {
      for (const nudgeId of ids) {
        if (ownNudgeIds.has(nudgeId)) await store.markNudgeRead(nudgeId);
      }
    }
    if (outlet_id) {
      await store.markNudgesReadForOutlet(distributorId, outlet_id);
    }
    res.json({ success: true, message: 'Nudges marked as read' });
  });

  app.get('/api/predictions', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    if (!distributorId) {
      res.json({ success: true, as_of_date: store.SEED_AS_OF_DATE, data: [] });
      return;
    }
    const asOfDate = await resolveAsOfDate(distributorId);
    const [outlets, products, orders] = await Promise.all([
      store.getOutlets(distributorId),
      store.getProducts(distributorId),
      getActiveOrders(distributorId),
    ]);
    if (products.length === 0 || orders.length === 0) {
      res.json({ success: true, as_of_date: asOfDate, data: [] });
      return;
    }
    let predictions = computePredictions(asOfDate, outlets, products, orders);
    const { outlet_id, product_id } = req.query;
    if (outlet_id && typeof outlet_id === 'string') predictions = predictions.filter(p => p.outlet_id === outlet_id);
    if (product_id && typeof product_id === 'string') predictions = predictions.filter(p => p.product_id === product_id);
    res.json({ success: true, as_of_date: asOfDate, data: predictions });
  });

  app.get('/api/predictions/:outlet_id/:product_id', requireAuth, async (req: AuthedRequest, res) => {
    const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
    if (!distributorId) {
      res.status(404).json({ success: false, message: 'No prediction found.' });
      return;
    }
    const [outlets, products, orders, asOfDate] = await Promise.all([
      store.getOutlets(distributorId),
      store.getProducts(distributorId),
      getActiveOrders(distributorId),
      resolveAsOfDate(distributorId),
    ]);
    const predictions = computePredictions(asOfDate, outlets, products, orders);
    const { outlet_id, product_id } = req.params;
    const prediction = predictions.find(p => p.outlet_id === outlet_id && p.product_id === product_id);
    if (!prediction) {
      res.status(404).json({ success: false, message: `No prediction found for outlet ${outlet_id} and product ${product_id}` });
      return;
    }
    res.json({ success: true, as_of_date: asOfDate, data: prediction });
  });

  app.post('/api/outlets', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const distributorId = await resolveDistributorId(req.uid!);
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'No distributor account found for this user.' });
        return;
      }
      const { id: _ignoredId, ...body } = req.body || {};
      if (!body.name || !body.route) {
        res.status(400).json({ success: false, message: 'Outlet name and route are required' });
        return;
      }
      // Never trust a client-supplied id here — this is create-only, and
      // accepting an id would let a caller overwrite another distributor's
      // existing outlet document by guessing/reusing its id.
      const saved = await store.saveOutlet({ ...body, distributor_id: distributorId });
      res.status(201).json({ success: true, data: saved });
    } catch (err: any) {
      console.error('Add outlet error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to add outlet.' });
    }
  });

  app.post('/api/products', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const distributorId = await resolveDistributorId(req.uid!);
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'No distributor account found for this user.' });
        return;
      }
      const { id: _ignoredId, ...body } = req.body || {};
      if (!body.name || !body.unit) {
        res.status(400).json({ success: false, message: 'Product name and unit are required' });
        return;
      }
      const saved = await store.saveProduct({ ...body, distributor_id: distributorId });
      res.status(201).json({ success: true, data: saved });
    } catch (err: any) {
      console.error('Add product error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to add product.' });
    }
  });

  app.post('/api/bulk-import', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const distributorId = await resolveDistributorId(req.uid!);
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'No distributor account found for this user.' });
        return;
      }
      const { outlets: inOutlets, products: inProducts, orders: inOrders } = req.body || {};

      let outletsCount = 0, productsCount = 0, ordersCount = 0;
      if (Array.isArray(inOutlets) && inOutlets.length > 0) {
        for (const o of inOutlets) {
          const { id: _ignoredId, ...rest } = o || {};
          await store.saveOutlet({ ...rest, distributor_id: distributorId });
        }
        outletsCount = inOutlets.length;
      }
      if (Array.isArray(inProducts) && inProducts.length > 0) {
        for (const p of inProducts) {
          const { id: _ignoredId, ...rest } = p || {};
          await store.saveProduct({ ...rest, distributor_id: distributorId });
        }
        productsCount = inProducts.length;
      }
      if (Array.isArray(inOrders) && inOrders.length > 0) {
        const validOrders = inOrders.filter((o: any) => isPositiveQuantity(o?.quantity));
        await store.addOrdersBatch(validOrders.map((o: any) => ({ ...o, distributor_id: distributorId })));
        ordersCount = validOrders.length;
      }

      const dist = await store.getDistributor(distributorId);
      if (dist) {
        await store.saveDistributor({ ...dist, has_completed_onboarding: true });
      }

      const [outlets, products, orders, asOfDate] = await Promise.all([
        store.getOutlets(distributorId),
        store.getProducts(distributorId),
        getActiveOrders(distributorId),
        resolveAsOfDate(distributorId),
      ]);
      const predictionsCount = computePredictions(asOfDate, outlets, products, orders).length;

      res.json({
        success: true,
        message: 'Bulk import applied successfully',
        data: { outletsCount, productsCount, ordersCount, predictionsCount },
      });
    } catch (err: any) {
      console.error('Bulk import error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Bulk import failed.' });
    }
  });

  app.post('/api/orders', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const distributorId = await resolveDistributorId(req.uid!);
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'No linked distributor account found for this user.' });
        return;
      }
      const { outlet_id, product_id, quantity, date, source, placed_by } = req.body;
      if (!outlet_id || !product_id || !quantity) {
        res.status(400).json({ success: false, message: 'Missing outlet_id, product_id, or quantity' });
        return;
      }
      if (!isPositiveQuantity(quantity)) {
        res.status(400).json({ success: false, message: 'Quantity must be a whole number greater than 0.' });
        return;
      }

      const asOfDate = await resolveAsOfDate(distributorId);
      const finalPlacedBy = placed_by || (source === 'retailer' ? 'retailer' : 'distributor');
      const finalSource = source || (finalPlacedBy === 'retailer' ? 'retailer' : 'distributor');

      const newOrder: Order = {
        id: '',
        distributor_id: distributorId,
        outlet_id,
        product_id,
        date: date || asOfDate,
        quantity: Number(quantity),
        source: finalSource as any,
        placed_by: finalPlacedBy,
      };
      const saved = await store.addOrder(newOrder);

      const [outlets, products, orders] = await Promise.all([
        store.getOutlets(distributorId),
        store.getProducts(distributorId),
        getActiveOrders(distributorId),
      ]);
      const predictions = computePredictions(asOfDate, outlets, products, orders);
      const updatedPrediction = predictions.find(p => p.outlet_id === outlet_id && p.product_id === product_id) || null;
      await syncNudgesForDistributor(distributorId, asOfDate);

      // Every order places goods on credit with the outlet — this is how
      // Indian kirana-distributor trade actually works, and is intentionally
      // independent of the simulated UPI/WhatsApp-pay screens (those cover a
      // single order's payment moment; the ledger tracks the ongoing
      // goods-supplied-vs-cash-collected relationship).
      const orderedProduct = products.find(p => p.id === product_id);
      const chargeAmount = saved.quantity * (orderedProduct?.wholesale_price || 0);
      if (chargeAmount > 0) {
        await store.addLedgerEntry({
          distributor_id: distributorId,
          outlet_id,
          order_id: saved.id,
          type: 'charge',
          amount: chargeAmount,
          date: saved.date,
        });
      }

      res.status(201).json({
        success: true,
        message: 'Order recorded and prediction recomputed successfully',
        data: { order: saved, prediction: updatedPrediction, predictionsCount: predictions.length },
      });
    } catch (err: any) {
      console.error('Place order error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to record order.' });
    }
  });

  app.post('/api/gemini/extract-orders', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'No distributor account found for this user.' });
        return;
      }
      // This calls a paid Gemini vision API per request — cap it per caller so
      // a runaway client (or deliberate abuse) can't run up real cost.
      const rateLimit = await store.checkRateLimit(req.uid!, 'gemini_extract', 20, 60 * 60 * 1000);
      if (!rateLimit.allowed) {
        res.status(429).json({
          success: false,
          message: `Too many photo imports — please wait before trying again (resets ${rateLimit.resetAt}).`,
        });
        return;
      }
      const { image, mimeType } = req.body;
      if (!image) {
        res.status(400).json({ success: false, message: 'Image base64 data is required' });
        return;
      }
      const [outlets, products, asOfDate] = await Promise.all([
        store.getOutlets(distributorId),
        store.getProducts(distributorId),
        resolveAsOfDate(distributorId),
      ]);
      const result = await extractOrdersFromImage(image, mimeType || 'image/jpeg', asOfDate, outlets, products);
      res.json({
        success: true,
        as_of_date: asOfDate,
        data: result.candidateLines,
        model_used: result.modelUsed,
        fallback_used: result.fallbackUsed,
      });
    } catch (err: any) {
      console.error('Extraction route error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to extract orders from image' });
    }
  });

  app.post('/api/orders/bulk-create', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const distributorId = await resolveDistributorId(req.uid!);
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'No distributor account found for this user.' });
        return;
      }
      const { lines } = req.body;
      if (!Array.isArray(lines) || lines.length === 0) {
        res.status(400).json({ success: false, message: 'Array of order lines is required' });
        return;
      }
      const [outlets, products, asOfDate] = await Promise.all([
        store.getOutlets(distributorId),
        store.getProducts(distributorId),
        resolveAsOfDate(distributorId),
      ]);

      const toCreate: Order[] = [];
      for (const line of lines) {
        if (!line.outlet_id || !line.product_id || !line.quantity) continue;
        const outlet = outlets.find(o => o.id === line.outlet_id);
        const product = products.find(p => p.id === line.product_id);
        toCreate.push({
          id: '',
          distributor_id: distributorId,
          outlet_id: line.outlet_id,
          outlet_name: outlet?.name,
          product_id: line.product_id,
          product_name: product?.name,
          date: line.date || asOfDate,
          quantity: Math.max(1, Math.round(Number(line.quantity)) || 1),
          source: 'ocr_import',
          placed_by: 'distributor',
        });
      }
      const createdOrders = await store.addOrdersBatch(toCreate);

      const allOrders = await store.getOrders(distributorId);
      const activeOrders = allOrders.filter(o => o.status !== 'cancelled');
      const predictionsCount = computePredictions(asOfDate, outlets, products, activeOrders).length;
      await syncNudgesForDistributor(distributorId, asOfDate);

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdOrders.length} orders from photo import`,
        data: { createdOrders, ordersCount: allOrders.length, predictionsCount },
      });
    } catch (err: any) {
      console.error('Bulk create orders error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to save imported orders.' });
    }
  });

  app.post('/api/retailers/join', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const uid = req.uid!;
      const { code, name, phone } = req.body;
      if (!code || !name || !phone) {
        res.status(400).json({ success: false, message: 'Invite code, name, and phone are required' });
        return;
      }

      const matchedDistributor = await store.findDistributorByInviteCode(code);
      if (!matchedDistributor) {
        res.status(404).json({ success: false, message: 'Invalid invite code. No distributor found with this code. Please check with your distributor.' });
        return;
      }

      let matchedOutlet = await store.findOutletByPhone(matchedDistributor.id, phone);
      let wasMatched = true;
      if (!matchedOutlet) {
        matchedOutlet = await store.saveOutlet({
          id: '',
          distributor_id: matchedDistributor.id,
          name: name.trim(),
          route: matchedDistributor.route || 'General Delivery Route',
          owner: name.trim(),
          phone: phone.trim(),
        });
        wasMatched = false;
      }

      const retailerRecord = {
        id: uid,
        uid,
        name: name.trim(),
        phone: phone.trim(),
        linked_distributor_id: matchedDistributor.id,
        outlet_id: matchedOutlet.id,
        joined_at: new Date().toISOString(),
      };
      await store.saveRetailer(retailerRecord);

      res.json({
        success: true,
        data: { retailer: retailerRecord, distributor: matchedDistributor, outlet: matchedOutlet, wasMatched },
      });
    } catch (err: any) {
      console.error('Retailer join error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to join distributor.' });
    }
  });

  app.get('/api/retailers/:uid', requireAuth, async (req: AuthedRequest, res) => {
    const { uid } = req.params;
    const retailer = await store.getRetailer(uid);
    if (!retailer) {
      res.status(404).json({ success: false, message: 'Retailer not found' });
      return;
    }
    // Only the retailer themselves, or the distributor they're linked to, may view this
    const previewUid = getPreviewUid(req);
    const isSelf = req.uid === uid;
    const isDemoPreview = previewUid === uid && req.uid === store.DEMO_DIST_ID && uid === store.DEMO_RETAILER_ID;
    const isLinkedDistributor = !!retailer.linked_distributor_id && retailer.linked_distributor_id === req.uid;
    if (!isSelf && !isLinkedDistributor && !isDemoPreview) {
      res.status(403).json({ success: false, message: 'Not authorized to view this profile.' });
      return;
    }
    let linkedDist = null;
    let matchedOutlet = null;
    if (retailer.linked_distributor_id) {
      linkedDist = await store.getDistributor(retailer.linked_distributor_id);
      if (retailer.outlet_id) matchedOutlet = await store.getOutletById(retailer.outlet_id);
    }
    res.json({ success: true, data: { retailer, distributor: linkedDist, outlet: matchedOutlet } });
  });

  // A retailer may cancel an order the DISTRIBUTOR placed on their behalf (not
  // their own self-placed orders, and only for their own linked outlet). The
  // order stays in history as an audit trail, marked cancelled, and is excluded
  // from prediction math going forward via getActiveOrders().
  app.post('/api/orders/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const distributorId = await resolveDistributorId(req.uid!, getPreviewUid(req));
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'No distributor account found for this user.' });
        return;
      }
      const order = await store.getOrderById(req.params.id);
      if (!order || order.distributor_id !== distributorId) {
        res.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }
      const retailer = await store.getRetailer(req.uid!);
      const isOwnOutletOrder = !!retailer && !!retailer.outlet_id && retailer.outlet_id === order.outlet_id;
      const isDistributorPlaced = order.placed_by === 'distributor';
      if (!retailer || !isOwnOutletOrder || !isDistributorPlaced) {
        res.status(403).json({ success: false, message: 'This order cannot be cancelled from your account.' });
        return;
      }
      if (order.status === 'cancelled') {
        res.status(400).json({ success: false, message: 'Order is already cancelled.' });
        return;
      }
      await store.cancelOrder(order.id);

      // Reverse the credit charge this order created, if any — cancelling
      // goods that were never actually delivered shouldn't leave the outlet
      // owing for them. Reverses the exact amount originally charged rather
      // than recomputing from today's product price.
      const outletLedger = await store.getLedgerEntries(order.outlet_id);
      const originalCharge = outletLedger.find(e => e.order_id === order.id && e.type === 'charge');
      if (originalCharge) {
        await store.addLedgerEntry({
          distributor_id: distributorId,
          outlet_id: order.outlet_id,
          order_id: order.id,
          type: 'payment',
          amount: originalCharge.amount,
          note: 'Reversed: order cancelled',
          date: await resolveAsOfDate(distributorId),
        });
      }

      res.json({ success: true, message: 'Order cancelled.', data: { ...order, status: 'cancelled' } });
    } catch (err: any) {
      console.error('Cancel order error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to cancel order.' });
    }
  });

  // Credit ledger: the distributor who owns the outlet, or the retailer
  // linked to it, may view the balance and history; only the distributor
  // may record a payment (matches how it actually works — the salesman/
  // distributor collects and records receipt, the retailer doesn't
  // self-report what they paid).
  app.get('/api/outlets/:id/ledger', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const outlet = await store.getOutletById(req.params.id);
      if (!outlet) {
        res.status(404).json({ success: false, message: 'Outlet not found.' });
        return;
      }
      const retailer = await store.getRetailer(req.uid!);
      const isOwningDistributor = outlet.distributor_id === req.uid;
      const isLinkedRetailer = !!retailer && retailer.outlet_id === outlet.id;
      if (!isOwningDistributor && !isLinkedRetailer) {
        res.status(403).json({ success: false, message: 'Not authorized to view this ledger.' });
        return;
      }
      const entries = await store.getLedgerEntries(outlet.id);
      const balance = entries.reduce((sum, e) => sum + (e.type === 'charge' ? e.amount : -e.amount), 0);
      const lastPayment = [...entries].reverse().find(e => e.type === 'payment' && e.note !== 'Reversed: order cancelled');
      res.json({
        success: true,
        data: { balance, entries, last_payment_date: lastPayment?.date || null },
      });
    } catch (err: any) {
      console.error('Get ledger error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to load ledger.' });
    }
  });

  app.post('/api/outlets/:id/ledger/payment', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const outlet = await store.getOutletById(req.params.id);
      if (!outlet) {
        res.status(404).json({ success: false, message: 'Outlet not found.' });
        return;
      }
      if (outlet.distributor_id !== req.uid) {
        res.status(403).json({ success: false, message: 'Only the outlet\'s own distributor can record a payment.' });
        return;
      }
      const { amount, note } = req.body || {};
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        res.status(400).json({ success: false, message: 'Payment amount must be a positive number.' });
        return;
      }
      const asOfDate = await resolveAsOfDate(outlet.distributor_id);
      const entry = await store.addLedgerEntry({
        distributor_id: outlet.distributor_id,
        outlet_id: outlet.id,
        type: 'payment',
        amount: numericAmount,
        note: note ? String(note).trim().slice(0, 200) : undefined,
        date: asOfDate,
      });
      const entries = await store.getLedgerEntries(outlet.id);
      const balance = entries.reduce((sum, e) => sum + (e.type === 'charge' ? e.amount : -e.amount), 0);
      res.status(201).json({ success: true, message: 'Payment recorded.', data: { entry, balance } });
    } catch (err: any) {
      console.error('Record payment error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to record payment.' });
    }
  });

  // RESET DEMO DATA ONLY — resets solely the fixed demo account; other accounts untouched.
  // Only the demo account itself may trigger this (not just "any signed-in user"),
  // otherwise any real signup could reset/grief the demo mid-presentation.
  app.post('/api/reset', requireAuth, async (req: AuthedRequest, res) => {
    if (req.uid !== store.DEMO_DIST_ID) {
      res.status(403).json({ success: false, message: 'Only the demo account can be reset.' });
      return;
    }
    try {
      await store.resetDemoAccount();
      const [outlets, products, orders] = await Promise.all([
        store.getOutlets(store.DEMO_DIST_ID),
        store.getProducts(store.DEMO_DIST_ID),
        getActiveOrders(store.DEMO_DIST_ID),
      ]);
      const asOfDate = await resolveAsOfDate(store.DEMO_DIST_ID);
      const predictions = computePredictions(asOfDate, outlets, products, orders);
      res.json({
        success: true,
        message: 'Demo account data reset to original seed data',
        as_of_date: asOfDate,
        data: predictions,
      });
    } catch (err: any) {
      console.error('Reset error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to reset demo data.' });
    }
  });

  app.post('/api/set-date', requireAuth, async (req: AuthedRequest, res) => {
    if (req.uid !== store.DEMO_DIST_ID) {
      res.status(403).json({ success: false, message: 'Only the demo account can shift its date.' });
      return;
    }
    const { date } = req.body;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      await store.setAsOfDate(store.DEMO_DIST_ID, date);
      const [outlets, products, orders] = await Promise.all([
        store.getOutlets(store.DEMO_DIST_ID),
        store.getProducts(store.DEMO_DIST_ID),
        getActiveOrders(store.DEMO_DIST_ID),
      ]);
      const asOfDate = await resolveAsOfDate(store.DEMO_DIST_ID);
      const updated = computePredictions(asOfDate, outlets, products, orders);
      res.json({ success: true, as_of_date: asOfDate, data: updated });
    } else {
      res.status(400).json({ success: false, message: 'Invalid date format (YYYY-MM-DD)' });
    }
  });

  return app;
}
