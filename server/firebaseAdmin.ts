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
    try {
      return cert(JSON.parse(inlineJson));
    } catch (err) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON — check it was pasted ' +
        'in full and not double-escaped.'
      );
    }
  }
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (explicitPath) {
    const resolved = path.resolve(process.cwd(), explicitPath);
    if (fs.existsSync(resolved)) {
      return cert(JSON.parse(fs.readFileSync(resolved, 'utf-8')));
    }
  }
  try {
    return applicationDefault();
  } catch (err) {
    // On Vercel (not real GCP infra) there is no ambient credential, so this
    // is the expected failure mode for a deploy that's simply missing its
    // Firebase env var — surface a clear cause instead of the generic ADC
    // error, which doesn't say what to actually go set.
    throw new Error(
      'No Firebase Admin credential could be resolved. Set FIREBASE_SERVICE_ACCOUNT_JSON ' +
      '(the full service account key JSON, for Vercel/non-GCP hosting) or ' +
      'FIREBASE_SERVICE_ACCOUNT_PATH (a local key file path, for local dev). ' +
      `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
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
