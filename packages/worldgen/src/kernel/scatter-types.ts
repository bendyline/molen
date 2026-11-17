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
  /**
   * Largest crown widening (at least 1) that holds canopy and understory cover while a coarser
   * tier or an instance budget thins the instances: kept ones widen by 1/sqrt(the kept share) up to
   * this factor, and grow by its square root in height. Omitted means 1, no growth.
   */
  coverGrowth?: number;
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
  /** Interchangeable forms, sampled independently of species and placement. Under the model
   * budget, unretained variants use model. All forms must suit the same habitat/scale bounds. */
  variants?: Array<{ model: string; weight: number }>;
  weight: number;
  scale: NumberRange;
  /** Independent multiplier of X/Z scale (crown width/bushiness); defaults to 1. */
  widthScale?: NumberRange;
  /**
   * Crown width in meters of the model at scale 1. A `crowns` rule fits the plant to the width
   * of the crown it stands on with it; `scale` then varies its height alone.
   */
  width?: number;
  yaw: 'random' | 'none' | 'rows';
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
  /** Optional common density field across layers of this document. Placement seeds stay independent. */
  sharedSeed?: number;
  /** Smaller wavelength for clumps inside the broad density patches, meters. */
  detailScale?: number;
}

export interface ScatterRule {
  id: string;
  classes: string[];
  notClasses?: string[];
  densityPerHectare: number;
  minSpacing: number;
  /** Regular cultivation grid, anchored in the same global frame as natural scatter. */
  rows?: { spacing: number; interval: number; angle: number; jitter: number; headland?: number };
  /** Require mapped water within this horizontal distance; never invent an oasis from climate. */
  nearWater?: { maxDistance: number; classes?: string[] };
  clustering?: ScatterClustering;
  slopeMax?: number;
  altitude?: ScatterAltitude;
  avoid?: Partial<ScatterAvoid>;
  populations: ScatterPopulation[];
  /**
   * Stand one plant on each shrub crown the ground material paints (see `surface.detail`), at
   * its center and fitted to its width, instead of sampling `densityPerHectare`. Maps a ground
   * appearance class to the brush (0..1) the ground paints it with, normally the class's
   * `surface.detail` brush; other classes get no crowns. Up close the painted crown gives way to
   * the plant, so the shrub seen from the air is the one walked up to. Crowns are kept whole:
   * `keepByTier` only switches the rule off, and they stand outside their layer's instance cap
   * (the rule's own cap bounds them).
   * Places nothing unless the host supplies the ground's crowns (`ScatterSampleInput.crowns`).
   */
  crowns?: Record<string, number>;
  lod?: Partial<ScatterLod>;
  /**
   * Trees, shoulder-height brush, and low ground detail have independent budget pools. `garden`
   * is planted ornamental vegetation (yards, parks, verges): its own pool, so a wood in the same
   * batch cannot thin a neighborhood's planting, nor the planting the wood's brush.
   */
  layer?: 'canopy' | 'understory' | 'groundcover' | 'agriculture' | 'garden';
}

export interface ScatterDoc {
  format: 'molen/scatter@1';
  id: string;
  title: string;
  doc?: string;
  /** Bump to re-roll every placement of this rule set. */
  version: number;
  surface: {
    default: string;
    colors: Record<string, string>;
    /** Exact label to [brush speckle, bare patches] ground detail, each 0..1. */
    detail?: Record<string, [number, number]>;
  };
  defaults: { avoid: ScatterAvoid; slopeMax: number; lod: ScatterLod };
  rules: ScatterRule[];
}
