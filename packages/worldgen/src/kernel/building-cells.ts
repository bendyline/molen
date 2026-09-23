/** Renderer-independent spatial partition and compact LOD buffers, prepared before transfer. */
import type { MeshBuffers, MeshGroup } from './types';

export interface PreparedBuildingCell {
  key: string;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
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
      const keep = source.slot === 'wall' || source.slot === 'roof' || source.slot === 'foundation';
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
    const positions = new Float32Array(remap.size * 3),
      normals = new Float32Array(remap.size * 3);
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
    for (const [old, index] of remap) {
      for (let axis = 0; axis < 3; axis++) {
        const value = buffers.positions[old * 3 + axis] as number;
        positions[index * 3 + axis] = value;
        normals[index * 3 + axis] = buffers.normals[old * 3 + axis] as number;
        colors[index * 3 + axis] = buffers.colors[old * 3 + axis] as number;
        bounds[axis] = Math.min(bounds[axis] as number, value);
        bounds[axis + 3] = Math.max(bounds[axis + 3] as number, value);
      }
      uvs[index * 2] = buffers.uvs[old * 2] as number;
      uvs[index * 2 + 1] = buffers.uvs[old * 2 + 1] as number;
    }
    const Index = remap.size <= 65535 ? Uint16Array : Uint32Array;
    return {
      key,
      positions,
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
