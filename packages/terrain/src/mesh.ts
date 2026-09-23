import type { TerrainDescriptor } from './descriptor-types';
import type { Heightfield } from './heightfield';
import { compileTerrainPalette } from './splat';

// Chunked terrain geometry with skirts and per-vertex splat color. Pure (returns typed arrays),
// so the meshing is unit-testable in Node; the three.js wrapper (terrain-three.ts) turns these
// into BufferGeometry.

export interface ChunkGeometry {
  positions: Float32Array; // xyz per vertex, world space
  normals: Float32Array;
  colors: Float32Array; // rgb per vertex
  /** Immutable shared topology. Copy before mutation or transfer to another thread. */
  indices: Uint16Array | Uint32Array;
  vertexCount: number;
}

/**
 * Heights outside one tile's own field, for the normal apron at shared tile borders.
 * Returns undefined when no neighbour covers the sample, leaving the tile's clamped edge value.
 */
export type TerrainNeighborHeightSampler = (x: number, z: number) => number | undefined;

export interface ChunkMeshOptions {
  /** LOD vertex stride: 1 = full res, 2 = half, 4 = quarter. */
  step?: number;
  /** Add a skirt ring dropped below the surface to hide cracks. */
  skirt?: boolean;
  /** Store X/Z relative to the chunk origin for large-world float precision. */
  localCoordinates?: boolean;
  /**
   * One-sample apron for border normals. A tile-scoped heightfield clamps its gradient stencil at
   * its own edge, so two tiles that share a border height still disagree about its normal by a
   * visible angle. With neighbour heights both sides evaluate the same central difference.
   */
  neighborHeight?: TerrainNeighborHeightSampler;
}

/** The four chunk borders, named by the direction of the neighbour that shares them. */
export type ChunkEdge = 'west' | 'east' | 'north' | 'south';

/** Skirt rings are appended in this order by buildChunkGeometry. */
const SKIRT_EDGE_ORDER: ChunkEdge[] = ['north', 'south', 'west', 'east'];

function apronHeight(
  hf: Heightfield,
  sampler: TerrainNeighborHeightSampler | undefined,
  x: number,
  z: number,
): number {
  if (sampler !== undefined) {
    const outside =
      x < hf.origin[0] ||
      z < hf.origin[1] ||
      x > hf.origin[0] + hf.worldSize[0] ||
      z > hf.origin[1] + hf.worldSize[1];
    if (outside) {
      const height = sampler(x, z);
      if (height !== undefined && Number.isFinite(height)) return height;
    }
  }
  return hf.sampleHeight(x, z);
}

/**
 * Surface normal for one chunk vertex. Identical to `Heightfield.normalAt` in a tile's interior
 * and wherever no neighbour is available, so sampling and collision keep the field's own answer;
 * at a border with neighbour heights it is the true central difference both tiles compute.
 */
export function chunkNormalAt(
  hf: Heightfield,
  x: number,
  z: number,
  neighborHeight?: TerrainNeighborHeightSampler,
): [number, number, number] {
  if (neighborHeight === undefined) return hf.normalAt(x, z);
  const dx = hf.worldSize[0] / (hf.cols - 1);
  const dz = hf.worldSize[1] / (hf.rows - 1);
  const hl = apronHeight(hf, neighborHeight, x - dx, z);
  const hr = apronHeight(hf, neighborHeight, x + dx, z);
  const hd = apronHeight(hf, neighborHeight, x, z - dz);
  const hu = apronHeight(hf, neighborHeight, x, z + dz);
  const nx = -(hr - hl) / (2 * dx);
  const nz = -(hu - hd) / (2 * dz);
  const len = Math.sqrt(nx * nx + 1 + nz * nz) || 1;
  return [nx / len, 1 / len, nz / len];
}

/**
 * Tile indices whose bounds contain a normalized tile coordinate. A sample exactly on a tile
 * border belongs to both neighbours — they share that height — so both are offered.
 */
export function neighborTileIndices(value: number): number[] {
  const index = Math.floor(value);
  return Number.isInteger(value) ? [index, index - 1] : [index];
}

/** Vertices per chunk edge implied by a built geometry's vertex count. */
export function chunkVertsForVertexCount(vertexCount: number, skirt: boolean): number | undefined {
  // verts^2 (+ 4*verts for the skirt ring) = vertexCount.
  const verts = skirt
    ? Math.round(Math.sqrt(vertexCount + 4) - 2)
    : Math.round(Math.sqrt(vertexCount));
  if (verts < 2) return undefined;
  const expected = verts * verts + (skirt ? verts * 4 : 0);
  return expected === vertexCount ? verts : undefined;
}

export interface ChunkEdgeNormalOptions {
  /** The chunk's normal attribute, exactly as buildChunkGeometry produced it. */
  normals: Float32Array;
  /** Whether that geometry carries a skirt ring, so its vertex layout is known. */
  skirt: boolean;
  neighborHeight: TerrainNeighborHeightSampler;
}

/**
 * Recompute one border's vertex normals in place, once the neighbour across it is resident.
 *
 * Positions are untouched — adjacent tiles already share their border heights — so the buffer
 * keeps its size, identity and byte accounting, and a resident tile converges on continuous
 * shading without being re-meshed. Returns false when the array is not a chunk of this shape.
 */
export function refreshChunkEdgeNormals(
  hf: Heightfield,
  descriptor: TerrainDescriptor,
  cx: number,
  cz: number,
  edge: ChunkEdge,
  options: ChunkEdgeNormalOptions,
): boolean {
  const verts = chunkVertsForVertexCount(options.normals.length / 3, options.skirt);
  if (verts === undefined) return false;
  const chunkSize = descriptor.chunkSize;
  const ox = descriptor.origin[0] + cx * chunkSize;
  const oz = descriptor.origin[1] + cz * chunkSize;
  const cell = chunkSize / (verts - 1);
  const skirtBase = verts * verts + SKIRT_EDGE_ORDER.indexOf(edge) * verts;
  for (let i = 0; i < verts; i++) {
    const c = edge === 'west' ? 0 : edge === 'east' ? verts - 1 : i;
    const r = edge === 'north' ? 0 : edge === 'south' ? verts - 1 : i;
    const normal = chunkNormalAt(hf, ox + c * cell, oz + r * cell, options.neighborHeight);
    const surface = (r * verts + c) * 3;
    options.normals[surface] = normal[0];
    options.normals[surface + 1] = normal[1];
    options.normals[surface + 2] = normal[2];
    if (!options.skirt) continue;
    const skirt = (skirtBase + i) * 3;
    options.normals[skirt] = normal[0];
    options.normals[skirt + 1] = normal[1];
    options.normals[skirt + 2] = normal[2];
  }
  return true;
}

/** Pick a LOD step for a chunk given its distance from the camera and the descriptor bands. */
export function lodStepForDistance(descriptor: TerrainDescriptor, distance: number): number {
  const bands = descriptor.lod.distanceBands;
  let level = 0;
  for (let i = 0; i < bands.length; i++) {
    if (distance > (bands[i] as number)) level = i + 1;
  }
  level = Math.min(level, descriptor.lod.levels - 1);
  return 2 ** level; // 1, 2, 4, 8...
}

/** Build the geometry for one chunk (cx, cz) at the given LOD step. */
export function buildChunkGeometry(
  hf: Heightfield,
  descriptor: TerrainDescriptor,
  cx: number,
  cz: number,
  opts: ChunkMeshOptions = {},
): ChunkGeometry {
  const requestedStep = opts.step ?? 1;
  if (!Number.isSafeInteger(requestedStep) || requestedStep < 1) {
    throw new Error(`terrain LOD step must be a positive safe integer, got ${requestedStep}`);
  }
  const skirt = opts.skirt ?? descriptor.lod.skirts;
  const localCoordinates = opts.localCoordinates ?? false;
  const res = descriptor.tileResolution;
  // Clamp direct API callers to the coarsest meaningful grid. Validated descriptors already
  // enforce compatible levels, but this keeps the pure mesher safe with hand-written inputs.
  const step = Math.min(requestedStep, res - 1);
  const verts = Math.floor((res - 1) / step) + 1; // vertices per edge
  const chunkSize = descriptor.chunkSize;
  const ox = descriptor.origin[0] + cx * chunkSize;
  const oz = descriptor.origin[1] + cz * chunkSize;
  const cell = chunkSize / (verts - 1);

  const totalVerts = verts * verts + (skirt ? verts * 4 : 0);
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const palette = compileTerrainPalette(descriptor);

  let vp = 0;
  const writeVertex = (wx: number, wz: number, yOffset: number): number => {
    const y = hf.sampleHeight(wx, wz);
    const idx = vp / 3;
    positions[vp] = localCoordinates ? wx - ox : wx;
    positions[vp + 1] = y + yOffset;
    positions[vp + 2] = localCoordinates ? wz - oz : wz;
    const n = chunkNormalAt(hf, wx, wz, opts.neighborHeight);
    normals[vp] = n[0];
    normals[vp + 1] = n[1];
    normals[vp + 2] = n[2];
    const slope = 1 - n[1];
    const c = palette(y, slope);
    colors[vp] = c[0];
    colors[vp + 1] = c[1];
    colors[vp + 2] = c[2];
    vp += 3;
    return idx;
  };

  // Surface grid.
  for (let r = 0; r < verts; r++) {
    for (let c = 0; c < verts; c++) {
      writeVertex(ox + c * cell, oz + r * cell, 0);
    }
  }

  // Identical winding and vertex order to the surface; reuse the immutable index topology.
  if (skirt) {
    const depth = (descriptor.height.max - descriptor.height.min) * 0.04 + 1;
    for (let c = 0; c < verts; c++) writeVertex(ox + c * cell, oz, -depth);
    for (let c = 0; c < verts; c++) writeVertex(ox + c * cell, oz + (verts - 1) * cell, -depth);
    for (let r = 0; r < verts; r++) writeVertex(ox, oz + r * cell, -depth);
    for (let r = 0; r < verts; r++) writeVertex(ox + (verts - 1) * cell, oz + r * cell, -depth);
  }

  return {
    positions: positions.subarray(0, vp),
    normals: normals.subarray(0, vp),
    colors: colors.subarray(0, vp),
    indices: terrainTopology(verts, skirt),
    vertexCount: vp / 3,
  };
}

// Bounded cache; arbitrary API callers cannot grow it indefinitely. Never transfer these arrays.
const topologies = new Map<string, Uint16Array | Uint32Array>();
export function terrainTopology(verts: number, skirt: boolean): Uint16Array | Uint32Array {
  const key = `${verts}/${skirt}`;
  const cached = topologies.get(key);
  if (cached !== undefined && cached.byteLength > 0) return cached;
  const vertices = verts * verts + (skirt ? verts * 4 : 0);
  const count = (verts - 1) ** 2 * 6 + (skirt ? (verts - 1) * 24 : 0);
  const indices = vertices <= 65535 ? new Uint16Array(count) : new Uint32Array(count);
  let offset = 0;
  const quad = (a: number, d: number, b: number, e: number): void => {
    indices.set([a, d, b, b, d, e], offset);
    offset += 6;
  };
  for (let r = 0; r < verts - 1; r++)
    for (let c = 0; c < verts - 1; c++) {
      const a = r * verts + c;
      quad(a, a + verts, a + 1, a + verts + 1);
    }
  if (skirt)
    for (let edge = 0; edge < 4; edge++)
      for (let i = 0; i < verts - 1; i++) {
        const start =
          edge === 0 ? 0 : edge === 1 ? (verts - 1) * verts : edge === 2 ? 0 : verts - 1;
        const step = edge < 2 ? 1 : verts;
        const lower = verts * verts + edge * verts + i;
        quad(start + i * step, lower, start + (i + 1) * step, lower + 1);
      }
  if (topologies.size >= 32) topologies.delete(topologies.keys().next().value as string);
  topologies.set(key, indices);
  return indices;
}
