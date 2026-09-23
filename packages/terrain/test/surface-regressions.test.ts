import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import {
  createTerrainLinearObject,
  joinTerrainLines,
  sampleTerrainLine,
  terrainLinePath,
} from '../src/linear-features';
import { pointInPolygon } from '../src/polygon';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import type { TerrainSemanticTile } from '../src/semantic-types';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';
import { disposeTerrainSurfaceObject } from '../src/surface-client';
import { SurfaceNetwork } from '../src/surface-network';
import { inferTerrainParkingAreas } from '../src/surface-parking';
import { resolveTerrainSurfaceStyle } from '../src/surface-styles';

it('fills the mapped Sammamish shopping-center aisle ladder', () => {
  const tile = JSON.parse(
    readFileSync(new URL('./fixtures/sammamish-parking.json', import.meta.url), 'utf8'),
  ) as TerrainSemanticTile;
  const size = 823;
  const n = new SurfaceNetwork(tile, size, resolveTerrainSurfaceStyle());
  const lots = inferTerrainParkingAreas(tile, n, size);

  for (const z of [0.7, 0.725, 0.75, 0.79, 0.815, 0.84, 0.86, 0.9, 0.92])
    expect(
      lots.some((f) => f.polygons.some((p) => pointInPolygon([0.15, z], p))),
      `pavement at ${z}`,
    ).toBe(true);
});

it('keeps offset edges continuous on tight bends and closes loop seams', () => {
  const path = terrainLinePath(
    [
      [0.1, 0.1],
      [0.5, 0.1],
      [0.6, 0.18],
      [0.63, 0.3],
      [0.6, 0.4],
      [0.5, 0.45],
      [0.1, 0.45],
      [0.1, 0.1],
    ],
    200,
  );
  for (const offset of [-5, 5]) {
    const first = sampleTerrainLine(path, 0, offset),
      last = sampleTerrainLine(path, path.length, offset);
    expect(first.x).toBeCloseTo(last.x, 8);
    expect(first.z).toBeCloseTo(last.z, 8);
    for (const d of path.distances.slice(1, -1)) {
      const before = sampleTerrainLine(path, d - 0.001, offset),
        after = sampleTerrainLine(path, d + 0.001, offset);
      expect(Math.hypot(before.x - after.x, before.z - after.z)).toBeLessThan(0.01);
    }
  }
});

it('joins reversed source fragments without merging branches', () => {
  const merged = joinTerrainLines([
    [
      [0.5, 0.2],
      [0.1, 0.2],
    ],
    [
      [0.5, 0.2],
      [0.7, 0.5],
    ],
    [
      [0.9, 0.5],
      [0.7, 0.5],
    ],
  ]);
  expect(merged).toHaveLength(1);
  expect(merged[0]).toHaveLength(4);
  const object = createTerrainLinearObject(merged, lineContext(), {
    bands: [{ width: 8, color: '#555555' }],
  });
  expect(object.children).toHaveLength(1);
  disposeTerrainSurfaceObject(object);
  expect(
    joinTerrainLines([
      [
        [0.1, 0.2],
        [0.5, 0.2],
      ],
      [
        [0.5, 0.2],
        [0.8, 0.2],
      ],
      [
        [0.5, 0.2],
        [0.5, 0.8],
      ],
    ]),
  ).toHaveLength(3);
});

it('renders a divided junction once and excludes short turning links', () => {
  const t = createEmptyTerrainSemanticTile();
  t.transportation = [
    {
      class: 'major_road',
      subclass: 'secondary',
      oneway: true,
      width: 8,
      lines: [
        [
          [0, 0.45],
          [1, 0.45],
        ],
        [
          [1, 0.51],
          [0, 0.51],
        ],
      ],
    },
    {
      class: 'minor_road',
      subclass: 'tertiary',
      width: 8,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    },
    {
      class: 'major_road',
      subclass: 'secondary_link',
      link: true,
      width: 5,
      lines: [
        [
          [0.44, 0.45],
          [0.5, 0.51],
        ],
      ],
    },
  ];
  const n = new SurfaceNetwork(t, 200, resolveTerrainSurfaceStyle());
  n.findJunctions();
  expect(n.junctions).toHaveLength(1);
  const junction = n.junctions[0];
  if (!junction) throw new Error('expected junction');
  expect(junction.arms).toHaveLength(4);
  for (const arm of junction.arms) {
    expect(arm.road.feature.link).not.toBe(true);
    expect(Math.abs(arm.dx) < 0.01 || Math.abs(arm.dz) < 0.01).toBe(true);
    expect(
      junction.cores.every((c) => Math.hypot(arm.x - c.x, arm.z - c.z) >= c.radius + 2.9),
    ).toBe(true);
  }
  expect(junction.arms.filter((a) => a.width > 16)).toHaveLength(2);
  // Re-running topology is idempotent.
  n.findJunctions();
  expect(n.junctions).toHaveLength(1);
});

it('keeps neighboring intersections and grade-separated junctions independent', () => {
  const t = createEmptyTerrainSemanticTile();
  t.transportation = [
    {
      class: 'secondary',
      width: 8,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    },
    {
      class: 'residential',
      width: 6,
      lines: [
        [
          [0.25, 0],
          [0.25, 1],
        ],
        [
          [0.55, 0],
          [0.55, 1],
        ],
      ],
    },
  ];
  const n = new SurfaceNetwork(t, 200, resolveTerrainSurfaceStyle());
  n.findJunctions();
  expect(n.junctions).toHaveLength(2);
  t.transportation.push(...t.transportation.map((f) => ({ ...f, layer: 1 })));
  const layers = new SurfaceNetwork(t, 200, resolveTerrainSurfaceStyle());
  layers.findJunctions();
  expect(layers.junctions).toHaveLength(4);
});

it('finds fragmented parking aisles without paving tagged driveways or ordinary streets', () => {
  const t = createEmptyTerrainSemanticTile();
  const lines = [0.3, 0.4, 0.5].flatMap((z) =>
    Array.from(
      { length: 8 },
      (_, i) =>
        [
          [0.2 + i * 0.04, z],
          [0.2 + (i + 1) * 0.04, z],
        ] as [number, number][],
    ),
  );
  const f = { class: 'minor_road', subclass: 'service', lines };
  t.transportation = [f];
  const infer = () =>
    inferTerrainParkingAreas(t, new SurfaceNetwork(t, 200, resolveTerrainSurfaceStyle()), 200);
  expect(infer().some((f) => f.polygons.some((p) => pointInPolygon([0.35, 0.45], p)))).toBe(true);
  t.transportation = [{ ...f, service: 'driveway' }];
  expect(infer()).toEqual([]);
  t.transportation = [{ ...f, subclass: 'residential' }];
  expect(infer()).toEqual([]);
});

function lineContext(): TerrainPyramidTileLayerContext {
  return {
    tileSize: 200,
    origin: [0, 0],
    heightfield: new Heightfield(new Float32Array(9), 3, 3, {
      origin: [0, 0],
      worldSize: [200, 200],
      height: { min: 0, max: 1 },
    }),
  } as TerrainPyramidTileLayerContext;
}
