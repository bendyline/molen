import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Heightfield } from '../src/heightfield';
import {
  createTerrainLinearObject,
  sampleTerrainLine,
  terrainLinePath,
} from '../src/linear-features';
import { pointInPolygon } from '../src/polygon';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { createTerrainSemanticObject, disposeTerrainSemanticObject } from '../src/semantic-client';
import {
  assertTerrainSemanticTile,
  createEmptyTerrainSemanticTile,
  type TerrainSemanticPolygon,
  type TerrainTransportationFeature,
} from '../src/semantic-types';
import {
  createTerrainSurfaceObject,
  createTerrainSurfaceRenderer,
  disposeTerrainSurfaceObject,
  type TerrainSurfaceStats,
} from '../src/surface-client';
import { SurfaceNetwork } from '../src/surface-network';
import { inferTerrainParkingAreas } from '../src/surface-parking';
import { resolveTerrainSurfaceStyle } from '../src/surface-styles';

function context(): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 0, z: 0 },
    tileSize: 200,
    origin: [1000, 2000],
    pyramid: {
      name: 'surface-test',
      origin: [1000, 2000],
      rootSize: 1600,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 3,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(
      new Float32Array([0, 0.2, 0.1, 0.3, 0.8, 0.4, 0.1, 0.2, 0]),
      3,
      3,
      { origin: [1000, 2000], worldSize: [200, 200], height: { min: 0, max: 20 } },
    ),
    signal: new AbortController().signal,
  };
}

function fixture() {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation.push(
    {
      class: 'major_road',
      subclass: 'primary',
      width: 12,
      lanes: 4,
      lines: [
        [
          [-0.1, 0.3],
          [1.1, 0.3],
        ],
      ],
    },
    {
      class: 'minor_road',
      subclass: 'residential',
      width: 8,
      lines: [
        [
          [0.3, -0.1],
          [0.3, 1.1],
        ],
      ],
    },
  );
  tile.landcover.push({
    class: 'parking',
    polygons: [
      {
        outer: [
          [0.45, 0.45],
          [1.1, 0.45],
          [1.1, 1.1],
          [0.45, 1.1],
        ],
        holes: [
          [
            [0.6, 0.6],
            [0.6, 0.73],
            [0.73, 0.73],
            [0.73, 0.6],
          ],
        ],
      },
    ],
  });
  return tile;
}

function stats(object: THREE.Object3D): TerrainSurfaceStats {
  return object.userData.surfaceStats as TerrainSurfaceStats;
}
function positions(object: THREE.Object3D, name: string) {
  return (object.getObjectByName(name) as THREE.Mesh).geometry.getAttribute('position');
}

describe('parameterized line features', () => {
  it('samples by arc length, removes duplicates, and joins both edges at a right-angle bend', () => {
    const path = terrainLinePath(
      [
        [0, 0],
        [0.5, 0],
        [0.5, 0],
        [0.5, 0.5],
      ],
      100,
    );
    expect(path.length).toBe(100);
    expect(sampleTerrainLine(path, 25, 2)).toMatchObject({ x: 24, z: 2 });
    expect(sampleTerrainLine(path, 50, 2)).toMatchObject({ x: 48, z: 2 });
    expect(sampleTerrainLine(path, 75, 2)).toMatchObject({ x: 48, z: 26 });
  });

  it('uses the same profile engine for rail bands, sleepers, and elevated utilities', () => {
    const ctx = context();
    const tracks = createTerrainLinearObject(
      [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
      ctx,
      {
        bands: [
          { width: 0.1, offset: -0.72, color: '#aaaaaa' },
          { width: 0.1, offset: 0.72, color: '#aaaaaa' },
        ],
        repeaters: [{ spacing: 4, size: [2.5, 0.2, 0.25], color: '#776655' }],
      },
    );
    expect((tracks.getObjectByName('linear:repeaters') as THREE.InstancedMesh).count).toBe(50);
    const wires = createTerrainLinearObject(
      [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
      ctx,
      {
        bands: [{ width: 0.05, color: '#333333', elevationMode: 'absolute', elevation: 30 }],
      },
    );
    const p = positions(wires, 'linear:bands');
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBe(30);
    disposeTerrainSurfaceObject(tracks);
    disposeTerrainSurfaceObject(wires);
  });

  it('clips buffered ribbons to the tile and limits pathological repeaters', () => {
    const object = createTerrainLinearObject(
      [
        [
          [-1, 0.5],
          [2, 0.5],
        ],
      ],
      context(),
      {
        bands: [{ width: 6, color: '#aaaaaa', dash: [3, 2] }],
        maxElements: 8,
        repeaters: [{ spacing: 0.0001, size: [1, 1, 1], color: '#ffffff' }],
      },
    );
    expect(object.children.length).toBeLessThanOrEqual(2);
    object.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh || (child as THREE.InstancedMesh).isInstancedMesh) return;
      const p = (child as THREE.Mesh).geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        expect(p.getX(i)).toBeGreaterThanOrEqual(0);
        expect(p.getX(i)).toBeLessThanOrEqual(200);
      }
    });
    expect(() =>
      createTerrainLinearObject(
        [
          [
            [0, 0],
            [1, 1],
          ],
        ],
        context(),
        {
          bands: [{ width: 1, color: '#ffffff', dash: [0, 0] }],
        },
      ),
    ).toThrow(/dash/);
  });
});

describe('surface styles', () => {
  it('infers parking only between commercial service aisles and cuts around buildings', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover.push({
      class: 'commercial',
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
    });
    tile.transportation.push({
      class: 'minor_road',
      subclass: 'service',
      lines: [
        [
          [0.1, 0.3],
          [0.9, 0.3],
        ],
        [
          [0.1, 0.4],
          [0.9, 0.4],
        ],
      ],
    });
    tile.buildings.push({
      polygons: [
        {
          outer: [
            [0.45, 0.25],
            [0.55, 0.25],
            [0.55, 0.5],
            [0.45, 0.5],
          ],
        },
      ],
    });
    const network = new SurfaceNetwork(tile, 200, resolveTerrainSurfaceStyle());
    const inferred = inferTerrainParkingAreas(tile, network, 200);
    expect(inferred.length).toBeGreaterThan(0);
    expect(inferred.some((f) => f.polygons.some((p) => pointInPolygon([0.2, 0.35], p)))).toBe(true);
    expect(inferred.some((f) => f.polygons.some((p) => pointInPolygon([0.5, 0.35], p)))).toBe(
      false,
    );
    expect(
      stats(createTerrainSurfaceObject(tile, context(), { details: { inferParking: false } }))
        .parkingAreas,
    ).toBe(0);
    tile.landcover[0] = {
      ...(tile.landcover[0] as (typeof tile.landcover)[number]),
      class: 'residential',
    };
    expect(inferTerrainParkingAreas(tile, network, 200)).toEqual([]);
    (tile.transportation[0] as TerrainTransportationFeature).lines.push([
      [0.1, 0.5],
      [0.9, 0.5],
    ]);
    const cluster = new SurfaceNetwork(tile, 200, resolveTerrainSurfaceStyle());
    expect(inferTerrainParkingAreas(tile, cluster, 200).length).toBeGreaterThan(0);
  });
  it('builds fully paved parking with holes, clipped markings, four corner lights and bounded parked cars', () => {
    const tile = fixture();
    const ctx = context();
    const object = createTerrainSurfaceObject(tile, ctx, { details: { maxFixturesPerTile: 30 } });
    expect(stats(object)).toMatchObject({
      roads: 2,
      parkingAreas: 1,
      junctions: 1,
      streetlights: 4,
      trafficSignals: 4,
    });
    expect(stats(object).parkingBays).toBeGreaterThan(30);
    expect(stats(object).parkedCars).toBeGreaterThan(0);
    expect(stats(object).parkedCars).toBeLessThanOrEqual(26);
    const polygon = tile.landcover[0]?.polygons[0] as TerrainSemanticPolygon;
    const p = positions(object, 'surface:areas');
    let area = 0;
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 600;
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 600;
      expect(pointInPolygon([x, z], polygon)).toBe(true);
      area +=
        Math.abs(
          (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) -
            (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i)),
        ) / 2;
    }
    expect(area).toBeCloseTo(110 * 110 - 26 * 26, 1);
    for (let i = 0; i < p.count; i++) {
      expect(p.getX(i)).toBeGreaterThanOrEqual(0);
      expect(p.getX(i)).toBeLessThanOrEqual(200);
      // Exact rendered-triangle heights (including interiors) are covered by surface-drape.test.ts.
      expect(p.getY(i)).toBeGreaterThanOrEqual(0.3);
      expect(p.getY(i)).toBeLessThanOrEqual(20.3);
    }
    const cars = object.userData.vehicles as import('@bendyline/molen-schema').VehiclePlacement[];
    expect(new Set(cars.map((car) => car.id)).size).toBe(cars.length);
    expect(new Set(cars.map((car) => car.kind)).size).toBeGreaterThan(1);
    expect(
      cars.some((car) => Math.abs(car.pitch ?? 0) > 0.001 || Math.abs(car.roll ?? 0) > 0.001),
    ).toBe(true);
    for (const car of cars) {
      expect(
        pointInPolygon(
          [(car.position[0] - ctx.origin[0]) / 200, (car.position[2] - ctx.origin[1]) / 200],
          polygon,
        ),
      ).toBe(true);
    }
  });

  it('keeps lane dividers out of intersections and does not detect bridges or grade-separated crossings', () => {
    const tile = fixture();
    const object = createTerrainSurfaceObject(tile, context());
    const p = positions(object, 'surface:markings');
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      expect(Math.hypot(x - 60, z - 60)).toBeGreaterThan(6);
    }
    (tile.transportation[1] as TerrainTransportationFeature).bridge = true;
    expect(stats(createTerrainSurfaceObject(tile, context())).junctions).toBe(0);
    (tile.transportation[1] as TerrainTransportationFeature).bridge = false;
    (tile.transportation[1] as TerrainTransportationFeature).layer = 1;
    expect(stats(createTerrainSurfaceObject(tile, context())).junctions).toBe(0);
    (tile.transportation[1] as TerrainTransportationFeature).tunnel = true;
    expect(stats(createTerrainSurfaceObject(tile, context())).roads).toBe(1);
  });

  it('treats a T-junction as three arms, and a bend as no junction', () => {
    const tile = fixture();
    (tile.transportation[1] as TerrainTransportationFeature).lines = [
      [
        [0.3, 0.3],
        [0.3, 1],
      ],
    ];
    const object = createTerrainSurfaceObject(tile, context());
    expect(stats(object)).toMatchObject({ junctions: 1, streetlights: 3, trafficSignals: 0 });
    tile.transportation = [
      {
        class: 'residential',
        lines: [
          [
            [0, 0.5],
            [0.5, 0.5],
            [0.5, 1],
          ],
        ],
      },
    ];
    expect(stats(createTerrainSurfaceObject(tile, context())).junctions).toBe(0);
  });

  it('suppresses modern details in 1910, honors explicit widths, and supports custom treatments', () => {
    const tile = fixture();
    const old = createTerrainSurfaceObject(tile, context(), { style: '1910' });
    expect(stats(old)).toMatchObject({
      parkingAreas: 1,
      parkingBays: 0,
      parkedCars: 0,
      streetlights: 0,
      trafficSignals: 0,
    });
    expect(old.getObjectByName('surface:street-fixtures')).toBeUndefined();
    expect(old.getObjectByName('surface:parked-cars')).toBeUndefined();
    expect(old.getObjectByName('surface:areas')).toBeDefined();
    const custom = resolveTerrainSurfaceStyle({
      ...resolveTerrainSurfaceStyle('1910'),
      id: 'gaslight',
      streetlights: true,
    });
    expect(custom.markings).toBe(false);
    expect(custom.streetlights).toBe(true);
    const ctx = context();
    ctx.address.level = 2;
    const coarse = createTerrainSurfaceObject(tile, ctx);
    expect(coarse.getObjectByName('surface:markings')).toBeUndefined();
    expect(coarse.getObjectByName('surface:areas')).toBeDefined();
  });

  it('keeps the newest live style, releases old GPU buffers, and unregisters disposed tiles', async () => {
    const controller = createTerrainSurfaceRenderer();
    const object = createTerrainSemanticObject(fixture(), context(), {
      surfaceRenderer: controller,
      renderBuildings: false,
      renderLandcover: false,
      renderWater: false,
    });
    const geometry = (object.getObjectByName('surface:areas') as THREE.Mesh).geometry;
    const dispose = vi.spyOn(geometry, 'dispose');
    const a = controller.setOptions({ style: '1910' });
    const b = controller.setOptions({ style: 'minimal' });
    await Promise.all([a, b]);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(controller.stats()).toMatchObject({ style: 'minimal', tiles: 1, parkedCars: 0 });
    await controller.setOptions({ style: 'modern' });
    expect(controller.stats().parkedCars).toBeGreaterThan(0);
    disposeTerrainSemanticObject(object);
    expect(controller.stats().tiles).toBe(0);
    await controller.setOptions({ style: '1910' });
    controller.dispose();
  });

  it('validates budgets and road metadata at the public boundary', () => {
    expect(() => resolveTerrainSurfaceStyle('modern', { maxFixturesPerTile: Infinity })).toThrow();
    expect(() => resolveTerrainSurfaceStyle('modern', { parkingOccupancy: -1 })).toThrow();
    const tile = fixture();
    (tile.transportation[0] as TerrainTransportationFeature).lanes = 0;
    expect(() => assertTerrainSemanticTile(tile)).toThrow(/lanes/);
    const zero = createTerrainSurfaceObject(fixture(), context(), {
      details: { maxDetailElements: 0, maxFixturesPerTile: 0 },
    });
    expect(stats(zero)).toMatchObject({
      parkedCars: 0,
      streetlights: 0,
      parkingBays: 0,
      detailLimited: true,
    });
  });
});
