/** Data-only animal silhouettes and habitat populations. Content owns species and range facts. */
import { z } from 'zod';

export const WILDLIFE_FAMILIES = [
  'ungulate',
  'canid',
  'feline',
  'rodent',
  'lagomorph',
  'hopper',
  'elephant',
  'bird',
  'reptile',
  'fish',
  'insect',
] as const;
export type WildlifeFamily = (typeof WILDLIFE_FAMILIES)[number];
export type WildlifeMotion = 'walk' | 'hop' | 'fly' | 'swim' | 'crawl';

export interface WildlifeSpecies {
  id: string;
  version: number;
  title: string;
  /** Omitted for functional habitat groups that make no precise species claim. */
  taxon?: string;
  /** Identifier in an attributed range document. Named taxa require a range at the Earth binding. */
  range?: string;
  /** Coarse seasonal appearance/activity; not a weather or migration model. */
  winterColor?: string;
  inactiveInWinter?: boolean;
  body: {
    family: WildlifeFamily;
    /** Meters: standing height, nose-to-rump length, torso width. Wings and tails may extend them. */
    height: number;
    length: number;
    width: number;
    color: string;
    accent: string;
    details: Array<
      | 'antlers'
      | 'horns'
      | 'long-neck'
      | 'bushy-tail'
      | 'stripes'
      | 'spots'
      | 'wader'
      | 'waterfowl'
      | 'raptor'
      | 'parrot'
      | 'long-tail'
    >;
  };
  motion: WildlifeMotion;
  /** Meters per second. This is ambient travel, not maximum running speed. */
  speed: number;
  /** Maximum travel from the stable spawn anchor in meters. */
  roam: number;
  /** Height above ground/water for flight; depth below the surface for swimming. */
  clearance: number;
  /** Probability of resting at a target. Flying/swimming animals keep moving. */
  rest: number;
  /** Body-size clearance from obstacles, meters. */
  margin: number;
}

/** Already selected by the host's regional/range resolver. Density is a visual population prior. */
export interface WildlifeChoice {
  species: WildlifeSpecies;
  density: number;
  habitats: readonly string[];
}

export interface WildlifeHabitat {
  /** Actual mapped surface, not potential vegetation from a biome map. */
  kind: string;
  height: number;
  water: boolean;
  /** False on roads, buildings, steep terrain, or insufficiently known terrain. */
  safe: boolean;
}

const id = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const wildlifeSpeciesSchema: z.ZodType<WildlifeSpecies> = z
  .strictObject({
    id,
    version: z.int().positive(),
    title: z.string().min(1),
    taxon: z.string().min(1).optional(),
    range: z.string().min(1).optional(),
    winterColor: color.optional(),
    inactiveInWinter: z.boolean().optional(),
    body: z.strictObject({
      family: z.enum(WILDLIFE_FAMILIES),
      height: z.number().min(0.01).max(7),
      length: z.number().min(0.01).max(12),
      width: z.number().min(0.005).max(5),
      color,
      accent: color,
      details: z.array(
        z.enum([
          'antlers',
          'horns',
          'long-neck',
          'bushy-tail',
          'stripes',
          'spots',
          'wader',
          'waterfowl',
          'raptor',
          'parrot',
          'long-tail',
        ]),
      ),
    }),
    motion: z.enum(['walk', 'hop', 'fly', 'swim', 'crawl']),
    speed: z.number().min(0.01).max(30),
    roam: z.number().min(1).max(200),
    clearance: z.number().min(0).max(80),
    rest: z.number().min(0).max(1),
    margin: z.number().min(0.02).max(8),
  })
  .refine((species) => (species.taxon === undefined) === (species.range === undefined), {
    message:
      'Named wildlife taxa require an attributed range; unnamed functional groups omit both.',
  });
