import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import { createTerrainLinearObject } from '../src/linear-features';
import { buildChunkGeometry } from '../src/mesh';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { createTerrainSemanticObject, disposeTerrainSemanticObject } from '../src/semantic-client';
import { createEmptyTerrainSemanticTile, type TerrainSemanticPolygon } from '../src/semantic-types';

function context(resolution: number): TerrainPyramidTileLayerContext {
  const origin: [number, number] = [1000, 2000];
  const grid = new Float32Array(81);
  for (let z = 0; z < 9; z++)
    for (let x = 0; x < 9; x++)
      grid[z * 9 + x] = ((x - 4) ** 2 + (z - 4) ** 2) / 40 + ((x + z) % 3) * 0.08;
  return {
    address: { level: 0, x: 0, z: 0 },
    origin,
    tileSize: 100,
    surfaceResolution: resolution,
    pyramid: {
      name: 'drape',
      origin,
      rootSize: 100,
      minLevel: 0,
      maxLevel: 0,
      tileResolution: 9,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {
      format: 'molen/terrain@2',
      name: 'drape',
      origin,
      chunkSize: 100,
      tileResolution: 9,
      gridSize: [1, 1],
      height: { min: 0, max: 20 },
      tiles: { heightUrl: '' },
      layers: [],
      lod: { levels: 1, distanceBands: [], skirts: false },
      streaming: { loadRadius: 1, unloadRadius: 2, maxConcurrentLoads: 1, maxResidentTiles: 1 },
      collision: { enabled: false },
    },
    heightfield: new Heightfield(grid, 9, 9, {
      origin,
      worldSize: [100, 100],
      height: { min: 0, max: 20 },
    }),
    signal: new AbortController().signal,
  };
}

function ground(context: TerrainPyramidTileLayerContext): THREE.Mesh {
  const data = buildChunkGeometry(context.heightfield, context.descriptor, 0, 0, {
    localCoordinates: true,
    skirt: false,
    step: 8 / ((context.surfaceResolution ?? 9) - 1),
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
}

function height(mesh: THREE.Object3D, x: number, z: number): number {
  mesh.updateMatrixWorld(true);
  const hit = new THREE.Raycaster(
    new THREE.Vector3(x, 100, z),
    new THREE.Vector3(0, -1, 0),
  ).intersectObject(mesh, true)[0];
  expect(hit, `surface coverage at ${x},${z}`).toBeDefined();
  if (!hit) throw new Error('Missing surface');
  return hit.point.y;
}

const footprint: TerrainSemanticPolygon = {
  outer: [
    [-0.1, -0.1],
    [1.1, -0.1],
    [1.1, 1.1],
    [-0.1, 1.1],
  ],
};

describe('surface draping over hills and valleys', () => {
  it.each([
    3, 5, 9,
  ])('keeps land cover below parking and roads at grid resolution %i', (resolution) => {
    const ctx = context(resolution),
      terrain = ground(ctx);
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [
      { class: 'urban_area', polygons: [footprint] },
      {
        class: 'parking',
        polygons: [
          {
            outer: [
              [0.1, 0.1],
              [0.9, 0.1],
              [0.9, 0.9],
              [0.1, 0.9],
            ],
          },
        ],
      },
    ];
    tile.transportation = [
      {
        class: 'residential',
        width: 12,
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    ];
    const object = createTerrainSemanticObject(tile, ctx, {
      renderBuildings: false,
      maxTreesPerTile: 0,
      surfaces: { style: 'minimal', details: { inferParking: false } },
    });
    const land = object.getObjectByName('semantic:landcover') as THREE.Mesh;
    const road = object.getObjectByName('semantic:transportation') as THREE.Mesh;
    const parking = object.getObjectByName('surface:areas') as THREE.Mesh;
    for (let x = 12.3; x < 90; x += 6.7) {
      for (const z of [46.7, 50.3, 54.1]) {
        const y = height(terrain, x, z);
        expect(height(land, x, z) - y).toBeCloseTo(0.244, 4);
        expect(height(parking, x, z) - y).toBeCloseTo(0.3, 4);
        expect(height(road, x, z) - y).toBeCloseTo(0.32, 4);
      }
    }
    // Interior samples, not just vertices: no triangle can span the depression.
    for (let x = 2.3; x < 100; x += 7.1)
      for (let z = 3.7; z < 100; z += 8.3)
        expect(height(land, x, z) - height(terrain, x, z)).toBeCloseTo(
          x > 10 && x < 90 && z > 10 && z < 90 ? 0.244 : 0.18,
          4,
        );
    disposeTerrainSemanticObject(object);
    terrain.geometry.dispose();
  });

  it.each([3, 5, 9])('keeps pedestrian fills and paths above parking on grid %i', (resolution) => {
    const ctx = context(resolution);
    const terrain = ground(ctx);
    for (const reverse of [false, true]) {
      const tile = createEmptyTerrainSemanticTile();
      tile.landcover = ['parking', 'plaza', 'footway'].map((className) => ({
        class: className,
        polygons: [footprint],
      }));
      if (reverse) tile.landcover.reverse();
      tile.transportation = [
        {
          class: 'path',
          subclass: 'footway',
          width: 4,
          lines: [
            [
              [0, 0.5],
              [1, 0.5],
            ],
          ],
        },
      ];
      const object = createTerrainSemanticObject(tile, ctx, {
        renderBuildings: false,
        maxTreesPerTile: 0,
        surfaces: { style: 'minimal', details: { inferParking: false } },
      });
      const areas = object.getObjectByName('surface:areas') as THREE.Mesh;
      const path = object.getObjectByName('semantic:transportation') as THREE.Mesh;
      const shoulders = object.getObjectByName('surface:edges') as THREE.Mesh;
      object.updateMatrixWorld(true);
      for (let x = 3.7; x < 98; x += 7.1) {
        for (const z of [48.3, 50.3, 51.7]) {
          const y = height(terrain, x, z);
          const hits = new THREE.Raycaster(
            new THREE.Vector3(x, 100, z),
            new THREE.Vector3(0, -1, 0),
          ).intersectObject(areas);
          const elevations = [...new Set(hits.map((hit) => (hit.point.y - y).toFixed(3)))].sort();
          expect(elevations).toEqual(['0.300', '0.380', '0.400']);
          expect(height(path, x, z) - height(areas, x, z)).toBeGreaterThan(0.025);
        }
        // The narrow path shoulders also stay above parking, rather than cutting into it.
        expect(height(shoulders, x, 52.15) - height(terrain, x, 52.15)).toBeGreaterThan(0.38);
      }
      disposeTerrainSemanticObject(object);
    }
    terrain.geometry.dispose();
  });

  it('preserves holes and tile bounds while removing hidden land-cover faces', () => {
    const ctx = context(9),
      tile = createEmptyTerrainSemanticTile();
    const polygon = {
      ...footprint,
      holes: [
        [
          [0.4, 0.4],
          [0.6, 0.4],
          [0.6, 0.6],
          [0.4, 0.6],
        ],
      ],
    } as TerrainSemanticPolygon;
    tile.landcover = Array.from({ length: 40 }, () => ({
      class: 'urban_area',
      polygons: [polygon],
    }));
    const object = createTerrainSemanticObject(tile, ctx, {
      renderTransportation: false,
      renderBuildings: false,
      maxTreesPerTile: 0,
    });
    const mesh = object.getObjectByName('semantic:landcover') as THREE.Mesh;
    const expanded = mesh.geometry.toNonIndexed();
    const p = expanded.getAttribute('position');
    let area = 0;
    for (let i = 0; i < p.count; i += 3) {
      area +=
        Math.abs(
          (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) -
            (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i)),
        ) / 2;
      for (let j = 0; j < 3; j++) {
        expect(p.getX(i + j)).toBeGreaterThanOrEqual(0);
        expect(p.getX(i + j)).toBeLessThanOrEqual(100);
        expect(p.getZ(i + j)).toBeGreaterThanOrEqual(0);
        expect(p.getZ(i + j)).toBeLessThanOrEqual(100);
      }
    }
    expect(area).toBeCloseTo(10000 - 400, 1);
    mesh.updateMatrixWorld(true);
    const rays = (x: number, z: number) =>
      new THREE.Raycaster(
        new THREE.Vector3(x, 100, z),
        new THREE.Vector3(0, -1, 0),
      ).intersectObject(mesh);
    expect(rays(50.3, 49.7)).toHaveLength(0);
    const layers = new Set(rays(20.3, 30.7).map((h) => h.point.y.toFixed(5)));
    expect(layers.size).toBe(1);
    expanded.dispose();
    disposeTerrainSemanticObject(object);
  });

  it('keeps absolute elevated line profiles independent of terrain', () => {
    const object = createTerrainLinearObject(
      [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
      context(3),
      {
        bands: [{ width: 3, color: '#888888', elevationMode: 'absolute', elevation: 40 }],
      },
    );
    for (const x of [1, 17, 39, 74, 99]) expect(height(object, x, 50)).toBeCloseTo(40, 5);
    disposeTerrainSemanticObject(object);
  });
});
