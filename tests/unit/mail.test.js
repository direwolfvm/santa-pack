import test from 'node:test';
import assert from 'node:assert/strict';
import { mailgunSender } from '../../server/firebase/mail.js';
import { createSigninMail } from '../../server/firebase/signin-mail.js';

const settings = {
  apiKey: 'test-key',
  domain: 'mg.santapack.me',
  from: 'Santa Pack <noreply@mg.santapack.me>',
  apiBase: 'https://api.mailgun.net',
  testMode: true,
};

test('Mailgun gets the message, without click tracking, in test mode when asked', async () => {
  /** @type {{ url: string, init: RequestInit }[]} */
  const calls = [];
  const fakeFetch = /** @type {typeof fetch} */ (
    async (url, init) => {
      calls.push({ url: String(url), init: /** @type {RequestInit} */ (init) });
      return new Response('{}', { status: 200 });
    }
  );
  await mailgunSender(
    settings,
    fakeFetch,
  )({ to: 'a@example.test', subject: 'Hi', text: 'Hello', html: '<p>Hello</p>' });
  assert.equal(calls[0].url, 'https://api.mailgun.net/v3/mg.santapack.me/messages');
  const headers = /** @type {Record<string, string>} */ (calls[0].init.headers);
  assert.equal(headers.Authorization, `Basic ${Buffer.from('api:test-key').toString('base64')}`);
  const form = /** @type {URLSearchParams} */ (calls[0].init.body);
  assert.equal(form.get('from'), settings.from);
  assert.equal(form.get('o:tracking-clicks'), 'no');
  assert.equal(form.get('o:testmode'), 'yes');
});

test('a Mailgun failure reports the status only', async () => {
  const fakeFetch = /** @type {typeof fetch} */ (async () => new Response('echo of the message', { status: 401 }));
  await assert.rejects(
    mailgunSender(settings, fakeFetch)({ to: 'a@example.test', subject: 's', text: 't', html: 'h' }),
    /^Error: Mailgun answered 401$/,
  );
});

test('sign-in emails link to our own page with only the one-time code, and escape names', async () => {
  /** @type {import('../../server/firebase/mail.js').Message[]} */
  const sent = [];
  const google = 'https://example.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=CODE-1&apiKey=k&tenantId=t';
  const mail = createSigninMail({
    auth: {
      generatePasswordResetLink: async () => google,
      generateEmailVerificationLink: async () => google,
    },
    send: async (message) => {
      sent.push(message);
    },
    baseUrl: 'https://santapack.me',
  });
  await mail.verification('kid@example.test', '<b>Kid</b>');
  const [message] = sent;
  assert.equal(message.subject, 'Confirm your email for Santa Pack');
  assert.ok(message.text.includes('https://santapack.me/action.html?mode=verifyEmail&oobCode=CODE-1'));
  assert.ok(!message.text.includes('firebaseapp.com'));
  assert.ok(message.html.includes('&#60;b&#62;Kid'));
  assert.ok(!message.html.includes('<b>Kid'));
});

test('a reset for an unknown address sends nothing and does not fail', async () => {
  let sends = 0;
  const mail = createSigninMail({
    auth: {
      generatePasswordResetLink: async () => {
        throw Object.assign(new Error('no user'), { code: 'auth/email-not-found' });
      },
      generateEmailVerificationLink: async () => '',
    },
    send: async () => {
      sends += 1;
    },
    baseUrl: 'https://santapack.me',
  });
  await mail.passwordReset('nobody@example.test');
  assert.equal(sends, 0);
});
