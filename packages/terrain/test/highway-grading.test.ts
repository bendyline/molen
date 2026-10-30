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

describe('connected motorway grades', () => {
  it('fades a cloverleaf along its full route rather than lifting its returning leg', () => {
    const result = gradeHighwayBridges(
      [
        road(
          [
            [0.3, 0.5],
            [0.4, 0.5],
          ],
          { bridge: true },
        ),
        road(
          [
            [0.4, 0.5],
            [0.55, 0.5],
            [0.6, 0.6],
            [0.5, 0.7],
            [0.4, 0.6],
            [0.41, 0.51],
          ],
          { link: true },
        ),
      ],
      400,
      () => 0,
    );
    const samples = profile(result[1]);
    expect(samples[0]?.elevation).toBe(6);
    expect(samples.at(-1)?.elevation).toBe(0.32);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]?.elevation).toBeLessThanOrEqual((samples[i - 1]?.elevation ?? 0) + 1e-8);
    }
  });
  it('holds a short overpass level and spreads its approach over several mapped ways', () => {
    const source = [
      road([
        [0, 0.5],
        [0.4, 0.5],
      ]),
      road(
        [
          [0.4, 0.5],
          [0.45, 0.5],
        ],
        { name: 'short approach' },
      ),
      road(
        [
          [0.45, 0.5],
          [0.55, 0.5],
        ],
        { bridge: true, layer: 1 },
      ),
      road([
        [0.55, 0.5],
        [1, 0.5],
      ]),
      road([
        [0.5, 0],
        [0.5, 1],
      ]), // underpass, no mapped connection
    ];
    const before = JSON.stringify(source);
    const result = gradeHighwayBridges(source, 400, () => 0);
    expect(JSON.stringify(source)).toBe(before);
    for (const p of profile(result[2])) expect(p.elevation).toBe(6);
    expect(profile(result[1]).at(-1)?.elevation).toBe(6);
    expect(profile(result[0]).at(-1)?.elevation).toBe(profile(result[1])[0]?.elevation);
    expect(profile(result[0])[0]?.elevation).toBe(0.32);
    expect(result[4]?.bridgeApproachProfile).toBeUndefined();
    for (const f of result.slice(0, 4)) {
      const p = profile(f);
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1] as (typeof p)[number],
          b = p[i] as (typeof p)[number];
        const distance = Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1]) * 400;
        expect(Math.abs(a.elevation - b.elevation) / distance).toBeLessThanOrEqual(0.061);
      }
    }
  });

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

  it('keeps layered decks separate, preserves valleys and tolerates duplicate map vertices', () => {
    const result = gradeHighwayBridges(
      [
        road(
          [
            [0, 0.5],
            [0.5, 0.5],
            [0.5, 0.5],
            [1, 0.5],
          ],
          { bridge: true, layer: 1 },
        ),
        road(
          [
            [0.5, 0],
            [0.5, 1],
          ],
          { bridge: true, layer: 2 },
        ),
      ],
      400,
      (x) => Math.abs(x - 200) / 10,
    );
    expect(profile(result[0]).every((p) => p.elevation >= 26)).toBe(true);
    expect(profile(result[1]).every((p) => p.elevation === 12)).toBe(true);
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
