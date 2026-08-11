const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const createApp = require('../../src/app');

function emptyRouter() { return express.Router(); }

test('health endpoint reports a healthy app without exposing Express', async () => {
  const response = await request(createApp({ presentsRoutes: emptyRouter(), familiesRoutes: emptyRouter() }))
    .get('/api/health')
    .expect(200);
  assert.deepEqual(response.body, { status: 'ok' });
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('serves the refreshed sign-in experience', async () => {
  const response = await request(createApp({ presentsRoutes: emptyRouter(), familiesRoutes: emptyRouter() }))
    .get('/login.html')
    .expect(200);
  assert.match(response.text, /Unwrap my exchange/);
  assert.match(response.text, /Join the nice list/);
});

test('serves browser-safe Supabase configuration from the environment', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://north-pole.example';
  process.env.SUPABASE_ANON_KEY = 'public-anon-key';
  const response = await request(createApp({ presentsRoutes: emptyRouter(), familiesRoutes: emptyRouter() }))
    .get('/supabaseClient.js')
    .expect(200);
  assert.match(response.text, /north-pole\.example/);
  assert.match(response.text, /public-anon-key/);
  if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
});
