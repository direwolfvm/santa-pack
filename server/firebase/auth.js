import { HttpError } from '../http.js';

/**
 * Sign-in checks, ported from rosemont-club lib/auth.ts. The browser sends its
 * Firebase ID token as a Bearer token; we verify it (including revocation) and
 * load the user's record, which holds the role. Roles are re-read on every
 * request rather than cached in token claims.
 *
 * The signed-in user is stored on `res.locals.user`.
 *
 * @param {{ auth: import('firebase-admin/auth').TenantAwareAuth, store: import('./store.js').Store }} deps
 */
export function createAuth({ auth, store }) {
  /** @param {import('express').Request} req @param {import('express').Response} res @param {import('express').NextFunction} next */
  async function requireUser(req, res, next) {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Please sign in.');

    let decoded;
    try {
      decoded = await auth.verifyIdToken(token, true);
    } catch {
      throw new HttpError(401, 'Please sign in again.');
    }
    if (!decoded.email_verified) {
      throw new HttpError(403, 'Please verify your email address first. Check your inbox for the link.');
    }

    const user = await store.ensureUser(decoded);
    if (user.disabled) throw new HttpError(403, 'This account has been turned off.');
    res.locals.user = user;
    next();
  }

  /** @param {import('express').Request} _req @param {import('express').Response} res @param {import('express').NextFunction} next */
  function requireAdmin(_req, res, next) {
    if (currentUser(res).role !== 'admin') throw new HttpError(403, 'Only site administrators can do that.');
    next();
  }

  return { requireUser, requireAdmin };
}

/**
 * The signed-in user for this request (set by requireUser).
 * @param {import('express').Response} res
 * @returns {import('./store.js').User}
 */
export function currentUser(res) {
  return res.locals.user;
}
