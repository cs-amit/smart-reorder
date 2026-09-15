import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, auth, generateInviteCode, isFirebaseConfigured, withTimeout } from './firebase';
import { getStoredUser } from './authService';
import { apiFetch } from './api';
import { Distributor, Outlet, Product, Order, Retailer, NudgeRecord } from '../types';

export interface BulkImportPayload {
  outlets?: Array<{ id: string; name: string; route: string; owner?: string; phone?: string }>;
  products?: Array<{ id: string; name: string; unit: string; wholesale_price?: number; mrp?: number; items_per_case?: number; category?: string }>;
  orders?: Array<{ id: string; outlet_id: string; product_id: string; date: string; quantity: number }>;
}

/**
 * Return current authenticated user UID.
 * Does NOT sign the user in anonymously.
 */
export async function ensureSignedInUser(): Promise<string> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  const stored = getStoredUser();
  if (stored?.uid) {
    return stored.uid;
  }
  return '';
}

/**
 * Return current authenticated retailer user UID.
 * Does NOT sign the user in anonymously.
 */
export async function ensureRetailerUserUid(): Promise<string> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  const stored = getStoredUser();
  if (stored?.uid) {
    return stored.uid;
  }
  return '';
}

/**
 * Fetch distributor profile linked to user uid
 */
export async function fetchDistributorByUid(uid: string): Promise<Distributor | null> {
  // Try Firestore if live Firebase project is configured
  if (isFirebaseConfigured) {
    try {
      const distributorsRef = collection(db, 'distributors');
      const q = query(distributorsRef, where('uid', '==', uid));
      const querySnapshot = await withTimeout(
        getDocs(q),
        2000,
        'Firestore distributor query timed out'
      );

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        return { id: docSnap.id, ...(docSnap.data() as Omit<Distributor, 'id'>) };
      }
    } catch (err) {
      console.warn('Firestore fetchDistributorByUid fallback:', err);
    }
  }

  // Local fallback check
  const saved = localStorage.getItem(`sr_dist_${uid}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }

  // Backend server API check
  try {
    const res = await apiFetch('/api/distributor', {}, uid);
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (e) {}

  return null;
}

/**
 * Save or update distributor business setup
 */
export async function saveDistributorBusiness(params: {
  uid: string;
  name: string;
  route: string;
  phone?: string;
  upi_id?: string;
  location?: string;
}): Promise<Distributor> {
  if (!params.name?.trim()) {
    throw new Error('Business name is required.');
  }
  if (!params.route?.trim()) {
    throw new Error('Primary delivery route/area is required.');
  }

  const distributorId = params.uid;
  const inviteCode = generateInviteCode('FMCG');

  const distributorData: Distributor = {
    id: distributorId,
    distributor_id: distributorId,
    uid: params.uid,
    name: params.name.trim(),
    route: params.route.trim(),
    invite_code: inviteCode,
    phone: params.phone?.trim() || '+91 98200 00000',
    upi_id: params.upi_id?.trim() || `${params.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@icici`,
    location: params.location?.trim() || `${params.route.trim()} Distribution Hub`,
    created_at: new Date().toISOString(),
  };

  // 1. Keep localStorage synchronized for immediate local persistence
  localStorage.setItem(`sr_dist_${params.uid}`, JSON.stringify(distributorData));
  localStorage.setItem('sr_active_dist_id', distributorId);

  // 2. Synchronize with Express backend server so prediction engine immediately reflects this distributor
  try {
    const res = await apiFetch('/api/distributor/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(distributorData),
    }, params.uid);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Server error (${res.status}) during distributor setup`);
    }
  } catch (syncErr: any) {
    console.warn('Backend sync warning:', syncErr);
    // If backend gave an explicit error, bubble it up so the UI catches and displays it
    if (syncErr?.message && !syncErr.message.includes('Failed to fetch')) {
      throw syncErr;
    }
  }

  // 3. Write to Firestore if live Firebase is configured
  if (isFirebaseConfigured) {
    try {
      const docRef = doc(db, 'distributors', distributorId);
      await withTimeout(
        setDoc(docRef, distributorData, { merge: true }),
        2500,
        'Firestore distributor write timed out'
      );
    } catch (err) {
      console.warn('Firestore saveDistributor error:', err);
    }
  }

  return distributorData;
}

/**
 * Fetch Outlets for distributor
 */
export async function fetchDistributorOutlets(distributorId: string): Promise<Outlet[]> {
  if (isFirebaseConfigured) {
    try {
      const outletsRef = collection(db, 'outlets');
      const q = query(outletsRef, where('distributor_id', '==', distributorId));
      const snapshot = await withTimeout(
        getDocs(q),
        2000,
        'Firestore fetch outlets timed out'
      );
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Outlet, 'id'>) }));
      }
    } catch (err) {
      console.warn('Firestore fetch outlets fallback:', err);
    }
  }

  // Fallback to Express backend
  try {
    const resp = await apiFetch('/api/outlets', {}, distributorId);
    const json = await resp.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (e) {}

  return [];
}

/**
 * Add an Outlet manually
 */
export async function addOutletManually(outlet: {
  distributor_id: string;
  name: string;
  route: string;
  owner?: string;
  phone?: string;
}): Promise<Outlet> {
  if (!outlet.name?.trim()) {
    throw new Error('Outlet store name is required.');
  }

  const newOutletId = 'O_' + Math.random().toString(36).substring(2, 8);
  const newOutlet: Outlet = {
    id: newOutletId,
    distributor_id: outlet.distributor_id,
    name: outlet.name.trim(),
    route: outlet.route?.trim() || 'General Route',
    owner: outlet.owner?.trim() || '',
    phone: outlet.phone?.trim() || '',
  };

  // Sync with backend API first
  try {
    const res = await apiFetch('/api/outlets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOutlet),
    }, outlet.distributor_id);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to add outlet (Status ${res.status})`);
    }
  } catch (e: any) {
    console.warn('Backend sync outlet error:', e);
    if (e?.message && !e.message.includes('Failed to fetch')) {
      throw e;
    }
  }

  // Sync with Firestore if configured
  if (isFirebaseConfigured) {
    try {
      const docRef = doc(db, 'outlets', newOutletId);
      await withTimeout(
        setDoc(docRef, newOutlet),
        2500,
        'Firestore add outlet timed out'
      );
    } catch (err) {
      console.warn('Firestore addOutlet error:', err);
    }
  }

  return newOutlet;
}

/**
 * Fetch Products for distributor
 */
export async function fetchDistributorProducts(distributorId: string): Promise<Product[]> {
  if (isFirebaseConfigured) {
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('distributor_id', '==', distributorId));
      const snapshot = await withTimeout(
        getDocs(q),
        2000,
        'Firestore fetch products timed out'
      );
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Product, 'id'>) }));
      }
    } catch (err) {
      console.warn('Firestore fetch products fallback:', err);
    }
  }

  // Fallback to Express backend
  try {
    const resp = await apiFetch('/api/products', {}, distributorId);
    const json = await resp.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (e) {}

  return [];
}

/**
 * Add a Product manually
 */
export async function addProductManually(prod: {
  distributor_id: string;
  name: string;
  unit: string;
  wholesale_price?: number;
  mrp?: number;
  items_per_case?: number;
  category?: string;
}): Promise<Product> {
  if (!prod.name?.trim()) {
    throw new Error('Product name is required.');
  }

  const newProductId = 'P_' + Math.random().toString(36).substring(2, 8);
  const newProduct: Product = {
    id: newProductId,
    distributor_id: prod.distributor_id,
    name: prod.name.trim(),
    unit: prod.unit.trim() || 'case',
    wholesale_price: Number(prod.wholesale_price) || 500,
    mrp: Number(prod.mrp) || Math.round((Number(prod.wholesale_price) || 500) * 1.25),
    items_per_case: Number(prod.items_per_case) || 12,
    category: prod.category?.trim() || 'FMCG Wholesale',
  };

  // Sync with backend API
  try {
    const res = await apiFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct),
    }, prod.distributor_id);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to add product (Status ${res.status})`);
    }
  } catch (e: any) {
    console.warn('Backend sync product error:', e);
    if (e?.message && !e.message.includes('Failed to fetch')) {
      throw e;
    }
  }

  // Sync with Firestore if configured
  if (isFirebaseConfigured) {
    try {
      const docRef = doc(db, 'products', newProductId);
      await withTimeout(
        setDoc(docRef, newProduct),
        2500,
        'Firestore add product timed out'
      );
    } catch (err) {
      console.warn('Firestore addProduct error:', err);
    }
  }

  return newProduct;
}

/**
 * Bulk import JSON
 */
export async function bulkImportCatalog(
  distributorId: string,
  data: BulkImportPayload
): Promise<{
  outletsCount: number;
  productsCount: number;
  ordersCount: number;
}> {
  if (!distributorId) {
    throw new Error('Distributor ID is required for bulk import');
  }

  const outletsToSave: Outlet[] = (data.outlets || []).map(o => ({
    id: o.id,
    distributor_id: distributorId,
    name: o.name,
    route: o.route,
    owner: o.owner || '',
    phone: o.phone || '',
  }));

  const productsToSave: Product[] = (data.products || []).map(p => ({
    id: p.id,
    distributor_id: distributorId,
    name: p.name,
    unit: p.unit || 'case',
    wholesale_price: p.wholesale_price || 500,
    mrp: p.mrp || 625,
    items_per_case: p.items_per_case || 12,
    category: p.category || 'Wholesale SKU',
  }));

  const ordersToSave: Order[] = (data.orders || []).map(ord => ({
    id: ord.id,
    distributor_id: distributorId,
    outlet_id: ord.outlet_id,
    product_id: ord.product_id,
    date: ord.date,
    quantity: Number(ord.quantity) || 1,
  }));

  // 1. Sync to Express backend server first
  try {
    const res = await apiFetch('/api/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distributor_id: distributorId,
        outlets: outletsToSave,
        products: productsToSave,
        orders: ordersToSave,
      }),
    }, distributorId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Bulk import server failed');
    }
  } catch (backendErr: any) {
    console.warn('Backend sync bulk-import error:', backendErr);
    if (backendErr?.message && !backendErr.message.includes('Failed to fetch')) {
      throw backendErr;
    }
  }

  // 2. Write to Firestore if live Firebase is configured
  if (isFirebaseConfigured) {
    try {
      for (const outlet of outletsToSave) {
        const docRef = doc(db, 'outlets', `${distributorId}_${outlet.id}`);
        await withTimeout(setDoc(docRef, outlet, { merge: true }), 1500);
      }
      for (const prod of productsToSave) {
        const docRef = doc(db, 'products', `${distributorId}_${prod.id}`);
        await withTimeout(setDoc(docRef, prod, { merge: true }), 1500);
      }
      for (const ord of ordersToSave) {
        const docRef = doc(db, 'orders', `${distributorId}_${ord.id}`);
        await withTimeout(setDoc(docRef, ord, { merge: true }), 1500);
      }
    } catch (firestoreErr) {
      console.warn('Firestore bulk import batch warning:', firestoreErr);
    }
  }

  return {
    outletsCount: outletsToSave.length,
    productsCount: productsToSave.length,
    ordersCount: ordersToSave.length,
  };
}

/**
 * Clean phone number to digits only, extracting standard 10-digit base for matching
 */
export function cleanPhone(p: string = ''): string {
  const digits = p.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export interface JoinDistributorResult {
  retailer: Retailer;
  distributor: Distributor;
  outlet: Outlet;
  wasMatched: boolean;
}

/**
 * Retailer Join by Distributor Invite Code
 *
 * Checks invite code and matches phone number against existing outlet records.
 * Immediately talks to backend API, syncs with Firestore with strict timeout, and
 * guarantees that any error displays visibly on-screen without hanging.
 */
export async function joinDistributorByInviteCode(params: {
  code: string;
  name: string;
  phone: string;
  uid: string;
}): Promise<JoinDistributorResult> {
  const enteredCode = params.code.trim().toUpperCase();
  const normalizedTargetPhone = cleanPhone(params.phone);

  if (!enteredCode) {
    throw new Error('Distributor invite code is required.');
  }
  if (!params.name.trim()) {
    throw new Error('Store or proprietor name is required.');
  }
  if (!normalizedTargetPhone) {
    throw new Error('Valid 10-digit phone number is required.');
  }

  // 1. Call Backend API endpoint
  let backendResult: any = null;
  try {
    const res = await apiFetch('/api/retailers/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: enteredCode,
        name: params.name.trim(),
        phone: params.phone.trim(),
        uid: params.uid,
      }),
    }, params.uid);

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || `Invalid invite code "${enteredCode}". Please check with your distributor.`);
    }
    backendResult = json.data;
  } catch (err: any) {
    // If it's a known error from the server or invite validation, rethrow immediately for the UI to display
    if (err?.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
    console.warn('Backend retailer join error, checking local fallback:', err);
  }

  if (backendResult) {
    const { retailer, distributor, outlet, wasMatched } = backendResult;

    // Cache locally for instant offline availability
    localStorage.setItem(`sr_retailer_profile_${params.uid}`, JSON.stringify(retailer));
    localStorage.setItem('sr_current_retailer_uid', params.uid);

    // If live Firestore is configured, write in background with safe timeout
    if (isFirebaseConfigured) {
      try {
        const retailerDocRef = doc(db, 'retailers', params.uid);
        const recordToSave: Retailer = {
          ...retailer,
          id: params.uid,
          uid: params.uid,
        };
        await withTimeout(setDoc(retailerDocRef, recordToSave, { merge: true }), 2500);
      } catch (fsErr) {
        console.warn('Firestore retailer write warning:', fsErr);
      }
    }

    return {
      retailer,
      distributor,
      outlet,
      wasMatched: Boolean(wasMatched),
    };
  }

  // Local fallback if backend was unavailable
  let targetDistributor: Distributor | null = null;
  const savedDist = localStorage.getItem('sr_active_dist_id');
  if (savedDist) {
    const dStr = localStorage.getItem(`sr_dist_${savedDist}`);
    if (dStr) {
      try {
        const parsed = JSON.parse(dStr);
        if (parsed.invite_code?.toUpperCase() === enteredCode) {
          targetDistributor = parsed;
        }
      } catch (e) {}
    }
  }

  if (!targetDistributor && (enteredCode === 'FMCG-8392' || enteredCode === 'FMCG-DEMO')) {
    targetDistributor = {
      id: 'D1',
      name: 'Anand Distributors, Ward Road',
      route: 'Ward Road',
      invite_code: 'FMCG-8392',
      phone: '+91 98201 45892',
      upi_id: 'ananddistributors@icici',
      location: 'Ward Road, Commercial Complex, Shop #14',
    };
  }

  if (!targetDistributor) {
    throw new Error(`Invalid invite code "${enteredCode}". No distributor found matching this code.`);
  }

  const fallbackOutletId = 'O_' + Math.random().toString(36).substring(2, 8);
  const matchedOutlet: Outlet = {
    id: fallbackOutletId,
    distributor_id: targetDistributor.id,
    name: params.name.trim(),
    route: targetDistributor.route || 'Ward Road',
    owner: params.name.trim(),
    phone: params.phone.trim(),
  };

  const retailerDocId = `R_${params.uid.slice(0, 8)}`;
  const retailerRecord: Retailer = {
    id: retailerDocId,
    uid: params.uid,
    name: params.name.trim(),
    phone: params.phone.trim(),
    linked_distributor_id: targetDistributor.id,
    outlet_id: matchedOutlet.id,
    joined_at: new Date().toISOString(),
  };

  localStorage.setItem(`sr_retailer_profile_${params.uid}`, JSON.stringify(retailerRecord));
  localStorage.setItem('sr_current_retailer_uid', params.uid);

  return {
    retailer: retailerRecord,
    distributor: targetDistributor,
    outlet: matchedOutlet,
    wasMatched: false,
  };
}

/**
 * Fetch retailer profile, linked distributor, and matched outlet
 */
export async function fetchRetailerProfile(uid: string): Promise<{
  retailer: Retailer;
  distributor: Distributor;
  outlet: Outlet;
} | null> {
  // 1. Check local storage
  const savedProfile = localStorage.getItem(`sr_retailer_profile_${uid}`);
  if (savedProfile) {
    try {
      const retailer: Retailer = JSON.parse(savedProfile);
      // Fetch fresh distributor and outlet data from backend
      const [distRes, outletsRes] = await Promise.all([
        apiFetch('/api/distributor', {}, uid).catch(() => null),
        apiFetch('/api/outlets', {}, uid).catch(() => null),
      ]);

      let distributor: Distributor | null = null;
      let outlet: Outlet | null = null;

      if (distRes && distRes.ok) {
        const distJson = await distRes.json();
        if (distJson.success) distributor = distJson.data;
      }
      if (outletsRes && outletsRes.ok) {
        const outJson = await outletsRes.json();
        if (outJson.success && Array.isArray(outJson.data)) {
          outlet = outJson.data.find((o: Outlet) => o.id === retailer.outlet_id) || null;
        }
      }

      if (distributor && outlet) {
        return { retailer, distributor, outlet };
      }
    } catch (e) {}
  }

  // 2. Fetch from backend API
  try {
    const res = await apiFetch(`/api/retailers/${uid}`, {}, uid);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (e) {}

  // 3. Check Firestore if live Firebase is configured
  if (isFirebaseConfigured) {
    try {
      let retailerDocRef = doc(db, 'retailers', uid);
      let retailerSnap = await withTimeout(getDoc(retailerDocRef), 2000);
      if (!retailerSnap.exists()) {
        const legacyDocId = `R_${uid.slice(0, 8)}`;
        retailerDocRef = doc(db, 'retailers', legacyDocId);
        retailerSnap = await withTimeout(getDoc(retailerDocRef), 2000);
      }
      if (retailerSnap.exists()) {
        const retailer = { id: retailerSnap.id, ...(retailerSnap.data() as Omit<Retailer, 'id'>) };
        const distRef = doc(db, 'distributors', retailer.linked_distributor_id);
        const distSnap = await withTimeout(getDoc(distRef), 2000);
        const distributor = distSnap.exists()
          ? { id: distSnap.id, ...(distSnap.data() as Omit<Distributor, 'id'>) }
          : null;

        const outletRef = doc(db, 'outlets', retailer.outlet_id);
        const outSnap = await withTimeout(getDoc(outletRef), 2000);
        const outlet = outSnap.exists()
          ? { id: outSnap.id, ...(outSnap.data() as Omit<Outlet, 'id'>) }
          : null;

        if (distributor && outlet) {
          return { retailer, distributor, outlet };
        }
      }
    } catch (err) {
      console.warn('Firestore fetch retailer error:', err);
    }
  }

  return null;
}

/**
 * Clear retailer session from local storage
 */
export function clearRetailerSession(uid?: string): void {
  try {
    if (uid) {
      localStorage.removeItem(`sr_retailer_profile_${uid}`);
    }
    localStorage.removeItem('sr_retailer_uid');
    localStorage.removeItem('sr_retailer_profile');
  } catch (err) {
    console.warn('Failed to clear retailer session:', err);
  }
}

/**
 * Place a retailer order (from Retailer Portal)
 */
export async function placeRetailerOrder(params: {
  outlet_id: string;
  product_id: string;
  quantity: number;
  date?: string;
  distributor_id?: string;
  outlet_name?: string;
  product_name?: string;
}): Promise<Order> {
  const newOrderId = `ORD_RET_${Date.now().toString().slice(-6)}`;
  const orderDate = params.date || new Date().toISOString().split('T')[0];

  const orderDoc: Order = {
    id: newOrderId,
    distributor_id: params.distributor_id || 'D1',
    outlet_id: params.outlet_id,
    outlet_name: params.outlet_name,
    product_id: params.product_id,
    product_name: params.product_name,
    date: orderDate,
    quantity: params.quantity,
    source: 'retailer',
    placed_by: 'retailer',
  };

  // 1. Sync to Backend API first
  try {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outlet_id: params.outlet_id,
        product_id: params.product_id,
        quantity: params.quantity,
        date: orderDate,
        source: 'retailer',
        placed_by: 'retailer',
      }),
    }, params.distributor_id);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || `Failed to submit order (Status ${res.status})`);
    }
    if (json.data?.order) {
      // Sync to Firestore in background if configured
      if (isFirebaseConfigured) {
        const orderDocRef = doc(db, 'orders', json.data.order.id);
        setDoc(orderDocRef, json.data.order).catch(() => {});
      }
      return json.data.order;
    }
  } catch (err: any) {
    console.warn('Backend order placement sync error:', err);
    if (err?.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
  }

  // 2. Save to Firestore if configured
  if (isFirebaseConfigured) {
    try {
      const orderDocRef = doc(db, 'orders', newOrderId);
      await withTimeout(setDoc(orderDocRef, orderDoc), 2500);
    } catch (err) {
      console.warn('Firestore retailer order write error:', err);
    }
  }

  return orderDoc;
}

/**
 * Fetch nudges from Firestore or backend
 */
export async function fetchNudgesFromDb(params?: {
  distributorId?: string;
  outletId?: string;
  todayOnly?: boolean;
}): Promise<NudgeRecord[]> {
  const queryParams = new URLSearchParams();
  if (params?.outletId) queryParams.append('outlet_id', params.outletId);
  if (params?.todayOnly) queryParams.append('today_only', 'true');

  try {
    const res = await apiFetch(`/api/nudges?${queryParams.toString()}`, {}, params?.distributorId);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (err) {
    console.warn('Backend fetch nudges warning:', err);
  }

  // Fallback to Firestore if configured
  if (isFirebaseConfigured) {
    try {
      const nudgesCol = collection(db, 'nudges');
      let q = query(nudgesCol);
      if (params?.distributorId) {
        q = query(nudgesCol, where('distributor_id', '==', params.distributorId));
      }
      const snap = await withTimeout(getDocs(q), 2000);
      if (!snap.empty) {
        let list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<NudgeRecord, 'id'>) }));
        if (params?.outletId) {
          list = list.filter(n => n.outlet_id === params.outletId);
        }
        return list;
      }
    } catch (err) {
      console.warn('Firestore fetch nudges warning:', err);
    }
  }

  return [];
}

/**
 * Mark a nudge as read
 */
export async function markNudgeReadInDb(nudgeId: string): Promise<void> {
  // Sync to Backend
  try {
    await apiFetch(`/api/nudges/${nudgeId}/read`, {
      method: 'PATCH',
    });
  } catch (err) {
    console.warn('Backend mark nudge read warning:', err);
  }

  // Sync to Firestore
  if (isFirebaseConfigured) {
    try {
      const docRef = doc(db, 'nudges', nudgeId);
      await withTimeout(
        setDoc(docRef, { read: true, read_at: new Date().toISOString() }, { merge: true }),
        2000
      );
    } catch (err) {
      console.warn('Firestore mark nudge read warning:', err);
    }
  }
}

/**
 * Cancel an order the distributor placed on a retailer's behalf. Server-side
 * enforces that only the linked retailer may do this, and only for orders
 * placed by the distributor (not the retailer's own confirmed orders) — this
 * calls the API only (no direct Firestore fallback), since the eligibility
 * check lives in the API layer, not in firestore.rules.
 */
export async function cancelOrderInDb(orderId: string, distributorId?: string): Promise<void> {
  const res = await apiFetch(`/api/orders/${orderId}/cancel`, { method: 'POST' }, distributorId);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Failed to cancel order (Status ${res.status})`);
  }
}

/**
 * Save a nudge record to Firestore and backend
 */
export async function createNudgeInDb(nudge: {
  outlet_id: string;
  product_id: string;
  outlet_name?: string;
  product_name?: string;
  phone?: string;
  date?: string;
  status?: string;
  message?: string;
  note?: string;
}): Promise<NudgeRecord | null> {
  try {
    const res = await apiFetch('/api/nudges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nudge),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const created: NudgeRecord = json.data;
      if (isFirebaseConfigured) {
        try {
          const docRef = doc(db, 'nudges', created.id);
          withTimeout(setDoc(docRef, created), 2000).catch(() => {});
        } catch (e) {}
      }
      return created;
    }
  } catch (err) {
    console.warn('Backend create nudge warning:', err);
  }
  return null;
}

/**
 * Save candidate order lines confirmed by the distributor from photo import
 */
export async function saveImportedOrders(
  lines: Array<{
    outlet_id: string;
    product_id: string;
    quantity: number;
    date: string;
    outlet_name?: string;
    product_name?: string;
  }>,
  distributorId?: string
): Promise<Order[]> {
  const createdOrders: Order[] = [];
  const effectiveDistributorId = distributorId || getStoredUser()?.uid || '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const newOrderId = `ORD_PHOTO_${Date.now().toString().slice(-6)}_${i}_${Math.random().toString(36).slice(2, 5)}`;
    const orderDoc: Order = {
      id: newOrderId,
      distributor_id: effectiveDistributorId,
      outlet_id: line.outlet_id,
      outlet_name: line.outlet_name,
      product_id: line.product_id,
      product_name: line.product_name,
      date: line.date,
      quantity: line.quantity,
      source: 'ocr_import',
      placed_by: 'distributor',
    };
    createdOrders.push(orderDoc);
  }

  // 1. Sync to Express backend server
  try {
    const res = await apiFetch('/api/orders/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
    }, distributorId);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || `Failed to save imported orders (Status ${res.status})`);
    }
    if (json.data?.createdOrders) {
      // Background sync to Firestore if configured
      if (isFirebaseConfigured) {
        for (const ord of json.data.createdOrders) {
          const docRef = doc(db, 'orders', ord.id);
          setDoc(docRef, ord, { merge: true }).catch(() => {});
        }
      }
      return json.data.createdOrders;
    }
  } catch (err: any) {
    console.warn('Backend sync bulk create order error:', err);
    if (err?.message && !err.message.includes('Failed to fetch')) {
      throw err;
    }
  }

  // 2. Firestore write if live Firebase is configured
  if (isFirebaseConfigured) {
    for (const ord of createdOrders) {
      try {
        const docRef = doc(db, 'orders', `${distributorId}_${ord.id}`);
        await withTimeout(setDoc(docRef, ord, { merge: true }), 1500);
      } catch (e) {
        console.warn('Firestore write order doc error:', e);
      }
    }
  }

  return createdOrders;
}
