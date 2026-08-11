const test = require('node:test');
const assert = require('node:assert/strict');
const { getBearerToken, requireText } = require('../../src/lib/request');

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
