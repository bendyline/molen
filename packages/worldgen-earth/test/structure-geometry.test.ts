import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import { createEmptyTerrainSemanticTile, Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { clipStructureGeometry, withoutStructureRoads } from '../src/client/structure-geometry';
import type { StructurePlacement } from '../src/kernel/structure-index';

const entry: StructurePlacement = {
  id: 'bridge',
  title: 'Bridge',
  asset: 'bridge',
  anchor: [0, 0],
  heading: 0,
  replaceRoads: { length: 100, width: 20 },
  status: 'preview',
  source: 'test',
};
const context = {
  origin: [-100, -100],
  tileSize: 200,
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin: [-100, -100],
    worldSize: [200, 200],
    height: { min: 0, max: 1 },
  }),
} as TerrainPyramidTileLayerContext;
describe('extended structure geometry', () => {
  it('clips a rotated long model into adjacent tiles with matching cut edges', () => {
    const source = new THREE.BoxGeometry(400, 8, 20).toNonIndexed();
    const colors = new Float32Array(source.getAttribute('position').count * 3).fill(0.5);
    source.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const matrix = new THREE.Matrix4().makeRotationY(-0.2).setPosition(200, 12, 100);
    const a = clipStructureGeometry(source, matrix, 200);
    const b = clipStructureGeometry(
      source,
      new THREE.Matrix4().makeTranslation(-200, 0, 0).multiply(matrix),
      200,
    );
    for (const geometry of [a, b]) {
      expect(geometry.boundingBox?.min.x).toBeGreaterThanOrEqual(0);
      expect(geometry.boundingBox?.max.x).toBeLessThanOrEqual(200);
      expect(geometry.boundingBox?.min.y).toBe(8);
    }
    const edge = (g: THREE.BufferGeometry, x: number) => {
      const p = g.getAttribute('position');
      const out = new Set<string>();
      for (let i = 0; i < p.count; i++)
        if (Math.abs(p.getX(i) - x) < 0.001)
          out.add(`${p.getY(i).toFixed(4)}/${p.getZ(i).toFixed(4)}`);
      return [...out].sort();
    };
    expect(edge(a, 200)).toEqual(edge(b, 0));
    expect(source.boundingBox).toBeNull();
    a.dispose();
    b.dispose();
    source.dispose();
  });
  it('removes only the covered span, retaining both approach fragments and ground roads', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        class: 'highway',
        bridge: true,
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
      {
        class: 'minor_road',
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    );
    const result = withoutStructureRoads(tile, context, [entry], 1);
    expect(result.transportation[0]?.lines).toEqual([
      [
        [0, 0.5],
        [0.25, 0.5],
      ],
      [
        [0.75, 0.5],
        [1, 0.5],
      ],
    ]);
    expect(result.transportation[1]).toBe(tile.transportation[1]);
    expect(tile.transportation[0]?.lines).toEqual([
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ]);
  });
  it('uses the model heading for replacement and keeps perpendicular crossings outside its width', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    });
    const result = withoutStructureRoads(tile, context, [{ ...entry, heading: Math.PI / 2 }], 1);
    expect(result.transportation[0]?.lines[0]?.[1]?.[1]).toBeCloseTo(0.25);
    expect(result.transportation[0]?.lines[1]?.[0]?.[1]).toBeCloseTo(0.75);
    expect(withoutStructureRoads(tile, context, [entry], 1).transportation[0]?.lines).toEqual(
      tile.transportation[0]?.lines,
    );
  });
});
