import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { BASE_URL, startHarness } from './harness.js';

// The sign-in emails the app sends itself (server/firebase/signin-mail.js).
const h = await startHarness();
const emulator = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;

/** The one-time code in the last email, checking that the link is ours. @param {string} mode */
function lastCode(mode) {
  const message = h.outbox.at(-1);
  assert.ok(message, 'an email was sent');
  const link = message.text.match(/https?:\/\/\S+/)?.[0] ?? '';
  const url = new URL(link);
  assert.equal(url.origin, BASE_URL);
  assert.equal(url.pathname, '/action.html');
  assert.equal(url.searchParams.get('mode'), mode);
  return /** @type {string} */ (url.searchParams.get('oobCode'));
}

/** Call the emulator's REST API the way the browser SDK does on /action.html. @param {string} path @param {object} body */
async function identity(path, body) {
  const response = await fetch(`${emulator}/${path}?key=fake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, tenantId: h.tenantId }),
  });
  return { ok: response.ok, body: await response.json() };
}

test('the config tells the browser that the app sends its own sign-in emails', async () => {
  const config = await request(h.app).get('/api/config').expect(200);
  assert.equal(config.body.ownMail, true);
});

test('a password reset email works end to end, and the new password signs in', async () => {
  const person = await h.signUp('resetter');
  await h.as(null).post('/api/auth/reset', { email: person.email.toUpperCase() }).expect(200, { ok: true });
  const message = /** @type {import('../../server/firebase/mail.js').Message} */ (h.outbox.at(-1));
  assert.equal(message.to, person.email);
  assert.equal(message.subject, 'Reset your Santa Pack password');
  const reset = await identity('accounts:resetPassword', {
    oobCode: lastCode('resetPassword'),
    newPassword: 'new-merry-password',
  });
  assert.ok(reset.ok, JSON.stringify(reset.body));
  await h.signIn(person.email, 'new-merry-password');
});

test('a reset for an unknown address answers the same and sends nothing', async () => {
  const before = h.outbox.length;
  await h.as(null).post('/api/auth/reset', { email: 'nobody-here@example.test' }).expect(200, { ok: true });
  assert.equal(h.outbox.length, before);
});

test('reset requests are limited per address', async () => {
  const person = await h.signUp('hammer');
  for (let i = 0; i < 5; i++) await h.as(null).post('/api/auth/reset', { email: person.email }).expect(200);
  await h.as(null).post('/api/auth/reset', { email: person.email }).expect(429);
});

test('reset requests from another site are refused', async () => {
  await request(h.app)
    .post('/api/auth/reset')
    .set('Origin', 'https://evil.example')
    .send({ email: 'someone@example.test' })
    .expect(403);
  await h.as(null).post('/api/auth/reset', { email: 'not an email' }).expect(400);
});

test('an unconfirmed user can ask for the confirmation email, and its link confirms them', async () => {
  const person = await h.signUp('newbie', { verified: false });
  await h.as(person).get('/api/me').expect(403);
  await h.as(person).post('/api/auth/verify').expect(200, { ok: true });
  const message = /** @type {import('../../server/firebase/mail.js').Message} */ (h.outbox.at(-1));
  assert.equal(message.to, person.email);
  assert.match(message.text, /Hello newbie/);
  const applied = await identity('accounts:update', { oobCode: lastCode('verifyEmail') });
  assert.ok(applied.ok, JSON.stringify(applied.body));
  const fresh = { token: await h.signIn(person.email, 'very-merry-password') };
  await h.as(fresh).get('/api/me').expect(200);
});

test('asking for the confirmation email needs a valid token, and is quiet once confirmed', async () => {
  await h.as(null).post('/api/auth/verify').expect(401);
  await h.as({ token: 'forged' }).post('/api/auth/verify').expect(401);
  const confirmed = await h.signUp('already');
  const before = h.outbox.length;
  await h.as(confirmed).post('/api/auth/verify').expect(200);
  assert.equal(h.outbox.length, before);
});
