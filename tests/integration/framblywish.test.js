import test from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from './harness.js';
import { SHAPES } from '../../server/game/shapes.js';

// Linking a Framblywish family, and bringing over gifts marked for Santa Pack.
const h = await startHarness();
const admin = await h.signUp('admin', { role: 'admin' });
const giver = await h.signUp('giver');
const cousin = await h.signUp('cousin');
const family = (await h.as(admin).post('/api/families', { name: 'Linked' }).expect(201)).body;
await h.store.addMember(family.id, giver.uid, 'manager');
await h.store.addMember(family.id, cousin.uid, 'member');
const newRound = async (/** @type {string} */ name) =>
  (await h.as(giver).post(`/api/families/${family.id}/rounds`, { name }).expect(201)).body;
const round = await newRound('Eve');
const framblyFamily = {
  id: 'fam1',
  name: 'Frambly family',
  people: [
    { id: giver.uid, name: 'giver', account: true },
    { id: 'newcomer1', name: 'Newcomer', account: true },
    { id: 'kid-1', name: 'Kiddo', account: false },
  ],
};
/** @param {{ id: string, title: string, recipientId: string }[]} gifts */
const reply = (gifts) => h.framblyReplies.set(giver.token, { families: [framblyFamily], gifts });
const scarf = { id: 'g1', title: 'Wool scarf', recipientId: 'kid-1' };
const book = { id: 'g2', title: 'Cook book', recipientId: 'newcomer1' };
const bring = (id = round.id) => h.as(giver).post(`/api/rounds/${id}/import`).expect(200);
const mine = async (id = round.id) =>
  /** @type {{ id: string, name: string, cloakedName: string, fromFramblywish: boolean }[]} */ (
    (await h.as(giver).get(`/api/rounds/${id}`).expect(200)).body.presents
  );

test('nothing comes over until the family is linked', async () => {
  reply([scarf]);
  assert.deepEqual((await bring()).body, { added: 0, updated: 0, same: 0 });
});

test('linking needs a manager here who leads the family there', async () => {
  const path = `/api/families/${family.id}/framblywish`;
  h.framblyReplies.set(cousin.token, { families: [framblyFamily], gifts: [] });
  await h.as(cousin).post(path, { framblywishFamilyId: 'fam1' }).expect(403);
  await h.as(giver).post(path, { framblywishFamilyId: 'not-mine' }).expect(403);
  assert.equal((await h.as(giver).post(path, { framblywishFamilyId: 'fam1' }).expect(200)).body.added, 2);
  // Again: nobody is added twice, and the manager keeps their role.
  assert.equal((await h.as(giver).post(path, { framblywishFamilyId: 'fam1' }).expect(200)).body.added, 0);
  const view = (await h.as(giver).get(`/api/families/${family.id}`).expect(200)).body;
  assert.equal(view.framblywish.linkedTo, 'Frambly family');
  assert.equal(view.me.familyRole, 'manager');
  const kid = view.members.find((/** @type {{ displayName: string }} */ m) => m.displayName === 'Kiddo');
  assert.equal(kid.guest, true);
  assert.ok(view.members.some((/** @type {{ displayName: string }} */ m) => m.displayName === 'Newcomer'));
});

test('marked gifts come over once, stay secret, and skip people outside the family', async () => {
  reply([scarf, book, { id: 'g3', title: 'For a stranger', recipientId: 'stranger' }]);
  assert.deepEqual((await bring()).body, { added: 2, updated: 0, same: 0 });
  assert.deepEqual((await bring()).body, { added: 0, updated: 0, same: 2 });
  assert.deepEqual((await mine()).map((p) => p.name).sort(), ['Cook book', 'Wool scarf']);
  assert.ok((await mine()).every((p) => p.fromFramblywish));
  // Each is cloaked as three shapes, different from the other's.
  const cloaks = (await mine()).map((p) => p.cloakedName);
  for (const cloak of cloaks)
    assert.ok(
      cloak.split(' ').every((s) => SHAPES.includes(s)),
      cloak,
    );
  assert.notEqual(cloaks[0], cloaks[1]);
  const other = await h.as(cousin).get(`/api/rounds/${round.id}`).expect(200);
  assert.deepEqual(other.body.presents, []);
  const asKid = await h.as(giver).get(`/api/rounds/${round.id}?as=guest-fw-kid-1`).expect(200);
  assert.ok(!JSON.stringify(asKid.body).includes('scarf'));
  // A later round doesn't get the same gifts again.
  assert.equal((await bring((await newRound('Later')).id)).body.added, 0);
});

test('edits there update it; edits here are kept', async () => {
  reply([{ ...scarf, title: 'Silk scarf' }, book]);
  assert.equal((await bring()).body.updated, 1);
  const present = (await mine()).find((p) => p.name === 'Silk scarf');
  assert.ok(present);
  await h.as(giver).patch(`/api/presents/${present.id}`, { name: 'My scarf', cloakedName: 'Snake' }).expect(200);
  assert.equal((await bring()).body.updated, 0);
  assert.equal((await mine()).find((p) => p.id === present.id)?.name, 'My scarf');
  assert.equal((await mine()).find((p) => p.id === present.id)?.cloakedName, 'Snake');
});

test('a removed present stays removed', async () => {
  const present = (await mine()).find((p) => p.name === 'Cook book');
  await h.as(giver).delete(`/api/presents/${present?.id}`).expect(204);
  assert.equal((await bring()).body.added, 0);
});

test('nothing changes once guessing starts', async () => {
  await h.as(giver).patch(`/api/rounds/${round.id}`, { stage: 'guessing' }).expect(200);
  reply([{ ...scarf, title: 'Too late' }]);
  assert.deepEqual((await bring()).body, { added: 0, updated: 0, same: 0 });
  assert.ok((await mine()).every((p) => p.name !== 'Too late'));
});

test('Framblywish being down is a clear error, and only members can ask', async () => {
  h.framblyReplies.delete(giver.token);
  await h.as(giver).get('/api/framblywish/families').expect(502);
  await h
    .as(await h.signUp('outsider'))
    .post(`/api/rounds/${round.id}/import`)
    .expect(404);
});

test('someone added before signing in gets their email on first sign-in', async () => {
  await h.store.linkFamily(family.id, { id: 'fam1', name: 'x' }, [{ uid: 'early', name: 'Early', guest: false }]);
  const user = await h.store.ensureUser({ uid: 'early', email: 'early@example.test' });
  assert.deepEqual([user.email, user.displayName, user.role], ['early@example.test', 'Early', 'user']);
});
