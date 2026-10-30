import { readFile } from 'node:fs/promises';
import { PMTiles } from 'pmtiles';
import { describe, expect, it, vi } from 'vitest';
import { createElevationTileDecoder } from '../src/elevation-filter';
import {
  createTerrainPackageHeightSource,
  createTerrainPackagePyramidHeightSource,
  terrainDescriptorFromPackage,
  terrainPyramidDescriptorFromPackage,
} from '../src/package-client';
import type { TerrainPackageDescriptor } from '../src/package-types';
import { decodePng16, encodePng16 } from '../src/png16';
import type { TerrainPyramidDescriptor } from '../src/pyramid-types';

const height = { min: -2000, max: 3000 };
const metres = (value: number): number => height.min + value * 5000;
const plane = (x: number, z: number): number => 100 + x + z * 0.5;

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing test sample');
  return value;
}

function fixture(sample: (x: number, z: number) => number, scheme: 'xyz' | 'tms' = 'xyz') {
  const archive = {
    getZxy: vi.fn(async (level: number, x: number, y: number) => {
      if (level !== 3) return undefined;
      const z = scheme === 'tms' ? 2 ** level - 1 - y : y;
      const data = Float32Array.from(
        { length: 33 * 33 },
        (_, i) => (sample(x * 32 + (i % 33), z * 32 + Math.floor(i / 33)) - height.min) / 5000,
      );
      return { data: encodePng16({ width: 33, height: 33, data }).buffer };
    }),
  };
  const load = createElevationTileDecoder({
    archive,
    scheme,
    heightRange: 5000,
    tileSize: () => 320,
    filter: true,
    maxTiles: 4,
  });
  return { archive, load };
}

describe('native elevation anomaly filtering', () => {
  it('replaces isolated peaks, pits and small clusters, preserving every ordinary sample', async () => {
    const bad = (x: number, z: number): boolean =>
      (x >= 72 && x <= 74 && z >= 72 && z <= 74) || (x === 86 && z === 86);
    const { archive, load } = fixture((x, z) =>
      bad(x, z) ? (x === 86 ? -1200 : 1800) : plane(x, z),
    );
    const original = await archive.getZxy(3, 2, 2);
    const raw = decodePng16(new Uint8Array(present(original).data));
    archive.getZxy.mockClear();
    const grid = present(await load(3, 2, 2));
    for (let z = 0; z < 33; z++) {
      for (let x = 0; x < 33; x++) {
        const index = z * 33 + x;
        if (bad(x + 64, z + 64))
          expect(metres(present(grid.data[index]))).toBeCloseTo(plane(x + 64, z + 64), 0);
        else expect(grid.data[index]).toBe(raw.data[index]);
      }
    }
    expect(metres(present(raw.data[9 * 33 + 9]))).toBeCloseTo(1800, 0);
    expect(await load(3, 2, 2)).toBe(grid);
    expect(archive.getZxy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['slope', (x: number, z: number) => 15 * x + 5 * z],
    ['cliff', (x: number) => (x < 80 ? 50 : 1500)],
    ['ridge', (x: number) => (x === 80 ? 1500 : 50)],
    ['hill', (x: number, z: number) => 100 + Math.max(0, 600 - 20 * Math.hypot(x - 80, z - 80))],
  ])('preserves a real %s without blur or extra archive requests', async (_name, sample) => {
    const { archive, load } = fixture(sample);
    const raw = decodePng16(new Uint8Array(present(await archive.getZxy(3, 2, 2)).data));
    archive.getZxy.mockClear();
    expect(present(await load(3, 2, 2)).data).toEqual(raw.data);
    expect(archive.getZxy).toHaveBeenCalledTimes(1);
  });

  it.each([
    'xyz',
    'tms',
  ] as const)('uses identical raw halos at %s edges and corners in either request order', async (scheme) => {
    const sample = (x: number, z: number): number =>
      (x === 96 && z === 80) || (x === 96 && z === 96) ? 1800 : plane(x, z);
    const addresses = [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ] as const;
    const a = fixture(sample, scheme),
      b = fixture(sample, scheme);
    const forward = new Map<string, Float32Array>();
    for (const [x, z] of addresses) forward.set(`${x}/${z}`, present(await a.load(3, x, z)).data);
    for (const [x, z] of [...addresses].reverse()) {
      expect(present(await b.load(3, x, z)).data).toEqual(forward.get(`${x}/${z}`));
    }
    const left = present(forward.get('2/2')),
      right = present(forward.get('3/2'));
    for (let row = 0; row < 33; row++) expect(left[row * 33 + 32]).toBe(right[row * 33]);
    expect(metres(present(left[16 * 33 + 32]))).toBeCloseTo(plane(96, 80), 0);
    const corners = [
      left[1088],
      right[1056],
      present(forward.get('2/3'))[32],
      present(forward.get('3/3'))[0],
    ];
    expect(new Set(corners).size).toBe(1);
    expect(metres(present(corners[0]))).toBeCloseTo(plane(96, 96), 0);
  });

  it('leaves a boundary anomaly intact when its surrounding evidence is missing', async () => {
    const { archive } = fixture((x, z) => (x === 96 && z === 80 ? 1800 : plane(x, z)));
    const load = createElevationTileDecoder({
      archive: {
        getZxy: (level, x, z) =>
          x === 2 && z === 2 ? archive.getZxy(level, x, z) : Promise.resolve(undefined),
      },
      scheme: 'xyz',
      heightRange: 5000,
      tileSize: () => 320,
      filter: true,
      maxTiles: 4,
    });
    expect(metres(present(present(await load(3, 2, 2)).data[16 * 33 + 32]))).toBeCloseTo(1800, 0);
  });

  it('deduplicates concurrent neighbour requests without recursively waiting on filtering', async () => {
    const { load } = fixture((x, z) => (x === 96 && z === 80 ? 1800 : plane(x, z)));
    const [left, right] = await Promise.all([load(3, 2, 2), load(3, 3, 2)]);
    expect(present(left).data[16 * 33 + 32]).toBe(present(right).data[16 * 33]);
    expect(metres(present(present(left).data[16 * 33 + 32]))).toBeCloseTo(plane(96, 80), 0);
  });

  it('preserves an isolated summit when native sample spacing supports its relief', async () => {
    const { archive } = fixture((x, z) => (x === 80 && z === 80 ? 1800 : plane(x, z)));
    const load = createElevationTileDecoder({
      archive,
      scheme: 'xyz',
      heightRange: 5000,
      tileSize: () => 32000,
      filter: true,
      maxTiles: 4,
    });
    const grid = present(await load(3, 2, 2));
    expect(metres(present(grid.data[16 * 33 + 16]))).toBeCloseTo(1800, 0);
  });

  it('keeps authored local heights by default and allows explicit filtering', async () => {
    const { archive } = fixture((x, z) => (x === 80 && z === 80 ? 1800 : plane(x, z)));
    const pkg = {
      coordinateSpace: { kind: 'local' },
      tileMatrix: { scheme: 'xyz' },
    } as TerrainPackageDescriptor;
    const descriptor: TerrainPyramidDescriptor = {
      name: 'authored',
      origin: [0, 0],
      rootSize: 2560,
      minLevel: 3,
      maxLevel: 3,
      tileResolution: 33,
      height,
      layers: [],
      skirts: false,
    };
    const source = createTerrainPackagePyramidHeightSource(pkg, descriptor, archive);
    const filtered = createTerrainPackagePyramidHeightSource(pkg, descriptor, archive, {
      filterElevation: true,
    });
    const address = { level: 3, x: 2, z: 2 },
      signal = new AbortController().signal;
    expect(present(await source.load(address, signal)).sampleHeight(800, 800)).toBeCloseTo(1800, 0);
    expect(present(await filtered.load(address, signal)).sampleHeight(800, 800)).toBeCloseTo(
      plane(80, 80),
      0,
    );
  });
});

describe('Sydney elevation spike regression', () => {
  it('corrects the shipped 1442 m sample before fixed, pyramid and ancestor sampling; raw opt-out remains available', async () => {
    const base = new URL(
      '../../../examples/world-explorer/public/terrain/sydney/',
      import.meta.url,
    );
    const pkg = JSON.parse(
      await readFile(new URL('terrain-package.json', base), 'utf8'),
    ) as TerrainPackageDescriptor;
    const bytes = await readFile(new URL('elevation.pmtiles', base));
    const archive = new PMTiles({
      getKey: () => 'sydney-spikes',
      getBytes: async (offset, length) => ({
        data: bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + length),
      }),
    });
    const descriptor = terrainPyramidDescriptorFromPackage(pkg);
    const filtered = createTerrainPackagePyramidHeightSource(pkg, descriptor, archive);
    const raw = createTerrainPackagePyramidHeightSource(pkg, descriptor, archive, {
      filterElevation: false,
    });
    const address = { level: 10, x: 941, z: 615 },
      signal = new AbortController().signal;
    const field = present(await filtered.load(address, signal));
    const x = field.origin[0] + 199 * field.cellSize[0],
      z = field.origin[1] + 62 * field.cellSize[1];
    expect(present(await raw.load(address, signal)).sampleHeight(x, z)).toBeCloseTo(1441.98, 1);
    expect(field.sampleHeight(x, z)).toBeLessThan(155);
    const fixed = createTerrainPackageHeightSource(
      pkg,
      terrainDescriptorFromPackage(pkg, 10),
      archive,
      10,
    );
    expect(present(await fixed.load(address, signal)).sampleHeight(x, z)).toBeCloseTo(
      field.sampleHeight(x, z),
      5,
    );
    const parentOnly = {
      getZxy: (level: number, tx: number, ty: number) =>
        level <= 10 ? archive.getZxy(level, tx, ty) : Promise.resolve(undefined),
    };
    const overzoom = createTerrainPackagePyramidHeightSource(pkg, descriptor, parentOnly);
    const descendant = present(
      await overzoom.load({ level: 12, x: 941 * 4 + 3, z: 615 * 4 }, signal),
    );
    expect(descendant.sampleHeight(x, z)).toBeCloseTo(field.sampleHeight(x, z), 5);
  });
});
