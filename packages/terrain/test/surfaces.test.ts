import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Heightfield } from '../src/heightfield';
import {
  createTerrainLinearObject,
  sampleTerrainLine,
  TERRAIN_PAVEMENT,
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
import type { TerrainParkedVehicle, TerrainSurfaceDetails } from '../src/surface-styles';
import { resolveTerrainSurfaceStyle } from '../src/surface-styles';
import { PARKED_VEHICLES } from './helpers/content';

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

/** Pairs of a mesh's triangles that overlap in plan at one height: one plane, so they z-fight. */
function coplanarOverlaps(object: THREE.Object3D, name: string): number {
  const p = positions(object, name);
  const triangles: number[][][] = [];
  for (let i = 0; i + 2 < p.count; i += 3) {
    const t = [0, 1, 2].map((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]);
    const [a, b, c] = t as [number[], number[], number[]];
    // Curb faces and other risers have no area in plan.
    const area =
      ((b[0] as number) - (a[0] as number)) * ((c[2] as number) - (a[2] as number)) -
      ((b[2] as number) - (a[2] as number)) * ((c[0] as number) - (a[0] as number));
    if (Math.abs(area) > 1e-6) triangles.push(t);
  }
  const cells = new Map<string, number[]>();
  triangles.forEach((t, n) => {
    const xs = t.map((v) => v[0] as number),
      zs = t.map((v) => v[2] as number);
    for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++)
      for (let z = Math.floor(Math.min(...zs)); z <= Math.floor(Math.max(...zs)); z++) {
        const cell = cells.get(`${x}/${z}`) ?? [];
        cell.push(n);
        cells.set(`${x}/${z}`, cell);
      }
  });
  // A point's height on a triangle, if the point lies strictly inside it in plan.
  const heightIn = (t: number[][], x: number, z: number): number | undefined => {
    const [a, b, c] = t as [number[], number[], number[]];
    const [ax, ay, az] = a as [number, number, number],
      [bx, by, bz] = b as [number, number, number],
      [cx, cy, cz] = c as [number, number, number];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
    if (u < 1e-4 || v < 1e-4 || 1 - u - v < 1e-4) return undefined;
    return u * ay + v * by + (1 - u - v) * cy;
  };
  const weights = [
    [1 / 3, 1 / 3],
    [0.6, 0.2],
    [0.2, 0.6],
    [0.2, 0.2],
  ];
  const pairs = new Set<string>();
  for (const cell of cells.values())
    for (let i = 0; i < cell.length; i++)
      for (let j = i + 1; j < cell.length; j++) {
        const [m, n] = [cell[i] as number, cell[j] as number].sort((a, b) => a - b) as [
          number,
          number,
        ];
        const key = `${m}/${n}`;
        if (pairs.has(key)) continue;
        const [a, b, c] = triangles[m] as [number[], number[], number[]];
        for (const [u, v] of weights as [number, number][]) {
          const at = [0, 1, 2].map(
            (k) => u * (a[k] as number) + v * (b[k] as number) + (1 - u - v) * (c[k] as number),
          ) as [number, number, number];
          const y = heightIn(triangles[n] as number[][], at[0], at[2]);
          if (y !== undefined && Math.abs(y - at[1]) < 0.0005) {
            pairs.add(key);
            break;
          }
        }
      }
  return pairs.size;
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
    const object = createTerrainSurfaceObject(tile, ctx, {
      details: { maxFixturesPerTile: 30, parkedVehicles: PARKED_VEHICLES },
    });
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
    // A narrow fringe of the lot's surface frays into the ground around its edges.
    const edges = object.getObjectByName('surface:edges') as THREE.Mesh;
    const detail = edges.geometry.getAttribute('surfaceDetail');
    let fringe = 0;
    for (let i = 0; i < detail.count; i++)
      if (Math.floor(detail.getZ(i) / 128 + 0.001) === 5) {
        fringe++;
        expect([1, 2]).toContain(detail.getW(i));
      }
    expect(fringe).toBeGreaterThan(0);
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

  it('pins parked-car placements, which the vehicle type specs drive', () => {
    // The expanded eleven-vehicle content pool drives both kind selection and wheel-sampled poses.
    const object = createTerrainSurfaceObject(fixture(), context(), {
      details: { maxFixturesPerTile: 30, parkedVehicles: PARKED_VEHICLES },
    });
    const cars = object.userData.vehicles as unknown[];
    const digest = createHash('sha256').update(JSON.stringify(cars)).digest('hex').slice(0, 16);
    expect({ count: cars.length, digest }).toEqual({ count: 26, digest: '3f63e0f4f0076a51' });
  });

  it('draws parked cars from an injected vehicle list', () => {
    const fromLibrary = PARKED_VEHICLES;
    const place = (parkedVehicles: TerrainSurfaceDetails['parkedVehicles']) => {
      const object = createTerrainSurfaceObject(fixture(), context(), {
        details: { maxFixturesPerTile: 30, parkedVehicles },
      });
      return { cars: object.userData.vehicles as { kind: string }[], stats: stats(object) };
    };
    const same = place(fromLibrary).cars;
    const digest = createHash('sha256').update(JSON.stringify(same)).digest('hex').slice(0, 16);
    expect(digest).toBe('3f63e0f4f0076a51');
    const van = fromLibrary.find((vehicle) => vehicle.id === 'molen.entities.vehicle.van');
    expect(van).toBeDefined();
    const vans = place([van as TerrainParkedVehicle]).cars;
    expect(new Set(vans.map((car) => car.kind))).toEqual(new Set(['molen.entities.vehicle.van']));
    const none = place([]);
    expect(none.cars).toEqual([]);
    expect(none.stats.parkedCars).toBe(0);
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

  it('stacks crossing roads, shared stall lines and all, so no two pieces of paving share a plane', () => {
    const object = createTerrainSurfaceObject(fixture(), context());
    expect(stats(object).parkingBays).toBeGreaterThan(30);
    for (const name of ['semantic:transportation', 'surface:edges', 'surface:markings'])
      expect(coplanarOverlaps(object, name), name).toBe(0);
  });

  it('splits roads that would lie on themselves: hairpin carriageways and a looped cul-de-sac', () => {
    const tile = createEmptyTerrainSemanticTile();
    // Round the loop from the stem's end and back to it.
    const loop = Array.from({ length: 17 }, (_, i): [number, number] => {
      const angle = Math.PI / 2 + (i * Math.PI) / 8;
      return i % 16 === 0
        ? [0.8, 0.55]
        : [0.8 + Math.cos(angle) * 0.05, 0.5 + Math.sin(angle) * 0.05];
    });
    tile.transportation = [
      {
        // Two one-way carriageways 11 m apart that join end to end where the road narrows.
        class: 'major_road',
        subclass: 'secondary',
        oneway: true,
        width: 8,
        lines: [
          [
            [0.05, 0.7],
            [0.6, 0.7],
          ],
          [
            [0.6, 0.7],
            [0.05, 0.755],
          ],
        ],
      },
      {
        class: 'minor_road',
        subclass: 'residential',
        name: 'Loop Court',
        lines: [[[0.8, 0.95], ...loop]],
      },
    ];
    const network = new SurfaceNetwork(tile, 200, resolveTerrainSurfaceStyle());
    expect(network.roads).toHaveLength(4);
    const ring = network.roads.find((road) => road.path.points.length === 17);
    expect(ring?.path.points[0]).toEqual(ring?.path.points.at(-1));
    const object = createTerrainSurfaceObject(tile, context());
    for (const name of ['semantic:transportation', 'surface:edges', 'surface:markings'])
      expect(coplanarOverlaps(object, name), name).toBe(0);
  });

  it('lines a residential block with utility poles and hydrants beside the road, not on it', () => {
    const tile = fixture();
    tile.landcover = [];
    tile.buildings = [];
    tile.transportation = [
      {
        class: 'residential',
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    ];
    const object = createTerrainSurfaceObject(tile, context());
    expect(stats(object).streetFurniture).toBeGreaterThan(4);
    const boxes = object.getObjectByName('surface:street-fixtures') as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    let poles = 0;
    for (let i = 0; i < boxes.count; i++) {
      boxes.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);
      if (scale.y < 8) continue;
      poles++;
      // Behind the sidewalk, clear of the carriageway.
      expect(Math.abs(position.z - 100)).toBeGreaterThan(4);
    }
    expect(poles).toBeGreaterThan(2);
    const plain = createTerrainSurfaceObject(tile, context(), {
      details: { streetlights: false },
    });
    expect(stats(plain).streetFurniture).toBe(0);
  });

  it('puts mailboxes and bins behind the sidewalks of residential streets in residential land', () => {
    const tile = fixture();
    tile.buildings = [];
    tile.transportation = [
      {
        class: 'minor_road',
        subclass: 'residential',
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    ];
    const posts = (object: THREE.Object3D): number[] => {
      const boxes = object.getObjectByName('surface:street-fixtures') as
        | THREE.InstancedMesh
        | undefined;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const found: number[] = [];
      for (let i = 0; i < (boxes?.count ?? 0); i++) {
        boxes?.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);
        // A mailbox post: about a meter tall and a few centimeters across.
        if (Math.abs(scale.y - 1.04) < 0.01 && scale.x < 0.1) found.push(position.z);
      }
      return found;
    };
    tile.landcover = [];
    expect(posts(createTerrainSurfaceObject(tile, context()))).toHaveLength(0);
    tile.landcover = [
      {
        class: 'residential',
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
    const found = posts(createTerrainSurfaceObject(tile, context()));
    expect(found.length).toBeGreaterThan(4);
    // On both sides, behind the sidewalk and clear of the carriageway.
    expect(found.some((z) => z < 100)).toBe(true);
    expect(found.some((z) => z > 100)).toBe(true);
    for (const z of found) expect(Math.abs(z - 100)).toBeGreaterThan(4);
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
    await controller.setOptions({ style: 'modern', details: { parkedVehicles: PARKED_VEHICLES } });
    expect(controller.stats().parkedCars).toBeGreaterThan(0);
    disposeTerrainSemanticObject(object);
    expect(controller.stats().tiles).toBe(0);
    await controller.setOptions({ style: '1910' });
    controller.dispose();
  });

  it('dresses pavement in a host material on resident and later tiles, and restores it', async () => {
    const controller = createTerrainSurfaceRenderer();
    const options = {
      surfaceRenderer: controller,
      renderBuildings: false,
      renderLandcover: false,
      renderWater: false,
    };
    const first = createTerrainSemanticObject(fixture(), context(), options);
    const pavement = new THREE.MeshStandardMaterial({ name: 'pavement' });
    const meshes = (object: THREE.Object3D): THREE.Mesh[] => {
      const found: THREE.Mesh[] = [];
      object.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.userData[TERRAIN_PAVEMENT] === true)
          found.push(o as THREE.Mesh);
      });
      return found;
    };
    const plain = meshes(first)[0]?.material;
    expect(meshes(first).length).toBeGreaterThan(0);
    // Every pavement mesh carries the band coordinates the material reads.
    for (const mesh of meshes(first))
      expect(mesh.geometry.getAttribute('surfaceDetail')?.itemSize).toBe(4);
    controller.setMaterial(pavement);
    for (const mesh of meshes(first)) expect(mesh.material).toBe(pavement);
    const second = createTerrainSemanticObject(fixture(), context(), options);
    for (const mesh of meshes(second)) expect(mesh.material).toBe(pavement);
    // Fixtures and parked cars keep their own materials.
    expect(
      (second.getObjectByName('surface:street-fixtures') as THREE.Mesh | undefined)?.material,
    ).not.toBe(pavement);
    controller.setMaterial(undefined);
    for (const mesh of meshes(first)) expect(mesh.material).toBe(plain);
    disposeTerrainSemanticObject(first);
    disposeTerrainSemanticObject(second);
    controller.dispose();
    pavement.dispose();
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
