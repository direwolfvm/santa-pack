import helmet from 'helmet';
import { HttpError } from './http.js';

/**
 * Security headers. The CSP allows scripts only from this origin; the browser
 * talks to Firebase Auth (identitytoolkit / securetoken) and this API.
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'],
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

/**
 * For writes: the Origin header, when present, must be one of ours, and the
 * body must be JSON. Ported from rosemont-club lib/origin.ts.
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
    if (hasBody && !req.is('application/json')) throw new HttpError(415, 'Send JSON.');
    next();
  };
}
