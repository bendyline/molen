import { describe, expect, it } from 'vitest';
import { bridgeDeckHeightFn } from '../src/bridge-profile';
import { terrainLinePath } from '../src/line-path';

describe('authored bridge ground approaches', () => {
  it('retains a graded height when the painted tile or traffic edge starts between samples', () => {
    const path = terrainLinePath(
      [
        [0.125, 0],
        [0.375, 0],
      ],
      40,
    );
    const height = bridgeDeckHeightFn(path, () => 5, {
      clearance: 6,
      approachLift: 0.32,
      groundApproach: true,
      connects: [true, true],
      approachProfile: [
        { point: [0, 0], elevation: 18, flatness: 1 },
        { point: [10, 0], elevation: 20, flatness: 1 },
        { point: [20, 0], elevation: 22, flatness: 1 },
      ],
    });
    expect(height(5, 0)).toBeCloseTo(19);
    expect(height(15, 0)).toBeCloseTo(21);
  });
  it('keeps bent, sampled approaches flat across the join and restores native crossfall beyond grading', () => {
    const path = terrainLinePath(
      [
        [0, 0],
        [0.5, 0],
        [0.5, 0.5],
      ],
      40,
    );
    const ground = (x: number, z: number) => 5 + x * 0.1 + z * 0.3;
    const height = bridgeDeckHeightFn(path, ground, {
      clearance: 6,
      approachLift: 0.32,
      connects: [true, true],
      groundApproach: true,
      approachProfile: [
        { point: [0, 0], elevation: 18, flatness: 1 },
        { point: [20, 0], elevation: 18, flatness: 1 },
        { point: [20, 10], elevation: 18, flatness: 1 },
        { point: [20, 15], elevation: ground(20, 15) + 0.32, flatness: 0 },
        { point: [20, 20], elevation: ground(20, 20) + 0.32, flatness: 0 },
      ],
    });
    for (const z of [-5, 0, 5]) expect(height(0, z)).toBeCloseTo(18);
    for (const x of [16, 20, 24]) expect(height(x, 6)).toBeCloseTo(18);
    expect(height(23, 18)).toBeCloseTo(ground(23, 18) + 0.32);
  });
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

describe('profiles graded over other ground than is drawn', () => {
  const path = terrainLinePath(
    [
      [0, 0],
      [1, 0],
    ],
    100,
  );
  // A deck landing at x = 0, graded over ground standing at 10 m.
  const deck = [0, 25, 50, 75, 100].map((x, i) => ({
    point: [x, 0] as [number, number],
    elevation: 10.32 + ([0, 1.5, 3, 4.5, 6][i] as number),
    flatness: 1,
    ground: 10,
    anchor: [1, 0.5, 0, 0, 0][i] as number,
  }));
  const options = { clearance: 6, approachLift: 0.32, connects: [true, true] as const };

  it('moves a deck onto the ground drawn at its landing, and leaves its span where it was', () => {
    const height = bridgeDeckHeightFn(path, () => 11, { ...options, approachProfile: deck });
    expect(height(0, 0)).toBeCloseTo(11.32);
    expect(height(25, 0)).toBeCloseTo(12.32);
    for (const x of [50, 75, 100]) expect(height(x, 0)).toBeCloseTo(10.32 + (x / 25) * 1.5);
    // Drawn on the ground it was graded over, nothing moves.
    const same = bridgeDeckHeightFn(path, () => 10, { ...options, approachProfile: deck });
    for (const x of [0, 25, 50]) expect(same(x, 0)).toBeCloseTo(10.32 + (x / 25) * 1.5);
  });

  it('follows the nearest sample on its own ground for those beyond it', () => {
    // A climbing road, on the ground throughout; this tile's ground ends at x = 40, and what
    // the sampler says past there is another tile's business.
    const road = deck.map((sample) => ({ ...sample, anchor: 1 }));
    const ground = (x: number): number => (x <= 40 ? 11 : 50);
    const bounded = bridgeDeckHeightFn(path, ground, {
      ...options,
      approachProfile: road,
      bounds: [0, -10, 40, 10],
    });
    for (const x of [0, 25, 50, 75, 100]) expect(bounded(x, 0)).toBeCloseTo(11.32 + (x / 25) * 1.5);
    // Without bounds every sample trusts the sampler, within a few meters.
    const trusting = bridgeDeckHeightFn(path, ground, { ...options, approachProfile: road });
    expect(trusting(75, 0)).toBeCloseTo(10.32 + 4.5 + 4);
  });
});
