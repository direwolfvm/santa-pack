import '../styles.css';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { h, param, replace, safeNextPath } from '../lib/dom.js';
import { currentFirebaseUser, getFirebaseAuth } from '../lib/firebase.js';
import { renderShell } from '../lib/shell.js';
import { announce, withBusy } from '../lib/ui.js';

const shell = renderShell({
  variant: 'login',
  eyebrow: 'One more step',
  title: 'Check your inbox',
  subtitle: 'We sent you a link to confirm your email address. Open it, then come back here.',
});
const next = safeNextPath(param('next'));
const user = await currentFirebaseUser();
if (!user) {
  window.location.replace('/login.html');
} else if (user.emailVerified) {
  window.location.replace(next);
} else {
  const done = h('button', { type: 'button' }, 'I’ve confirmed my email');
  done.addEventListener('click', () =>
    withBusy(done, async () => {
      await user.reload();
      if (!user.emailVerified) {
        announce('Not confirmed yet. Open the link in the email, then try again.', 'error');
        return;
      }
      // Fetch a fresh token so the server sees email_verified = true.
      await user.getIdToken(true);
      window.location.assign(next);
    }),
  );
  const resend = h('button', { type: 'button', class: 'secondary' }, 'Send the email again');
  resend.addEventListener('click', () =>
    withBusy(resend, async () => {
      await sendEmailVerification(user);
      announce('Sent. It can take a minute or two to arrive.');
    }),
  );
  const other = h('button', { type: 'button', class: 'secondary' }, 'Use a different account');
  other.addEventListener('click', async () => {
    await signOut(await getFirebaseAuth());
    window.location.assign('/login.html');
  });
  replace(
    shell.body,
    h('p', null, 'We sent the link to ', h('strong', null, user.email ?? 'your email'), '.'),
    h('div', { class: 'stage-controls' }, done, resend, other),
  );
}
