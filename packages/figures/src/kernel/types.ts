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

/**
 * Hair styles. `cap` is the short default; `balding` keeps a side-and-back fringe. The later
 * styles: `shoulder` (to the shoulders), `fade` (short sides blending into skin, fuller top),
 * `mohawk` (a crest, shaved sides), `topknot` (gathered on the crown), `puffs` (two rounded
 * puffs), `braids` (two braids behind the shoulders), `rows` (close braided rows) and `locs`
 * (rope-like locks to the shoulders). New styles are appended, never inserted.
 */
export const FIGURE_HAIR_STYLES: readonly [
  'none',
  'buzz',
  'balding',
  'cap',
  'crop',
  'bob',
  'long',
  'ponytail',
  'bun',
  'afro',
  'shoulder',
  'fade',
  'mohawk',
  'topknot',
  'puffs',
  'braids',
  'rows',
  'locs',
] = [
  'none',
  'buzz',
  'balding',
  'cap',
  'crop',
  'bob',
  'long',
  'ponytail',
  'bun',
  'afro',
  'shoulder',
  'fade',
  'mohawk',
  'topknot',
  'puffs',
  'braids',
  'rows',
  'locs',
];
export type FigureHairStyle = (typeof FIGURE_HAIR_STYLES)[number];

/** How hair lies: added volume and a ripple in the silhouette (absent = today's `straight`). */
export const FIGURE_HAIR_TEXTURES: readonly ['straight', 'wavy', 'curly', 'coily'] = [
  'straight',
  'wavy',
  'curly',
  'coily',
];
export type FigureHairTexture = (typeof FIGURE_HAIR_TEXTURES)[number];

/** Head preset ids (neutral numbers, never names of people or groups). */
export const FIGURE_HEAD_PRESET_IDS: readonly [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
export type FigureHeadPresetId = (typeof FIGURE_HEAD_PRESET_IDS)[number];

/**
 * A human head's shape. Every value runs -1..1 and 0 is the generator's reference head:
 * `faceWidth` (narrow ↔ wide), `jaw` (tapered ↔ square), `chin` (soft ↔ prominent), `cheeks`
 * (lean ↔ full), `cheekbones` (flat ↔ high and wide), `brow` (smooth ↔ strong ridge),
 * `noseBridge` (low ↔ high), `noseWidth` (narrow ↔ broad), `noseTip` (small ↔ full), `eyeSpacing`
 * (close ↔ wide), `eyeSize` (small ↔ large), `eyeTilt` (down ↔ up at the outer corner), `lips`
 * (thin ↔ full), `crown` (flat ↔ rounded skull top).
 */
export interface FigureHeadShape extends JsonObject {
  faceWidth: number;
  jaw: number;
  chin: number;
  cheeks: number;
  cheekbones: number;
  brow: number;
  noseBridge: number;
  noseWidth: number;
  noseTip: number;
  eyeSpacing: number;
  eyeSize: number;
  eyeTilt: number;
  lips: number;
  crown: number;
}

/** An authored head: an optional preset, then any parameters over it. */
export interface FigureHeadInput extends Partial<FigureHeadShape> {
  preset?: FigureHeadPresetId;
}
export type FigureFacialHair = 'none' | 'stubble' | 'mustache' | 'beard';
/** Human body form: shoulder, waist, hip and chest shape (bipeds; ignored by quadrupeds). */
export type FigureForm = 'neutral' | 'masculine' | 'feminine';
export type FigureHandStyle = 'mitten' | 'fingers';
export type FigureSleeveStyle = 'none' | 'short' | 'long';
/**
 * Legwear: shorts, long trousers, a knee-length skirt (bare legs under it), and later `slim`
 * (tapered below the knee), `wide` (flared below the knee) and `cropped` (ending mid-calf).
 */
export const FIGURE_LEGWEAR_STYLES: readonly [
  'shorts',
  'long',
  'skirt',
  'slim',
  'wide',
  'cropped',
] = ['shorts', 'long', 'skirt', 'slim', 'wide', 'cropped'];
export type FigureLegwearStyle = (typeof FIGURE_LEGWEAR_STYLES)[number];

/**
 * Tops (absent = `shirt`, the button shirt): `tee` and `tank` (crew or scoop neck, no
 * buttons), `polo` (collar, short placket), `sweater` and `hoodie` (a ribbed hem over the belt;
 * a hood and front pocket), `jacket` and `coat` (an open outer layer in `palette.outer` over
 * the shirt, to the hip or mid-thigh) and `dress` (one garment to the knee in `palette.top`,
 * over bare legs). Sleeve length stays `sleeves`.
 */
export const FIGURE_TOP_STYLES: readonly [
  'shirt',
  'tee',
  'tank',
  'polo',
  'sweater',
  'hoodie',
  'jacket',
  'coat',
  'dress',
] = ['shirt', 'tee', 'tank', 'polo', 'sweater', 'hoodie', 'jacket', 'coat', 'dress'];
export type FigureTopStyle = (typeof FIGURE_TOP_STYLES)[number];

/**
 * Footwear (absent = `shoe`): `sneaker` (a thick pale sole), `boot` (a shaft up the ankle),
 * `sandal` (a sole and straps over the bare foot).
 */
export const FIGURE_FOOTWEAR_STYLES: readonly ['shoe', 'sneaker', 'boot', 'sandal'] = [
  'shoe',
  'sneaker',
  'boot',
  'sandal',
];
export type FigureFootwearStyle = (typeof FIGURE_FOOTWEAR_STYLES)[number];

/**
 * Accessories, each worn in its own place and absent unless named. A hat tucks the hair under
 * its band (a topknot or puffs hide under it, a bun sits low); headphones clear the hair and any
 * hat; a backpack pushes long hair and braids out over it.
 */
export const FIGURE_HEADWEAR_STYLES: readonly ['cap', 'beanie', 'sunhat'] = [
  'cap',
  'beanie',
  'sunhat',
];
export type FigureHeadwearStyle = (typeof FIGURE_HEADWEAR_STYLES)[number];
export const FIGURE_EYEWEAR_STYLES: readonly ['glasses', 'sunglasses'] = ['glasses', 'sunglasses'];
export type FigureEyewearStyle = (typeof FIGURE_EYEWEAR_STYLES)[number];
export const FIGURE_NECKWEAR_STYLES: readonly ['scarf'] = ['scarf'];
export type FigureNeckwearStyle = (typeof FIGURE_NECKWEAR_STYLES)[number];
export const FIGURE_BACKWEAR_STYLES: readonly ['backpack'] = ['backpack'];
export type FigureBackwearStyle = (typeof FIGURE_BACKWEAR_STYLES)[number];
export const FIGURE_EARWEAR_STYLES: readonly ['headphones'] = ['headphones'];
export type FigureEarwearStyle = (typeof FIGURE_EARWEAR_STYLES)[number];
export const FIGURE_WRISTWEAR_STYLES: readonly ['watch'] = ['watch'];
export type FigureWristwearStyle = (typeof FIGURE_WRISTWEAR_STYLES)[number];
export const FIGURE_BAG_STYLES: readonly ['crossbody'] = ['crossbody'];
export type FigureBagStyle = (typeof FIGURE_BAG_STYLES)[number];
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
  /** Human waist width multiplier (absent = the body form's). */
  waist?: number;
  /** Human bust or pectoral swell, 0 (none) to 1.5 (absent = the body form's: 1 or 0.25). */
  bust?: number;
  /** Human belly fullness, 0 (none) to 1 (absent = none). */
  belly?: number;
  /** Human hip and thigh fullness multiplier, seat included (absent = 1). */
  seat?: number;
}

export interface FigureFeatures extends JsonObject {
  form: FigureForm;
  hair: FigureHairStyle;
  /** Absent = straight (the generator's reference hair). */
  hairTexture?: FigureHairTexture;
  facialHair: FigureFacialHair;
  hands: FigureHandStyle;
  sleeves: FigureSleeveStyle;
  legs: FigureLegwearStyle;
  /** Absent = shirt (the reference top). */
  top?: FigureTopStyle;
  /** Absent = shoe (the reference footwear). */
  footwear?: FigureFootwearStyle;
  /** Accessories (humans; absent = none). Each takes its color from the palette key of its name. */
  headwear?: FigureHeadwearStyle;
  eyewear?: FigureEyewearStyle;
  neckwear?: FigureNeckwearStyle;
  backwear?: FigureBackwearStyle;
  earwear?: FigureEarwearStyle;
  wristwear?: FigureWristwearStyle;
  bag?: FigureBagStyle;
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
  /** Outer layer of a jacket or coat (absent: the top color). */
  outer?: string;
  /** Accessory colors (absent: a default for each; see the figures guide). */
  headwear?: string;
  eyewear?: string;
  neckwear?: string;
  backwear?: string;
  earwear?: string;
  wristwear?: string;
  bag?: string;
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
  /** Human head shape, present only when the descriptor authored one (else the reference head). */
  head?: FigureHeadShape;
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
  /** Human head shape: a preset and/or parameters (absent = the reference head). */
  head?: FigureHeadInput;
}
