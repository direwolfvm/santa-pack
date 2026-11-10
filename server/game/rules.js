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
 *
 * @typedef {object} Viewer
 * @property {string} uid
 * @property {boolean} isAdmin Site administrator.
 */

/** @type {readonly Stage[]} */
export const STAGES = ['giving', 'guessing', 'complete'];

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
  };
}

/**
 * Counts anyone in the family may see, without exposing who gives what to whom.
 *
 * @param {Present[]} presents
 * @param {string[]} memberUids
 */
export function roundProgress(presents, memberUids) {
  return memberUids.map((uid) => ({
    uid,
    giving: presents.filter((p) => p.giverUid === uid).length,
    receiving: presents.filter((p) => p.receiverUid === uid).length,
    guessed: presents.filter((p) => p.receiverUid === uid && p.guessUid).length,
    revealed: presents.filter((p) => p.receiverUid === uid && p.revealedAt).length,
  }));
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
