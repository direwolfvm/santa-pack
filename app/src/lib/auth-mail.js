import { sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseAuth, getWebConfig } from './firebase.js';

// The sign-in emails. When the server sends its own (Mailgun, from Santa Pack,
// linking to /action.html), ask it; otherwise fall back to Google's.

/** @param {string} path @param {Record<string, string>} headers @param {unknown} [body] */
async function post(path, headers, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? 'Something went wrong. Please try again.');
  }
}

/** @param {string} email */
export async function requestPasswordReset(email) {
  const [config, auth] = await Promise.all([getWebConfig(), getFirebaseAuth()]);
  if (config.ownMail) await post('/api/auth/reset', {}, { email });
  else await sendPasswordResetEmail(auth, email);
}

/** @param {import('firebase/auth').User} user */
export async function requestVerification(user) {
  const config = await getWebConfig();
  if (config.ownMail) await post('/api/auth/verify', { Authorization: `Bearer ${await user.getIdToken()}` });
  else await sendEmailVerification(user);
}
