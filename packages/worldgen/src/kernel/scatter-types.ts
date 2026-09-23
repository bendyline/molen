/** Hand-written contract for a validated (defaults-applied) `molen/scatter@1` document. */

import type { NumberRange } from './archstyle-types';

export interface ScatterAvoid {
  roads: number;
  buildings: number;
  water: number;
}

export interface ScatterLod {
  /** Keep fraction per detail tier (index 0 = full detail); non-increasing. */
  keepByTier: number[];
  maxInstancesPerBatch: number;
}

export interface ScatterTint {
  hue: number;
  saturation: number;
  lightness: number;
}

export interface ScatterAltitude {
  min?: number;
  max?: number;
}

export interface ScatterPopulation {
  /** Asset id (pack or imported namespace) or `builtin:<name>`. */
  model: string;
  weight: number;
  scale: NumberRange;
  /** Independent multiplier of X/Z scale (crown width/bushiness); defaults to 1. */
  widthScale?: NumberRange;
  yaw: 'random' | 'none';
  align: 'up' | 'normal';
  tint?: ScatterTint;
  slopeMax?: number;
  altitude?: ScatterAltitude;
}

export interface ScatterClustering {
  /** Noise wavelength in meters. */
  scale: number;
  /** Noise value below which density is zero. */
  threshold: number;
  /** Steepness of the density ramp above the threshold. */
  contrast: number;
  seedOffset: number;
}

export interface ScatterRule {
  id: string;
  classes: string[];
  notClasses?: string[];
  densityPerHectare: number;
  minSpacing: number;
  clustering?: ScatterClustering;
  slopeMax?: number;
  altitude?: ScatterAltitude;
  avoid?: Partial<ScatterAvoid>;
  populations: ScatterPopulation[];
  lod?: Partial<ScatterLod>;
}

export interface ScatterDoc {
  format: 'molen/scatter@1';
  id: string;
  title: string;
  doc?: string;
  /** Bump to re-roll every placement of this rule set. */
  version: number;
  surface: { default: string; colors: Record<string, string> };
  defaults: { avoid: ScatterAvoid; slopeMax: number; lod: ScatterLod };
  rules: ScatterRule[];
}
