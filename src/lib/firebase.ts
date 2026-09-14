import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// In Google AI Studio, if Firebase is provisioned or config is injected, it uses process/meta envs
// We provide fallback dummy config so the Firebase SDK initializes without crashing even in sandbox/local mode
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemo-SmartReorderFMCGKey123',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'smart-reorder-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'smart-reorder-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'smart-reorder-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '732402122159',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:732402122159:web:demo12345',
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Check whether Firebase has a real production/cloud project provisioned (non-placeholder)
export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  !import.meta.env.VITE_FIREBASE_API_KEY.includes('Demo') &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID !== 'smart-reorder-demo'
);

/**
 * Wraps any asynchronous promise with a strict timeout so UI components
 * never remain stuck on an indefinite loading/spinning state.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 3000,
  timeoutMessage: string = 'Operation timed out. Please try again.'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

// Helper for generating short random invite codes (e.g., RE-8291, FMCG-472)
export function generateInviteCode(prefix: string = 'SR'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${randomPart}`;
}
