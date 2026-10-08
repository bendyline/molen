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
    expect(fauna.animals).toHaveLength(30);
    expect(ranges.taxa).toHaveLength(21);
    expect(
      gzipSync(read('wildlife/ranges.json')).length +
        gzipSync(read('wildlife/regional.catalog.json')).length,
    ).toBeLessThan(40_000);
    expect(
      ranges.sources.every((source) => ['CC-BY-4.0', 'public-domain'].includes(source.license)),
    ).toBe(true);
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
