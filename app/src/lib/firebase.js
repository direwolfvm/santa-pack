import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, connectAuthEmulator, initializeAuth } from 'firebase/auth';

/**
 * @typedef {{ apiKey: string, authDomain: string, projectId: string, tenantId: string, authEmulatorUrl?: string }} WebConfig
 */

/** @type {Promise<import('firebase/auth').Auth> | undefined} */
let authPromise;

/**
 * Firebase Auth for this tenant. The public web config comes from the server
 * (/api/config, as rosemont-club does), so one build works in every
 * environment.
 */
export function getFirebaseAuth() {
  authPromise ??= fetch('/api/config')
    .then((response) => {
      if (!response.ok) throw new Error('Could not load sign-in settings.');
      return /** @type {Promise<WebConfig>} */ (response.json());
    })
    .then((config) => {
      const app = initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId });
      // Email and password only, so no popup/redirect resolver (and no iframe).
      const auth = initializeAuth(app, { persistence: browserLocalPersistence });
      auth.tenantId = config.tenantId;
      if (config.authEmulatorUrl) connectAuthEmulator(auth, config.authEmulatorUrl, { disableWarnings: true });
      return auth;
    });
  return authPromise;
}

/**
 * The signed-in user once Firebase has restored the session, or null.
 * @returns {Promise<import('firebase/auth').User | null>}
 */
export async function currentFirebaseUser() {
  const auth = await getFirebaseAuth();
  await auth.authStateReady();
  return auth.currentUser;
}
