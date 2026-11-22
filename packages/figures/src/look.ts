/**
 * @bendyline/molen-figures/look — figure looks: a person and their outfit chosen from a
 * catalogue of named options (molen/figure-look@1), random looks from a seed, repair of saved
 * looks, and the figure descriptor of a look. Pure data: no three.js, no zod, no DOM and no
 * kernel runtime, so a host page can create a player's look before it loads any 3D.
 *
 * ```ts
 * import { figureFromLook, normalizeFigureLook, randomFigureLook } from '@bendyline/molen-figures/look';
 * const look = saved ? normalizeFigureLook(saved).look : randomFigureLook(crypto.randomUUID());
 * view.walker.setAvatar({ figure: figureFromLook(look) });
 * ```
 */

export type {
  FigureAge,
  FigureDescriptor,
  FigureFeatures,
  FigurePalette,
  FigureProportions,
} from './kernel/types';
export { DEFAULT_FIGURE_LOOK_CATALOG, validateFigureLookCatalog } from './look/catalog';
export { figureLookSuggested } from './look/draw';
export type {
  FigureFromLookOptions,
  FigureLookColorTarget,
  FigureLookEditOptions,
  FigureLookOptionEntry,
  FigureLookOptionsQuery,
} from './look/figure';
export {
  figureFromLook,
  figureLookCategory,
  figureLookKey,
  figureLookOptions,
  figureLookReplaced,
  setFigureLookColor,
  setFigureLookHeight,
  setFigureLookOption,
} from './look/figure';
export type { NormalizedFigureLook, NormalizeFigureLookOptions } from './look/normalize';
export { normalizeFigureLook, normalizeHex } from './look/normalize';
export type { FigureLookPart, FigureLookPoolOptions, RandomFigureLookOptions } from './look/random';
export { catalogTag, figureLookPool, randomFigureLook } from './look/random';
export type {
  FigureLook,
  FigureLookAccessories,
  FigureLookCatalog,
  FigureLookCategory,
  FigureLookCategoryId,
  FigureLookColorSlot,
  FigureLookFraming,
  FigureLookGarment,
  FigureLookHeightRange,
  FigureLookIssue,
  FigureLookItem,
  FigureLookItemColors,
  FigureLookOption,
  FigureLookOutfit,
  FigureLookPaletteId,
  FigureLookPatch,
  FigureLookPerson,
  FigureLookPersonChoice,
  FigureLookPersonColor,
  FigureLookSlot,
  FigureLookSteer,
  FigureLookSteerWeights,
  FigureLookSwatch,
} from './look/types';
export {
  FIGURE_LOOK_FORMAT,
  FIGURE_LOOK_GARMENTS,
  FIGURE_LOOK_PERSON_CHOICES,
  FIGURE_LOOK_PERSON_PALETTES,
  FIGURE_LOOK_SLOTS,
  FIGURE_LOOK_STEERS,
} from './look/types';
