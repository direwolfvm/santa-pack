/**
 * The game's permission and visibility rules, as pure functions so they can be
 * tested without Firestore. Every API route asks these before reading or
 * writing presents.
 *
 * @typedef {'giving' | 'guessing' | 'complete'} Stage
 * @typedef {'member' | 'manager'} FamilyRole
 *
 * @typedef {object} Present
 * @property {string} id
 * @property {string} roundId
 * @property {string} familyId
 * @property {string} giverUid
 * @property {string} receiverUid
 * @property {string} name
 * @property {string} description
 * @property {string} cloakedName
 * @property {string | null} guessUid
 * @property {string | null} revealedAt ISO timestamp, set once by the receiver.
 * @property {string} [sourceGiftId] The Framblywish gift this was brought over from.
 * @property {{ name: string, receiverUid: string }} [source] What Framblywish last said, to notice changes there.
 * @property {Partial<Record<PhotoKind, string>>} [photos] When each photo was added (ISO timestamp).
 *
 * @typedef {'gift' | 'wrapped' | 'unwrapped'} PhotoKind
 *   gift: the present itself, by the giver. wrapped: the wrapped present, by
 *   the giver, so the receiver can tell which one they're guessing about.
 *   unwrapped: by the receiver once it's open, while they guess the giver.
 *
 * @typedef {object} Viewer
 * @property {string} uid
 * @property {boolean} isAdmin Site administrator.
 */

/** @type {readonly Stage[]} */
export const STAGES = ['giving', 'guessing', 'complete'];

/** @type {readonly PhotoKind[]} */
export const PHOTO_KINDS = ['gift', 'wrapped', 'unwrapped'];

/**
 * The photos in a present that may be shown, keyed by kind.
 * @param {Present} present @param {readonly PhotoKind[]} kinds
 */
function photosOf(present, kinds) {
  /** @type {Partial<Record<PhotoKind, string>>} */
  const shown = {};
  for (const kind of kinds) {
    const at = present.photos?.[kind];
    if (at) shown[kind] = at;
  }
  return shown;
}

/** Stage changes a manager may make: forward one step, or back one step to reopen. */
const STAGE_MOVES = /** @type {Record<Stage, Stage[]>} */ ({
  giving: ['guessing'],
  guessing: ['giving', 'complete'],
  complete: ['guessing'],
});

/** @param {Stage} from @param {Stage} to */
export function canMoveStage(from, to) {
  return STAGE_MOVES[from].includes(to);
}

/**
 * What a viewer may see of one present. Returns null when the present must be
 * hidden entirely.
 *
 * - Site admins and everyone in a complete round see everything.
 * - Givers always see their own presents in full.
 * - Receivers see nothing while giving; while guessing they see the cloaked
 *   name and their own guess, and the rest only after revealing that present.
 * - Everyone else (managers included) sees nothing until the round is complete.
 *
 * Photos follow the same rules. Before the reveal a receiver sees only the
 * wrapped photo and their own unwrapped one, never the giver's photo of the
 * gift. `photos` lists the ones this viewer may load.
 *
 * @param {Present} present
 * @param {Stage} stage
 * @param {Viewer} viewer
 */
export function projectPresent(present, stage, viewer) {
  const full = {
    id: present.id,
    roundId: present.roundId,
    giverUid: present.giverUid,
    receiverUid: present.receiverUid,
    name: present.name,
    description: present.description,
    cloakedName: present.cloakedName,
    guessUid: present.guessUid,
    revealed: Boolean(present.revealedAt),
    correct: present.guessUid ? present.guessUid === present.giverUid : null,
    photos: photosOf(present, PHOTO_KINDS),
    fromFramblywish: Boolean(present.sourceGiftId),
  };

  if (viewer.isAdmin || stage === 'complete' || viewer.uid === present.giverUid) return full;
  if (viewer.uid !== present.receiverUid || stage === 'giving') return null;
  if (present.revealedAt) return full;

  return {
    id: present.id,
    roundId: present.roundId,
    receiverUid: present.receiverUid,
    cloakedName: present.cloakedName,
    guessUid: present.guessUid,
    revealed: false,
    photos: photosOf(present, ['wrapped', 'unwrapped']),
  };
}

/**
 * Why adding or removing a photo is refused, or null when it is allowed.
 * The giver adds the gift and wrapped photos while giving; the receiver adds
 * the unwrapped photo while guessing.
 *
 * @param {PhotoKind} kind
 * @param {Present} present
 * @param {Stage} stage
 * @param {Viewer} viewer
 * @returns {string | null}
 */
export function photoActionError(kind, present, stage, viewer) {
  if (kind === 'unwrapped') {
    if (viewer.uid !== present.receiverUid) return 'Only the receiver can add the unwrapped photo.';
    return stage === 'guessing' ? null : 'The unwrapped photo can only be added while the round is guessing.';
  }
  if (viewer.uid !== present.giverUid) return 'Only the giver can add photos of the gift.';
  return stage === 'giving' ? null : 'Photos of the gift can only be changed while the round is giving.';
}

/**
 * Progress anyone in the family may see. Per-person counts are cut back so
 * they can't be lined up into "who gives to whom":
 *
 * - giving: how many gifts each person has wrapped (so organizers can see who
 *   is done). Receivers can't see their gifts yet, so there is nothing to match.
 * - guessing: round totals only. A receiver can see their own gifts now, and
 *   per-giver counts next to that would give the game away in small families.
 * - complete: everything, per person.
 *
 * @param {Present[]} presents
 * @param {string[]} memberUids
 * @param {Stage} stage
 */
export function roundProgress(presents, memberUids, stage) {
  const totals = {
    presents: presents.length,
    guessed: presents.filter((p) => p.guessUid).length,
    revealed: presents.filter((p) => p.revealedAt).length,
  };
  if (stage === 'guessing') return { totals, people: [] };
  if (stage === 'giving') {
    return {
      totals,
      people: memberUids.map((uid) => ({ uid, giving: presents.filter((p) => p.giverUid === uid).length })),
    };
  }
  return {
    totals,
    people: memberUids.map((uid) => {
      const received = presents.filter((p) => p.receiverUid === uid);
      return {
        uid,
        giving: presents.filter((p) => p.giverUid === uid).length,
        receiving: received.length,
        guessedRight: received.filter((p) => p.guessUid && p.guessUid === p.giverUid).length,
      };
    }),
  };
}

/**
 * Why an action on a present is refused, or null when it is allowed.
 *
 * @param {'edit' | 'delete' | 'guess' | 'reveal'} action
 * @param {Present} present
 * @param {Stage} stage
 * @param {Viewer} viewer
 * @returns {string | null}
 */
export function presentActionError(action, present, stage, viewer) {
  switch (action) {
    case 'edit':
      if (viewer.uid !== present.giverUid) return 'Only the giver can change this present.';
      return stage === 'giving' ? null : 'Presents can only be changed while the round is giving.';
    case 'delete':
      if (viewer.isAdmin) return null;
      if (viewer.uid !== present.giverUid) return 'Only the giver can remove this present.';
      return stage === 'giving' ? null : 'Presents can only be removed while the round is giving.';
    case 'guess':
      if (viewer.uid !== present.receiverUid) return 'Only the receiver can guess.';
      if (stage !== 'guessing') return 'Guesses can only be made while the round is guessing.';
      return present.revealedAt ? 'This present has already been revealed.' : null;
    case 'reveal':
      if (viewer.uid !== present.receiverUid) return 'Only the receiver can reveal this present.';
      return stage === 'guessing' ? null : 'Presents can only be revealed while the round is guessing.';
  }
}
