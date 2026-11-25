import '../styles.css';
import { api } from '../lib/api.js';
import { h, param, replace } from '../lib/dom.js';
import { renderShell, requireSignedIn, showPageError } from '../lib/shell.js';
import { photoSlot, removePhoto, uploadPhoto } from '../lib/photos.js';
import { shapeName } from '../../../server/game/shapes.js';
import {
  announce,
  announceError,
  confirmDialog,
  emptyState,
  onSubmit,
  stageBadge,
  table,
  withBusy,
} from '../lib/ui.js';

/**
 * What the server sends. It decides which fields each person may see, so a
 * cloaked present simply has no name, description or giver.
 *
 * @typedef {'giving' | 'guessing' | 'complete'} Stage
 * @typedef {'gift' | 'wrapped' | 'unwrapped'} PhotoKind
 * @typedef {{ uid: string, displayName: string, guest?: boolean }} Member
 * @typedef {{
 *   id: string, receiverUid: string, cloakedName: string, guessUid: string | null, revealed: boolean,
 *   giverUid?: string, name?: string, description?: string, correct?: boolean | null,
 *   fromFramblywish?: boolean,
 *   photos?: Partial<Record<PhotoKind, string>>,
 * }} PresentView
 *   `photos` lists only the photos this person may see, with when each was added.
 * @typedef {{ uid: string, giving: number, receiving?: number, guessedRight?: number }} PersonProgress
 * @typedef {{ totals: { presents: number, guessed: number, revealed: number }, people: PersonProgress[] }} Progress
 * @typedef {{
 *   round: { id: string, familyId: string, familyName: string, name: string, stage: Stage },
 *   me: { uid: string, isManager: boolean, actingAsGuest: boolean },
 *   members: Member[],
 *   presents: PresentView[],
 *   progress: Progress,
 * }} RoundView
 */

const COPY = /** @type {Record<Stage, [string, string]>} */ ({
  giving: ['Santa’s secret ledger', 'Add a gift for someone, then cloak it with a mysterious name.'],
  guessing: ['The great gift guess-off', 'Lock in each guess before the wrapping paper comes off.'],
  complete: ['The grand reveal', 'See who knew their Santas best, and who fooled the whole room.'],
});

const shell = renderShell({ eyebrow: 'Gift round', title: 'Gift round' });
const roundId = param('id') ?? '';
const roundPath = `/api/rounds/${encodeURIComponent(roundId)}`;
// Managers can play for a family member without an account (?as=<guest id>).
const playingAs = param('as');
/** Add the "play as" choice to an API path. @param {string} path */
const asActor = (path) =>
  playingAs ? `${path}${path.includes('?') ? '&' : '?'}as=${encodeURIComponent(playingAs)}` : path;

/** @type {RoundView} */
let view;
/** @param {string | null | undefined} uid */
const nameOf = (uid) => view.members.find((m) => m.uid === uid)?.displayName ?? 'Someone';

const PHOTO_LABELS = /** @type {Record<PhotoKind, string>} */ ({
  gift: 'The gift',
  wrapped: 'Wrapped',
  unwrapped: 'Unwrapped',
});

/**
 * A row of a present's photos. Each slot shows the photo if this person may
 * see it, and offers to add or change it when `editable` (the server checks
 * again).
 *
 * @param {PresentView} present
 * @param {Array<[PhotoKind, { label?: string, hint?: string, editable?: boolean }]>} slots
 * @param {{ small?: boolean }} [options]
 */
function photoRow(present, slots, { small = false } = {}) {
  const figures = slots.map(([kind, { label, hint, editable }]) => {
    const path = asActor(`/api/presents/${encodeURIComponent(present.id)}/photos/${kind}`);
    return photoSlot({
      path,
      version: present.photos?.[kind],
      label: label ?? PHOTO_LABELS[kind],
      hint,
      editable,
      small,
      onChange: async (action) => {
        try {
          if ('upload' in action) {
            await uploadPhoto(path, action.upload);
            announce('Photo saved.');
          } else {
            if (!(await confirmDialog('Remove this photo?', { confirmLabel: 'Remove', danger: true }))) return;
            await removePhoto(path);
            announce('Photo removed.');
          }
          await load();
        } catch (error) {
          announceError(error);
        }
      },
    });
  });
  const shown = figures.filter((figure) => figure !== null);
  return shown.length ? h('div', { class: small ? 'photo-row photo-row--small' : 'photo-row' }, shown) : null;
}

async function load() {
  view = await api(asActor(roundPath));
  const { round, me } = view;
  const [eyebrow, subtitle] = COPY[round.stage];
  shell.title.textContent = round.name;
  shell.subtitle.textContent = subtitle;
  /** @type {HTMLElement} */ (document.querySelector('.page-eyebrow')).textContent = eyebrow;
  document.title = `${round.name} · Santa Pack`;

  /** @type {(HTMLElement | null)[]} */
  const sections = [
    h(
      'p',
      { class: 'stage-controls' },
      stageBadge(round.stage),
      h('a', { href: `/family.html?id=${encodeURIComponent(round.familyId)}` }, `Back to ${round.familyName}`),
    ),
  ];
  if (me.isManager) sections.push(playingAsPicker(), stageControls());
  if (round.stage === 'giving') sections.push(givingSection());
  if (round.stage === 'guessing') sections.push(guessingSection(), myGiftsSection());
  if (round.stage === 'complete') sections.push(revealSection());
  sections.push(progressSection());
  replace(shell.body, ...sections);
}

/** For managers: play as yourself or as a family member without an account. */
function playingAsPicker() {
  const guests = view.members.filter((m) => m.guest);
  if (!guests.length) return null;
  const select = h(
    'select',
    { id: 'playingAs' },
    h('option', { value: '' }, 'Myself'),
    guests.map((g) => h('option', { value: g.uid }, g.displayName)),
  );
  select.value = playingAs ?? '';
  select.addEventListener('change', () => {
    const url = new URL(window.location.href);
    if (select.value) url.searchParams.set('as', select.value);
    else url.searchParams.delete('as');
    window.location.assign(url);
  });
  return h(
    'section',
    { class: view.me.actingAsGuest ? 'panel status' : 'panel' },
    h('label', { for: 'playingAs' }, 'Playing as', select),
    view.me.actingAsGuest
      ? h('p', null, `You’re playing for ${nameOf(view.me.uid)}. You see only what they would see.`)
      : null,
  );
}

/** @param {Stage} stage @param {string} label @param {string} confirm */
function stageButton(stage, label, confirm) {
  const button = h('button', { type: 'button' }, label);
  button.addEventListener('click', () =>
    withBusy(button, async () => {
      if (!(await confirmDialog(confirm, { confirmLabel: label }))) return;
      await api(roundPath, { method: 'PATCH', body: { stage } });
      announce(`The round is now ${stage}.`);
      await load();
    }),
  );
  return button;
}

function stageControls() {
  const { stage } = view.round;
  const buttons = {
    giving: [stageButton('guessing', 'Start guessing', 'Start guessing? Givers can no longer change their gifts.')],
    guessing: [
      stageButton('complete', 'Reveal everything', 'Finish the round and reveal every gift to the whole family?'),
      stageButton('giving', 'Back to giving', 'Reopen giving so people can change their gifts?'),
    ],
    complete: [stageButton('guessing', 'Reopen guessing', 'Hide the results again and reopen guessing?')],
  }[stage];
  return h(
    'section',
    { class: 'panel', 'aria-labelledby': 'stage-heading' },
    h('h2', { id: 'stage-heading' }, 'Round controls'),
    h('p', { class: 'muted' }, 'As a manager you move the round along. You still can’t peek at anyone’s gifts.'),
    h('div', { class: 'stage-controls' }, buttons),
  );
}

// ---- giving ----

function givingSection() {
  const mine = view.presents.filter((p) => p.giverUid === view.me.uid);
  const others = view.members.filter((m) => m.uid !== view.me.uid);

  const cards = mine.map((present) => {
    const remove = h('button', { type: 'button', class: 'secondary button--small' }, 'Remove');
    remove.addEventListener('click', () =>
      withBusy(remove, async () => {
        if (!(await confirmDialog(`Remove “${present.name}”?`, { confirmLabel: 'Remove', danger: true }))) return;
        await api(asActor(`/api/presents/${encodeURIComponent(present.id)}`), { method: 'DELETE' });
        await load();
      }),
    );
    const edit = h('button', { type: 'button', class: 'secondary button--small' }, 'Edit');
    edit.addEventListener('click', () => {
      fillForm(present);
    });
    return h(
      'article',
      { class: 'present-card' },
      h('h3', null, present.name ?? ''),
      h('p', { class: 'muted' }, `For ${nameOf(present.receiverUid)}`),
      h('p', null, 'Cloaked as ', h('em', null, present.cloakedName || '(no cloaked name)')),
      present.fromFramblywish ? h('p', { class: 'muted' }, 'Brought over from Framblywish') : null,
      present.description ? h('p', { class: 'muted' }, present.description) : null,
      photoRow(present, [
        ['gift', { editable: true, hint: 'Only you see this until it’s unwrapped.' }],
        ['wrapped', { editable: true, hint: 'They’ll see this while guessing, so they know which one it is.' }],
      ]),
      h('div', { class: 'present-card__actions' }, edit, remove),
    );
  });

  const receiver = h(
    'select',
    { id: 'receiverUid', name: 'receiverUid', required: true },
    h('option', { value: '' }, 'Choose someone'),
    others.map((m) => h('option', { value: m.uid }, m.displayName)),
  );
  const editingId = h('input', { type: 'hidden', name: 'presentId', value: '' });
  const cloakInput = h('input', { id: 'cloakedName', name: 'cloakedName', maxlength: 120, value: shapeName() });
  const shuffle = h('button', { type: 'button', class: 'secondary button--small' }, 'Shuffle shapes');
  shuffle.addEventListener('click', () => {
    cloakInput.value = shapeName();
  });
  const submit = h('button', { type: 'submit' }, 'Wrap it up');
  const form = h(
    'form',
    { id: 'presentForm', class: 'inline-form' },
    editingId,
    h('label', { for: 'receiverUid' }, 'Who is it for?', receiver),
    h(
      'label',
      { for: 'presentName' },
      'The gift',
      h('input', { id: 'presentName', name: 'name', maxlength: 120, required: true }),
    ),
    h(
      'label',
      { for: 'cloakedName', class: 'cloak-field' },
      'Cloaked name (what they see while guessing)',
      h('span', { class: 'cloak-field__row' }, cloakInput, shuffle),
      h('span', { class: 'muted cloak-field__hint' }, 'Three random shapes. Shuffle them, or type your own.'),
    ),
    h(
      'label',
      { for: 'description' },
      'Notes (only you see these until the reveal)',
      h('textarea', { id: 'description', name: 'description', maxlength: 2000, rows: 2 }),
    ),
    submit,
  );

  /** @param {PresentView} present */
  function fillForm(present) {
    editingId.value = present.id;
    receiver.value = present.receiverUid;
    receiver.disabled = true;
    /** @type {HTMLInputElement} */ (form.elements.namedItem('name')).value = present.name ?? '';
    cloakInput.value = present.cloakedName || shapeName();
    /** @type {HTMLTextAreaElement} */ (form.elements.namedItem('description')).value = present.description ?? '';
    submit.textContent = 'Save changes';
    /** @type {HTMLInputElement} */ (form.elements.namedItem('name')).focus();
  }

  onSubmit(form, async ({ presentId, receiverUid, name, cloakedName, description }) => {
    if (presentId) {
      await api(asActor(`/api/presents/${encodeURIComponent(presentId)}`), {
        method: 'PATCH',
        body: { name, cloakedName, description },
      });
      announce('Gift updated.');
    } else {
      await api(asActor(`${roundPath}/presents`), {
        method: 'POST',
        body: { receiverUid, name, cloakedName, description },
      });
      announce(`Gift for ${nameOf(receiverUid)} is wrapped.`);
    }
    await load();
  });

  return h(
    'section',
    { 'aria-labelledby': 'giving-heading' },
    h('h2', { id: 'giving-heading' }, 'Your gifts'),
    cards.length ? h('div', { class: 'present-grid' }, cards) : emptyState('You haven’t added any gifts yet.'),
    h('div', { class: 'panel' }, h('h3', null, 'Add a gift'), form),
  );
}

// ---- guessing ----

function guessingSection() {
  const forMe = view.presents.filter((p) => p.receiverUid === view.me.uid);
  const suspects = view.members.filter((m) => m.uid !== view.me.uid);

  const cards = forMe.map((present) => {
    const card = h('article', { class: 'present-card' }, h('h3', null, present.cloakedName || 'A mystery package'));
    if (present.revealed) {
      card.append(
        photoRow(present, [
          ['gift', { label: `${nameOf(present.giverUid)}’s photo` }],
          ['wrapped', {}],
          ['unwrapped', { label: 'Your photo', editable: true }],
        ]) ?? '',
        h(
          'div',
          { class: 'present-card__reveal' },
          h('p', null, h('strong', null, present.name ?? ''), present.description ? ` — ${present.description}` : ''),
          h('p', null, `From ${nameOf(present.giverUid)}.`),
          h(
            'p',
            { class: present.correct ? 'result--correct' : 'result--wrong' },
            present.guessUid
              ? present.correct
                ? 'You guessed right!'
                : `You guessed ${nameOf(present.guessUid)}.`
              : 'You didn’t guess.',
          ),
        ),
      );
      return card;
    }

    const selectId = `guess-${present.id}`;
    const select = h(
      'select',
      { id: selectId, name: 'guessUid' },
      h('option', { value: '' }, 'No guess yet'),
      suspects.map((m) => h('option', { value: m.uid }, m.displayName)),
    );
    select.value = present.guessUid ?? '';
    const form = h(
      'form',
      { class: 'inline-form' },
      h('label', { for: selectId }, 'Who gave this?', select),
      h('button', { type: 'submit', class: 'secondary' }, 'Save guess'),
    );
    onSubmit(form, async ({ guessUid }) => {
      await api(asActor(`/api/presents/${encodeURIComponent(present.id)}/guess`), {
        method: 'PUT',
        body: { guessUid: guessUid || null },
      });
      announce(guessUid ? `Guess saved: ${nameOf(guessUid)}.` : 'Guess cleared.');
      await load();
    });

    const reveal = h('button', { type: 'button' }, 'Unwrap it');
    reveal.addEventListener('click', () =>
      withBusy(reveal, async () => {
        const warning = present.guessUid
          ? 'Unwrap this gift? Your guess will be locked in.'
          : 'Unwrap without a guess? You won’t be able to guess afterwards.';
        if (!(await confirmDialog(warning, { confirmLabel: 'Unwrap it' }))) return;
        await api(asActor(`/api/presents/${encodeURIComponent(present.id)}/reveal`), { method: 'POST' });
        await load();
      }),
    );
    card.append(
      photoRow(present, [
        ['wrapped', {}],
        ['unwrapped', { editable: true, hint: 'Opened it? Snap a photo before you guess.' }],
      ]) ?? '',
      form,
      reveal,
    );
    return card;
  });

  return h(
    'section',
    { 'aria-labelledby': 'guessing-heading' },
    h('h2', { id: 'guessing-heading' }, 'Gifts for you'),
    cards.length ? h('div', { class: 'present-grid' }, cards) : emptyState('No gifts for you in this round.'),
  );
}

function myGiftsSection() {
  const mine = view.presents.filter((p) => p.giverUid === view.me.uid);
  if (!mine.length) return null;
  return h(
    'section',
    { 'aria-labelledby': 'my-gifts-heading' },
    h('h2', { id: 'my-gifts-heading' }, 'Gifts you gave'),
    table(
      ['For', 'Gift', 'Cloaked name', 'Their guess', 'Photos'],
      mine.map((p) =>
        h(
          'tr',
          null,
          h('td', null, nameOf(p.receiverUid)),
          h('td', null, p.name ?? ''),
          h('td', null, p.cloakedName || '—'),
          h('td', null, p.revealed ? (p.guessUid ? nameOf(p.guessUid) : 'No guess') : 'Still a secret'),
          h(
            'td',
            null,
            photoRow(
              p,
              [
                ['gift', {}],
                ['wrapped', {}],
                ['unwrapped', { label: `${nameOf(p.receiverUid)}’s photo` }],
              ],
              { small: true },
            ) ?? '—',
          ),
        ),
      ),
      'Gifts you gave',
    ),
  );
}

// ---- complete ----

function revealSection() {
  const rows = view.presents.map((p) =>
    h(
      'tr',
      null,
      h('td', null, nameOf(p.giverUid)),
      h('td', null, nameOf(p.receiverUid)),
      h('td', null, p.name ?? ''),
      h('td', null, p.cloakedName || '—'),
      h('td', null, p.guessUid ? nameOf(p.guessUid) : 'No guess'),
      h(
        'td',
        { class: p.correct ? 'result--correct' : 'result--wrong' },
        p.correct ? 'Correct' : p.guessUid ? 'Fooled' : '—',
      ),
      h(
        'td',
        null,
        photoRow(
          p,
          [
            ['gift', { label: `${nameOf(p.giverUid)}’s photo` }],
            ['wrapped', {}],
            ['unwrapped', { label: `${nameOf(p.receiverUid)}’s photo` }],
          ],
          { small: true },
        ) ?? '—',
      ),
    ),
  );
  const scores = view.members
    .map((m) => {
      const received = view.presents.filter((p) => p.receiverUid === m.uid);
      return { name: m.displayName, right: received.filter((p) => p.correct).length, total: received.length };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.right - a.right);

  return h(
    'section',
    { 'aria-labelledby': 'reveal-heading' },
    h('h2', { id: 'reveal-heading' }, 'Every gift, unwrapped'),
    rows.length
      ? table(['From', 'To', 'Gift', 'Cloaked name', 'Guess', 'Result', 'Photos'], rows, 'All gifts')
      : emptyState('No gifts were given in this round.'),
    scores.length
      ? h(
          'div',
          { class: 'panel' },
          h('h3', null, 'Best guessers'),
          table(
            ['Name', 'Right guesses'],
            scores.map((s) => h('tr', null, h('td', null, s.name), h('td', null, `${s.right} of ${s.total}`))),
            'Guessing scores',
          ),
        )
      : null,
  );
}

// ---- everyone ----

function progressSection() {
  const { stage } = view.round;
  const { totals, people } = view.progress;
  const summary =
    stage === 'giving'
      ? `${totals.presents} ${totals.presents === 1 ? 'gift' : 'gifts'} wrapped so far.`
      : `${totals.presents} ${totals.presents === 1 ? 'gift' : 'gifts'} · ${totals.guessed} guessed · ${totals.revealed} unwrapped.`;
  // Before the reveal the server only sends counts that can't be matched up.
  const rows = people.map((p) =>
    h(
      'tr',
      null,
      h('td', null, nameOf(p.uid)),
      h('td', null, String(p.giving)),
      stage === 'complete' ? h('td', null, String(p.receiving ?? 0)) : null,
    ),
  );
  return h(
    'section',
    { 'aria-labelledby': 'progress-heading' },
    h('h2', { id: 'progress-heading' }, 'Round progress'),
    h('p', null, summary),
    stage === 'guessing'
      ? h('p', { class: 'muted' }, 'Who gave what stays hidden until the reveal.')
      : table(stage === 'giving' ? ['Name', 'Gifts wrapped'] : ['Name', 'Gave', 'Received'], rows, 'Round progress'),
  );
}

/** Bring over gifts marked for Santa Pack in Framblywish. The round works without it. */
async function importGifts() {
  if (view.round.stage !== 'giving' || view.me.actingAsGuest) return;
  try {
    /** @type {{ added: number, updated: number }} */
    const { added, updated } = await api(`${roundPath}/import`, { method: 'POST', body: {} });
    if (!added && !updated) return;
    await load();
    announce(
      added
        ? `${added} ${added === 1 ? 'gift' : 'gifts'} brought over from Framblywish. Each one is cloaked as three random shapes; edit it to change that.`
        : 'Gifts updated from Framblywish.',
    );
  } catch (error) {
    announceError(error);
  }
}

try {
  await requireSignedIn(shell);
  await load();
  await importGifts();
} catch (error) {
  showPageError(shell, error);
}
