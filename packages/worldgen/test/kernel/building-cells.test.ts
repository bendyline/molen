import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../../src/kernel/building';
import {
  CELL_VERTEX_STRIDE,
  type PreparedBuildingCell,
  prepareBuildingCells,
  QUANTIZED_MAX,
} from '../../src/kernel/building-cells';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { FLAT_GROUND, type Vec2 } from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';
import { SHAPES, translate } from '../helpers/shapes';

const pack = await createTestPack();
const style = pack.archstyles['test.pack.house'];
if (style === undefined) throw new Error('test pack missing house style');

function street() {
  const out = new MeshBufferBuilder();
  for (let index = 0; index < 6; index++) {
    generateBuilding(
      {
        request: {
          identity: `house:${index}`,
          labels: ['house'],
          outline: translate(SHAPES.L as Vec2[], index * 90, 40),
          levels: 2,
        },
        style,
        pack: { name: pack.root.name, version: pack.root.version },
        ground: FLAT_GROUND,
        tier: 0,
      },
      out,
    );
  }
  return out.finalize();
}

describe('prepared building cells', () => {
  it('quantizes positions and normals compactly and within a fraction of a millimeter', () => {
    const buffers = street();
    const cells = prepareBuildingCells(buffers, 256);
    expect(cells.length).toBeGreaterThan(1);
    // snorm16 decoding, as WebGL2, WebGPU and three.js's accessors all perform it.
    const decode = (cell: PreparedBuildingCell, vertex: number): number[] =>
      [0, 1, 2].map(
        (axis) =>
          (cell.center[axis] as number) +
          Math.max(
            (cell.positions[vertex * CELL_VERTEX_STRIDE + axis] as number) / QUANTIZED_MAX,
            -1,
          ) *
            cell.positionScale,
      );
    let vertices = 0;
    let bytes = 0;
    for (const cell of cells) {
      expect(cell.positions).toBeInstanceOf(Int16Array);
      expect(cell.normals).toBeInstanceOf(Int8Array);
      const count = cell.positions.length / CELL_VERTEX_STRIDE;
      expect(cell.normals.length / CELL_VERTEX_STRIDE).toBe(count);
      expect(cell.colors.length / CELL_VERTEX_STRIDE).toBe(count);
      // Each GPU-ready vertex starts on a four-byte boundary, which WebGPU requires.
      for (const array of [cell.positions, cell.normals, cell.colors])
        expect((array.BYTES_PER_ELEMENT * CELL_VERTEX_STRIDE) % 4).toBe(0);
      vertices += count;
      bytes +=
        cell.positions.byteLength +
        cell.normals.byteLength +
        cell.uvs.byteLength +
        cell.colors.byteLength;
      // A 256 m cell resolves to well under a centimeter.
      const step = cell.positionScale / QUANTIZED_MAX;
      expect(step).toBeLessThan(0.01);
      for (let vertex = 0; vertex < count; vertex++) {
        const decoded = decode(cell, vertex);
        expect(decoded[1]).toBeGreaterThanOrEqual((cell.bounds[1] as number) - step);
        expect(decoded[1]).toBeLessThanOrEqual((cell.bounds[4] as number) + step);
        const length = Math.hypot(
          ...[0, 1, 2].map(
            (axis) => (cell.normals[vertex * CELL_VERTEX_STRIDE + axis] as number) / 127,
          ),
        );
        expect(length).toBeGreaterThan(0.98);
        expect(length).toBeLessThan(1.02);
      }
    }
    expect(bytes / vertices).toBe(24);
    // Every source position survives to within half a quantization step.
    const decodedSet: number[][] = cells.flatMap((cell) =>
      Array.from({ length: cell.positions.length / CELL_VERTEX_STRIDE }, (_, vertex) =>
        decode(cell, vertex),
      ),
    );
    const worstStep = Math.max(...cells.map((cell) => cell.positionScale / QUANTIZED_MAX));
    for (let vertex = 0; vertex < buffers.positions.length / 3; vertex += 7) {
      const source = [0, 1, 2].map((axis) => buffers.positions[vertex * 3 + axis] as number);
      const nearest = Math.min(
        ...decodedSet.map((point) =>
          Math.max(...point.map((value, axis) => Math.abs(value - (source[axis] as number)))),
        ),
      );
      expect(nearest).toBeLessThanOrEqual(worstStep / 2 + 1e-9);
    }
  });

  it('keeps windows in the far level with the walls, roofs and foundations', () => {
    const cells = prepareBuildingCells(street(), 256);
    const windows = cells.flatMap((cell) => cell.groups.filter((group) => group.slot === 'window'));
    expect(windows.length).toBeGreaterThan(0);
    for (const cell of cells) {
      const kept = new Set(cell.structuralIndices);
      for (const group of cell.groups) {
        const used = cell.indices.subarray(group.start, group.start + group.count);
        const keep = ['wall', 'roof', 'foundation', 'window'].includes(group.slot);
        if (keep) for (const index of used) expect(kept.has(index)).toBe(true);
      }
      const structural = cell.groups
        .filter((group) => ['wall', 'roof', 'foundation', 'window'].includes(group.slot))
        .reduce((sum, group) => sum + group.count, 0);
      expect(cell.structuralIndices.length).toBe(structural);
    }
  });
});
