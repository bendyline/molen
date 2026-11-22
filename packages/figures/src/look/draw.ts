/**
 * Seeded, stateless draws over a catalogue: each named stream of a seed is an independent
 * uniform (the figures `unit01` scheme), so adding options to one category never changes what
 * any other category draws for the same seed.
 */

import { seedToInt } from '@bendyline/molen-kernel/determinism';
import { unit01 } from '../kernel/seed';
import type { FigureAge } from '../kernel/types';
import type {
  FigureLookCatalog,
  FigureLookCategory,
  FigureLookCategoryId,
  FigureLookOption,
  FigureLookPaletteId,
  FigureLookSteer,
  FigureLookSwatch,
} from './types';

/** A uniform in [0, 1) for one named stream of a seed. */
export function drawUnit(seed: number, stream: string): number {
  return unit01(seed, seedToInt(`molen/figure-look:${stream}`));
}

/** Pick by weight; when every weight is 0 the pick is uniform. */
export function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, u: number): T {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (!(total > 0)) return items[Math.min(items.length - 1, Math.floor(u * items.length))] as T;
  let target = u * total;
  for (const item of items) {
    const w = Math.max(0, weight(item));
    if (target < w) return item;
    target -= w;
  }
  return items[items.length - 1] as T;
}

function allowed(ages: readonly FigureAge[] | undefined, age: FigureAge): boolean {
  return ages === undefined || ages.includes(age);
}

/** The random weight of an option under a steer (the base weight in neutral categories). */
export function optionWeight(
  category: FigureLookCategory,
  option: FigureLookOption,
  steer: FigureLookSteer,
): number {
  const base = option.weight ?? 1;
  if (category.neutral || steer === 'unspecified') return base;
  return base * (option.steer?.[steer] ?? 1);
}

/** Whether a steer suggests an option (neutral categories suggest everything). */
export function figureLookSuggested(
  category: FigureLookCategory,
  option: FigureLookOption,
  steer: FigureLookSteer,
): boolean {
  if (category.neutral || steer === 'unspecified') return true;
  return (option.steer?.[steer] ?? 1) > 0;
}

/** Draw one option of a category for a seed. */
export function drawOption(
  category: FigureLookCategory,
  seed: number,
  steer: FigureLookSteer,
  age: FigureAge,
): FigureLookOption {
  const fits = category.options.filter((option) => allowed(option.ages, age));
  const pool = fits.length > 0 ? fits : category.options;
  return pickWeighted(
    pool,
    (option) => optionWeight(category, option, steer),
    drawUnit(seed, category.id),
  );
}

/** Draw one swatch of a palette for a seed and stream. */
export function drawSwatch(
  catalog: FigureLookCatalog,
  palette: FigureLookPaletteId,
  seed: number,
  stream: string,
  age: FigureAge,
): FigureLookSwatch {
  const swatches = catalog.palettes[palette];
  const fits = swatches.filter((swatch) => allowed(swatch.ages, age));
  const pool = fits.length > 0 ? fits : swatches;
  return pickWeighted(pool, (swatch) => swatch.weight ?? 1, drawUnit(seed, stream));
}

/** A category of a catalogue, or undefined. */
export function findCategory(
  catalog: FigureLookCatalog,
  id: FigureLookCategoryId,
): FigureLookCategory | undefined {
  return catalog.categories.find((category) => category.id === id);
}
