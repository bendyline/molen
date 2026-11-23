/**
 * Repairing looks: anything a host reads back (a saved setting, a shared link, a look written by
 * an older or newer catalogue) becomes a valid look for this catalogue. Total and idempotent:
 * it never throws, and normalizing a normalized look changes nothing.
 *
 * An unknown option follows the catalogue's aliases; failing that it is replaced by a draw seeded
 * from the look itself, so looks saved with retired ids spread over the catalogue instead of
 * collapsing onto one default person.
 */

import { hashJson, seedToInt } from '@bendyline/molen-kernel/determinism';
import type { JsonValue } from '@bendyline/molen-schema';
import type { FigureAge } from '../kernel/types';
import { DEFAULT_FIGURE_LOOK_CATALOG } from './catalog';
import { drawSwatch, findCategory } from './draw';
import { catalogTag, drawItemColors, randomFigureLook } from './random';
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
  type FigureLookColorSlot,
  type FigureLookIssue,
  type FigureLookItem,
  type FigureLookItemColors,
  type FigureLookPerson,
} from './types';

export interface NormalizedFigureLook {
  look: FigureLook;
  /** Whether `look` differs from the input. */
  changed: boolean;
  /**
   * What was repaired. A `newer-catalog` issue means the look came from a newer catalogue than
   * this one: show the repaired look, but do not save it over the original.
   */
  issues: FigureLookIssue[];
}

const AGES: readonly FigureAge[] = ['child', 'adult', 'elder'];

type Bag = { [key: string]: unknown };

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** '#rrggbb' in lower case, or undefined ('#rgb' widens). */
export function normalizeHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text))
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  return undefined;
}

function seedOf(value: unknown): string {
  try {
    return hashJson(value as JsonValue);
  } catch {
    return 'molen/figure-look:unreadable';
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  try {
    return hashJson(a as JsonValue) === hashJson(b as JsonValue);
  } catch {
    return false;
  }
}

/** Resolve an option id within a category: itself, its alias, or undefined. */
function resolveId(
  catalog: FigureLookCatalog,
  category: FigureLookCategory,
  id: unknown,
): { id: string; aliased: boolean } | undefined {
  if (typeof id !== 'string') return undefined;
  if (category.options.some((option) => option.id === id)) return { id, aliased: false };
  const alias = catalog.aliases[id];
  if (alias !== undefined && category.options.some((option) => option.id === alias))
    return { id: alias, aliased: true };
  return undefined;
}

export interface NormalizeFigureLookOptions {
  catalog?: FigureLookCatalog;
}

/** Turn anything into a valid look for the catalogue (see the module notes). */
export function normalizeFigureLook(
  value: unknown,
  options: NormalizeFigureLookOptions = {},
): NormalizedFigureLook {
  const catalog = options.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  const issues: FigureLookIssue[] = [];
  const issue = (code: FigureLookIssue['code'], path: string, message: string): void => {
    issues.push({ code, path, message });
  };
  const input: Bag = isBag(value) ? value : {};
  if (!isBag(value)) issue('invalid', '', 'not a look object');
  else if (input.format !== FIGURE_LOOK_FORMAT)
    issue('format', 'format', `expected "${FIGURE_LOOK_FORMAT}"`);

  const seedText = seedOf(value);
  const seed = seedToInt(seedText);
  const rawPerson: Bag = isBag(input.person) ? input.person : {};
  const age: FigureAge = AGES.includes(rawPerson.age as FigureAge)
    ? (rawPerson.age as FigureAge)
    : 'adult';
  if (isBag(input.person) && rawPerson.age !== age) issue('age', 'person.age', 'unknown age');
  // Every replacement comes from one look drawn from the input's own hash.
  let fallbackLook: FigureLook | undefined;
  const fallback = (): FigureLook => {
    fallbackLook ??= randomFigureLook(seedText, { catalog, age });
    return fallbackLook;
  };

  // Catalogue tag.
  let tag = catalogTag(catalog);
  if (typeof input.catalog === 'string') {
    const at = input.catalog.lastIndexOf('@');
    const id = at > 0 ? input.catalog.slice(0, at) : input.catalog;
    const revision = at > 0 ? Number(input.catalog.slice(at + 1)) : Number.NaN;
    if (id !== catalog.id)
      issue('other-catalog', 'catalog', `made with "${input.catalog}", read as "${tag}"`);
    else if (Number.isFinite(revision) && revision > catalog.revision) {
      issue(
        'newer-catalog',
        'catalog',
        `made with revision ${revision}, newer than ${catalog.revision}`,
      );
      tag = input.catalog;
    }
  }

  // Person.
  const person: FigureLookPerson = { ...fallback().person, age };
  for (const choice of FIGURE_LOOK_PERSON_CHOICES) {
    const category = findCategory(catalog, choice);
    if (category === undefined) continue;
    const resolved = resolveId(catalog, category, rawPerson[choice]);
    if (resolved === undefined) {
      if (isBag(input.person))
        issue(
          'unknown-option',
          `person.${choice}`,
          `unknown ${choice} "${String(rawPerson[choice])}"`,
        );
    } else {
      if (resolved.aliased)
        issue(
          'aliased-option',
          `person.${choice}`,
          `"${String(rawPerson[choice])}" is now "${resolved.id}"`,
        );
      person[choice] = resolved.id;
    }
  }
  for (const color of ['skin', 'hairColor', 'eyes'] as const) {
    const hex = normalizeHex(rawPerson[color]);
    if (hex === undefined) {
      if (isBag(input.person)) issue('color', `person.${color}`, 'not a #rrggbb colour');
      person[color] = drawSwatch(catalog, FIGURE_LOOK_PERSON_PALETTES[color], seed, color, age).hex;
    } else person[color] = hex;
  }
  const range = catalog.heights[age];
  const height = rawPerson.height;
  if (typeof height === 'number' && Number.isFinite(height)) {
    person.height = Math.min(range.max, Math.max(range.min, height));
    if (person.height !== height)
      issue('height', 'person.height', `clamped to ${range.min}–${range.max} m`);
  } else if (isBag(input.person)) issue('height', 'person.height', 'not a number');

  // Outfit.
  const rawOutfit: Bag = isBag(input.outfit) ? input.outfit : {};
  const item = (
    category: FigureLookCategory,
    raw: unknown,
    path: string,
  ): FigureLookItem | undefined => {
    const bag: Bag = isBag(raw) ? raw : {};
    const resolved = resolveId(catalog, category, bag.id);
    if (resolved === undefined) {
      if (raw !== undefined)
        issue('unknown-option', path, `unknown ${category.id} "${String(bag.id)}"`);
      return undefined;
    }
    if (resolved.aliased)
      issue('aliased-option', path, `"${String(bag.id)}" is now "${resolved.id}"`);
    const option = category.options.find((o) => o.id === resolved.id);
    const rawColors: Bag = isBag(bag.colors) ? bag.colors : {};
    const slots: readonly FigureLookColorSlot[] = option?.colors ?? [];
    const drawn = drawItemColors(catalog, category.id, slots, seed, age);
    const colors: FigureLookItemColors = {};
    for (const slot of slots) {
      const hex = normalizeHex(rawColors[slot]);
      if (hex === undefined && raw !== undefined)
        issue('color', `${path}.colors.${slot}`, 'not a #rrggbb colour');
      colors[slot] = hex ?? (drawn[slot] as string);
    }
    return { id: resolved.id, colors };
  };
  const outfit = { ...fallback().outfit, accessories: {} as FigureLookAccessories };
  for (const garment of FIGURE_LOOK_GARMENTS) {
    const category = findCategory(catalog, garment);
    if (category === undefined) continue;
    const repaired = item(category, rawOutfit[garment], `outfit.${garment}`);
    if (repaired !== undefined) outfit[garment] = repaired;
    else if (isBag(input.outfit) && rawOutfit[garment] === undefined)
      issue('unknown-option', `outfit.${garment}`, `no ${garment}`);
  }
  const rawAccessories: Bag = isBag(rawOutfit.accessories) ? rawOutfit.accessories : {};
  for (const [slot, raw] of Object.entries(rawAccessories)) {
    if (raw === undefined) continue;
    const category = (FIGURE_LOOK_SLOTS as readonly string[]).includes(slot)
      ? findCategory(catalog, slot as (typeof FIGURE_LOOK_SLOTS)[number])
      : undefined;
    if (category === undefined) {
      issue('slot', `outfit.accessories.${slot}`, `no accessory slot "${slot}"`);
      continue;
    }
    const repaired = item(category, raw, `outfit.accessories.${slot}`);
    if (repaired !== undefined)
      outfit.accessories[category.id as keyof FigureLookAccessories] = repaired;
  }
  // A look object without an outfit (or without a person) keeps the fallback's half.
  const look: FigureLook = { format: FIGURE_LOOK_FORMAT, catalog: tag, person, outfit };
  return { look, changed: !sameJson(value, look), issues };
}
