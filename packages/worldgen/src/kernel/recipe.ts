/**
 * Recipe resolution: sample every look choice of one building from its style and seed. Each
 * aspect (massing, roof, materials, palettes, props) draws from its own named stream, so editing
 * one section of a style never reshuffles another.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type {
  ArchFacadeDetails,
  ArchLodFeature,
  ArchMaterialSpec,
  ArchPalette,
  ArchPropAnchor,
  ArchRoofType,
  ArchStyleDoc,
} from './archstyle-types';
import type { FacadeBands, FacadeWindows } from './facade';
import type { FootprintAnalysis } from './footprint';
import { type BuildingMetrics, matchesWhen } from './rules';
import { parseColor, parseMaterialRef } from './schema-common';
import {
  aspectSeed,
  buildingSeedString,
  type PackIdentity,
  pickWeighted,
  sampleRange,
  unit01,
} from './seed';
import type { BuildingRequest, RGB } from './types';

/** The one palette reference every flat-colored part collapses onto (color lives in vertices). */
export const WHITE_REF: string = 'palette:#ffffff';

export interface RecipeOptions {
  /** Replace every textured material by vertex colors (draw-call budgets). */
  collapseMaterials?: boolean;
}

export interface RecipePart {
  /** Material reference; palette refs are baked into `color` and become WHITE_REF. */
  ref: string;
  color: RGB;
  tint: 'multiply' | 'none';
  uv: 'meters' | 'cell';
  uvScale: [number, number] | undefined;
  offsetU: number;
  offsetV: number;
  mirror: boolean;
}

export interface RecipeRoof {
  type: ArchRoofType;
  /** Rise per meter of run. */
  rise: number;
  lowerRise: number;
  overhang: number;
  ridge: 'long-axis' | 'short-axis';
  perWing: boolean;
  complexFootprint: 'flat' | 'wings';
  parapet?: { height: number; thickness: number };
  shedDirection: 1 | -1;
  shedDownhill: boolean;
  dormers?: { perRidgeMeters: number; style: 'gable' | 'shed' };
}

export interface RecipeProp {
  id: string;
  model: string;
  anchor: ArchPropAnchor;
  count: number;
  scale: number;
  roof?: ArchRoofType[];
  spacing: number;
  margin: number;
  yaw: 'align-wall' | 'random' | 'fixed';
  lodTier: number;
  /** Instance tint from `tintPalette`; white without one. */
  color: RGB;
}

export interface BuildingRecipe {
  styleId: string;
  styleVersion: number;
  seed: string;
  floors: number;
  floorHeight: number;
  groundFloorHeight: number;
  /** Wall height above the platform, meters. */
  totalHeight: number;
  heightSource: 'height' | 'levels' | 'fallback';
  minHeight: number;
  groundFit: 'platform-average' | 'platform-max' | 'platform-min';
  foundationHeight: number;
  exposeFoundation: boolean;
  wingSplit: boolean;
  maxWingSpan: number;
  minWingArea: number;
  secondaryHeightScale: number;
  roof: RecipeRoof;
  bayWidth: number;
  cornerMargin: number;
  parts: {
    wall: RecipePart;
    roof: RecipePart;
    trim: RecipePart;
    foundation: RecipePart;
    window: RecipePart;
  };
  facade: {
    windows: FacadeWindows | undefined;
    bands: FacadeBands | undefined;
    details?: ArchFacadeDetails;
  };
  lodKeep: ArchLodFeature[];
  /** Beyond the last declared tier: render as a tinted box. */
  box: boolean;
  props: RecipeProp[];
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

function rgbToHsl(rgb: RGB): [number, number, number] {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hueToChannel(p: number, q: number, t: number): number {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s <= 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToChannel(p, q, h + 1 / 3), hueToChannel(p, q, h), hueToChannel(p, q, h - 1 / 3)];
}

/** Weighted palette entry plus HSL jitter, all from one stream. */
export function samplePalette(palette: ArchPalette, seed: number): RGB {
  const index = pickWeighted(
    unit01(seed, 0),
    palette.entries.map((entry) => entry.weight),
  );
  const entry = palette.entries[index] ?? palette.entries[0];
  if (entry === undefined) return [1, 1, 1];
  const [h, s, l] = rgbToHsl(parseColor(entry.color));
  const jitter = palette.jitter;
  const hue = (((h + (unit01(seed, 1) * 2 - 1) * jitter.hue) % 1) + 1) % 1;
  const saturation = clamp(s + (unit01(seed, 2) * 2 - 1) * jitter.saturation, 0, 1);
  const lightness = clamp(l + (unit01(seed, 3) * 2 - 1) * jitter.lightness, 0, 1);
  return hslToRgb(hue, saturation, lightness);
}

/** Metrics a rule engine evaluates for one request + analysis. */
export function buildingMetrics(
  request: BuildingRequest,
  analysis: FootprintAnalysis,
): BuildingMetrics {
  return {
    labels: request.labels,
    ...(request.context !== undefined ? { context: request.context } : {}),
    areaM2: analysis.area,
    perimeterM: analysis.perimeter,
    vertexCount: analysis.vertexCount,
    hasHoles: analysis.holes.length > 0,
    elongation: analysis.elongation,
    rectangularity: analysis.rectangularity,
    ...(request.height !== undefined ? { height: request.height } : {}),
    ...(request.levels !== undefined ? { levels: request.levels } : {}),
    wings: analysis.wings.length,
  };
}

function resolvePart(
  spec: ArchMaterialSpec,
  style: ArchStyleDoc,
  seed: string,
  part: string,
  collapse: boolean,
): RecipePart {
  const materialSeed = aspectSeed(seed, `material:${part}`);
  const choice =
    spec.choices[
      pickWeighted(
        unit01(materialSeed, 0),
        spec.choices.map((c) => c.weight),
      )
    ];
  const ref = choice?.ref ?? spec.choices[0]?.ref ?? 'palette:#cccccc';
  const palette = spec.palette !== undefined ? style.palettes[spec.palette] : undefined;
  const color: RGB =
    spec.tint === 'multiply' && palette !== undefined
      ? samplePalette(palette, aspectSeed(seed, `palette:${spec.palette}`))
      : [1, 1, 1];
  const scaleU = spec.uvScale?.[0] ?? 4;
  let offsetU = 0;
  if (spec.uvOffset === 'meters') offsetU = unit01(materialSeed, 1) * scaleU;
  else if (spec.uvOffset === 'cell') offsetU = Math.floor(unit01(materialSeed, 1) * 4);
  // Flat colors never need their own mesh group: bake the hex into the vertex tint.
  const parsed = parseMaterialRef(ref);
  let finalRef = ref;
  let finalColor = color;
  if (parsed?.kind === 'palette') {
    const hex = parseColor(parsed.ref);
    finalColor = [color[0] * hex[0], color[1] * hex[1], color[2] * hex[2]];
    finalRef = WHITE_REF;
  } else if (collapse) {
    finalRef = WHITE_REF;
    // Untinted glass gets its color from the texture; white would look like filled-in windows.
    if (part === 'window') finalColor = [0.16 * color[0], 0.19 * color[1], 0.23 * color[2]];
  }
  return {
    ref: finalRef,
    color: finalColor,
    tint: spec.tint,
    uv: spec.uv,
    uvScale: spec.uvScale !== undefined ? [spec.uvScale[0], spec.uvScale[1]] : undefined,
    offsetU,
    offsetV: 0,
    mirror: spec.uvMirror && unit01(materialSeed, 2) < 0.5,
  };
}

function degreesToRise(degrees: number): number {
  return dmath.tan((clamp(degrees, 5, 75) * dmath.PI) / 180);
}

const DEFAULT_WINDOW_PART: RecipePart = {
  ref: WHITE_REF,
  color: [0.16, 0.19, 0.23],
  tint: 'none',
  uv: 'cell',
  uvScale: undefined,
  offsetU: 0,
  offsetV: 0,
  mirror: false,
};

export function resolveBuildingRecipe(
  style: ArchStyleDoc,
  pack: PackIdentity,
  request: BuildingRequest,
  analysis: FootprintAnalysis,
  tier: number,
  options: RecipeOptions = {},
): BuildingRecipe {
  const collapse = options.collapseMaterials === true;
  const seed = buildingSeedString(pack, { id: style.id, version: style.version }, request.identity);
  const metrics = buildingMetrics(request, analysis);
  const massingSeed = aspectSeed(seed, 'massing');
  const floorHeight = sampleRange(style.massing.floorHeight, unit01(massingSeed, 0));
  const groundFloorHeight =
    style.massing.groundFloorHeight !== undefined
      ? sampleRange(style.massing.groundFloorHeight, unit01(massingSeed, 1))
      : floorHeight;
  const minHeight = style.massing.respectMinHeight ? Math.max(0, request.minHeight ?? 0) : 0;
  let floors: number;
  let totalHeight: number;
  let heightSource: BuildingRecipe['heightSource'];
  if (request.height !== undefined) {
    totalHeight = Math.max(0.1, request.height - minHeight);
    floors =
      request.levels !== undefined
        ? Math.max(1, Math.round(request.levels))
        : Math.max(1, 1 + Math.round((totalHeight - groundFloorHeight) / floorHeight));
    heightSource = 'height';
  } else if (request.levels !== undefined) {
    floors = Math.max(1, Math.round(request.levels));
    totalHeight = groundFloorHeight + (floors - 1) * floorHeight;
    heightSource = 'levels';
  } else {
    heightSource = 'fallback';
    const rule = style.massing.heightFallback.find((entry) => matchesWhen(entry.when, metrics));
    if (rule?.height !== undefined) {
      totalHeight = clamp(sampleRange(rule.height, unit01(massingSeed, 2)), 2.2, 600);
      floors = Math.max(1, 1 + Math.round((totalHeight - groundFloorHeight) / floorHeight));
    } else {
      const levels = rule?.levels ?? { min: 1, max: 1 };
      floors = Math.max(1, Math.round(sampleRange(levels, unit01(massingSeed, 2))));
      totalHeight = groundFloorHeight + (floors - 1) * floorHeight;
    }
  }
  const foundationHeight = sampleRange(style.massing.foundation.height, unit01(massingSeed, 3));
  const secondaryHeightScale = clamp(
    sampleRange(style.massing.wings.secondaryHeightScale, unit01(massingSeed, 4)),
    0.1,
    1,
  );

  const roofSeed = aspectSeed(seed, 'roof');
  const widest = analysis.wings.reduce(
    (best, wing) => Math.max(best, Math.min(wing.u1 - wing.u0, wing.v1 - wing.v0)),
    analysis.rectilinear ? 0 : Math.min(analysis.width, analysis.depth),
  );
  const pitchedAllowed = widest <= style.massing.wings.maxWingSpan;
  // Roof rules see resolved floors, including height-derived and fallback estimates.
  const roofMetrics: BuildingMetrics = {
    ...metrics,
    levels: floors,
  };
  const eligible = style.roof.choices.filter(
    (choice) =>
      choice.weight > 0 &&
      (choice.type === 'flat' || pitchedAllowed) &&
      matchesWhen(choice.when, roofMetrics),
  );
  const choice =
    eligible[
      pickWeighted(
        unit01(roofSeed, 0),
        eligible.map((entry) => entry.weight),
      )
    ] ?? style.roof.choices.find((entry) => entry.type === 'flat');
  const type: ArchRoofType = choice?.type ?? 'flat';
  const rise =
    choice?.pitchDeg !== undefined
      ? degreesToRise(sampleRange(choice.pitchDeg, unit01(roofSeed, 1)))
      : 0;
  const lowerRise =
    choice?.lowerPitchDeg !== undefined
      ? degreesToRise(sampleRange(choice.lowerPitchDeg, unit01(roofSeed, 2)))
      : Math.max(rise * 2.4, 1.2);
  const overhang = sampleRange(choice?.overhang ?? style.roof.overhang, unit01(roofSeed, 3));
  const parapet =
    choice?.parapet !== undefined
      ? {
          height: sampleRange(choice.parapet.height, unit01(roofSeed, 4)),
          thickness: choice.parapet.thickness,
        }
      : undefined;
  const roof: RecipeRoof = {
    type,
    rise,
    lowerRise,
    overhang,
    ridge: choice?.ridge ?? style.roof.ridge,
    perWing: style.roof.perWing,
    complexFootprint: style.roof.complexFootprint,
    ...(parapet !== undefined ? { parapet } : {}),
    shedDirection: unit01(roofSeed, 5) < 0.5 ? 1 : -1,
    shedDownhill: choice?.shedDirection === 'downhill',
  };
  const dormers = style.roof.features?.dormers;
  if (
    dormers !== undefined &&
    matchesWhen(dormers.when, roofMetrics) &&
    unit01(aspectSeed(seed, 'roof:dormers'), 0) < dormers.probability
  )
    roof.dormers = { perRidgeMeters: dormers.perRidgeMeters, style: dormers.style };

  const facadeSeed = aspectSeed(seed, 'facade');
  const bayWidth = sampleRange(style.facade.bays.width, unit01(facadeSeed, 0));
  const windowSpec = style.facade.windows;
  const windows: FacadeWindows | undefined =
    windowSpec.style === 'none' && windowSpec.groundFloor !== 'storefront'
      ? undefined
      : {
          style: windowSpec.style,
          width: sampleRange(windowSpec.width, unit01(facadeSeed, 1)),
          height: sampleRange(windowSpec.height, unit01(facadeSeed, 2)),
          sill: sampleRange(windowSpec.sill, unit01(facadeSeed, 3)),
          probabilityPerBay: windowSpec.probabilityPerBay,
          groundFloor: windowSpec.groundFloor,
        };
  const bandSpec = style.facade.bands;
  const baseHeight = sampleRange(bandSpec.base.height, unit01(facadeSeed, 4));
  const corniceHeight = bandSpec.cornice?.height ?? 0;
  const bands: FacadeBands | undefined =
    baseHeight > 0 || bandSpec.floorLines || corniceHeight > 0
      ? { baseHeight, floorLines: bandSpec.floorLines, corniceHeight }
      : undefined;

  const parts: BuildingRecipe['parts'] = {
    wall: resolvePart(style.materials.wall, style, seed, 'wall', collapse),
    roof: resolvePart(style.materials.roof, style, seed, 'roof', collapse),
    trim: resolvePart(style.materials.trim, style, seed, 'trim', collapse),
    foundation: resolvePart(style.materials.foundation, style, seed, 'foundation', collapse),
    window:
      style.materials.window !== undefined
        ? resolvePart(style.materials.window, style, seed, 'window', collapse)
        : DEFAULT_WINDOW_PART,
  };

  for (const slot of ['wall', 'trim'] as const) {
    const color = request.appearance?.[slot];
    if (color !== undefined) parts[slot] = { ...parts[slot], color: parseColor(color) };
  }

  const tiers = style.lod.tiers;
  const lastTier = tiers[tiers.length - 1];
  const activeTier = tiers.filter((entry) => entry.minTier <= tier).at(-1) ?? tiers[0];
  const box = lastTier !== undefined && tier > lastTier.minTier;
  const lodKeep = activeTier?.keep ?? [];

  const props: RecipeProp[] = [];
  const metricsWithWings: BuildingMetrics = { ...metrics, wings: analysis.wings.length };
  for (const prop of style.props) {
    const propSeed = aspectSeed(seed, `props:${prop.id}`);
    if (unit01(propSeed, 0) >= prop.probability) continue;
    if (!matchesWhen(prop.when, metricsWithWings)) continue;
    if (prop.roof !== undefined && !prop.roof.includes(type)) continue;
    const count =
      prop.perAreaM2 !== undefined
        ? clamp(Math.round(analysis.area / prop.perAreaM2), prop.count.min, prop.count.max)
        : Math.round(sampleRange(prop.count, unit01(propSeed, 1)));
    if (count <= 0) continue;
    const tintPalette =
      prop.tintPalette !== undefined ? style.palettes[prop.tintPalette] : undefined;
    const color: RGB =
      tintPalette !== undefined
        ? samplePalette(tintPalette, aspectSeed(seed, `palette:${prop.tintPalette}`))
        : [1, 1, 1];
    props.push({
      id: prop.id,
      model: prop.model,
      anchor: prop.anchor,
      count,
      scale: sampleRange(prop.scale, unit01(propSeed, 2)),
      ...(prop.roof !== undefined ? { roof: prop.roof } : {}),
      spacing: prop.spacing,
      margin: prop.margin,
      yaw: prop.yaw,
      lodTier: prop.lodTier,
      color,
    });
  }

  return {
    styleId: style.id,
    styleVersion: style.version,
    seed,
    floors,
    floorHeight,
    groundFloorHeight,
    totalHeight,
    heightSource,
    minHeight,
    groundFit: style.massing.groundFit,
    foundationHeight,
    exposeFoundation: style.massing.foundation.exposeOnSlope,
    wingSplit: style.massing.wings.split === 'rectangles',
    maxWingSpan: style.massing.wings.maxWingSpan,
    minWingArea: style.massing.wings.minWingArea,
    secondaryHeightScale,
    roof,
    bayWidth,
    cornerMargin: style.facade.bays.cornerMargin,
    parts,
    facade: { windows, bands, ...(style.facade.details ? { details: style.facade.details } : {}) },
    lodKeep: [...lodKeep],
    box,
    props,
  };
}

/** Props of a recipe whose tier is still visible at `tier`. */
export function visibleProps(recipe: BuildingRecipe, tier: number): RecipeProp[] {
  if (!recipe.lodKeep.includes('props')) return [];
  return recipe.props.filter((prop) => prop.lodTier >= tier);
}
