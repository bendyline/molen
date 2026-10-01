/**
 * Renderer-independent spatial partition and compact LOD buffers, prepared before transfer.
 *
 * Cells are quantized: positions are 16-bit offsets from the cell's center in units of one
 * uniform `positionScale` (under a centimeter for a 512 m cell), and normals are 8-bit. A
 * building vertex takes 20 bytes instead of 35, which is most of a city's resident memory. The
 * scale is uniform so a renderer can apply it as an object scale without distorting normals,
 * collision or picking, all of which read attributes through their item accessors.
 */
import type { MeshBuffers, MeshGroup } from './types';

export interface PreparedBuildingCell {
  key: string;
  /** Offsets from `center` in units of `positionScale` meters. */
  positions: Int16Array;
  /** Meters per position unit (uniform on every axis). */
  positionScale: number;
  /** Cell center in the batch's coordinates. */
  center: [number, number, number];
  /** Unit normals, normalized signed bytes. */
  normals: Int8Array;
  uvs: Float32Array;
  colors: Uint8Array;
  indices: Uint16Array | Uint32Array;
  structuralIndices: Uint16Array | Uint32Array;
  groups: MeshGroup[];
  bounds: [number, number, number, number, number, number];
}

const QUANTIZED_MAX = 32767;

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
    const positions = new Int16Array(remap.size * 3),
      normals = new Int8Array(remap.size * 3);
    const uvs = new Float32Array(remap.size * 2),
      colors = new Uint8Array(remap.size * 3);
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
    const positionScale = reach / QUANTIZED_MAX;
    for (const [old, index] of remap) {
      for (let axis = 0; axis < 3; axis++) {
        const value = buffers.positions[old * 3 + axis] as number;
        positions[index * 3 + axis] = Math.round(
          (value - (center[axis] as number)) / positionScale,
        );
        normals[index * 3 + axis] = Math.round((buffers.normals[old * 3 + axis] as number) * 127);
        colors[index * 3 + axis] = buffers.colors[old * 3 + axis] as number;
      }
      uvs[index * 2] = buffers.uvs[old * 2] as number;
      uvs[index * 2 + 1] = buffers.uvs[old * 2 + 1] as number;
    }
    const Index = remap.size <= 65535 ? Uint16Array : Uint32Array;
    return {
      key,
      positions,
      positionScale,
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
