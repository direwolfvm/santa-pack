import '../styles.css';
import { api } from '../lib/api.js';
import { h, replace } from '../lib/dom.js';
import { renderShell, requireSignedIn, showPageError } from '../lib/shell.js';
import { announce, confirmDialog, emptyState, onSubmit, table, withBusy } from '../lib/ui.js';

/**
 * @typedef {{ uid: string, email: string, displayName: string, role: 'user' | 'admin', disabled: boolean }} AdminUser
 * @typedef {{ id: string, name: string, joinCode: string, members: number, pending: number, rounds: number }} AdminFamily
 */

const shell = renderShell({
  eyebrow: 'North Pole control room',
  title: 'Admin',
  subtitle: 'Families, accounts and roles across Santa Pack.',
});

/** @type {string} */
let myUid;

/**
 * @param {string} label @param {() => Promise<unknown>} action
 * @param {{ confirm?: string, secondary?: boolean }} [options]
 */
function actionButton(label, action, { confirm, secondary = true } = {}) {
  const button = h('button', { type: 'button', class: secondary ? 'secondary button--small' : 'button--small' }, label);
  button.addEventListener('click', () =>
    withBusy(button, async () => {
      if (confirm && !(await confirmDialog(confirm, { confirmLabel: label, danger: true }))) return;
      await action();
      await load();
    }),
  );
  return button;
}

async function load() {
  /** @type {[AdminUser[], AdminFamily[]]} */
  const [users, families] = await Promise.all([api('/api/admin/users'), api('/api/admin/families')]);

  const familyRows = families.map((f) =>
    h(
      'tr',
      null,
      h('td', null, h('a', { href: `/family.html?id=${encodeURIComponent(f.id)}` }, f.name)),
      h('td', null, h('span', { class: 'join-code' }, f.joinCode)),
      h('td', null, `${f.members} (${f.pending} waiting)`),
      h('td', null, String(f.rounds)),
      h(
        'td',
        null,
        actionButton('Delete', () => api(`/api/families/${encodeURIComponent(f.id)}`, { method: 'DELETE' }), {
          confirm: `Delete ${f.name}, with all its rounds and gifts? This can’t be undone.`,
        }),
      ),
    ),
  );

  const userRows = users.map((u) =>
    h(
      'tr',
      null,
      h('td', null, u.displayName),
      h('td', null, u.email),
      h('td', null, u.role === 'admin' ? 'Admin' : 'User'),
      h('td', null, u.disabled ? 'Turned off' : 'Active'),
      h(
        'td',
        null,
        u.uid === myUid
          ? h('span', { class: 'muted' }, 'You')
          : [
              actionButton(u.role === 'admin' ? 'Remove admin' : 'Make admin', () =>
                api(`/api/admin/users/${encodeURIComponent(u.uid)}`, {
                  method: 'PATCH',
                  body: { role: u.role === 'admin' ? 'user' : 'admin' },
                }),
              ),
              actionButton(u.disabled ? 'Turn on' : 'Turn off', () =>
                api(`/api/admin/users/${encodeURIComponent(u.uid)}`, {
                  method: 'PATCH',
                  body: { disabled: !u.disabled },
                }),
              ),
            ],
      ),
    ),
  );

  const createForm = h(
    'form',
    { class: 'inline-form', id: 'familyForm' },
    h(
      'label',
      { for: 'familyName' },
      'Family name',
      h('input', { id: 'familyName', name: 'name', maxlength: 120, required: true }),
    ),
    h('button', { type: 'submit' }, 'Create family'),
  );
  onSubmit(createForm, async ({ name }) => {
    /** @type {AdminFamily} */
    const family = await api('/api/families', { method: 'POST', body: { name } });
    announce(`${family.name} created. Join code: ${family.joinCode}`);
    await load();
  });

  const addForm = h(
    'form',
    { class: 'inline-form', id: 'addMemberForm' },
    h(
      'label',
      { for: 'addFamily' },
      'Family',
      h(
        'select',
        { id: 'addFamily', name: 'familyId', required: true },
        families.map((f) => h('option', { value: f.id }, f.name)),
      ),
    ),
    h(
      'label',
      { for: 'addUser' },
      'Person',
      h(
        'select',
        { id: 'addUser', name: 'uid', required: true },
        users.map((u) => h('option', { value: u.uid }, `${u.displayName} (${u.email})`)),
      ),
    ),
    h(
      'label',
      { for: 'addRole' },
      'Role',
      h(
        'select',
        { id: 'addRole', name: 'familyRole' },
        h('option', { value: 'member' }, 'Member'),
        h('option', { value: 'manager' }, 'Manager'),
      ),
    ),
    h('button', { type: 'submit' }, 'Add to family'),
  );
  onSubmit(addForm, async ({ familyId, uid, familyRole }) => {
    await api(`/api/admin/families/${encodeURIComponent(familyId)}/members`, {
      method: 'POST',
      body: { uid, familyRole },
    });
    announce('Added.');
    await load();
  });

  replace(
    shell.body,
    h(
      'section',
      { 'aria-labelledby': 'families-heading' },
      h('h2', { id: 'families-heading' }, 'Families'),
      familyRows.length
        ? table(['Family', 'Join code', 'Members', 'Rounds', 'Actions'], familyRows, 'Families')
        : emptyState('No families yet.'),
      h('div', { class: 'panel' }, h('h3', null, 'New family'), createForm),
      families.length && users.length
        ? h('div', { class: 'panel' }, h('h3', null, 'Add someone directly'), addForm)
        : null,
    ),
    h(
      'section',
      { 'aria-labelledby': 'users-heading' },
      h('h2', { id: 'users-heading' }, 'Accounts'),
      table(['Name', 'Email', 'Role', 'Status', 'Actions'], userRows, 'Accounts'),
    ),
  );
}

try {
  const me = await requireSignedIn(shell);
  if (me.user.role !== 'admin') {
    window.location.replace('/');
  } else {
    myUid = me.user.uid;
    await load();
  }
} catch (error) {
  showPageError(shell, error);
}
