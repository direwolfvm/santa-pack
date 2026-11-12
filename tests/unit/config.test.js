import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../server/config.js';

const firebase = {
  BACKEND: 'firebase',
  GOOGLE_CLOUD_PROJECT: 'demo-santa-pack',
  FIRESTORE_DATABASE: 'santa-pack',
  FIREBASE_TENANT_ID: 'santa-pack-abc12',
  FIREBASE_API_KEY: 'public-web-key',
  FIREBASE_AUTH_DOMAIN: 'demo-santa-pack.firebaseapp.com',
  APP_BASE_URL: 'https://santapack.me',
  APP_ADDITIONAL_ORIGINS: 'https://santa-pack-xyz.a.run.app',
};

test('supabase stays the default backend', () => {
  const config = loadConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'k', PORT: '9000' });
  assert.equal(config.backend, 'supabase');
  assert.equal(config.port, 9000);
});

test('firebase backend reads its settings and allowed origins', () => {
  const config = loadConfig(firebase);
  assert.equal(config.backend, 'firebase');
  if (config.backend !== 'firebase') return;
  assert.equal(config.databaseId, 'santa-pack');
  assert.deepEqual(config.allowedOrigins, ['https://santapack.me', 'https://santa-pack-xyz.a.run.app']);
  assert.deepEqual(config.webConfig, {
    apiKey: 'public-web-key',
    authDomain: 'demo-santa-pack.firebaseapp.com',
    projectId: 'demo-santa-pack',
    tenantId: 'santa-pack-abc12',
  });
});

test('missing settings are named without echoing values', () => {
  const { FIREBASE_TENANT_ID: _omit, ...partial } = firebase;
  assert.throws(
    () => loadConfig({ ...partial, FIREBASE_API_KEY: 'should-not-appear' }),
    (error) => {
      assert.match(/** @type {Error} */ (error).message, /FIREBASE_TENANT_ID/);
      assert.doesNotMatch(/** @type {Error} */ (error).message, /should-not-appear/);
      return true;
    },
  );
});

test('mail is off without Mailgun settings, and on with all three', () => {
  const off = loadConfig(firebase);
  assert.equal(off.backend === 'firebase' && off.mailgun, null);
  const on = loadConfig({
    ...firebase,
    MAILGUN_API_KEY: 'key',
    MAILGUN_DOMAIN: 'mg.santapack.me',
    MAIL_FROM: 'Santa Pack <noreply@mg.santapack.me>',
  });
  if (on.backend !== 'firebase') return assert.fail('expected firebase');
  assert.deepEqual(on.mailgun, {
    apiKey: 'key',
    domain: 'mg.santapack.me',
    from: 'Santa Pack <noreply@mg.santapack.me>',
    apiBase: 'https://api.mailgun.net',
    testMode: false,
  });
  assert.equal(on.baseUrl, 'https://santapack.me');
});

test('half-configured mail is refused, naming the settings only', () => {
  assert.throws(
    () => loadConfig({ ...firebase, MAILGUN_API_KEY: 'should-not-appear' }),
    (error) => error instanceof Error && /MAIL_FROM/.test(error.message) && !error.message.includes('should-not'),
  );
});
