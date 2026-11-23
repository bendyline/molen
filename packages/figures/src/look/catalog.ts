/**
 * The default people catalogue: every option a look can name today, built only from figure
 * features the body generator already draws, plus the checks any catalogue must pass.
 *
 * Neutrality rules (enforced by `validateFigureLookCatalog`): skin, head, hair style, hair
 * texture, hair colour and eye colour are never steered, so a random look draws each of them
 * uniformly (by weight) and independently of every other choice and of the steer. Steering only
 * weights body shape, facial hair and clothing, and never removes an option. Skin tones are one
 * ungrouped ramp evenly spaced in lightness; labels describe shape and colour, never people.
 *
 * Ids are stable: an id once published is never reused for something else. Retire one by adding
 * it to `aliases` (old id → replacement) and raising `revision`.
 */

import { FIGURE_HEAD_PRESET_IDS, type FigureAge } from '../kernel/types';
import {
  FIGURE_LOOK_GARMENTS,
  FIGURE_LOOK_PERSON_CHOICES,
  FIGURE_LOOK_SLOTS,
  type FigureLookCatalog,
  type FigureLookCategory,
  type FigureLookCategoryId,
  type FigureLookColorSlot,
  type FigureLookPaletteId,
  type FigureLookSwatch,
} from './types';

const HEX = /^#[0-9a-f]{6}$/;

/** Skin: ten tones from light to deep, evenly spaced in OKLab lightness (0.91 → 0.29). */
const SKIN: FigureLookSwatch[] = [
  '#f6dcc8',
  '#e5c3ab',
  '#d5ab8e',
  '#c49372',
  '#b37b56',
  '#9d6742',
  '#835538',
  '#69442d',
  '#513423',
  '#3a2419',
].map((hex, i) => ({ hex, label: `Tone ${i + 1} of 10` }));

const HAIR: FigureLookSwatch[] = [
  { hex: '#1c1714', label: 'Black', weight: 2 },
  { hex: '#3a281d', label: 'Dark brown', weight: 2 },
  { hex: '#5e4129', label: 'Brown', weight: 1.5 },
  { hex: '#94703f', label: 'Light brown', weight: 1 },
  { hex: '#8a3d22', label: 'Auburn', weight: 0.6 },
  { hex: '#a5502a', label: 'Copper', weight: 0.5 },
  { hex: '#b99a62', label: 'Dark blond', weight: 0.8 },
  { hex: '#dcc497', label: 'Blond', weight: 0.8 },
  { hex: '#8f8f8c', label: 'Grey', weight: 0.3, ages: ['adult', 'elder'] },
  { hex: '#c9c9c5', label: 'Silver', weight: 3, ages: ['elder'] },
  { hex: '#e6e4de', label: 'White', weight: 3, ages: ['elder'] },
];

const EYES: FigureLookSwatch[] = [
  { hex: '#2a1b12', label: 'Dark brown', weight: 3 },
  { hex: '#4b3020', label: 'Brown', weight: 2 },
  { hex: '#6e5b32', label: 'Hazel', weight: 1 },
  { hex: '#4a6b46', label: 'Green', weight: 0.7 },
  { hex: '#3e6189', label: 'Blue', weight: 1 },
  { hex: '#6d757c', label: 'Grey', weight: 0.5 },
];

const FABRIC: FigureLookSwatch[] = [
  { hex: '#2f3b52', label: 'Navy' },
  { hex: '#1f1f24', label: 'Ink' },
  { hex: '#e8e6de', label: 'White' },
  { hex: '#d9cfb6', label: 'Cream' },
  { hex: '#8a8f96', label: 'Grey' },
  { hex: '#44474d', label: 'Charcoal' },
  { hex: '#c9b48a', label: 'Khaki' },
  { hex: '#8e3b2f', label: 'Brick' },
  { hex: '#2f5a3b', label: 'Forest' },
  { hex: '#3b6ea5', label: 'Blue' },
  { hex: '#7fa6c9', label: 'Sky' },
  { hex: '#b0553a', label: 'Rust' },
  { hex: '#5a3b6b', label: 'Plum' },
  { hex: '#c9a227', label: 'Mustard' },
  { hex: '#2f6f6f', label: 'Teal' },
  { hex: '#c27c8a', label: 'Rose' },
];

const FOOTWEAR: FigureLookSwatch[] = [
  { hex: '#1a1a1a', label: 'Black' },
  { hex: '#4a2e1f', label: 'Brown' },
  { hex: '#9a6b3f', label: 'Tan' },
  { hex: '#e4e2dc', label: 'White' },
  { hex: '#6f7278', label: 'Grey' },
  { hex: '#26304a', label: 'Navy' },
];

const ACCENT: FigureLookSwatch[] = [
  { hex: '#c8a24a', label: 'Brass' },
  { hex: '#222222', label: 'Black' },
  { hex: '#5a3a24', label: 'Brown' },
  { hex: '#b8bcc2', label: 'Silver' },
];

/** Frames, headphones and watch straps. */
const GEAR: FigureLookSwatch[] = [
  { hex: '#1d1d1f', label: 'Black', weight: 2 },
  { hex: '#3a3a3c', label: 'Charcoal' },
  { hex: '#ececec', label: 'White' },
  { hex: '#b8b8bc', label: 'Silver' },
  { hex: '#c8a24a', label: 'Gold', weight: 0.7 },
  { hex: '#6e4a2c', label: 'Tortoiseshell' },
  { hex: '#b03a2e', label: 'Red', weight: 0.6 },
  { hex: '#22314f', label: 'Navy', weight: 0.8 },
  { hex: '#56603a', label: 'Olive', weight: 0.6 },
  { hex: '#b08a5a', label: 'Tan', weight: 0.8 },
];

const NOT_CHILD: FigureAge[] = ['adult', 'elder'];

const CATEGORIES: FigureLookCategory[] = [
  {
    id: 'body',
    label: 'Body shape',
    part: 'person',
    neutral: false,
    framing: 'body',
    // Three shapes on the neutral form suit every steer; three lean on each other form.
    options: [
      {
        id: 'body.slender',
        label: 'Slender',
        figure: {
          build: -0.55,
          features: { form: 'neutral' },
          proportions: { waist: 0.97, bust: 0.3 },
        },
      },
      {
        id: 'body.straight',
        label: 'Straight',
        figure: { build: 0, features: { form: 'neutral' }, proportions: { bust: 0.4 } },
      },
      {
        id: 'body.rounded',
        label: 'Rounded',
        figure: {
          build: 0.6,
          features: { form: 'neutral' },
          proportions: { waist: 1.08, belly: 0.7, bust: 0.5 },
        },
      },
      {
        id: 'body.lean',
        label: 'Lean',
        figure: { build: -0.45, features: { form: 'masculine' }, proportions: { bust: 0.15 } },
        steer: { feminine: 0 },
      },
      {
        id: 'body.tapered',
        label: 'Tapered',
        figure: {
          build: 0.1,
          features: { form: 'masculine' },
          proportions: { shoulderWidth: 1.06, waist: 0.93, bust: 0.3 },
        },
        steer: { feminine: 0 },
      },
      {
        id: 'body.broad',
        label: 'Broad',
        figure: {
          build: 0.55,
          features: { form: 'masculine' },
          proportions: { shoulderWidth: 1.07, belly: 0.35, bust: 0.4 },
        },
        steer: { feminine: 0 },
      },
      {
        id: 'body.willowy',
        label: 'Willowy',
        figure: {
          build: -0.5,
          features: { form: 'feminine' },
          proportions: { waist: 0.95, bust: 0.7 },
        },
        steer: { masculine: 0 },
      },
      {
        id: 'body.curved',
        label: 'Curved',
        figure: {
          build: -0.05,
          features: { form: 'feminine' },
          proportions: { hipWidth: 1.05, waist: 0.88, seat: 1.1, bust: 1.15 },
        },
        steer: { masculine: 0 },
      },
      {
        id: 'body.full',
        label: 'Full',
        figure: {
          build: 0.55,
          features: { form: 'feminine' },
          proportions: { hipWidth: 1.06, seat: 1.15, belly: 0.4, bust: 1.2 },
        },
        steer: { masculine: 0 },
      },
    ],
  },
  {
    id: 'head',
    label: 'Head',
    part: 'person',
    neutral: true,
    framing: 'head',
    // Face 1 is the reference head (its jaw, brow and lips follow the body form, as before
    // heads had shapes); the others are the molen head presets, spread so no feature travels
    // with another.
    options: [
      { id: 'head.01', label: 'Face 1', figure: {} },
      ...FIGURE_HEAD_PRESET_IDS.slice(1).map((preset, i) => ({
        id: `head.${preset}`,
        label: `Face ${i + 2}`,
        figure: { head: { preset } },
      })),
    ],
  },
  {
    id: 'hair',
    label: 'Hair style',
    part: 'person',
    neutral: true,
    framing: 'head',
    options: [
      { id: 'hair.none', label: 'None', figure: { features: { hair: 'none' } }, weight: 0.5 },
      { id: 'hair.buzz', label: 'Buzz', figure: { features: { hair: 'buzz' } } },
      {
        id: 'hair.thinning',
        label: 'Thinning',
        figure: { features: { hair: 'balding' } },
        weight: 0.4,
        ages: NOT_CHILD,
      },
      { id: 'hair.short', label: 'Short', figure: { features: { hair: 'cap' } } },
      { id: 'hair.crop', label: 'Crop', figure: { features: { hair: 'crop' } } },
      { id: 'hair.bob', label: 'Bob', figure: { features: { hair: 'bob' } } },
      { id: 'hair.long', label: 'Long', figure: { features: { hair: 'long' } } },
      { id: 'hair.ponytail', label: 'Ponytail', figure: { features: { hair: 'ponytail' } } },
      { id: 'hair.bun', label: 'Bun', figure: { features: { hair: 'bun' } } },
      { id: 'hair.rounded', label: 'Rounded', figure: { features: { hair: 'afro' } } },
      { id: 'hair.shoulder', label: 'Shoulder length', figure: { features: { hair: 'shoulder' } } },
      { id: 'hair.fade', label: 'Fade', figure: { features: { hair: 'fade' } } },
      {
        id: 'hair.mohawk',
        label: 'Mohawk',
        figure: { features: { hair: 'mohawk' } },
        weight: 0.4,
      },
      { id: 'hair.topknot', label: 'Topknot', figure: { features: { hair: 'topknot' } } },
      { id: 'hair.puffs', label: 'Puffs', figure: { features: { hair: 'puffs' } } },
      { id: 'hair.braids', label: 'Braids', figure: { features: { hair: 'braids' } } },
      { id: 'hair.rows', label: 'Rows', figure: { features: { hair: 'rows' } } },
      { id: 'hair.locs', label: 'Locs', figure: { features: { hair: 'locs' } } },
    ],
  },
  {
    id: 'hairTexture',
    label: 'Hair texture',
    part: 'person',
    neutral: true,
    framing: 'head',
    // Straight is the reference hair (no texture field), so looks from before textures are unchanged.
    options: [
      { id: 'texture.straight', label: 'Straight', figure: {} },
      { id: 'texture.wavy', label: 'Wavy', figure: { features: { hairTexture: 'wavy' } } },
      { id: 'texture.curly', label: 'Curly', figure: { features: { hairTexture: 'curly' } } },
      { id: 'texture.coily', label: 'Coily', figure: { features: { hairTexture: 'coily' } } },
    ],
  },
  {
    id: 'facialHair',
    label: 'Facial hair',
    part: 'person',
    neutral: false,
    framing: 'head',
    options: [
      { id: 'facial.none', label: 'None', figure: { features: { facialHair: 'none' } }, weight: 2 },
      {
        id: 'facial.stubble',
        label: 'Stubble',
        figure: { features: { facialHair: 'stubble' } },
        steer: { feminine: 0 },
        ages: NOT_CHILD,
      },
      {
        id: 'facial.mustache',
        label: 'Mustache',
        figure: { features: { facialHair: 'mustache' } },
        steer: { feminine: 0 },
        ages: NOT_CHILD,
      },
      {
        id: 'facial.beard',
        label: 'Beard',
        figure: { features: { facialHair: 'beard' } },
        steer: { feminine: 0 },
        ages: NOT_CHILD,
      },
    ],
  },
  {
    id: 'top',
    label: 'Top',
    part: 'outfit',
    neutral: false,
    framing: 'torso',
    options: [
      {
        id: 'top.long-sleeve',
        label: 'Long-sleeved shirt',
        figure: { features: { top: 'shirt', sleeves: 'long' } },
        colors: ['top'],
      },
      {
        id: 'top.short-sleeve',
        label: 'Short-sleeved shirt',
        figure: { features: { top: 'shirt', sleeves: 'short' } },
        colors: ['top'],
      },
      {
        id: 'top.tee',
        label: 'T-shirt',
        figure: { features: { top: 'tee', sleeves: 'short' } },
        colors: ['top'],
        weight: 1.5,
      },
      {
        id: 'top.polo',
        label: 'Polo shirt',
        figure: { features: { top: 'polo', sleeves: 'short' } },
        colors: ['top'],
        weight: 0.8,
      },
      {
        id: 'top.sleeveless',
        label: 'Sleeveless top',
        figure: { features: { top: 'tank', sleeves: 'none' } },
        colors: ['top'],
        weight: 0.5,
        steer: { masculine: 0.5 },
      },
      {
        id: 'top.sweater',
        label: 'Sweater',
        figure: { features: { top: 'sweater', sleeves: 'long' } },
        colors: ['top'],
      },
      {
        id: 'top.hoodie',
        label: 'Hoodie',
        figure: { features: { top: 'hoodie', sleeves: 'long' } },
        colors: ['top'],
      },
      {
        id: 'top.jacket',
        label: 'Jacket',
        figure: { features: { top: 'jacket', sleeves: 'long' } },
        colors: ['outer', 'top'],
        weight: 0.8,
      },
      {
        id: 'top.coat',
        label: 'Coat',
        figure: { features: { top: 'coat', sleeves: 'long' } },
        colors: ['outer', 'top'],
        weight: 0.5,
      },
      {
        id: 'top.dress',
        label: 'Dress',
        figure: { features: { top: 'dress', sleeves: 'short' } },
        colors: ['top'],
        replaces: ['bottom'],
        weight: 0.7,
        steer: { masculine: 0, feminine: 1.5 },
      },
      {
        id: 'top.sleeveless-dress',
        label: 'Sleeveless dress',
        figure: { features: { top: 'dress', sleeves: 'none' } },
        colors: ['top'],
        replaces: ['bottom'],
        weight: 0.4,
        steer: { masculine: 0, feminine: 1.5 },
      },
    ],
  },
  {
    id: 'bottom',
    label: 'Bottom',
    part: 'outfit',
    neutral: false,
    framing: 'legs',
    options: [
      {
        id: 'bottom.trousers',
        label: 'Trousers',
        figure: { features: { legs: 'long' } },
        colors: ['bottom', 'accent'],
        weight: 2,
      },
      {
        id: 'bottom.shorts',
        label: 'Shorts',
        figure: { features: { legs: 'shorts' } },
        colors: ['bottom', 'accent'],
        weight: 0.7,
      },
      {
        id: 'bottom.skirt',
        label: 'Skirt',
        figure: { features: { legs: 'skirt' } },
        colors: ['bottom', 'accent'],
        steer: { masculine: 0, feminine: 1.5 },
      },
      {
        id: 'bottom.slim',
        label: 'Slim trousers',
        figure: { features: { legs: 'slim' } },
        colors: ['bottom', 'accent'],
      },
      {
        id: 'bottom.wide',
        label: 'Wide trousers',
        figure: { features: { legs: 'wide' } },
        colors: ['bottom', 'accent'],
        weight: 0.6,
      },
      {
        id: 'bottom.cropped',
        label: 'Cropped trousers',
        figure: { features: { legs: 'cropped' } },
        colors: ['bottom', 'accent'],
        weight: 0.5,
      },
    ],
  },
  {
    id: 'footwear',
    label: 'Footwear',
    part: 'outfit',
    neutral: false,
    framing: 'feet',
    options: [
      { id: 'footwear.shoes', label: 'Shoes', figure: {}, colors: ['shoes'] },
      {
        id: 'footwear.sneakers',
        label: 'Sneakers',
        figure: { features: { footwear: 'sneaker' } },
        colors: ['shoes'],
        weight: 1.5,
      },
      {
        id: 'footwear.boots',
        label: 'Boots',
        figure: { features: { footwear: 'boot' } },
        colors: ['shoes'],
        weight: 0.7,
      },
      {
        id: 'footwear.sandals',
        label: 'Sandals',
        figure: { features: { footwear: 'sandal' } },
        colors: ['shoes'],
        weight: 0.4,
      },
    ],
  },
  // Accessories: each slot is empty unless chosen; `chance` is how often a random look wears one.
  {
    id: 'headwear',
    label: 'Hat',
    part: 'outfit',
    neutral: false,
    framing: 'head',
    chance: 0.18,
    options: [
      {
        id: 'headwear.cap',
        label: 'Cap',
        figure: { features: { headwear: 'cap' } },
        colors: ['headwear'],
      },
      {
        id: 'headwear.beanie',
        label: 'Beanie',
        figure: { features: { headwear: 'beanie' } },
        colors: ['headwear'],
      },
      {
        id: 'headwear.sunhat',
        label: 'Sun hat',
        figure: { features: { headwear: 'sunhat' } },
        colors: ['headwear'],
        weight: 0.6,
      },
    ],
  },
  {
    id: 'eyewear',
    label: 'Glasses',
    part: 'outfit',
    neutral: false,
    framing: 'head',
    chance: 0.25,
    options: [
      {
        id: 'eyewear.glasses',
        label: 'Glasses',
        figure: { features: { eyewear: 'glasses' } },
        colors: ['eyewear'],
        weight: 1.5,
      },
      {
        id: 'eyewear.sunglasses',
        label: 'Sunglasses',
        figure: { features: { eyewear: 'sunglasses' } },
        colors: ['eyewear'],
      },
    ],
  },
  {
    id: 'neckwear',
    label: 'Scarf',
    part: 'outfit',
    neutral: false,
    framing: 'torso',
    chance: 0.08,
    options: [
      {
        id: 'neckwear.scarf',
        label: 'Scarf',
        figure: { features: { neckwear: 'scarf' } },
        colors: ['neckwear'],
      },
    ],
  },
  {
    id: 'backwear',
    label: 'Backpack',
    part: 'outfit',
    neutral: false,
    framing: 'body',
    chance: 0.12,
    options: [
      {
        id: 'backwear.backpack',
        label: 'Backpack',
        figure: { features: { backwear: 'backpack' } },
        colors: ['backwear'],
      },
    ],
  },
  {
    id: 'earwear',
    label: 'Headphones',
    part: 'outfit',
    neutral: false,
    framing: 'head',
    chance: 0.06,
    options: [
      {
        id: 'earwear.headphones',
        label: 'Headphones',
        figure: { features: { earwear: 'headphones' } },
        colors: ['earwear'],
      },
    ],
  },
  {
    id: 'wristwear',
    label: 'Watch',
    part: 'outfit',
    neutral: false,
    framing: 'body',
    chance: 0.3,
    options: [
      {
        id: 'wristwear.watch',
        label: 'Watch',
        figure: { features: { wristwear: 'watch' } },
        colors: ['wristwear'],
      },
    ],
  },
  {
    id: 'bag',
    label: 'Bag',
    part: 'outfit',
    neutral: false,
    framing: 'body',
    chance: 0.12,
    options: [
      {
        id: 'bag.crossbody',
        label: 'Shoulder bag',
        figure: { features: { bag: 'crossbody' } },
        colors: ['bag'],
      },
    ],
  },
];

/** The catalogue `@bendyline/molen-figures/look` uses when a call names none. */
export const DEFAULT_FIGURE_LOOK_CATALOG: FigureLookCatalog = {
  id: 'molen.people',
  // 2: twelve faces, eight more hair styles, four hair textures, body shapes with waist, bust,
  // belly and seat. 3: garments (tees, polos, sweaters, hoodies, jackets and coats with an outer
  // colour, dresses that replace the bottom; slim, wide and cropped trousers; sneakers, boots,
  // sandals). 4: accessories (hats, glasses, a scarf, a backpack, headphones, a watch, a
  // shoulder bag) and the gear palette. No option was retired.
  revision: 4,
  categories: CATEGORIES,
  palettes: {
    skin: SKIN,
    hair: HAIR,
    eyes: EYES,
    fabric: FABRIC,
    footwear: FOOTWEAR,
    accent: ACCENT,
    gear: GEAR,
  },
  slotPalettes: {
    top: 'fabric',
    bottom: 'fabric',
    shoes: 'footwear',
    accent: 'accent',
    outer: 'fabric',
    headwear: 'fabric',
    eyewear: 'gear',
    neckwear: 'fabric',
    backwear: 'fabric',
    earwear: 'gear',
    wristwear: 'gear',
    bag: 'footwear',
  },
  aliases: {},
  heights: {
    adult: {
      min: 1.5,
      max: 1.95,
      masculine: [1.66, 1.9],
      feminine: [1.55, 1.78],
      unspecified: [1.56, 1.88],
    },
    elder: {
      min: 1.45,
      max: 1.9,
      masculine: [1.62, 1.84],
      feminine: [1.5, 1.72],
      unspecified: [1.52, 1.82],
    },
    child: {
      min: 1,
      max: 1.55,
      masculine: [1.1, 1.45],
      feminine: [1.1, 1.45],
      unspecified: [1.1, 1.45],
    },
  },
};

/** Categories whose choices must never be steered. */
const MUST_BE_NEUTRAL: readonly FigureLookCategoryId[] = ['head', 'hair', 'hairTexture'];

const PALETTE_IDS: readonly FigureLookPaletteId[] = [
  'skin',
  'hair',
  'eyes',
  'fabric',
  'footwear',
  'accent',
  'gear',
];

const AGES: readonly FigureAge[] = ['child', 'adult', 'elder'];

function weightOk(weight: number | undefined): boolean {
  return weight === undefined || (Number.isFinite(weight) && weight >= 0);
}

/** Every problem with a catalogue (an empty list means it is usable). */
export function validateFigureLookCatalog(catalog: FigureLookCatalog): string[] {
  const problems: string[] = [];
  const ids = new Map<string, FigureLookCategoryId>();
  const seen = new Set<FigureLookCategoryId>();
  for (const category of catalog.categories) {
    if (seen.has(category.id)) problems.push(`category "${category.id}" appears twice`);
    seen.add(category.id);
    const person = (FIGURE_LOOK_PERSON_CHOICES as readonly string[]).includes(category.id);
    if (person !== (category.part === 'person'))
      problems.push(`category "${category.id}" must be part "${person ? 'person' : 'outfit'}"`);
    if (MUST_BE_NEUTRAL.includes(category.id) && !category.neutral)
      problems.push(`category "${category.id}" must be neutral`);
    if (category.options.length === 0) problems.push(`category "${category.id}" has no options`);
    const slot = (FIGURE_LOOK_SLOTS as readonly string[]).includes(category.id);
    if (
      category.chance !== undefined &&
      (!slot ||
        typeof category.chance !== 'number' ||
        !(category.chance >= 0 && category.chance <= 1))
    )
      problems.push(`category "${category.id}": chance is for accessory slots, between 0 and 1`);
    for (const option of category.options) {
      const where = `${category.id} option "${option.id}"`;
      if (option.id.length === 0) problems.push(`${category.id} has an option without an id`);
      const before = ids.get(option.id);
      if (before !== undefined) problems.push(`${where} reuses an id from "${before}"`);
      ids.set(option.id, category.id);
      if (category.neutral && option.steer !== undefined)
        problems.push(`${where} is steered in a neutral category`);
      if (!weightOk(option.weight)) problems.push(`${where}: weight must be finite and ≥ 0`);
      if (!weightOk(option.steer?.masculine) || !weightOk(option.steer?.feminine))
        problems.push(`${where}: steer weights must be finite and ≥ 0`);
      const garment = (FIGURE_LOOK_GARMENTS as readonly string[]).includes(category.id) || slot;
      if (!garment && option.colors !== undefined)
        problems.push(`${where}: only outfit items have colours`);
      for (const color of option.colors ?? [])
        if (catalog.slotPalettes[color as FigureLookColorSlot] === undefined)
          problems.push(`${where}: no palette for colour slot "${color}"`);
      for (const covered of option.replaces ?? [])
        if (
          !(FIGURE_LOOK_GARMENTS as readonly string[]).includes(category.id) ||
          !(FIGURE_LOOK_GARMENTS as readonly string[]).includes(covered) ||
          covered === category.id
        )
          problems.push(`${where}: a garment may replace only another garment ("${covered}")`);
      for (const age of option.ages ?? [])
        if (!AGES.includes(age)) problems.push(`${where}: unknown age "${age}"`);
    }
  }
  for (const required of [...FIGURE_LOOK_PERSON_CHOICES, ...FIGURE_LOOK_GARMENTS])
    if (!seen.has(required)) problems.push(`required category "${required}" is missing`);
  for (const [from, to] of Object.entries(catalog.aliases)) {
    if (ids.has(from)) problems.push(`alias "${from}" is still a live option id`);
    if (!ids.has(to)) problems.push(`alias "${from}" points at unknown option "${to}"`);
  }
  for (const id of PALETTE_IDS) {
    const swatches = catalog.palettes[id];
    if (swatches === undefined || swatches.length === 0) {
      problems.push(`palette "${id}" is empty`);
      continue;
    }
    for (const swatch of swatches) {
      if (!HEX.test(swatch.hex)) problems.push(`palette "${id}": "${swatch.hex}" is not #rrggbb`);
      if (!weightOk(swatch.weight)) problems.push(`palette "${id}": weight must be ≥ 0`);
    }
  }
  for (const age of AGES) {
    const range = catalog.heights[age];
    if (range === undefined) {
      problems.push(`no heights for "${age}"`);
      continue;
    }
    if (!(range.min > 0 && range.min <= range.max)) problems.push(`heights "${age}": min > max`);
    for (const steer of ['masculine', 'feminine', 'unspecified'] as const) {
      const [lo, hi] = range[steer];
      if (!(lo >= range.min && hi <= range.max && lo <= hi))
        problems.push(`heights "${age}.${steer}" falls outside ${range.min}–${range.max}`);
    }
  }
  return problems;
}
