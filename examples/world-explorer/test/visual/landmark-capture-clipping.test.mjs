import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placementReviewTile, reviewClipping } from './landmark-capture-clipping.mjs';

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

test('an off-origin native frame uses a local query without moving the model', () => {
  const anchor = [50000, 80000],
    corners = [
      [50116, 80139],
      [50148, 80096],
    ],
    tile = placementReviewTile(anchor, corners, true);
  assert.equal(tile.tileSize, 128);
  for (const p of corners)
    for (let i = 0; i < 2; i++) {
      assert(p[i] >= tile.origin[i] && p[i] <= tile.origin[i] + tile.tileSize);
      // Renderer vertices are tile-local; the review translation restores the
      // source-native offset rather than recentering the authored structure.
      assert.equal(p[i] - tile.origin[i] + tile.tileTranslation[i], p[i] - anchor[i]);
    }
  assert(Math.hypot(tile.tileSize, tile.tileSize) < 2 * Math.hypot(32, 43) + 222);
});

test('bounded negative offsets keep their native frame and unbounded queries retain their stage', () => {
  const tile = placementReviewTile(
    [0, 0],
    [
      [-108, -38],
      [-36, -76],
    ],
    true,
  );
  assert.deepEqual(tile.center, [-72, -57]);
  assert.equal(tile.tileSize, 128);
  assert.equal(-108 - tile.origin[0] + tile.tileTranslation[0], -108);
  const unbounded = placementReviewTile(
    [0, 0],
    [
      [116, 139],
      [148, 96],
    ],
    false,
  );
  assert.deepEqual(unbounded.center, [0, 0]);
  assert.equal(unbounded.tileSize, 312);
});

test('point-only review queries preserve their existing origin and size', () => {
  const tile = placementReviewTile([50000, 80000], [], false);
  assert.equal(tile.tileSize, 256);
  assert.deepEqual(tile.origin, [49872, 79872]);
  assert.deepEqual(tile.tileTranslation, [-128, -128]);
});
