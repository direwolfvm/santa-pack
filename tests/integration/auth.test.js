import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { BASE_URL, DATABASE_ID, PROJECT_ID, startHarness } from './harness.js';

const h = await startHarness();

test('health and public config need no sign-in', async () => {
  await request(h.app).get('/api/health').expect(200, { status: 'ok' });
  const config = await request(h.app).get('/api/config').expect(200);
  assert.equal(config.body.tenantId, h.tenantId);
});

test('API routes refuse missing and forged tokens with 401', async () => {
  for (const path of ['/api/me', '/api/admin/users', '/api/rounds/anything']) {
    await h.as(null).get(path).expect(401);
    await h.as({ token: 'forged.token.value' }).get(path).expect(401);
  }
  await h.as(null).post('/api/families/join', { code: 'ABCDEFGH' }).expect(401);
});

test('unverified email gets 403', async () => {
  const user = await h.signUp('unverified', { verified: false });
  const response = await h.as(user).get('/api/me').expect(403);
  assert.match(response.body.error, /verify your email/);
});

test('a disabled account gets 403', async () => {
  const user = await h.signUp('disabled');
  await h.db.collection('users').doc(user.uid).update({ disabled: true });
  await h.as(user).get('/api/me').expect(403);
});

test('first sign-in creates a plain user record, never an admin', async () => {
  const user = await h.signUp('newcomer');
  const me = await h.as(user).get('/api/me').expect(200);
  assert.equal(me.body.user.role, 'user');
  assert.deepEqual(me.body.families, []);
});

test('admin-only routes refuse ordinary users with 403', async () => {
  const user = await h.signUp('plain');
  await h.as(user).get('/api/admin/users').expect(403);
  await h.as(user).get('/api/admin/families').expect(403);
  await h.as(user).post('/api/families', { name: 'Sneaky' }).expect(403);
  await h.as(user).patch(`/api/admin/users/${user.uid}`, { role: 'admin' }).expect(403);
});

test('admins cannot change their own role', async () => {
  const admin = await h.signUp('admin', { role: 'admin' });
  await h.as(admin).patch(`/api/admin/users/${admin.uid}`, { role: 'user' }).expect(400);
});

test('writes from another site are refused, and writes must be JSON', async () => {
  const user = await h.signUp('origin');
  await h.as(user).patch('/api/me', { displayName: 'X' }).set('Origin', 'https://evil.example').expect(403);
  await h.as(user).patch('/api/me', { displayName: 'Ok' }).set('Origin', BASE_URL).expect(200);
  await h.as(user).patch('/api/me', {}).set('Content-Type', 'text/plain').send('displayName=X').expect(415);
});

test('responses carry security headers and are not cached', async () => {
  const user = await h.signUp('headers');
  const response = await h.as(user).get('/api/me').expect(200);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.match(response.headers['content-security-policy'], /script-src 'self'/);
  assert.ok(response.headers['strict-transport-security']);
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('clients cannot read or write Firestore directly', async () => {
  const user = await h.signUp('direct');
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
  const read = await fetch(`${base}/users/${user.uid}`, { headers: { Authorization: `Bearer ${user.token}` } });
  assert.equal(read.status, 403);
  const write = await fetch(`${base}/users?documentId=${user.uid}x`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { role: { stringValue: 'admin' } } }),
  });
  assert.equal(write.status, 403);
  // Control: the emulator's admin token bypasses rules, so the 403s above come
  // from the deny-all rules, not from a wrong URL or a missing database.
  const control = await fetch(`${base}/users/${user.uid}`, { headers: { Authorization: 'Bearer owner' } });
  assert.equal(control.status, 200);
});
