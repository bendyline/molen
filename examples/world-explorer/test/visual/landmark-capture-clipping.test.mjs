import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewClipping } from './landmark-capture-clipping.mjs';

test('distant bridge views retain millimetre depth precision and include the full bounds', () => {
  const { near, far } = reviewClipping(240, 255);
  const quantizationAt = (distance) =>
    (distance * distance * (far - near)) / (far * near * (2 ** 24 - 1));
  assert(quantizationAt(255) < 0.001);
  assert(near < 240 && far > 255);
});
test('close or interior cameras keep their original near plane', () => {
  assert.equal(reviewClipping(-20, 80).near, 0.1);
  assert.equal(reviewClipping(0.12, 80).near, 0.1);
  assert.equal(reviewClipping(100, 800).near, 0.1);
});
test('exceptionally long structures remain inside the far plane', () => {
  const { near, far } = reviewClipping(20000, 30000);
  assert(near < 20000 && far > 30000);
});
