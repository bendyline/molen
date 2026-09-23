/** Hand-written contract for a validated `molen/stylepack@1` manifest. */

import type { StyleRule } from './rules';

export interface StylePackImport {
  /** External asset namespace the pack may reference, e.g. `molen.entities`. */
  namespace: string;
  package?: string;
  note?: string;
}

export interface StylePackAttribution {
  text: string;
  license: string;
  sourceUrl?: string;
  licenseUrl?: string;
}

export interface StylePackDefaults {
  /** Archstyle used when no rule matches. */
  style: string;
  /** Scatter rule set used when a binding does not name one. */
  scatter?: string;
  /** Ordered style rules evaluated after any world binding rules. */
  rules: StyleRule[];
}

export interface StylePackDoc {
  format: 'molen/stylepack@1';
  name: string;
  /** Participates in every seed; bump to re-roll the world. */
  version: string;
  title?: string;
  doc?: string;
  /** Every style, scatter, material, and asset id must live under this namespace. */
  namespace: string;
  /** Archstyle id to pack-relative document path. */
  styles: Record<string, string>;
  /** Scatter id to pack-relative document path. */
  scatter: Record<string, string>;
  /** Material id to pack-relative matgraph/pixelgrid document path. */
  materials: Record<string, string>;
  /** Asset id to pack-relative `molen/asset@1` sidecar path. */
  assets: Record<string, string>;
  defaults: StylePackDefaults;
  imports: StylePackImport[];
  attribution: StylePackAttribution[];
}
