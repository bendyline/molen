import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import {
  createEmptyTerrainSemanticTile,
  type TerrainTransportationFeature,
} from '../src/semantic-types';
import { createTerrainSurfaceObject, disposeTerrainSurfaceObject } from '../src/surface-client';

function context(origin: [number, number] = [0, 0]): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 0, z: 0 },
    origin,
    tileSize: 200,
    pyramid: {
      name: 'bridge-test',
      origin,
      rootSize: 1600,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 3,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    signal: new AbortController().signal,
    heightfield: new Heightfield(new Float32Array(9).fill(0.25), 3, 3, {
      origin,
      worldSize: [200, 200],
      height: { min: 0, max: 20 },
    }),
  };
}
function fixture(bridge = true) {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation.push({
    class: 'highway',
    bridge,
    width: 12,
    lines: [
      [
        [-0.1, 0.5],
        [1.1, 0.5],
      ],
    ],
  });
  return tile;
}
function vertices(object: THREE.Object3D, name: string) {
  const mesh = object.getObjectByName(name) as THREE.Mesh;
  expect(mesh).toBeDefined();
  return mesh.geometry.getAttribute('position');
}
describe('automatic bridge structures', () => {
  it('builds an elevated deck, vertical slab faces, barriers and supports on water-height terrain', () => {
    const object = createTerrainSurfaceObject(fixture(), context());
    const p = vertices(object, 'surfaces:bridges');
    const ys = Array.from({ length: p.count }, (_, i) => p.getY(i));
    expect(Math.min(...ys)).toBeCloseTo(4); // support extends below the 5 m water surface
    expect(Math.max(...ys)).toBeCloseTo(12.1); // 6 m clearance plus barrier
    expect(ys.some((y) => Math.abs(y - 9.9) < 0.001)).toBe(true); // slab underside
    for (let i = 0; i < p.count; i++) {
      expect(p.getX(i)).toBeGreaterThanOrEqual(0);
      expect(p.getX(i)).toBeLessThanOrEqual(200);
    }
    const mesh = object.getObjectByName('surfaces:bridges') as THREE.Mesh;
    const dispose = vi.spyOn(mesh.geometry, 'dispose');
    disposeTerrainSurfaceObject(object);
    expect(dispose).toHaveBeenCalledOnce();
  });
  it('does not invent bridges for ground roads or render tunnels', () => {
    const tile = fixture(false);
    tile.transportation.push({
      ...tile.transportation[0],
      class: 'highway',
      bridge: true,
      tunnel: true,
      lines: [
        [
          [0, 0.8],
          [1, 0.8],
        ],
      ],
    });
    const object = createTerrainSurfaceObject(tile, context());
    expect(object.getObjectByName('surfaces:bridges')).toBeUndefined();
    disposeTerrainSurfaceObject(object);
  });
  it('honors absolute deck elevations and keeps clipped neighboring decks at the same height', () => {
    const tile = fixture();
    (tile.transportation[0] as TerrainTransportationFeature).deckElevation = 23;
    for (const origin of [
      [0, 0],
      [200, 0],
    ] as [number, number][]) {
      const object = createTerrainSurfaceObject(tile, context(origin));
      const p = vertices(object, 'surfaces:bridges');
      const edgeHeights = Array.from({ length: p.count }, (_, i) => i)
        .filter((i) => p.getX(i) === (origin[0] ? 0 : 200))
        .map((i) => p.getY(i));
      expect(Math.max(...edgeHeights)).toBeCloseTo(24.1);
      expect(edgeHeights.some((y) => Math.abs(y - 21.9) < 0.001)).toBe(true);
      disposeTerrainSurfaceObject(object);
    }
  });
  it('joins an authored deck at its end and blends into the inferred approach', () => {
    const tile = fixture();
    tile.transportation[0] = {
      ...tile.transportation[0],
      class: 'highway',
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
      bridgeConnections: [{ point: [0, 0.5], elevation: 18, radius: 100 }],
    };
    const object = createTerrainSurfaceObject(tile, context());
    const p = vertices(object, 'semantic:transportation');
    for (const [x, y] of [
      [0, 18],
      [200, 11],
    ]) {
      const ys = Array.from({ length: p.count }, (_, i) => i)
        .filter((i) => p.getX(i) === x)
        .map((i) => p.getY(i));
      expect(ys.length).toBeGreaterThan(0);
      for (const actual of ys) expect(actual).toBeCloseTo(y as number);
    }
    disposeTerrainSurfaceObject(object);
  });
  it('meets a connected ground road and spans a valley without draping into its bottom', () => {
    const ctx = context();
    ctx.heightfield = new Heightfield(new Float32Array([1, 0, 1, 1, 0, 1, 1, 0, 1]), 3, 3, {
      origin: [0, 0],
      worldSize: [200, 200],
      height: { min: 0, max: 20 },
    });
    const tile = fixture();
    (tile.transportation[0] as TerrainTransportationFeature).lines = [
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
    ];
    tile.transportation.push({
      class: 'highway',
      width: 12,
      lines: [
        [
          [0, 0.5],
          [0.1, 0.5],
        ],
        [
          [0.9, 0.5],
          [1, 0.5],
        ],
      ],
    });
    const object = createTerrainSurfaceObject(tile, ctx);
    const mesh = object.getObjectByName('semantic:transportation') as THREE.Mesh;
    expect(mesh).toBeDefined();
    const p = mesh.geometry.getAttribute('position');
    const heights = Array.from({ length: p.count }, (_, i) => i)
      .filter((i) => Math.abs(p.getX(i) - 100) < 10)
      .map((i) => p.getY(i));
    expect(Math.min(...heights)).toBeGreaterThan(15);
    disposeTerrainSurfaceObject(object);
  });
});
