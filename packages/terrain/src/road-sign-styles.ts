import { z } from 'zod';

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
  notes: string;
  sources: string[];
}

const hex = z.string().regex(/^#[\da-f]{6}$/i);
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

/** An exit prefix is presentation; the source exit reference remains unchanged. */
export function roadSignExitLabel(profile: Readonly<TerrainRoadSignProfile>, ref?: string): string {
  return [profile.exitLabel, ref].filter(Boolean).join(' ');
}
