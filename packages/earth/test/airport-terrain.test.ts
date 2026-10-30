import { readFile } from 'node:fs/promises';
import type {
  TerrainPyramidHeightSource,
  TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  Heightfield,
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidAddressAt,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
  WEB_MERCATOR_HALF_WORLD_METERS,
  webMercatorScaleAtLatitude,
  webMercatorToWgs84,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it, vi } from 'vitest';
import { createAirportTerrainGrading } from '../src/client/airport-terrain';
import type { EarthAirport, EarthAirports } from '../src/client/airports';

const records = JSON.parse(
  await readFile(
    new URL('../../../content/earth/airports/cells/14-9.json', import.meta.url),
    'utf8',
  ),
) as EarthAirport[];
const sydney = records.find((a) => a.id === 'YSSY') as EarthAirport;
const scale = webMercatorScaleAtLatitude(-33.94);
const project = ([lon, lat]: [number, number]): [number, number] =>
  wgs84ToWebMercator(lon, lat).map((v) => v * scale) as [number, number];
const [start, end] = (sydney.runways[2] as EarthAirport['runways'][number]).ends.map(project) as [
  [number, number],
  [number, number],
];
const point = (t: number): [number, number] => [
  start[0] + t * (end[0] - start[0]),
  start[1] + t * (end[1] - start[1]),
];
const hill = point(0.1);
const pyramid: TerrainPyramidDescriptor = {
  name: 'Sydney grading regression',
  origin: [-WEB_MERCATOR_HALF_WORLD_METERS * scale, -WEB_MERCATOR_HALF_WORLD_METERS * scale],
  rootSize: 2 * WEB_MERCATOR_HALF_WORLD_METERS * scale,
  minLevel: 8,
  maxLevel: 15,
  tileResolution: 129,
  height: { min: 0, max: 100 },
  layers: [],
  skirts: false,
  metersPerUnit: scale,
};
const airports: EarthAirports = {
  layouts: [],
  attribution: [],
  at: async () => [sydney],
  inBounds: async () => [sydney],
  augment: async (tile) => tile,
};
function field(address: TerrainPyramidTileAddress): Heightfield {
  const origin = terrainPyramidTileOrigin(pyramid, address),
    size = terrainPyramidTileSize(pyramid, address.level);
  const grid = Float32Array.from({ length: 129 * 129 }, (_, i) => {
    const x = origin[0] + ((i % 129) * size) / 128,
      z = origin[1] + (Math.floor(i / 129) * size) / 128;
    return (10 + 70 * Math.max(0, 1 - Math.hypot(x - hill[0], z - hill[1]) / 200)) / 100;
  });
  return new Heightfield(grid, 129, 129, {
    origin,
    worldSize: [size, size],
    height: pyramid.height,
  });
}
function context(
  p: [number, number],
  level = 15,
  signal = new AbortController().signal,
): TerrainPyramidTileLayerContext {
  const address = terrainPyramidAddressAt(pyramid, level, ...p) as TerrainPyramidTileAddress;
  const heightfield = field(address);
  return {
    address,
    pyramid,
    heightfield,
    origin: heightfield.origin,
    tileSize: heightfield.worldSize[0],
    signal,
    surfaceResolution: 65,
    descriptor: {},
  } as TerrainPyramidTileLayerContext;
}
const source = (): TerrainPyramidHeightSource => ({
  load: vi.fn(async (address) => field(address)),
});

describe('airport terrain grading', () => {
  it('removes the Sydney runway hill across tiles and LODs, including the runway shoulders', async () => {
    const grade = createAirportTerrainGrading(airports),
      raw = source();
    expect(context(hill).heightfield.sampleHeight(...hill)).toBeGreaterThan(70);
    for (const level of [14, 15]) {
      for (const t of [0.9, 0.1, 0, 0.25, 0.5, 0.75, 1]) {
        const p = point(t),
          c = context(p, level);
        const result = await grade(c, raw);
        expect(result.sampleHeight(...p)).toBeCloseTo(10, 4);
        expect(result.sampleHeight(p[0] + 30, p[1])).toBeCloseTo(10, 4);
        expect(c.heightfield.copySamples()).toEqual(field(c.address).copySamples());
      }
    }
    // A fresh cache, loading the other end first, produces the same shared airport datum.
    const fresh = createAirportTerrainGrading(airports);
    await fresh(context(end), raw);
    expect((await fresh(context(hill), raw)).sampleHeight(...hill)).toBeCloseTo(10, 4);
  });

  it('keeps intersecting runways at the same height and blends back to untouched terrain', async () => {
    const grade = createAirportTerrainGrading(airports),
      raw = source();
    for (const r of sydney.runways) {
      const [a, b] = r.ends.map(project) as [[number, number], [number, number]];
      const p: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      expect((await grade(context(p), raw)).sampleHeight(...p)).toBeCloseTo(10, 4);
    }
    const c = context(hill);
    c.origin = [hill[0] - 500, hill[1] - 500];
    c.tileSize = 1000;
    // A separate source tile with a raised plateau tests the shoulder blend independently
    // of the fixed reference terrain used to determine the airport's altitude.
    c.heightfield = new Heightfield(new Float32Array(129 * 129).fill(0.8), 129, 129, {
      origin: c.origin,
      worldSize: [c.tileSize, c.tileSize],
      height: pyramid.height,
    });
    const result = await grade(c, raw);
    const dx = end[0] - start[0],
      dz = end[1] - start[1],
      length = Math.hypot(dx, dz);
    const offset = (d: number): [number, number] => [
      hill[0] - (dz / length) * d,
      hill[1] + (dx / length) * d,
    ];
    expect(result.sampleHeight(...hill)).toBeCloseTo(10, 4);
    expect(result.sampleHeight(...offset(160))).toBeGreaterThan(20);
    expect(result.sampleHeight(...offset(160))).toBeLessThan(70);
    expect(result.sampleHeight(...offset(260))).toBeCloseTo(80, 4);
  });

  it('does not cache partial or aborted reference reads and leaves distant terrain alone', async () => {
    const grade = createAirportTerrainGrading(airports),
      c = context(hill);
    expect(await grade(c, { load: async () => undefined })).toBe(c.heightfield);
    const abort = new AbortController();
    const cancelled = context(hill, 15, abort.signal);
    expect(
      await grade(cancelled, {
        load: async (address) => {
          abort.abort();
          return field(address);
        },
      }),
    ).toBe(cancelled.heightfield);
    expect((await grade(c, source())).sampleHeight(...hill)).toBeCloseTo(10, 4);
    const far = context([hill[0] + 10000, hill[1]]),
      raw = source();
    expect(await grade(far, raw)).toBe(far.heightfield);
    expect(raw.load).not.toHaveBeenCalled();
    const globe = context(hill, 8);
    expect(await grade(globe, raw)).toBe(globe.heightfield);
  });

  it('levels mapped aerodrome grounds beyond the runway corridors', async () => {
    const center: [number, number] = [hill[0] - 400, hill[1]];
    const outer: [number, number][] = [
      [-80, -80],
      [80, -80],
      [80, 80],
      [-80, 80],
    ].map(([x, z]) =>
      webMercatorToWgs84((center[0] + (x as number)) / scale, (center[1] + (z as number)) / scale),
    );
    const grade = createAirportTerrainGrading({
      ...airports,
      layouts: [
        {
          id: sydney.id,
          bounds: [
            Math.min(...outer.map((p) => p[0])),
            Math.min(...outer.map((p) => p[1])),
            Math.max(...outer.map((p) => p[0])),
            Math.max(...outer.map((p) => p[1])),
          ],
          tile: {
            format: 'molen/terrain-semantics@1',
            landcover: [{ class: 'aerodrome', polygons: [{ outer }] }],
            water: [],
            buildings: [],
            transportation: [],
          },
        },
      ],
    });
    const c = context(center);
    c.heightfield = new Heightfield(new Float32Array(129 * 129).fill(0.8), 129, 129, {
      origin: c.origin,
      worldSize: [c.tileSize, c.tileSize],
      height: pyramid.height,
    });
    expect((await grade(c, source())).sampleHeight(...center)).toBeCloseTo(10, 4);
  });
});
