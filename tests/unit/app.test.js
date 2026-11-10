import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import createApp from '../../server/app.js';

/** @param {Partial<Parameters<typeof createApp>[0]>} [options] */
function testApp(options = {}) {
  return createApp({ presentsRoutes: express.Router(), familiesRoutes: express.Router(), ...options });
}

test('health endpoint reports a healthy app without exposing Express', async () => {
  const response = await request(testApp()).get('/api/health').expect(200);
  assert.deepEqual(response.body, { status: 'ok' });
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('serves the sign-in page at /login.html', async () => {
  const response = await request(testApp()).get('/login.html').expect(200);
  assert.match(response.text, /Unwrap my exchange/);
  assert.match(response.text, /Join the nice list/);
});

test('serves the home page at /', async () => {
  const response = await request(testApp()).get('/').expect(200);
  assert.match(response.text, /<title>Santa Pack<\/title>/);
});

test('serves browser-safe Supabase configuration', async () => {
  const app = testApp({
    publicConfig: { supabaseUrl: 'https://north-pole.example', supabaseAnonKey: 'public-anon-key' },
  });
  const response = await request(app).get('/supabaseClient.js').expect(200);
  assert.match(response.headers['content-type'], /javascript/);
  assert.match(response.text, /north-pole\.example/);
  assert.match(response.text, /public-anon-key/);
});

test('serves the public password recovery page', async () => {
  const response = await request(testApp()).get('/reset-password.html').expect(200);
  assert.match(response.text, /Reset your password/);
  assert.match(response.text, /autocomplete="new-password"/);
});
