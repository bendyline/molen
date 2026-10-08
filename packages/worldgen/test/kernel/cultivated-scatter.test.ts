import { describe, expect, it } from 'vitest';
import { samplePlacements } from '../../src/kernel/scatter';
import { scatterSchema, validateScatter } from '../../src/kernel/scatter-schema';
import type { ScatterDoc } from '../../src/kernel/scatter-types';
import {
  FLAT_GROUND,
  type PlacementSet,
  type ScatterRequest,
  type Vec2,
} from '../../src/kernel/types';

const rect = (a: number, b: number, c: number, d: number): Vec2[] => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const base: ScatterDoc = scatterSchema.parse({
  format: 'molen/scatter@1',
  id: 'test.cultivated',
  title: 'Cultivation',
  surface: { default: '#889966' },
  defaults: {
    avoid: { roads: 1, buildings: 2, water: 2 },
    lod: { keepByTier: [1, 0.5], maxInstancesPerBatch: 10000 },
  },
  rules: [
    {
      id: 'rows',
      classes: ['orchard'],
      densityPerHectare: 250,
      minSpacing: 2,
      rows: { spacing: 8, interval: 5, angle: 30, jitter: 0 },
      populations: [{ model: 'test.plant', weight: 1, scale: { min: 1, max: 1 } }],
    },
  ],
});
const request: ScatterRequest = {
  polygons: [{ label: 'orchard', ring: rect(-100, -100, 300, 300), holes: [rect(40, 40, 60, 60)] }],
  exclusions: [],
  emitBounds: [0, 0, 200, 200],
  frame: { originX: -1000, originZ: 2300, unitsPerMeter: 0.73 },
  keep: 1,
};
const run = (req = request, doc = base, tier = 0) =>
  samplePlacements({
    request: req,
    doc,
    tier,
    pack: { name: 'test', version: '1' },
    ground: FLAT_GROUND,
    budget: { maxInstances: 10000, maxInstancesPerRule: 10000, maxPropModels: 10 },
  });
const points = (sets: PlacementSet[]) =>
  sets.flatMap((set) =>
    Array.from(
      { length: set.count },
      (_, i) => [set.data[i * 10] as number, set.data[i * 10 + 2] as number] as Vec2,
    ),
  );
const keys = (sets: PlacementSet[]) =>
  points(sets)
    .map((p) => p.map((v) => v.toFixed(3)).join(','))
    .sort();

describe('cultivation and water context', () => {
  it('keeps rotated rows continuous across tiles, with exact field holes and nested quality subsets', () => {
    expect(validateScatter(base)).toEqual([]);
    const whole = run();
    expect(points(whole).length).toBeGreaterThan(800);
    expect(
      keys([
        ...run({ ...request, emitBounds: [0, 0, 100, 200] }),
        ...run({ ...request, emitBounds: [100, 0, 200, 200] }),
      ]),
    ).toEqual(keys(whole));
    const full = new Set(keys(whole));
    for (const key of keys(run(request, base, 1))) expect(full.has(key)).toBe(true);
    for (const [x, z] of points(whole)) {
      expect(x > 40 && x < 60 && z > 40 && z < 60).toBe(false);
      const gx = x - request.frame.originX,
        gz = z - request.frame.originZ;
      const column = (gx * Math.cos(Math.PI / 6) + gz * Math.sin(Math.PI / 6)) / 5;
      expect(column - Math.floor(column)).toBeCloseTo(0.5, 3);
    }
  });

  it('requires matching mapped water and preserves dry islands and individual clearance distances', () => {
    const rule = base.rules[0];
    if (rule === undefined) throw new Error('Missing fixture rule');
    const near: ScatterDoc = {
      ...base,
      rules: [{ ...rule, nearWater: { maxDistance: 15, classes: ['river'] } }],
    };
    expect(run(request, near)).toEqual([]);
    const water: ScatterRequest = {
      ...request,
      exclusions: [
        {
          kind: 'water',
          label: 'lake',
          ring: rect(20, 0, 100, 200),
          holes: [rect(45, 30, 75, 170)],
          radius: 2,
        },
      ],
    };
    expect(run(water, near)).toEqual([]);
    const river: ScatterRequest = {
      ...water,
      exclusions: water.exclusions.map((e) => ({ ...e, label: 'river' })),
    };
    const output = points(run(river, near));
    expect(output.length).toBeGreaterThan(50);
    expect(output.some(([x, z]) => x > 47 && x < 73 && z > 32 && z < 168)).toBe(true);
    for (const [x, z] of output) {
      expect(x).toBeGreaterThanOrEqual(4.5);
      expect(x).toBeLessThanOrEqual(115.5);
      expect(x > 20 && x < 100 && !(x > 45 && x < 75 && z > 30 && z < 170)).toBe(false);
    }
    // A wide building margin must not expand the separate road margin.
    const req: ScatterRequest = {
      ...request,
      exclusions: [
        { ring: rect(150, 150, 180, 180), radius: 15 },
        {
          polyline: [
            [100, 0],
            [100, 200],
          ],
          width: 2,
          radius: 1,
        },
      ],
    };
    expect(points(run(req)).some(([x, z]) => x > 103 && x < 108 && z < 100)).toBe(true);
  });
});
