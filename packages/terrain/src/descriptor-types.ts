// Hand-written contract for a validated terrain descriptor (docs/03-data-formats.md §10).
// Zod (schema.ts) validates; this interface is the API contract.

export interface TerrainLayer {
  name: string;
  materialRef?: string;
  /** Flat color for vertex-color splat banding (v1 shading). */
  color?: string;
  tiling: number;
  /** Optional height/slope auto-banding (terrain-owned, not matgraph nodes). */
  auto?: { heightMin?: number; heightMax?: number; slopeMin?: number; slopeMax?: number };
}

export interface TerrainStreamingOptions {
  /** Radius around the camera, measured in chunks, that should be resident. */
  loadRadius: number;
  /** Larger hysteresis radius; resident tiles outside it may be evicted. */
  unloadRadius: number;
  /** Maximum number of height-tile requests in flight at once. */
  maxConcurrentLoads: number;
  /** Hard ceiling for decoded resident height tiles and their meshes. */
  maxResidentTiles: number;
}

export interface TerrainDescriptor {
  format: 'molen/terrain@2';
  name: string;
  /** World XZ of tile (0,0) corner. */
  origin: [number, number];
  /** Meters per chunk edge. */
  chunkSize: number;
  /** Height samples per chunk edge (shared borders). */
  tileResolution: number;
  /** Chunks in X,Z. */
  gridSize: [number, number];
  height: { min: number; max: number };
  tiles: { heightUrl: string; splatUrl?: string };
  layers: TerrainLayer[];
  lod: { levels: number; distanceBands: number[]; skirts: boolean };
  streaming: TerrainStreamingOptions;
  /** When enabled, the tooling registers the heightfield as the scene's ground/collision. */
  collision: { enabled: boolean };
  /**
   * World meters per unit of the source's projected space. Projected-Earth packages set this
   * to cos(center latitude) and pre-multiply origin/chunkSize by it, so world XZ is metric;
   * absent = 1 (local/invented worlds).
   */
  metersPerUnit?: number;
}
