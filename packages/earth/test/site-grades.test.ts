import { readFile } from 'node:fs/promises';
import type { Pack } from '@bendyline/molen-pack';
import type {
  TerrainPyramidHeightSource,
  TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  Heightfield,
  type TerrainPackageDescriptor,
  wgs84ToWorld,
} from '@bendyline/molen-terrain/kernel';
import { expect, it } from 'vitest';
import { loadEarthContent } from '../src/client/content';
import { createEarthSiteGrading, readEarthSiteGrades } from '../src/client/site-grades';

it('grades the mapped embankment consistently across tile joins and keeps the surrounding terrain', async () => {
  const path = 'terrain/site-grades.json';
  const pack = {
    manifest: { id: 'molen.earth', version: '1.0.0', provides: { 'site-grades': [path] } },
    readJson: async (name: string) =>
      JSON.parse(
        await readFile(new URL(`../../../content/earth/${name}`, import.meta.url), 'utf8'),
      ),
  } as unknown as Pack;
  const { siteGrades } = await loadEarthContent([pack], { stylePack: false });
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const grade = createEarthSiteGrading(siteGrades, descriptor);
  if (!grade) throw new Error('Expected the embankment grade');
  const anchor = [30.316953067, 59.94262064] as const;
  const scale = Math.cos((anchor[1] * Math.PI) / 180);
  const [x, z] = wgs84ToWorld(scale, ...anchor);
  const source: TerrainPyramidHeightSource = { load: async () => undefined };
  const terrain = (origin: [number, number], signal = new AbortController().signal) => {
    const width = 41;
    const tileSize = 400;
    const heightfield = new Heightfield(new Float32Array(width * width).fill(0.38), width, width, {
      worldSize: [tileSize, tileSize],
      origin,
      height: { min: 0, max: 100 },
    });
    return {
      origin,
      tileSize,
      heightfield,
      signal,
      pyramid: { metersPerUnit: scale },
    } as TerrainPyramidTileLayerContext;
  };
  const west = terrain([x - 400, z - 200]);
  const east = terrain([x, z - 200]);
  const a = await grade(west, source);
  const b = await grade(east, source);
  expect(a.sampleHeight(x, z)).toBeCloseTo(17.5, 5);
  for (const offset of [-200, -100, -40, 0, 60, 100, 200])
    expect(a.sampleHeight(x, z + offset)).toBeCloseTo(b.sampleHeight(x, z + offset), 5);
  expect(west.heightfield.sampleHeight(x, z)).toBeCloseTo(38, 5);
  expect(a.sampleHeight(x - 400, z)).toBeCloseTo(38, 5);
  const far = terrain([x + 800, z]);
  expect(await grade(far, source)).toBe(far.heightfield);
  expect(
    createEarthSiteGrading(siteGrades, { ...descriptor, features: undefined }),
  ).toBeUndefined();
});

it('raises only the void samples inside a bounded repair', async () => {
  const anchor: [number, number] = [0, 0];
  const origin: [number, number] = [-20, -20];
  const heightfield = new Heightfield(
    new Float32Array([0.1, 0.6, 0.6, 0.6, 0.1, 0.6, 0.6, 0.6, 0.6]),
    3,
    3,
    { origin, worldSize: [40, 40], height: { min: 0, max: 100 } },
  );
  const grades = readEarthSiteGrades({
    format: 'molen/earth-site-grades@1',
    sites: [
      { anchor, heading: 0, bounds: [-2, -2, 2, 2], elevation: 45, blend: 40, repairBelow: 20 },
    ],
  });
  const grade = createEarthSiteGrading(grades, {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor);
  if (!grade) throw new Error('Expected the bounded repair');
  const repaired = await grade(
    {
      origin,
      tileSize: 40,
      heightfield,
      signal: new AbortController().signal,
      pyramid: {},
    } as TerrainPyramidTileLayerContext,
    { load: async () => undefined },
  );
  expect(repaired.sampleHeight(0, 0)).toBeCloseTo(45, 4);
  expect(repaired.sampleHeight(0, -20)).toBeCloseTo(60, 4);
  expect(heightfield.sampleHeight(0, 0)).toBeCloseTo(10, 4);
});

it('interpolates several levels along a local grade and preserves valid terrain and its far edge', async () => {
  const origin: [number, number] = [-60, -60];
  const size = 120;
  const samples = new Float32Array(25 * 25).fill(0.4);
  samples[12 * 25 + 13] = 0.85;
  const heightfield = new Heightfield(samples, 25, 25, {
    origin,
    worldSize: [size, size],
    height: { min: 0, max: 100 },
  });
  const site = {
    anchor: [0, 0],
    heading: 0,
    bounds: [-10, -25, 10, 15],
    blend: 30,
    elevation: 82,
    elevationProfile: [
      [-20, 68],
      [0, 82],
    ],
    repairBelow: 60,
  };
  const document = { format: 'molen/earth-site-grades@1', sites: [site] };
  const grades = readEarthSiteGrades(document);
  expect(() =>
    readEarthSiteGrades({
      ...document,
      sites: [
        {
          ...site,
          elevationProfile: [
            [0, 82],
            [0, 68],
          ],
        },
      ],
    }),
  ).toThrow();
  const grade = createEarthSiteGrading(grades, {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor);
  if (!grade) throw new Error('Expected the profiled site grade');
  const rated = await grade(
    {
      origin,
      tileSize: size,
      heightfield,
      signal: new AbortController().signal,
      pyramid: {},
    } as TerrainPyramidTileLayerContext,
    { load: async () => undefined },
  );
  expect(rated.sampleHeight(0, -20)).toBeCloseTo(68, 4);
  expect(rated.sampleHeight(0, -10)).toBeCloseTo(75, 4);
  expect(rated.sampleHeight(0, 0)).toBeCloseTo(82, 4);
  expect(rated.sampleHeight(0, 10)).toBeCloseTo(82, 4);
  expect(rated.sampleHeight(5, 0)).toBeCloseTo(85, 4);
  expect(rated.sampleHeight(60, 0)).toBeCloseTo(40, 4);
  expect(heightfield.sampleHeight(0, 0)).toBeCloseTo(40, 4);
});

it('samples a rotated survey grid in both dimensions and blends into the host terrain', async () => {
  const document = {
    format: 'molen/earth-site-grades@1',
    sites: [
      {
        anchor: [0, 0],
        heading: Math.PI / 2,
        bounds: [-10, -10, 10, 10],
        elevation: 40,
        blend: 20,
        elevationGrid: [
          [10, 30],
          [50, 70],
        ],
      },
    ],
  };
  const grades = readEarthSiteGrades(document);
  expect(() =>
    readEarthSiteGrades({
      ...document,
      sites: [{ ...document.sites[0], elevationGrid: [[10, 30], [50]] }],
    }),
  ).toThrow();
  const descriptor = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  const grade = createEarthSiteGrading(grades, descriptor);
  if (!grade) throw new Error('Expected a survey grade');
  const origin: [number, number] = [-100, -100];
  const heightfield = new Heightfield(new Float32Array(41 * 41).fill(0.2), 41, 41, {
    origin,
    worldSize: [200, 200],
    height: { min: 0, max: 100 },
  });
  const result = await grade(
    {
      origin,
      tileSize: 200,
      heightfield,
      signal: new AbortController().signal,
      pyramid: {},
    } as TerrainPyramidTileLayerContext,
    { load: async () => undefined },
  );
  expect(result.sampleHeight(-10, 10)).toBeCloseTo(10, 4);
  expect(result.sampleHeight(5, -5)).toBeCloseTo(55, 4);
  expect(result.sampleHeight(20, 0)).toBeCloseTo(40, 4);
  expect(result.sampleHeight(40, 0)).toBeCloseTo(20, 4);
});

it.each([
  ['2017-01-07', '2017-01-08', '2017-01-09'],
  ['-000581-12-31', '-000580-01-01', '-000560-01-01'],
])('enables historical grade data only between its bounds for %s', (before, validFrom, validUntil) => {
  const site = {
    anchor: [0, 0],
    heading: 0,
    bounds: [-12, -15, 12, 15],
    elevation: 20,
    blend: 30,
    validFrom,
    validUntil,
  };
  const document = { format: 'molen/earth-site-grades@1', sites: [site] };
  const grades = readEarthSiteGrades(document);
  expect(() =>
    readEarthSiteGrades({ ...document, sites: [{ ...site, validUntil: undefined }] }),
  ).toThrow();
  const terrain = {
    coordinateSpace: { kind: 'geospatial' },
    features: { profile: 'protomaps-basemap@1' },
  } as TerrainPackageDescriptor;
  expect(createEarthSiteGrading(grades, terrain)).toBeUndefined();
  expect(createEarthSiteGrading(grades, terrain, before)).toBeUndefined();
  expect(createEarthSiteGrading(grades, terrain, validFrom)).toBeTypeOf('function');
  expect(createEarthSiteGrading(grades, terrain, validUntil)).toBeUndefined();
});
