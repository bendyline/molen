import { describe, expect, it } from 'vitest';
import { bridgeDeckHeightFn } from '../src/bridge-profile';
import { gradeHighwayBridges } from '../src/highway-grading';
import { terrainLinePath } from '../src/line-path';
import type { TerrainSemanticPoint, TerrainTransportationFeature } from '../src/semantic-types';

const road = (
  line: TerrainSemanticPoint[],
  extra: Partial<TerrainTransportationFeature> = {},
): TerrainTransportationFeature => ({
  class: 'highway',
  subclass: 'motorway',
  width: 10,
  lines: [line],
  ...extra,
});
const profile = (f: TerrainTransportationFeature | undefined) => f?.bridgeApproachProfile ?? [];

// The grading itself is covered in grade-separation.test.ts; these hold the original entry point
// and the deck profile to what callers of that name rely on.
describe('connected motorway grades', () => {
  it('does not connect an oblique crossing just because it contains the same vertex', () => {
    const result = gradeHighwayBridges(
      [
        road(
          [
            [0, 0.5],
            [0.5, 0.5],
            [1, 0.5],
          ],
          { bridge: true, layer: 1 },
        ),
        road([
          [0, 0.2],
          [0.5, 0.5],
          [1, 0.8],
        ]),
      ],
      400,
      () => 0,
    );
    expect(result[1]?.bridgeApproachProfile).toBeUndefined();
  });

  it('keeps a valley under a deck and tolerates duplicate map vertices', () => {
    const result = gradeHighwayBridges(
      [
        road(
          [
            [0, 0.5],
            [0.5, 0.5],
            [0.5, 0.5],
            [1, 0.5],
          ],
          { bridge: true },
        ),
      ],
      400,
      (x) => Math.abs(x - 200) / 10,
    );
    // Both ends are cut by the tile 20 m up the valley's sides: the deck holds their height.
    expect(profile(result[0]).every((p) => p.elevation >= 26 - 1e-9)).toBe(true);
    expect(profile(result[0]).at(-1)?.point).toEqual([1, 0.5]);
  });

  it('keeps surveyed and authored roads untouched', () => {
    const source = [
      road(
        [
          [0, 0],
          [1, 0],
        ],
        { bridge: true, deckElevation: 23 },
      ),
      road(
        [
          [0, 0.2],
          [1, 0.2],
        ],
        { bridgeConnections: [{ point: [0, 0.2], elevation: 15, radius: 80 }] },
      ),
      road(
        [
          [0, 0.4],
          [1, 0.4],
        ],
        { bridge: true },
      ),
    ];
    const result = gradeHighwayBridges(source, 400, () => 0);
    expect(result[0]).toBe(source[0]);
    expect(result[1]).toBe(source[1]);
  });

  it('grades a looping flyover by distance along the road, including both lane edges', () => {
    const path = terrainLinePath(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      100,
    );
    const height = bridgeDeckHeightFn(path, (_x, z) => z * 0.1, {
      clearance: 6,
      approachLift: 0.32,
      connects: [false, false],
    });
    for (const x of [96, 100, 104]) expect(height(x, 50)).toBeCloseTo(11);
    expect(height(50, 0)).toBeCloseTo(6 + 10 / 6);
    expect(height(50, 100)).toBeCloseTo(16); // actual terrain under the returning leg
  });
});
