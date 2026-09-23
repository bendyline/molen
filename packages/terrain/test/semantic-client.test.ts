import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import {
  createDefaultTerrainSemanticRenderer,
  createTerrainSemanticObject,
  createTerrainSemanticPyramidLayer,
  createTerrainWaterMaterial,
  disposeTerrainSemanticObject,
  setTerrainWaterTime,
} from '../src/semantic-client';
import type { TerrainSemanticTile } from '../src/semantic-types';

function context(): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 2, z: 4 },
    pyramid: {
      name: 'test',
      origin: [0, 0],
      rootSize: 800,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 2,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {
      format: 'molen/terrain@2',
      name: 'tile',
      origin: [200, 400],
      chunkSize: 100,
      tileResolution: 2,
      gridSize: [1, 1],
      height: { min: 0, max: 20 },
      tiles: { heightUrl: '' },
      layers: [],
      lod: { levels: 1, distanceBands: [], skirts: false },
      streaming: {
        loadRadius: 1,
        unloadRadius: 2,
        maxConcurrentLoads: 1,
        maxResidentTiles: 4,
      },
      collision: { enabled: false },
    },
    heightfield: new Heightfield(new Float32Array(4).fill(0.5), 2, 2, {
      origin: [200, 400],
      worldSize: [100, 100],
      height: { min: 0, max: 20 },
    }),
    origin: [200, 400],
    tileSize: 100,
    signal: new AbortController().signal,
  };
}

function semanticTile(): TerrainSemanticTile {
  return {
    format: 'molen/terrain-semantics@1',
    landcover: [
      {
        class: 'temperate_forest',
        density: 1,
        polygons: [
          {
            outer: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          },
        ],
      },
    ],
    water: [
      {
        polygons: [
          {
            outer: [
              [0.05, 0.05],
              [0.2, 0.05],
              [0.2, 0.2],
              [0.05, 0.2],
            ],
          },
        ],
      },
      {
        class: 'stream',
        width: 2,
        lines: [
          [
            [0, 0.2],
            [1, 0.25],
          ],
        ],
      },
    ],
    transportation: [
      {
        class: 'primary',
        width: 8,
        lines: [
          [
            [0, 0.5],
            [0.5, 0.55],
            [1, 0.5],
          ],
        ],
      },
    ],
    buildings: [
      {
        height: 12,
        polygons: [
          {
            outer: [
              [0.35, 0.35],
              [0.5, 0.35],
              [0.5, 0.5],
              [0.35, 0.5],
            ],
          },
        ],
      },
    ],
  };
}

describe('normalized semantic mesh adapter', () => {
  it('builds instanced trees and combined water, road, and building meshes', () => {
    const object = createTerrainSemanticObject(semanticTile(), context(), {
      treesPerSquareKilometer: 10_000,
      maxTreesPerTile: 8,
    });
    const instances: THREE.InstancedMesh[] = [];
    object.traverse((child) => {
      if ((child as THREE.InstancedMesh).isInstancedMesh) {
        instances.push(child as THREE.InstancedMesh);
      }
    });
    expect(instances).toHaveLength(2);
    expect(instances.map((instance) => instance.count)).toEqual([8, 8]);
    expect(object.getObjectByName('semantic:landcover')).toBeInstanceOf(THREE.Mesh);
    expect(object.getObjectByName('semantic:water')).toBeInstanceOf(THREE.Mesh);
    expect(object.getObjectByName('semantic:waterways')).toBeInstanceOf(THREE.Mesh);
    expect(object.getObjectByName('semantic:transportation')).toBeInstanceOf(THREE.Mesh);
    const roads = object.getObjectByName('semantic:transportation') as THREE.Mesh;
    expect(roads.geometry.getAttribute('position').count).toBeGreaterThan(6);
    const buildings = object.getObjectByName('semantic:buildings') as THREE.Mesh;
    expect(buildings).toBeInstanceOf(THREE.Mesh);
    buildings.geometry.computeBoundingBox();
    expect(buildings.geometry.boundingBox?.min.y).toBeCloseTo(10);
    expect(buildings.geometry.boundingBox?.max.y).toBeCloseTo(22);
  });

  it('keeps polygonal water flat to avoid visible triangulation and overlap shading', () => {
    const ctx = context();
    ctx.heightfield = new Heightfield(new Float32Array([0.1, 0.8, 0.35, 0.95]), 2, 2, {
      origin: [200, 400],
      worldSize: [100, 100],
      height: { min: 0, max: 20 },
    });
    const object = createTerrainSemanticObject(semanticTile(), ctx, {
      renderLandcover: false,
      renderTransportation: false,
      renderBuildings: false,
    });
    const water = object.getObjectByName('semantic:water') as THREE.Mesh;
    const positions = water.geometry.getAttribute('position');
    const heights = new Set<number>();
    for (let index = 0; index < positions.count; index++) {
      heights.add(Number(positions.getY(index).toFixed(5)));
    }
    expect(heights.size).toBe(1);
    expect(water.userData.terrainWaterSurface).toBe(true);
  });

  it('creates opaque animated water materials that tolerate overlapping LOD coverage', () => {
    const material = createTerrainWaterMaterial({ opacity: 1, waveStrength: 0.05 });
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.userData.terrainWaterMaterial).toBe(true);
    expect(material.customProgramCacheKey()).toBe('terrain-water@1');
    expect(() => setTerrainWaterTime(material, 2.5, [100, 200])).not.toThrow();
  });

  it('disposes generated tile geometry but preserves shared instanced assets', () => {
    const object = createTerrainSemanticObject(semanticTile(), context(), {
      treesPerSquareKilometer: 10_000,
      maxTreesPerTile: 2,
    });
    const generated: THREE.BufferGeometry[] = [];
    const shared: THREE.BufferGeometry[] = [];
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.userData.terrainOwnedGeometry === true) generated.push(mesh.geometry);
      else shared.push(mesh.geometry);
    });
    const generatedSpies = generated.map((geometry) => vi.spyOn(geometry, 'dispose'));
    const sharedSpies = shared.map((geometry) => vi.spyOn(geometry, 'dispose'));
    disposeTerrainSemanticObject(object);
    expect(generatedSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(sharedSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it('connects source and renderer lifecycles through a generic adaptive layer', async () => {
    const ctx = context();
    const source = { load: vi.fn(async () => semanticTile()) };
    const renderer = createDefaultTerrainSemanticRenderer({
      renderLandcover: false,
      renderWater: false,
      renderTransportation: false,
      renderBuildings: false,
    });
    const layer = createTerrainSemanticPyramidLayer({
      id: 'semantic-test',
      category: 'human-feature',
      minLevel: 2,
      source,
      renderer,
    });
    const object = await layer.createTile(ctx);
    expect(source.load).toHaveBeenCalledWith(ctx.address, ctx.signal);
    expect(object?.name).toBe('terrain-semantics:3/2/4');
    layer.disposeTile?.(object as THREE.Object3D);
  });
});

describe('degenerate building rings', () => {
  const degenerateHoleTile = (): TerrainSemanticTile => ({
    format: 'molen/terrain-semantics@1',
    landcover: [],
    water: [],
    transportation: [],
    buildings: [
      {
        height: 12,
        polygons: [
          {
            outer: [
              [0.2, 0.2],
              [0.8, 0.2],
              [0.8, 0.8],
              [0.2, 0.8],
            ],
            holes: [
              [
                [0.5, 0.5],
                [0.5, 0.5],
                [0.5, 0.5],
              ],
            ],
          },
        ],
      },
    ],
  });

  it('reports the offending ring instead of faulting inside the triangulator', () => {
    expect(() => createTerrainSemanticObject(degenerateHoleTile(), context())).toThrow(
      /\/buildings\/0\/polygons\/0\/holes\/0 must enclose an area/,
    );
  });

  it('still extrudes the footprint when a decoder skips contract validation', async () => {
    vi.resetModules();
    vi.doMock('../src/semantic-types', async (importOriginal) => ({
      ...(await importOriginal<typeof import('../src/semantic-types')>()),
      assertTerrainSemanticTile: (): void => {},
    }));
    try {
      const unvalidated = await import('../src/semantic-client');
      const object = unvalidated.createTerrainSemanticObject(degenerateHoleTile(), context());
      const buildings = object.getObjectByName('semantic:buildings') as THREE.Mesh | undefined;
      expect(buildings?.geometry.getAttribute('position').count).toBeGreaterThan(0);
    } finally {
      vi.doUnmock('../src/semantic-types');
      vi.resetModules();
    }
  });
});
