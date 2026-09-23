/** Hand-written contract for a validated `molen/region-atlas@1` document. */

import type { StyleRule } from '@bendyline/molen-worldgen/kernel';

export interface AtlasRegionBindings {
  /** Ordered style rules evaluated first for buildings inside the region. */
  buildings: StyleRule[];
  /** Archstyle used inside the region when no region rule matches (before pack rules). */
  default?: string;
  /** Scatter rule set for the region. */
  scatter?: string;
  /** Synthetic tree fill around low-rise homes, 0..1. Zero disables it; inherits atlas default. */
  treeFillFactor?: number;
}

export interface AtlasRegion {
  id: string;
  title?: string;
  /** Higher wins where regions overlap. */
  priority: number;
  /** [minLon, minLat, maxLon, maxLat] in degrees; quick reject and sole geometry when no polygons. */
  bbox?: [number, number, number, number];
  /** WGS84 outer rings (union, no holes, no antimeridian crossing). */
  polygons?: Array<Array<[number, number]>>;
  bindings: AtlasRegionBindings;
}

export interface RegionAtlasDefaults {
  buildings: StyleRule[];
  style?: string;
  scatter?: string;
  /** Synthetic residential tree fill, 0..1. Omitted means disabled in unclassified regions. */
  treeFillFactor?: number;
}

export interface RegionAtlasDoc {
  format: 'molen/region-atlas@1';
  id: string;
  title: string;
  doc?: string;
  version: number;
  regions: AtlasRegion[];
  /** Worldwide fallback chain, evaluated after region bindings and before pack defaults. */
  default: RegionAtlasDefaults;
}
