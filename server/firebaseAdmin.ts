import fs from 'fs';
import path from 'path';
import { initializeApp, cert, applicationDefault, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Three ways to authenticate, tried in order:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON — the full service account JSON as a
 *    string env var. Used on platforms like Vercel that aren't Google Cloud
 *    infrastructure, so there's no ambient credential to fall back on.
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH — a local key file (set via .env). Used
 *    for local development.
 * 3. Application Default Credentials — used automatically when running on
 *    actual Google Cloud infrastructure (Cloud Functions, Cloud Run, GCE),
 *    which attaches a service identity to the instance with no key file
 *    needed at all.
 */
function resolveCredential() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return cert(JSON.parse(inlineJson));
  }
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (explicitPath) {
    const resolved = path.resolve(process.cwd(), explicitPath);
    if (fs.existsSync(resolved)) {
      return cert(JSON.parse(fs.readFileSync(resolved, 'utf-8')));
    }
  }
  return applicationDefault();
}

const app = getApps().length
  ? getApp()
  : initializeApp({
      credential: resolveCredential(),
    });

export const db = getFirestore(app);
// Application data commonly has optional fields (upi_id, phone, location, etc.)
// that are `undefined` rather than omitted — ignore them instead of throwing.
db.settings({ ignoreUndefinedProperties: true });
export const adminAuth = getAuth(app);
export const FieldValue = AdminFieldValue;
