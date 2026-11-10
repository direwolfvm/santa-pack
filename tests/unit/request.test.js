import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpError,
  canManageFamily,
  getBearerToken,
  getRequestDatabase,
  requireText,
} from '../../server/lib/request.js';

test('getBearerToken accepts a well-formed bearer header', () => {
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer merry-token' } }), 'merry-token');
});

test('getBearerToken rejects missing and malformed headers', () => {
  assert.equal(getBearerToken({ headers: {} }), null);
  assert.equal(getBearerToken({ headers: { authorization: 'Basic abc' } }), null);
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer' } }), null);
});

test('getRequestDatabase scopes supported clients to the request token', () => {
  const scoped = { name: 'scoped client' };
  const supabase = {
    /** @param {string} token */
    forRequest(token) {
      assert.equal(token, 'merry-token');
      return scoped;
    },
  };
  assert.equal(getRequestDatabase(supabase, { headers: { authorization: 'Bearer merry-token' } }), scoped);
  assert.equal(getRequestDatabase(supabase, { headers: {} }), supabase);
});

test('requireText trims valid values and rejects blank or oversized input', () => {
  assert.equal(requireText('  Christmas Eve  ', 'name'), 'Christmas Eve');
  assert.throws(() => requireText('   ', 'name'), /name is required/);
  assert.throws(
    () => requireText('   ', 'name'),
    (error) => error instanceof HttpError && error.status === 400,
  );
  assert.throws(() => requireText('too-long', 'code', { maxLength: 4 }), /4 characters or fewer/);
});

/** @param {object | null} result */
function personLookup(result) {
  /** @type {Array<[string, unknown]>} */
  const filters = [];
  const query = {
    select() {
      return query;
    },
    /** @param {string} field @param {unknown} value */
    eq(field, value) {
      filters.push([field, value]);
      return query;
    },
    maybeSingle: async () => ({ data: result, error: null }),
  };
  return {
    filters,
    supabase: {
      /** @param {string} table */
      from(table) {
        assert.equal(table, 'person');
        return query;
      },
    },
  };
}

test('admins can manage every family without requiring a membership row', async () => {
  const supabase = {
    from() {
      throw new Error('admin lookup should not query membership');
    },
  };
  assert.equal(await canManageFamily(supabase, 'admin-1', 'admin', 101), true);
});

test('managers can only manage a family with a matching membership', async () => {
  const member = personLookup({ id: 1001 });
  assert.equal(await canManageFamily(member.supabase, 'manager-1', 'manager', 101), true);
  assert.deepEqual(member.filters, [
    ['user_profile', 'manager-1'],
    ['family', 101],
  ]);

  const outsider = personLookup(null);
  assert.equal(await canManageFamily(outsider.supabase, 'manager-2', 'manager', 101), false);
  assert.equal(await canManageFamily(outsider.supabase, 'user-1', 'user', 101), false);
});
