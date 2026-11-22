/**
 * Random looks: one seed becomes one complete person and outfit. Neutral choices (skin, head,
 * hair, hair colour, eyes) are drawn independently of each other and of the steer; the steer
 * only weights body shape, facial hair and clothing.
 */

import { seedToInt } from '@bendyline/molen-kernel/determinism';
import type { FigureAge } from '../kernel/types';
import { DEFAULT_FIGURE_LOOK_CATALOG } from './catalog';
import { drawOption, drawSwatch, drawUnit, findCategory } from './draw';
import {
  FIGURE_LOOK_FORMAT,
  FIGURE_LOOK_GARMENTS,
  FIGURE_LOOK_PERSON_CHOICES,
  FIGURE_LOOK_PERSON_PALETTES,
  FIGURE_LOOK_SLOTS,
  type FigureLook,
  type FigureLookAccessories,
  type FigureLookCatalog,
  type FigureLookCategory,
  type FigureLookCategoryId,
  type FigureLookColorSlot,
  type FigureLookItem,
  type FigureLookItemColors,
  type FigureLookOutfit,
  type FigureLookPerson,
  type FigureLookPersonColor,
  type FigureLookSteer,
} from './types';

/** What part of an existing look a new random look keeps. */
export type FigureLookPart =
  | 'person'
  | 'outfit'
  | 'height'
  | FigureLookCategoryId
  | FigureLookPersonColor;

export interface RandomFigureLookOptions {
  catalog?: FigureLookCatalog;
  /** Default 'unspecified'. */
  steer?: FigureLookSteer;
  /** Default 'adult'. */
  age?: FigureAge;
  /** Copy these parts from an existing look instead of drawing them. */
  keep?: { look: FigureLook; parts: readonly FigureLookPart[] };
}

/** The catalogue id a look records: `<id>@<revision>`. */
export function catalogTag(catalog: FigureLookCatalog): string {
  return `${catalog.id}@${catalog.revision}`;
}

function required(catalog: FigureLookCatalog, id: FigureLookCategoryId): FigureLookCategory {
  const category = findCategory(catalog, id);
  if (category === undefined) throw new Error(`figure look catalogue has no "${id}" category`);
  return category;
}

/** Draw an item of a garment or slot category with its colours. */
export function drawItem(
  catalog: FigureLookCatalog,
  category: FigureLookCategory,
  seed: number,
  steer: FigureLookSteer,
  age: FigureAge,
): FigureLookItem {
  const option = drawOption(category, seed, steer, age);
  return { id: option.id, colors: drawItemColors(catalog, category.id, option.colors, seed, age) };
}

/** Colours for an item's slots, avoiding a top and bottom of the same colour. */
export function drawItemColors(
  catalog: FigureLookCatalog,
  categoryId: FigureLookCategoryId,
  slots: readonly FigureLookColorSlot[] | undefined,
  seed: number,
  age: FigureAge,
  avoid?: string,
): FigureLookItemColors {
  const colors: FigureLookItemColors = {};
  for (const slot of slots ?? []) {
    const palette = catalog.slotPalettes[slot];
    let hex = drawSwatch(catalog, palette, seed, `${categoryId}.${slot}`, age).hex;
    if (avoid !== undefined && hex === avoid) {
      const swatches = catalog.palettes[palette];
      const index = swatches.findIndex((swatch) => swatch.hex === hex);
      hex = (swatches[(index + 1) % swatches.length] ?? swatches[0])?.hex ?? hex;
    }
    colors[slot] = hex;
  }
  return colors;
}

function heightFor(
  catalog: FigureLookCatalog,
  seed: number,
  steer: FigureLookSteer,
  age: FigureAge,
): number {
  const [lo, hi] = catalog.heights[age][steer];
  return Math.round((lo + (hi - lo) * drawUnit(seed, 'height')) * 100) / 100;
}

/** A complete random look for a seed (the same seed, catalogue and steer give the same look). */
export function randomFigureLook(
  seed: string | number,
  options: RandomFigureLookOptions = {},
): FigureLook {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  const steer = options.steer ?? 'unspecified';
  const keep = options.keep;
  const age = keep?.parts.includes('person') ? keep.look.person.age : (options.age ?? 'adult');
  const s = seedToInt(seed);

  const person: FigureLookPerson = {
    age,
    body: '',
    height: heightFor(catalog, s, steer, age),
    skin: '',
    eyes: '',
    head: '',
    hair: '',
    hairTexture: '',
    hairColor: '',
    facialHair: '',
  };
  for (const choice of FIGURE_LOOK_PERSON_CHOICES)
    person[choice] = drawOption(required(catalog, choice), s, steer, age).id;
  for (const color of ['skin', 'hairColor', 'eyes'] as const)
    person[color] = drawSwatch(catalog, FIGURE_LOOK_PERSON_PALETTES[color], s, color, age).hex;

  const top = drawItem(catalog, required(catalog, 'top'), s, steer, age);
  const bottomCategory = required(catalog, 'bottom');
  const bottomOption = drawOption(bottomCategory, s, steer, age);
  const bottom: FigureLookItem = {
    id: bottomOption.id,
    colors: drawItemColors(catalog, 'bottom', bottomOption.colors, s, age, top.colors.top),
  };
  const footwear = drawItem(catalog, required(catalog, 'footwear'), s, steer, age);
  const accessories: FigureLookAccessories = {};
  for (const slot of FIGURE_LOOK_SLOTS) {
    const category = findCategory(catalog, slot);
    if (category === undefined) continue;
    if (drawUnit(s, `${slot}.worn`) >= (category.chance ?? 0.25)) continue;
    accessories[slot] = drawItem(catalog, category, s, steer, age);
  }
  const outfit: FigureLookOutfit = { top, bottom, footwear, accessories };
  const look: FigureLook = {
    format: FIGURE_LOOK_FORMAT,
    catalog: catalogTag(catalog),
    person,
    outfit,
  };
  return keep === undefined ? look : keepParts(look, keep.look, keep.parts);
}

/** Copy the named parts of `from` into `look` (a new object). */
function keepParts(
  look: FigureLook,
  from: FigureLook,
  parts: readonly FigureLookPart[],
): FigureLook {
  const person = { ...look.person };
  const outfit: FigureLookOutfit = { ...look.outfit, accessories: { ...look.outfit.accessories } };
  for (const part of parts) {
    if (part === 'person') Object.assign(person, from.person);
    else if (part === 'outfit')
      Object.assign(outfit, from.outfit, { accessories: { ...from.outfit.accessories } });
    else if (part === 'height') person.height = from.person.height;
    else if (part === 'skin' || part === 'hairColor' || part === 'eyes')
      person[part] = from.person[part];
    else if ((FIGURE_LOOK_PERSON_CHOICES as readonly string[]).includes(part))
      person[part as (typeof FIGURE_LOOK_PERSON_CHOICES)[number]] =
        from.person[part as (typeof FIGURE_LOOK_PERSON_CHOICES)[number]];
    else if ((FIGURE_LOOK_GARMENTS as readonly string[]).includes(part)) {
      const garment = part as (typeof FIGURE_LOOK_GARMENTS)[number];
      outfit[garment] = from.outfit[garment];
    } else {
      const slot = part as (typeof FIGURE_LOOK_SLOTS)[number];
      const item = from.outfit.accessories[slot];
      if (item === undefined) delete outfit.accessories[slot];
      else outfit.accessories[slot] = item;
    }
  }
  return { ...look, person, outfit };
}

export interface FigureLookPoolOptions {
  count: number;
  age?: FigureAge;
  catalog?: FigureLookCatalog;
}

/**
 * A fixed set of varied looks (crowds share their bodies' geometry): steers cycle masculine,
 * feminine, unspecified, so a pool has every presentation in equal measure.
 */
export function figureLookPool(
  seed: string | number,
  options: FigureLookPoolOptions,
): FigureLook[] {
  const steers: readonly FigureLookSteer[] = ['masculine', 'feminine', 'unspecified'];
  const looks: FigureLook[] = [];
  for (let i = 0; i < options.count; i++) {
    looks.push(
      randomFigureLook(`${seed}#${i}`, {
        steer: steers[i % steers.length] as FigureLookSteer,
        age: options.age ?? 'adult',
        ...(options.catalog ? { catalog: options.catalog } : {}),
      }),
    );
  }
  return looks;
}
