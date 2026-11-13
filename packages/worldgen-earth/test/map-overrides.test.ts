import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import '../src/kernel';
import {
  createMapOverrideSet,
  type MapOverride,
  type MapOverrideChange,
  mapOverrideContains,
  mapOverrideFrame,
  mapOverridePoint,
  resolveMapOverride,
} from '../src/kernel/map-overrides';
import { projectWgs84 } from '../src/kernel/projection';
import type { TileGeometry } from '../src/kernel/semantic-adapter';

const NEEDLE: [number, number] = [-122.3493, 47.62051];
const warehouse = (extra: Partial<MapOverride> = {}): MapOverride => ({
  id: 'needle-warehouse',
  area: { center: NEEDLE, size: [80, 60] },
  buildings: [{ id: 'shed', rect: { size: [48, 30] }, height: 9, use: 'Warehouse' }],
  ...extra,
});

/** Meters between two places, on a sphere: good to centimeters at these distances. */
function meters(a: readonly [number, number], b: readonly [number, number]): [number, number] {
  const R = 6_378_137;
  const rad = Math.PI / 180;
  return [(b[0] - a[0]) * rad * R * Math.cos(a[1] * rad), (b[1] - a[1]) * rad * R];
}

describe('map override declarations', () => {
  it('lays a frame out in true meters, turned clockwise by the heading', () => {
    // North up: +x east, +z south.
    const [east, north] = meters(
      NEEDLE,
      mapOverridePoint({ center: NEEDLE, heading: 0 }, [30, -10]),
    );
    expect(east).toBeCloseTo(30, 1);
    expect(north).toBeCloseTo(10, 1);
    // Facing east: the frame's -z side (its "north") points east, so +x points south.
    const turned = { center: NEEDLE, heading: Math.PI / 2 };
    const [e1, n1] = meters(NEEDLE, mapOverridePoint(turned, [0, -10]));
    expect(e1).toBeCloseTo(10, 1);
    expect(n1).toBeCloseTo(0, 1);
    const [e2, n2] = meters(NEEDLE, mapOverridePoint(turned, [10, 0]));
    expect(e2).toBeCloseTo(0, 1);
    expect(n2).toBeCloseTo(-10, 1);
  });

  it('resolves a rectangle given as bounds to the same ground as its center and size', () => {
    const frame = { center: NEEDLE, heading: 0 };
    const [west, south] = mapOverridePoint(frame, [-40, 30]);
    const [east, north] = mapOverridePoint(frame, [40, -30]);
    const byBounds = resolveMapOverride({ id: 'a', area: { bounds: [west, south, east, north] } });
    const bySize = resolveMapOverride({ id: 'a', area: { center: NEEDLE, size: [80, 60] } });
    expect(byBounds.half[0]).toBeCloseTo(40, 2);
    expect(byBounds.half[1]).toBeCloseTo(30, 2);
    for (let i = 0; i < 4; i++) {
      expect(byBounds.ring[i]?.[0]).toBeCloseTo(bySize.ring[i]?.[0] as number, 2);
      expect(byBounds.ring[i]?.[1]).toBeCloseTo(bySize.ring[i]?.[1] as number, 2);
    }
    expect(mapOverrideFrame({ bounds: [west, south, east, north] }).heading).toBe(0);
  });

  it('resolves buildings, props and models into the map, with defaults', () => {
    const resolved = resolveMapOverride(
      warehouse({
        area: { center: NEEDLE, size: [80, 60], heading: Math.PI / 2 },
        buildings: [
          { id: 'shed', rect: { size: [48, 30] }, height: 9, use: 'Warehouse', wall: '#B9B4A8' },
          {
            id: 'office',
            outline: [
              [30, -10],
              [38, -10],
              [38, 10],
              [30, 10],
              [30, -10],
            ],
          },
        ],
        props: [
          { id: 'lamp', kind: 'street_lamp', position: [28, 18] },
          { id: 'rack', kind: 'bike_rack', position: [0, 20], heading: 0.5 },
          { id: 'crate', model: 'builtin:rock', position: [5, 5], scale: 2, color: '#AABBCC' },
        ],
        models: [{ id: 'tank', asset: 'my.host.tank', position: [0, -60], heading: 0.25 }],
      }),
    );
    expect(resolved.clear).toEqual({
      buildings: true,
      landmarks: true,
      vegetation: true,
      props: true,
      parking: true,
      roads: false,
    });
    expect(resolved.cover).toBe('open_ground');
    expect(resolved.minLevel).toBe(11);
    const [shed, office] = resolved.buildings;
    expect(shed).toMatchObject({
      featureId: 'override:needle-warehouse:shed',
      height: 9,
      use: 'warehouse',
      wall: '#b9b4a8',
    });
    expect(shed?.levels).toBeUndefined();
    // Neither height nor floors: one floor, so nothing downstream guesses from the neighbors.
    expect(office?.levels).toBe(1);
    // A closing point is dropped, and rings wind one way whatever the heading.
    expect(office?.ring).toHaveLength(4);
    for (const building of resolved.buildings) {
      let area = 0;
      building.ring.forEach((a, i) => {
        const b = building.ring[(i + 1) % building.ring.length] as [number, number];
        area += a[0] * b[1] - b[0] * a[1];
      });
      expect(area).toBeGreaterThan(0);
    }
    expect(resolved.props.map((prop) => prop.poiClass)).toEqual([
      'street_lamp',
      'bicycle_parking',
      'molen_prop',
    ]);
    // Compass headings become rotations about +Y: the other way round.
    expect(resolved.props[1]?.rotation).toBeCloseTo(-(Math.PI / 2 + 0.5));
    expect(resolved.props[2]).toMatchObject({
      model: 'builtin:rock',
      scale: '2,2,2',
      color: '#aabbcc',
    });
    expect(resolved.models[0]).toMatchObject({
      id: 'override.needle-warehouse.tank',
      asset: 'my.host.tank',
      elevation: 0,
    });
    expect(resolved.models[0]?.rotation).toBeCloseTo(-(Math.PI / 2 + 0.25));
    // The model stands outside the rectangle; the override's bounds take it in, the area's do not.
    const [x, z] = projectWgs84(...(resolved.models[0]?.anchor as [number, number]));
    expect(mapOverrideContains(resolved, x, z)).toBe(false);
    expect(x).toBeGreaterThanOrEqual(resolved.bounds[0]);
    expect(x).toBeLessThanOrEqual(resolved.bounds[2]);
    expect(z).toBeGreaterThanOrEqual(resolved.bounds[1]);
    expect(z).toBeLessThanOrEqual(resolved.bounds[3]);
    expect(resolved.areaBounds[2] - resolved.areaBounds[0]).toBeLessThan(
      resolved.bounds[2] - resolved.bounds[0],
    );
    const [cx, cz] = projectWgs84(...NEEDLE);
    expect(mapOverrideContains(resolved, cx, cz)).toBe(true);
  });

  it('rejects what it cannot place, naming the override', () => {
    const cases: Array<[string, unknown]> = [
      ['id must be', { ...warehouse(), id: 'Needle Warehouse' }],
      ['area.size', warehouse({ area: { center: NEEDLE, size: [80, 2500] } })],
      ['area.center', warehouse({ area: { center: [200, 47], size: [80, 60] } })],
      ['ordered', { id: 'a', area: { bounds: [-122.34, 47.63, -122.35, 47.62] } }],
      ['a side', { id: 'a', area: { bounds: [-122.4, 47.6, -122.3, 47.7] } }],
      ['clear.trees', warehouse({ clear: { trees: true } as never })],
      ['unknown surface', warehouse({ surface: 'lava' as never })],
      ['minLevel', warehouse({ minLevel: 30 })],
      ['outline or a rect', warehouse({ buildings: [{ id: 'x' }] })],
      [
        'do not cross',
        warehouse({
          buildings: [
            {
              id: 'bow',
              outline: [
                [0, 0],
                [10, 10],
                [10, 0],
                [0, 10],
              ],
            },
          ],
        }),
      ],
      [
        'height must be',
        warehouse({ buildings: [{ id: 'x', rect: { size: [5, 5] }, height: 0 }] }),
      ],
      [
        'levels must be',
        warehouse({ buildings: [{ id: 'x', rect: { size: [5, 5] }, levels: 1.5 }] }),
      ],
      ['#rrggbb', warehouse({ buildings: [{ id: 'x', rect: { size: [5, 5] }, wall: 'red' }] })],
      [
        'duplicate id "x"',
        warehouse({
          buildings: [
            { id: 'x', rect: { size: [5, 5] } },
            { id: 'x', rect: { size: [6, 6] } },
          ],
        }),
      ],
      [
        'at most 16 models',
        warehouse({
          models: Array.from({ length: 17 }, (_, i) => ({
            id: `m${i}`,
            asset: 'a',
            position: [0, 0] as [number, number],
          })),
        }),
      ],
      [
        'stand-in',
        warehouse({ props: [{ id: 'p', model: 'builtin:box.gable', position: [0, 0] }] }),
      ],
      [
        'kind must be',
        warehouse({ props: [{ id: 'p', kind: 'statue' as never, position: [0, 0] }] }),
      ],
      ['position', warehouse({ props: [{ id: 'p', kind: 'bench', position: [0] as never }] })],
      [
        'scale must be',
        warehouse({ models: [{ id: 'm', asset: 'a', position: [0, 0], scale: 0 }] }),
      ],
    ];
    for (const [message, override] of cases)
      expect(() => resolveMapOverride(override as MapOverride), message).toThrow(message);
    expect(() => resolveMapOverride(warehouse({ minLevel: 30 }))).toThrow('"needle-warehouse"');
  });

  it('hashes what the map edit reads, and nothing a host adds beside it', () => {
    const base = resolveMapOverride(warehouse());
    const bundled = { ...warehouse(), actors: [{ id: 'guard' }], scene: { load: () => undefined } };
    expect(resolveMapOverride(bundled).hash).toBe(base.hash);
    // Declared defaults are the defaults.
    expect(
      resolveMapOverride(warehouse({ clear: { roads: false }, surface: 'ground', minLevel: 11 }))
        .hash,
    ).toBe(base.hash);
    expect(resolveMapOverride(warehouse({ clear: { roads: true } })).hash).not.toBe(base.hash);
    expect(resolveMapOverride(warehouse({ surface: 'paved' })).hash).not.toBe(base.hash);
  });

  it('accepts the same documents the schema does, and rejects the same', () => {
    const doc = (overrides: unknown[]) => ({ format: 'molen/map-overrides@1', overrides });
    expect(validate('map-overrides', doc([warehouse()])).ok).toBe(true);
    // A host's bundles ride along as data.
    expect(
      validate('map-overrides', doc([{ ...warehouse(), actors: [{ id: 'guard', figure: {} }] }]))
        .ok,
    ).toBe(true);
    for (const bad of [
      doc([{ ...warehouse(), color: 'red' }]),
      doc([warehouse({ buildings: [{ id: 'x' }] })]),
      doc([warehouse(), warehouse()]),
    ])
      expect(validate('map-overrides', bad).ok).toBe(false);
  });
});

describe('map override sets', () => {
  const geometry = (extra: Partial<TileGeometry> = {}): TileGeometry => {
    // A level-15 tile around the Needle, with world meters equal to projected meters.
    const size = 40_075_016.685578488 / 2 ** 15;
    const [x, z] = projectWgs84(...NEEDLE);
    return {
      level: 15,
      x: 0,
      z: 0,
      originX: x - size / 2,
      originZ: z - size / 2,
      size,
      metersPerUnit: 1,
      levelBelowMax: 0,
      ...extra,
    };
  };

  it('reports each change with the ground it touches, before and after', () => {
    const set = createMapOverrideSet<MapOverride>();
    const changes: MapOverrideChange[] = [];
    const stop = set.subscribe((change) => changes.push(change));
    const first = warehouse();
    set.set(first);
    expect(set.revision).toBe(1);
    expect(changes[0]).toMatchObject({ revision: 1, ids: ['needle-warehouse'], tiles: true });
    expect(changes[0]?.bounds).toHaveLength(1);
    // Moved: both the old ground and the new are reported.
    const moved = warehouse({ area: { center: [NEEDLE[0] + 0.01, NEEDLE[1]], size: [80, 60] } });
    set.set(moved);
    expect(changes[1]?.bounds).toHaveLength(2);
    expect(changes[1]?.bounds[0]).toEqual(changes[0]?.bounds[0]);
    // Only a host bundle changed: the same ground, and no tile to build again.
    set.set({ ...moved, actors: [] } as MapOverride);
    expect(changes[2]).toMatchObject({ revision: 3, tiles: false });
    expect(changes[2]?.bounds).toHaveLength(1);
    expect(set.delete('needle-warehouse')).toBe(true);
    expect(set.delete('needle-warehouse')).toBe(false);
    expect(changes).toHaveLength(4);
    expect(changes[3]?.tiles).toBe(true);
    stop();
    set.set(first);
    expect(changes).toHaveLength(4);
    expect(set.revision).toBe(5);
  });

  it('keeps what it is given by reference and changes nothing when an override is invalid', () => {
    const load = (): undefined => undefined;
    const first = { ...warehouse(), scene: { load } };
    const set = createMapOverrideSet([first]);
    expect(set.revision).toBe(0);
    expect(set.get('needle-warehouse')).toBe(first);
    expect(set.list()).toEqual([first]);
    expect(() => set.set(warehouse({ minLevel: 99 }))).toThrow();
    expect(() => set.replace([warehouse({ id: 'other' }), warehouse({ id: 'other' })])).toThrow(
      'duplicate',
    );
    expect(() => set.replace([warehouse({ id: 'other' }), warehouse({ minLevel: 99 })])).toThrow();
    expect(set.revision).toBe(0);
    expect(set.get('needle-warehouse')).toBe(first);
    expect(() => createMapOverrideSet([warehouse({ minLevel: 99 })])).toThrow();
  });

  it('replaces the whole set as one change', () => {
    const kept = warehouse({ id: 'kept' });
    const set = createMapOverrideSet<MapOverride>([kept, warehouse({ id: 'gone' })]);
    const changes: MapOverrideChange[] = [];
    set.subscribe((change) => changes.push(change));
    set.replace([kept, warehouse({ id: 'new' })]);
    expect(changes).toHaveLength(1);
    expect([...(changes[0]?.ids ?? [])].sort()).toEqual(['gone', 'new']);
    expect(set.list().map((override) => override.id)).toEqual(['kept', 'new']);
    set.replace([kept, set.get('new') as MapOverride]);
    expect(changes).toHaveLength(1);
    set.replace([]);
    expect(changes).toHaveLength(2);
    expect(set.list()).toEqual([]);
  });

  it('finds the overrides that reach a tile, at their level and within its buffer', () => {
    const set = createMapOverrideSet<MapOverride>([
      warehouse({ id: 'b' }),
      warehouse({ id: 'a', minLevel: 15 }),
      warehouse({ id: 'far', area: { center: [NEEDLE[0] + 1, NEEDLE[1]], size: [80, 60] } }),
    ]);
    expect(set.forTile(geometry()).map((item) => item.id)).toEqual(['a', 'b']);
    // A coarser tile is below one override's level.
    expect(set.forTile(geometry({ level: 14 })).map((item) => item.id)).toEqual(['b']);
    // A tile whose edge is 5 m from the rectangle: reached only through the buffer.
    const size = geometry().size;
    const [x] = projectWgs84(...NEEDLE);
    const k = 1 / Math.cos((NEEDLE[1] * Math.PI) / 180);
    const beside = geometry({ originX: x + (40 + 5) * k });
    expect(set.forTile(beside, 0).map((item) => item.id)).toEqual([]);
    expect(set.forTile(beside, 10 / size).map((item) => item.id)).toEqual(['a', 'b']);
    // World meters scaled by the frame's latitude factor, as an Earth view's are.
    const mpu = Math.cos((NEEDLE[1] * Math.PI) / 180);
    const scaled = geometry({
      originX: geometry().originX * mpu,
      originZ: geometry().originZ * mpu,
      size: size * mpu,
      metersPerUnit: mpu,
    });
    expect(set.forTile(scaled).map((item) => item.id)).toEqual(['a', 'b']);
    expect(
      set.query([NEEDLE[0] - 0.001, NEEDLE[1] - 0.001, NEEDLE[0] + 0.001, NEEDLE[1] + 0.001]),
    ).toHaveLength(2);
    expect(set.query([0, 0, 1, 1])).toEqual([]);
    expect(set.resolved('far')?.id).toBe('far');
  });
});
