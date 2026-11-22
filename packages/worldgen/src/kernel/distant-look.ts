/**
 * How a generated building reads from far off: the mean color of its walls (the wall material and
 * its window glass, weighted by how much of the facade the windows cover) and of its roof. Distant
 * stand-ins draw these, so a tower that is mostly blue glass up close does not become a pale box,
 * and a dark membrane roof does not turn white, when it is too far away for its own facade.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { ArchStyleDoc } from './archstyle-types';
import { analyzeFootprint, DEFAULT_FOOTPRINT_OPTIONS, type FootprintAnalysis } from './footprint';
import { type BuildingRecipe, type RecipePart, resolveBuildingRecipe, WHITE_REF } from './recipe';
import type { PackIdentity } from './seed';
import type { BuildingRequest, RGB } from './types';

/**
 * Mean linear base color of the shared tinted material graphs (siding, shingle, brick, render,
 * concrete, membrane: 0.52–0.77, most near 0.65). A flat stand-in for a textured surface
 * multiplies by it, so a building keeps its brightness when its textures finish loading or its
 * level of detail changes; untinted it renders about 1.5 times brighter than up close.
 */
export const TEXTURED_SURFACE_MEAN = 0.65;

const SHARED_MATERIAL_PREFIX = 'matgraph:molen.worldgen.material.';

/**
 * Mean linear base color of each shared material graph (`content/worldgen/materials`), measured
 * from its bake at its authored size. Tints multiply these, so a surface's mean is its tint times
 * this. A graph that is reworked or recolored needs its row measured again; the materials test
 * bakes each one and fails when a row no longer matches its graph.
 */
export const SHARED_MATERIAL_MEANS: Readonly<Record<string, readonly [number, number, number]>> = {
  bamboo: [0.63, 0.6, 0.44],
  brick: [0.62, 0.55, 0.51],
  brick_flemish: [0.71, 0.64, 0.57],
  brick_glazed: [0.83, 0.83, 0.81],
  brick_longformat: [0.72, 0.65, 0.56],
  brick_stack: [0.73, 0.66, 0.59],
  clay_fired: [0.91, 0.91, 0.91],
  concrete_boardformed: [0.71, 0.71, 0.66],
  concrete_panel: [0.67, 0.67, 0.66],
  concrete_plain: [0.71, 0.71, 0.68],
  earth_adobe: [0.68, 0.58, 0.41],
  earth_rammed: [0.73, 0.64, 0.47],
  etfe_film: [0.97, 0.97, 0.97],
  fabric_canvas: [0.92, 0.92, 0.92],
  glass_frit_triangular: [0.84, 0.85, 0.85],
  gravel: [0.69, 0.68, 0.63],
  membrane: [0.4, 0.4, 0.39],
  metal_asanoha: [0.85, 0.85, 0.85],
  metal_bronze_cast: [0.8, 0.81, 0.77],
  metal_copper: [0.64, 0.68, 0.62],
  metal_corrugated: [0.68, 0.71, 0.71],
  metal_expanded_diamond: [0.96, 0.96, 0.96],
  metal_painted: [0.91, 0.91, 0.91],
  metal_perforated_round: [0.96, 0.96, 0.96],
  metal_perforated_round_open: [0.96, 0.96, 0.96],
  metal_perforated_square: [0.96, 0.96, 0.96],
  metal_rosette_screen: [0.85, 0.85, 0.85],
  metal_stainless: [0.82, 0.82, 0.82],
  metal_stainless_beadblasted: [0.83, 0.83, 0.83],
  metal_stainless_polished: [0.88, 0.88, 0.88],
  metal_standing_seam: [0.72, 0.75, 0.76],
  plaster_lime: [0.86, 0.83, 0.73],
  plaster_tadelakt: [0.82, 0.77, 0.66],
  shingle_asphalt: [0.61, 0.61, 0.61],
  shingle_cedar: [0.65, 0.6, 0.48],
  siding_lap: [0.71, 0.71, 0.71],
  siding_shingle: [0.52, 0.52, 0.52],
  slate: [0.59, 0.63, 0.65],
  stone: [0.53, 0.5, 0.46],
  stone_ashlar: [0.69, 0.66, 0.6],
  stone_basalt: [0.54, 0.56, 0.54],
  stone_basalt_raw: [0.91, 0.91, 0.91],
  stone_checker_fine: [0.57, 0.6, 0.57],
  stone_drywall: [0.65, 0.63, 0.56],
  stone_granite: [0.7, 0.7, 0.7],
  stone_limestone: [0.75, 0.71, 0.62],
  stone_limestone_raw: [0.89, 0.89, 0.89],
  stone_limestone_weathered: [0.45, 0.45, 0.38],
  stone_marble: [0.92, 0.92, 0.92],
  stone_sandstone: [0.69, 0.6, 0.47],
  stone_sandstone_raw: [0.79, 0.79, 0.79],
  stone_travertine: [0.91, 0.91, 0.91],
  storefront: [0.08, 0.13, 0.18],
  stucco: [0.81, 0.77, 0.69],
  terracotta_screen: [0.63, 0.55, 0.45],
  thatch: [0.57, 0.52, 0.38],
  tile_ceramic: [0.56, 0.55, 0.53],
  tile_flat: [0.75, 0.68, 0.59],
  tile_glazed: [0.67, 0.7, 0.66],
  tile_mosaic: [0.73, 0.76, 0.71],
  window_grid: [0.13, 0.17, 0.22],
  window_punched: [0.32, 0.34, 0.36],
  window_sliding: [0.25, 0.28, 0.31],
  wood_board_batten: [0.68, 0.64, 0.58],
  wood_log: [0.64, 0.57, 0.44],
  wood_painted_lap: [0.91, 0.91, 0.91],
  wood_painted_shingle: [0.84, 0.84, 0.84],
  wood_plain: [0.82, 0.82, 0.82],
  wood_shou_sugi_ban: [0.63, 0.63, 0.59],
  wood_vertical: [0.72, 0.69, 0.6],
  wood_weatherboard: [0.61, 0.61, 0.56],
};

/** A building's mean colors seen from afar, sRGB-encoded in 0..1 like every procedural color. */
export interface DistantLook {
  /** Walls with their windows: what a stand-in's sides show. */
  wall: RGB;
  /** The roof, or the flat roof's covering. */
  roof: RGB;
  /** The recipe's height above ground, metres: the style's guess where the request named none. */
  height?: number;
  /** Whether the roof is pitched (a stand-in then keeps a gabled roof). */
  pitched?: boolean;
}

/** Roofs whose stand-in is the gabled box: from above, roofs are what a neighbourhood is. */
export const PITCHED_STAND_IN: ReadonlySet<string> = new Set([
  'gable',
  'hip',
  'pyramid',
  'gambrel',
  'mansard',
]);

function decode(c: number): number {
  return c <= 0.04045 ? c / 12.92 : dmath.pow((c + 0.055) / 1.055, 2.4);
}

function encode(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * dmath.pow(c, 1 / 2.4) - 0.055;
}

/** Mean linear color of a material reference's texture; neutral when it is not a shared graph. */
function textureMean(ref: string): readonly [number, number, number] {
  if (ref.startsWith(SHARED_MATERIAL_PREFIX)) {
    const mean = SHARED_MATERIAL_MEANS[ref.slice(SHARED_MATERIAL_PREFIX.length)];
    if (mean !== undefined) return mean;
  }
  return [TEXTURED_SURFACE_MEAN, TEXTURED_SURFACE_MEAN, TEXTURED_SURFACE_MEAN];
}

/** A part's mean linear color as it renders up close. */
function partMean(part: RecipePart, glass: boolean): [number, number, number] {
  // Flat colors (palette references) are baked into the vertex color and drawn untextured.
  if (part.ref === WHITE_REF)
    return [decode(part.color[0]), decode(part.color[1]), decode(part.color[2])];
  const mean = textureMean(part.ref);
  // Textured glass draws its texture as is; its vertex color is the flat levels' glass tone.
  if (glass && part.tint !== 'multiply') return [mean[0], mean[1], mean[2]];
  return [
    mean[0] * decode(part.color[0]),
    mean[1] * decode(part.color[1]),
    mean[2] * decode(part.color[2]),
  ];
}

/**
 * Share of a typical upper floor's facade that is window, from the recipe's bays, floors and
 * window layout (as `facade.ts` lays them out): grid facades are mostly glass, punched ones
 * mostly wall. Corner margins and the ground floor are left out.
 */
export function glazingFraction(recipe: BuildingRecipe): number {
  const windows = recipe.facade.windows;
  if (windows === undefined || windows.style === 'none') return 0;
  const bay = recipe.bayWidth;
  const floor = recipe.floorHeight;
  if (!(bay > 0) || !(floor > 0)) return 0;
  let width: number;
  let height: number;
  let share = windows.probabilityPerBay;
  if (windows.style === 'grid') {
    width = bay - 0.3;
    height = floor - 0.55;
  } else if (windows.style === 'ribbon') {
    width = bay;
    height = Math.min(windows.height, floor - windows.sill - 0.25);
    share = Math.max(share, 0.5);
  } else {
    width = Math.min(windows.width, bay - 0.4);
    height = Math.min(windows.height, floor - windows.sill - 0.25);
  }
  if (width < 0.4 || height < 0.4) return 0;
  return Math.min(1, Math.max(0, (width / bay) * (height / floor) * share));
}

/** The look of a resolved recipe (see {@link DistantLook}). */
export function recipeDistantLook(recipe: BuildingRecipe): DistantLook {
  const glazing = glazingFraction(recipe);
  const wall = partMean(recipe.parts.wall, false);
  const glass = partMean(recipe.parts.window, true);
  const roof = partMean(recipe.parts.roof, false);
  const mix = (i: 0 | 1 | 2): number => encode((1 - glazing) * wall[i] + glazing * glass[i]);
  return {
    wall: [mix(0), mix(1), mix(2)],
    roof: [encode(roof[0]), encode(roof[1]), encode(roof[2])],
    height: recipe.minHeight + recipe.totalHeight,
    pitched: PITCHED_STAND_IN.has(recipe.roof.type),
  };
}

/**
 * The look of one building as its style would draw it, without generating it: the same seed,
 * palette picks and window layout as {@link generateBuilding} at full detail.
 */
export function distantBuildingLook(
  style: ArchStyleDoc,
  pack: PackIdentity,
  request: BuildingRequest,
  analysis: FootprintAnalysis = analyzeFootprint(
    request.outline,
    request.holes ?? [],
    DEFAULT_FOOTPRINT_OPTIONS,
  ),
): DistantLook {
  return recipeDistantLook(resolveBuildingRecipe(style, pack, request, analysis, 0));
}

/**
 * A distant look as a tint for a flat material that stands in for textured ones (colored
 * {@link TEXTURED_SURFACE_MEAN}, as box stand-ins are drawn): the color that, multiplied by that
 * mean, shows the look. sRGB-encoded; a very light look may encode above 1.
 */
export function standInTint(color: RGB): RGB {
  return [
    encode(decode(color[0]) / TEXTURED_SURFACE_MEAN),
    encode(decode(color[1]) / TEXTURED_SURFACE_MEAN),
    encode(decode(color[2]) / TEXTURED_SURFACE_MEAN),
  ];
}
