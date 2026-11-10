import '../styles.css';
import { api } from '../lib/api.js';
import { h, replace } from '../lib/dom.js';
import { renderShell, requireSignedIn, showPageError } from '../lib/shell.js';
import { announce, emptyState, onSubmit } from '../lib/ui.js';

const shell = renderShell({
  eyebrow: 'The nice list starts here',
  title: 'Your families',
  subtitle: 'Keep every family exchange, mystery gift, and merry milestone in one place.',
});

try {
  const me = await requireSignedIn(shell);
  const members = me.families.filter((f) => f.status === 'member');
  const pending = me.families.filter((f) => f.status === 'pending');

  const cards = members.map((family) =>
    h(
      'section',
      { class: 'family-card' },
      h('h3', null, family.name),
      h(
        'div',
        { class: 'family-card__meta' },
        h('span', null, family.familyRole === 'manager' ? 'You manage this family' : 'Member'),
      ),
      h(
        'div',
        { class: 'family-card__actions' },
        h('a', { class: 'button', href: `/family.html?id=${encodeURIComponent(family.id)}` }, 'Open family'),
      ),
    ),
  );

  const joinForm = h(
    'form',
    { class: 'inline-form', id: 'joinForm' },
    h(
      'label',
      { for: 'joinCode' },
      'Join code',
      h('input', {
        id: 'joinCode',
        name: 'code',
        autocomplete: 'off',
        autocapitalize: 'characters',
        spellcheck: 'false',
        minlength: 8,
        maxlength: 8,
        required: true,
        placeholder: 'ABCD2345',
      }),
    ),
    h('button', { type: 'submit' }, 'Ask to join'),
  );
  onSubmit(joinForm, async ({ code }) => {
    /** @type {{ family: { name: string }, status: string }} */
    const result = await api('/api/families/join', { method: 'POST', body: { code } });
    announce(
      result.status === 'member'
        ? `You’re already in ${result.family.name}.`
        : `Request sent to ${result.family.name}. A family manager will let you in.`,
    );
    window.setTimeout(() => window.location.reload(), 1200);
  });

  replace(
    shell.body,
    me.user.displayName ? h('p', { class: 'intro' }, `Welcome back, ${me.user.displayName}!`) : null,
    cards.length
      ? h('div', { class: 'family-grid' }, cards)
      : emptyState('Your list is still blank. Ask a family manager for your family’s join code.'),
    pending.length
      ? h(
          'div',
          { class: 'status' },
          `Waiting for approval: ${pending.map((f) => f.name).join(', ')}. A family manager needs to let you in.`,
        )
      : null,
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Join a family'),
      h('p', { class: 'muted' }, 'Family managers can find the 8-character join code on their family page.'),
      joinForm,
    ),
  );
} catch (error) {
  showPageError(shell, error);
}
