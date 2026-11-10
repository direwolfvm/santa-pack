import { currentFirebaseUser } from './firebase.js';

/** An API failure with the server's message (safe to show). */
export class ApiError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Call the Santa Pack API as the signed-in user.
 *
 * @template T
 * @param {string} path e.g. '/api/me'
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<T>}
 */
export async function api(path, { method = 'GET', body } = {}) {
  const user = await currentFirebaseUser();
  if (!user) {
    goToSignIn();
    throw new ApiError(401, 'Please sign in.');
  }
  /** @type {Record<string, string>} */
  const headers = { Authorization: `Bearer ${await user.getIdToken()}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return /** @type {T} */ (undefined);
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) goToSignIn();
  if (!response.ok) throw new ApiError(response.status, data.error ?? 'Something went wrong. Please try again.');
  return data;
}

export function goToSignIn() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/login.html?next=${encodeURIComponent(next)}`);
}
