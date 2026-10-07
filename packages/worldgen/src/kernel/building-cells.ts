/**
 * Renderer-independent spatial partition and compact LOD buffers, prepared before transfer.
 *
 * Cells are quantized: positions are normalized 16-bit offsets from the cell's center, scaled by
 * one uniform `positionScale` (a step under a centimeter for a 512 m cell), and normals are
 * 8-bit. Positions, normals and colors are laid out GPU-ready, as normalized (x, y, z, pad)
 * vertices of {@link CELL_VERTEX_STRIDE} components, so a renderer wraps the transferred arrays
 * without copying and a cache of prepared cells shares one copy with live geometry. A building
 * vertex takes 24 bytes instead of 35. The padding is load-bearing: WebGPU accepts only
 * four-byte-aligned vertex strides, and three.js widens unnormalized 16-bit attributes to 32 bits
 * on WebGPU (on the GPU and in the CPU copy), so a bare Int16 vec3 would cost as much as Float32.
 * The scale is uniform so a renderer can apply it as an object scale without distorting normals,
 * collision or picking, all of which read attributes through their item accessors.
 */
import { SRGB_TO_LINEAR_BYTE } from './schema-common';
import type { MeshBuffers, MeshGroup } from './types';

/** Components per quantized vertex: x, y, z and one padding component. */
export const CELL_VERTEX_STRIDE = 4;
/** Largest signed normalized 16-bit value; `snorm16` decodes as `max(value / 32767, -1)`. */
export const QUANTIZED_MAX = 32767;

export interface PreparedBuildingCell {
  key: string;
  /** Normalized offsets from `center`, (x, y, z, pad) per vertex, in units of `positionScale`. */
  positions: Int16Array;
  /** Meters per normalized unit (uniform on every axis): the object scale a renderer applies. */
  positionScale: number;
  /** Cell center in the batch's coordinates. */
  center: [number, number, number];
  /** Unit normals as normalized signed bytes, (x, y, z, pad) per vertex. */
  normals: Int8Array;
  uvs: Float32Array;
  /** Normalized linear RGB, (r, g, b, pad) per vertex, decoded from the sRGB-encoded buffers. */
  colors: Uint8Array;
  indices: Uint16Array | Uint32Array;
  structuralIndices: Uint16Array | Uint32Array;
  groups: MeshGroup[];
  bounds: [number, number, number, number, number, number];
}

export function prepareBuildingCells(buffers: MeshBuffers, cellSize = 512): PreparedBuildingCell[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0)
    throw new RangeError('Building cell size must be finite and positive');
  const cells = new Map<string, Map<number, number[]>>();
  for (let g = 0; g < buffers.groups.length; g++) {
    const group = buffers.groups[g] as MeshGroup;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const a = buffers.indices[i] as number,
        b = buffers.indices[i + 1] as number,
        c = buffers.indices[i + 2] as number;
      const x =
        ((buffers.positions[a * 3] as number) +
          (buffers.positions[b * 3] as number) +
          (buffers.positions[c * 3] as number)) /
        3;
      const z =
        ((buffers.positions[a * 3 + 2] as number) +
          (buffers.positions[b * 3 + 2] as number) +
          (buffers.positions[c * 3 + 2] as number)) /
        3;
      const key = `${Math.floor(x / cellSize)}/${Math.floor(z / cellSize)}`;
      let cell = cells.get(key);
      if (cell === undefined) {
        cell = new Map();
        cells.set(key, cell);
      }
      let indices = cell.get(g);
      if (indices === undefined) {
        indices = [];
        cell.set(g, indices);
      }
      indices.push(a, b, c);
    }
  }
  return [...cells].map(([key, groups]) => {
    const remap = new Map<number, number>();
    const indices: number[] = [],
      structural: number[] = [],
      ranges: MeshGroup[] = [];
    for (const [g, values] of groups) {
      const source = buffers.groups[g] as MeshGroup;
      const start = indices.length;
      // Windows stay too: they are flat quads, and a facade without them reads as a blank box.
      const keep =
        source.slot === 'wall' ||
        source.slot === 'roof' ||
        source.slot === 'foundation' ||
        source.slot === 'window';
      for (const old of values) {
        let index = remap.get(old);
        if (index === undefined) {
          index = remap.size;
          remap.set(old, index);
        }
        indices.push(index);
        if (keep) structural.push(index);
      }
      ranges.push({ ...source, start, count: indices.length - start });
    }
    const positions = new Int16Array(remap.size * CELL_VERTEX_STRIDE),
      normals = new Int8Array(remap.size * CELL_VERTEX_STRIDE);
    const uvs = new Float32Array(remap.size * 2),
      colors = new Uint8Array(remap.size * CELL_VERTEX_STRIDE);
    const bounds: PreparedBuildingCell['bounds'] = [
      Infinity,
      Infinity,
      Infinity,
      -Infinity,
      -Infinity,
      -Infinity,
    ];
    for (const old of remap.keys()) {
      for (let axis = 0; axis < 3; axis++) {
        const value = buffers.positions[old * 3 + axis] as number;
        bounds[axis] = Math.min(bounds[axis] as number, value);
        bounds[axis + 3] = Math.max(bounds[axis + 3] as number, value);
      }
    }
    const center: [number, number, number] = [
      ((bounds[0] as number) + (bounds[3] as number)) / 2,
      ((bounds[1] as number) + (bounds[4] as number)) / 2,
      ((bounds[2] as number) + (bounds[5] as number)) / 2,
    ];
    const reach = Math.max(
      (bounds[3] as number) - center[0],
      (bounds[4] as number) - center[1],
      (bounds[5] as number) - center[2],
      1e-3,
    );
    // Offsets are within `reach` up to float rounding, far below half a step, so values stay
    // within ±QUANTIZED_MAX; that matters because an Int16Array wraps an overflow, not clamps it.
    for (const [old, index] of remap) {
      for (let axis = 0; axis < 3; axis++) {
        const value = buffers.positions[old * 3 + axis] as number;
        const target = index * CELL_VERTEX_STRIDE + axis;
        positions[target] = Math.round(
          ((value - (center[axis] as number)) / reach) * QUANTIZED_MAX,
        );
        normals[target] = Math.round((buffers.normals[old * 3 + axis] as number) * 127);
        colors[target] = SRGB_TO_LINEAR_BYTE[buffers.colors[old * 3 + axis] as number] as number;
      }
      uvs[index * 2] = buffers.uvs[old * 2] as number;
      uvs[index * 2 + 1] = buffers.uvs[old * 2 + 1] as number;
    }
    const Index = remap.size <= 65535 ? Uint16Array : Uint32Array;
    return {
      key,
      positions,
      positionScale: reach,
      center,
      normals,
      uvs,
      colors,
      indices: new Index(indices),
      structuralIndices: new Index(structural),
      groups: ranges,
      bounds,
    };
  });
}

export function buildingCellTransferables(cells: readonly PreparedBuildingCell[]): ArrayBuffer[] {
  return cells.flatMap((c) => [
    c.positions.buffer,
    c.normals.buffer,
    c.uvs.buffer,
    c.colors.buffer,
    c.indices.buffer,
    c.structuralIndices.buffer,
  ]) as ArrayBuffer[];
}
