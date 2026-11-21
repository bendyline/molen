import {
  createDefaultTerrainSemanticRenderer,
  createTerrainSemanticObject,
  disposeTerrainSemanticObject,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  type TerrainPackageDescriptor,
  type TerrainSemanticPolygon,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import { type Mesh, Raycaster, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  earthWaterMeshOptions,
  readEarthWaterFeatures,
  selectEarthWaterFeatures,
  withEarthShorelineRoadMask,
  withEarthWaterShorelines,
} from '../src/client/water-features';

it('sets a bounded stage on a shared river feature across tiles', async () => {
  const scale = 0.72;
  const stageOutline = (
    [
      [30, 22],
      [143, 22],
      [143, 74],
      [30, 74],
    ] as [number, number][]
  ).map(([x, z]) => worldToWgs84(scale, x, z));
  const stages = readEarthWaterFeatures({
    format: 'molen/earth-water-features@1',
    features: [{ id: 71, elevation: 41, stageOutline }],
  });
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const options = earthWaterMeshOptions(stages, descriptor);
  const renderer = withEarthWaterShorelines(
    createDefaultTerrainSemanticRenderer(options),
    stages,
    descriptor,
  );
  const context = (x: number): TerrainPyramidTileLayerContext => {
    const origin: [number, number] = [x, 0];
    return {
      address: { level: 15, x: x / 100, z: 0 },
      tileSize: 100,
      origin,
      pyramid: { metersPerUnit: scale },
      heightfield: new Heightfield(new Float32Array(4).fill(0.5), 2, 2, {
        origin,
        worldSize: [100, 100],
        height: { min: 0, max: 30 },
      }),
    } as TerrainPyramidTileLayerContext;
  };
  const tile = createEmptyTerrainSemanticTile();
  tile.water = [
    {
      id: 71,
      polygons: [
        {
          outer: [
            [0, 0.3],
            [1, 0.3],
            [1, 0.62],
            [0, 0.62],
          ],
        },
      ],
    },
    {
      id: 72,
      polygons: [
        {
          outer: [
            [0.4, 0.65],
            [0.7, 0.65],
            [0.7, 0.73],
            [0.4, 0.73],
          ],
        },
      ],
    },
  ];
  const initial = JSON.stringify(tile);
  const west = await renderer.createTile(tile, context(0));
  const east = await renderer.createTile(tile, context(100));
  if (!west || !east) throw new Error('Expected water in both review tiles');
  const at = (object: NonNullable<typeof west>, x: number, z: number) => {
    object.updateMatrixWorld(true);
    const mesh = object.getObjectByName('semantic:water') as Mesh;
    return new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0)).intersectObject(
      mesh,
      false,
    )[0]?.point.y;
  };
  expect(at(west, 20, 43)).toBeCloseTo(15.65);
  expect(at(west, 98, 43)).toBe(41);
  expect(at(east, 2, 43)).toBe(41);
  expect(at(east, 55, 43)).toBeCloseTo(15.65);
  expect(at(west, 60, 68)).toBeCloseTo(15.65);
  expect(at(west, 36, 26)).toBeUndefined();
  expect(JSON.stringify(tile)).toBe(initial);
  expect(
    (await renderer.createEmptyTile?.(context(0)))?.getObjectByName('semantic:water'),
  ).toBeUndefined();
  renderer.disposeTile?.(west);
  renderer.disposeTile?.(east);
});

it('uses a dated shoreline only for its declared interval', () => {
  const shoreline = [
    [0, 0],
    [0.001, 0],
    [0.001, 0.001],
    [0, 0.001],
  ];
  const dated = {
    id: -7,
    shoreline,
    elevation: 8,
    validFrom: '1670-01-01',
    validUntil: '1671-01-01',
  };
  const document = {
    format: 'molen/earth-water-features@1',
    features: [{ id: 1, elevation: 9 }, dated],
  };
  const water = readEarthWaterFeatures(document);
  const keysAt = (date?: string) => [...(selectEarthWaterFeatures(water, date)?.keys() ?? [])];
  expect(keysAt()).toEqual(['1']);
  expect(keysAt('1669-12-31')).toEqual(['1']);
  expect(keysAt('1670-01-01')).toEqual(['1', '-7']);
  expect(keysAt('1671-01-01')).toEqual(['1']);
  expect(() =>
    readEarthWaterFeatures({
      ...document,
      features: [{ ...dated, validUntil: '1669-12-31' }],
    }),
  ).toThrow('Invalid');
});

it('clips grade-level roads under the expanded shore and keeps dry segments and bridges', async () => {
  const scale = 0.72;
  const shoreline = (
    [
      [25, 20],
      [75, 20],
      [75, 80],
      [25, 80],
    ] as [number, number][]
  ).map(([x, z]) => worldToWgs84(scale, x, z));
  const styles = readEarthWaterFeatures({
    format: 'molen/earth-water-features@1',
    features: [{ id: -7, elevation: 9, shoreline, clearSurfaceRoads: true }],
  });
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const context = {
    origin: [0, 0],
    tileSize: 100,
    pyramid: { metersPerUnit: scale },
  } as TerrainPyramidTileLayerContext;
  const tile = createEmptyTerrainSemanticTile();
  const line: [number, number][] = [
    [0, 0.5],
    [1, 0.5],
  ];
  tile.transportation = [
    { id: 1, class: 'primary', lines: [line] },
    { id: 2, class: 'primary', bridge: true, lines: [line] },
    {
      id: 3,
      class: 'path',
      lines: [
        [
          [0.4, 0.6],
          [0.6, 0.6],
        ],
      ],
    },
  ];
  const renderer = withEarthShorelineRoadMask(
    {
      createTile(updated) {
        expect(updated.transportation.map((road) => road.id)).toEqual([1, 2]);
        const clipped = updated.transportation[0]?.lines;
        expect(clipped).toHaveLength(2);
        expect(clipped?.[0]?.[1]?.[0]).toBeCloseTo(0.25);
        expect(clipped?.[1]?.[0]?.[0]).toBeCloseTo(0.75);
        expect(updated.transportation[1]).toBe(tile.transportation[1]);
        return null;
      },
    },
    styles,
    descriptor,
  );
  await renderer.createTile(tile, context);
  expect(tile.transportation).toHaveLength(3);
  expect(tile.transportation[0]?.lines).toEqual([line]);
});

it('renders separate mapped stages for one relation and omits a dry spillway', () => {
  const stages = readEarthWaterFeatures({
    format: 'molen/earth-water-features@1',
    features: [
      { id: 1, split: { anchor: [0, 0], heading: 0, negativeZ: 315.43, positiveZ: 370.65 } },
      { id: 2, hidePolygons: true },
    ],
  });
  const ring = (
    west: number,
    north: number,
    east: number,
    south: number,
  ): TerrainSemanticPolygon => ({
    outer: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
  });
  const north = ring(0.1, 0.15, 0.3, 0.3);
  const south = ring(0.65, 0.7, 0.8, 0.85);
  const tile = createEmptyTerrainSemanticTile();
  tile.water = [
    { id: 1, polygons: [north, south] },
    { id: 2, polygons: [ring(0.4, 0.4, 0.6, 0.6)] },
  ];
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const origin: [number, number] = [-50, -50];
  const context = {
    address: { level: 15, x: 0, z: 0 },
    tileSize: 100,
    origin,
    pyramid: { metersPerUnit: 0.78 },
    heightfield: new Heightfield(new Float32Array(4).fill(0.6), 2, 2, {
      origin,
      worldSize: [100, 100],
      height: { min: 0, max: 500 },
    }),
  } as TerrainPyramidTileLayerContext;
  const group = createTerrainSemanticObject(
    tile,
    context,
    earthWaterMeshOptions(stages, descriptor),
  );
  const mesh = group.getObjectByName('semantic:water') as Mesh;
  const position = mesh.geometry.getAttribute('position');
  const renderedStages = new Set<number>();
  for (let i = 0; i < position.count; i++) renderedStages.add(Number(position.getY(i).toFixed(2)));
  expect(renderedStages).toEqual(new Set([315.43, 370.65]));
  expect(position.count).toBe(8);
  disposeTerrainSemanticObject(group);
});

it('clips a supplemental shoreline across tiles at a common height', async () => {
  const scale = 0.78;
  const shoreline = [
    [50, 20],
    [150, 20],
    [150, 80],
    [50, 80],
  ].map(([x, z]) => worldToWgs84(scale, x as number, z as number));
  const stages = readEarthWaterFeatures({
    format: 'molen/earth-water-features@1',
    features: [{ id: -1, elevation: 23, shoreline }],
  });
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const base = createDefaultTerrainSemanticRenderer(earthWaterMeshOptions(stages, descriptor));
  const renderer = withEarthWaterShorelines(base, stages, descriptor);
  expect(withEarthWaterShorelines(base, stages, { ...descriptor, features: undefined })).toBe(base);
  const tile = createEmptyTerrainSemanticTile();
  const context = (x: number): TerrainPyramidTileLayerContext => {
    const origin: [number, number] = [x, 0];
    return {
      address: { level: 15, x: x / 100, z: 0 },
      tileSize: 100,
      origin,
      pyramid: { metersPerUnit: scale },
      heightfield: new Heightfield(new Float32Array(4), 2, 2, {
        origin,
        worldSize: [100, 100],
        height: { min: 0, max: 50 },
      }),
    } as TerrainPyramidTileLayerContext;
  };
  const left = await renderer.createTile(tile, context(0));
  const right = await renderer.createEmptyTile?.(context(100));
  for (const [object, minX, maxX] of [
    [left, 50, 100],
    [right, 0, 50],
  ] as const) {
    expect(object).toBeDefined();
    const positions = (object?.getObjectByName('semantic:water') as Mesh).geometry.getAttribute(
      'position',
    );
    const xs = Array.from({ length: positions.count }, (_, i) => {
      expect(positions.getY(i)).toBe(23);
      return positions.getX(i);
    });
    expect(Math.min(...xs)).toBeCloseTo(minX);
    expect(Math.max(...xs)).toBeCloseTo(maxX);
    if (object) renderer.disposeTile?.(object);
  }
  expect(tile.water).toEqual([]);
  expect(await renderer.createEmptyTile?.(context(200))).toBeUndefined();
});

it('joins a supplemental shoreline to the matching stage without drawing an interior bank', async () => {
  const origin: [number, number] = [-50, -50];
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const context = {
    origin,
    address: { level: 15, x: 0, z: 0 },
    tileSize: 100,
    pyramid: { metersPerUnit: 1 },
    heightfield: new Heightfield(new Float32Array(4).fill(1), 2, 2, {
      origin,
      worldSize: [100, 100],
      height: { min: 0, max: 60 },
    }),
  } as TerrainPyramidTileLayerContext;
  const stages = readEarthWaterFeatures({
    format: 'molen/earth-water-features@1',
    features: [
      { id: 1, split: { anchor: [0, 0], heading: 0, negativeZ: 48, positiveZ: 23 } },
      {
        id: -1,
        elevation: 23,
        join: 1,
        shoreline: [
          [-20, 22],
          [20, 22],
          [20, 38],
          [-20, 38],
        ].map(([x, z]) => worldToWgs84(1, x as number, z as number)),
      },
    ],
  });
  const tile = createEmptyTerrainSemanticTile();
  tile.water = [
    {
      id: 1,
      polygons: [
        {
          outer: [
            [0.2, 0.1],
            [0.5, 0.1],
            [0.5, 0.3],
            [0.2, 0.3],
          ],
        },
        {
          outer: [
            [0.1, 0.7],
            [0.5, 0.7],
            [0.5, 0.9],
            [0.1, 0.9],
          ],
        },
      ],
    },
  ];
  const original = structuredClone(tile);
  const base = createDefaultTerrainSemanticRenderer(earthWaterMeshOptions(stages, descriptor));
  const renderer = withEarthWaterShorelines(base, stages, descriptor);
  const group = await renderer.createTile(tile, context);
  const water = (group?.getObjectByName('semantic:water') as Mesh).geometry.getAttribute(
    'position',
  );
  const waterStages = Array.from({ length: water.count }, (_, i) => water.getY(i));
  expect(new Set(waterStages)).toEqual(new Set([48, 23]));
  expect(waterStages.filter((height) => height === 23)).toHaveLength(8);
  const banks = (group?.getObjectByName('semantic:water-banks') as Mesh).geometry.getAttribute(
    'position',
  );
  for (let i = 0; i < banks.count; i += 3) {
    const zs = [banks.getZ(i), banks.getZ(i + 1), banks.getZ(i + 2)];
    if (Math.min(...zs) >= 88 || Math.max(...zs) <= 72) continue;
    const xs = [banks.getX(i), banks.getX(i + 1), banks.getX(i + 2)];
    for (const x of [30, 50]) expect(xs.every((value) => Math.abs(value - x) < 0.001)).toBe(false);
  }
  expect(tile).toEqual(original);
  if (group) renderer.disposeTile?.(group);
});

it('excludes only the overmapped wet area of the selected water feature', async () => {
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const origin: [number, number] = [0, 0];
  const context = {
    origin,
    address: { level: 15, x: 0, z: 0 },
    tileSize: 100,
    pyramid: { metersPerUnit: 1 },
    heightfield: new Heightfield(new Float32Array(4), 2, 2, {
      origin,
      worldSize: [100, 100],
      height: { min: 0, max: 80 },
    }),
  } as TerrainPyramidTileLayerContext;
  const exclude = [
    [35, 25],
    [85, 25],
    [85, 75],
    [35, 75],
  ].map(([x, z]) => worldToWgs84(1, x as number, z as number));
  const styles = readEarthWaterFeatures({
    format: 'molen/earth-water-features@1',
    features: [
      { id: 1, elevation: 30, exclude },
      { id: 2, elevation: 18 },
      { id: 3, elevation: 25, exclude },
    ],
  });
  const tile = createEmptyTerrainSemanticTile();
  tile.water = [
    {
      id: 1,
      lines: [
        [
          [0.48, 0.1],
          [0.48, 0.9],
        ],
      ],
      polygons: [
        {
          outer: [
            [0.1, 0.1],
            [0.6, 0.1],
            [0.6, 0.9],
            [0.1, 0.9],
          ],
        },
      ],
    },
    {
      id: 2,
      lines: [
        [
          [0.76, 0.1],
          [0.76, 0.9],
        ],
      ],
      polygons: [
        {
          outer: [
            [0.7, 0.1],
            [0.9, 0.1],
            [0.9, 0.9],
            [0.7, 0.9],
          ],
        },
      ],
    },
    {
      id: 3,
      polygons: [
        {
          outer: [
            [0.4, 0.4],
            [0.6, 0.4],
            [0.6, 0.6],
            [0.4, 0.6],
          ],
        },
      ],
    },
  ];
  const original = structuredClone(tile);
  const base = createDefaultTerrainSemanticRenderer(earthWaterMeshOptions(styles, descriptor));
  const renderer = withEarthWaterShorelines(base, styles, descriptor);
  const group = await renderer.createTile(tile, context);
  group?.updateMatrixWorld(true);
  const water = group?.getObjectByName('semantic:water') as Mesh;
  const elevation = (x: number, z: number) =>
    new Raycaster(new Vector3(x, 90, z), new Vector3(0, -1, 0)).intersectObject(water, false)[0]
      ?.point.y;
  expect(elevation(48, 50)).toBeUndefined();
  expect(elevation(48, 15)).toBeCloseTo(30);
  expect(elevation(21, 50)).toBeCloseTo(30);
  expect(elevation(76, 50)).toBeCloseTo(18);
  const ribbons = group?.getObjectByName('semantic:waterways') as Mesh;
  const ribbonAt = (x: number, z: number) =>
    new Raycaster(new Vector3(x, 90, z), new Vector3(0, -1, 0)).intersectObject(ribbons, false)
      .length > 0;
  expect(ribbonAt(48, 50)).toBe(false);
  expect(ribbonAt(48, 15)).toBe(true);
  expect(ribbonAt(48, 85)).toBe(true);
  expect(ribbonAt(76, 50)).toBe(true);
  expect(tile).toEqual(original);
  if (group) renderer.disposeTile?.(group);
});
