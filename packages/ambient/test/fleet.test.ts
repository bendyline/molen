import { Transform, World } from '@bendyline/molen-kernel/world';
import { describe, expect, it } from 'vitest';
import { AmbientAgent, createFleetLibrary, type FleetCatalog, installAmbient } from '../src/kernel';
import { gridDocument } from './helpers';

const catalog: FleetCatalog = {
  format: 'molen/fleet-catalog@1',
  id: 'test.fleet',
  version: 1,
  description: 'test',
  fallback: 'global',
  regions: { cn: 'china', us: 'usa' },
  profiles: [
    { id: 'global', title: 'Global', weights: { generic: 1 } },
    {
      id: 'china',
      title: 'China',
      extends: 'global',
      weights: { generic: 0, china: 8, imported: 1 },
    },
    { id: 'usa', title: 'US', extends: 'global', weights: { pickup: 8 } },
  ],
};
describe('regional fleet profiles', () => {
  it('inherits weights, excludes zeros/missing models, and never falls back to an unrelated market', () => {
    const library = createFleetLibrary([catalog], new Set(['generic', 'china', 'pickup']));
    expect([...library.select('cn').weights]).toEqual([['china', 8]]);
    expect([...library.select('unmapped').weights.keys()]).toEqual(['generic']);
    expect([...library.select('us').weights.keys()]).toEqual(['pickup', 'generic']);
  });
  it('caps model variety with stable weighted sampling independent of document order', () => {
    const weights = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`car${i}`, i + 1]));
    const doc = { ...catalog, regions: {}, profiles: [{ id: 'global', title: 'Global', weights }] };
    const a = createFleetLibrary([doc], new Set(Object.keys(weights)), 12).select();
    const b = createFleetLibrary(
      [
        {
          ...doc,
          profiles: [
            { ...doc.profiles[0]!, weights: Object.fromEntries(Object.entries(weights).reverse()) },
          ],
        },
      ],
      new Set(Object.keys(weights)),
      12,
    ).select();
    expect(a.weights.size).toBe(12);
    expect([...a.weights]).toEqual([...b.weights]);
    expect([...a.weights.keys()].slice(0, 4)).toEqual(['car99', 'car98', 'car97', 'car96']);
  });
  it('rejects cycles, missing profiles, duplicate bindings and invalid budgets', () => {
    expect(() =>
      createFleetLibrary(
        [
          {
            ...catalog,
            profiles: [{ id: 'global', title: 'bad', extends: 'global', weights: {} }],
          },
        ],
        new Set(),
      ),
    ).toThrow(/Cyclic/);
    expect(() => createFleetLibrary([{ ...catalog, fallback: 'missing' }], new Set())).toThrow(
      /Unknown/,
    );
    expect(() => createFleetLibrary([catalog, catalog], new Set())).toThrow(/Duplicate/);
    expect(() => createFleetLibrary([catalog], new Set(), 0)).toThrow(/maxModels/);
  });
  it('selects traffic at the spawn location and reproduces the same simulation', () => {
    const run = () => {
      const world = new World({ seed: 'fleet', tickRate: 30 });
      const car = (id: string) => [{ id, length: 4, width: 1.7 }];
      const ambient = installAmbient(world, {
        carsAt: (x) => car(x < 0 ? 'west' : 'east'),
        policy: {
          car: { near: 0, far: 400, keep: 500, perLaneKm: 40, max: 100 },
          forwardConeReach: 0,
        },
      });
      ambient.addDocument(gridDocument(5, 80));
      ambient.setObserver({ pos: [0, 0, 0] });
      world.stepN(30);
      return [...world.query(AmbientAgent, Transform)].map(([id, a, t]) => ({
        id,
        type: a.type,
        x: t.pos[0],
      }));
    };
    const result = run();
    expect(result.length).toBeGreaterThan(1);
    expect(result.some((a) => a.type === 'west')).toBe(true);
    expect(result.some((a) => a.type === 'east')).toBe(true);
    expect(result).toEqual(run());
  });
});
