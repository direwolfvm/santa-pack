import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.js';

// Players without an account ("guests"), whom family managers play for.
const h = await startHarness();
const admin = await h.signUp('admin', { role: 'admin' });
const manager = await h.signUp('manager');
const member = await h.signUp('member');
const otherManager = await h.signUp('other-manager');

const family = (await h.as(admin).post('/api/families', { name: 'Guests' }).expect(201)).body;
const otherFamily = (await h.as(admin).post('/api/families', { name: 'Elsewhere' }).expect(201)).body;
await h.store.addMember(family.id, manager.uid, 'manager');
await h.store.addMember(family.id, member.uid, 'member');
await h.store.addMember(otherFamily.id, otherManager.uid, 'manager');
const round = (await h.as(manager).post(`/api/families/${family.id}/rounds`, { name: 'Eve' }).expect(201)).body;

/** @type {string} */ let grandma;
const SECRET = 'Knitting kit';

test('managers add players without an account; members cannot', async () => {
  await h.as(member).post(`/api/families/${family.id}/guests`, { displayName: 'Sneaky' }).expect(403);
  const created = await h.as(manager).post(`/api/families/${family.id}/guests`, { displayName: 'Grandma' }).expect(201);
  grandma = created.body.uid;
  assert.match(grandma, /^guest-[0-9a-f]{20}$/);
  const view = await h.as(member).get(`/api/families/${family.id}`).expect(200);
  const listed = view.body.members.find((/** @type {{ uid: string }} */ m) => m.uid === grandma);
  assert.deepEqual([listed.displayName, listed.guest], ['Grandma', true]);
});

test('guests cannot be made managers', async () => {
  await h.as(manager).patch(`/api/families/${family.id}/members/${grandma}`, { familyRole: 'manager' }).expect(400);
});

test('only a manager of that family can play for a guest, and only for a guest', async () => {
  await h.as(member).get(`/api/rounds/${round.id}?as=${grandma}`).expect(403);
  await h.as(otherManager).get(`/api/rounds/${round.id}?as=${grandma}`).expect(404);
  // Never another account, even for a manager.
  await h.as(manager).get(`/api/rounds/${round.id}?as=${member.uid}`).expect(403);
  const asGrandma = await h.as(manager).get(`/api/rounds/${round.id}?as=${grandma}`).expect(200);
  assert.equal(asGrandma.body.me.uid, grandma);
  assert.equal(asGrandma.body.me.actingAsGuest, true);
});

test('a manager wraps a gift as the guest; it counts as the guest’s', async () => {
  const gift = await h
    .as(manager)
    .post(`/api/rounds/${round.id}/presents?as=${grandma}`, {
      receiverUid: member.uid,
      name: SECRET,
      cloakedName: 'Yarn?',
    })
    .expect(201);
  assert.equal(gift.body.giverUid, grandma);
  // The manager, as themselves, can't see it: it's Grandma's gift, not theirs.
  const asManager = await h.as(manager).get(`/api/rounds/${round.id}`).expect(200);
  assert.ok(!JSON.stringify(asManager.body).includes(SECRET));
});

test('the member gives to the guest, and the guest guesses through the manager', async () => {
  const toGrandma = (
    await h
      .as(member)
      .post(`/api/rounds/${round.id}/presents`, { receiverUid: grandma, name: 'Slippers', cloakedName: 'Toasty' })
      .expect(201)
  ).body;
  // A gift Grandma has nothing to do with.
  await h
    .as(manager)
    .post(`/api/rounds/${round.id}/presents`, { receiverUid: member.uid, name: 'Mystery socks' })
    .expect(201);
  await h.as(manager).patch(`/api/rounds/${round.id}`, { stage: 'guessing' }).expect(200);

  const asGrandma = await h.as(manager).get(`/api/rounds/${round.id}?as=${grandma}`).expect(200);
  const cloaked = asGrandma.body.presents.find((/** @type {{ id: string }} */ p) => p.id === toGrandma.id);
  assert.deepEqual([cloaked.cloakedName, cloaked.name, cloaked.giverUid], ['Toasty', undefined, undefined]);

  await h.as(manager).put(`/api/presents/${toGrandma.id}/guess?as=${grandma}`, { guessUid: grandma }).expect(400);
  await h.as(manager).put(`/api/presents/${toGrandma.id}/guess?as=${grandma}`, { guessUid: member.uid }).expect(200);
  // The member can't guess on Grandma's behalf.
  await h.as(member).put(`/api/presents/${toGrandma.id}/guess?as=${grandma}`, { guessUid: manager.uid }).expect(403);

  const revealed = await h.as(manager).post(`/api/presents/${toGrandma.id}/reveal?as=${grandma}`).expect(200);
  assert.deepEqual([revealed.body.name, revealed.body.correct], ['Slippers', true]);
});

test('playing as a guest never unlocks admin powers', async () => {
  // A site admin normally sees every gift. Acting as Grandma, only Grandma's view.
  const asAdmin = await h.as(admin).get(`/api/rounds/${round.id}`).expect(200);
  assert.ok(JSON.stringify(asAdmin.body).includes('Mystery socks'));
  const asGrandma = await h.as(admin).get(`/api/rounds/${round.id}?as=${grandma}`).expect(200);
  assert.ok(!JSON.stringify(asGrandma.body).includes('Mystery socks'));
});

test('removing a guest works like removing a member', async () => {
  await h.as(member).delete(`/api/families/${family.id}/members/${grandma}`).expect(403);
  await h.as(manager).delete(`/api/families/${family.id}/members/${grandma}`).expect(204);
  await h.as(manager).get(`/api/rounds/${round.id}?as=${grandma}`).expect(403);
});
