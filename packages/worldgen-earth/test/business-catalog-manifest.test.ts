import { LANDMARK_DEFINITIONS } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { BUSINESS_PROFILES, resolveBusiness } from '../src/kernel/business-catalog';
import {
  BUSINESS_CATALOG,
  validateBusinessCatalogDocuments,
} from '../src/kernel/business-catalog-schema';

describe('external business mappings', () => {
  it('binds all shipped identities and categories to reusable visual manifests', () => {
    expect(validateBusinessCatalogDocuments(BUSINESS_CATALOG)).toEqual(BUSINESS_CATALOG);
    for (const profile of BUSINESS_PROFILES) {
      const visual = LANDMARK_DEFINITIONS[`sign.${profile.sign}`];
      if (visual?.generator !== 'sign') throw new Error('Missing visual');
      expect(profile.wall).toBe(visual.appearance.wall);
      expect(profile.accent).toBe(visual.appearance.accent);
      expect(
        resolveBusiness({
          class: profile.categories[0] ?? 'building',
          brandId: profile.brandIds[0],
        })?.profile?.id,
      ).toBe(profile.id);
    }
    for (const category of BUSINESS_CATALOG.categories)
      expect(resolveBusiness({ class: category.kinds[0] ?? '' })?.sign).toBe(
        `builtin:${category.landmark}`,
      );
  });
  it('rejects unresolved signs and conflicting brand IDs', () => {
    const bad = structuredClone(BUSINESS_CATALOG);
    const first = bad.profiles[0],
      second = bad.profiles[1];
    if (!first || !second) throw new Error('Missing fixtures');
    first.landmark = 'sign.absent';
    expect(() => validateBusinessCatalogDocuments(bad)).toThrow('unknown sign');
    first.landmark = 'sign.burger_restaurant';
    second.brandIds = [...first.brandIds];
    expect(() => validateBusinessCatalogDocuments(bad)).toThrow('Brand ID assigned more than once');
  });
});
