import '../styles.css';
import {
  applyActionCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { h, param, replace } from '../lib/dom.js';
import { currentFirebaseUser, getFirebaseAuth } from '../lib/firebase.js';
import { renderShell } from '../lib/shell.js';
import { onSubmit } from '../lib/ui.js';

// Where the links in Santa Pack's sign-in emails land (server/firebase/signin-mail.js):
// ?mode=resetPassword|verifyEmail&oobCode=<one-time code from Google's sign-in service>.

const shell = renderShell({ variant: 'login', eyebrow: 'Santa Pack', title: 'One moment…' });
const mode = param('mode') ?? '';
const code = param('oobCode') ?? '';
const auth = await getFirebaseAuth();

/** @param {string} title @param {string} subtitle @param {...Node} body */
function show(title, subtitle, ...body) {
  shell.title.textContent = title;
  shell.subtitle.textContent = subtitle;
  replace(shell.body, ...body);
}

function failed() {
  show(
    'This link no longer works',
    'It has expired or was already used.',
    h('p', null, 'Ask for a new one from the sign-in page.'),
    h('a', { class: 'button', href: '/login.html' }, 'Go to sign in'),
  );
}

async function resetPassword() {
  const email = await verifyPasswordResetCode(auth, code);
  const status = h('p', { class: 'form-status', role: 'status', 'aria-live': 'polite' });
  const form = h(
    'form',
    { id: 'newPasswordForm' },
    h('label', { for: 'newPassword' }, 'New password'),
    h('input', {
      type: 'password',
      id: 'newPassword',
      name: 'password',
      autocomplete: 'new-password',
      minlength: 8,
      required: true,
    }),
    h('button', { type: 'submit' }, 'Save and sign in'),
  );
  onSubmit(form, async ({ password }) => {
    status.textContent = '';
    try {
      await confirmPasswordReset(auth, code, password);
    } catch (error) {
      const failure = /** @type {{ code?: string }} */ (error)?.code ?? '';
      if (failure === 'auth/weak-password') status.textContent = 'Choose a password of at least 8 characters.';
      else failed();
      return;
    }
    await signInWithEmailAndPassword(auth, email, password).catch(() => {});
    window.location.assign('/');
  });
  show('Choose a new password', '', h('p', null, 'For ', h('strong', null, email), '.'), form, status);
}

async function verifyEmail() {
  await applyActionCode(auth, code);
  // If they're signed in here, refresh the token so the server sees the confirmation.
  const user = await currentFirebaseUser();
  if (user) {
    await user.reload();
    await user.getIdToken(true);
  }
  show(
    'Email confirmed',
    'Thank you. Your account is ready.',
    h('a', { class: 'button', href: user ? '/' : '/login.html' }, user ? 'Go to my families' : 'Sign in'),
  );
}

try {
  if (!code) failed();
  else if (mode === 'resetPassword') await resetPassword();
  else if (mode === 'verifyEmail') await verifyEmail();
  else failed();
} catch {
  failed();
}
