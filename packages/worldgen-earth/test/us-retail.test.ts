import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  FLAT_GROUND,
  generateWorldgenBatch,
  LANDMARK_DEFINITIONS,
} from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { BUSINESS_PROFILES, resolveBusiness } from '../src/kernel/business-catalog';
import { BUSINESS_CATALOG } from '../src/kernel/business-catalog-schema';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultPack } from './helpers/pack';

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
function host(kind = 'building'): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.buildings.push({
    id: 1,
    class: kind,
    polygons: [
      {
        outer: [
          [0.1, 0.1],
          [0.9, 0.1],
          [0.9, 0.7],
          [0.1, 0.7],
        ],
      },
    ],
  });
  return tile;
}

describe('expanded U.S. retail library', () => {
  it('resolves every exact alias and source ID while rejecting misleading names and categories', () => {
    expect(BUSINESS_PROFILES.length).toBeGreaterThanOrEqual(44);
    for (const profile of BUSINESS_PROFILES) {
      for (const name of profile.aliases)
        for (const kind of profile.categories) {
          expect(resolveBusiness({ class: kind, name })?.profile?.id, name).toBe(profile.id);
          expect(
            resolveBusiness({ class: kind, name: `${name} Book Exchange` })?.profile,
          ).toBeUndefined();
          expect(
            resolveBusiness({ class: kind, name, brandId: 'conflicting-source-id' })?.profile,
          ).toBeUndefined();
        }
      for (const brandId of profile.brandIds)
        expect(
          resolveBusiness({
            class: profile.categories[0] ?? 'building',
            name: 'Local name',
            brandId,
          })?.profile?.id,
        ).toBe(profile.id);
      expect(
        resolveBusiness({ class: 'books', name: profile.aliases[0] })?.profile,
      ).toBeUndefined();
    }
    expect(
      resolveBusiness({ class: 'supermarket', name: "Lowe's Market" })?.profile,
    ).toBeUndefined();
    expect(resolveBusiness({ class: 'clothes', name: 'Nordstrom Rack' })?.profile).toBeUndefined();
    expect(
      resolveBusiness({ class: 'department_store', name: "Macy's Backstage" })?.profile,
    ).toBeUndefined();
  });
  it('binds architecture hints to shipped styles and preserves measured dimensions', () => {
    for (const profile of BUSINESS_PROFILES.slice(8)) {
      const tile = host();
      const feature = tile.buildings[0];
      if (!feature) throw new Error('Missing host');
      feature.height = 7.25;
      feature.levels = 1;
      tile.pois = [
        {
          id: 1,
          class: profile.categories[0] ?? 'retail',
          brandId: profile.brandIds[0],
          point: [0.4, 0.65],
        },
      ];
      const request = semanticTileToBatch(tile, geom, { pack }).buildings[0];
      const visual = LANDMARK_DEFINITIONS[`sign.${profile.sign}`];
      if (visual?.generator !== 'sign' || !visual.storefront.style)
        throw new Error('Missing architecture');
      expect(pack.archstyles[visual.storefront.style]).toBeDefined();
      expect(request?.style).toBe(visual.storefront.style);
      expect(request?.height).toBe(7.25);
      expect(request?.levels).toBe(1);
      expect(request?.outline).toEqual([
        [10, 10],
        [90, 10],
        [90, 70],
        [10, 70],
      ]);
      expect(request?.storefronts?.[0]?.signModel).toBe(`builtin:sign.${profile.sign}`);
    }
  });
  it('selects distinct unmeasured restaurant, warehouse and department-store envelopes', () => {
    const records = ['taco_bell', 'costco', 'macys'].map((id) => {
      const tile = host();
      const profile = BUSINESS_PROFILES.find((p) => p.id === id);
      if (!profile) throw new Error(id);
      tile.pois = [
        {
          id: 1,
          class: profile.categories[0] ?? 'retail',
          brandId: profile.brandIds[0],
          point: [0.4, 0.65],
        },
      ];
      const batch = semanticTileToBatch(tile, geom, { pack });
      return generateWorldgenBatch({ ...batch, ground: FLAT_GROUND }).records[0];
    });
    expect(records[0]?.height).toBeLessThan(records[1]?.height ?? 0);
    expect(records[0]?.height).toBeLessThan(records[2]?.height ?? 0);
    expect(new Set(records.map((r) => r?.styleId)).size).toBe(3);
  });
  it('treats unnamed centers as categories, preserving courtyard and independent tenants', () => {
    for (const category of BUSINESS_CATALOG.categories.filter((c) =>
      ['mall', 'department_store', 'outlet_mall', 'strip_mall'].includes(c.id),
    )) {
      const tile = host(category.kinds[0]);
      const polygon = tile.buildings[0]?.polygons[0];
      if (!polygon) throw new Error('Missing host');
      polygon.holes = [
        [
          [0.35, 0.3],
          [0.35, 0.5],
          [0.65, 0.5],
          [0.65, 0.3],
        ],
      ];
      tile.pois = [
        { id: 1, class: category.kinds[0] ?? '', point: [0.2, 0.65] },
        { id: 2, class: 'electronics', name: 'Best Buy', point: [0.45, 0.65] },
        { id: 3, class: 'fast_food', name: 'Panera Bread', point: [0.75, 0.65] },
        { id: 4, class: 'fast_food', name: 'Subway', point: [0.5, 0.4] },
      ];
      const batch = semanticTileToBatch(tile, geom, { pack });
      const request = batch.buildings[0];
      expect(request?.appearance).toBeUndefined();
      expect(request?.holes).toHaveLength(1);
      expect(request?.style).toBe(resolveBusiness({ class: category.kinds[0] ?? '' })?.style);
      expect(request?.storefronts?.map((s) => s.signModel)).toEqual([
        `builtin:${category.landmark}`,
        'builtin:sign.electronics_store',
        'builtin:sign.bread_cafe',
      ]);
      const a = generateWorldgenBatch(batch);
      const b = generateWorldgenBatch(
        semanticTileToBatch({ ...tile, pois: [...tile.pois].reverse() }, geom, { pack }),
      );
      expect(a.hash).toBe(b.hash);
    }
  });
  it('keeps tenant styles off civic hosts and malls and tolerates custom packs without retail styles', () => {
    for (const kind of ['apartments', 'school', 'mall']) {
      const tile = host(kind);
      const before = generateWorldgenBatch(semanticTileToBatch(tile, geom, { pack })).records[0];
      tile.pois = [{ id: 2, class: 'fast_food', name: 'Taco Bell', point: [0.4, 0.65] }];
      const request = semanticTileToBatch(tile, geom, { pack });
      const after = generateWorldgenBatch(request).records[0];
      expect(after?.styleId).toBe(before?.styleId);
      expect(after?.height).toBe(before?.height);
      expect(request.buildings[0]?.appearance).toBeUndefined();
    }
    const tile = host();
    tile.pois = [{ id: 1, class: 'electronics', name: 'Best Buy', point: [0.4, 0.65] }];
    const archstyles = { ...pack.archstyles };
    delete archstyles['molen.worldgen.generic.big_box'];
    const batch = semanticTileToBatch(tile, geom, { pack: { ...pack, archstyles } });
    expect(batch.buildings[0]?.style).not.toBe('molen.worldgen.generic.big_box');
    expect(batch.buildings[0]?.storefronts?.[0]?.signModel).toBe('builtin:sign.electronics_store');
  });
});
