import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, freshShapeName, shapeName } from '../../server/game/shapes.js';

test('a shape name is three different shapes', () => {
  for (let i = 0; i < 200; i += 1) {
    const shapes = shapeName().split(' ');
    assert.equal(shapes.length, 3);
    assert.equal(new Set(shapes).size, 3);
    assert.ok(shapes.every((shape) => SHAPES.includes(shape)));
  }
});

test('every shape can come up', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) for (const shape of shapeName().split(' ')) seen.add(shape);
  assert.equal(seen.size, SHAPES.length);
});

test('the chooser decides which shapes, in order', () => {
  assert.equal(
    shapeName(() => 0),
    SHAPES.slice(0, 3).join(' '),
  );
});

test('a fresh name avoids names already in the round', () => {
  const taken = new Set();
  for (let i = 0; i < 300; i += 1) {
    const name = freshShapeName(taken);
    assert.ok(!taken.has(name));
    taken.add(name);
  }
});
