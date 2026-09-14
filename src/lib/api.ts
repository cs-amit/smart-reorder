import { getIdToken } from './authService';

/**
 * fetch() wrapper that identifies the caller to the backend via a verified
 * Firebase ID token, so the server can scope data to the right
 * distributor/retailer (the server never trusts a client-claimed identity).
 *
 * The optional third argument appends a `preview_uid` query param, used only
 * by the demo distributor account to preview the linked demo retailer's view —
 * the server ignores it for any other caller.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  previewUid?: string
): Promise<Response> {
  const token = await getIdToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let finalPath = path;
  if (previewUid) {
    const sep = path.includes('?') ? '&' : '?';
    finalPath = `${path}${sep}preview_uid=${encodeURIComponent(previewUid)}`;
  }

  return fetch(finalPath, { ...options, headers });
}
