import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
/** Versioned, curated identities. Extend aliases/categories and the shared sign library together. */
import type { TerrainPoiFeature } from '@bendyline/molen-terrain/kernel';
import type { LandmarkDefinitions, LandmarkLibrary } from '@bendyline/molen-worldgen/kernel';
import {
  type BusinessCatalogDoc,
  type BusinessCategory,
  validateBusinessCatalogDocuments,
} from './business-catalog-schema';

export interface BusinessProfile {
  id: string;
  aliases: readonly string[];
  brandIds: readonly string[];
  categories: readonly string[];
  sign: string;
  wall: string;
  accent: string;
}

function profilesOf(
  doc: BusinessCatalogDoc,
  definitions: LandmarkDefinitions,
): readonly BusinessProfile[] {
  return doc.profiles.map((profile) => {
    const visual = definitions[profile.landmark];
    if (visual?.generator !== 'sign') {
      throw new Error(`Unknown business visual: ${profile.landmark}`);
    }
    return {
      id: profile.id,
      aliases: profile.aliases,
      brandIds: profile.brandIds,
      categories: profile.categories,
      sign: visual.id.slice(5),
      wall: visual.appearance.wall,
      accent: visual.appearance.accent,
    };
  });
}

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
type PoiIdentity = Pick<TerrainPoiFeature, 'class' | 'name' | 'brand' | 'brandId'>;

/** Exact normalized aliases with category checks; never substring-match a business name. */
function resolveWith(
  poi: PoiIdentity,
  doc: BusinessCatalogDoc,
  catalog: readonly BusinessProfile[],
  definitions: LandmarkDefinitions,
): ResolvedBusiness | undefined {
  const categoryFor = (kind: string): ResolvedBusiness['category'] | undefined =>
    doc.categories.find((category) => category.kinds.includes(kind))?.id;
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
    : doc.categories.find((c) => c.id === category)?.landmark;
  if (!model) return undefined;
  const landmark = definitions[model];
  const visual = landmark?.generator === 'sign' ? landmark : undefined;
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

/** A business identity catalog, resolved against the landmark models its signs use. */
export interface BusinessCatalog {
  /** Hash of the validated catalog; a cache key for generated tiles. */
  readonly hash: string;
  readonly version: number;
  readonly doc: BusinessCatalogDoc;
  readonly profiles: readonly BusinessProfile[];
  /** Identify a mapped place, or undefined when it is not a business this catalog knows. */
  resolve(poi: PoiIdentity): ResolvedBusiness | undefined;
}

/** Validate a molen/business-catalog@1 document against a landmark library. */
export function createBusinessCatalog(doc: unknown, landmarks: LandmarkLibrary): BusinessCatalog {
  const validated = validateBusinessCatalogDocuments(doc, landmarks.definitions);
  const profiles = profilesOf(validated, landmarks.definitions);
  return {
    hash: hashJson(validated as unknown as JsonValue),
    version: validated.version,
    doc: validated,
    profiles,
    resolve: (poi) => resolveWith(poi, validated, profiles, landmarks.definitions),
  };
}
