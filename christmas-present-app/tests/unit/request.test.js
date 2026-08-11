const test = require('node:test');
const assert = require('node:assert/strict');
const { canManageFamily, getBearerToken, requireText } = require('../../src/lib/request');

test('getBearerToken accepts a well-formed bearer header', () => {
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer merry-token' } }), 'merry-token');
});

test('getBearerToken rejects missing and malformed headers', () => {
  assert.equal(getBearerToken({ headers: {} }), null);
  assert.equal(getBearerToken({ headers: { authorization: 'Basic abc' } }), null);
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer' } }), null);
});

test('requireText trims valid values and rejects blank or oversized input', () => {
  assert.equal(requireText('  Christmas Eve  ', 'name'), 'Christmas Eve');
  assert.throws(() => requireText('   ', 'name'), /name is required/);
  assert.throws(() => requireText('too-long', 'code', { maxLength: 4 }), /4 characters or fewer/);
});

function personLookup(result) {
  const filters = [];
  const query = {
    select() { return query; },
    eq(field, value) { filters.push([field, value]); return query; },
    maybeSingle: async () => ({ data: result, error: null })
  };
  return {
    filters,
    supabase: { from(table) { assert.equal(table, 'person'); return query; } }
  };
}

test('admins can manage every family without requiring a membership row', async () => {
  const supabase = { from() { throw new Error('admin lookup should not query membership'); } };
  assert.equal(await canManageFamily(supabase, 'admin-1', 'admin', 101), true);
});

test('managers can only manage a family with a matching membership', async () => {
  const member = personLookup({ id: 1001 });
  assert.equal(await canManageFamily(member.supabase, 'manager-1', 'manager', 101), true);
  assert.deepEqual(member.filters, [['user_profile', 'manager-1'], ['family', 101]]);

  const outsider = personLookup(null);
  assert.equal(await canManageFamily(outsider.supabase, 'manager-2', 'manager', 101), false);
  assert.equal(await canManageFamily(outsider.supabase, 'user-1', 'user', 101), false);
});
