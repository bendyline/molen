import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createEmptyTerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import {
  type BuildingMetrics,
  FLAT_GROUND,
  generateBuilding,
  MeshBufferBuilder,
  selectStyle,
} from '@bendyline/molen-worldgen/kernel';
import { Color, SRGBColorSpace } from 'three';
import { describe, expect, it } from 'vitest';
import { createRegionalLibrary } from '../src/kernel/regional-content';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';
import { semanticTileToBatch } from '../src/kernel/semantic-adapter';
import { loadDefaultAtlas, loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const atlas = await loadDefaultAtlas();
const bytes = await readFile(
  new URL('../../../content/worldgen/regional.catalog.json', import.meta.url),
);
const doc = regionalCatalogSchema.parse(JSON.parse(bytes.toString()));
const library = createRegionalLibrary([doc], pack);
const metrics: BuildingMetrics = {
  labels: ['house'],
  areaM2: 120,
  perimeterM: 44,
  vertexCount: 4,
  hasHoles: false,
  elongation: 1.2,
  rectangularity: 1,
};
const selected = (
  regionId: string | undefined,
  labels: string[],
  overrides: Partial<BuildingMetrics> = {},
) =>
  selectStyle(
    library.select(regionId === undefined ? {} : { regionId }).buildings ?? [],
    { ...metrics, labels, ...overrides },
    pack.root.defaults.style,
    'same-building',
  ).style.replace(/\.(compact|open)$/, '');

describe('ordinary regional architecture', () => {
  it('chooses regional lot plans, garages and materials for inferred homes, and shops for commercial land', () => {
    const tile = createEmptyTerrainSemanticTile();
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
    tile.landcover = [
      {
        class: 'residential',
        polygons: [
          {
            outer: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          },
        ],
      },
    ];
    const geom = {
      level: 15,
      x: 0,
      z: 0,
      originX: 0,
      originZ: 0,
      size: 480,
      metersPerUnit: 1,
      levelBelowMax: 0,
    };
    for (const [regionId, family, wall, roof] of [
      ['us.southwest', 'southwestern', 'stucco', 'tile_ceramic'],
      ['us.pnw', 'north_american', 'siding', 'shingle_asphalt'],
      ['jp', 'east_asian', 'stucco', 'tile_ceramic'],
    ]) {
      const region = atlas.regions.find((r) => r.id === regionId);
      if (!region) throw new Error(`Missing ${regionId}`);
      const regions = { atlas, resolve: () => region, intersecting: () => [region] };
      const environment = createRegionalEnvironment({ catalogs: [doc] }, 1, regions);
      const options = { pack, environment, regions, buildingInfill: { seed: 819 } };
      const batch = semanticTileToBatch(tile, geom, options);
      const homes = batch.buildings.filter((b) => b.labels.includes('house'));
      expect(homes.length).toBeGreaterThan(35);
      expect(homes.every((b) => b.style?.includes(`.${family}.detached`))).toBe(true);
      const houseStyle = pack.archstyles[homes[0]?.style ?? ''];
      expect(houseStyle?.materials.wall.choices[0]?.ref).toContain(wall);
      expect(houseStyle?.materials.roof.choices[0]?.ref).toContain(roof);
      expect(new Set(homes.map((b) => b.outline.length)).size).toBeGreaterThan(1);
      const garages = batch.buildings.filter((b) => b.access?.garage);
      if (regionId === 'jp') expect(garages).toHaveLength(0);
      else {
        expect(garages.length).toBeGreaterThan(8);
        expect(garages.every((b) => b.levels === 1)).toBe(true);
      }
      const commercial = structuredClone(tile);
      if (commercial.landcover[0]) commercial.landcover[0].class = 'commercial';
      const shops = semanticTileToBatch(commercial, geom, options).buildings;
      expect(shops.length).toBeGreaterThan(30);
      expect(
        shops.every((b) => b.labels.includes('commercial') && b.style?.includes('.commercial')),
      ).toBe(true);
    }
  });
  it('selects all three recipes for every family and use from stable building identities', () => {
    for (const profile of doc.profiles) {
      const seen = new Set<string>();
      for (const rule of profile.buildings ?? []) {
        if (!rule.style.startsWith('molen.worldgen.regional.') || seen.has(rule.style)) continue;
        seen.add(rule.style);
        expect(rule.variants).toHaveLength(3);
        const rules = [{ ...rule, when: undefined }];
        const draws = Array.from(
          { length: 100 },
          (_, i) => selectStyle(rules, metrics, rule.style, `regional-building-${i}`).style,
        );
        expect(new Set(draws)).toEqual(new Set(rule.variants?.map((v) => v.style)));
        expect(selectStyle(rules, metrics, rule.style).style).toBe(rule.style);
        expect(draws).toEqual(
          Array.from(
            { length: 100 },
            (_, i) => selectStyle(rules, metrics, rule.style, `regional-building-${i}`).style,
          ),
        );
      }
      expect(seen.size).toBe(7);
    }
  });
  it('keeps at least a third of every ordinary wall palette visibly colored, as required by medium-fi', () => {
    for (const style of Object.values(pack.archstyles)) {
      if (!style.id.startsWith('molen.worldgen.regional.')) continue;
      const entries = style.palettes.regional_wall?.entries ?? [];
      let total = 0,
        colored = 0;
      for (const entry of entries) {
        const weight = entry.weight ?? 1;
        total += weight;
        if (new Color(entry.color).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace).s >= 0.25)
          colored += weight;
      }
      expect(total, style.id).toBeGreaterThan(0);
      expect(colored / total, style.id).toBeGreaterThanOrEqual(1 / 3);
    }
  });

  it('covers every architectural atlas region, with a conservative worldwide fallback', () => {
    expect(gzipSync(bytes).length).toBeLessThan(20_000);
    for (const region of atlas.regions) {
      const profile = library.select({ regionId: region.id }).architectureProfile;
      expect(profile, region.id).toBeDefined();
      expect(profile, region.id).not.toContain('neutral');
    }
    expect(selected(undefined, ['house'])).toBe('molen.worldgen.regional.neutral.detached');
    expect(selected('us.pnw', ['house'])).toBe('molen.worldgen.regional.north_american.detached');
    expect(selected('us.southwest', ['house'])).toBe(
      'molen.worldgen.regional.southwestern.detached',
    );
    expect(selected('jp', ['house'])).toBe('molen.worldgen.regional.east_asian.detached');
    expect(selected('library.fiji', ['house'])).toBe(
      'molen.worldgen.regional.tropical_timber.detached',
    );
  });

  it('prioritizes mapped use and dimensions over neighborhood guesses and keeps explicit precedents', () => {
    for (const region of ['us.pnw', 'jp', 'library.italy', 'library.south_asia']) {
      for (const [label, type] of [
        ['school', 'civic'],
        ['warehouse', 'industrial'],
        ['barn', 'farm'],
        ['retail', 'commercial'],
        ['apartments', 'apartments'],
        ['terrace', 'attached'],
      ] as const)
        expect(selected(region, [label], { context: 'residential' })).toMatch(
          new RegExp(`\\.${type}$`),
        );
      expect(selected(region, ['house'], { levels: 5 })).toMatch(/\.apartments$/);
      expect(selected(region, ['house'], { height: 18 })).toMatch(/\.apartments$/);
      expect(selected(region, ['yes'], { context: 'industrial' })).toMatch(/\.industrial$/);
      expect(selected(region, ['yes'], { context: 'farmyard' })).toMatch(/\.farm$/);
      expect(selected(region, ['cowshed'])).toMatch(/\.farm$/);
      expect(selected(region, ['school'], { context: 'farmyard' })).toMatch(/\.civic$/);
      expect(selected(region, ['gassho_farmhouse'])).toBe(
        'molen.worldgen.catalog.gassho_farmhouse',
      );
    }
  });

  it('generates every recipe deterministically, with source dimensions and bounded geometry', () => {
    const styles = Object.values(pack.archstyles).filter((style) =>
      style.id.startsWith('molen.worldgen.regional.'),
    );
    expect(styles).toHaveLength(294);
    for (const style of styles) {
      const build = () => {
        const builder = new MeshBufferBuilder();
        const result = generateBuilding(
          {
            request: {
              identity: 'regional-qa',
              labels: ['building'],
              outline: [
                [0, 0],
                [12, 0],
                [12, 10],
                [0, 10],
              ],
              height: 17,
              levels: 5,
            },
            style,
            pack: { name: pack.id, version: pack.version },
            ground: FLAT_GROUND,
            tier: 0,
          },
          builder,
        );
        return { result, mesh: builder.finalize() };
      };
      const a = build();
      expect(a.result.skipped, style.id).toBeUndefined();
      expect(a.result.recipe?.heightSource, style.id).toBe('height');
      expect(a.result.record?.height, style.id).toBe(17);
      expect(a.result.recipe?.floors, style.id).toBe(5);
      expect(a.result.recipe?.roof.type, style.id).toBe('flat');
      expect(a.mesh.triangleCount, style.id).toBeGreaterThan(12);
      expect(a.mesh.triangleCount, style.id).toBeLessThan(15_000);
      expect(Array.from(a.mesh.positions).every(Number.isFinite), style.id).toBe(true);
      expect(a.mesh.positions, style.id).toEqual(build().mesh.positions);
    }
  }, 30_000); // Builds every regional style twice.
});
