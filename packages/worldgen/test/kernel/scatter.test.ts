import { describe, expect, it } from 'vitest';
import { generateWorldgenBatch } from '../../src/kernel/batch';
import { dilate, RasterGrid, rasterizePolygon, rasterizePolyline } from '../../src/kernel/raster';
import { samplePlacements } from '../../src/kernel/scatter';
import type { ScatterDoc } from '../../src/kernel/scatter-types';
import {
  FLAT_GROUND,
  PLACEMENT_STRIDE,
  type PlacementSet,
  type ScatterRequest,
  type Vec2,
} from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';

const pack = await createTestPack();
const doc = pack.scatters['test.pack.scatter.basic'] as ScatterDoc;
const identity = { name: pack.root.name, version: pack.root.version };
const budget = { maxInstancesPerRule: 100_000, maxInstances: 1_000_000, maxPropModels: 8 };

function rect(x0: number, z0: number, x1: number, z1: number): Vec2[] {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

function request(
  bounds: [number, number, number, number],
  overrides: Partial<ScatterRequest> = {},
): ScatterRequest {
  return {
    polygons: [{ label: 'forest', ring: rect(bounds[0], bounds[1], bounds[2], bounds[3]) }],
    exclusions: [],
    emitBounds: bounds,
    frame: { originX: 0, originZ: 0, unitsPerMeter: 1 },
    keep: 1,
    ...overrides,
  };
}

function positions(sets: readonly PlacementSet[]): string[] {
  const keys: string[] = [];
  for (const set of sets) {
    for (let index = 0; index < set.count; index++) {
      const offset = index * PLACEMENT_STRIDE;
      keys.push(
        `${set.modelRef}:${(set.data[offset] as number).toFixed(3)},${(set.data[offset + 2] as number).toFixed(3)}`,
      );
    }
  }
  return keys.sort();
}

function sample(req: ScatterRequest, tier = 0): PlacementSet[] {
  return samplePlacements({ request: req, doc, pack: identity, ground: FLAT_GROUND, budget, tier });
}

describe('rasters', () => {
  it('fills polygons with holes, stamps polylines, and dilates', () => {
    const raster = new RasterGrid([0, 0, 40, 40], 1);
    rasterizePolygon(raster, rect(5, 5, 25, 25), [rect(10, 10, 15, 15)], 7);
    expect(raster.get(6, 6)).toBe(7);
    expect(raster.get(12, 12)).toBe(0);
    expect(raster.get(30, 30)).toBe(0);
    const lines = new RasterGrid([0, 0, 40, 40], 1);
    rasterizePolyline(
      lines,
      [
        [0, 20],
        [40, 20],
      ],
      2,
      1,
    );
    expect(lines.get(20, 20)).toBe(1);
    expect(lines.get(20, 21.5)).toBe(1);
    expect(lines.get(20, 25)).toBe(0);
    dilate(lines, 3);
    expect(lines.get(20, 24.5)).toBe(1);
    expect(lines.get(20, 30)).toBe(0);
  });
});

describe('scatter sampling', () => {
  it('uses owner seeds without breaking shared cells, tile ownership, or nested thinning', () => {
    const polygon = { label: 'forest', ring: rect(0, 0, 400, 400), seed: 1234, density: 0.7 };
    const req = request([0, 0, 400, 400], { polygons: [polygon] });
    const whole = sample(req);
    expect(sample(req)).toEqual(whole);
    const halves = [
      sample({ ...req, emitBounds: [0, 0, 200, 400] }),
      sample({ ...req, emitBounds: [200, 0, 400, 400] }),
    ].flat();
    expect(positions(halves)).toEqual(positions(whole));
    const fine = new Set(positions(whole));
    for (const key of positions(sample(req, 1))) expect(fine.has(key)).toBe(true);
    expect(positions(sample({ ...req, polygons: [{ ...polygon, seed: 5678 }] }))).not.toEqual(
      positions(whole),
    );
    // Properties of surviving trees remain identical when the fill factor decreases.
    const thinner = sample({ ...req, polygons: [{ ...polygon, density: 0.2 }] });
    for (const set of thinner)
      for (let i = 0; i < set.count; i++) {
        const data = [...set.data.slice(i * 10, (i + 1) * 10)];
        const original = whole.find((entry) => entry.modelRef === set.modelRef);
        expect(
          Array.from({ length: original?.count ?? 0 }, (_, j) => [
            ...(original?.data.slice(j * 10, (j + 1) * 10) ?? []),
          ]),
        ).toContainEqual(data);
      }
  });

  it('is deterministic and world-anchored across neighbouring and nested batches', () => {
    const whole = positions(sample(request([0, 0, 400, 400])));
    expect(whole.length).toBeGreaterThan(1000);
    expect(positions(sample(request([0, 0, 400, 400])))).toEqual(whole);
    const quadrants = (['0,0', '200,0', '0,200', '200,200'] as const).flatMap((corner) => {
      const [x, z] = corner.split(',').map(Number) as [number, number];
      return sample(request([x, z, x + 200, z + 200]));
    });
    expect(positions(quadrants)).toEqual(whole);
    const shifted = sample(
      request([0, 0, 400, 400], {
        polygons: [{ label: 'forest', ring: rect(0, 0, 400, 400) }],
        frame: { originX: -1000, originZ: 250, unitsPerMeter: 1 },
      }),
    );
    expect(positions(shifted)).not.toEqual(whole);
  });

  it('keeps coarser tiers as nested subsets of finer ones', () => {
    const fine = new Set(positions(sample(request([0, 0, 300, 300]), 0)));
    const coarse = positions(sample(request([0, 0, 300, 300]), 1));
    expect(coarse.length).toBeGreaterThan(0);
    expect(coarse.length).toBeLessThan(fine.size * 0.6);
    for (const key of coarse) expect(fine.has(key)).toBe(true);
  });

  it('respects labels, exclusions, and slope limits', () => {
    const sets = sample(
      request([0, 0, 200, 200], {
        polygons: [
          { label: 'forest', ring: rect(0, 0, 100, 200) },
          { label: 'water', ring: rect(100, 0, 200, 200) },
        ],
        exclusions: [
          {
            polyline: [
              [50, 0],
              [50, 200],
            ],
            width: 6,
            radius: 4,
            kind: 'roads',
          },
        ],
      }),
    );
    for (const set of sets) {
      for (let index = 0; index < set.count; index++) {
        const x = set.data[index * PLACEMENT_STRIDE] as number;
        expect(x).toBeLessThan(100);
        expect(Math.abs(x - 50)).toBeGreaterThan(6);
      }
    }
    const steep = samplePlacements({
      request: request([0, 0, 200, 200]),
      doc,
      pack: identity,
      ground: { sampleHeight: () => 0, slopeAt: () => 0.9, normalAt: () => [0, 1, 0] },
      budget,
      tier: 0,
    });
    expect(steep).toHaveLength(0);
  });

  it('caps instances uniformly and orders output by cell', () => {
    const capped = samplePlacements({
      request: request([0, 0, 400, 400]),
      doc,
      pack: identity,
      ground: FLAT_GROUND,
      budget: { maxInstancesPerRule: 100, maxInstances: 1_000_000, maxPropModels: 8 },
      tier: 0,
    });
    const total = capped.reduce((sum, set) => sum + set.count, 0);
    expect(total).toBe(100);
    const all = new Set(positions(sample(request([0, 0, 400, 400]))));
    for (const key of positions(capped)) expect(all.has(key)).toBe(true);
    const limited = samplePlacements({
      request: request([0, 0, 400, 400]),
      doc,
      pack: identity,
      ground: FLAT_GROUND,
      budget: { maxInstancesPerRule: 100_000, maxInstances: 1_000_000, maxPropModels: 1 },
      tier: 0,
    });
    expect(limited).toHaveLength(1);
    expect(limited[0]?.modelRef).toBe('builtin:tree.conifer');
  });

  it('caps the whole batch uniformly across rules and disables scatter at zero', () => {
    const mixed = request([0, 0, 300, 300], {
      polygons: [
        { label: 'forest', ring: rect(0, 0, 150, 300) },
        { label: 'grass', ring: rect(150, 0, 300, 300) },
      ],
    });
    const full = sample(mixed);
    const fullKeys = new Set(positions(full));
    const rules = new Set(full.map((set) => set.modelRef));
    expect(rules.size).toBeGreaterThan(1);
    const capped = samplePlacements({
      request: mixed,
      doc,
      pack: identity,
      ground: FLAT_GROUND,
      budget: { maxInstancesPerRule: 100_000, maxInstances: 300, maxPropModels: 8 },
      tier: 0,
    });
    expect(capped.reduce((sum, set) => sum + set.count, 0)).toBe(300);
    expect(new Set(capped.map((set) => set.modelRef)).size).toBeGreaterThan(1);
    for (const key of positions(capped)) expect(fullKeys.has(key)).toBe(true);
    const tighter = samplePlacements({
      request: mixed,
      doc,
      pack: identity,
      ground: FLAT_GROUND,
      budget: { maxInstancesPerRule: 100_000, maxInstances: 120, maxPropModels: 8 },
      tier: 0,
    });
    const cappedKeys = new Set(positions(capped));
    for (const key of positions(tighter)) expect(cappedKeys.has(key)).toBe(true);
    const none = samplePlacements({
      request: mixed,
      doc,
      pack: identity,
      ground: FLAT_GROUND,
      budget: { maxInstancesPerRule: 100_000, maxInstances: 0, maxPropModels: 8 },
      tier: 0,
    });
    expect(none).toHaveLength(0);
  });

  it('flows through the batch generator with stats and hashing', () => {
    const output = generateWorldgenBatch({
      buildings: [],
      scatter: request([0, 0, 200, 200], {
        polygons: [
          { label: 'forest', ring: rect(0, 0, 100, 200) },
          { label: 'grass', ring: rect(100, 0, 200, 200) },
        ],
      }),
      pack,
    });
    expect(output.placements.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(output.stats.placementsByModel)).toContain('builtin:shrub');
    expect(output.stats.instanceBytes).toBeGreaterThan(0);
    const again = generateWorldgenBatch({
      buildings: [],
      scatter: request([0, 0, 200, 200], {
        polygons: [
          { label: 'forest', ring: rect(0, 0, 100, 200) },
          { label: 'grass', ring: rect(100, 0, 200, 200) },
        ],
      }),
      pack,
    });
    expect(again.hash).toBe(output.hash);
  });
});

it('varies crown width independently without reshuffling placements, height, or tint', () => {
  const varied = structuredClone(doc);
  for (const rule of varied.rules)
    for (const population of rule.populations) {
      population.widthScale = { min: 0.7, max: 1.4 };
    }
  const req = request([0, 0, 200, 200]);
  const full = sample(req);
  const run = (bounds = req, tier = 0): PlacementSet[] =>
    samplePlacements({
      request: bounds,
      doc: varied,
      pack: identity,
      ground: FLAT_GROUND,
      budget,
      tier,
    });
  const result = run();
  expect(result).toEqual(run());
  const byPosition = new Map<string, number[]>();
  const ratios = new Set<string>();
  result.forEach((set, setIndex) => {
    const original = full[setIndex] as PlacementSet;
    expect(set.count).toBe(original.count);
    for (let i = 0; i < set.count; i++) {
      const offset = i * PLACEMENT_STRIDE;
      const row = Array.from(set.data.slice(offset, offset + PLACEMENT_STRIDE));
      for (const field of [0, 1, 2, 3, 5, 7, 8, 9])
        expect(row[field]).toBe(original.data[offset + field]);
      const ratio = (row[4] as number) / (row[5] as number);
      expect(ratio).toBeGreaterThanOrEqual(0.7);
      expect(ratio).toBeLessThanOrEqual(1.4);
      expect(row[4]).toBe(row[6]);
      ratios.add(ratio.toFixed(2));
      byPosition.set(`${set.modelRef}:${row[0]},${row[2]}`, row);
    }
  });
  expect(ratios.size).toBeGreaterThan(20);
  for (const subset of [run(req, 1), run(request([0, 0, 100, 200]))]) {
    for (const set of subset)
      for (let i = 0; i < set.count; i++) {
        const row = Array.from(set.data.slice(i * PLACEMENT_STRIDE, (i + 1) * PLACEMENT_STRIDE));
        expect(row).toEqual(byPosition.get(`${set.modelRef}:${row[0]},${row[2]}`));
      }
  }
});
