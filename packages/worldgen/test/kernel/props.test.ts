import { describe, expect, it } from 'vitest';
import { distancePointToRing, pointInPolygon } from '../../src/kernel/geometry2d';
import { type PropContext, type PropPlacement, placeProps } from '../../src/kernel/props';
import type { RecipeProp } from '../../src/kernel/recipe';
import type { Vec2 } from '../../src/kernel/types';

const shrubs: RecipeProp = {
  id: 'foundation-shrubs',
  model: 'builtin:shrub',
  anchor: 'ground-any',
  count: 6,
  scale: 0.6,
  spacing: 1.7,
  margin: 1.1,
  yaw: 'random',
  lodTier: 0,
  color: [1, 1, 1],
};

function context(outline: Vec2[]): PropContext {
  return {
    outline,
    holes: [],
    eave: 6,
    parapetHeight: 0,
    ridges: [],
    frameYaw: 0,
    salt: 7,
    // A slope across the lot.
    ground: (x, z) => 100 + x * 0.1 + z * 0.05,
    // The door, 1.05 m wide, in the middle of the 12 m front wall (edge 0).
    clear: [{ edge: 0, start: 5.475, end: 6.525 }],
  };
}

describe('ground props', () => {
  it('plants round the outside of the walls, on the ground, clear of the door', () => {
    const outline: Vec2[] = [
      [0, 0],
      [12, 0],
      [12, 9],
      [0, 9],
    ];
    for (const ring of [outline, [...outline].reverse()]) {
      const front = ring === outline ? 0 : 2;
      const ctx = { ...context(ring), clear: [{ edge: front, start: 5.475, end: 6.525 }] };
      const out: PropPlacement[] = [];
      expect(placeProps([shrubs], ctx, out)).toBe(6);
      for (const shrub of out) {
        const point: Vec2 = [shrub.x, shrub.z];
        expect(pointInPolygon(point, ring)).toBe(false);
        const gap = distancePointToRing(point, ring);
        expect(gap).toBeGreaterThan(0.45);
        expect(gap).toBeLessThan(0.7);
        expect(shrub.y).toBeCloseTo(100 + shrub.x * 0.1 + shrub.z * 0.05 - 0.08, 5);
      }
      // Spread round the house: at least three of its four sides, and none before the door.
      const sides = new Set(
        out.map((s) => (s.z < 0 ? 'front' : s.z > 9 ? 'back' : s.x < 0 ? 'left' : 'right')),
      );
      expect(sides.size).toBeGreaterThanOrEqual(3);
      for (const shrub of out)
        if (shrub.z < 0) expect(Math.abs(shrub.x - 6)).toBeGreaterThan(0.525 + 0.5);
    }
  });

  it('skips spots a reflex corner folds back into another wing', () => {
    // An L: the inside corner's set-out spots would land in the other wing.
    const outline: Vec2[] = [
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
    ];
    const out: PropPlacement[] = [];
    placeProps([{ ...shrubs, count: 40 }], { ...context(outline), clear: [] }, out);
    expect(out.length).toBeGreaterThan(8);
    for (const shrub of out) {
      expect(pointInPolygon([shrub.x, shrub.z], outline)).toBe(false);
      expect(distancePointToRing([shrub.x, shrub.z], outline)).toBeGreaterThan(0.45);
    }
  });
});
