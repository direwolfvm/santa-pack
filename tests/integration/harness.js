// Shared setup for tests that run against the Firebase Auth and Firestore
// emulators. Run them with `npm run test:integration`, which starts the
// emulators and sets FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import request from 'supertest';
import { connectFirebase } from '../../server/firebase/admin.js';
import createFirebaseApp from '../../server/firebase/app.js';
import { createSigninMail } from '../../server/firebase/signin-mail.js';
import { createStore } from '../../server/firebase/store.js';

export const PROJECT_ID = 'demo-santa-pack';
export const DATABASE_ID = 'santa-pack';
export const BASE_URL = 'https://santapack.test';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run integration tests with `npm run test:integration` so the emulators are running.');
}

/** Start an app wired to a fresh tenant, so test files don't share users. */
export async function startHarness() {
  const bootstrap = initializeApp({ projectId: PROJECT_ID }, `bootstrap-${randomUUID()}`);
  const tenant = await getAuth(bootstrap)
    .tenantManager()
    .createTenant({ displayName: 'santa-test', emailSignInConfig: { enabled: true, passwordRequired: true } });

  const { db, auth } = connectFirebase({ projectId: PROJECT_ID, databaseId: DATABASE_ID, tenantId: tenant.tenantId });
  const store = createStore(db);
  // Sign-in emails are captured here instead of sent.
  /** @type {import('../../server/firebase/mail.js').Message[]} */
  const outbox = [];
  const mail = createSigninMail({
    auth,
    send: async (message) => {
      outbox.push(message);
    },
    baseUrl: BASE_URL,
  });
  const app = createFirebaseApp({
    mail,
    store,
    auth,
    webConfig: { apiKey: 'fake', authDomain: 'localhost', projectId: PROJECT_ID, tenantId: tenant.tenantId },
    allowedOrigins: [BASE_URL],
  });

  /**
   * Create an account and sign in through the Auth emulator's REST API.
   * @param {string} label
   * @param {{ verified?: boolean, role?: 'user' | 'admin' }} [options]
   */
  async function signUp(label, { verified = true, role = 'user' } = {}) {
    const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
    const password = 'very-merry-password';
    const account = await auth.createUser({ email, password, emailVerified: verified, displayName: label });
    const token = await signIn(email, password);
    if (verified) {
      // Create the user record the way the first API call would, then set the role.
      await request(app).get('/api/me').set('Authorization', `Bearer ${token}`).expect(200);
      if (role === 'admin') await db.collection('users').doc(account.uid).update({ role: 'admin' });
    }
    return { uid: account.uid, email, token };
  }

  /** @param {string} email @param {string} password */
  async function signIn(email, password) {
    const response = await fetch(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantId: tenant.tenantId, returnSecureToken: true }),
      },
    );
    const body = await response.json();
    if (!response.ok) throw new Error(`Emulator sign-in failed: ${JSON.stringify(body)}`);
    return /** @type {string} */ (body.idToken);
  }

  /**
   * A supertest client acting as a user.
   * @param {{ token: string } | null} user
   */
  function as(user) {
    const agent = request(app);
    /** @param {import('supertest').Test} req */
    const withAuth = (req) => (user ? req.set('Authorization', `Bearer ${user.token}`) : req);
    return {
      /** @param {string} path */
      get: (path) => withAuth(agent.get(path)),
      /** @param {string} path @param {object} [body] */
      post: (path, body) => withAuth(agent.post(path)).send(body ?? {}),
      /** @param {string} path @param {object} body */
      patch: (path, body) => withAuth(agent.patch(path)).send(body),
      /** @param {string} path @param {object} body */
      put: (path, body) => withAuth(agent.put(path)).send(body),
      /** @param {string} path */
      delete: (path) => withAuth(agent.delete(path)),
    };
  }

  return { app, db, auth, store, outbox, tenantId: tenant.tenantId, signUp, signIn, as };
}
