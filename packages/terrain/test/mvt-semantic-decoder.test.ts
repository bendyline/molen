import Pbf from 'pbf';
import { describe, expect, it } from 'vitest';
import {
  createProtomapsTerrainMvtDecoder,
  createTerrainMvtSemanticDecoder,
} from '../src/mvt-semantic-decoder';

interface TestPoint {
  x: number;
  y: number;
}

interface TestFeature {
  id: number;
  type: 1 | 2 | 3;
  properties: Record<string, string | number | boolean>;
  geometry: TestPoint[][];
}

interface TestLayer {
  name: string;
  features: TestFeature[];
}

interface EncodedLayer extends TestLayer {
  keys: string[];
  values: Array<string | number | boolean>;
}

function valueKey(value: string | number | boolean): string {
  return `${typeof value}:${String(value)}`;
}

function encodedLayer(layer: TestLayer): EncodedLayer {
  const keys = [...new Set(layer.features.flatMap((feature) => Object.keys(feature.properties)))];
  const values: Array<string | number | boolean> = [];
  const seen = new Set<string>();
  for (const feature of layer.features) {
    for (const value of Object.values(feature.properties)) {
      const key = valueKey(value);
      if (!seen.has(key)) {
        seen.add(key);
        values.push(value);
      }
    }
  }
  return { ...layer, keys, values };
}

function zigzag(value: number): number {
  return (value << 1) ^ (value >> 31);
}

function geometryCommands(feature: TestFeature): number[] {
  const commands: number[] = [];
  let cursorX = 0;
  let cursorY = 0;
  for (const path of feature.geometry) {
    const first = path[0];
    if (first === undefined) continue;
    commands.push((1 << 3) | 1, zigzag(first.x - cursorX), zigzag(first.y - cursorY));
    cursorX = first.x;
    cursorY = first.y;
    if (path.length > 1) {
      commands.push(((path.length - 1) << 3) | 2);
      for (const point of path.slice(1)) {
        commands.push(zigzag(point.x - cursorX), zigzag(point.y - cursorY));
        cursorX = point.x;
        cursorY = point.y;
      }
    }
    if (feature.type === 3) commands.push((1 << 3) | 7);
  }
  return commands;
}

function writeValue(value: string | number | boolean, pbf: Pbf): void {
  if (typeof value === 'string') pbf.writeStringField(1, value);
  else if (typeof value === 'number') pbf.writeDoubleField(3, value);
  else pbf.writeBooleanField(7, value);
}

function writeFeature(input: { feature: TestFeature; layer: EncodedLayer }, pbf: Pbf): void {
  const { feature, layer } = input;
  const tags: number[] = [];
  for (const [key, value] of Object.entries(feature.properties)) {
    tags.push(
      layer.keys.indexOf(key),
      layer.values.findIndex((item) => valueKey(item) === valueKey(value)),
    );
  }
  pbf.writeVarintField(1, feature.id);
  pbf.writePackedVarint(2, tags);
  pbf.writeVarintField(3, feature.type);
  pbf.writePackedVarint(4, geometryCommands(feature));
}

function writeLayer(layer: EncodedLayer, pbf: Pbf): void {
  pbf.writeStringField(1, layer.name);
  for (const feature of layer.features) pbf.writeMessage(2, writeFeature, { feature, layer });
  for (const key of layer.keys) pbf.writeStringField(3, key);
  for (const value of layer.values) pbf.writeMessage(4, writeValue, value);
  pbf.writeVarintField(5, 4096);
  pbf.writeVarintField(15, 2);
}

function encodeTile(layers: TestLayer[]): Uint8Array {
  const pbf = new Pbf();
  for (const layer of layers.map(encodedLayer)) pbf.writeMessage(3, writeLayer, layer);
  return pbf.finish();
}

const outer: TestPoint[] = [
  { x: 0, y: 0 },
  { x: 4096, y: 0 },
  { x: 4096, y: 4096 },
  { x: 0, y: 4096 },
];
const hole: TestPoint[] = [
  { x: 1024, y: 1024 },
  { x: 1024, y: 2048 },
  { x: 2048, y: 2048 },
  { x: 2048, y: 1024 },
];

function fixture(): Uint8Array {
  return encodeTile([
    {
      name: 'landcover',
      features: [{ id: 1, type: 3, properties: { kind: 'forest' }, geometry: [outer, hole] }],
    },
    {
      name: 'landuse',
      features: [
        {
          id: 2,
          type: 3,
          properties: { kind: 'park', density: 0.5 },
          geometry: [outer],
        },
      ],
    },
    {
      name: 'water',
      features: [
        { id: 3, type: 3, properties: { kind: 'lake' }, geometry: [outer] },
        {
          id: 4,
          type: 2,
          properties: { kind: 'river', width: 12 },
          geometry: [
            [
              { x: -128, y: 2048 },
              { x: 4224, y: 2048 },
            ],
          ],
        },
      ],
    },
    {
      name: 'roads',
      features: [
        {
          id: 5,
          type: 2,
          properties: {
            kind: 'major_road',
            kind_detail: 'secondary',
            surface: 'asphalt',
            lanes: '4',
            oneway: 'yes',
            layer: 1,
            width: '11.5 m',
            is_bridge: true,
          },
          geometry: [
            [
              { x: -64, y: 1024 },
              { x: 4096, y: 1024 },
            ],
          ],
        },
        {
          id: 6,
          type: 2,
          properties: { kind: 'minor_road', is_tunnel: true },
          geometry: [
            [
              { x: 0, y: 3072 },
              { x: 4096, y: 3072 },
            ],
          ],
        },
      ],
    },
    {
      name: 'buildings',
      features: [
        {
          id: 7,
          type: 3,
          properties: { kind: 'commercial', height: '24 m', min_height: 3, levels: 7 },
          geometry: [outer],
        },
      ],
    },
  ]);
}

describe('MVT terrain semantic decoder', () => {
  it('decodes Protomaps landcover polygons, holes, and landuse classes', () => {
    const decoder = createProtomapsTerrainMvtDecoder();
    const tile = decoder.decode(fixture(), {
      address: { level: 13, x: 1318, z: 2861 },
      content: 'landcover',
      encoding: 'mvt',
      layers: ['landcover'],
    });
    expect(tile).not.toBeInstanceOf(Promise);
    if (tile instanceof Promise) return;
    expect(tile.landcover).toHaveLength(2);
    expect(tile.landcover[0]).toMatchObject({ id: 1, class: 'forest' });
    expect(tile.landcover[0]?.polygons[0]?.holes).toHaveLength(1);
    expect(tile.landcover[0]?.polygons[0]?.outer).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    expect(tile.landcover[1]).toMatchObject({ id: 2, class: 'park', density: 0.5 });
  });

  it('decodes requested water, roads, bridge/tunnel flags, and building metrics', () => {
    const decoder = createProtomapsTerrainMvtDecoder();
    const tile = decoder.decode(fixture(), {
      address: { level: 13, x: 1318, z: 2861 },
      content: 'features',
      encoding: 'mvt',
      layers: ['water', 'transportation', 'building'],
    });
    if (tile instanceof Promise) throw new Error('expected synchronous MVT decoding');
    expect(tile.water).toHaveLength(2);
    expect(tile.water[0]).toMatchObject({ id: 3, class: 'lake' });
    expect(tile.water[1]).toMatchObject({ id: 4, class: 'river', width: 12 });
    expect(tile.water[1]?.lines?.[0]).toEqual([
      [-0.03125, 0.5],
      [1.03125, 0.5],
    ]);
    expect(tile.transportation).toHaveLength(2);
    expect(tile.transportation[0]).toMatchObject({
      id: 5,
      class: 'major_road',
      width: 11.5,
      subclass: 'secondary',
      surface: 'asphalt',
      lanes: 4,
      oneway: true,
      layer: 1,
      bridge: true,
    });
    expect(tile.transportation[1]).toMatchObject({ id: 6, tunnel: true });
    expect(tile.buildings).toEqual([
      expect.objectContaining({
        id: 7,
        class: 'commercial',
        height: 24,
        minHeight: 3,
        levels: 7,
      }),
    ]);
  });

  it('supports source-layer overrides, semantic filtering, and decode budgets', () => {
    const decoder = createTerrainMvtSemanticDecoder({
      layers: { transportation: ['roads'] },
      limits: { maxFeaturesPerTile: 1 },
    });
    expect(() =>
      decoder.decode(fixture(), {
        address: { level: 1, x: 0, z: 0 },
        content: 'features',
        encoding: 'mvt',
        layers: ['transportation'],
      }),
    ).toThrow(/exceeds 1 features/);

    const buildingsOnly = createProtomapsTerrainMvtDecoder().decode(fixture(), {
      address: { level: 1, x: 0, z: 0 },
      content: 'features',
      encoding: 'mvt',
      layers: ['building'],
    });
    if (buildingsOnly instanceof Promise) throw new Error('expected synchronous MVT decoding');
    expect(buildingsOnly.buildings).toHaveLength(1);
    expect(buildingsOnly.water).toEqual([]);
    expect(buildingsOnly.transportation).toEqual([]);

    const combined = createProtomapsTerrainMvtDecoder().decode(fixture(), {
      address: { level: 1, x: 0, z: 0 },
      content: 'all',
      encoding: 'mvt',
      layers: ['landcover', 'water', 'transportation', 'building'],
    });
    if (combined instanceof Promise) throw new Error('expected synchronous MVT decoding');
    expect(combined.landcover).toHaveLength(2);
    expect(combined.water).toHaveLength(2);
    expect(combined.transportation).toHaveLength(2);
    expect(combined.buildings).toHaveLength(1);
  });

  it('rejects raster input and invalid configuration explicitly', () => {
    expect(() => createTerrainMvtSemanticDecoder({ linearUnitScale: 0 })).toThrow(
      /linearUnitScale/,
    );
    expect(() =>
      createTerrainMvtSemanticDecoder().decode(new Uint8Array(), {
        address: { level: 0, x: 0, z: 0 },
        content: 'landcover',
        encoding: 'png8',
        layers: ['landcover'],
      }),
    ).toThrow(/cannot decode png8/);
  });
});

describe('MVT decoder subclass, layer, and name', () => {
  it('decodes kind_detail, layer, and name when present', () => {
    const tile = encodeTile([
      {
        name: 'buildings',
        features: [
          {
            id: 8,
            type: 3,
            properties: { kind: 'building', kind_detail: 'garage', layer: -1, name: 'Old Barn' },
            geometry: [outer],
          },
        ],
      },
      {
        name: 'landuse',
        features: [
          {
            id: 9,
            type: 3,
            properties: { kind: 'residential', kind_detail: 'suburban' },
            geometry: [outer],
          },
        ],
      },
    ]);
    const decoded = createProtomapsTerrainMvtDecoder().decode(tile, {
      address: { level: 1, x: 0, z: 0 },
      content: 'all',
      encoding: 'mvt',
      layers: ['landcover', 'building'],
    });
    if (decoded instanceof Promise) throw new Error('expected synchronous MVT decoding');
    expect(decoded.buildings[0]).toMatchObject({
      id: 8,
      class: 'building',
      subclass: 'garage',
      layer: -1,
      name: 'Old Barn',
    });
    expect(decoded.landcover[0]).toMatchObject({
      id: 9,
      class: 'residential',
      subclass: 'suburban',
    });
  });
});

it('preserves parking polygons, aisle subtypes, and turning-link flags', () => {
  const tile = createProtomapsTerrainMvtDecoder().decode(
    encodeTile([
      {
        name: 'landuse',
        features: [{ id: 10, type: 3, properties: { kind: 'parking' }, geometry: [outer, hole] }],
      },
      {
        name: 'roads',
        features: [
          {
            id: 11,
            type: 2,
            properties: { kind: 'minor_road', kind_detail: 'service', service: 'parking_aisle' },
            geometry: [
              [
                { x: 0, y: 512 },
                { x: 4096, y: 512 },
              ],
            ],
          },
          {
            id: 12,
            type: 2,
            properties: { kind: 'major_road', kind_detail: 'secondary_link', is_link: true },
            geometry: [
              [
                { x: 0, y: 1024 },
                { x: 4096, y: 1024 },
              ],
            ],
          },
        ],
      },
    ]),
    {
      address: { level: 15, x: 5276, z: 11442 },
      content: 'all',
      encoding: 'mvt',
      layers: ['transportation'],
    },
  );
  if (tile instanceof Promise) throw new Error('expected synchronous decoding');
  expect(tile.landcover[0]?.class).toBe('parking');
  expect(tile.landcover[0]?.polygons[0]?.holes).toHaveLength(1);
  expect(tile.transportation[0]?.service).toBe('parking_aisle');
  expect(tile.transportation[1]?.link).toBe(true);
});

it('preserves POI identity, detail and measured props independently of label min_zoom', () => {
  const decoder = createProtomapsTerrainMvtDecoder({ linearUnitScale: 2 });
  const bytes = encodeTile([
    {
      name: 'pois',
      features: [
        {
          id: 101,
          type: 1,
          properties: {
            name: "McDonald's",
            kind: 'fast_food',
            kind_detail: 'burger',
            'brand:wikidata': 'Q38076',
            min_zoom: 18,
          },
          geometry: [[{ x: 1024, y: 2048 }]],
        },
        {
          id: 102,
          type: 1,
          properties: {
            kind: 'tree',
            height: 12,
            diameter_crown: 5,
            leaf_type: 'needleleaved',
            direction: 90,
          },
          geometry: [[{ x: 2048, y: 1024 }]],
        },
        {
          id: 103,
          type: 1,
          properties: { kind: 'bicycle_parking', capacity: 12 },
          geometry: [[{ x: 512, y: 512 }]],
        },
      ],
    },
  ]);
  const context = {
    address: { level: 15, x: 0, z: 0 },
    content: 'all' as const,
    encoding: 'mvt' as const,
    layers: ['poi'],
  };
  const tile = decoder.decode(bytes, context);
  if (tile instanceof Promise) throw new Error('expected synchronous decode');
  expect(tile.pois).toHaveLength(3);
  expect(tile.pois?.[0]).toMatchObject({
    id: 101,
    name: "McDonald's",
    class: 'fast_food',
    subclass: 'burger',
    brandId: 'Q38076',
    point: [0.25, 0.5],
  });
  expect(tile.pois?.[1]).toMatchObject({
    class: 'tree',
    height: 24,
    crownDiameter: 10,
    leafType: 'needleleaved',
    heading: Math.PI / 2,
  });
  expect(tile.pois?.[2]?.capacity).toBe(12);
  const omitted = decoder.decode(bytes, { ...context, layers: ['building'] });
  if (omitted instanceof Promise) throw new Error('expected synchronous decode');
  expect(omitted.pois).toBeUndefined();
  expect(() =>
    createProtomapsTerrainMvtDecoder({ limits: { maxGeometryPointsPerTile: 1 } }).decode(
      bytes,
      context,
    ),
  ).toThrow(/geometry points/);
});
