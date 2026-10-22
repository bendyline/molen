import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { createLandcoverMesh } from '../src/semantic-client';
import type { TerrainLandcoverFeature, TerrainSemanticTile } from '../src/semantic-types';

function context(): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 2, z: 4 },
    pyramid: {
      name: 'test',
      origin: [0, 0],
      rootSize: 800,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 9,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {
      format: 'molen/terrain@2',
      name: 'tile',
      origin: [200, 400],
      chunkSize: 100,
      tileResolution: 9,
      gridSize: [1, 1],
      height: { min: 0, max: 20 },
      tiles: { heightUrl: '' },
      layers: [],
      lod: { levels: 1, distanceBands: [], skirts: false },
      streaming: { loadRadius: 1, unloadRadius: 2, maxConcurrentLoads: 1, maxResidentTiles: 4 },
      collision: { enabled: false },
    },
    heightfield: new Heightfield(new Float32Array(81).fill(0.5), 9, 9, {
      origin: [200, 400],
      worldSize: [100, 100],
      height: { min: 0, max: 20 },
    }),
    origin: [200, 400],
    tileSize: 100,
    signal: new AbortController().signal,
  };
}

const rect = (x0: number, x1: number): TerrainLandcoverFeature['polygons'] => [
  {
    outer: [
      [x0, 0],
      [x1, 0],
      [x1, 1],
      [x0, 1],
    ],
  },
];

function tile(features: TerrainLandcoverFeature[]): TerrainSemanticTile {
  return {
    format: 'molen/terrain-semantics@1',
    landcover: features,
    transportation: [],
    buildings: [],
    water: [],
  } as unknown as TerrainSemanticTile;
}

function vertices(mesh: THREE.Mesh): { x: number; z: number; color: number[]; blend: number[] }[] {
  const position = mesh.geometry.getAttribute('position');
  const color = mesh.geometry.getAttribute('color');
  const blend = mesh.geometry.getAttribute('landcoverBlend');
  return Array.from({ length: position.count }, (_, i) => ({
    x: position.getX(i),
    z: position.getZ(i),
    color: [color.getX(i), color.getY(i), color.getZ(i)],
    blend: [blend.getX(i), blend.getY(i), blend.getZ(i), blend.getW(i)],
  }));
}

describe('landcover class blending', () => {
  it('gives both sides of a class boundary the same pair, so the hard edge disappears', () => {
    const mesh = createLandcoverMesh(
      tile([
        { class: 'grass', polygons: rect(0, 0.5) },
        { class: 'forest', polygons: rect(0.5, 1) },
      ]),
      context(),
      { landcoverColors: { grass: '#80a060', forest: '#305030' } },
    );
    if (!mesh) throw new Error('expected a landcover mesh');
    const all = vertices(mesh);
    const edge = all.filter((v) => Math.abs(v.x - 50) < 1e-6);
    expect(edge.length).toBeGreaterThan(0);
    // Both polygons' copies of a boundary vertex carry one canonical pair and weight at one
    // height, so they weld into a single vertex: the color is continuous across the former
    // polygon edge and no sliver opens between the two classes.
    const byPoint = new Map<string, typeof edge>();
    for (const v of edge) {
      const key = `${v.x.toFixed(4)}/${v.z.toFixed(4)}`;
      byPoint.set(key, [...(byPoint.get(key) ?? []), v]);
    }
    for (const copies of byPoint.values()) expect(copies).toHaveLength(1);
    const index = mesh.geometry.getIndex();
    if (!index) throw new Error('expected welded, indexed land cover');
    const welded = new Set(edge.map((v) => all.indexOf(v)).filter((i) => i >= 0));
    // Triangles from both classes share those vertices.
    const sides = new Set<string>();
    const position = mesh.geometry.getAttribute('position');
    for (let t = 0; t < index.count; t += 3) {
      const corners = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      if (!corners.some((i) => welded.has(i))) continue;
      const x = corners.reduce((sum, i) => sum + position.getX(i), 0) / 3;
      sides.add(x < 50 ? 'grass' : 'forest');
    }
    expect(sides).toEqual(new Set(['grass', 'forest']));
    const middle = edge.find((v) => Math.abs(v.z - 50) < 15) ?? edge[0];
    expect(middle?.blend[0]).toBeGreaterThan(0.2);
    expect(middle?.blend[0]).toBeLessThan(0.8);
    // Far from the boundary each class keeps its own color and no blend.
    for (const v of all.filter((v) => v.x < 30 || v.x > 70)) expect(v.blend[0]).toBe(0);
    mesh.geometry.dispose();
  });

  it('keeps cultivated fields crisp on both sides', () => {
    const field: TerrainLandcoverFeature = {
      class: 'farmland',
      polygons: rect(0.5, 1),
      cultivation: { color: '#b0a060' },
    } as TerrainLandcoverFeature;
    const mesh = createLandcoverMesh(
      tile([{ class: 'grass', polygons: rect(0, 0.5) }, field]),
      context(),
      { landcoverColors: { grass: '#80a060' } },
    );
    if (!mesh) throw new Error('expected a landcover mesh');
    for (const v of vertices(mesh)) expect(v.blend[0]).toBe(0);
    mesh.geometry.dispose();
  });
});
