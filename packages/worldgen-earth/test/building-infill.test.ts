import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { emptyWorldgenStats, queueBuildings } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { inferBuildingFootprints } from '../src/kernel/building-infill';
import { corridor, distance, polygonsNear } from '../src/kernel/infill-geometry';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const geom: TileGeometry = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 480,
  metersPerUnit: 1,
  levelBelowMax: 0,
};
const flat = {
  sampleHeight: () => 12,
  slopeAt: () => 0,
  normalAt: (): [number, number, number] => [0, 1, 0],
};
const settings = { seed: 719 };
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing test fixture');
  return value;
}
function rectangle(x0: number, z0: number, x1: number, z1: number): TerrainSemanticPolygon {
  return {
    outer: [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
  };
}
function streets(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  for (const n of [0.15, 0.35, 0.55, 0.75, 0.95]) {
    tile.transportation.push({
      class: 'minor_road',
      subclass: 'residential',
      lines: [
        [
          [0, n],
          [1, n],
        ],
        [
          [n, 0],
          [n, 1],
        ],
      ],
    });
  }
  return tile;
}
const infer = (tile: TerrainSemanticTile) => inferBuildingFootprints(tile, geom, settings, flat);

describe('seeded building infill', () => {
  it('fills a dense unmapped street grid, without modifying source map features', () => {
    const tile = streets(),
      before = structuredClone(tile);
    const result = infer(tile);
    expect(result.length).toBeGreaterThan(30);
    expect(result.every((f) => f.tags?.['molen:inferred'] && f.class === 'house')).toBe(true);
    expect(tile).toEqual(before);
  });

  it('fills long suburban frontages without placing inaccessible rows inside blocks', () => {
    const large = { ...geom, size: 960 };
    const tile = createEmptyTerrainSemanticTile();
    for (const n of [0.1, 0.3, 0.5, 0.7, 0.9])
      tile.transportation.push({
        class: 'residential',
        lines: [
          [
            [0, n],
            [1, n],
          ],
          [
            [n, 0],
            [n, 1],
          ],
        ],
      });
    const homes = inferBuildingFootprints(tile, large, settings, flat);
    const centers = homes.map((home): [number, number] => {
      const ring = required(home.polygons[0]).outer;
      return [
        ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
        ring.reduce((sum, p) => sum + p[1], 0) / ring.length,
      ];
    });
    // Dense frontage on all four sides; no landlocked houses in the middle of a 192 m block.
    const block = centers.filter(([x, z]) => x > 0.3 && x < 0.5 && z > 0.3 && z < 0.5);
    expect(block.length).toBeGreaterThanOrEqual(30);
    expect(
      block.every(([x, z]) => Math.min(x - 0.3, 0.5 - x, z - 0.3, 0.5 - z) * large.size < 30),
    ).toBe(true);
  });

  it('keeps tightly spaced houses separated even when streets run diagonally', () => {
    const tile = streets();
    for (const road of tile.transportation)
      road.lines = road.lines.map((line) =>
        line.map(([x, z]) => [
          0.5 + (x - 0.5) * 0.8 - (z - 0.5) * 0.6,
          0.5 + (x - 0.5) * 0.6 + (z - 0.5) * 0.8,
        ]),
      );
    const homes = infer(tile);
    expect(homes.length).toBeGreaterThan(50);
    for (let i = 0; i < homes.length; i++)
      for (let j = i + 1; j < homes.length; j++) {
        const a = required(homes[i]),
          b = required(homes[j]);
        expect(polygonsNear(a.infill.parcel, b.infill.parcel, 0.1)).toBe(false);
      }
    for (const home of homes) {
      const access = home.infill.access;
      const roads = tile.transportation.flatMap((r) => r.lines);
      expect(
        Math.min(
          ...roads.map((r) =>
            distance(
              access.from,
              [required(r[0])[0] * geom.size, required(r[0])[1] * geom.size],
              [required(r[1])[0] * geom.size, required(r[1])[1] * geom.size],
            ),
          ),
        ),
      ).toBeLessThan(6);
      for (const other of homes.filter((h) => h.id !== home.id)) {
        const occupied = {
          outer: required(other.polygons[0]).outer.map(([x, z]): [number, number] => [
            x * geom.size,
            z * geom.size,
          ]),
        };
        expect(polygonsNear(corridor(access.from, access.to, access.width), occupied)).toBe(false);
      }
    }
  });

  it('uses mapped residential land to continue neighborhoods beside tile edges', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'residential',
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    });
    expect(infer(tile)).toEqual([]);
    tile.landcover.push({ class: 'residential', polygons: [rectangle(0, 0, 1, 1)] });
    const homes = infer(tile);
    expect(homes.length).toBeGreaterThan(20);
    // The same geometry without residential evidence still requires a dense street network.
    tile.landcover = [];
    expect(infer(tile)).toEqual([]);
    tile.landcover = [
      { class: 'residential', polygons: [rectangle(0, 0, 1, 1)] },
      { class: 'park', polygons: [rectangle(0, 0, 1, 1)] },
    ];
    expect(infer(tile)).toEqual([]);
  });

  it('continues a clipped street network to the tile edge without promoting split crossroads', () => {
    const tile = streets();
    const homes = infer(tile);
    const nearEdge = homes.filter((h) =>
      required(h.polygons[0]).outer.every(([x, z]) => x < 0.15 && z < 0.15),
    );
    expect(nearEdge.length).toBeGreaterThan(0);
    tile.transportation = [
      {
        class: 'residential',
        lines: [
          [
            [0, 0.1],
            [0.2, 0.1],
            [0.4, 0.1],
            [0.6, 0.1],
            [1, 0.1],
          ],
          [
            [0.1, 0],
            [0.1, 0.2],
            [0.1, 0.4],
            [0.1, 0.6],
            [0.1, 1],
          ],
        ],
      },
    ];
    expect(infer(tile)).toEqual([]);
  });

  it('includes collector streets in neighborhoods while rejecting isolated collectors', () => {
    const tile = streets();
    for (const road of tile.transportation) {
      road.class = 'major_road';
      road.subclass = 'secondary';
    }
    expect(infer(tile).length).toBeGreaterThan(30);
    tile.transportation = [required(tile.transportation[2])];
    expect(infer(tile)).toEqual([]);
  });

  it('reproduces a visit exactly, independent of map ordering, line direction and duplicate roads', () => {
    const tile = streets(),
      expected = infer(tile);
    tile.transportation.reverse();
    for (const road of tile.transportation) for (const line of road.lines) line.reverse();
    tile.transportation.push(...structuredClone(tile.transportation));
    expect(infer(tile)).toEqual(expected);
    expect(infer(structuredClone(tile))).toEqual(expected);
    expect(inferBuildingFootprints(tile, geom, { seed: 720 }, flat)).not.toEqual(expected);
  });

  it('keeps surviving buildings identical when density is lowered', () => {
    const full = infer(streets());
    const sparse = inferBuildingFootprints(streets(), geom, { ...settings, density: 0.4 }, flat);
    expect(sparse.length).toBeGreaterThan(0);
    expect(sparse.length).toBeLessThan(full.length);
    expect(
      sparse.every((f) => full.some((other) => JSON.stringify(f) === JSON.stringify(other))),
    ).toBe(true);
  });

  it('uses mapped commercial land instead of the residential pool', () => {
    const tile = streets();
    tile.landcover.push({ class: 'commercial', polygons: [rectangle(0, 0, 1, 1)] });
    const shops = infer(tile);
    expect(shops.length).toBeGreaterThan(30);
    expect(shops.every((f) => f.class === 'commercial' && f.infill.shape === 'shopfront')).toBe(
      true,
    );
  });

  it('uses nearby classified shops as weaker evidence and lets explicit residential land override them', () => {
    const tile = streets();
    for (const x of [0.22, 0.25, 0.28])
      tile.buildings.push({ class: 'retail', polygons: [rectangle(x, 0.22, x + 0.01, 0.23)] });
    const mixed = infer(tile);
    expect(mixed.some((f) => f.class === 'commercial')).toBe(true);
    expect(mixed.some((f) => f.class === 'house')).toBe(true);
    tile.landcover = [{ class: 'residential', polygons: [rectangle(0, 0, 1, 1)] }];
    expect(infer(tile).every((f) => f.class === 'house')).toBe(true);
  });

  it('rejects a lot when its approach is blocked, even if the house itself fits', () => {
    const tile = streets(),
      candidate = required(infer(tile)[0]);
    const { from, to } = candidate.infill.access;
    const x = (from[0] * 0.8 + to[0] * 0.2) / geom.size,
      z = (from[1] * 0.8 + to[1] * 0.2) / geom.size;
    tile.buildings.push({
      id: 'frontage-obstacle',
      polygons: [rectangle(x - 0.001, z - 0.001, x + 0.001, z + 0.001)],
    });
    expect(infer(tile).some((f) => f.id === candidate.id)).toBe(false);
  });

  it('sets houses behind separately mapped sidewalks while paths still connect to the street', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [{ class: 'residential', polygons: [rectangle(0, 0, 1, 1)] }];
    tile.transportation = [
      {
        class: 'residential',
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    ];
    const baseline = infer(tile);
    tile.transportation.push({
      class: 'path',
      subclass: 'sidewalk',
      width: 2,
      lines: [
        [
          [0, 0.5 + 10 / 480],
          [1, 0.5 + 10 / 480],
        ],
        [
          [0, 0.5 - 10 / 480],
          [1, 0.5 - 10 / 480],
        ],
      ],
    });
    const homes = infer(tile);
    expect(homes.length).toBe(baseline.length);
    for (const home of homes) {
      expect(Math.abs(home.infill.access.from[1] - 240)).toBeLessThan(6);
      expect(Math.abs(home.infill.access.to[1] - 240)).toBeGreaterThan(12);
      expect(required(home.polygons[0]).outer.every(([, z]) => Math.abs(z * 480 - 240) > 12)).toBe(
        true,
      );
    }
  });

  it('preserves lot anchors when a straight street is split into source segments', () => {
    const tile = streets(),
      expected = infer(tile);
    for (const road of tile.transportation)
      road.lines = road.lines.map((line) => {
        const a = required(line[0]),
          b = required(line[1]);
        return [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b];
      });
    expect(infer(tile)).toEqual(expected);
  });

  it('does not mistake an isolated road, crossroads, highways, service roads or paths for housing', () => {
    const tile = streets();
    tile.transportation = [required(tile.transportation[2])];
    expect(infer(tile)).toEqual([]);
    for (const subclass of [
      'motorway',
      'primary',
      'service',
      'parking_aisle',
      'footway',
      'track',
    ]) {
      const tile = streets();
      for (const road of tile.transportation) road.subclass = subclass;
      expect(infer(tile)).toEqual([]);
    }
    for (const property of ['bridge', 'tunnel'] as const) {
      const tile = streets();
      for (const road of tile.transportation) road[property] = true;
      expect(infer(tile)).toEqual([]);
    }
  });

  it('protects mapped land uses, water, and externally occupied footprints', () => {
    for (const kind of [
      'park',
      'forest',
      'farmland',
      'parking',
      'school',
      'industrial',
      'airport',
      'nature_reserve',
      'sand',
    ]) {
      const tile = streets();
      tile.landcover.push({ class: kind, polygons: [rectangle(0, 0, 1, 1)] });
      expect(infer(tile)).toEqual([]);
    }
    const tile = streets();
    tile.water.push({ polygons: [rectangle(0, 0, 1, 1)] });
    expect(infer(tile)).toEqual([]);
    expect(
      inferBuildingFootprints(streets(), geom, settings, flat, [rectangle(0, 0, 1, 1)]),
    ).toEqual([]);
  });

  it('rejects a narrow obstacle through a footprint, even when all corners are outside it', () => {
    const tile = streets(),
      candidate = required(infer(tile)[0]);
    const xs = required(candidate.polygons[0]).outer.map(([x]) => x),
      zs = required(candidate.polygons[0]).outer.map(([, z]) => z);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    tile.water.push({
      polygons: [rectangle(x - 0.001, Math.min(...zs) - 0.01, x + 0.001, Math.max(...zs) + 0.01)],
    });
    expect(infer(tile).some((f) => f.id === candidate.id)).toBe(false);
  });

  it('protects existing buildings and detects missing coverage locally in mixed tiles', () => {
    const tile = streets();
    const full = infer(tile);
    tile.buildings = full
      .filter((f) => required(f.polygons[0]).outer.every(([x]) => x < 0.45))
      .map((f) => ({ ...f, id: `mapped:${f.id}`, tags: {} }));
    const result = infer(tile);
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.filter((f) => required(f.polygons[0]).outer.every(([x]) => x > 0.4)).length,
    ).toBeGreaterThan(result.length * 0.8);
    tile.buildings = full.map((f) => ({ ...f, tags: {} }));
    // Filling one frontage can free a competing corner lot; any additions must still clear every
    // existing building and its own approach, rather than blanket-blocking the whole neighborhood.
    for (const added of infer(tile))
      for (const mapped of tile.buildings)
        expect(
          polygonsNear(
            added.infill.parcel,
            {
              outer: required(mapped.polygons[0]).outer.map(([x, z]): [number, number] => [
                x * geom.size,
                z * geom.size,
              ]),
            },
            0.5,
          ),
        ).toBe(false);
  });

  it('rejects steep or missing ground, generalized footprints and coarse tiles', () => {
    expect(
      inferBuildingFootprints(streets(), geom, settings, { ...flat, slopeAt: () => 0.8 }),
    ).toEqual([]);
    expect(
      inferBuildingFootprints(streets(), geom, settings, { ...flat, sampleHeight: () => NaN }),
    ).toEqual([]);
    expect(infer({ ...streets(), buildingsGeneralized: true })).toEqual([]);
    expect(
      inferBuildingFootprints(streets(), { ...geom, levelBelowMax: 2 }, settings, flat),
    ).toEqual([]);
    expect(inferBuildingFootprints(streets(), geom, false, flat)).toEqual([]);
    expect(() => inferBuildingFootprints(streets(), geom, { density: -1 }, flat)).toThrow(
      /density/,
    );
  });

  it('keeps projected identities and outlines stable in a differently scaled Earth frame', () => {
    const full = infer(streets());
    const scaled = inferBuildingFootprints(
      streets(),
      { ...geom, size: 479.52, metersPerUnit: 0.999 },
      settings,
      flat,
    );
    for (const feature of scaled) {
      const previous = full.find((f) => f.id === feature.id);
      if (!previous) continue; // Thresholds can change at the metric neighborhood boundary.
      expect(feature.levels).toBe(previous.levels);
      required(feature.polygons[0]).outer.forEach(([x, z], i) => {
        expect(x).toBeCloseTo(required(required(previous.polygons[0]).outer[i])[0], 12);
        expect(z).toBeCloseTo(required(required(previous.polygons[0]).outer[i])[1], 12);
      });
    }
  });

  it('has disjoint ownership and stable surviving homes when the same area is split into tiles', () => {
    const full = infer(streets());
    const ids = new Set<string | number | undefined>();
    let compared = 0;
    for (const ox of [0, 240])
      for (const oz of [0, 240]) {
        const tile = streets();
        for (const road of tile.transportation)
          road.lines = road.lines.map((line) =>
            line.map(([x, z]) => [x * 2 - ox / 240, z * 2 - oz / 240]),
          );
        const split = inferBuildingFootprints(
          tile,
          { ...geom, size: 240, originX: ox, originZ: oz },
          settings,
          flat,
        );
        for (const feature of split) {
          expect(ids.has(feature.id)).toBe(false);
          ids.add(feature.id);
          const original = required(full.find((f) => f.id === feature.id));
          required(feature.polygons[0]).outer.forEach(([x, z], i) => {
            const p = required(required(original.polygons[0]).outer[i]);
            expect(x * 240 + ox).toBeCloseTo(p[0] * 480, 8);
            expect(z * 240 + oz).toBeCloseTo(p[1] * 480, 8);
          });
          compared++;
        }
      }
    expect(compared).toBeGreaterThan(20);
  });

  it('routes inferred homes through regional architecture, prioritizes mapped buildings, and excludes scatter', () => {
    const tile = streets();
    tile.buildings.push({
      id: 'mapped-shed',
      class: 'building',
      polygons: [rectangle(0.01, 0.01, 0.02, 0.02)],
    });
    const batch = semanticTileToBatch(tile, geom, { pack, buildingInfill: settings }, flat);
    expect(batch.buildings.filter((b) => b.labels.includes('inferred')).length).toBeGreaterThan(30);
    const queue = queueBuildings(batch, emptyWorldgenStats());
    expect(required(queue[0]).request.identity).toBe('f:mapped-shed');
    expect(queue.every((b) => pack.archstyles[b.styleId] !== undefined)).toBe(true);
    expect(
      batch.buildings
        .filter((b) => b.labels.includes('inferred'))
        .every((b) => b.access !== undefined),
    ).toBe(true);
    const scatterOnly = semanticTileToBatch(
      tile,
      geom,
      { pack, buildingInfill: settings, features: { buildings: false } },
      flat,
    );
    expect(scatterOnly.buildings).toEqual([]);
    expect(
      scatterOnly.scatter?.exclusions.filter((e) => e.kind === 'buildings' && e.ring !== undefined)
        .length,
    ).toBe(batch.buildings.length);
    expect(
      semanticTileToBatch(tile, geom, { pack, buildingInfill: false }, flat).buildings,
    ).toHaveLength(1);
  });
});
