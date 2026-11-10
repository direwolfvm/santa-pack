import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath } from '../../app/src/lib/dom.js';

test('sign-in only returns to paths on this site', () => {
  assert.equal(safeNextPath('/round.html?id=abc'), '/round.html?id=abc');
  for (const unsafe of [
    null,
    '',
    'round.html',
    '//evil.example',
    'https://evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ]) {
    assert.equal(safeNextPath(unsafe), '/', String(unsafe));
  }
});
