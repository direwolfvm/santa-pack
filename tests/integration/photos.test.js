import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startHarness } from './harness.js';

// Present photos: the gift and the wrapped gift (by the giver), and the
// unwrapped gift (by the receiver). Who may see each follows the gift rules.
const h = await startHarness();
const admin = await h.signUp('admin', { role: 'admin' });
const manager = await h.signUp('manager');
const giver = await h.signUp('giver');
const receiver = await h.signUp('receiver');
const bystander = await h.signUp('bystander');
const outsider = await h.signUp('outsider');

const family = (await h.as(admin).post('/api/families', { name: 'Photos' }).expect(201)).body;
await h.store.addMember(family.id, manager.uid, 'manager');
for (const person of [giver, receiver, bystander]) await h.store.addMember(family.id, person.uid, 'member');
const round = (await h.as(manager).post(`/api/families/${family.id}/rounds`, { name: 'Eve' }).expect(201)).body;
const gift = (
  await h
    .as(giver)
    .post(`/api/rounds/${round.id}/presents`, { receiverUid: receiver.uid, name: 'Telescope', cloakedName: 'Long box' })
    .expect(201)
).body;

/** A small JPEG-looking body, different per label. @param {string} label */
const jpeg = (label) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`fake jpeg ${label}`)]);
const PHOTOS = { gift: jpeg('gift'), wrapped: jpeg('wrapped'), unwrapped: jpeg('unwrapped') };
/** @param {string} presentId @param {string} kind */
const photoPath = (presentId, kind) => `/api/presents/${presentId}/photos/${kind}`;

/** @param {{ token: string }} user @param {string} path @param {Buffer} body @param {string} [type] */
const upload = (user, path, body, type = 'image/jpeg') =>
  request(h.app).put(path).set('Authorization', `Bearer ${user.token}`).set('Content-Type', type).send(body);

/** @param {{ token: string }} user @param {string} kind */
const fetchPhoto = (user, kind) =>
  request(h.app)
    .get(photoPath(gift.id, kind))
    .set('Authorization', `Bearer ${user.token}`)
    .buffer(true)
    .parse((res, done) => {
      /** @type {Buffer[]} */ const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });

/** Which photos the round view lists for this viewer's copy of the gift. @param {{ token: string }} user */
async function listedPhotos(user) {
  const view = await h.as(user).get(`/api/rounds/${round.id}`).expect(200);
  const present = view.body.presents.find((/** @type {{ id: string }} */ p) => p.id === gift.id);
  return present ? Object.keys(present.photos).sort() : null;
}

test('giving: the giver adds the gift and wrapped photos; nobody else can', async () => {
  const added = await upload(giver, photoPath(gift.id, 'gift'), PHOTOS.gift).expect(200);
  assert.ok(added.body.photos.gift);
  await upload(giver, photoPath(gift.id, 'wrapped'), PHOTOS.wrapped).expect(200);

  await upload(receiver, photoPath(gift.id, 'gift'), PHOTOS.gift).expect(403);
  await upload(manager, photoPath(gift.id, 'wrapped'), PHOTOS.wrapped).expect(403);
  await upload(outsider, photoPath(gift.id, 'gift'), PHOTOS.gift).expect(404);
  // The unwrapped photo waits for guessing, and is the receiver's.
  await upload(receiver, photoPath(gift.id, 'unwrapped'), PHOTOS.unwrapped).expect(403);
  await upload(giver, photoPath(gift.id, 'unwrapped'), PHOTOS.unwrapped).expect(403);
});

test('uploads must be real images of an allowed type and size', async () => {
  await upload(giver, photoPath(gift.id, 'gift'), Buffer.from('definitely not a picture'), 'image/jpeg').expect(400);
  await upload(giver, photoPath(gift.id, 'gift'), Buffer.from('GIF89a........'), 'image/gif').expect(415);
  await upload(giver, photoPath(gift.id, 'selfie'), PHOTOS.gift).expect(400);
  await upload(giver, photoPath(gift.id, 'gift'), Buffer.alloc(7 * 1024 * 1024, 0xff)).expect(413);
  await request(h.app)
    .put(photoPath(gift.id, 'gift'))
    .set('Authorization', `Bearer ${giver.token}`)
    .set('Origin', 'https://evil.example')
    .set('Content-Type', 'image/jpeg')
    .send(PHOTOS.gift)
    .expect(403);
});

test('giving: only the giver (and a site admin) can see the photos', async () => {
  assert.deepEqual((await fetchPhoto(giver, 'gift').expect(200)).body, PHOTOS.gift);
  assert.equal((await fetchPhoto(giver, 'gift')).headers['cache-control'], 'private, no-store');
  await fetchPhoto(admin, 'wrapped').expect(200);
  for (const person of [receiver, bystander, manager, outsider]) {
    await fetchPhoto(person, 'gift').expect(404);
    await fetchPhoto(person, 'wrapped').expect(404);
  }
  assert.equal(await listedPhotos(receiver), null);
});

test('guessing: the receiver sees the wrapped photo but never the gift photo', async () => {
  await h.as(manager).patch(`/api/rounds/${round.id}`, { stage: 'guessing' }).expect(200);
  assert.deepEqual(await listedPhotos(receiver), ['wrapped']);
  assert.deepEqual((await fetchPhoto(receiver, 'wrapped').expect(200)).body, PHOTOS.wrapped);
  await fetchPhoto(receiver, 'gift').expect(404);
  // The giver can't change their photos any more.
  await upload(giver, photoPath(gift.id, 'wrapped'), PHOTOS.wrapped).expect(403);
  await request(h.app).delete(photoPath(gift.id, 'gift')).set('Authorization', `Bearer ${giver.token}`).expect(403);
});

test('guessing: the receiver adds the unwrapped photo; the family still sees nothing', async () => {
  await upload(receiver, photoPath(gift.id, 'unwrapped'), PHOTOS.unwrapped).expect(200);
  assert.deepEqual(await listedPhotos(receiver), ['unwrapped', 'wrapped']);
  assert.deepEqual((await fetchPhoto(receiver, 'unwrapped').expect(200)).body, PHOTOS.unwrapped);
  await fetchPhoto(giver, 'unwrapped').expect(200);
  for (const kind of ['gift', 'wrapped', 'unwrapped']) {
    await fetchPhoto(bystander, kind).expect(404);
    await fetchPhoto(manager, kind).expect(404);
  }
});

test('the reveal shows the receiver the giver’s photo next to their own', async () => {
  await h.as(receiver).put(`/api/presents/${gift.id}/guess`, { guessUid: giver.uid }).expect(200);
  await h.as(receiver).post(`/api/presents/${gift.id}/reveal`).expect(200);
  assert.deepEqual(await listedPhotos(receiver), ['gift', 'unwrapped', 'wrapped']);
  assert.deepEqual((await fetchPhoto(receiver, 'gift').expect(200)).body, PHOTOS.gift);
  await fetchPhoto(bystander, 'gift').expect(404);
});

test('complete: the whole family sees every photo', async () => {
  await h.as(manager).patch(`/api/rounds/${round.id}`, { stage: 'complete' }).expect(200);
  for (const kind of ['gift', 'wrapped', 'unwrapped']) await fetchPhoto(bystander, kind).expect(200);
  await fetchPhoto(outsider, 'gift').expect(404);
  await upload(receiver, photoPath(gift.id, 'unwrapped'), PHOTOS.unwrapped).expect(403);
});

test('removing a photo, or the present, deletes the stored file', async () => {
  const round2 = (await h.as(manager).post(`/api/families/${family.id}/rounds`, { name: 'Spare' }).expect(201)).body;
  const present = (
    await h
      .as(giver)
      .post(`/api/rounds/${round2.id}/presents`, { receiverUid: receiver.uid, name: 'Socks' })
      .expect(201)
  ).body;
  await upload(giver, photoPath(present.id, 'gift'), PHOTOS.gift).expect(200);
  await upload(giver, photoPath(present.id, 'wrapped'), PHOTOS.wrapped).expect(200);
  const stored = `families/${family.id}/rounds/${round2.id}/presents/${present.id}/`;
  const [before] = await h.bucket.getFiles({ prefix: stored });
  assert.equal(before.length, 2);

  const removed = await request(h.app)
    .delete(photoPath(present.id, 'gift'))
    .set('Authorization', `Bearer ${giver.token}`)
    .expect(200);
  assert.deepEqual(Object.keys(removed.body.photos), ['wrapped']);
  assert.equal((await h.bucket.getFiles({ prefix: stored }))[0].length, 1);

  await h.as(giver).delete(`/api/presents/${present.id}`).expect(204);
  assert.equal((await h.bucket.getFiles({ prefix: stored }))[0].length, 0);
});

test('a manager adds the unwrapped photo for a guest they play for', async () => {
  const guest = (await h.as(manager).post(`/api/families/${family.id}/guests`, { displayName: 'Grandpa' }).expect(201))
    .body;
  const round3 = (await h.as(manager).post(`/api/families/${family.id}/rounds`, { name: 'Guest' }).expect(201)).body;
  const present = (
    await h.as(giver).post(`/api/rounds/${round3.id}/presents`, { receiverUid: guest.uid, name: 'Pipe' }).expect(201)
  ).body;
  await h.as(manager).patch(`/api/rounds/${round3.id}`, { stage: 'guessing' }).expect(200);
  await upload(manager, photoPath(present.id, 'unwrapped'), PHOTOS.unwrapped).expect(403);
  await upload(manager, `${photoPath(present.id, 'unwrapped')}?as=${guest.uid}`, PHOTOS.unwrapped).expect(200);
});
