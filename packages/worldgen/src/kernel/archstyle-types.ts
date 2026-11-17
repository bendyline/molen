/**
 * Hand-written contract for a validated (defaults-applied) `molen/archstyle@1` document: how to
 * turn any outline plus metrics plus a seed into a building recipe. The Zod schema in
 * archstyle-schema.ts is the validation engine; keep the two in sync.
 */

import type { LotPlanChoice } from './lot-plans';
import type { SelectionWhen } from './rules';

export interface NumberRange {
  min: number;
  max: number;
}

export type ArchRoofType = 'flat' | 'gable' | 'hip' | 'pyramid' | 'shed' | 'mansard' | 'gambrel';

export const ARCH_ROOF_TYPES: readonly ArchRoofType[] = [
  'flat',
  'gable',
  'hip',
  'pyramid',
  'shed',
  'mansard',
  'gambrel',
];

export type ArchMaterialPart = 'wall' | 'roof' | 'trim' | 'foundation' | 'window';

export type ArchLodFeature =
  | 'roof-shape'
  | 'roof-features'
  | 'facade-texture'
  | 'facade-bands'
  | 'props';

export const ARCH_LOD_FEATURES: readonly ArchLodFeature[] = [
  'roof-shape',
  'roof-features',
  'facade-texture',
  'facade-bands',
  'props',
];

export interface ArchApplicability {
  classes: string[];
  contextClasses?: string[];
  areaMin?: number;
  areaMax?: number;
  notes?: string;
}

export interface ArchHeightRule {
  when?: SelectionWhen;
  levels?: NumberRange;
  height?: NumberRange;
}

export interface ArchMassing {
  floorHeight: NumberRange;
  groundFloorHeight?: NumberRange;
  /** Used only when a request has neither height nor levels; ordered; last rule is a catch-all. */
  heightFallback: ArchHeightRule[];
  groundFit: 'platform-average' | 'platform-max' | 'platform-min';
  foundation: { height: NumberRange; exposeOnSlope: boolean };
  wings: {
    split: 'none' | 'rectangles';
    maxWingSpan: number;
    minWingArea: number;
    secondaryHeightScale: NumberRange;
  };
  setbacks: Array<{ aboveHeight: number; inset: number }>;
  respectMinHeight: boolean;
}

export interface ArchRoofChoice {
  type: ArchRoofType;
  weight: number;
  when?: SelectionWhen;
  pitchDeg?: NumberRange;
  lowerPitchDeg?: NumberRange;
  overhang?: NumberRange;
  ridge?: 'long-axis' | 'short-axis';
  parapet?: { height: NumberRange; thickness: number };
  shedDirection?: 'downhill' | 'random' | 'long-axis';
}

export interface ArchRoofFeatures {
  dormers?: {
    probability: number;
    perRidgeMeters: number;
    style: 'gable' | 'shed';
    when?: SelectionWhen;
  };
}

export interface ArchRoof {
  perWing: boolean;
  ridge: 'long-axis' | 'short-axis';
  overhang: NumberRange;
  complexFootprint: 'flat' | 'wings';
  choices: ArchRoofChoice[];
  /** Roof for footprints the chosen pitched form cannot cover: flat, or slopes up to a deck. */
  fallback: 'flat' | 'hipped';
  /** Ridge of a building with party walls: across the row (`between`) or gable to the street. */
  partyRidge?: 'between' | 'along';
  features?: ArchRoofFeatures;
}

/** Metric facade ornament, fitted to actual bays and omitted when facade-bands is dropped. */
export interface ArchFacadeDetails {
  /** Visual ground entrance when no structural interior opening already supplies one. */
  entrance?: { width: number; height: number; style: 'single' | 'double' | 'service' };
  shutters?: boolean;
  /** Colors shutters and the door leaf are painted, one per building; default the trim darkened. */
  paint?: string[];
  /** Trim boards up each outside wall corner. */
  cornerBoards?: boolean;
  balconies?: { depth: number; railing: 'open' | 'solid'; every: number };
  framing?: { style: 'timber' | 'pilasters'; width: number };
  awnings?: { depth: number };
  veranda?: { depth: number; columns: boolean };
  /** A step in front of the entrance under a small canopy, on a seeded share of buildings. */
  porch?: { probability: number; depth: number; canopy: 'none' | 'flat' | 'pitched' };
}

export interface ArchFacade {
  bays: { width: NumberRange; cornerMargin: number };
  windows: {
    style: 'punched' | 'ribbon' | 'grid' | 'none';
    width: NumberRange;
    height: NumberRange;
    sill: NumberRange;
    probabilityPerBay: number;
    groundFloor: 'same' | 'storefront' | 'none';
  };
  bands: {
    base: { height: NumberRange };
    floorLines: boolean;
    cornice?: { height: number };
  };
  details?: ArchFacadeDetails;
}

export interface ArchMaterialChoice {
  ref: string;
  weight: number;
  /** Key of `palettes` that tints this choice instead of the part palette. */
  palette?: string;
  /** Meters per texture repeat [u, v] for this choice instead of the part scale. */
  uvScale?: [number, number];
}

export interface ArchMaterialSpec {
  choices: ArchMaterialChoice[];
  /** Key of `palettes` used to tint this part. */
  palette?: string;
  tint: 'multiply' | 'none';
  uv: 'meters' | 'cell';
  /** Meters per texture repeat [u, v] when `uv` is `meters`. */
  uvScale?: [number, number];
  uvOffset: 'cell' | 'meters' | 'none';
  uvMirror: boolean;
}

export interface ArchPaletteEntry {
  color: string;
  weight: number;
  name?: string;
}

export interface ArchPalette {
  entries: ArchPaletteEntry[];
  jitter: { hue: number; saturation: number; lightness: number };
}

export type ArchPropAnchor = 'roof-ridge' | 'roof-flat' | 'roof-edge' | 'wall-any' | 'ground-any';

export interface ArchProp {
  id: string;
  model: string;
  anchor: ArchPropAnchor;
  probability: number;
  count: NumberRange;
  perAreaM2?: number;
  when?: SelectionWhen;
  roof?: ArchRoofType[];
  spacing: number;
  margin: number;
  scale: NumberRange;
  yaw: 'align-wall' | 'random' | 'fixed';
  tintPalette?: string;
  lodTier: number;
}

export interface ArchLodTier {
  minTier: number;
  keep: ArchLodFeature[];
}

/**
 * The street pattern of lots a style invents where no building is mapped. Without it a lot is a
 * house in a yard. A world binding reads it; the generator itself never invents a lot.
 */
export interface ArchLots {
  /** Detached lots fill most of their frontage, close to the street. */
  compact?: boolean;
  /** Share of invented blocks built as rows, fronts wall to wall at the street (0..1). */
  rows?: number;
  /** Buildings to each 16 m of a row frontage. */
  units?: { min: number; max: number };
  /** How far a row front stands behind the street's footway, meters. */
  setback?: NumberRange;
  /** Depth of a row building, meters. */
  depth?: NumberRange;
  /** Storeys of a row building. */
  levels?: NumberRange;
  /** Share of row frontages left open (0..1). */
  gap?: number;
}

export interface ArchStyleDoc {
  /** Weighted boundary treatments for inferred residential lots; `none` leaves a yard open. */
  lotFences?: Array<{ kind: 'none' | 'timber' | 'masonry' | 'rail'; weight: number }>;
  /** Weighted resizable plans for vacant lots; never alters a supplied mapped outline. */
  lotPlans?: LotPlanChoice[];
  /** How invented lots are laid out along a street; see {@link ArchLots}. */
  lots?: ArchLots;
  format: 'molen/archstyle@1';
  id: string;
  title: string;
  doc?: string;
  /** Bump to re-roll every building using this style. */
  version: number;
  applicability: ArchApplicability;
  massing: ArchMassing;
  roof: ArchRoof;
  facade: ArchFacade;
  materials: {
    wall: ArchMaterialSpec;
    roof: ArchMaterialSpec;
    /** Replaces `roof` when the style resolves a flat roof (a flat choice or the flat fallback). */
    flatRoof?: ArchMaterialSpec;
    trim: ArchMaterialSpec;
    foundation: ArchMaterialSpec;
    window?: ArchMaterialSpec;
  };
  palettes: Record<string, ArchPalette>;
  props: ArchProp[];
  lod: { tiers: ArchLodTier[] };
}
