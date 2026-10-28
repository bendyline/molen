import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { setTerrainGroundCutout, TerrainGroundCutoutController } from '../src/ground-cutout';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { renderedGroundSampler } from '../src/rendered-ground';
import {
  createDefaultTerrainSemanticRenderer,
  createTerrainSemanticObject,
  createTerrainSemanticObjectSliced,
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
    // Trees, plus the utility poles strung along the primary road's sidewalk.
    const fixtures = instances.filter((instance) => instance.name === 'surface:street-fixtures');
    expect(fixtures).toHaveLength(1);
    const trees = instances.filter((instance) => !fixtures.includes(instance));
    expect(trees).toHaveLength(2);
    expect(trees.map((instance) => instance.count)).toEqual([8, 8]);
    expect(object.getObjectByName('semantic:landcover')).toBeInstanceOf(THREE.Mesh);
    expect(object.getObjectByName('semantic:water')).toBeInstanceOf(THREE.Mesh);
    expect(object.getObjectByName('semantic:waterways')).toBeInstanceOf(THREE.Mesh);
    // Ribbon normals come from the ribbon's frame: unit length, facing up.
    const ribbon = (object.getObjectByName('semantic:waterways') as THREE.Mesh).geometry;
    const normal = ribbon.getAttribute('normal');
    expect(normal.count).toBe(ribbon.getAttribute('position').count);
    for (let i = 0; i < normal.count; i++) {
      expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 5);
      expect(normal.getY(i)).toBeGreaterThan(0.5);
    }
    expect(object.getObjectByName('semantic:transportation')).toBeInstanceOf(THREE.Mesh);
    const roads = object.getObjectByName('semantic:transportation') as THREE.Mesh;
    expect(roads.geometry.getAttribute('position').count).toBeGreaterThan(6);
    const buildings = object.getObjectByName('semantic:buildings') as THREE.Mesh;
    expect(buildings).toBeInstanceOf(THREE.Mesh);
    buildings.geometry.computeBoundingBox();
    expect(buildings.geometry.boundingBox?.min.y).toBeCloseTo(10);
    expect(buildings.geometry.boundingBox?.max.y).toBeCloseTo(22);
  });

  it('builds buildings as prisms: up-facing roofs, outward walls, a floor only when raised', () => {
    const ring = (x: number, z: number, w: number): [number, number][] => [
      [x, z],
      [x + w, z],
      [x + w, z + w],
      [x, z + w],
    ];
    const tile = semanticTile();
    tile.buildings = [
      // A courtyard block (hole wound like the outer ring) and a raised part.
      { height: 12, polygons: [{ outer: ring(0.2, 0.2, 0.2), holes: [ring(0.25, 0.25, 0.1)] }] },
      { height: 4, minHeight: 6, polygons: [{ outer: ring(0.6, 0.6, 0.1).reverse() }] },
    ];
    const ctx = context();
    const object = createTerrainSemanticObject(tile, ctx, { buildingColors: undefined });
    const geometry = (object.getObjectByName('semantic:buildings') as THREE.Mesh).geometry;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const size = ctx.tileSize;
    let roof = 0,
      floor = 0;
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      n = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      const face = b.clone().sub(a).cross(c.clone().sub(a));
      n.fromBufferAttribute(normal, i);
      // Each triangle faces the way its normal says.
      expect(face.dot(n)).toBeGreaterThan(0);
      if (n.y > 0.5) roof += face.length() / 2;
      if (n.y < -0.5) floor += face.length() / 2;
      if (Math.abs(n.y) < 0.5) {
        // Walls point away from the solid: from the block's centre, or into its courtyard.
        const mid = a.clone().add(b).add(c).divideScalar(3);
        const centre = new THREE.Vector3(mid.x < size / 2 ? 0.3 * size : 0.65 * size, 0, 0);
        centre.z = centre.x;
        const away = new THREE.Vector3(mid.x - centre.x, 0, mid.z - centre.z);
        // Courtyard walls stand on its edge, 0.25 to 0.35 of the tile on both axes.
        const within = (v: number) => v > 0.25 * size - 1e-3 && v < 0.35 * size + 1e-3;
        const inner = within(mid.x) && within(mid.z);
        expect(Math.sign(away.dot(n))).toBe(inner ? -1 : 1);
      }
    }
    const tileArea = size * size;
    expect(roof).toBeCloseTo((0.04 - 0.01 + 0.01) * tileArea, 3);
    // Only the raised part shows its underside.
    expect(floor).toBeCloseTo(0.01 * tileArea, 3);
  });

  it('builds the same buildings a slice at a time, and stops once cancelled', async () => {
    const tile = semanticTile();
    tile.buildings = Array.from({ length: 40 }, (_, i) => {
      const x = 0.05 + (i % 8) * 0.11,
        z = 0.05 + Math.floor(i / 8) * 0.18;
      return {
        id: i,
        height: 5 + i,
        polygons: [
          {
            outer: [
              [x, z],
              [x + 0.05, z],
              [x + 0.05, z + 0.05],
              [x, z + 0.05],
            ] as [number, number][],
          },
        ],
      };
    });
    tile.water.push({
      class: 'lake',
      polygons: [
        {
          outer: [
            [0.6, 0.85],
            [0.95, 0.85],
            [0.95, 0.98],
            [0.6, 0.98],
          ],
        },
      ],
    });
    const options = {
      renderLandcover: false,
      renderTransportation: false,
      buildingColors: {
        roofs: [['#884422', 1]] as [string, number][],
        walls: [['#ccbbaa', 1]] as [string, number][],
      },
    };
    const whole = createTerrainSemanticObject(tile, context(), options);
    let slices = 0;
    // A zero-length slice yields after every footprint.
    const sliced = await createTerrainSemanticObjectSliced(
      tile,
      context(),
      options,
      async (slice) => {
        slices++;
        return slice();
      },
      0,
    );
    expect(slices).toBeGreaterThan(10);
    expect(sliced?.name).toBe(whole.name);
    const meshes = (group: THREE.Object3D | undefined) => {
      const found: THREE.Mesh[] = [];
      group?.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) found.push(child as THREE.Mesh);
      });
      return found;
    };
    expect(meshes(sliced).map((mesh) => mesh.name)).toEqual(
      expect.arrayContaining(['semantic:water', 'semantic:buildings']),
    );
    expect(meshes(sliced).map((mesh) => mesh.name)).toEqual(meshes(whole).map((mesh) => mesh.name));
    for (const [i, mesh] of meshes(whole).entries()) {
      const twin = meshes(sliced)[i] as THREE.Mesh;
      for (const name of Object.keys(mesh.geometry.attributes))
        expect(twin.geometry.getAttribute(name).array).toEqual(
          mesh.geometry.getAttribute(name).array,
        );
      expect(twin.material).toBe(mesh.material);
    }

    const controller = new AbortController();
    const cancelled = await createTerrainSemanticObjectSliced(
      tile,
      { ...context(), signal: controller.signal },
      options,
      async (slice) => {
        controller.abort();
        return slice();
      },
      0,
    );
    expect(cancelled).toBeUndefined();
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
    expect(material.customProgramCacheKey()).toBe('terrain-water@3:[]');
    expect(() => setTerrainWaterTime(material, 2.5, [100, 200])).not.toThrow();
  });
  it('closes banks against a separate raised landcover layer when this tile renders only water', () => {
    const ctx = context();
    ctx.heightfield = new Heightfield(new Float32Array([0.1, 0.8, 0.35, 0.95]), 2, 2, {
      origin: ctx.origin,
      worldSize: [ctx.tileSize, ctx.tileSize],
      height: { min: 0, max: 20 },
    });
    const object = createTerrainSemanticObject(semanticTile(), ctx, {
      renderLandcover: false,
      renderBuildings: false,
      renderTransportation: false,
    });
    const water = object.getObjectByName('semantic:water') as THREE.Mesh;
    const bank = object.getObjectByName('semantic:water-banks') as THREE.Mesh;
    expect(bank).toBeInstanceOf(THREE.Mesh);
    const waterY = water.geometry.getAttribute('position').getY(0);
    const points = bank.geometry.getAttribute('position');
    const sample = renderedGroundSampler(ctx.heightfield, ctx.origin, ctx.tileSize);
    for (let i = 0; i < points.count; i++) {
      const y = points.getY(i);
      if (y > waterY + 1e-5)
        expect(y).toBeCloseTo(
          sample(ctx.origin[0] + points.getX(i), ctx.origin[1] + points.getZ(i)) + 0.18,
          4,
        );
    }
    disposeTerrainSemanticObject(object);
  });

  it('opens shoreline walls for a resident landing without changing water or source heights', () => {
    const ctx = context();
    ctx.heightfield = new Heightfield(new Float32Array([0.1, 0.8, 0.35, 0.95]), 2, 2, {
      origin: ctx.origin,
      worldSize: [ctx.tileSize, ctx.tileSize],
      height: { min: 0, max: 20 },
    });
    const samples = ctx.heightfield.copySamples();
    const object = createTerrainSemanticObject(semanticTile(), ctx, {
      renderLandcover: false,
      renderBuildings: false,
      renderTransportation: false,
    });
    const water = object.getObjectByName('semantic:water') as THREE.Mesh;
    const bank = object.getObjectByName('semantic:water-banks') as THREE.Mesh;
    const sourceBank = bank.geometry,
      sourceWater = water.geometry;
    sourceBank.computeBoundingBox();
    const bounds = sourceBank.boundingBox as THREE.Box3;
    const middle = (bounds.min.x + bounds.max.x) / 2;
    const landing = new THREE.Object3D();
    setTerrainGroundCutout(landing, [
      [bounds.min.x - 1, bounds.min.z - 1],
      [middle, bounds.min.z - 1],
      [middle, bounds.max.z + 1],
      [bounds.min.x - 1, bounds.max.z + 1],
    ]);
    object.add(landing);
    object.updateMatrixWorld(true);
    const cuts = new TerrainGroundCutoutController();
    expect(cuts.update(object)).toBe(true);
    expect(bank.geometry).not.toBe(sourceBank);
    expect(water.geometry).toBe(sourceWater);
    const positions = bank.geometry.getAttribute('position');
    const indices = bank.geometry.index as THREE.BufferAttribute;
    expect(indices.count).toBeGreaterThan(0);
    for (let i = 0; i < indices.count; i++)
      expect(positions.getX(indices.getX(i))).toBeGreaterThanOrEqual(middle - 1e-5);
    expect(ctx.heightfield.copySamples()).toEqual(samples);
    const disposed = vi.spyOn(bank.geometry, 'dispose');
    landing.visible = false;
    expect(cuts.update(object)).toBe(true);
    expect(bank.geometry).toBe(sourceBank);
    expect(water.geometry).toBe(sourceWater);
    expect(disposed).toHaveBeenCalledOnce();
    cuts.dispose();
    disposeTerrainSemanticObject(object);
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

  it('estimates lake level from its interior instead of raising water onto shoreline banks', () => {
    const ctx = context();
    const samples = new Float32Array(81).fill(0.25);
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 9; x++)
        if (x === 0 || x === 8 || y === 0 || y === 8) samples[y * 9 + x] = 0.9;
    ctx.heightfield = new Heightfield(samples, 9, 9, {
      origin: ctx.origin,
      worldSize: [ctx.tileSize, ctx.tileSize],
      height: { min: 0, max: 20 },
    });
    const tile = semanticTile();
    tile.water = [
      {
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
    ];
    const object = createTerrainSemanticObject(tile, ctx, {
      renderLandcover: false,
      renderTransportation: false,
      renderBuildings: false,
    });
    const water = object.getObjectByName('semantic:water') as THREE.Mesh;
    const p = water.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBeCloseTo(5.65);
    disposeTerrainSemanticObject(object);
  });

  it('draws the sea as one flat level in every tile, above noisy coastal bathymetry', () => {
    const levels = [0.02, 0.4].map((floor) => {
      const ctx = context();
      // Heights normalized over -20..20 m: a floor of -19 m or -4 m, with +1.2 m shoreline noise.
      const samples = new Float32Array(81).fill(floor);
      samples[40] = (1.2 + 20) / 40;
      ctx.heightfield = new Heightfield(samples, 9, 9, {
        origin: ctx.origin,
        worldSize: [ctx.tileSize, ctx.tileSize],
        height: { min: -20, max: 20 },
      });
      const tile = semanticTile();
      tile.water = [
        {
          class: 'ocean',
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
      ];
      const object = createTerrainSemanticObject(tile, ctx, {
        renderLandcover: false,
        renderTransportation: false,
        renderBuildings: false,
        seaLevel: 0,
      });
      const water = object.getObjectByName('semantic:water') as THREE.Mesh;
      const y = water.geometry.getAttribute('position').getY(0);
      disposeTerrainSemanticObject(object);
      return y;
    });
    // 1.5 m over sea level plus the 0.65 m water offset, whatever the depth, covering the +1.2 m.
    expect(levels[0]).toBeCloseTo(2.15, 6);
    expect(levels[1]).toBeCloseTo(2.15, 6);
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
