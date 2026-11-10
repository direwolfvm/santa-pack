import '../styles.css';
import { sendPasswordResetEmail } from 'firebase/auth';
import { api } from '../lib/api.js';
import { h, replace } from '../lib/dom.js';
import { getFirebaseAuth } from '../lib/firebase.js';
import { renderShell, requireSignedIn, showPageError } from '../lib/shell.js';
import { announce, onSubmit, withBusy } from '../lib/ui.js';

const shell = renderShell({
  eyebrow: 'Your North Pole file',
  title: 'Your profile',
  subtitle: 'The name your family sees, and your sign-in details.',
});

try {
  const me = await requireSignedIn(shell);

  const nameForm = h(
    'form',
    { class: 'inline-form', id: 'nameForm' },
    h(
      'label',
      { for: 'displayName' },
      'Name your family sees',
      h('input', {
        id: 'displayName',
        name: 'displayName',
        maxlength: 60,
        required: true,
        autocomplete: 'name',
        value: me.user.displayName,
      }),
    ),
    h('button', { type: 'submit' }, 'Save name'),
  );
  onSubmit(nameForm, async ({ displayName }) => {
    await api('/api/me', { method: 'PATCH', body: { displayName } });
    announce('Name saved.');
  });

  const reset = h('button', { type: 'button', class: 'secondary' }, 'Email me a password reset link');
  reset.addEventListener('click', () =>
    withBusy(reset, async () => {
      await sendPasswordResetEmail(await getFirebaseAuth(), me.user.email);
      announce(`Sent to ${me.user.email}.`);
    }),
  );

  replace(
    shell.body,
    h('section', { class: 'panel' }, h('h2', null, 'Your name'), nameForm),
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Sign-in'),
      h('p', null, 'Signed in as ', h('strong', null, me.user.email), '.'),
      h('div', null, reset),
    ),
  );
} catch (error) {
  showPageError(shell, error);
}
