import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
/** Versioned, curated identities. Extend aliases/categories and the shared sign library together. */
import type { TerrainPoiFeature } from '@bendyline/molen-terrain/kernel';
import { LANDMARK_DEFINITIONS } from '@bendyline/molen-worldgen/kernel';
import { BUSINESS_CATALOG, type BusinessCategory } from './business-catalog-schema';

export interface BusinessProfile {
  id: string;
  aliases: readonly string[];
  brandIds: readonly string[];
  categories: readonly string[];
  sign: string;
  wall: string;
  accent: string;
}
export const BUSINESS_CATALOG_VERSION: number = BUSINESS_CATALOG.version;
export const BUSINESS_CATALOG_HASH: string = hashJson(BUSINESS_CATALOG as unknown as JsonValue);
export const BUSINESS_PROFILES: readonly BusinessProfile[] = BUSINESS_CATALOG.profiles.map(
  (profile) => {
    const doc = LANDMARK_DEFINITIONS[profile.landmark];
    if (doc?.generator !== 'sign') throw new Error(`Unknown business visual: ${profile.landmark}`);
    return {
      id: profile.id,
      aliases: profile.aliases,
      brandIds: profile.brandIds,
      categories: profile.categories,
      sign: doc.id.slice(5),
      wall: doc.appearance.wall,
      accent: doc.appearance.accent,
    };
  },
);

export interface ResolvedBusiness {
  category: BusinessCategory;
  profile?: BusinessProfile;
  matchedBy: 'brand-id' | 'brand' | 'name' | 'category';
  width?: number;
  sharedWidth?: number;
  style?: string;
  sign: string;
  accent: string;
}
function normalized(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’'\s.\-_/]/g, '');
}
function categoryFor(kind: string): ResolvedBusiness['category'] | undefined {
  return BUSINESS_CATALOG.categories.find((category) => category.kinds.includes(kind))?.id;
}

/** Exact normalized aliases with category checks; never substring-match a business name. */
export function resolveBusiness(
  poi: Pick<TerrainPoiFeature, 'class' | 'name' | 'brand' | 'brandId'>,
  catalog: readonly BusinessProfile[] = BUSINESS_PROFILES,
): ResolvedBusiness | undefined {
  let profile: BusinessProfile | undefined,
    matchedBy: ResolvedBusiness['matchedBy'] = 'category';
  const allows = (p: BusinessProfile): boolean =>
    p.categories.includes(poi.class) || ['building', 'yes', 'unknown'].includes(poi.class);
  if (poi.brandId) {
    profile = catalog.find(
      (p) => allows(p) && (p.brandIds.includes(poi.brandId as string) || p.id === poi.brandId),
    );
    if (profile) matchedBy = 'brand-id';
    // An explicit different identity blocks guesses from a colliding name (e.g. Target Australia).
  } else {
    for (const field of ['brand', 'name'] as const) {
      const value = poi[field];
      if (!value) continue;
      const name = normalized(value.replace(/\s*#\s*\d+\s*$/, ''));
      profile = catalog.find(
        (p) => allows(p) && p.aliases.some((alias) => normalized(alias) === name),
      );
      if (profile) {
        matchedBy = field;
        break;
      }
    }
  }
  const category =
    categoryFor(poi.class) ?? (profile ? categoryFor(profile.categories[0] ?? '') : undefined);
  if (!category) return undefined;
  const model = profile
    ? `sign.${profile.sign}`
    : BUSINESS_CATALOG.categories.find((c) => c.id === category)?.landmark;
  if (!model) return undefined;
  const doc = LANDMARK_DEFINITIONS[model];
  const visual = doc?.generator === 'sign' ? doc : undefined;
  return {
    category,
    ...(profile ? { profile } : {}),
    matchedBy,
    sign: `builtin:${model}`,
    accent: profile?.accent ?? visual?.appearance.accent ?? '#405574',
    width: visual?.storefront.width ?? 18,
    sharedWidth: visual?.storefront.sharedWidth ?? 9,
    ...(visual?.storefront.style ? { style: visual.storefront.style } : {}),
  };
}
