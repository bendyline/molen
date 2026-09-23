/**
 * The figure descriptor: Zod shapes shared by the `figure` component and the molen/figure@1
 * file format, resolution over the preset table, and the stable key that names one body.
 */

import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonObject, JsonValue } from '@bendyline/molen-schema';
import { z } from 'zod';
import { FIGURE_PRESETS } from './presets';
import {
  FIGURE_PRESET_IDS,
  type FigureDescriptor,
  type FigureFeatures,
  type FigurePalette,
  type FigureProportions,
  type ResolvedFigureDescriptor,
} from './types';

const colorHex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: 'must be "#rrggbb"' })
  .describe('Color as "#rrggbb".');
const ratio = z.number().min(0.5).max(1.6);

const proportionsSchema = z
  .strictObject({
    legRatio: ratio.describe('Leg length multiplier (1 = preset).').optional(),
    armRatio: ratio.describe('Arm length multiplier (1 = preset).').optional(),
    torsoRatio: ratio.describe('Torso length multiplier (1 = preset).').optional(),
    headScale: z.number().min(0.6).max(2).describe('Head size multiplier (1 = preset).').optional(),
    neckLength: ratio.describe('Neck length multiplier (1 = preset).').optional(),
    neckPitch: z
      .number()
      .min(-1.2)
      .max(1.6)
      .describe('Quadruped neck pitch above the spine line, radians.')
      .optional(),
    shoulderWidth: ratio.describe('Shoulder width multiplier (1 = preset).').optional(),
    hipWidth: ratio.describe('Hip width multiplier (1 = preset).').optional(),
    bodyLength: z
      .number()
      .min(0.8)
      .max(2.5)
      .describe('Quadruped body length as a multiple of height (withers).')
      .optional(),
    tailLength: z
      .number()
      .min(0)
      .max(2)
      .describe('Tail length as a multiple of height.')
      .optional(),
    earSize: z.number().min(0).max(2).describe('Ear size multiplier (1 = preset).').optional(),
    snoutLength: z
      .number()
      .min(0)
      .max(1.5)
      .describe('Snout length as a multiple of the head unit (0 = flat face).')
      .optional(),
  })
  .describe('Proportion multipliers over the preset.');

const featuresSchema = z
  .strictObject({
    hair: z.enum(['none', 'cap', 'bob', 'long']).describe('Hair shell style.').optional(),
    hands: z
      .enum(['mitten', 'fingers'])
      .describe('Hand geometry (fingers: near tier only).')
      .optional(),
    sleeves: z
      .enum(['none', 'short', 'long'])
      .describe('Sleeve length (top color extent).')
      .optional(),
    legs: z.enum(['shorts', 'long']).describe('Legwear length (bottom color extent).').optional(),
    tail: z.enum(['none', 'short', 'long', 'bushy']).describe('Tail style.').optional(),
    ears: z.enum(['none', 'round', 'pointed', 'floppy']).describe('Ear style.').optional(),
    horns: z.enum(['none', 'short', 'long', 'antlers']).describe('Horn style.').optional(),
    feet: z
      .enum(['plantigrade', 'digitigrade', 'unguligrade'])
      .describe('Foot stance: flat feet, paws, or hooves.')
      .optional(),
    mane: z.boolean().describe('Neck mane (horses).').optional(),
  })
  .describe('Discrete feature choices over the preset.');

const paletteSchema = z
  .strictObject({
    skin: colorHex.describe('Skin, fur, or hide color.').optional(),
    hair: colorHex.describe('Hair or mane color.').optional(),
    eyes: colorHex.optional(),
    top: colorHex.describe('Torso and sleeves.').optional(),
    bottom: colorHex.describe('Legwear.').optional(),
    shoes: colorHex.describe('Shoes, paws, or hooves.').optional(),
    accent: colorHex.describe('Belt, collar, or saddle strip.').optional(),
    markings: colorHex.describe('Secondary fur markings (animals).').optional(),
  })
  .describe('Color blocks over the preset ("#rrggbb").');

/** The descriptor fields (no envelope): shared by the component and the file format. */
export const figureDescriptorFields: {
  preset: z.ZodType<FigureDescriptor['preset']>;
  height: z.ZodType<number | undefined>;
  build: z.ZodType<number | undefined>;
  age: z.ZodType<FigureDescriptor['age']>;
  proportions: z.ZodType<Partial<FigureProportions> | undefined>;
  features: z.ZodType<Partial<FigureFeatures> | undefined>;
  palette: z.ZodType<Partial<FigurePalette> | undefined>;
  seed: z.ZodType<string | undefined>;
} = {
  preset: z
    .enum(FIGURE_PRESET_IDS)
    .describe("Preset the descriptor starts from, e.g. 'human.adult' or 'horse'."),
  height: z
    .number()
    .min(0.2)
    .max(4)
    .describe('Standing height in meters (bipeds: head top; quadrupeds: withers).')
    .optional(),
  build: z
    .number()
    .min(-1)
    .max(1)
    .describe('Body mass from -1 (slight) to 1 (heavy): limb and torso radii, shoulder width.')
    .optional(),
  age: z.enum(['child', 'adult', 'elder']).describe('Age band (head and limb ratios).').optional(),
  proportions: proportionsSchema.optional(),
  features: featuresSchema.optional(),
  palette: paletteSchema.optional(),
  seed: z
    .string()
    .min(1)
    .describe('Detail jitter seed (symmetry-safe details only; default none).')
    .optional(),
};

export const figureDescriptorSchema: z.ZodType<FigureDescriptor> = z
  .strictObject(figureDescriptorFields)
  .describe(
    'A figure descriptor: a preset plus overrides.',
  ) as unknown as z.ZodType<FigureDescriptor>;

function definedEntries<T extends JsonObject>(patch: Partial<T> | undefined): Partial<T> {
  const out: Partial<T> = {};
  if (patch === undefined) return out;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) (out as JsonObject)[key] = value as JsonValue;
  }
  return out;
}

/** Fill a descriptor from its preset; throws on an unknown preset. Extra keys are ignored. */
export function resolveFigureDescriptor(descriptor: FigureDescriptor): ResolvedFigureDescriptor {
  const preset = FIGURE_PRESETS[descriptor.preset];
  if (preset === undefined) throw new Error(`unknown figure preset "${descriptor.preset}"`);
  return {
    preset: descriptor.preset,
    archetype: preset.archetype,
    species: preset.species,
    height: descriptor.height ?? preset.height,
    build: descriptor.build ?? preset.build,
    age: descriptor.age ?? preset.age,
    proportions: { ...preset.proportions, ...definedEntries(descriptor.proportions) },
    features: { ...preset.features, ...definedEntries(descriptor.features) },
    palette: { ...preset.palette, ...definedEntries(descriptor.palette) },
    seed: descriptor.seed ?? '',
  };
}

/** Stable content key of a resolved descriptor (same body ⇔ same key, in any process). */
export function descriptorKey(resolved: ResolvedFigureDescriptor): string {
  return hashJson(resolved);
}
