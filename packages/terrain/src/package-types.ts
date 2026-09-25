import type { TerrainLayer } from './descriptor-types';
import type { TerrainPyramidTileAddress } from './pyramid-types';
import type { TerrainSemanticTile } from './semantic-types';

export type TerrainPackageArchiveSource =
  | {
      kind: 'pmtiles';
      /** Package-relative archive included in `files` and any distributable bundle. */
      path: string;
    }
  | {
      kind: 'pmtiles';
      /** Absolute range-enabled archive URL intentionally external to the package. */
      url: string;
    }
  | {
      kind: 'pmtiles-set';
      /** Package-relative `molen/archive-set@1` document; its archives resolve against it. */
      path: string;
    }
  | {
      kind: 'pmtiles-set';
      /** Absolute URL of a `molen/archive-set@1` document hosted outside the package. */
      url: string;
    };

export type TerrainPackageSemanticProfile = 'protomaps-basemap@1';

export type TerrainPackageCoordinateSpace =
  | { kind: 'local'; units: 'meters'; bounds: [number, number, number, number] }
  | {
      kind: 'geospatial';
      crs: 'EPSG:3857' | 'EPSG:4326';
      ellipsoid: 'WGS84';
      bounds: [number, number, number, number];
    };

export interface TerrainPackageAttribution {
  text: string;
  license: string;
  sourceUrl?: string;
  licenseUrl?: string;
}

export interface TerrainPackageSourceRecord {
  id: string;
  release: string;
  sha256?: string;
}

export interface TerrainPackageFileRecord {
  path: string;
  sha256: string;
  bytes: number;
}

export interface TerrainPackageDescriptor {
  format: 'molen/terrain-package@1';
  name: string;
  version: string;
  coordinateSpace: TerrainPackageCoordinateSpace;
  tileMatrix: {
    scheme: 'xyz' | 'tms';
    minLevel: number;
    maxLevel: number;
    rootTiles: [number, number];
    tileResolution: number;
  };
  elevation: {
    source: TerrainPackageArchiveSource;
    encoding: 'png16';
    height: { min: number; max: number };
  };
  surface?: {
    seaLevel?: number;
    layers?: TerrainLayer[];
  };
  landcover?: {
    source: TerrainPackageArchiveSource;
    encoding: 'mvt' | 'png8';
    layer: 'landcover';
    /** Declared source schema; enables a matching built-in decoder without guessing. */
    profile?: TerrainPackageSemanticProfile;
  };
  features?: {
    source: TerrainPackageArchiveSource;
    encoding: 'mvt';
    layers: Array<'water' | 'transportation' | 'building' | 'poi'>;
    /** Declared source schema; enables a matching built-in decoder without guessing. */
    profile?: TerrainPackageSemanticProfile;
  };
  models?: { index: string };
  preset?: '1gb' | '5gb' | '20gb';
  attribution: TerrainPackageAttribution[];
  provenance: {
    compiler: string;
    compilerVersion: string;
    sources: TerrainPackageSourceRecord[];
  };
  files: TerrainPackageFileRecord[];
}

// Archive and decoder seams. They live here, not in package-client, so the kernel entry can export
// them without its declarations reaching the client's three.js-typed streams.

export interface TerrainArchiveTile {
  data: ArrayBuffer;
}

export interface TerrainArchiveHeader {
  minZoom: number;
  maxZoom: number;
  tileType?: number;
}

/** Small archive seam implemented by PMTiles and easy to fake in tests/native hosts. */
/**
 * The local metric frame a host renders a projected-Earth package in. World X/Z are Web Mercator
 * meters multiplied by `cos(latitude)`, which is exact at `latitude` and drifts by roughly 1-1.5% per
 * degree of latitude away from it at mid-latitudes. Omitted, the frame sits at the center latitude
 * of the package bounds: right for a regional package, but a worldwide package centers on the
 * equator, so a host viewing a place should pass that place's latitude and re-anchor (rebuild its
 * streams on a new frame) after moving more than about a degree north or south.
 */
export interface TerrainPackageFrame {
  latitude: number;
}

export interface TerrainTileArchive {
  getZxy(
    level: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<TerrainArchiveTile | undefined>;
  getHeader?(): Promise<TerrainArchiveHeader>;
}

export type TerrainPackageSemanticContent = 'landcover' | 'features';

export interface TerrainSemanticTileDecodeContext {
  /** Logical XYZ-style address used by the terrain renderer (+Z south). */
  address: TerrainPyramidTileAddress;
  content: TerrainPackageSemanticContent | 'all';
  encoding: 'mvt' | 'png8';
  /** Source layer names declared by terrain-package.json. */
  layers: readonly string[];
}

/** Source-format adapter implemented by a pipeline/app-specific MVT or PNG8 decoder. */
export interface TerrainSemanticTileDecoder {
  decode(
    data: Uint8Array,
    context: TerrainSemanticTileDecodeContext,
  ): TerrainSemanticTile | Promise<TerrainSemanticTile>;
}
