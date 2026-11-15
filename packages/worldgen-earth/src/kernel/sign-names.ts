/**
 * Real place names on storefront signs. A recognized place shows its name in a look with the
 * flavor of its real counterpart: a chain the catalog knows takes its descriptor sign's palette
 * and one display name for every branch; any other named place takes a look from its category's
 * family, chosen by its name so branches of a local chain match. Names are set only in the glyph
 * atlas faces; a place whose name those faces cannot set, or that has no name, keeps its
 * descriptor sign.
 */
import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
import type { TerrainPoiFeature } from '@bendyline/molen-terrain/kernel';
import {
  type GlyphAtlasSet,
  hashString,
  type LandmarkDefinitions,
  type StorefrontSign,
} from '@bendyline/molen-worldgen/kernel';
import type { BusinessCatalog, BusinessProfile, ResolvedBusiness } from './business-catalog';
import { cleanBusinessName, isLatinText, normalizeBusinessName } from './business-names';
import { type SignLook, type SignLooksDoc, validateSignLooks } from './sign-looks-schema';

export interface SignNamer {
  /** Hash of the looks, the glyph atlas set and the catalog: part of a tile's cache key. */
  readonly hash: string;
  readonly glyphs: GlyphAtlasSet;
  readonly looks: SignLooksDoc;
  /** The sign for a recognized place, or undefined to keep its descriptor sign. */
  sign(
    poi: Pick<TerrainPoiFeature, 'name' | 'nameLatin'>,
    business: ResolvedBusiness,
  ): StorefrontSign | undefined;
}

const sameColor = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** A chain's look: its descriptor sign's palette, then the looks document's overrides. */
function chainLook(
  profile: BusinessProfile,
  definitions: LandmarkDefinitions,
  override: Partial<SignLook> | undefined,
): SignLook {
  const visual = definitions[`sign.${profile.sign}`];
  const sign = visual?.generator === 'sign' ? visual.sign : undefined;
  const base: SignLook = sign
    ? {
        plate: sign.background,
        ink: sign.foreground,
        ...(!sameColor(sign.mark, sign.background) && !sameColor(sign.mark, sign.foreground)
          ? { stripe: sign.mark }
          : {}),
        font: 'bold',
      }
    : { plate: profile.accent, ink: '#ffffff', font: 'bold' };
  return { ...base, ...override } as SignLook;
}

export function createSignNamer(
  looksDoc: unknown,
  glyphs: GlyphAtlasSet,
  catalog: BusinessCatalog,
  definitions: LandmarkDefinitions,
): SignNamer {
  const looks = validateSignLooks(looksDoc, new Set(catalog.profiles.map((p) => p.id)));
  /** Set `text` in `look`, or undefined when no face holds it. */
  const set = (text: string, look: SignLook): StorefrontSign | undefined => {
    let shown = text;
    if (look.case === 'upper') {
      const upper = text.toUpperCase();
      if (glyphs.faceFor(upper, look.font) !== undefined) shown = upper;
    }
    if (glyphs.faceFor(shown, look.font) === undefined) return undefined;
    return {
      text: shown,
      plate: look.plate,
      ink: look.ink,
      ...(look.stripe !== undefined ? { stripe: look.stripe } : {}),
      ...(look.font !== undefined ? { font: look.font } : {}),
      ...(look.letterSpacing !== undefined ? { letterSpacing: look.letterSpacing } : {}),
    };
  };
  return {
    hash: hashJson({
      looks: looks as unknown as JsonValue,
      glyphs: glyphs.hash,
      catalog: catalog.hash,
    }),
    glyphs,
    looks,
    sign(poi, business) {
      const profile = business.profile;
      if (profile !== undefined) {
        const chain = looks.chains?.[profile.id];
        const look = chainLook(profile, definitions, chain?.look);
        // A branch matched by a name in another script shows that name (マクドナルド); otherwise
        // every branch shows the chain's one display name.
        const alias = business.matchedAlias;
        const local = alias !== undefined && !isLatinText(alias) ? alias : undefined;
        for (const text of [local, chain?.display, profile.aliases[0]])
          if (text !== undefined) {
            const sign = set(text, look);
            if (sign !== undefined) return sign;
          }
        return undefined;
      }
      const family = looks.families[business.category];
      if (family === undefined || family.length === 0) return undefined;
      for (const raw of [poi.name, poi.nameLatin]) {
        const text = raw !== undefined ? cleanBusinessName(raw) : undefined;
        if (text === undefined) continue;
        const look = family[
          (hashString(normalizeBusinessName(text)) >>> 0) % family.length
        ] as SignLook;
        const sign = set(text, look);
        if (sign !== undefined) return sign;
      }
      return undefined;
    },
  };
}
