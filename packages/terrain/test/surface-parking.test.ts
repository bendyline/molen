import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { pointInPolygon } from '../src/polygon';
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticPoint,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from '../src/semantic-types';
import { SurfaceNetwork } from '../src/surface-network';
import { inferTerrainParkingAreas } from '../src/surface-parking';
import { resolveTerrainSurfaceStyle } from '../src/surface-styles';

const rectangle = (x: number, z: number, w: number, h: number): TerrainSemanticPolygon => ({
  outer: [
    [x, z],
    [x + w, z],
    [x + w, z + h],
    [x, z + h],
  ],
});
function pavement(tile: TerrainSemanticTile, size = 200): (point: TerrainSemanticPoint) => boolean {
  const lots = inferTerrainParkingAreas(
    tile,
    new SurfaceNetwork(tile, size, resolveTerrainSurfaceStyle()),
    size,
  );
  return (point) => lots.some((f) => f.polygons.some((p) => pointInPolygon(point, p)));
}

it('fills the three reported Sammamish service courts, including both sides of the tile seam', () => {
  const fixtures = JSON.parse(
    readFileSync(new URL('./fixtures/sammamish-service-courts.json', import.meta.url), 'utf8'),
  ) as { tile: TerrainSemanticTile }[];
  const samples: TerrainSemanticPoint[][] = [
    [[0.99, 0.685]],
    [
      [0.005, 0.69],
      [0.01, 0.7],
      [0.015, 0.723],
    ],
    [
      [0.15, 0.125],
      [0.19, 0.15],
      [0.18, 0.43],
      [0.18, 0.4],
      [0.11, 0.345],
    ],
  ];
  for (const [i, { tile }] of fixtures.entries()) {
    const paved = pavement(tile, 823);
    for (const point of samples[i] ?? [])
      expect(paved(point), `reported lot ${i} at ${point}`).toBe(true);
  }
});

it('uses wider aisle pairs near large buildings while preserving mapped exclusions', () => {
  const t = createEmptyTerrainSemanticTile();
  t.transportation = [
    {
      class: 'service',
      lines: [
        [
          [0.1, 0.25],
          [0.9, 0.25],
        ],
        [
          [0.1, 0.475],
          [0.9, 0.475],
        ],
      ],
    },
  ];
  expect(pavement(t)([0.3, 0.36])).toBe(false);
  t.buildings = [{ polygons: [rectangle(0.35, 0.49, 0.3, 0.1)] }];
  t.landcover = [
    { class: 'landuse', subclass: 'garden', polygons: [rectangle(0.2, 0.32, 0.05, 0.08)] },
  ];
  t.water = [{ polygons: [rectangle(0.7, 0.32, 0.05, 0.08)] }];
  const paved = pavement(t);
  expect(paved([0.3, 0.36])).toBe(true);
  for (const point of [
    [0.22, 0.35],
    [0.72, 0.35],
    [0.5, 0.53],
  ] as TerrainSemanticPoint[])
    expect(paved(point)).toBe(false);
  t.transportation.push({
    class: 'residential',
    lines: [
      [
        [0, 0.36],
        [1, 0.36],
      ],
    ],
  });
  expect(pavement(t)([0.3, 0.36])).toBe(false);
});

it('honors parking_aisle metadata even without a site or building', () => {
  const t = createEmptyTerrainSemanticTile();
  t.transportation = [
    {
      class: 'minor_road',
      service: 'parking_aisle',
      lines: [
        [
          [0.1, 0.25],
          [0.9, 0.25],
        ],
        [
          [0.1, 0.475],
          [0.9, 0.475],
        ],
      ],
    },
  ];
  expect(pavement(t)([0.5, 0.36])).toBe(true);
});

it('fills angled, conjoining service aisles near a building without requiring a complete loop', () => {
  const t = createEmptyTerrainSemanticTile();
  t.transportation = [
    {
      class: 'service',
      lines: [
        [
          [0.1, 0.2],
          [0.7, 0.2],
        ],
        [
          [0.1, 0.2],
          [0.65, 0.5],
        ],
      ],
    },
  ];
  t.buildings = [{ polygons: [rectangle(0.3, 0.05, 0.3, 0.1)] }];
  expect(pavement(t)([0.35, 0.25])).toBe(true);
  t.buildings = [];
  expect(pavement(t)([0.35, 0.25])).toBe(false);
});

function courts(): TerrainSemanticTile {
  const t = createEmptyTerrainSemanticTile();
  // The large loop has no aisle pair within 60 m. A small entrance loop shares its access road.
  // Its endpoints touch the interior of the long road, as in an unsplit source feature.
  t.transportation = [
    {
      class: 'service',
      lines: [
        [
          [0.05, 0.2],
          [0.8, 0.2],
          [0.8, 0.65],
          [0.2, 0.65],
          [0.2, 0.2],
        ],
        [
          [0.07, 0.2],
          [0.07, 0.1],
          [0.17, 0.1],
          [0.17, 0.2],
        ],
      ],
    },
  ];
  t.buildings = [{ polygons: [rectangle(0.6, 0.4, 0.1, 0.2)] }];
  return t;
}

it('fills connected service-road loops, splits T junctions, and cuts around buildings and water', () => {
  const t = courts();
  t.water = [{ polygons: [rectangle(0.3, 0.35, 0.1, 0.1)] }];
  t.landcover = [{ class: 'grass', polygons: [rectangle(0.3, 0.55, 0.1, 0.1)] }];
  const paved = pavement(t);
  expect(paved([0.48, 0.48])).toBe(true);
  expect(paved([0.12, 0.15])).toBe(true);
  for (const p of [
    [0.35, 0.4],
    [0.35, 0.6],
    [0.65, 0.5],
    [0.1, 0.6],
    [0.9, 0.6],
  ] as TerrainSemanticPoint[])
    expect(paved(p)).toBe(false);
  // Winding and source line direction cannot change the bounded faces.
  for (const line of t.transportation[0]?.lines ?? []) line.reverse();
  expect(pavement(t)([0.48, 0.48])).toBe(true);
  // MVT simplification can move an endpoint slightly off the road it joins.
  const endpoint = t.transportation[0]?.lines[0]?.[0];
  if (endpoint) endpoint[1] += 0.001;
  expect(pavement(t)([0.48, 0.48])).toBe(true);
});

it('does not infer courts from ordinary streets, private driveways, other grades or open roads', () => {
  for (const properties of [
    { class: 'residential' },
    { service: 'driveway' },
    { service: 'alley' },
    { bridge: true },
    { tunnel: true },
    { layer: 1 },
    { surface: 'gravel' },
  ]) {
    const t = courts();
    t.transportation = t.transportation.map((f) => ({ ...f, ...properties }));
    expect(pavement(t)([0.48, 0.48]), JSON.stringify(properties)).toBe(false);
  }
  const t = courts();
  t.buildings = [];
  expect(pavement(t)([0.48, 0.48])).toBe(false);
  t.buildings = courts().buildings;
  t.landcover = [{ class: 'residential', polygons: [rectangle(0, 0, 1, 1)] }];
  expect(pavement(t)([0.48, 0.48])).toBe(false);
  t.landcover = [];
  t.transportation[0]?.lines[0]?.pop();
  expect(pavement(t)([0.48, 0.48])).toBe(false);
});
