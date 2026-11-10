import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.js';

// One family, played through every stage. The tests run in order and build on
// each other, like a real gift round.
const h = await startHarness();
const admin = await h.signUp('admin', { role: 'admin' });
const manager = await h.signUp('manager');
const giver = await h.signUp('giver');
const receiver = await h.signUp('receiver');
const outsider = await h.signUp('outsider');

const SECRET = 'Talkboy recorder';
/** @type {string} */ let familyId;
/** @type {string} */ let joinCode;
/** @type {string} */ let roundId;
/** @type {string} */ let presentId;

/** @param {{ uid: string, token: string }} user */
const presentsSeenBy = async (user) => (await h.as(user).get(`/api/rounds/${roundId}`).expect(200)).body.presents;

test('an admin creates a family with a join code', async () => {
  const response = await h.as(admin).post('/api/families', { name: 'The McCallisters' }).expect(201);
  familyId = response.body.id;
  joinCode = response.body.joinCode;
  assert.match(joinCode, /^[A-Z2-9]{8}$/);
});

test('joining by code is pending until a manager approves', async () => {
  for (const user of [manager, giver, receiver]) {
    const response = await h.as(user).post('/api/families/join', { code: joinCode.toLowerCase() }).expect(201);
    assert.equal(response.body.status, 'pending');
  }
  // Pending members can't see the family yet.
  await h.as(giver).get(`/api/families/${familyId}`).expect(404);
  await h.as(outsider).post('/api/families/join', { code: 'ZZZZZZZZ' }).expect(404);
});

test('the admin approves the manager and promotes them', async () => {
  await h.as(admin).post(`/api/families/${familyId}/members/${manager.uid}/approve`).expect(200);
  await h.as(admin).patch(`/api/families/${familyId}/members/${manager.uid}`, { familyRole: 'manager' }).expect(200);
});

test('ordinary members cannot approve; managers can', async () => {
  await h.as(manager).post(`/api/families/${familyId}/members/${giver.uid}/approve`).expect(200);
  await h.as(giver).post(`/api/families/${familyId}/members/${receiver.uid}/approve`).expect(403);
  await h.as(manager).post(`/api/families/${familyId}/members/${receiver.uid}/approve`).expect(200);
});

test('only managers see the join code and pending list', async () => {
  const asManager = await h.as(manager).get(`/api/families/${familyId}`).expect(200);
  assert.equal(asManager.body.family.joinCode, joinCode);
  const asMember = await h.as(giver).get(`/api/families/${familyId}`).expect(200);
  assert.equal(asMember.body.family.joinCode, undefined);
  assert.deepEqual(asMember.body.pending, []);
  assert.equal(asMember.body.members.length, 3);
});

test('outsiders get 404 for the family and its rounds', async () => {
  await h.as(outsider).get(`/api/families/${familyId}`).expect(404);
  const round = await h.as(manager).post(`/api/families/${familyId}/rounds`, { name: 'Christmas Eve' }).expect(201);
  roundId = round.body.id;
  assert.equal(round.body.stage, 'giving');
  await h.as(outsider).get(`/api/rounds/${roundId}`).expect(404);
  await h.as(outsider).post(`/api/rounds/${roundId}/presents`, { receiverUid: receiver.uid, name: 'x' }).expect(404);
});

test('members cannot create rounds or change stages', async () => {
  await h.as(giver).post(`/api/families/${familyId}/rounds`, { name: 'Mine' }).expect(403);
  await h.as(giver).patch(`/api/rounds/${roundId}`, { stage: 'guessing' }).expect(403);
});

test('giving: only the giver (and site admin) can see the present', async () => {
  await h.as(giver).post(`/api/rounds/${roundId}/presents`, { receiverUid: giver.uid, name: 'Me' }).expect(400);
  await h.as(giver).post(`/api/rounds/${roundId}/presents`, { receiverUid: outsider.uid, name: 'x' }).expect(400);
  const created = await h
    .as(giver)
    .post(`/api/rounds/${roundId}/presents`, {
      receiverUid: receiver.uid,
      name: SECRET,
      description: 'For field work',
      cloakedName: 'Operation Mistletoe',
    })
    .expect(201);
  presentId = created.body.id;

  assert.equal((await presentsSeenBy(giver))[0].name, SECRET);
  assert.equal((await presentsSeenBy(admin))[0].name, SECRET);
  assert.deepEqual(await presentsSeenBy(receiver), []);
  assert.deepEqual(await presentsSeenBy(manager), []);

  const progress = (await h.as(manager).get(`/api/rounds/${roundId}`)).body.progress;
  assert.equal(progress.people.find((/** @type {{ uid: string }} */ p) => p.uid === giver.uid).giving, 1);
  assert.equal(progress.people[0].receiving, undefined, 'receiving counts would pair givers with receivers');
});

test('giving: guesses and reveals are refused, edits are allowed', async () => {
  await h.as(receiver).put(`/api/presents/${presentId}/guess`, { guessUid: giver.uid }).expect(403);
  await h.as(receiver).post(`/api/presents/${presentId}/reveal`).expect(403);
  await h.as(receiver).patch(`/api/presents/${presentId}`, { name: 'Coal' }).expect(403);
  await h.as(giver).patch(`/api/presents/${presentId}`, { description: 'For very important field work' }).expect(200);
});

test('stages only move one step', async () => {
  await h.as(manager).patch(`/api/rounds/${roundId}`, { stage: 'complete' }).expect(409);
  await h.as(manager).patch(`/api/rounds/${roundId}`, { stage: 'guessing' }).expect(200);
});

test('guessing: the receiver gets the cloaked name and nothing secret', async () => {
  const response = await h.as(receiver).get(`/api/rounds/${roundId}`).expect(200);
  const raw = JSON.stringify(response.body);
  assert.ok(!raw.includes(SECRET), 'present name leaked to the receiver');
  assert.ok(!raw.includes('field work'), 'description leaked to the receiver');
  const [present] = response.body.presents;
  assert.equal(present.cloakedName, 'Operation Mistletoe');
  assert.equal(present.giverUid, undefined);
  // Only totals while guessing, so givers can't be matched to receivers.
  assert.deepEqual(response.body.progress.people, []);
  assert.equal(response.body.progress.totals.presents, 1);
  // The manager is a player too and gets no peek.
  assert.ok(!JSON.stringify((await h.as(manager).get(`/api/rounds/${roundId}`)).body).includes(SECRET));
});

test('guessing: the giver can no longer edit or delete', async () => {
  await h.as(giver).patch(`/api/presents/${presentId}`, { name: 'Changed' }).expect(403);
  await h.as(giver).delete(`/api/presents/${presentId}`).expect(403);
});

test('guessing: the receiver guesses, then reveals', async () => {
  await h.as(receiver).put(`/api/presents/${presentId}/guess`, { guessUid: receiver.uid }).expect(400);
  await h.as(receiver).put(`/api/presents/${presentId}/guess`, { guessUid: outsider.uid }).expect(400);
  await h.as(giver).put(`/api/presents/${presentId}/guess`, { guessUid: manager.uid }).expect(403);

  const guessed = await h.as(receiver).put(`/api/presents/${presentId}/guess`, { guessUid: manager.uid }).expect(200);
  assert.equal(guessed.body.guessUid, manager.uid);
  assert.equal(guessed.body.name, undefined);

  const revealed = await h.as(receiver).post(`/api/presents/${presentId}/reveal`).expect(200);
  assert.equal(revealed.body.name, SECRET);
  assert.equal(revealed.body.giverUid, giver.uid);
  assert.equal(revealed.body.correct, false);

  // Revealing is one-way: no changing the guess afterwards.
  await h.as(receiver).put(`/api/presents/${presentId}/guess`, { guessUid: giver.uid }).expect(403);
});

test('complete: everyone in the family sees everything', async () => {
  await h.as(manager).patch(`/api/rounds/${roundId}`, { stage: 'complete' }).expect(200);
  for (const user of [manager, giver, receiver]) {
    const [present] = await presentsSeenBy(user);
    assert.equal(present.name, SECRET);
    assert.equal(present.giverUid, giver.uid);
  }
  await h.as(outsider).get(`/api/rounds/${roundId}`).expect(404);
});

test('stage changes and approvals are audited', async () => {
  const audit = await h.db.collection('audit').where('target.familyId', '==', familyId).get();
  const actions = audit.docs.map((doc) => doc.get('action'));
  assert.ok(actions.includes('member.approve'));
  const stages = await h.db.collection('audit').where('target.roundId', '==', roundId).get();
  assert.equal(stages.size, 2);
});

test('members can leave; managers can remove; only admins delete families', async () => {
  await h.as(receiver).delete(`/api/families/${familyId}/members/${receiver.uid}`).expect(204);
  await h.as(receiver).get(`/api/families/${familyId}`).expect(404);
  await h.as(giver).delete(`/api/families/${familyId}/members/${manager.uid}`).expect(403);
  await h.as(manager).delete(`/api/families/${familyId}/members/${giver.uid}`).expect(204);
  await h.as(manager).delete(`/api/families/${familyId}`).expect(403);
  await h.as(admin).delete(`/api/families/${familyId}`).expect(204);
  assert.equal((await h.db.collection('presents').where('familyId', '==', familyId).get()).size, 0);
});
