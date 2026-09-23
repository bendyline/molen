/**
 * Plain-data contracts of the figures capability: the authored descriptor (what a figure IS),
 * its resolved form (preset defaults filled in), and the vocabulary both halves share. Pure
 * types and constants; no imports beyond the JSON contract.
 */

import type { JsonObject } from '@bendyline/molen-schema';

export type FigureArchetype = 'biped' | 'quadruped';

export type FigureMode = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'sit' | 'custom';
export type FigureGait = 'walk' | 'trot' | 'gallop';
export type FigureIkEffector = 'hand.l' | 'hand.r' | 'foot.l' | 'foot.r';
export type FigureAnchor = 'origin' | 'pelvis' | 'eye';

/** Shipped presets; `molen figure presets` lists them with their descriptors. */
export const FIGURE_PRESET_IDS: readonly [
  'human.adult',
  'human.child',
  'human.elder',
  'dog',
  'cat',
  'horse',
  'deer',
  'cow',
  'sheep',
] = ['human.adult', 'human.child', 'human.elder', 'dog', 'cat', 'horse', 'deer', 'cow', 'sheep'];

export type FigurePresetId = (typeof FIGURE_PRESET_IDS)[number];

export type FigureSpecies = 'human' | 'dog' | 'cat' | 'horse' | 'deer' | 'cow' | 'sheep';

export type FigureAge = 'child' | 'adult' | 'elder';

export type FigureHairStyle = 'none' | 'cap' | 'bob' | 'long';
export type FigureHandStyle = 'mitten' | 'fingers';
export type FigureSleeveStyle = 'none' | 'short' | 'long';
export type FigureLegwearStyle = 'shorts' | 'long';
export type FigureTailStyle = 'none' | 'short' | 'long' | 'bushy';
export type FigureEarStyle = 'none' | 'round' | 'pointed' | 'floppy';
export type FigureHornStyle = 'none' | 'short' | 'long' | 'antlers';
export type FigureFootStyle = 'plantigrade' | 'digitigrade' | 'unguligrade';

/** Proportion multipliers applied to the archetype's canonical segment table (1 = preset). */
export interface FigureProportions extends JsonObject {
  legRatio: number;
  armRatio: number;
  torsoRatio: number;
  headScale: number;
  neckLength: number;
  /** Neck pitch above the spine line, radians (quadrupeds; 0 for bipeds). */
  neckPitch: number;
  shoulderWidth: number;
  hipWidth: number;
  /** Quadruped body length as a multiple of `height` (withers). */
  bodyLength: number;
  /** Tail length as a multiple of `height`. */
  tailLength: number;
  earSize: number;
  /** Snout length as a multiple of the head unit (0 = flat face). */
  snoutLength: number;
}

export interface FigureFeatures extends JsonObject {
  hair: FigureHairStyle;
  hands: FigureHandStyle;
  sleeves: FigureSleeveStyle;
  legs: FigureLegwearStyle;
  tail: FigureTailStyle;
  ears: FigureEarStyle;
  horns: FigureHornStyle;
  feet: FigureFootStyle;
  mane: boolean;
}

/** Colors as "#rrggbb" (sRGB). Skin doubles as fur/hide for animals; markings are secondary. */
export interface FigurePalette extends JsonObject {
  skin: string;
  hair: string;
  eyes: string;
  top: string;
  bottom: string;
  shoes: string;
  accent: string;
  markings: string;
}

/** A descriptor with every preset default filled in: the input of the rig and body generators. */
export interface ResolvedFigureDescriptor extends JsonObject {
  preset: FigurePresetId;
  archetype: FigureArchetype;
  species: FigureSpecies;
  /** Standing height (bipeds: head top; quadrupeds: withers), meters. */
  height: number;
  /** -1 (slight) … 1 (heavy): limb and torso radii, shoulder width. */
  build: number;
  age: FigureAge;
  proportions: FigureProportions;
  features: FigureFeatures;
  palette: FigurePalette;
  /** Symmetry-safe detail jitter only; '' = none. */
  seed: string;
}

/** The authored descriptor: a preset plus overrides (the `figure` component and molen/figure@1). */
export interface FigureDescriptor extends JsonObject {
  preset: FigurePresetId;
  height?: number;
  build?: number;
  age?: FigureAge;
  proportions?: Partial<FigureProportions>;
  features?: Partial<FigureFeatures>;
  palette?: Partial<FigurePalette>;
  seed?: string;
}
