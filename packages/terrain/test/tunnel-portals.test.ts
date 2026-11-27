import { describe, expect, it } from 'vitest';
import type { TerrainTransportationFeature } from '../src/semantic-types';
import {
  findTerrainTunnelPortals,
  type TerrainTunnelPortalSeed,
  terrainTunnelBoreProfile,
  terrainTunnelCutting,
  terrainTunnelCuttingDepths,
  terrainTunnelCuttingLines,
  terrainTunnelWays,
} from '../src/tunnel-portals';

const SIZE = 1000;
/** A road's clear height, the cover over its bore and its pavement's lift. */
const FULL = 6.5 + 1.5 + 0.32;
const road = (
  line: [number, number][],
  extra: Partial<TerrainTransportationFeature> = {},
): TerrainTransportationFeature => ({
  class: 'major_road',
  subclass: 'primary',
  width: 10,
  lines: [line],
  ...extra,
});
const tunnel = (line: [number, number][], extra: Partial<TerrainTransportationFeature> = {}) =>
  road(line, { tunnel: true, ...extra });
/** An underpass 60 m long, from 500 m to 560 m east, with 300 m of road either side of it. */
const underpass = (...more: TerrainTransportationFeature[]): TerrainTransportationFeature[] => [
  road([
    [0.2, 0.5],
    [0.5, 0.5],
  ]),
  tunnel([
    [0.5, 0.5],
    [0.56, 0.5],
  ]),
  road([
    [0.56, 0.5],
    [0.86, 0.5],
  ]),
  ...more,
];
const portals = (
  tiles: { dx: number; dz: number; transportation: TerrainTransportationFeature[] }[],
): TerrainTunnelPortalSeed[] => findTerrainTunnelPortals(terrainTunnelWays(tiles, [0, 0], SIZE));
const west = (transportation: TerrainTransportationFeature[]): TerrainTunnelPortalSeed => {
  const seed = portals([{ dx: 0, dz: 0, transportation }]).find((s) => Math.abs(s.x - 500) < 1e-6);
  if (!seed) throw new Error('no western portal');
  return seed;
};
const flat = (): number => 0;

describe('tunnel portals', () => {
  it('finds both portals of an underpass and cuts each approach down by the bore it needs', () => {
    const found = portals([{ dx: 0, dz: 0, transportation: underpass() }]);
    expect(found.map((s) => [s.x, s.z])).toEqual([
      [500, 500],
      [560, 500],
    ]);
    for (const seed of found) {
      expect(seed.limit).toBe(Number.POSITIVE_INFINITY);
      expect(seed.length).toBeCloseTo(60);
      const cutting = terrainTunnelCutting(seed, flat);
      expect(cutting.depth).toBeCloseTo(FULL);
      expect(cutting.ground).toBeCloseTo(-FULL);
      expect(cutting.grade).toBe(0.08);
    }
    // The approach, from the portal outward.
    const seed = west(underpass());
    expect([seed.chain[0], seed.chain[1], seed.chain.at(-2)]).toEqual([500, 500, 200]);
  });

  it('cuts an approach no deeper than it can climb back from by where it must be on the ground', () => {
    const depth = (...more: TerrainTransportationFeature[]): number =>
      terrainTunnelCutting(west(underpass(...more)), flat).depth;
    // A side street joins 40 m short of the portal.
    const tee = road([
      [0.46, 0.5],
      [0.46, 0.2],
    ]);
    expect(depth(tee)).toBeCloseTo(0.08 * 40);
    // A street crosses it at grade 60 m out; a bridge over it there does not count.
    const across: [number, number][] = [
      [0.44, 0.4],
      [0.44, 0.6],
    ];
    expect(depth(road(across))).toBeCloseTo(0.08 * 60);
    expect(depth(road(across, { bridge: true }))).toBeCloseTo(FULL);
    // A way that stops 30 m out is on the ground where it stops: no pit at its end.
    const [, shortBore, shortFar] = underpass();
    const stub = [
      road([
        [0.47, 0.5],
        [0.5, 0.5],
      ]),
      shortBore as TerrainTransportationFeature,
      shortFar as TerrainTransportationFeature,
    ];
    expect(terrainTunnelCutting(west(stub), flat).depth).toBeCloseTo(0.08 * 30);
    // A junction at the portal's mouth: it is on the ground there.
    expect(
      depth(
        road([
          [0.5, 0.5],
          [0.5, 0.2],
        ]),
      ),
    ).toBe(0);
    // An approach that goes on over a bridge stays up with it.
    const [, bore, far] = underpass();
    const bridged = [
      road(
        [
          [0.2, 0.5],
          [0.5, 0.5],
        ],
        { bridge: true },
      ),
      bore as TerrainTransportationFeature,
      far as TerrainTransportationFeature,
    ];
    expect(terrainTunnelCutting(west(bridged), flat).depth).toBe(0);
  });

  it('cuts little or nothing where a hillside closes over the portal', () => {
    const hillside = (slope: number) => (x: number) => Math.max(0, x - 500) * slope;
    expect(terrainTunnelCutting(west(underpass()), hillside(1)).depth).toBe(0);
    const gentle = terrainTunnelCutting(west(underpass()), hillside(0.6)).depth;
    expect(gentle).toBeGreaterThan(0);
    expect(gentle).toBeLessThan(FULL / 2);
  });

  it('follows an approach over a tile edge, and stops where the tile beyond is not known', () => {
    const near = {
      dx: 1,
      dz: 0,
      transportation: [
        road([
          [-0.02, 0.5],
          [0.05, 0.5],
        ]),
        tunnel([
          [0.05, 0.5],
          [0.11, 0.5],
        ]),
        road([
          [0.11, 0.5],
          [0.3, 0.5],
        ]),
      ],
    };
    const beyond = {
      dx: 0,
      dz: 0,
      transportation: [
        road([
          [0.7, 0.5],
          [1.02, 0.5],
        ]),
      ],
    };
    const portal = (tiles: (typeof near)[]): TerrainTunnelPortalSeed => {
      const seed = portals(tiles).find((s) => Math.abs(s.x - 1050) < 1e-6);
      if (!seed) throw new Error('no portal');
      return seed;
    };
    const across = portal([beyond, near]);
    expect(across.limit).toBe(Number.POSITIVE_INFINITY);
    expect(across.chain.at(-2)).toBeCloseTo(700);
    expect(terrainTunnelCutting(across, flat).depth).toBeCloseTo(FULL);
    const cut = portal([near]);
    expect(cut.limit).toBeCloseTo(50);
    expect(terrainTunnelCutting(cut, flat).depth).toBeCloseTo(0.08 * 50);
  });

  it('cuts the stations along an approach, and nothing beside or across it', () => {
    const cutting = terrainTunnelCutting(west(underpass()), flat);
    const stations = (from: [number, number], to: [number, number]) => {
      const points: number[] = [];
      for (let k = 0; k <= 60; k++)
        points.push(from[0] + ((to[0] - from[0]) * k) / 60, from[1] + ((to[1] - from[1]) * k) / 60);
      return {
        points: Float64Array.from(points),
        bounds: [
          Math.min(from[0], to[0]),
          Math.min(from[1], to[1]),
          Math.max(from[0], to[0]),
          Math.max(from[1], to[1]),
        ] as [number, number, number, number],
      };
    };
    const along = stations([200, 500], [500, 500]);
    const depths = terrainTunnelCuttingDepths(along.points, along.bounds, [cutting]);
    expect(depths?.[60]).toBeCloseTo(FULL);
    expect(depths?.[50]).toBeCloseTo(FULL - 0.08 * 50);
    expect(depths?.[0]).toBe(0);
    const beside = stations([200, 510], [500, 510]);
    expect(terrainTunnelCuttingDepths(beside.points, beside.bounds, [cutting])).toBeUndefined();
    const crossing = stations([480, 350], [480, 650]);
    expect(terrainTunnelCuttingDepths(crossing.points, crossing.bounds, [cutting])).toBeUndefined();
  });

  it('grades the approach to a footpath tunnel, which the ground is not graded for otherwise', () => {
    const path = (line: [number, number][], extra: Partial<TerrainTransportationFeature> = {}) =>
      road(line, { class: 'path', subclass: 'footway', width: 2.4, ...extra });
    const seed = west([
      path([
        [0.2, 0.5],
        [0.5, 0.5],
      ]),
      path(
        [
          [0.5, 0.5],
          [0.53, 0.5],
        ],
        { tunnel: true },
      ),
      path([
        [0.53, 0.5],
        [0.8, 0.5],
      ]),
    ]);
    const cutting = terrainTunnelCutting(seed, flat);
    const full = 3.5 + 1.5 + 0.43;
    expect(cutting.depth).toBeCloseTo(full);
    expect(cutting.grade).toBe(0.083);
    const [line] = terrainTunnelCuttingLines([cutting]);
    expect(line?.halfWidth).toBeCloseTo(1.8);
    expect(line?.depths?.[0]).toBeCloseTo(full);
    expect(line?.depths?.at(-1)).toBeCloseTo(0);
    expect(line?.points[0]).toBe(500);
    // A road's approach has an earthwork line of its own.
    expect(terrainTunnelCuttingLines([terrainTunnelCutting(west(underpass()), flat)])).toEqual([]);
  });

  it('fits a bore under level ground, runs it straight through a hill, and keeps its portals', () => {
    const level = terrainTunnelBoreProfile(180, () => 10, 10.32, 10.32, {
      grade: 0.08,
      clearance: 6.5,
    });
    expect(level.floorAt(0)).toBeCloseTo(10.32);
    expect(level.floorAt(90)).toBeCloseTo(10.32 - 0.08 * 90);
    expect(level.floorAt(180)).toBeCloseTo(10.32);
    expect(level.groundAt(42)).toBe(10);
    const hill = terrainTunnelBoreProfile(180, () => 80, 10.32, 10.32, {
      grade: 0.08,
      clearance: 6.5,
    });
    expect(hill.floorAt(90)).toBeCloseTo(10.32);
    // From the floors of their cuttings, under cover all the way.
    const cut = terrainTunnelBoreProfile(180, () => 10, 2, 2, { grade: 0.08, clearance: 6.5 });
    expect(cut.floorAt(60)).toBeCloseTo(2);
    // Portals farther apart in height than the grade climbs: still met exactly.
    const steep = terrainTunnelBoreProfile(100, () => 200, 0, 20, { grade: 0.08, clearance: 6.5 });
    expect(steep.floorAt(0)).toBeCloseTo(0);
    expect(steep.floorAt(50)).toBeCloseTo(10);
    expect(steep.floorAt(100)).toBeCloseTo(20);
    // A dip in the hill: under it with cover, going down to it at the grade, no further.
    const dip = terrainTunnelBoreProfile(600, (d) => (d > 270 && d < 330 ? 0 : 40), 10, 10, {
      grade: 0.08,
      clearance: 6.5,
    });
    expect(dip.floorAt(300)).toBeCloseTo(-8);
    expect(dip.floorAt(240)).toBeCloseTo(-8 + 0.08 * 36);
    expect(dip.floorAt(20)).toBeCloseTo(10);
    // Deeper than the grade can reach from the portals: as low as it can.
    const gorge = terrainTunnelBoreProfile(300, (d) => (d > 120 && d < 180 ? -20 : 40), 10, 10, {
      grade: 0.08,
      clearance: 6.5,
    });
    expect(gorge.floorAt(150)).toBeCloseTo(10 - 0.08 * 150);
  });
});
