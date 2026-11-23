/**
 * From a look to a body: `figureFromLook` merges the person's and the outfit's option patches
 * over the age preset into a figure descriptor (the `figure` component, `walker.setAvatar`,
 * `actors.add`). Also the small immutable edits a designer makes, and option listing in the
 * order a steer suggests.
 */

import { hashJson } from '@bendyline/molen-kernel/determinism';
import type { FigureAge, FigureDescriptor, FigurePresetId } from '../kernel/types';
import { DEFAULT_FIGURE_LOOK_CATALOG } from './catalog';
import { figureLookSuggested, findCategory } from './draw';
import { normalizeFigureLook } from './normalize';
import {
  FIGURE_LOOK_GARMENTS,
  FIGURE_LOOK_PERSON_CHOICES,
  FIGURE_LOOK_SLOTS,
  type FigureLook,
  type FigureLookCatalog,
  type FigureLookCategory,
  type FigureLookCategoryId,
  type FigureLookColorSlot,
  type FigureLookGarment,
  type FigureLookItem,
  type FigureLookOption,
  type FigureLookOutfit,
  type FigureLookPatch,
  type FigureLookPersonColor,
  type FigureLookSlot,
  type FigureLookSteer,
} from './types';

const PRESET_FOR_AGE: Readonly<Record<FigureAge, FigurePresetId>> = {
  adult: 'human.adult',
  elder: 'human.elder',
  child: 'human.child',
};

export interface FigureFromLookOptions {
  catalog?: FigureLookCatalog;
  /** Dress the person in this outfit instead of their own (a uniform). */
  outfit?: FigureLookOutfit;
}

function apply(descriptor: FigureDescriptor, patch: FigureLookPatch): void {
  if (patch.build !== undefined) descriptor.build = patch.build;
  if (patch.proportions !== undefined)
    descriptor.proportions = { ...descriptor.proportions, ...patch.proportions };
  if (patch.features !== undefined)
    descriptor.features = { ...descriptor.features, ...patch.features };
  if (patch.palette !== undefined) descriptor.palette = { ...descriptor.palette, ...patch.palette };
  if (patch.head !== undefined) descriptor.head = { ...descriptor.head, ...patch.head };
}

function optionOf(
  catalog: FigureLookCatalog,
  id: FigureLookCategoryId,
  optionId: string,
): FigureLookOption | undefined {
  return findCategory(catalog, id)?.options.find((option) => option.id === optionId);
}

/**
 * The garments an outfit's worn items cover (a dress covers the bottom): `figureFromLook` leaves
 * them out and a designer hides their pickers, while the look keeps them.
 */
export function figureLookReplaced(
  outfit: FigureLookOutfit,
  catalog: FigureLookCatalog = DEFAULT_FIGURE_LOOK_CATALOG,
): Set<FigureLookGarment> {
  const replaced = new Set<FigureLookGarment>();
  for (const garment of FIGURE_LOOK_GARMENTS)
    for (const covered of optionOf(catalog, garment, outfit[garment].id)?.replaces ?? [])
      if (covered !== garment) replaced.add(covered);
  return replaced;
}

/** The figure descriptor of a look (repaired first, so any value works). */
export function figureFromLook(
  look: unknown,
  options: FigureFromLookOptions = {},
): FigureDescriptor {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  let { look: valid } = normalizeFigureLook(look, { catalog });
  if (options.outfit !== undefined)
    valid = normalizeFigureLook({ ...valid, outfit: options.outfit }, { catalog }).look;
  const { person, outfit } = valid;
  const descriptor: FigureDescriptor = {
    preset: PRESET_FOR_AGE[person.age],
    height: person.height,
  };
  for (const choice of FIGURE_LOOK_PERSON_CHOICES) {
    const option = optionOf(catalog, choice, person[choice]);
    if (option !== undefined) apply(descriptor, option.figure);
  }
  const replaced = figureLookReplaced(outfit, catalog);
  const items: [FigureLookCategoryId, FigureLookItem][] = FIGURE_LOOK_GARMENTS.filter(
    (garment) => !replaced.has(garment),
  ).map((garment) => [garment, outfit[garment]]);
  for (const slot of FIGURE_LOOK_SLOTS) {
    const item = outfit.accessories[slot];
    if (item !== undefined) items.push([slot, item]);
  }
  const palette: Record<string, string> = {
    skin: person.skin,
    hair: person.hairColor,
    eyes: person.eyes,
  };
  for (const [id, item] of items) {
    const option = optionOf(catalog, id, item.id);
    if (option === undefined) continue;
    apply(descriptor, option.figure);
    for (const slot of option.colors ?? []) {
      const hex = item.colors[slot];
      if (hex !== undefined) palette[slot] = hex;
    }
  }
  descriptor.palette = { ...descriptor.palette, ...palette };
  return descriptor;
}

/** A stable content key of a look (same look ⇔ same key). */
export function figureLookKey(look: FigureLook): string {
  return hashJson(look);
}

/** One entry of `figureLookOptions`. */
export interface FigureLookOptionEntry {
  option: FigureLookOption;
  /** Whether the steer suggests it; suggested options come first. */
  suggested: boolean;
}

export interface FigureLookOptionsQuery {
  catalog?: FigureLookCatalog;
  steer?: FigureLookSteer;
}

/** A category's options, the ones a steer suggests first (catalogue order within each group). */
export function figureLookOptions(
  category: FigureLookCategoryId,
  query: FigureLookOptionsQuery = {},
): FigureLookOptionEntry[] {
  const catalog = query.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  const found = findCategory(catalog, category);
  if (found === undefined) return [];
  const steer = query.steer ?? 'unspecified';
  const entries = found.options.map((option) => ({
    option,
    suggested: figureLookSuggested(found, option, steer),
  }));
  return [...entries.filter((e) => e.suggested), ...entries.filter((e) => !e.suggested)];
}

/** A category of the catalogue (or undefined). */
export function figureLookCategory(
  id: FigureLookCategoryId,
  catalog: FigureLookCatalog = DEFAULT_FIGURE_LOOK_CATALOG,
): FigureLookCategory | undefined {
  return findCategory(catalog, id);
}

export interface FigureLookEditOptions {
  catalog?: FigureLookCatalog;
}

function isGarment(id: FigureLookCategoryId): id is FigureLookGarment {
  return (FIGURE_LOOK_GARMENTS as readonly string[]).includes(id);
}

function isSlot(id: FigureLookCategoryId): id is FigureLookSlot {
  return (FIGURE_LOOK_SLOTS as readonly string[]).includes(id);
}

/**
 * Choose an option (a new look). An outfit item keeps its colours for the slots the new option
 * shares and gets colours for the rest; `null` empties an accessory slot.
 */
export function setFigureLookOption(
  look: FigureLook,
  category: FigureLookCategoryId,
  optionId: string | null,
  options: FigureLookEditOptions = {},
): FigureLook {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  const next: FigureLook = {
    ...look,
    person: { ...look.person },
    outfit: { ...look.outfit, accessories: { ...look.outfit.accessories } },
  };
  if ((FIGURE_LOOK_PERSON_CHOICES as readonly string[]).includes(category)) {
    if (optionId !== null)
      next.person[category as (typeof FIGURE_LOOK_PERSON_CHOICES)[number]] = optionId;
  } else if (isGarment(category)) {
    if (optionId !== null)
      next.outfit[category] = { id: optionId, colors: { ...look.outfit[category].colors } };
  } else if (isSlot(category)) {
    if (optionId === null) delete next.outfit.accessories[category];
    else
      next.outfit.accessories[category] = {
        id: optionId,
        colors: { ...look.outfit.accessories[category]?.colors },
      };
  }
  return normalizeFigureLook(next, { catalog }).look;
}

/** What a colour edit changes: a person colour, or one slot of a worn item. */
export type FigureLookColorTarget =
  | FigureLookPersonColor
  | { item: FigureLookGarment | FigureLookSlot; slot: FigureLookColorSlot };

/** Set a colour ('#rrggbb'; an invalid colour leaves the look as it was). */
export function setFigureLookColor(
  look: FigureLook,
  target: FigureLookColorTarget,
  hex: string,
  options: FigureLookEditOptions = {},
): FigureLook {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return look;
  const color = hex.toLowerCase();
  if (typeof target === 'string')
    return normalizeFigureLook(
      { ...look, person: { ...look.person, [target]: color } },
      { catalog },
    ).look;
  const outfit: FigureLookOutfit = { ...look.outfit, accessories: { ...look.outfit.accessories } };
  const current = isGarment(target.item) ? outfit[target.item] : outfit.accessories[target.item];
  if (current === undefined) return look;
  const item: FigureLookItem = {
    id: current.id,
    colors: { ...current.colors, [target.slot]: color },
  };
  if (isGarment(target.item)) outfit[target.item] = item;
  else outfit.accessories[target.item] = item;
  return normalizeFigureLook({ ...look, outfit }, { catalog }).look;
}

/** Set the height in meters (clamped to the catalogue's range for the person's age). */
export function setFigureLookHeight(
  look: FigureLook,
  meters: number,
  options: FigureLookEditOptions = {},
): FigureLook {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  return normalizeFigureLook({ ...look, person: { ...look.person, height: meters } }, { catalog })
    .look;
}
