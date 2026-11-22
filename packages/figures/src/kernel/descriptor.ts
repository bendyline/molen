/**
 * The figure descriptor: Zod shapes shared by the `figure` component and the molen/figure@1
 * file format, resolution over the preset table, and the stable key that names one body.
 */

import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { JsonObject, JsonValue } from '@bendyline/molen-schema';
import { z } from 'zod';
import { resolveFigureHead } from './head-presets';
import { FIGURE_PRESETS } from './presets';
import {
  FIGURE_BACKWEAR_STYLES,
  FIGURE_BAG_STYLES,
  FIGURE_EARWEAR_STYLES,
  FIGURE_EYEWEAR_STYLES,
  FIGURE_FOOTWEAR_STYLES,
  FIGURE_HAIR_STYLES,
  FIGURE_HAIR_TEXTURES,
  FIGURE_HEAD_PRESET_IDS,
  FIGURE_HEADWEAR_STYLES,
  FIGURE_LEGWEAR_STYLES,
  FIGURE_NECKWEAR_STYLES,
  FIGURE_PRESET_IDS,
  FIGURE_TOP_STYLES,
  FIGURE_WRISTWEAR_STYLES,
  type FigureDescriptor,
  type FigureFeatures,
  type FigureHeadInput,
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
    waist: z
      .number()
      .min(0.7)
      .max(1.3)
      .describe('Human waist width multiplier (absent = the body form’s).')
      .optional(),
    bust: z
      .number()
      .min(0)
      .max(1.5)
      .describe('Human bust or pectoral swell (absent = the body form’s: 1 feminine, 0.25 else).')
      .optional(),
    belly: z.number().min(0).max(1).describe('Human belly fullness (absent = 0).').optional(),
    seat: z
      .number()
      .min(0.8)
      .max(1.3)
      .describe('Human hip, seat and thigh fullness multiplier (absent = 1).')
      .optional(),
  })
  .describe('Proportion multipliers over the preset.');

const headParam = z.number().min(-1).max(1);
const headSchema = z
  .strictObject({
    preset: z
      .enum(FIGURE_HEAD_PRESET_IDS)
      .describe("Head preset '01'..'12' ('01' is the reference head).")
      .optional(),
    faceWidth: headParam.describe('Narrow (-1) to wide (1).').optional(),
    jaw: headParam.describe('Tapered (-1) to square (1).').optional(),
    chin: headParam.describe('Soft (-1) to prominent (1).').optional(),
    cheeks: headParam.describe('Lean (-1) to full (1).').optional(),
    cheekbones: headParam.describe('Flat (-1) to high and wide (1).').optional(),
    brow: headParam.describe('Smooth (-1) to a strong ridge (1).').optional(),
    noseBridge: headParam.describe('Low (-1) to high (1).').optional(),
    noseWidth: headParam.describe('Narrow (-1) to broad (1).').optional(),
    noseTip: headParam.describe('Small (-1) to full (1).').optional(),
    eyeSpacing: headParam.describe('Close (-1) to wide (1).').optional(),
    eyeSize: headParam.describe('Small (-1) to large (1).').optional(),
    eyeTilt: headParam.describe('Outer corners down (-1) to up (1).').optional(),
    lips: headParam.describe('Thin (-1) to full (1).').optional(),
    crown: headParam.describe('Flat (-1) to rounded (1) skull top.').optional(),
  })
  .describe(
    'Human head shape: a preset and/or parameters, each -1..1 with 0 the reference head. Absent, the face follows the body form.',
  );

const featuresSchema = z
  .strictObject({
    form: z
      .enum(['neutral', 'masculine', 'feminine'])
      .describe('Human body form: shoulder, waist, hip and chest shape (bipeds).')
      .optional(),
    hair: z
      .enum(FIGURE_HAIR_STYLES)
      .describe(
        'Hair style: none, buzz, balding, cap (short), crop, bob, long, ponytail, bun, afro, shoulder, fade, mohawk, topknot, puffs, braids, rows, locs.',
      )
      .optional(),
    hairTexture: z
      .enum(FIGURE_HAIR_TEXTURES)
      .describe('How hair lies: straight (default), wavy, curly or coily (volume and ripple).')
      .optional(),
    facialHair: z
      .enum(['none', 'stubble', 'mustache', 'beard'])
      .describe('Facial hair (humans), drawn in the hair color.')
      .optional(),
    hands: z
      .enum(['mitten', 'fingers'])
      .describe('Hand geometry (fingers: near tier only).')
      .optional(),
    sleeves: z
      .enum(['none', 'short', 'long'])
      .describe('Sleeve length (top color extent).')
      .optional(),
    legs: z
      .enum(FIGURE_LEGWEAR_STYLES)
      .describe(
        'Legwear (bottom color): shorts, long trousers, a knee-length skirt, slim or wide trousers, or cropped trousers.',
      )
      .optional(),
    top: z
      .enum(FIGURE_TOP_STYLES)
      .describe(
        'Top: shirt (default), tee, tank, polo, sweater, hoodie, jacket or coat (an open outer layer in palette.outer), or dress (to the knee in palette.top).',
      )
      .optional(),
    footwear: z
      .enum(FIGURE_FOOTWEAR_STYLES)
      .describe('Footwear: shoe (default), sneaker, boot or sandal (palette.shoes).')
      .optional(),
    headwear: z
      .enum(FIGURE_HEADWEAR_STYLES)
      .describe('Hat (humans): cap, beanie or sunhat, over tucked-in hair (palette.headwear).')
      .optional(),
    eyewear: z
      .enum(FIGURE_EYEWEAR_STYLES)
      .describe('Glasses or sunglasses (humans; palette.eyewear frames).')
      .optional(),
    neckwear: z.enum(FIGURE_NECKWEAR_STYLES).describe('A scarf (palette.neckwear).').optional(),
    backwear: z.enum(FIGURE_BACKWEAR_STYLES).describe('A backpack (palette.backwear).').optional(),
    earwear: z
      .enum(FIGURE_EARWEAR_STYLES)
      .describe('Headphones over the hair and any hat (palette.earwear).')
      .optional(),
    wristwear: z
      .enum(FIGURE_WRISTWEAR_STYLES)
      .describe('A watch on the left wrist (palette.wristwear strap).')
      .optional(),
    bag: z
      .enum(FIGURE_BAG_STYLES)
      .describe('A crossbody bag at the right hip, its strap over the left shoulder (palette.bag).')
      .optional(),
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
    outer: colorHex.describe('Outer layer of a jacket or coat (absent: the top color).').optional(),
    headwear: colorHex.describe('Hat.').optional(),
    eyewear: colorHex.describe('Glasses frames.').optional(),
    neckwear: colorHex.describe('Scarf.').optional(),
    backwear: colorHex.describe('Backpack.').optional(),
    earwear: colorHex.describe('Headphones.').optional(),
    wristwear: colorHex.describe('Watch strap.').optional(),
    bag: colorHex.describe('Bag and its strap.').optional(),
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
  head: z.ZodType<FigureHeadInput | undefined>;
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
  head: headSchema.optional() as unknown as z.ZodType<FigureHeadInput | undefined>,
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
    // Only an authored head enters the resolved descriptor, so bodies (and their keys) written
    // before heads existed are unchanged.
    ...(descriptor.head !== undefined && preset.archetype === 'biped'
      ? { head: resolveFigureHead(descriptor.head) }
      : {}),
  };
}

/** Stable content key of a resolved descriptor (same body ⇔ same key, in any process). */
export function descriptorKey(resolved: ResolvedFigureDescriptor): string {
  return hashJson(resolved);
}
