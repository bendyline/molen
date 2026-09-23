import { readFile } from 'node:fs/promises';
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, generateWorldgenBatch } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { mappedPropRequests } from '../src/kernel/mapped-props';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultPack, PLACES } from './helpers/pack';

const pack = await loadDefaultPack();
const geom: TileGeometry = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 100,
  metersPerUnit: 1,
  levelBelowMax: 0,
};
function tile(): TerrainSemanticTile {
  const t = createEmptyTerrainSemanticTile();
  t.buildings = [
    {
      id: 1,
      class: 'building',
      height: 6,
      polygons: [
        {
          outer: [
            [0.1, 0.1],
            [0.8, 0.1],
            [0.8, 0.5],
            [0.1, 0.5],
          ],
        },
      ],
    },
  ];
  t.transportation = [
    {
      class: 'minor_road',
      lines: [
        [
          [0, 0.6],
          [1, 0.6],
        ],
      ],
    },
  ];
  return t;
}
describe('business identities and storefronts', () => {
  it('normalizes exact aliases and confirmed IDs, with category and collision guards', () => {
    expect(PLACES.businesses.resolve({ class: 'fast_food', name: 'McDonald’s' })?.profile?.id).toBe(
      'mcdonalds',
    );
    expect(
      PLACES.businesses.resolve({ class: 'fast_food', name: 'マクドナルド' })?.profile?.id,
    ).toBe('mcdonalds');
    expect(
      PLACES.businesses.resolve({ class: 'fast_food', name: 'Local spelling', brandId: 'Q38076' })
        ?.matchedBy,
    ).toBe('brand-id');
    expect(
      PLACES.businesses.resolve({ class: 'books', name: "McDonald's Book Exchange" })?.profile,
    ).toBeUndefined();
    expect(
      PLACES.businesses.resolve({ class: 'books', name: "McDonald's" })?.profile,
    ).toBeUndefined();
    expect(
      PLACES.businesses.resolve({ class: 'department_store', name: 'Target', brandId: 'Q7685854' })
        ?.profile,
    ).toBeUndefined();
  });
  it('brands a known standalone footprint while preserving measured height and geometry', () => {
    const t = tile();
    t.pois = [{ id: 1, class: 'supermarket', name: 'Safeway', point: [0.4, 0.3] }];
    const batch = semanticTileToBatch(t, geom, { pack, places: PLACES });
    const b = batch.buildings[0];
    expect(b?.appearance?.trim).toBe('#b82b35');
    expect(b?.height).toBe(6);
    expect(b?.outline).toEqual([
      [10, 10],
      [80, 10],
      [80, 50],
      [10, 50],
    ]);
    expect(b?.storefronts?.[0]?.signModel).toBe('builtin:sign.grocery_market');
    const rendered = generateWorldgenBatch({ ...batch, ground: FLAT_GROUND });
    expect(rendered.records[0]?.height).toBe(6);
    expect(
      rendered.placements.find((s) => s.modelRef === 'builtin:sign.grocery_market')?.count,
    ).toBe(1);
    expect(generateWorldgenBatch({ ...batch, ground: FLAT_GROUND }).hash).toBe(rendered.hash);
  });
  it('keeps shared tenants separate, deduplicates POIs and does not recolor the whole strip', () => {
    const t = tile();
    const cvs = {
      id: 11,
      class: 'pharmacy',
      name: 'CVS Pharmacy',
      point: [0.3, 0.4] as [number, number],
    };
    t.pois = [cvs, { id: 12, class: 'restaurant', name: 'Thai Trio', point: [0.6, 0.4] }, cvs];
    const a = semanticTileToBatch(t, geom, { pack, places: PLACES });
    expect(a.buildings[0]?.appearance).toBeUndefined();
    expect(a.buildings[0]?.storefronts).toHaveLength(2);
    const b = semanticTileToBatch({ ...t, pois: [...t.pois].reverse() }, geom, {
      pack,
      places: PLACES,
    });
    expect(generateWorldgenBatch(a).hash).toBe(generateWorldgenBatch(b).hash);
  });
  it('does not turn an in-store cafe or pharmacy into a second exterior storefront', () => {
    const t = tile();
    t.pois = [
      { id: 1, class: 'supermarket', name: 'QFC', point: [0.4, 0.3] },
      { id: 4, class: 'cafe', name: 'Starbucks', point: [0.3, 0.35] },
      { id: 5, class: 'pharmacy', name: 'QFC Pharmacy', point: [0.6, 0.35] },
    ];
    expect(
      semanticTileToBatch(t, geom, { pack, places: PLACES }).buildings[0]?.storefronts?.map(
        (s) => s.signModel,
      ),
    ).toEqual(['builtin:sign.food_market']);
  });
  it('leaves courtyard, outside and coarse-level points unassigned', () => {
    const t = tile();
    const p = t.buildings[0]?.polygons[0];
    if (p)
      p.holes = [
        [
          [0.3, 0.2],
          [0.3, 0.4],
          [0.6, 0.4],
          [0.6, 0.2],
        ],
      ];
    t.pois = [
      { id: 3, class: 'cafe', name: 'Starbucks', point: [0.4, 0.3] },
      { id: 4, class: 'supermarket', name: 'Safeway', point: [0.9, 0.6] },
    ];
    expect(
      semanticTileToBatch(t, geom, { pack, places: PLACES }).buildings[0]?.storefronts,
    ).toBeUndefined();
    const clean = tile();
    clean.pois = [{ id: 1, class: 'supermarket', name: 'Safeway', point: [0.4, 0.3] }];
    expect(
      semanticTileToBatch(clean, { ...geom, levelBelowMax: 1 }, { pack, places: PLACES })
        .buildings[0]?.storefronts,
    ).toBeUndefined();
  });
});
describe('mapped outdoor objects', () => {
  it('owns points once and uses measured dimensions, leaf type, heading and capacity', () => {
    const t = tile();
    t.pois = [
      {
        id: 1,
        class: 'tree',
        point: [0.2, 0.7],
        height: 15,
        crownDiameter: 6,
        leafType: 'needleleaved',
      },
      { id: 2, class: 'bench', point: [0.3, 0.7], heading: 1.2 },
      { id: 3, class: 'bicycle_parking', point: [0.4, 0.7], capacity: 12 },
      { id: 4, class: 'street_lamp', point: [0.5, 0.7], height: 3.6 },
      { id: 5, class: 'charging_station', name: 'Tesla Supercharger', point: [0.6, 0.7] },
      { id: 6, class: 'tree', point: [1, 0.7] },
      { id: 7, class: 'bench', point: [-0.01, 0.7] },
    ];
    const result = mappedPropRequests(t, geom, true, PLACES.landmarks);
    expect(result).toHaveLength(5);
    expect(result[0]?.scale).toEqual([6, 15, 6]);
    expect(result[0]?.model).toBe('builtin:tree.mapped.needleleaf');
    expect(result[1]?.yaw).toBe(1.2);
    expect(result[2]?.scale).toEqual([2, 1, 1]);
    expect(result[3]?.scale).toEqual([1, 0.5, 1]);
    expect(result[4]?.model).toBe('builtin:charger.fast');
    expect(mappedPropRequests(t, geom, true, undefined)).toHaveLength(1);
    expect(mappedPropRequests(t, geom, false, PLACES.landmarks)).toHaveLength(4);
    expect(
      mappedPropRequests(t, { ...geom, levelBelowMax: 1 }, true, PLACES.landmarks),
    ).toHaveLength(0);
  });
  it('ground-fits fixed props and caps the instance budget before scatter', () => {
    const props = [
      { identity: 'a', model: 'builtin:bench', at: [4, 8] as [number, number] },
      { identity: 'b', model: 'builtin:charger', at: [6, 9] as [number, number] },
    ];
    const r = generateWorldgenBatch({
      buildings: [],
      pack,
      props: [...props, ...props],
      ground: { ...FLAT_GROUND, sampleHeight: (x, z) => x + z },
      budgets: { maxInstances: 1 },
    });
    expect(r.placements).toHaveLength(1);
    expect(r.placements[0]?.count).toBe(1);
    expect(r.placements[0]?.data[1]).toBe(12);
  });
});

it('uses the local PMTiles identities and keeps all seven shared-strip tenants', async () => {
  const source = JSON.parse(
    await readFile(
      new URL('./fixtures/sammamish-businesses.semantic.json', import.meta.url),
      'utf8',
    ),
  ) as TerrainSemanticTile;
  const batch = semanticTileToBatch(source, { ...geom, size: 824 }, { pack, places: PLACES });
  const byId = new Map(batch.buildings.map((b) => [b.identity, b]));
  expect(byId.get('f:35184476097533')?.storefronts?.[0]?.signModel).toBe(
    'builtin:sign.burger_restaurant',
  );
  expect(byId.get('f:35184516220283')?.storefronts?.[0]?.signModel).toBe(
    'builtin:sign.grocery_market',
  );
  expect(byId.get('f:35184413749954')?.storefronts?.[0]?.signModel).toBe(
    'builtin:sign.neighborhood_grocery',
  );
  const strip = byId.get('f:35184413749959');
  expect(strip?.appearance).toBeUndefined();
  expect(strip?.storefronts).toHaveLength(7);
  expect(strip?.storefronts?.some((s) => s.signModel === 'builtin:sign.pharmacy_store')).toBe(true);
  const rendered = generateWorldgenBatch(batch);
  for (const name of [
    'burger_restaurant',
    'grocery_market',
    'neighborhood_grocery',
    'pharmacy_store',
  ])
    expect(rendered.placements.find((p) => p.modelRef === `builtin:sign.${name}`)?.count).toBe(1);
});
it('withholds identity styling on merged or ambiguous footprints and whole-shell color on node-only matches', () => {
  const t = tile();
  t.pois = [{ id: 20, class: 'fast_food', name: "McDonald's", point: [0.4, 0.3] }];
  const contained = semanticTileToBatch(t, geom, { pack, places: PLACES }).buildings[0];
  expect(contained?.storefronts).toHaveLength(1);
  expect(contained?.appearance).toBeUndefined();
  expect(
    semanticTileToBatch({ ...t, buildingsGeneralized: true }, geom, { pack, places: PLACES })
      .buildings[0]?.storefronts,
  ).toBeUndefined();
  t.buildings.push({
    id: 2,
    polygons: [
      {
        outer: [
          [0.2, 0.2],
          [0.7, 0.2],
          [0.7, 0.6],
          [0.2, 0.6],
        ],
      },
    ],
  });
  expect(
    semanticTileToBatch(t, geom, { pack, places: PLACES }).buildings.every((b) => !b.storefronts),
  ).toBe(true);
});
it('shares an instance cap across signs, mapped objects, rooftop props and scatter', () => {
  const t = tile();
  t.pois = [
    { id: 1, class: 'supermarket', name: 'Safeway', point: [0.4, 0.3] },
    { id: 3, class: 'bench', point: [0.9, 0.7] },
  ];
  const input = semanticTileToBatch(t, geom, { pack, places: PLACES });
  const zero = generateWorldgenBatch({ ...input, budgets: { maxInstances: 0 } });
  expect(zero.placements.filter((p) => p.modelRef !== 'builtin:box')).toHaveLength(0);
  const one = generateWorldgenBatch({ ...input, budgets: { maxInstances: 1 } });
  expect(one.placements.map((p) => [p.modelRef, p.count])).toEqual([
    ['builtin:sign.grocery_market', 1],
  ]);
});

it('uses category models when a mapped supermarket has no name', () => {
  const t = tile();
  t.pois = [{ id: 1, class: 'supermarket', point: [0.4, 0.3] }];
  const building = semanticTileToBatch(t, geom, { pack, places: PLACES }).buildings[0];
  expect(building?.storefronts?.[0]?.signModel).toBe('builtin:sign.grocery');
  expect(building?.appearance).toBeUndefined();
});
it('emits a clipped store sign in the point-owning tile only', () => {
  const t = tile();
  t.buildings = [
    {
      id: 1,
      polygons: [
        {
          outer: [
            [-0.015625, 0.2],
            [0.1, 0.2],
            [0.1, 0.4],
            [-0.015625, 0.4],
          ],
        },
      ],
    },
  ];
  t.pois = [{ id: 1, class: 'cafe', name: 'Starbucks', point: [-0.01, 0.3] }];
  const building = semanticTileToBatch(t, geom, { pack, places: PLACES }).buildings[0];
  expect(building?.clipped).toBe(true);
  expect(building?.storefronts).toEqual([]);
  t.pois[0].point = [0.01, 0.3];
  expect(
    semanticTileToBatch(t, geom, { pack, places: PLACES }).buildings[0]?.storefronts,
  ).toHaveLength(1);
});

it('preserves the structural style and floor count around a ground-floor business', () => {
  const t = tile();
  const feature = t.buildings[0];
  if (!feature) throw new Error('Missing fixture');
  feature.subclass = 'apartments';
  feature.levels = 6;
  delete feature.height;
  const before = generateWorldgenBatch(semanticTileToBatch(t, geom, { pack, places: PLACES }))
    .records[0];
  t.pois = [{ id: 20, class: 'fast_food', name: "McDonald's", point: [0.4, 0.3] }];
  const batch = semanticTileToBatch(t, geom, { pack, places: PLACES });
  const after = generateWorldgenBatch(batch).records[0];
  expect(after?.styleId).toBe(before?.styleId);
  expect(after?.height).toBe(before?.height);
  expect(batch.buildings[0]?.appearance).toBeUndefined();
  expect(batch.buildings[0]?.storefronts?.[0]?.signModel).toBe('builtin:sign.burger_restaurant');
});
