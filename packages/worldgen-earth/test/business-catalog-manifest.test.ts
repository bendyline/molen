import { describe, expect, it } from 'vitest';
import { validateBusinessCatalogDocuments } from '../src/kernel/business-catalog-schema';
import { PLACES } from './helpers/pack';

describe('external business mappings', () => {
  it('binds all shipped identities and categories to reusable visual manifests', () => {
    expect(
      validateBusinessCatalogDocuments(PLACES.businesses.doc, PLACES.landmarks.definitions),
    ).toEqual(PLACES.businesses.doc);
    for (const profile of PLACES.businesses.profiles) {
      const visual = PLACES.landmarks.definitions[`sign.${profile.sign}`];
      if (visual?.generator !== 'sign') throw new Error('Missing visual');
      expect(profile.wall).toBe(visual.appearance.wall);
      expect(profile.accent).toBe(visual.appearance.accent);
      expect(
        PLACES.businesses.resolve({
          class: profile.categories[0] ?? 'building',
          brandId: profile.brandIds[0],
        })?.profile?.id,
      ).toBe(profile.id);
    }
    for (const category of PLACES.businesses.doc.categories)
      expect(PLACES.businesses.resolve({ class: category.kinds[0] ?? '' })?.sign).toBe(
        `builtin:${category.landmark}`,
      );
  });
  it('rejects unresolved signs and conflicting brand IDs', () => {
    const bad = structuredClone(PLACES.businesses.doc);
    const first = bad.profiles[0],
      second = bad.profiles[1];
    if (!first || !second) throw new Error('Missing fixtures');
    first.landmark = 'sign.absent';
    expect(() => validateBusinessCatalogDocuments(bad, PLACES.landmarks.definitions)).toThrow(
      'unknown sign',
    );
    first.landmark = 'sign.burger_restaurant';
    second.brandIds = [...first.brandIds];
    expect(() => validateBusinessCatalogDocuments(bad, PLACES.landmarks.definitions)).toThrow(
      'Brand ID assigned more than once',
    );
  });
});
