// @ts-nocheck -- Supabase controllers are replaced in phase 2 of docs/overhaul-plan.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import PresentsController from '../../server/controllers/presentsController.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send() {
      return this;
    },
  };
}

test('creating a present requires an authenticated session', async () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  const req = { headers: {}, body: { name: 'Train set' } };
  const res = responseRecorder();
  await new PresentsController(supabase).createPresent(req, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Unauthorized' });
});

test('updating a present requires an authenticated session', async () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  const req = { headers: {}, params: { id: '9' }, body: { name: 'Train set' } };
  const res = responseRecorder();
  await new PresentsController(supabase).updatePresent(req, res);
  assert.equal(res.statusCode, 401);
});
