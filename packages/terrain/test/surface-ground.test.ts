import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import { sampleTerrainLine } from '../src/linear-features';
import { pointInPolygon } from '../src/polygon';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
} from '../src/semantic-types';
import { createTerrainSurfaceObject, disposeTerrainSurfaceObject } from '../src/surface-client';
import { SurfaceNetwork } from '../src/surface-network';
import { inferTerrainParkingAreas } from '../src/surface-parking';
import { resolveTerrainSurfaceStyle } from '../src/surface-styles';

function context(): TerrainPyramidTileLayerContext {
  return {
    address: { level: 1, x: 0, z: 0 },
    tileSize: 100,
    origin: [0, 0],
    pyramid: { maxLevel: 1 },
    heightfield: new Heightfield(new Float32Array(9).fill(0.5), 3, 3, {
      origin: [0, 0],
      worldSize: [100, 100],
      height: { min: 0, max: 20 },
    }),
  } as TerrainPyramidTileLayerContext;
}
const street: TerrainTransportationFeature = {
  class: 'minor_road',
  subclass: 'residential',
  width: 10,
  lines: [
    [
      [0, 0.5],
      [1, 0.5],
    ],
  ],
};
const footpath: TerrainTransportationFeature = {
  class: 'path',
  subclass: 'footway',
  width: 2.4,
  lines: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
  ],
};
function hits(object: THREE.Object3D, name: string, x: number, z: number): THREE.Intersection[] {
  object.updateMatrixWorld(true);
  const mesh = object.getObjectByName(name);
  if (!mesh) return [];
  return new THREE.Raycaster(
    new THREE.Vector3(x, 30, z),
    new THREE.Vector3(0, -1, 0),
  ).intersectObject(mesh);
}
function color(hit: THREE.Intersection): THREE.Color {
  const mesh = hit.object as THREE.Mesh;
  const i = hit.face?.a ?? 0,
    c = mesh.geometry.getAttribute('color');
  return new THREE.Color(c.getX(i), c.getY(i), c.getZ(i));
}
function distance(a: THREE.Color, b: THREE.Color): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}
it.each([
  false,
  true,
])('removes footpath/asphalt overlap independent of feature order (reversed=%s)', (reverse) => {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation = reverse ? [footpath, street] : [street, footpath];
  const object = createTerrainSurfaceObject(tile, context(), { style: 'minimal' });
  const palette = resolveTerrainSurfaceStyle('minimal');
  for (const x of [49.13, 50.17, 51.03])
    for (const z of [45.01, 46.8, 49.3, 52.7, 54.99]) {
      const road = hits(object, 'semantic:transportation', x, z);
      expect(road.length).toBeGreaterThan(0);
      expect(road.every((h) => distance(color(h), new THREE.Color(palette.road)) < 1e-6)).toBe(
        true,
      );
      expect(hits(object, 'surface:edges', x, z)).toHaveLength(0);
    }
  for (const z of [10.3, 44.99, 55.01, 89.7]) {
    const path = hits(object, 'semantic:transportation', 50.17, z);
    expect(path.length).toBeGreaterThan(0);
    expect(path.every((h) => distance(color(h), new THREE.Color(palette.path)) < 1e-6)).toBe(true);
  }
  expect(hits(object, 'surface:edges', 20.1, 55.15).length).toBeGreaterThan(0);
  expect(hits(object, 'surface:edges', 20.1, 50.1)).toHaveLength(0);
  disposeTerrainSurfaceObject(object);
});

it.each([
  { layer: 1 },
  { bridge: true },
])('retains footpaths beneath grade-separated roads (%j)', (grade) => {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation = [{ ...street, ...grade }, footpath];
  const network = new SurfaceNetwork(tile, 100, resolveTerrainSurfaceStyle());
  const path = network.roads.find((r) => r.kind === 'path');
  if (!path) throw Error('Missing path');
  const points: [number, number][] = [
    [49, 40],
    [51, 40],
    [51, 60],
    [49, 60],
  ];
  expect(network.clipPath(points, path)).toEqual([points]);
});

it('trims paths against curved road edges without deleting their approach', () => {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation = [
    {
      ...street,
      lines: [
        [
          [0, 0.4],
          [0.5, 0.4],
          [0.6, 0.6],
          [1, 0.6],
        ],
      ],
    },
    {
      ...footpath,
      lines: [
        [
          [0.55, 0],
          [0.55, 1],
        ],
      ],
    },
  ];
  const object = createTerrainSurfaceObject(tile, context(), { style: 'minimal' });
  const roadColor = new THREE.Color(resolveTerrainSurfaceStyle().road);
  const along = hits(object, 'semantic:transportation', 55.07, 50.03);
  expect(along.length).toBeGreaterThan(0);
  expect(along.every((h) => distance(color(h), roadColor) < 1e-6)).toBe(true);
  expect(hits(object, 'semantic:transportation', 55.07, 20.03).length).toBeGreaterThan(0);
  disposeTerrainSurfaceObject(object);
});

it('keeps mapped shopping-center footways above the inferred Sammamish parking pavement', () => {
  const tile = JSON.parse(
    readFileSync(new URL('./fixtures/sammamish-parking.json', import.meta.url), 'utf8'),
  ) as TerrainSemanticTile;
  const ctx = { ...context(), tileSize: 823 };
  const network = new SurfaceNetwork(tile, ctx.tileSize, resolveTerrainSurfaceStyle());
  const lots = inferTerrainParkingAreas(tile, network, ctx.tileSize);
  const object = createTerrainSurfaceObject(tile, ctx, {
    details: { parkedCars: false, streetlights: false, trafficSignals: false },
  });
  let overlaps = 0;
  for (const road of network.roads) {
    if (road.kind !== 'path' || road.feature.bridge) continue;
    for (let d = 1.3; d < road.path.length; d += 3.7) {
      const { x, z } = sampleTerrainLine(road.path, d);
      if (
        !lots.some((lot) =>
          lot.polygons.some((polygon) =>
            pointInPolygon([x / ctx.tileSize, z / ctx.tileSize], polygon),
          ),
        )
      )
        continue;
      const pavement = hits(object, 'surface:areas', x, z)[0];
      const path = hits(object, 'semantic:transportation', x, z)[0];
      if (!pavement || !path || network.occupied(x, z)) continue;
      expect(path.point.y - pavement.point.y, `footway over parking at ${x},${z}`).toBeGreaterThan(
        0.12,
      );
      overlaps++;
    }
  }
  expect(overlaps).toBeGreaterThan(0);
  disposeTerrainSurfaceObject(object);
});

it('paves a turning circle inside the footway ring at a dead end, and only there', () => {
  // A 100 m tile: a residential street ending at x = 50 m, and a 2.4 m footway ringing a 9 m
  // circle centered 6 m beyond the end, open toward the street.
  const size = 100;
  const center: [number, number] = [56, 50];
  const ring: [number, number][] = [];
  for (let degrees = -140; degrees <= 140; degrees += 10) {
    const angle = (degrees * Math.PI) / 180;
    ring.push([
      (center[0] + Math.cos(angle) * 10.2) / size,
      (center[1] + Math.sin(angle) * 10.2) / size,
    ]);
  }
  const deadEnd: TerrainTransportationFeature = {
    ...street,
    lines: [
      [
        [0, 0.5],
        [0.5, 0.5],
      ],
    ],
  };
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation = [deadEnd, { ...footpath, lines: [ring] }];
  const network = new SurfaceNetwork(tile, size, resolveTerrainSurfaceStyle());
  network.findTurningCircles();
  expect(network.turningCircles).toHaveLength(1);
  const circle = network.turningCircles[0];
  if (!circle) throw Error('Missing circle');
  // It ends at the footway's inner edge (10.2 - 1.2 m), never under the footway.
  expect(circle.radius).toBeGreaterThan(8);
  expect(circle.radius).toBeLessThanOrEqual(9.05);
  expect(Math.hypot(circle.center[0] - center[0], circle.center[1] - center[1])).toBeLessThan(2.5);
  // Inside it counts as paving; the lawn beyond the footway does not.
  expect(network.occupied(center[0], center[1])).toBe(true);
  expect(network.occupied(center[0] + 14, center[1])).toBe(false);
  // A sidewalk wrapped tightly round a plain stub (3.3 m beyond its end, 4 m to each side) gets
  // a rounded asphalt end that stops at the sidewalk's inner edge.
  const wrap: [number, number][] = [
    [46, 20],
    [46, 49],
    [47, 52.6],
    [50, 53.3],
    [53, 52.6],
    [54, 49],
    [54, 20],
  ].map(([x, z]) => [(x as number) / size, (z as number) / size]);
  const stubTile = createEmptyTerrainSemanticTile();
  stubTile.transportation = [
    {
      ...street,
      width: 6,
      lines: [
        [
          [0.5, 0],
          [0.5, 0.5],
        ],
      ],
    },
    { ...footpath, lines: [wrap] },
    // A connector from the end to the wrap, which is not the ring.
    {
      ...footpath,
      lines: [
        [
          [0.5, 0.5],
          [0.5, 0.533],
        ],
      ],
    },
  ];
  const stub = new SurfaceNetwork(stubTile, size, resolveTerrainSurfaceStyle());
  stub.findTurningCircles();
  expect(stub.turningCircles).toHaveLength(1);
  const cap = stub.turningCircles[0];
  if (!cap) throw Error('Missing cap');
  expect(cap.radius).toBeGreaterThan(1.5);
  expect(cap.center[1] + cap.radius).toBeLessThanOrEqual(53.3 - 1.1);
  // A dead end with only a straight footway nearby keeps its plain end.
  const lone = createEmptyTerrainSemanticTile();
  lone.transportation = [deadEnd, footpath];
  const plain = new SurfaceNetwork(lone, size, resolveTerrainSurfaceStyle());
  plain.findTurningCircles();
  expect(plain.turningCircles).toHaveLength(0);
});
