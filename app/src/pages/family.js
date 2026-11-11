import '../styles.css';
import { api } from '../lib/api.js';
import { h, param, replace } from '../lib/dom.js';
import { renderShell, requireSignedIn, showPageError } from '../lib/shell.js';
import { announce, confirmDialog, emptyState, onSubmit, stageBadge, table, withBusy } from '../lib/ui.js';

/**
 * @typedef {{ uid: string, displayName: string, familyRole: 'member' | 'manager', guest?: boolean }} Member
 * @typedef {{ id: string, name: string, stage: 'giving' | 'guessing' | 'complete' }} Round
 * @typedef {{
 *   family: { id: string, name: string, joinCode?: string },
 *   me: { isManager: boolean },
 *   members: Member[],
 *   pending: Member[],
 *   rounds: Round[],
 * }} FamilyView
 */

const shell = renderShell({
  eyebrow: 'Exchange headquarters',
  title: 'Family',
  subtitle: 'Plan the giving, guessing, and grand reveal without spoiling the surprise.',
});
const familyId = param('id') ?? '';
const base = `/api/families/${encodeURIComponent(familyId)}`;
/** @type {string} */
let myUid = '';

/**
 * A button that runs an API call and reloads the page.
 * @param {string} label @param {() => Promise<unknown>} action @param {{ secondary?: boolean, confirm?: string }} [options]
 */
function actionButton(label, action, { secondary = false, confirm } = {}) {
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
  /** @type {FamilyView} */
  const view = await api(base);
  shell.title.textContent = view.family.name;
  document.title = `${view.family.name} · Santa Pack`;
  const { isManager } = view.me;

  const roundCards = view.rounds.map((round) =>
    h(
      'section',
      { class: 'round-card' },
      stageBadge(round.stage),
      h('h3', null, round.name),
      h(
        'div',
        { class: 'round-card__actions' },
        h(
          'a',
          { class: 'button', href: `/round.html?id=${encodeURIComponent(round.id)}` },
          round.stage === 'giving' ? 'Plan gifts' : round.stage === 'guessing' ? 'Make guesses' : 'See the reveal',
        ),
      ),
    ),
  );

  const memberRows = view.members.map((member) =>
    h(
      'tr',
      null,
      h('td', null, member.displayName),
      h(
        'td',
        null,
        member.guest ? 'No account (a manager plays for them)' : member.familyRole === 'manager' ? 'Manager' : 'Member',
      ),
      isManager
        ? h(
            'td',
            null,
            member.guest
              ? null
              : actionButton(
                  member.familyRole === 'manager' ? 'Make member' : 'Make manager',
                  () =>
                    api(`${base}/members/${encodeURIComponent(member.uid)}`, {
                      method: 'PATCH',
                      body: { familyRole: member.familyRole === 'manager' ? 'member' : 'manager' },
                    }),
                  { secondary: true },
                ),
            actionButton(
              'Remove',
              () => api(`${base}/members/${encodeURIComponent(member.uid)}`, { method: 'DELETE' }),
              { secondary: true, confirm: `Remove ${member.displayName} from ${view.family.name}?` },
            ),
          )
        : null,
    ),
  );

  const sections = [
    h(
      'section',
      { 'aria-labelledby': 'rounds-heading' },
      h('h2', { id: 'rounds-heading' }, 'Gift rounds'),
      roundCards.length
        ? h('div', { class: 'round-grid' }, roundCards)
        : emptyState(isManager ? 'No rounds yet. Start one below.' : 'No rounds yet. A family manager will start one.'),
    ),
    h(
      'section',
      { 'aria-labelledby': 'members-heading' },
      h('h2', { id: 'members-heading' }, 'Who’s playing'),
      table(isManager ? ['Name', 'Role', 'Actions'] : ['Name', 'Role'], memberRows, 'Family members'),
    ),
  ];

  if (isManager) {
    const pendingRows = view.pending.map((person) =>
      h(
        'tr',
        null,
        h('td', null, person.displayName),
        h(
          'td',
          null,
          actionButton('Let them in', () =>
            api(`${base}/members/${encodeURIComponent(person.uid)}/approve`, { method: 'POST' }),
          ),
          actionButton(
            'Decline',
            () => api(`${base}/members/${encodeURIComponent(person.uid)}`, { method: 'DELETE' }),
            { secondary: true },
          ),
        ),
      ),
    );
    const roundForm = h(
      'form',
      { class: 'inline-form', id: 'roundForm' },
      h(
        'label',
        { for: 'roundName' },
        'Round name',
        h('input', {
          id: 'roundName',
          name: 'name',
          maxlength: 120,
          required: true,
          placeholder: 'Christmas Eve 2026',
        }),
      ),
      h('button', { type: 'submit' }, 'Start round'),
    );
    const guestForm = h(
      'form',
      { class: 'inline-form', id: 'guestForm' },
      h(
        'label',
        { for: 'guestName' },
        'Name',
        h('input', { id: 'guestName', name: 'displayName', maxlength: 60, required: true, placeholder: 'Grandma' }),
      ),
      h('button', { type: 'submit', class: 'secondary' }, 'Add player'),
    );
    onSubmit(guestForm, async ({ displayName }) => {
      await api(`${base}/guests`, { method: 'POST', body: { displayName } });
      announce(`${displayName} is playing. Pick them under “Playing as” on a round page to play for them.`);
      await load();
    });
    onSubmit(roundForm, async ({ name }) => {
      /** @type {Round} */
      const round = await api(`${base}/rounds`, { method: 'POST', body: { name } });
      window.location.assign(`/round.html?id=${encodeURIComponent(round.id)}`);
    });
    sections.push(
      h(
        'section',
        { class: 'panel', 'aria-labelledby': 'manage-heading' },
        h('h2', { id: 'manage-heading' }, 'Elf desk'),
        h(
          'p',
          null,
          'Share this join code with your family: ',
          h('span', { class: 'join-code' }, view.family.joinCode ?? ''),
        ),
        h(
          'div',
          null,
          actionButton('New join code', () => api(`${base}/join-code`, { method: 'POST' }), {
            secondary: true,
            confirm: 'Make a new join code? The old one will stop working.',
          }),
        ),
        h('h3', null, 'Waiting to join'),
        pendingRows.length
          ? table(['Name', 'Actions'], pendingRows, 'Join requests')
          : emptyState('Nobody is waiting.'),
        h('h3', null, 'Add someone without an account'),
        h(
          'p',
          { class: 'muted' },
          'For little ones or anyone who won’t sign in. Managers give, guess and unwrap for them.',
        ),
        guestForm,
        h('h3', null, 'Start a new round'),
        roundForm,
      ),
    );
  }

  const leave = h('button', { type: 'button', class: 'secondary' }, 'Leave this family');
  leave.addEventListener('click', () =>
    withBusy(leave, async () => {
      if (!(await confirmDialog(`Leave ${view.family.name}?`, { confirmLabel: 'Leave', danger: true }))) return;
      await api(`${base}/members/${encodeURIComponent(myUid)}`, { method: 'DELETE' });
      announce('You left the family.');
      window.location.assign('/');
    }),
  );
  shell.footer.replaceChildren(h('p', { class: 'page-card__footer-note' }, 'Keep the clues mysterious.'), leave);
  replace(shell.body, ...sections);
}

try {
  myUid = (await requireSignedIn(shell)).user.uid;
  await load();
} catch (error) {
  showPageError(shell, error);
}
