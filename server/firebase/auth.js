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
  /**
   * The verified Firebase ID token in the Authorization header. Used directly
   * only where an unconfirmed email is fine (asking for the confirmation email).
   * @param {import('express').Request} req
   */
  async function verifiedToken(req) {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Please sign in.');
    try {
      return await auth.verifyIdToken(token, true);
    } catch (error) {
      // Log why (never the token) so a misconfiguration is visible in Cloud Run logs.
      console.warn(
        'ID token rejected:',
        /** @type {{ code?: string }} */ (error)?.code ?? 'unknown',
        String(/** @type {Error} */ (error)?.message ?? '').slice(0, 200),
      );
      throw new HttpError(401, 'Please sign in again.');
    }
  }

  /** @param {import('express').Request} req @param {import('express').Response} res @param {import('express').NextFunction} next */
  async function requireUser(req, res, next) {
    const decoded = await verifiedToken(req);
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

  return { verifiedToken, requireUser, requireAdmin };
}

/**
 * The signed-in user for this request (set by requireUser).
 * @param {import('express').Response} res
 * @returns {import('./store.js').User}
 */
export function currentUser(res) {
  return res.locals.user;
}
