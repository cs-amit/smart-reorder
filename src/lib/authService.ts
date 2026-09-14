import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';
import { AppUser, UserRole, Distributor, Retailer, Outlet } from '../types';

const STORAGE_KEY = 'sr_auth_user';

type AuthListener = (user: AppUser | null) => void;
const listeners: Set<AuthListener> = new Set();

let cachedUser: AppUser | null = null;
let firebaseReady = false;
let firebaseReadyResolvers: Array<() => void> = [];

// Initialize cached user from localStorage synchronously so the UI can paint
// instantly, before Firebase Auth has restored its own (async) session.
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    cachedUser = JSON.parse(raw);
  }
} catch (e) {
  console.warn('Failed to parse cached user:', e);
}

function notifyListeners(user: AppUser | null) {
  cachedUser = user;
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach(fn => fn(user));
}

export function subscribeToAuth(fn: AuthListener): () => void {
  listeners.add(fn);
  fn(cachedUser);
  return () => {
    listeners.delete(fn);
  };
}

export function getStoredUser(): AppUser | null {
  return cachedUser;
}

function waitForFirebaseReady(): Promise<void> {
  if (firebaseReady) return Promise.resolve();
  return new Promise(resolve => {
    firebaseReadyResolvers.push(resolve);
  });
}

/** Returns a fresh Firebase ID token for the signed-in user, or null if signed out. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  await waitForFirebaseReady();
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

async function refreshProfileFromBackend(): Promise<AppUser | null> {
  const token = await getIdToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      notifyListeners(data.user);
      return data.user;
    }
  } catch (err) {
    console.warn('Failed to refresh profile from backend:', err);
  }
  return null;
}

// Keep our cached profile in sync with real Firebase Auth session state
// (covers login/logout from elsewhere, and expired/invalid sessions).
onAuthStateChanged(auth, async fbUser => {
  const wasReady = firebaseReady;
  firebaseReady = true;
  firebaseReadyResolvers.forEach(resolve => resolve());
  firebaseReadyResolvers = [];

  if (!fbUser) {
    if (cachedUser) notifyListeners(null);
    return;
  }
  try {
    await refreshProfileFromBackend();
  } catch (err) {
    console.warn('Auth state sync warning:', err);
  }
});

/**
 * Register a new user with email, password, and chosen role (distributor or retailer).
 * Firebase Auth is the real identity provider; the backend only creates the
 * Firestore profile once it has verified the resulting ID token.
 */
export async function registerUser(params: {
  email: string;
  password: string;
  role: UserRole;
  name?: string;
}): Promise<{
  user: AppUser;
  distributor?: Distributor;
  retailer?: Retailer;
}> {
  const cleanEmail = params.email.trim().toLowerCase();

  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
  } catch (fbErr: any) {
    if (fbErr.code === 'auth/email-already-in-use') {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    if (fbErr.code === 'auth/weak-password') {
      throw new Error('Password should be at least 6 characters.');
    }
    if (fbErr.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    }
    throw new Error(fbErr.message || 'Failed to create account. Please try again.');
  }

  const token = await userCredential.user.getIdToken();
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role: params.role, name: params.name?.trim() }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to create account. Please try again.');
  }

  notifyListeners(data.user);
  return { user: data.user, distributor: data.distributor, retailer: data.retailer };
}

/**
 * Sign in an existing user with email and password.
 * Restores user profile, role, and existing business data.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{
  user: AppUser;
  distributor?: Distributor;
  retailer?: Retailer;
  outlet?: Outlet;
}> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (fbErr: any) {
    if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
      throw new Error('Incorrect password. Please try again.');
    }
    if (fbErr.code === 'auth/user-not-found') {
      throw new Error('No account found with this email. Please sign up.');
    }
    if (fbErr.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please wait a moment and try again.');
    }
    throw new Error(fbErr.message || 'Sign in failed. Please try again.');
  }

  const token = await getIdToken();
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Sign in failed. Please try again.');
  }

  notifyListeners(data.user);
  return { user: data.user, distributor: data.distributor, retailer: data.retailer, outlet: data.outlet };
}

/**
 * Sign out the current user and clear local session state
 */
export async function logoutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.warn('Firebase sign out warning:', err);
  }
  notifyListeners(null);
}

export async function loginAsDemo(role: 'distributor' | 'retailer' = 'distributor') {
  if (role === 'retailer') {
    return loginUser('retailer@kirana.com', 'password123');
  }
  return loginUser('dist@fmcg.com', 'password123');
}

/**
 * Validate and refresh current session with the backend
 */
export async function fetchCurrentUser(): Promise<AppUser | null> {
  await waitForFirebaseReady();
  if (!auth.currentUser) return null;
  return refreshProfileFromBackend();
}
