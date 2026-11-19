import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canMoveStage,
  photoActionError,
  presentActionError,
  projectPresent,
  roundProgress,
  STAGES,
} from '../../server/game/rules.js';

/** @type {import('../../server/game/rules.js').Present} */
const present = {
  id: 'p1',
  roundId: 'r1',
  familyId: 'f1',
  giverUid: 'giver',
  receiverUid: 'receiver',
  name: 'Wool scarf',
  description: 'Forest green',
  cloakedName: 'A long winter nap',
  guessUid: null,
  revealedAt: null,
};

const viewers = {
  giver: { uid: 'giver', isAdmin: false },
  receiver: { uid: 'receiver', isAdmin: false },
  other: { uid: 'cousin', isAdmin: false },
  admin: { uid: 'admin', isAdmin: true },
};

const SECRET_FIELDS = ['name', 'description', 'giverUid'];

/** @param {ReturnType<typeof projectPresent>} view */
function kind(view) {
  if (view === null) return 'hidden';
  return SECRET_FIELDS.every((field) => field in view) ? 'full' : 'cloaked';
}

test('who sees what, by stage', () => {
  /** @type {Array<[keyof typeof viewers, import('../../server/game/rules.js').Stage, string]>} */
  const cases = [
    ['giver', 'giving', 'full'],
    ['giver', 'guessing', 'full'],
    ['giver', 'complete', 'full'],
    ['receiver', 'giving', 'hidden'],
    ['receiver', 'guessing', 'cloaked'],
    ['receiver', 'complete', 'full'],
    ['other', 'giving', 'hidden'],
    ['other', 'guessing', 'hidden'],
    ['other', 'complete', 'full'],
    ['admin', 'giving', 'full'],
    ['admin', 'guessing', 'full'],
  ];
  for (const [who, stage, expected] of cases) {
    assert.equal(kind(projectPresent(present, stage, viewers[who])), expected, `${who} during ${stage}`);
  }
});

test('a cloaked present carries no secret field at all', () => {
  const view = projectPresent({ ...present, guessUid: 'cousin' }, 'guessing', viewers.receiver);
  assert.deepEqual(view, {
    id: 'p1',
    roundId: 'r1',
    receiverUid: 'receiver',
    cloakedName: 'A long winter nap',
    guessUid: 'cousin',
    revealed: false,
    photos: {},
  });
});

test('before the reveal a receiver sees the wrapped photo and their own, never the gift photo', () => {
  const withPhotos = {
    ...present,
    photos: { gift: '2026-12-01T00:00:00Z', wrapped: '2026-12-02T00:00:00Z', unwrapped: '2026-12-24T00:00:00Z' },
  };
  /** @param {import('../../server/game/rules.js').Stage} stage @param {keyof typeof viewers} who @param {object} [extra] */
  const listed = (stage, who, extra = {}) =>
    Object.keys(projectPresent({ ...withPhotos, ...extra }, stage, viewers[who])?.photos ?? {}).sort();
  assert.deepEqual(listed('guessing', 'receiver'), ['unwrapped', 'wrapped']);
  assert.deepEqual(listed('guessing', 'receiver', { revealedAt: '2026-12-25T00:00:00Z' }), [
    'gift',
    'unwrapped',
    'wrapped',
  ]);
  assert.deepEqual(listed('giving', 'receiver'), []);
  assert.deepEqual(listed('guessing', 'other'), []);
  assert.deepEqual(listed('guessing', 'giver'), ['gift', 'unwrapped', 'wrapped']);
  assert.deepEqual(listed('complete', 'other'), ['gift', 'unwrapped', 'wrapped']);
});

test('photo changes by kind, role and stage', () => {
  /** @type {Array<[import('../../server/game/rules.js').PhotoKind, keyof typeof viewers, import('../../server/game/rules.js').Stage, boolean]>} */
  const cases = [
    ['gift', 'giver', 'giving', true],
    ['wrapped', 'giver', 'giving', true],
    ['gift', 'giver', 'guessing', false],
    ['wrapped', 'receiver', 'giving', false],
    ['unwrapped', 'receiver', 'guessing', true],
    ['unwrapped', 'receiver', 'giving', false],
    ['unwrapped', 'receiver', 'complete', false],
    ['unwrapped', 'giver', 'guessing', false],
    ['gift', 'admin', 'giving', false],
  ];
  for (const [photo, who, stage, allowed] of cases) {
    assert.equal(photoActionError(photo, present, stage, viewers[who]) === null, allowed, `${who} ${photo} ${stage}`);
  }
});

test('revealing shows the receiver everything and scores the guess', () => {
  const view = projectPresent(
    { ...present, guessUid: 'giver', revealedAt: '2026-12-25T08:00:00Z' },
    'guessing',
    viewers.receiver,
  );
  assert.equal(kind(view), 'full');
  const full = /** @type {{ giverUid?: string, correct?: boolean | null }} */ (view);
  assert.equal(full.giverUid, 'giver');
  assert.equal(full.correct, true);
});

test('progress never pairs givers with receivers before the reveal', () => {
  const presents = [present, { ...present, id: 'p2', giverUid: 'cousin', guessUid: 'giver' }];
  const members = ['giver', 'receiver', 'cousin'];

  const giving = roundProgress(presents, members, 'giving');
  assert.deepEqual(giving.people, [
    { uid: 'giver', giving: 1 },
    { uid: 'receiver', giving: 0 },
    { uid: 'cousin', giving: 1 },
  ]);
  for (const row of giving.people) assert.deepEqual(Object.keys(row).sort(), ['giving', 'uid']);

  const guessing = roundProgress(presents, members, 'guessing');
  assert.deepEqual(guessing, { totals: { presents: 2, guessed: 1, revealed: 0 }, people: [] });

  const complete = roundProgress(presents, members, 'complete');
  assert.deepEqual(complete.people[1], { uid: 'receiver', giving: 0, receiving: 2, guessedRight: 0 });
});

test('present actions by role and stage', () => {
  /** @type {Array<['edit' | 'delete' | 'guess' | 'reveal', keyof typeof viewers, import('../../server/game/rules.js').Stage, boolean]>} */
  const cases = [
    ['edit', 'giver', 'giving', true],
    ['edit', 'giver', 'guessing', false],
    ['edit', 'receiver', 'giving', false],
    ['edit', 'admin', 'giving', false],
    ['delete', 'giver', 'giving', true],
    ['delete', 'giver', 'guessing', false],
    ['delete', 'other', 'giving', false],
    ['delete', 'admin', 'complete', true],
    ['guess', 'receiver', 'guessing', true],
    ['guess', 'receiver', 'giving', false],
    ['guess', 'receiver', 'complete', false],
    ['guess', 'giver', 'guessing', false],
    ['guess', 'admin', 'guessing', false],
    ['reveal', 'receiver', 'guessing', true],
    ['reveal', 'receiver', 'giving', false],
    ['reveal', 'other', 'guessing', false],
  ];
  for (const [action, who, stage, allowed] of cases) {
    const refusal = presentActionError(action, present, stage, viewers[who]);
    assert.equal(refusal === null, allowed, `${who} ${action} during ${stage}: ${refusal}`);
  }
});

test('no new guesses after a reveal', () => {
  const revealed = { ...present, revealedAt: '2026-12-25T08:00:00Z' };
  assert.match(presentActionError('guess', revealed, 'guessing', viewers.receiver) ?? '', /already been revealed/);
});

test('stages move one step at a time', () => {
  const allowed = STAGES.flatMap((from) => STAGES.filter((to) => canMoveStage(from, to)).map((to) => `${from}>${to}`));
  assert.deepEqual(allowed.sort(), ['complete>guessing', 'giving>guessing', 'guessing>complete', 'guessing>giving']);
});
