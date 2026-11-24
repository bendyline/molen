/**
 * Plain-data contracts of figure looks: a person and their outfit chosen from a catalogue of
 * named options, the document a host stores for a player or a character and turns into a figure
 * descriptor with `figureFromLook`. Pure types and constants; nothing here imports zod, three or
 * the kernel, so a host page can create and repair looks without loading either.
 */

import type { JsonObject } from '@bendyline/molen-schema';
import type {
  FigureAge,
  FigureFeatures,
  FigureHeadInput,
  FigurePalette,
  FigureProportions,
} from '../kernel/types';

/** The look document format envelope. */
export const FIGURE_LOOK_FORMAT: 'molen/figure-look@1' = 'molen/figure-look@1';

/**
 * How a random look leans: `masculine` and `feminine` favour the options a catalogue suggests
 * for that presentation, so body shape, facial hair and clothing agree; `unspecified` treats
 * every option alike. A steer belongs to the draw, never to a look, and limits nothing a person
 * may choose.
 */
export type FigureLookSteer = 'unspecified' | 'masculine' | 'feminine';

/** Every steer. */
export const FIGURE_LOOK_STEERS: readonly FigureLookSteer[] = [
  'masculine',
  'feminine',
  'unspecified',
];

/** The person's choices that pick a catalogue option. */
export type FigureLookPersonChoice = 'body' | 'head' | 'hair' | 'hairTexture' | 'facialHair';
/** The person's colours, each drawn from one catalogue palette. */
export type FigureLookPersonColor = 'skin' | 'hairColor' | 'eyes';
/** The garments every outfit has. */
export type FigureLookGarment = 'top' | 'bottom' | 'footwear';
/** Optional accessory slots (absent from a look = nothing worn there). */
export type FigureLookSlot =
  | 'headwear'
  | 'eyewear'
  | 'neckwear'
  | 'backwear'
  | 'earwear'
  | 'wristwear'
  | 'bag';
/** Every catalogue category that picks an option. */
export type FigureLookCategoryId = FigureLookPersonChoice | FigureLookGarment | FigureLookSlot;

/**
 * Figure palette slots an outfit item can colour (`outer`: a jacket or coat, over the shirt in
 * `top`).
 */
export type FigureLookColorSlot =
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'accent'
  | 'outer'
  | 'headwear'
  | 'eyewear'
  | 'neckwear'
  | 'backwear'
  | 'earwear'
  | 'wristwear'
  | 'bag';
/** Named swatch lists of a catalogue. */
export type FigureLookPaletteId =
  | 'skin'
  | 'hair'
  | 'eyes'
  | 'fabric'
  | 'footwear'
  | 'accent'
  /** Frames, headphones, watch straps. */
  | 'gear';

/** What part of the body a category is about: how a preview frames it. */
export type FigureLookFraming = 'body' | 'head' | 'torso' | 'legs' | 'feet';

/** Who the person is. Every field names a catalogue option or holds a value. */
export interface FigureLookPerson extends JsonObject {
  age: FigureAge;
  /** Body shape option id, e.g. 'body.straight'. */
  body: string;
  /** Standing height in meters. */
  height: number;
  /** '#rrggbb'. */
  skin: string;
  eyes: string;
  head: string;
  hair: string;
  hairTexture: string;
  hairColor: string;
  facialHair: string;
}

/** Colours of one outfit item, by figure palette slot ('#rrggbb'). */
export interface FigureLookItemColors extends JsonObject {
  top?: string;
  bottom?: string;
  shoes?: string;
  accent?: string;
  outer?: string;
  headwear?: string;
  eyewear?: string;
  neckwear?: string;
  backwear?: string;
  earwear?: string;
  wristwear?: string;
  bag?: string;
}

/** One worn item: a catalogue option and its colours. */
export interface FigureLookItem extends JsonObject {
  id: string;
  colors: FigureLookItemColors;
}

/** Accessories by slot; a missing slot is empty. */
export interface FigureLookAccessories extends JsonObject {
  headwear?: FigureLookItem;
  eyewear?: FigureLookItem;
  neckwear?: FigureLookItem;
  backwear?: FigureLookItem;
  earwear?: FigureLookItem;
  wristwear?: FigureLookItem;
  bag?: FigureLookItem;
}

/** What the person wears. Separate from the person so a host can dress anyone in a uniform. */
export interface FigureLookOutfit extends JsonObject {
  top: FigureLookItem;
  bottom: FigureLookItem;
  footwear: FigureLookItem;
  accessories: FigureLookAccessories;
}

/** A look document (molen/figure-look@1). */
export interface FigureLook extends JsonObject {
  format: 'molen/figure-look@1';
  /** The catalogue it was made with, as `<id>@<revision>`. */
  catalog: string;
  person: FigureLookPerson;
  outfit: FigureLookOutfit;
}

/** The descriptor fields a catalogue option may set. */
export interface FigureLookPatch extends JsonObject {
  build?: number;
  proportions?: Partial<FigureProportions>;
  features?: Partial<FigureFeatures>;
  palette?: Partial<FigurePalette>;
  head?: FigureHeadInput;
}

/** Random-draw weights per steer; a missing steer weighs 1, and 0 means "not suggested". */
export interface FigureLookSteerWeights extends JsonObject {
  masculine?: number;
  feminine?: number;
}

/** One choice in a category. */
export interface FigureLookOption extends JsonObject {
  /** Stable id: never reused for something else once published (retire it through `aliases`). */
  id: string;
  /** English label; hosts translate through the designer's strings. */
  label: string;
  figure: FigureLookPatch;
  /** Base random weight (default 1). */
  weight?: number;
  /** Steered categories only: weights under a masculine or feminine steer. */
  steer?: FigureLookSteerWeights;
  /** Outfit items: the palette slots this item lets the wearer colour, main colour first. */
  colors?: FigureLookColorSlot[];
  /**
   * Garments it covers (a dress replaces the bottom): while it is worn, `figureFromLook` leaves
   * those garments out and the designer hides their pickers. The look keeps them, so choosing
   * another top brings the bottom back.
   */
  replaces?: FigureLookGarment[];
  /** Ages that may draw it at random (default all). Every option can still be chosen. */
  ages?: FigureAge[];
}

/** A list of choices. */
export interface FigureLookCategory extends JsonObject {
  id: FigureLookCategoryId;
  label: string;
  part: 'person' | 'outfit';
  /**
   * Neutral categories are never steered: every option is drawn uniformly (by `weight`) and
   * independently of every other choice. Skin, head, hair and eyes must be neutral.
   */
  neutral: boolean;
  framing: FigureLookFraming;
  /** Accessory slots only: the chance a random look wears something there (default 0.25). */
  chance?: number;
  options: FigureLookOption[];
}

/** A named colour of a palette. */
export interface FigureLookSwatch extends JsonObject {
  hex: string;
  label: string;
  weight?: number;
  ages?: FigureAge[];
}

/** Height limits and random ranges for one age, in meters. */
export interface FigureLookHeightRange extends JsonObject {
  min: number;
  max: number;
  masculine: [number, number];
  feminine: [number, number];
  unspecified: [number, number];
}

/** Everything a look can be made of. */
export interface FigureLookCatalog {
  /** Catalogue id, e.g. 'molen.people'. */
  readonly id: string;
  /** Raised whenever options are added or retired; looks record it. */
  readonly revision: number;
  readonly categories: readonly FigureLookCategory[];
  readonly palettes: Readonly<Record<FigureLookPaletteId, readonly FigureLookSwatch[]>>;
  /** Which palette each outfit colour slot draws from. */
  readonly slotPalettes: Readonly<Record<FigureLookColorSlot, FigureLookPaletteId>>;
  /** Retired option id → its replacement. */
  readonly aliases: Readonly<Record<string, string>>;
  readonly heights: Readonly<Record<FigureAge, FigureLookHeightRange>>;
}

/** Where a person colour draws its swatches. */
export const FIGURE_LOOK_PERSON_PALETTES: Readonly<
  Record<FigureLookPersonColor, FigureLookPaletteId>
> = {
  skin: 'skin',
  hairColor: 'hair',
  eyes: 'eyes',
};

/** The person choices, in document order. */
export const FIGURE_LOOK_PERSON_CHOICES: readonly FigureLookPersonChoice[] = [
  'body',
  'head',
  'hair',
  'hairTexture',
  'facialHair',
];

/** The garments, in document order. */
export const FIGURE_LOOK_GARMENTS: readonly FigureLookGarment[] = ['top', 'bottom', 'footwear'];

/** The accessory slots, in document order. */
export const FIGURE_LOOK_SLOTS: readonly FigureLookSlot[] = [
  'headwear',
  'eyewear',
  'neckwear',
  'backwear',
  'earwear',
  'wristwear',
  'bag',
];

/** A problem `normalizeFigureLook` repaired. */
export interface FigureLookIssue {
  code:
    | 'invalid'
    | 'format'
    | 'newer-catalog'
    | 'other-catalog'
    | 'unknown-option'
    | 'aliased-option'
    | 'color'
    | 'height'
    | 'age'
    | 'slot';
  /** Dotted path of the repaired field, e.g. 'person.hair'. */
  path: string;
  message: string;
}
