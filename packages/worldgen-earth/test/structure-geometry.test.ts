import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import { createEmptyTerrainSemanticTile, Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  clipStructureGeometry,
  clipStructureObject,
  withoutStructureRoads,
} from '../src/client/structure-geometry';
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
  it('retains texture coordinates and material groups across a tile seam', () => {
    const source = new THREE.BoxGeometry(400, 8, 20);
    const matrix = new THREE.Matrix4().makeTranslation(200, 12, 100);
    const clipped = clipStructureGeometry(source, matrix, 200);
    const positions = clipped.getAttribute('position');
    const uv = clipped.getAttribute('uv');
    expect(uv.count).toBe(positions.count);
    expect(clipped.groups.map((group) => group.materialIndex)).toContain(2);
    expect(clipped.groups.reduce((sum, group) => sum + group.count, 0)).toBe(positions.count);
    // The +Y face's source u spans the entire 400m model. Clipping retains half its texture,
    // rather than stretching the whole texture onto every tile.
    const top = clipped.groups.find((group) => group.materialIndex === 2);
    if (!top) throw new Error('Missing top material group');
    const us = Array.from({ length: top.count }, (_, i) => uv.getX(top.start + i));
    expect(Math.min(...us)).toBeCloseTo(0);
    expect(Math.max(...us)).toBeCloseTo(0.5);
    source.dispose();
    clipped.dispose();
  });

  it('expands quantized attributes before applying kilometer-scale node transforms', () => {
    const source = new THREE.BufferGeometry();
    source.setAttribute(
      'position',
      new THREE.Int16BufferAttribute([0, 0, 0, 32767, 0, 0, 0, 32767, 32767], 3, true),
    );
    source.setAttribute('uv', new THREE.Uint16BufferAttribute([0, 0, 65535, 0, 0, 65535], 2, true));
    const geometry = clipStructureGeometry(
      source,
      new THREE.Matrix4().makeScale(1000, 1000, 1000),
      500,
    );
    expect(geometry.boundingBox?.max.x).toBe(500);
    expect(geometry.boundingBox?.max.y).toBe(500);
    expect(geometry.getAttribute('uv').getX(1)).toBeCloseTo(0.5);
    expect(source.getAttribute('position').array).toBeInstanceOf(Int16Array);
    geometry.dispose();
    source.dispose();
  });

  it('clips nested meshes independently while retaining their exact PBR materials', () => {
    const scene = new THREE.Group();
    const texture = new THREE.Texture();
    const material = new THREE.MeshPhysicalMaterial({ map: texture, clearcoat: 0.5 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(400, 20, 20), material);
    mesh.position.set(200, 10, 100);
    scene.add(mesh);
    const object = clipStructureObject(scene, 200);
    const part = object.children[0] as THREE.Mesh;
    expect(part.material).toBe(material);
    expect(part.geometry).not.toBe(mesh.geometry);
    expect(part.geometry.getAttribute('uv')).toBeDefined();
    expect(part.geometry.boundingBox?.max.y).toBe(20);
    expect(part.position.toArray()).toEqual([0, 0, 0]);
    expect(part.userData.worldgenOwnedGeometry).toBe(true);
    part.geometry.dispose();
    mesh.geometry.dispose();
    material.dispose();
    texture.dispose();
  });
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
  it('connects approaches to the resolved bank reference without resampling the riverbed', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    });
    const sample = vi.spyOn(context.heightfield, 'sampleHeight');
    try {
      const result = withoutStructureRoads(
        tile,
        context,
        [
          {
            ...entry,
            elevation: 1.5,
            scale: [1, 2, 1],
            replaceRoads: { length: 100, width: 20, deckHeight: 8 },
          },
        ],
        1,
        () => 38.5,
      );
      expect(result.transportation[0]?.bridgeConnections?.map((item) => item.elevation)).toEqual([
        54.5, 54.5,
      ]);
      expect(sample).not.toHaveBeenCalled();
    } finally {
      sample.mockRestore();
    }
  });
  it('does not alter elevation hints on unrelated perpendicular or exterior bridge roads', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      {
        class: 'highway',
        bridge: true,
        lines: [
          [
            [0.5, 0],
            [0.5, 1],
          ],
        ],
      },
      {
        class: 'highway',
        bridge: true,
        lines: [
          [
            [0, 0.8],
            [1, 0.8],
          ],
        ],
      },
    );
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          replaceRoads: { length: 100, width: 20, deckHeights: [5, 8] },
        },
      ],
      1,
    );
    expect(result.transportation[0]).toBe(tile.transportation[0]);
    expect(result.transportation[1]).toBe(tile.transportation[1]);
    expect(result.transportation.every((road) => road.bridgeConnections === undefined)).toBe(true);
  });
  it('keeps distinct scaled endpoint heights after the bridge turns north', () => {
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
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          datum: 'sea-level',
          elevation: 26.34,
          heading: Math.PI / 2,
          scale: [1, 2, 1],
          replaceRoads: { length: 100, width: 20, deckHeights: [12.86, 16.41] },
        },
      ],
      1,
    );
    const connections = result.transportation[0]?.bridgeConnections;
    expect(connections?.[0]?.point).toEqual([0.5, 0.75]);
    expect(connections?.[1]?.point).toEqual([0.5, 0.25]);
    expect(connections?.[0]?.elevation).toBeCloseTo(52.06);
    expect(connections?.[1]?.elevation).toBeCloseTo(59.16);
  });
  it('subtracts skewed ends without removing parallel roads outside the actual footprint', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
        [
          [0.24, 0.55],
          [0.28, 0.55],
        ],
      ],
    });
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          replaceRoads: {
            length: 100,
            width: 20,
            outline: [
              [-50, -10],
              [40, -10],
              [50, 10],
              [-40, 10],
            ],
          },
        },
      ],
      1,
    );
    expect(result.transportation[0]?.lines).toEqual([
      [
        [0, 0.5],
        [expect.closeTo(0.275), 0.5],
      ],
      [
        [expect.closeTo(0.725), 0.5],
        [1, 0.5],
      ],
      [
        [0.24, 0.55],
        [0.28, 0.55],
      ],
    ]);
  });
  it('preserves the gap in a concave footprint and applies native scale and heading', () => {
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
    const result = withoutStructureRoads(
      tile,
      context,
      [
        {
          ...entry,
          heading: Math.PI / 2,
          scale: [2, 1, 3],
          replaceRoads: {
            length: 50,
            width: 10,
            outline: [
              [-25, -5],
              [25, -5],
              [25, 5],
              [5, 5],
              [5, -1],
              [-5, -1],
              [-5, 5],
              [-25, 5],
            ],
          },
        },
      ],
      1,
    );
    expect(result.transportation[0]?.lines).toEqual([
      [
        [0.5, 0],
        [0.5, 0.25],
      ],
      [
        [0.5, 0.45],
        [0.5, 0.55],
      ],
      [
        [0.5, 0.75],
        [0.5, 1],
      ],
    ]);
  });
});
