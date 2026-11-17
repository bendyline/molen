import { describe, expect, it } from 'vitest';
import { generateWorldgenBatch } from '../../src/kernel/batch';
import { dilate, RasterGrid, rasterizePolygon, rasterizePolyline } from '../../src/kernel/raster';
import { samplePlacements, TREELINE_FADE } from '../../src/kernel/scatter';
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
  it('thins trees toward a tree line and plants none above it', () => {
    // A hillside rising 1 m for every meter north: heights 0 to 1,000 m across the request.
    const hillside = { ...FLAT_GROUND, sampleHeight: (_x: number, z: number): number => z };
    const run = (treeline?: number): number[] =>
      samplePlacements({
        request: request([0, 0, 200, 1000]),
        doc,
        pack: identity,
        ground: hillside,
        budget,
        tier: 0,
        ...(treeline === undefined ? {} : { treeline: () => treeline }),
      }).flatMap((set) =>
        Array.from({ length: set.count }, (_, i) => set.data[i * PLACEMENT_STRIDE + 2] as number),
      );
    const open = run();
    const limited = run(700);
    const count = (heights: number[], from: number, to: number): number =>
      heights.filter((z) => z >= from && z < to).length;
    expect(count(open, 700, 1000)).toBeGreaterThan(50);
    // Nothing above the line; untouched well below it; about half through the fade.
    expect(count(limited, 700, 1000)).toBe(0);
    expect(count(limited, 0, 700 - TREELINE_FADE)).toBe(count(open, 0, 700 - TREELINE_FADE));
    const faded = count(limited, 700 - TREELINE_FADE, 700) / count(open, 700 - TREELINE_FADE, 700);
    expect(faded).toBeGreaterThan(0.35);
    expect(faded).toBeLessThan(0.65);
    // Denser low in the fade than near the line.
    expect(count(limited, 350, 450)).toBeGreaterThan(count(limited, 600, 700));
    // Survivors stand exactly where they stood without a line: nothing is re-rolled.
    const before = new Set(open.map((z) => z.toFixed(4)));
    for (const z of limited) expect(before.has(z.toFixed(4))).toBe(true);
  });

  it('adds independent forms without losing coverage or species under a tight model budget', () => {
    const varied = structuredClone(doc);
    for (const rule of varied.rules)
      for (const p of rule.populations)
        p.variants = ['', '.wide', '.narrow'].map((suffix) => ({
          model: `${p.model}${suffix}`,
          weight: 1,
        }));
    const run = (document: ScatterDoc, maxPropModels: number) =>
      samplePlacements({
        request: request([0, 0, 200, 200]),
        doc: document,
        pack: identity,
        ground: FLAT_GROUND,
        budget: { ...budget, maxPropModels },
        tier: 0,
      });
    const instances = (sets: PlacementSet[]) =>
      sets
        .flatMap((set) =>
          Array.from({ length: set.count }, (_, i) =>
            [...set.data.slice(i * PLACEMENT_STRIDE, (i + 1) * PLACEMENT_STRIDE)].join(','),
          ),
        )
        .sort();
    for (const cap of [1, 2, 3, 8]) {
      const baseline = run(doc, cap),
        expanded = run(varied, cap);
      expect(instances(expanded)).toEqual(instances(baseline));
      expect(expanded.length).toBeLessThanOrEqual(cap);
      expect(new Set(expanded.map((s) => s.modelRef.replace(/\.(wide|narrow)$/, '')))).toEqual(
        new Set(baseline.map((s) => s.modelRef)),
      );
      expect(expanded).toEqual(run(varied, cap));
    }
    expect(run(varied, 8).some((s) => /\.(wide|narrow)$/.test(s.modelRef))).toBe(true);
  });
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
  }, 30_000); // Samples a dense 400 × 400 forest seven times.

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

  it('keeps a tighter rule cap a subset of a looser one, without sampling ground it drops', () => {
    let samples = 0;
    const counted = {
      ...FLAT_GROUND,
      sampleHeight: (x: number, z: number): number => {
        samples++;
        return FLAT_GROUND.sampleHeight(x, z);
      },
    };
    const run = (cap: number): { keys: string[]; samples: number } => {
      samples = 0;
      const sets = samplePlacements({
        request: request([0, 0, 400, 400]),
        doc,
        pack: identity,
        ground: counted,
        budget: { maxInstancesPerRule: cap, maxInstances: 1_000_000, maxPropModels: 8 },
        tier: 0,
      });
      return { keys: positions(sets), samples };
    };
    const tight = run(50);
    const loose = new Set(run(500).keys);
    const open = run(100_000);
    for (const key of tight.keys) expect(loose.has(key)).toBe(true);
    // Once a rule is past its cap, a candidate whose draw cannot make the cut stops early.
    expect(tight.samples).toBeLessThan(open.samples / 2);
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

  it('fills an evicted species from its own rule and drops rules with nothing kept', () => {
    const mixed = request([0, 0, 300, 300], {
      polygons: [
        { label: 'forest', ring: rect(0, 0, 150, 300) },
        { label: 'grass', ring: rect(150, 0, 300, 300) },
      ],
    });
    const run = (maxPropModels: number) =>
      samplePlacements({
        request: mixed,
        doc,
        pack: identity,
        ground: FLAT_GROUND,
        budget: { ...budget, maxPropModels },
        tier: 0,
      });
    const where = (sets: PlacementSet[], forest: boolean) =>
      positions(sets)
        .map((key) => key.slice(key.lastIndexOf(':') + 1))
        .filter((key) => Number(key.split(',')[0]) < 150 === forest)
        .sort();
    const full = run(8);
    const capped = run(1);
    expect(capped.map((set) => set.modelRef)).toEqual(['builtin:tree.conifer']);
    // Every deciduous place in the forest stays planted, as the dominant conifer.
    expect(where(capped, true)).toEqual(where(full, true));
    expect(where(full, false).length).toBeGreaterThan(0);
    expect(where(capped, false)).toEqual([]);
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

  it('gives ground cover its own budget, so it never thins or displaces the canopy', () => {
    const covered: ScatterDoc = {
      ...doc,
      rules: [
        ...doc.rules,
        {
          id: 'cover',
          classes: ['forest'],
          densityPerHectare: 2000,
          minSpacing: 0.5,
          layer: 'groundcover',
          populations: [
            {
              model: 'builtin:groundcover.tuft',
              weight: 1,
              scale: { min: 1, max: 1 },
              yaw: 'random',
              align: 'normal',
            },
          ],
        },
      ],
    };
    const req = request([0, 0, 200, 200]);
    const visited = new Set<string>();
    const run = (scatter: ScatterDoc, extra: Partial<typeof budget> & Record<string, number>) =>
      samplePlacements({
        request: req,
        doc: scatter,
        pack: identity,
        ground: FLAT_GROUND,
        budget: { ...budget, maxInstances: 300, maxPropModels: 1, ...extra },
        tier: 0,
        acceptsRule: (rule) => {
          visited.add(rule.id);
          return true;
        },
      });
    const canopy = run(doc, {});
    const both = run(covered, { maxGroundCoverInstances: 500, maxGroundCoverModels: 2 });
    const tufts = both.filter((set) => set.modelRef === 'builtin:groundcover.tuft');
    // The canopy keeps exactly its own capped instances and its one model slot.
    expect(positions(both.filter((set) => set.modelRef !== 'builtin:groundcover.tuft'))).toEqual(
      positions(canopy),
    );
    expect(tufts.reduce((sum, set) => sum + set.count, 0)).toBe(500);
    // Without a ground cover budget the layer is simply absent.
    visited.clear();
    expect(positions(run(covered, {}))).toEqual(positions(canopy));
    expect(visited.has('cover')).toBe(false);
    expect(
      run(covered, { maxGroundCoverInstances: 500, maxGroundCoverModels: 0 }).some(
        (set) => set.modelRef === 'builtin:groundcover.tuft',
      ),
    ).toBe(false);
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

  it('reserves brush independently and keeps multi-scale patches continuous across tile boundaries', () => {
    const brush: ScatterDoc = {
      ...doc,
      rules: [
        ...doc.rules,
        {
          id: 'brush',
          classes: ['forest'],
          layer: 'understory',
          densityPerHectare: 2200,
          minSpacing: 0.35,
          clustering: {
            scale: 48,
            threshold: 0.2,
            contrast: 2,
            seedOffset: 7,
            sharedSeed: 71,
            detailScale: 5,
          },
          populations: [
            {
              model: 'builtin:shrub',
              weight: 1,
              scale: { min: 0.7, max: 1.2 },
              yaw: 'random',
              align: 'up',
            },
          ],
        },
      ],
    };
    const run = (bounds: [number, number, number, number], enabled = true, cap = 10000) =>
      samplePlacements({
        request: request(bounds),
        doc: brush,
        pack: identity,
        ground: FLAT_GROUND,
        budget: { ...budget, maxUnderstoryInstances: enabled ? cap : 0, maxUnderstoryModels: 1 },
        tier: 0,
      });
    const full = run([0, 0, 200, 200]);
    const shrubs = (sets: PlacementSet[]) => sets.filter((s) => s.modelRef === 'builtin:shrub');
    const trees = (sets: PlacementSet[]) => sets.filter((s) => s.modelRef !== 'builtin:shrub');
    expect(positions(trees(full))).toEqual(positions(run([0, 0, 200, 200], false)));
    expect(positions(full)).toEqual(positions(run([0, 0, 200, 200])));
    expect(positions(shrubs(full))).toEqual(
      positions([...shrubs(run([0, 0, 100, 200])), ...shrubs(run([100, 0, 200, 200]))]),
    );
    expect(shrubs(full).reduce((n, s) => n + s.count, 0)).toBeGreaterThan(100);
    const capped = run([0, 0, 200, 200], true, 40);
    expect(shrubs(capped).reduce((n, s) => n + s.count, 0)).toBe(40);
    expect(positions(trees(capped))).toEqual(positions(trees(full)));
    const all = new Set(positions(shrubs(full)));
    for (const pos of positions(shrubs(capped))) expect(all.has(pos)).toBe(true);
  });

  it('plants gardens from their own pool, by role and quarter by quarter', () => {
    const population = (model: string, weight = 1) => ({
      model,
      weight,
      scale: { min: 1, max: 1 },
      yaw: 'random' as const,
      align: 'up' as const,
    });
    const planted: ScatterDoc = {
      ...doc,
      rules: [
        ...doc.rules,
        {
          id: 'beds',
          classes: ['forest'],
          layer: 'garden',
          densityPerHectare: 3000,
          minSpacing: 0.5,
          populations: [
            population('builtin:bed.a', 3),
            population('builtin:bed.b', 2),
            population('builtin:bed.c', 1),
          ],
        },
        {
          id: 'small_trees',
          classes: ['forest'],
          layer: 'garden',
          densityPerHectare: 40,
          minSpacing: 3,
          populations: [population('builtin:small.a'), population('builtin:small.b')],
        },
      ],
    };
    const req = request([0, 0, 200, 200]);
    const run = (extra: Record<string, number>) =>
      samplePlacements({
        request: req,
        doc: planted,
        pack: identity,
        ground: FLAT_GROUND,
        budget: { ...budget, ...extra },
        tier: 0,
      });
    const garden = (sets: PlacementSet[]) =>
      sets.filter((set) => /:(bed|small)\./.test(set.modelRef));
    const count = (sets: PlacementSet[]) => sets.reduce((sum, set) => sum + set.count, 0);
    // No garden budget, no garden: the layer is closed like the other optional pools.
    expect(garden(run({}))).toEqual([]);
    const tight = run({ maxGardenInstances: 100_000, maxGardenModels: 2 });
    const roomy = run({ maxGardenInstances: 100_000, maxGardenModels: 16 });
    // The canopy keeps its own instances and model slots whatever is planted beneath it.
    expect(positions(tight.filter((set) => !garden([set]).length))).toEqual(positions(sample(req)));
    // By count the beds would take both slots; by role the few small trees keep one.
    const refs = garden(tight).map((set) => set.modelRef);
    expect(refs.some((ref) => ref.includes('small'))).toBe(true);
    expect(refs.some((ref) => ref.includes('bed'))).toBe(true);
    // A species without a slot becomes its rule's kept one: nothing planted is lost.
    expect(count(garden(tight))).toBe(count(garden(roomy)));
    expect(new Set(garden(roomy).map((set) => set.modelRef)).size).toBe(5);
    // The slots are per quarter of the batch, which is what a host draws them by.
    const byQuarter = new Map<number, Set<string>>();
    for (const set of garden(tight))
      for (let index = 0; index < set.count; index++) {
        const offset = index * PLACEMENT_STRIDE;
        const quarter =
          ((set.data[offset] as number) >= 100 ? 1 : 0) +
          ((set.data[offset + 2] as number) >= 100 ? 2 : 0);
        byQuarter.set(quarter, (byQuarter.get(quarter) ?? new Set()).add(set.modelRef));
      }
    expect(byQuarter.size).toBe(4);
    for (const models of byQuarter.values()) expect(models.size).toBeLessThanOrEqual(2);
    // And the pool caps its own instances.
    expect(count(garden(run({ maxGardenInstances: 50, maxGardenModels: 16 })))).toBe(50);
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

it('stands a fitted plant on each painted crown, kept whole and outside the layer cap', () => {
  // A crown in the middle of every 8 m cell, 1 to 2.5 m across the row, painted from brush 0.4
  // in even columns and 0.8 in odd ones.
  const crowns = {
    cells: ([minX, minZ, maxX, maxZ]: [number, number, number, number]) =>
      [Math.floor(minX / 8), Math.floor(minZ / 8), Math.floor(maxX / 8), Math.floor(maxZ / 8)] as [
        number,
        number,
        number,
        number,
      ],
    crown: (i: number, j: number) => ({
      x: i * 8 + 4,
      z: j * 8 + 4,
      radius: 1 + ((i + j) % 4) * 0.5,
      brush: i % 2 === 0 ? 0.4 : 0.8,
    }),
    // Paved over north of z = 64 (built-up ground).
    open: (_x: number, z: number) => (z < 64 ? 1 : 0),
  };
  const crowned: ScatterDoc = {
    ...doc,
    defaults: { ...doc.defaults, lod: { ...doc.defaults.lod, coverGrowth: 3 } },
    rules: [
      {
        id: 'crowns',
        classes: ['forest', 'heath'],
        layer: 'understory',
        densityPerHectare: 1,
        minSpacing: 1,
        crowns: { forest: 0.6, heath: 1 },
        lod: { keepByTier: [1, 0] },
        populations: [
          {
            model: 'builtin:shrub',
            weight: 1,
            width: 2,
            scale: { min: 1, max: 1 },
            yaw: 'random',
            align: 'up',
          },
        ],
      },
      {
        id: 'brush',
        classes: ['forest'],
        layer: 'understory',
        densityPerHectare: 400,
        minSpacing: 0.5,
        populations: [
          {
            model: 'builtin:bush',
            weight: 1,
            scale: { min: 1, max: 1 },
            yaw: 'random',
            align: 'up',
          },
        ],
      },
    ],
  };
  const run = (
    overrides: Partial<ScatterRequest> = {},
    options: { tier?: number; cap?: number; withCrowns?: boolean } = {},
  ) =>
    samplePlacements({
      request: request([0, 0, 128, 128], overrides),
      doc: crowned,
      pack: identity,
      ground: FLAT_GROUND,
      budget: {
        ...budget,
        maxUnderstoryInstances: options.cap ?? 100_000,
        maxUnderstoryModels: 4,
      },
      tier: options.tier ?? 0,
      ...(options.withCrowns === false ? {} : { crowns }),
    });
  const plants = (sets: PlacementSet[], model = 'builtin:shrub') => {
    const rows: number[][] = [];
    for (const set of sets.filter((entry) => entry.modelRef === model))
      for (let i = 0; i < set.count; i++)
        rows.push(Array.from(set.data.slice(i * PLACEMENT_STRIDE, (i + 1) * PLACEMENT_STRIDE)));
    return rows;
  };
  const full = plants(run());
  // Forest (brush 0.6) shows only the even columns' crowns, and none on the paved half.
  expect(full.length).toBe(8 * 8);
  for (const [x = 0, , z = 0, , sx = 0, sy = 0, sz = 0] of full) {
    const i = (x - 4) / 8,
      j = (z - 4) / 8;
    expect(Number.isInteger(i) && Number.isInteger(j)).toBe(true);
    expect(i % 2).toBe(0);
    expect(z).toBeLessThan(64);
    // Fitted across to the crown (width 2 at scale 1), and taller by its square root even
    // though the layer is far over its cap and the doc would widen thinned crowns.
    const across = 1 + ((i + j) % 4) * 0.5;
    expect(sx).toBeCloseTo(across, 5);
    expect(sz).toBeCloseTo(across, 5);
    expect(sy).toBeCloseTo(Math.sqrt(across), 5);
  }
  // The appearance class, not the label, chooses the brush: heath paints every crown.
  const heath = plants(
    run({
      polygons: [{ label: 'forest heathland', appearance: 'heath', ring: rect(0, 0, 128, 128) }],
    }),
  );
  expect(heath.length).toBe(16 * 8);
  // A polygon only scatter sees (an inferred yard) does not hide the ground's crowns beneath it,
  // while a mapped one of the same label does.
  const yard = { label: 'yard', ring: rect(0, 0, 128, 40) };
  const base = { label: 'forest', ring: rect(0, 0, 128, 128) };
  expect(plants(run({ polygons: [base, { ...yard, ground: false }] }))).toEqual(full);
  expect(plants(run({ polygons: [base, yard] })).length).toBeLessThan(full.length);
  // Kept whole: neither the host's keep nor a tight understory cap drops one, and the cap
  // still thins the rest of the layer.
  const capped = run({ keep: 0.3 }, { cap: 10 });
  expect(plants(capped)).toEqual(full);
  expect(plants(capped, 'builtin:bush').length).toBe(10);
  expect(plants(run({ keep: 0.3 }, { cap: 0 }))).toEqual([]);
  // Off at coarser tiers, and nothing without the host's crowns.
  expect(plants(run({}, { tier: 1 }))).toEqual([]);
  expect(plants(run({}, { withCrowns: false }))).toEqual([]);
  expect(plants(run({}, { withCrowns: false }), 'builtin:bush').length).toBeGreaterThan(0);
});
