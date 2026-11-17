import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { EcologyAtlasDoc } from '../src/kernel/ecology-atlas';
import { projectWgs84 } from '../src/kernel/projection';
import { createRegionalLibrary, type RegionalCatalogDoc } from '../src/kernel/regional-content';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';
import { createWildlifeRangeResolver, type WildlifeRangesDoc } from '../src/kernel/wildlife-ranges';

const read = (path: string): string =>
  readFileSync(new URL(`../../../content/${path}`, import.meta.url), 'utf8');
const ranges: WildlifeRangesDoc = JSON.parse(read('wildlife/ranges.json'));
const ecology: EcologyAtlasDoc = JSON.parse(read('ecology/ecoregions.json'));
const plants: RegionalCatalogDoc = JSON.parse(read('ecology/regional.catalog.json'));
const fauna: RegionalCatalogDoc = regionalCatalogSchema.parse(
  JSON.parse(read('wildlife/regional.catalog.json')),
);
const env = createRegionalEnvironment(
  { atlas: ecology, catalogs: [fauna, plants], wildlifeRanges: ranges },
  1,
);
const at = (lon: number, lat: number, context = {}): string[] => {
  const [x, z] = projectWgs84(lon, lat);
  return env.wildlife(x, z, context).map((choice) => choice.species.id.split('.').at(-1) as string);
};

describe('regional wildlife content', () => {
  it('suppresses cold-season insects and reptiles without treating tropical January as winter', () => {
    const winter = createRegionalEnvironment(
      { atlas: ecology, catalogs: [plants, fauna], wildlifeRanges: ranges, vegetationMonth: 1 },
      1,
    );
    const [x, z] = projectWgs84(8.4, 48.9);
    expect(winter.wildlife(x, z).some((choice) => choice.species.body.family === 'insect')).toBe(
      false,
    );
    expect(env.wildlife(x, z).some((choice) => choice.species.body.family === 'insect')).toBe(true);
    const [tx, tz] = projectWgs84(-60, -3);
    expect(winter.wildlife(tx, tz).some((choice) => choice.species.body.family === 'insect')).toBe(
      true,
    );
  });
  it('ships bounded compact recipes and attributed ranges', () => {
    expect(fauna.animals).toHaveLength(111);
    expect(ranges.taxa).toHaveLength(21);
    expect(
      gzipSync(read('wildlife/ranges.json')).length +
        gzipSync(read('wildlife/regional.catalog.json')).length,
    ).toBeLessThan(40_000);
    expect(
      ranges.sources.every((source) => ['CC-BY-4.0', 'public-domain'].includes(source.license)),
    ).toBe(true);
  });

  it('keeps each body variant in its original range and habitat, splitting visual density three ways', () => {
    const species = new Map(fauna.animals?.map((animal) => [animal.id, animal]));
    const rules = fauna.populations?.[0]?.rules ?? [];
    expect(rules).toHaveLength(111);
    for (const base of fauna.animals ?? []) {
      if (/\.(compact|rangy)$/.test(base.id)) continue;
      const original = rules.find((r) => r.animal === base.id);
      for (const suffix of ['.compact', '.rangy']) {
        const variant = species.get(`${base.id}${suffix}`);
        expect(variant?.range).toBe(base.range);
        expect(variant?.taxon).toBe(base.taxon);
        expect(variant?.body.details).toEqual(base.body.details);
        expect(variant?.inactiveInWinter).toBe(base.inactiveInWinter);
        expect(rules.find((r) => r.animal === variant?.id)).toEqual({
          ...original,
          animal: variant?.id,
        });
      }
    }
    // Representative original visual priors remain totals, not totals per body variant.
    expect(
      rules
        .filter((r) => r.animal.startsWith('molen.wildlife.animal.flower_visiting_insect'))
        .reduce((sum, r) => sum + r.density, 0),
    ).toBe(30);
    const [x, z] = projectWgs84(134, -24);
    const ids = env.wildlife(x, z).map((c) => c.species.id);
    expect(ids.filter((id) => id.includes('.red_kangaroo'))).toHaveLength(3);
    expect(ids.some((id) => id.includes('.red_fox'))).toBe(false);
  });

  it('separates native mammal ranges and overseas territory geography', () => {
    expect(at(8.4, 48.9)).toContain('roe_deer');
    expect(at(-73.8, 43.1)).toContain('white_tailed_deer');
    expect(at(134, -24)).toContain('red_kangaroo');
    expect(at(8.4, 48.9)).not.toContain('red_kangaroo');
    expect(at(134, -24)).not.toContain('red_fox');
    expect(at(174, -41)).not.toContain('red_deer');
    const resolver = createWildlifeRangeResolver(ranges);
    expect(resolver.countryAt(-53, 4)).toBe('GF');
    expect(resolver.countryAt(3, 47)).toBe('FR');
    expect(resolver.countryAt(183, 47)).toBe(resolver.countryAt(-177, 47));
    const [x, z] = projectWgs84(-53, 4);
    expect(resolver.includes('Capreolus_capreolus', x, z)).toBe(false);
    expect(resolver.includes('Hydrochoerus_hydrochaeris', x, z)).toBe(true);
  });

  it('requires water context and extra evidence for large or rare wildlife', () => {
    expect(at(-56, -17)).not.toContain('capybara');
    expect(at(-56, -17, { waterDistance: 10 })).toContain('capybara');
    expect(at(34.9, -2.5)).not.toContain('savanna_elephant');
    expect(at(34.9, -2.5, { protected: true })).toContain('savanna_elephant');
    expect(at(-140, 0)).toEqual([]);
    const noRanges = createRegionalEnvironment({ atlas: ecology, catalogs: [plants, fauna] }, 1);
    const [x, z] = projectWgs84(8.4, 48.9);
    expect(noRanges.wildlife(x, z).every((choice) => choice.species.taxon === undefined)).toBe(
      true,
    );
  });

  it('offers town and garden groups by habitat, with no species or range claimed', () => {
    const groups = [
      'town_songbird_group',
      'town_corvid_group',
      'town_pigeon_group',
      'lawn_waterfowl_group',
      'garden_butterfly_group',
      'domestic_cat_group',
      'garden_rabbit_group',
    ];
    const named = (name: string) =>
      (fauna.animals ?? []).filter((animal) => animal.id.split('.')[3] === name);
    for (const group of groups) {
      expect(named(group), group).toHaveLength(3);
      for (const animal of named(group)) {
        expect(animal.taxon, animal.id).toBeUndefined();
        expect(animal.range, animal.id).toBeUndefined();
      }
    }
    // Only named mammals carry a taxon, and each has its range: 21 of them, as before.
    expect(new Set((fauna.animals ?? []).flatMap((animal) => animal.taxon ?? [])).size).toBe(21);
    // What a habitat offers at a place: the choices whose rule names that habitat.
    const [sx, sz] = projectWgs84(-122.33, 47.61);
    const offered = (habitat: string, context = {}, x = sx, z = sz): string[] => [
      ...new Set(
        env
          .wildlife(x, z, context)
          .filter((choice) => choice.habitats.includes(habitat))
          .map((choice) => choice.species.id.split('.')[3] as string),
      ),
    ];
    // Seattle: temperate conifer forest, Nearctic, United States.
    expect(env.ecology?.resolve(sx, sz)).toMatchObject({ biome: 5, realm: 'Nearctic' });
    expect(offered('yard').sort()).toEqual([
      'domestic_cat_group',
      'eastern_grey_squirrel',
      'garden_butterfly_group',
      'garden_rabbit_group',
      'town_corvid_group',
      'town_pigeon_group',
      'town_songbird_group',
      'woodland_songbird',
    ]);
    expect(offered('park').sort()).toEqual([
      'eastern_grey_squirrel',
      'flower_visiting_insect',
      'garden_butterfly_group',
      'garden_rabbit_group',
      'town_corvid_group',
      'town_pigeon_group',
      'town_songbird_group',
      'woodland_songbird',
    ]);
    // Grazing waterfowl need mapped water within 60 m of the lawn.
    expect(offered('park', { waterDistance: 61 })).not.toContain('lawn_waterfowl_group');
    expect(offered('park', { waterDistance: 60 })).toContain('lawn_waterfowl_group');
    expect(offered('grass', { waterDistance: 10 })).toContain('lawn_waterfowl_group');
    expect(offered('yard', { waterDistance: 10 })).not.toContain('lawn_waterfowl_group');
    // The cat keeps to yards; the rabbit to temperate Nearctic and Palearctic ground.
    expect(offered('park')).not.toContain('domestic_cat_group');
    expect(offered('yard', {}, ...projectWgs84(8.4, 48.9))).toContain('garden_rabbit_group');
    for (const [lon, lat] of [
      [134, -24],
      [151.2, -33.87],
      [-60, -3],
      [77.2, 28.6],
    ] as const) {
      const yard = offered('yard', {}, ...projectWgs84(lon, lat));
      expect(yard, `${lon}, ${lat}`).not.toContain('garden_rabbit_group');
      expect(yard, `${lon}, ${lat}`).not.toContain('eastern_grey_squirrel');
      expect(yard, `${lon}, ${lat}`).toContain('town_songbird_group');
      expect(yard, `${lon}, ${lat}`).toContain('domestic_cat_group');
    }
    // Garden butterflies sit the cold season out with the other insects.
    const winter = createRegionalEnvironment(
      { atlas: ecology, catalogs: [plants, fauna], wildlifeRanges: ranges, vegetationMonth: 1 },
      1,
    );
    const inWinter = winter.wildlife(sx, sz).map((choice) => choice.species.id.split('.')[3]);
    expect(inWinter).not.toContain('garden_butterfly_group');
    expect(inWinter).toContain('town_songbird_group');
    // No rule names a habitat the Earth view never reports.
    const rules = fauna.populations?.[0]?.rules ?? [];
    expect(rules.flatMap((rule) => rule.habitats)).not.toContain('wood');
    expect(rules.flatMap((rule) => rule.habitats)).not.toContain('coast');
  });

  it('resolves fauna independently and rejects accidental channel ambiguity and missing references', () => {
    const library = createRegionalLibrary([fauna, plants]);
    expect(
      library.select({ ecoregion: { id: 1, name: 'Test', biome: 13, realm: 'Nearctic' } }).wildlife
        ?.id,
    ).toBe('molen.wildlife.population.global');
    const duplicate = structuredClone(fauna);
    const first = duplicate.profiles[0];
    if (first === undefined) throw new Error('Expected a wildlife profile');
    duplicate.profiles.push({ ...first, id: 'test.duplicate' });
    expect(() => createRegionalLibrary([plants, duplicate])).toThrow('Ambiguous regional channel');
    const missing = structuredClone(fauna);
    if (missing.populations?.[0]?.rules[0]) missing.populations[0].rules[0].animal = 'test.missing';
    expect(() => createRegionalLibrary([plants, missing])).toThrow('Missing regional animal');
  });
});
