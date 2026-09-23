/**
 * Hand-written contract for a validated (defaults-applied) `molen/archstyle@1` document: how to
 * turn any outline plus metrics plus a seed into a building recipe. The Zod schema in
 * archstyle-schema.ts is the validation engine; keep the two in sync.
 */

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
  fallback: 'flat';
  features?: ArchRoofFeatures;
}

/** Metric facade ornament, fitted to actual bays and omitted when facade-bands is dropped. */
export interface ArchFacadeDetails {
  shutters?: boolean;
  balconies?: { depth: number; railing: 'open' | 'solid'; every: number };
  framing?: { style: 'timber' | 'pilasters'; width: number };
  awnings?: { depth: number };
  veranda?: { depth: number; columns: boolean };
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

export interface ArchStyleDoc {
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
    trim: ArchMaterialSpec;
    foundation: ArchMaterialSpec;
    window?: ArchMaterialSpec;
  };
  palettes: Record<string, ArchPalette>;
  props: ArchProp[];
  lod: { tiers: ArchLodTier[] };
}
