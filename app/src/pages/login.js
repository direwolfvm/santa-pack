import '../styles.css';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { requestPasswordReset, requestVerification } from '../lib/auth-mail.js';
import { h, param, replace, safeNextPath } from '../lib/dom.js';
import { getFirebaseAuth } from '../lib/firebase.js';
import { renderShell } from '../lib/shell.js';
import { onSubmit } from '../lib/ui.js';

const shell = renderShell({
  variant: 'login',
  eyebrow: 'Welcome to Santa Pack',
  title: 'Santa Pack',
  subtitle: 'A cozy little home for family gift exchanges, suspicious packages, and very serious guessing.',
});
const next = safeNextPath(param('next'));

/** Friendly text for Firebase Auth error codes, without saying whether an account exists. @param {unknown} error */
function authMessage(error) {
  const code = /** @type {{ code?: string }} */ (error)?.code ?? '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) {
    return 'That email and password don’t match.';
  }
  if (code === 'auth/email-already-in-use') return 'That email already has an account. Try signing in instead.';
  if (code === 'auth/weak-password') return 'Choose a password of at least 8 characters.';
  if (code === 'auth/too-many-requests') return 'Too many tries. Please wait a few minutes and try again.';
  return 'Something went wrong. Please try again.';
}

/** @param {HTMLElement} status @param {() => Promise<void>} action */
async function attempt(status, action) {
  status.textContent = '';
  try {
    await action();
  } catch (error) {
    status.textContent = authMessage(error);
  }
}

const signInStatus = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
const signInForm = h(
  'form',
  { id: 'loginForm' },
  h('label', { for: 'email' }, 'Email'),
  h('input', { type: 'email', id: 'email', name: 'email', autocomplete: 'email', required: true }),
  h('label', { for: 'password' }, 'Password'),
  h('input', { type: 'password', id: 'password', name: 'password', autocomplete: 'current-password', required: true }),
  h('button', { type: 'submit' }, 'Unwrap my exchange'),
);
onSubmit(signInForm, ({ email, password }) =>
  attempt(signInStatus, async () => {
    const { user } = await signInWithEmailAndPassword(await getFirebaseAuth(), email, password);
    window.location.assign(user.emailVerified ? next : `/verify.html?next=${encodeURIComponent(next)}`);
  }),
);

const resetStatus = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
const resetForm = h(
  'form',
  { id: 'forgotPasswordForm' },
  h('label', { for: 'resetEmail' }, 'Account email'),
  h('input', { type: 'email', id: 'resetEmail', name: 'email', autocomplete: 'email', required: true }),
  h('button', { type: 'submit', class: 'secondary' }, 'Email me a reset link'),
);
onSubmit(resetForm, async ({ email }) => {
  resetStatus.textContent = '';
  // Same message whether or not the account exists. Only a rate limit is
  // worth reporting, and it doesn't reveal an account either.
  let message = 'If an account exists for that email, a reset link is on its way.';
  await requestPasswordReset(email).catch((/** @type {Error} */ error) => {
    if (error.message.startsWith('Too many')) message = 'Too many tries. Please wait a little and try again.';
  });
  resetStatus.textContent = message;
});

const signUpStatus = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
const signUpForm = h(
  'form',
  { id: 'signupForm' },
  h('label', { for: 'signupName' }, 'Your name'),
  h('input', { type: 'text', id: 'signupName', name: 'name', autocomplete: 'name', maxlength: 60, required: true }),
  h('label', { for: 'signupEmail' }, 'Email'),
  h('input', { type: 'email', id: 'signupEmail', name: 'email', autocomplete: 'email', required: true }),
  h('label', { for: 'signupPassword' }, 'Password'),
  h('input', {
    type: 'password',
    id: 'signupPassword',
    name: 'password',
    autocomplete: 'new-password',
    minlength: 8,
    required: true,
  }),
  h('button', { type: 'submit' }, 'Join the nice list'),
);
onSubmit(signUpForm, ({ name, email, password }) =>
  attempt(signUpStatus, async () => {
    const { user } = await createUserWithEmailAndPassword(await getFirebaseAuth(), email, password);
    await updateProfile(user, { displayName: name.trim() });
    // The verify page can send it again if this one fails.
    await requestVerification(user).catch(() => {});
    window.location.assign(`/verify.html?next=${encodeURIComponent(next)}`);
  }),
);

replace(
  shell.body,
  h('h2', null, 'Welcome back'),
  signInForm,
  signInStatus,
  h('details', { class: 'auth-recovery' }, h('summary', null, 'Forgot your password?'), resetForm, resetStatus),
  h('div', { class: 'auth-divider' }, 'New around here?'),
  h('h2', null, 'Create an account'),
  signUpForm,
  signUpStatus,
);
