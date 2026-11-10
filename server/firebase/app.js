import express from 'express';
import { fileURLToPath } from 'node:url';
import { errorHandler, noStore } from '../http.js';
import { requireSameOriginJson, securityHeaders } from '../security.js';
import { createApi } from './api.js';
import { createAuth } from './auth.js';

// The Vite build of app/ (npm run build).
const webRoot = fileURLToPath(new URL('../../dist', import.meta.url));

/**
 * The Firebase-backed app: Firebase Auth ID tokens, Firestore behind deny-all
 * rules, and every permission enforced here.
 *
 * @param {object} deps
 * @param {import('./store.js').Store} deps.store
 * @param {import('firebase-admin/auth').TenantAwareAuth} deps.auth
 * @param {{ apiKey: string, authDomain: string, projectId: string, tenantId: string }} deps.webConfig
 *   Public Firebase web config for the browser.
 * @param {string[]} deps.allowedOrigins Origins allowed to send writes.
 */
export default function createFirebaseApp({ store, auth, webConfig, allowedOrigins }) {
  const app = express();
  app.disable('x-powered-by');
  // Cloud Run puts one proxy in front of the app.
  app.set('trust proxy', 1);
  // Local development and e2e tests: let the browser SDK reach the Auth emulator.
  const authEmulatorUrl = process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`
    : undefined;
  app.use(securityHeaders({ extraConnectSrc: authEmulatorUrl ? [authEmulatorUrl] : [] }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/api/config', (_req, res) => {
    res.set('Cache-Control', 'no-cache').json(authEmulatorUrl ? { ...webConfig, authEmulatorUrl } : webConfig);
  });

  const { requireUser, requireAdmin } = createAuth({ auth, store });
  app.use(
    '/api',
    noStore,
    requireSameOriginJson(allowedOrigins),
    express.json({ limit: '80kb' }),
    createApi({ store, requireUser, requireAdmin }),
  );

  // Hashed asset files can be cached for a long time; pages must revalidate.
  app.use('/assets', express.static(`${webRoot}/assets`, { immutable: true, maxAge: '365d', fallthrough: false }));
  app.use(express.static(webRoot, { extensions: ['html'] }));
  app.use(errorHandler);
  return app;
}
