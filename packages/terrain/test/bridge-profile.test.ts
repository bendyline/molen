import { describe, expect, it } from 'vitest';
import { bridgeDeckHeightFn } from '../src/bridge-profile';
import { terrainLinePath } from '../src/line-path';

describe('authored bridge ground approaches', () => {
  it('keeps an uphill bank above ground instead of flattening it toward the deck', () => {
    const path = terrainLinePath(
      [
        [0, 0],
        [1, 0],
      ],
      40,
    );
    const ground = (x: number) => 5 + x * 0.4;
    const height = bridgeDeckHeightFn(path, ground, {
      clearance: 3,
      approachLift: 0.12,
      connects: [true, true],
      groundApproach: true,
      connections: [{ point: [0, 0], elevation: 5.12, radius: 20 }],
    });
    for (const x of [0, 1, 4, 8, 12, 20, 40]) {
      expect(height(x, 0)).toBeCloseTo(ground(x) + 0.12);
    }
  });

  it('pins a whole offset cross-section and returns to the native crossfall', () => {
    const path = terrainLinePath(
      [
        [0, 0],
        [1, 0],
      ],
      40,
    );
    const ground = (x: number, z: number) => 5 + x * 0.4 + z * 0.15;
    const height = bridgeDeckHeightFn(path, ground, {
      clearance: 6,
      approachLift: 0.32,
      connects: [true, true],
      groundApproach: true,
      connections: [{ point: [0, 0], elevation: 6, radius: 20 }],
    });
    for (const z of [-6, 0, 6]) {
      expect(height(0, z)).toBeCloseTo(6);
      expect(height(30, z)).toBeCloseTo(ground(30, z) + 0.32);
      for (const x of [1, 4, 8, 12, 20]) expect(height(x, z)).toBeGreaterThan(ground(x, z));
    }
  });

  it('retains distinct endpoint heights when two hint radii overlap', () => {
    const path = terrainLinePath(
      [
        [0, 0],
        [1, 0],
      ],
      20,
    );
    const height = bridgeDeckHeightFn(path, (x) => 5 + x * 0.1, {
      clearance: 6,
      approachLift: 0.32,
      connects: [true, true],
      groundApproach: true,
      connections: [
        { point: [0, 0], elevation: 18, radius: 40 },
        { point: [20, 0], elevation: 22, radius: 40 },
      ],
    });
    expect(height(0, 0)).toBeCloseTo(18);
    expect(height(20, 0)).toBeCloseTo(22);
    expect(height(10, 0)).toBeGreaterThan(6.32);
    expect(height(10, 0)).toBeLessThan(22);
  });
});
