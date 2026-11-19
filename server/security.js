import helmet from 'helmet';
import { HttpError } from './http.js';

/**
 * Security headers. The CSP allows scripts only from this origin; the browser
 * talks to Firebase Auth (identitytoolkit / securetoken) and this API.
 */
/** @param {{ extraConnectSrc?: string[] }} [options] */
export function securityHeaders({ extraConnectSrc = [] } = {}) {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        // blob: for present photos, which the browser fetches with its sign-in token.
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: [
          "'self'",
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          ...extraConnectSrc,
        ],
        frameSrc: ["'self'", 'https://*.firebaseapp.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
  });
}

/** Image types a photo upload may declare (the server checks the bytes too). */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_UPLOAD = /^\/presents\/[^/]+\/photos\/[a-z]+$/;

/**
 * For writes: the Origin header, when present, must be one of ours, and the
 * body must be JSON, except an image on a photo upload route. Ported from
 * rosemont-club lib/origin.ts.
 *
 * @param {string[]} allowedOrigins
 * @returns {import('express').RequestHandler}
 */
export function requireSameOriginJson(allowedOrigins) {
  const allowed = new Set(allowedOrigins.map((origin) => new URL(origin).origin));
  return (req, _res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const origin = req.get('origin');
    if (origin && !allowed.has(origin)) throw new HttpError(403, 'This request came from another site.');
    const hasBody = Number(req.get('content-length') ?? 0) > 0 || req.get('transfer-encoding');
    const photoUpload = req.method === 'PUT' && PHOTO_UPLOAD.test(req.path) && req.is(PHOTO_TYPES);
    if (hasBody && !req.is('application/json') && !photoUpload) throw new HttpError(415, 'Send JSON.');
    next();
  };
}
