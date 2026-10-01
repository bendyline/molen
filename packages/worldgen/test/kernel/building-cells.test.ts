import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../../src/kernel/building';
import { prepareBuildingCells } from '../../src/kernel/building-cells';
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
    let vertices = 0;
    let bytes = 0;
    for (const cell of cells) {
      expect(cell.positions).toBeInstanceOf(Int16Array);
      expect(cell.normals).toBeInstanceOf(Int8Array);
      const count = cell.positions.length / 3;
      vertices += count;
      bytes +=
        cell.positions.byteLength +
        cell.normals.byteLength +
        cell.uvs.byteLength +
        cell.colors.byteLength;
      // A 256 m cell resolves to well under a centimeter.
      expect(cell.positionScale).toBeLessThan(0.01);
      for (let vertex = 0; vertex < count; vertex++) {
        const decoded = [0, 1, 2].map(
          (axis) =>
            (cell.center[axis] as number) +
            (cell.positions[vertex * 3 + axis] as number) * cell.positionScale,
        );
        expect(decoded[1]).toBeGreaterThanOrEqual((cell.bounds[1] as number) - cell.positionScale);
        expect(decoded[1]).toBeLessThanOrEqual((cell.bounds[4] as number) + cell.positionScale);
        const length = Math.hypot(
          ...[0, 1, 2].map((axis) => (cell.normals[vertex * 3 + axis] as number) / 127),
        );
        expect(length).toBeGreaterThan(0.98);
        expect(length).toBeLessThan(1.02);
      }
    }
    expect(bytes / vertices).toBe(20);
    // Every source position survives to within half a quantization step.
    const decodedSet: number[][] = cells.flatMap((cell) =>
      Array.from({ length: cell.positions.length / 3 }, (_, vertex) =>
        [0, 1, 2].map(
          (axis) =>
            (cell.center[axis] as number) +
            (cell.positions[vertex * 3 + axis] as number) * cell.positionScale,
        ),
      ),
    );
    const worstStep = Math.max(...cells.map((cell) => cell.positionScale));
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
