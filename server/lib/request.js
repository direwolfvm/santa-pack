/**
 * Request helpers for the Supabase-backed API. Phase 2 of docs/overhaul-plan.md
 * replaces these with Firebase token middleware.
 *
 * Supabase clients are typed loosely (`any`) here because the tests pass small
 * hand-made doubles in their place.
 * @typedef {{ headers: { authorization?: string } }} RequestLike
 */

/** An error carrying the HTTP status to send back. */
export class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** @param {RequestLike} req @returns {string | null} */
function getBearerToken(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/** @param {any} supabase @param {RequestLike} req @returns {any} */
function getRequestDatabase(supabase, req) {
  const token = getBearerToken(req);
  return token && typeof supabase.forRequest === 'function' ? supabase.forRequest(token) : supabase;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {{ maxLength?: number }} [options]
 * @returns {string}
 */
function requireText(value, field, { maxLength = 120 } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${field} is required`);
  }
  if (value.trim().length > maxLength) {
    throw new HttpError(400, `${field} must be ${maxLength} characters or fewer`);
  }
  return value.trim();
}

/** @param {any} supabase @param {RequestLike} req */
async function getAuthenticatedUser(supabase, req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

/** @param {any} supabase @param {string} userId @returns {Promise<string | null>} */
async function getRole(supabase, userId) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role || null;
}

/**
 * @param {any} supabase
 * @param {string} userId
 * @param {string | null} role
 * @param {string | number | undefined} familyId
 */
async function canManageFamily(supabase, userId, role, familyId) {
  if (role === 'admin') return true;
  if (role !== 'manager' || !familyId) return false;
  const { data, error } = await supabase
    .from('person')
    .select('id')
    .eq('user_profile', userId)
    .eq('family', familyId)
    .maybeSingle();
  return !error && Boolean(data);
}

export { getBearerToken, getRequestDatabase, requireText, getAuthenticatedUser, getRole, canManageFamily };
