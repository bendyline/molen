import { z } from 'zod';

/**
 * How a region signs its street names: where the names stand, panel colours and shape, letter
 * case, and any abbreviations its signs use for the spelled-out names map data carries
 * ("Northeast 45th Street" is posted as "NE 45th St").
 */
export interface TerrainStreetNameStyle {
  panelColor: string;
  inkColor: string;
  /** Panel border; the ink colour when omitted. */
  borderColor?: string;
  /**
   * `post` (default) stands both of a corner's names on one post. `wall` fixes a plate for each
   * street to the corner building's wall facing that street, and a low two-legged frame where
   * no wall stands near the corner.
   */
  mount?: 'post' | 'wall';
  /** Panel shape on a post or frame: narrow North American `blade`s (default) or taller `plate`s. */
  panel?: 'blade' | 'plate';
  /** Also hang the cross street's name from each signal mast arm, as in North America. */
  mastArms?: boolean;
  /** `upper` letters names in capitals, as many British, French and Italian plates do. */
  letterCase?: 'mapped' | 'upper';
  /** Compass words, abbreviated as a name's first or last word when another word remains. */
  directions?: Record<string, string>;
  /** Street types, abbreviated as the last word (or the last before a direction), never the first. */
  types?: Record<string, string>;
  /** Other words abbreviated anywhere but the last position, e.g. Saint, Mount, Junior. */
  words?: Record<string, string>;
}

/** A serializable visual convention, independent of the detected road-sign pattern. */
export interface TerrainRoadSignProfile {
  id: string;
  title: string;
  countries: string[];
  /** ISO subdivision codes; specific profiles override country defaults. */
  subdivisions?: string[];
  stateNetwork?: string;
  motorwayColor: string;
  exitColor: string;
  attractionColor: string;
  drivingSide: 'left' | 'right';
  speedSign: 'rectangle' | 'circle';
  /** Only determines whether a redundant unit legend is hidden. Never converts a posted limit. */
  speedUnit: 'MPH' | 'KM/H';
  showSpeedUnit: boolean;
  stopLabel: string;
  yieldLabel: string;
  allWayLabel: string;
  exitLabel: string;
  /** Conservative regional default; an explicit surface option can override it. */
  inferStopSigns: boolean;
  /** Optional host font role or face id; falls back to the library's highway role. */
  font?: string;
  /** Street-name signs at junctions; a region without this style gets none. */
  streetNames?: TerrainStreetNameStyle;
  notes: string;
  sources: string[];
}

const hex = z.string().regex(/^#[\da-f]{6}$/i);
const abbreviations = z.record(z.string().regex(/^\S+$/), z.string().regex(/^\S+$/));
const streetNameStyleSchema: z.ZodType<TerrainStreetNameStyle> = z.strictObject({
  panelColor: hex,
  inkColor: hex,
  borderColor: hex.optional(),
  mount: z.enum(['post', 'wall']).optional(),
  panel: z.enum(['blade', 'plate']).optional(),
  mastArms: z.boolean().optional(),
  letterCase: z.enum(['mapped', 'upper']).optional(),
  directions: abbreviations.optional(),
  types: abbreviations.optional(),
  words: abbreviations.optional(),
});
export const terrainRoadSignProfileSchema: z.ZodType<TerrainRoadSignProfile> = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)),
  subdivisions: z.array(z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/)).optional(),
  stateNetwork: z.string().min(1).optional(),
  motorwayColor: hex,
  exitColor: hex,
  attractionColor: hex,
  drivingSide: z.enum(['left', 'right']),
  speedSign: z.enum(['rectangle', 'circle']),
  speedUnit: z.enum(['MPH', 'KM/H']),
  showSpeedUnit: z.boolean(),
  stopLabel: z.string(),
  yieldLabel: z.string(),
  allWayLabel: z.string(),
  exitLabel: z.string(),
  inferStopSigns: z.boolean(),
  font: z.string().min(1).optional(),
  streetNames: streetNameStyleSchema.optional(),
  notes: z.string(),
  sources: z.array(z.string().url()),
});

/** Backward-compatible default for non-geographic hosts. Earth supplies content profiles. */
export const DEFAULT_ROAD_SIGN_PROFILE: Readonly<TerrainRoadSignProfile> = {
  id: 'us',
  title: 'United States',
  countries: ['US'],
  motorwayColor: '#236346',
  exitColor: '#236346',
  attractionColor: '#765034',
  drivingSide: 'right',
  speedSign: 'rectangle',
  speedUnit: 'MPH',
  showSpeedUnit: true,
  stopLabel: 'STOP',
  yieldLabel: 'YIELD',
  allWayLabel: 'ALL WAY',
  exitLabel: 'EXIT',
  inferStopSigns: true,
  notes: 'Legacy American-style surface default.',
  sources: [],
};

export interface TerrainRoadSignCatalog {
  format: 'molen/road-sign-catalog@1';
  fallback: string;
  profiles: TerrainRoadSignProfile[];
}

/** Additional jurisdiction profiles supplied by content packs. */
export const terrainRoadSignProfilesSchema: z.ZodType<{
  format: 'molen/road-sign-profiles@1';
  profiles: TerrainRoadSignProfile[];
}> = z.strictObject({
  format: z.literal('molen/road-sign-profiles@1'),
  profiles: z.array(terrainRoadSignProfileSchema),
});

export const terrainRoadSignCatalogSchema: z.ZodType<TerrainRoadSignCatalog> = z
  .strictObject({
    format: z.literal('molen/road-sign-catalog@1'),
    fallback: z.string().min(1),
    profiles: z.array(terrainRoadSignProfileSchema).min(1),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>(),
      countries = new Set<string>(),
      subdivisions = new Set<string>();
    for (const profile of doc.profiles) {
      if (ids.has(profile.id))
        ctx.addIssue({ code: 'custom', message: `Duplicate sign profile ${profile.id}` });
      ids.add(profile.id);
      for (const code of profile.subdivisions ?? []) {
        if (subdivisions.has(code))
          ctx.addIssue({ code: 'custom', message: `Duplicate sign subdivision ${code}` });
        subdivisions.add(code);
      }
      for (const country of profile.countries) {
        if (countries.has(country))
          ctx.addIssue({ code: 'custom', message: `Duplicate sign country ${country}` });
        countries.add(country);
      }
    }
    if (!ids.has(doc.fallback))
      ctx.addIssue({ code: 'custom', message: 'Unknown road-sign fallback profile' });
  });

/**
 * The legend a street-name sign posts for a mapped name. Only presentation changes: a direction
 * or type that is the whole name ("North Street", "Avenue A") keeps its spelling.
 */
export function streetSignName(style: Readonly<TerrainStreetNameStyle>, name: string): string {
  const posted = abbreviateStreetName(style, name);
  // Locale-free capitals: the same legend on every host ("Straße" becomes "STRASSE").
  return style.letterCase === 'upper' ? posted.toUpperCase() : posted;
}

function abbreviateStreetName(style: Readonly<TerrainStreetNameStyle>, name: string): string {
  const words = name.trim().split(/\s+/);
  const directions = style.directions ?? {};
  const types = style.types ?? {};
  const others = style.words ?? {};
  const own = (table: Record<string, string>, word: string): string | undefined =>
    Object.hasOwn(table, word) ? table[word] : undefined;
  const last = words.length - 1;
  const trailing = last > 0 && own(directions, words[last] as string) !== undefined;
  const typeAt = trailing ? last - 1 : last;
  const typed = typeAt > 0 && own(types, words[typeAt] as string) !== undefined;
  // The name proper: what lies between a leading direction and the type or trailing direction.
  const end = typed ? typeAt : trailing ? last : words.length;
  const leading = end > 1 && own(directions, words[0] as string) !== undefined;
  return words
    .map((word, i) => {
      if ((i === 0 && leading) || (i === last && trailing)) return own(directions, word) as string;
      if (i === typeAt && typed) return own(types, word) as string;
      return (i < last && own(others, word)) || word;
    })
    .join(' ');
}

/** An exit prefix is presentation; the source exit reference remains unchanged. */
export function roadSignExitLabel(profile: Readonly<TerrainRoadSignProfile>, ref?: string): string {
  return [profile.exitLabel, ref].filter(Boolean).join(' ');
}
