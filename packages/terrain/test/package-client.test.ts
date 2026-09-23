import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  WEB_MERCATOR_HALF_WORLD_METERS,
  webMercatorScaleAtLatitude,
  webMercatorTileBounds,
  webMercatorToWgs84,
  wgs84ToWebMercator,
  wgs84ToWebMercatorTile,
} from '../src/geospatial';
import {
  createTerrainPackageCombinedSemanticSource,
  createTerrainPackageHeightSource,
  createTerrainPackagePyramidHeightSource,
  createTerrainPackageSemanticSource,
  openTerrainPackageElevation,
  openTerrainPackagePyramid,
  openTerrainPackageSemantics,
  resolveTerrainPackageArchiveUrl,
  terrainDescriptorFromPackage,
  terrainPyramidDescriptorFromPackage,
} from '../src/package-client';
import type { TerrainPackageDescriptor, TerrainTileArchive } from '../src/package-types';
import { encodePng16 } from '../src/png16';
import { terrainPyramidTileOrigin, terrainPyramidTileSize } from '../src/pyramid-types';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';

function appendVarint(output: number[], value: number): void {
  let remaining = value;
  while (remaining >= 0x80) {
    output.push((remaining % 0x80) | 0x80);
    remaining = Math.floor(remaining / 0x80);
  }
  output.push(remaining);
}

function createSingleTilePmtiles(tile: Uint8Array): Uint8Array {
  const directory: number[] = [];
  appendVarint(directory, 1); // entry count
  appendVarint(directory, 0); // tile ID delta (z0/x0/y0)
  appendVarint(directory, 1); // run length
  appendVarint(directory, tile.byteLength);
  appendVarint(directory, 1); // tile-data offset + 1

  const headerSize = 127;
  const tileDataOffset = headerSize + directory.length;
  const archive = new Uint8Array(tileDataOffset + tile.byteLength);
  archive.set(new TextEncoder().encode('PMTiles'));
  archive.set(directory, headerSize);
  archive.set(tile, tileDataOffset);

  const view = new DataView(archive.buffer);
  const setUint64 = (offset: number, value: number): void =>
    view.setBigUint64(offset, BigInt(value), true);
  view.setUint8(7, 3);
  setUint64(8, headerSize);
  setUint64(16, directory.length);
  setUint64(24, tileDataOffset);
  setUint64(32, 0);
  setUint64(40, tileDataOffset);
  setUint64(48, 0);
  setUint64(56, tileDataOffset);
  setUint64(64, tile.byteLength);
  setUint64(72, 1);
  setUint64(80, 1);
  setUint64(88, 1);
  view.setUint8(96, 1); // clustered
  view.setUint8(97, 1); // uncompressed directory
  view.setUint8(98, 1); // uncompressed tile
  view.setUint8(99, 2); // PNG
  view.setUint8(100, 0);
  view.setUint8(101, 0);
  view.setInt32(102, -1_800_000_000, true);
  view.setInt32(106, -850_511_288, true);
  view.setInt32(110, 1_800_000_000, true);
  view.setInt32(114, 850_511_288, true);
  view.setUint8(118, 0);
  view.setInt32(119, 0, true);
  view.setInt32(123, 0, true);
  return archive;
}

function packageDescriptor(
  overrides: Partial<TerrainPackageDescriptor> = {},
): TerrainPackageDescriptor {
  return {
    format: 'molen/terrain-package@1',
    name: 'earth-test',
    version: '1',
    coordinateSpace: {
      kind: 'geospatial',
      crs: 'EPSG:3857',
      ellipsoid: 'WGS84',
      bounds: [-180, -85.05112878, 180, 85.05112878],
    },
    tileMatrix: {
      scheme: 'xyz',
      minLevel: 0,
      maxLevel: 8,
      rootTiles: [1, 1],
      tileResolution: 3,
    },
    elevation: {
      source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
      encoding: 'png16',
      height: { min: -100, max: 900 },
    },
    attribution: [{ text: 'Test', license: 'CC0-1.0' }],
    provenance: {
      compiler: 'test',
      compilerVersion: '1',
      sources: [{ id: 'test', release: '1' }],
    },
    files: [
      {
        path: 'elevation.pmtiles',
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
        bytes: 1,
      },
    ],
    ...overrides,
  };
}

describe('Web Mercator terrain coordinates', () => {
  it('round-trips WGS84 points using +Z south', () => {
    expect(wgs84ToWebMercator(0, 0)).toEqual([0, 0]);
    const projected = wgs84ToWebMercator(-122.3321, 47.6062);
    expect(projected[0]).toBeLessThan(0);
    expect(projected[1]).toBeLessThan(0);
    const roundTrip = webMercatorToWgs84(projected[0], projected[1]);
    expect(roundTrip[0]).toBeCloseTo(-122.3321, 8);
    expect(roundTrip[1]).toBeCloseTo(47.6062, 8);
  });

  it('addresses and bounds the XYZ tile containing a point', () => {
    expect(wgs84ToWebMercatorTile(0, 0, 1)).toEqual({ level: 1, x: 1, y: 1 });
    const bounds = webMercatorTileBounds({ level: 1, x: 1, y: 1 });
    expect(bounds[0]).toBeCloseTo(0);
    expect(bounds[1]).toBeCloseTo(0);
    expect(bounds[2]).toBeCloseTo(WEB_MERCATOR_HALF_WORLD_METERS);
    expect(bounds[3]).toBeCloseTo(WEB_MERCATOR_HALF_WORLD_METERS);
  });
});

describe('terrain package elevation adapter', () => {
  it('maps a Web Mercator package level onto the generic fixed grid', () => {
    const descriptor = terrainDescriptorFromPackage(packageDescriptor(), 2);
    expect(descriptor.gridSize).toEqual([4, 4]);
    expect(descriptor.origin).toEqual([
      -WEB_MERCATOR_HALF_WORLD_METERS,
      -WEB_MERCATOR_HALF_WORLD_METERS,
    ]);
    expect(descriptor.chunkSize).toBeCloseTo(WEB_MERCATOR_HALF_WORLD_METERS / 2);
    expect(descriptor.format).toBe('molen/terrain@2');
  });

  it('decodes PNG16 archive tiles and flips Y for a TMS package', async () => {
    const pkg = packageDescriptor({
      tileMatrix: {
        scheme: 'tms',
        minLevel: 0,
        maxLevel: 8,
        rootTiles: [1, 1],
        tileResolution: 3,
      },
    });
    const descriptor = terrainDescriptorFromPackage(pkg, 2);
    const calls: number[][] = [];
    const png = encodePng16({ width: 3, height: 3, data: new Float32Array(9).fill(0.25) });
    const archive: TerrainTileArchive = {
      async getZxy(level, x, y): Promise<{ data: ArrayBuffer }> {
        calls.push([level, x, y]);
        return { data: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
      },
    };
    const source = createTerrainPackageHeightSource(pkg, descriptor, archive, 2);
    const tile = await source.load({ x: 1, z: 0 }, new AbortController().signal);
    expect(calls).toEqual([[2, 1, 3]]);
    const x = descriptor.origin[0] + descriptor.chunkSize * 1.5;
    const z = descriptor.origin[1] + descriptor.chunkSize * 0.5;
    expect(tile?.sampleHeight(x, z)).toBeCloseTo(150, 2);
  });

  it('crops a missing child from the nearest available parent without border seams', async () => {
    const pkg = packageDescriptor();
    const descriptor = terrainDescriptorFromPackage(pkg, 2);
    const calls: number[][] = [];
    const fallbacks: number[][] = [];
    const png = encodePng16({
      width: 3,
      height: 3,
      data: Float32Array.from({ length: 9 }, (_, index) => index / 8),
    });
    const archive: TerrainTileArchive = {
      async getZxy(level, x, y): Promise<{ data: ArrayBuffer } | undefined> {
        calls.push([level, x, y]);
        if (level !== 1 || x !== 1 || y !== 1) return undefined;
        return { data: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
      },
    };
    const source = createTerrainPackageHeightSource(pkg, descriptor, archive, 2, {
      onParentFallback: (event) =>
        fallbacks.push([
          event.requestedLevel,
          event.resolvedLevel,
          event.resolvedAddress.x,
          event.resolvedAddress.z,
        ]),
    });
    const signal = new AbortController().signal;
    const right = await source.load({ x: 3, z: 2 }, signal);
    const left = await source.load({ x: 2, z: 2 }, signal);
    const sharedX = descriptor.origin[0] + descriptor.chunkSize * 3;
    const sampleZ = descriptor.origin[1] + descriptor.chunkSize * 2.5;

    expect(calls).toEqual([
      [2, 3, 2],
      [1, 1, 1],
      [2, 2, 2],
      [1, 1, 1],
    ]);
    expect(fallbacks).toEqual([
      [2, 1, 1, 1],
      [2, 1, 1, 1],
    ]);
    expect(right?.sampleHeight(sharedX, sampleZ)).toBeCloseTo(
      left?.sampleHeight(sharedX, sampleZ) as number,
      5,
    );
    expect(right?.sampleHeight(sharedX + descriptor.chunkSize / 2, sampleZ)).toBeCloseTo(275, 1);
  });

  it('uses archive header coverage for parent fallback but supports strict mode', async () => {
    const pkg = packageDescriptor();
    const archive: TerrainTileArchive = {
      async getHeader() {
        return { minZoom: 0, maxZoom: 6, tileType: 2 };
      },
      async getZxy() {
        return undefined;
      },
    };
    await expect(openTerrainPackageElevation(pkg, { level: 8, archive })).resolves.toMatchObject({
      level: 8,
    });
    await expect(
      openTerrainPackageElevation(pkg, { level: 8, archive, parentFallback: false }),
    ).rejects.toThrow(/contains levels 0-6/);
  });

  it('verifies archive zoom coverage and PNG tile type', async () => {
    const pkg = packageDescriptor();
    const archive: TerrainTileArchive = {
      async getHeader() {
        return { minZoom: 0, maxZoom: 8, tileType: 1 };
      },
      async getZxy() {
        return undefined;
      },
    };
    await expect(openTerrainPackageElevation(pkg, { level: 4, archive })).rejects.toThrow(
      /tile type must be PNG/,
    );
  });

  it('streams a PMTiles archive through HTTP byte ranges', async () => {
    const png = encodePng16({ width: 3, height: 3, data: new Float32Array(9).fill(0.75) });
    const archive = createSingleTilePmtiles(png);
    const ranges: string[] = [];
    const server = createServer((request, response) => {
      const range = request.headers.range;
      if (range === undefined) {
        response.writeHead(400).end('Range header required');
        return;
      }
      ranges.push(range);
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (match === null) {
        response.writeHead(400).end('Malformed range');
        return;
      }
      const start = Number(match[1]);
      const end = Math.min(Number(match[2]), archive.byteLength - 1);
      if (start >= archive.byteLength) {
        response.writeHead(416, { 'Content-Range': `bytes */${archive.byteLength}` }).end();
        return;
      }
      const body = archive.subarray(start, end + 1);
      response
        .writeHead(206, {
          'Accept-Ranges': 'bytes',
          'Content-Length': body.byteLength,
          'Content-Range': `bytes ${start}-${end}/${archive.byteLength}`,
          ETag: '"terrain-test"',
        })
        .end(body);
    });

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      if (address === null || typeof address === 'string')
        throw new Error('missing test server port');
      const archiveUrl = `http://127.0.0.1:${address.port}/shared/world-elevation.pmtiles`;
      const pkg = packageDescriptor({
        tileMatrix: {
          scheme: 'xyz',
          minLevel: 0,
          maxLevel: 0,
          rootTiles: [1, 1],
          tileResolution: 3,
        },
        elevation: {
          source: { kind: 'pmtiles', url: archiveUrl },
          encoding: 'png16',
          height: { min: -100, max: 900 },
        },
        files: [],
      });
      const opened = await openTerrainPackagePyramid(pkg, {
        baseUrl: 'https://unused.example/terrain-package.json',
      });
      const tile = await opened.source.load({ level: 0, x: 0, z: 0 }, new AbortController().signal);

      expect(tile?.sampleHeight(0, 0)).toBeCloseTo(650, 1);
      expect(resolveTerrainPackageArchiveUrl(pkg.elevation.source)).toBe(archiveUrl);
      expect(ranges[0]).toBe('bytes=0-16383');
      expect(ranges).toHaveLength(2);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    }
  });

  it('rejects unsupported geospatial CRS and non-square local roots', () => {
    const geographic = packageDescriptor({
      coordinateSpace: {
        kind: 'geospatial',
        crs: 'EPSG:4326',
        ellipsoid: 'WGS84',
        bounds: [-180, -90, 180, 90],
      },
    });
    expect(() => terrainDescriptorFromPackage(geographic, 2)).toThrow(/supports EPSG:3857/);

    const rectangular = packageDescriptor({
      coordinateSpace: { kind: 'local', units: 'meters', bounds: [0, 0, 100, 50] },
    });
    expect(() => terrainDescriptorFromPackage(rectangular, 2)).toThrow(/must be square/);
  });
});

describe('terrain package pyramid adapter', () => {
  it('maps geographic coverage into the generic projected root quadtree', () => {
    const pkg = packageDescriptor({
      coordinateSpace: {
        kind: 'geospatial',
        crs: 'EPSG:3857',
        ellipsoid: 'WGS84',
        bounds: [-122.2, 47.5, -121.9, 47.75],
      },
    });
    const descriptor = terrainPyramidDescriptorFromPackage(pkg);
    // The projected frame is pre-multiplied by cos(center latitude) so world XZ is metric.
    const s = webMercatorScaleAtLatitude((47.5 + 47.75) / 2);
    const projected = wgs84ToWebMercator(-122.0356, 47.6163);
    const sammamish = [projected[0] * s, projected[1] * s];
    expect(descriptor.origin[0]).toBeCloseTo(-WEB_MERCATOR_HALF_WORLD_METERS * s, 3);
    expect(descriptor.origin[1]).toBeCloseTo(-WEB_MERCATOR_HALF_WORLD_METERS * s, 3);
    expect(descriptor.rootSize).toBeCloseTo(WEB_MERCATOR_HALF_WORLD_METERS * 2 * s, 3);
    expect(descriptor.metersPerUnit).toBeCloseTo(s, 12);
    expect(descriptor.coverage?.[0]).toBeLessThan(sammamish[0] as number);
    expect(descriptor.coverage?.[2]).toBeGreaterThan(sammamish[0] as number);
    expect(descriptor.coverage?.[1]).toBeLessThan(sammamish[1] as number);
    expect(descriptor.coverage?.[3]).toBeGreaterThan(sammamish[1] as number);
  });

  it('loads exact pyramid levels and applies TMS Y addressing', async () => {
    const pkg = packageDescriptor({
      tileMatrix: {
        scheme: 'tms',
        minLevel: 0,
        maxLevel: 3,
        rootTiles: [1, 1],
        tileResolution: 3,
      },
    });
    const descriptor = terrainPyramidDescriptorFromPackage(pkg);
    const png = encodePng16({ width: 3, height: 3, data: new Float32Array(9).fill(0.5) });
    const calls: number[][] = [];
    const archive: TerrainTileArchive = {
      async getZxy(level, x, y): Promise<{ data: ArrayBuffer }> {
        calls.push([level, x, y]);
        return { data: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
      },
    };
    const source = createTerrainPackagePyramidHeightSource(pkg, descriptor, archive);
    const tile = await source.load({ level: 2, x: 1, z: 0 }, new AbortController().signal);
    expect(calls).toEqual([[2, 1, 3]]);
    expect(tile?.sampleHeight(-5_000_000, -15_000_000)).toBeCloseTo(400, 1);
  });

  it('crops missing pyramid detail from the nearest resident archive ancestor', async () => {
    const pkg = packageDescriptor();
    const descriptor = terrainPyramidDescriptorFromPackage(pkg);
    const png = encodePng16({
      width: 3,
      height: 3,
      data: Float32Array.from({ length: 9 }, (_, index) => index / 8),
    });
    const calls: number[][] = [];
    const fallbacks: number[][] = [];
    const archive: TerrainTileArchive = {
      async getZxy(level, x, y): Promise<{ data: ArrayBuffer } | undefined> {
        calls.push([level, x, y]);
        if (level !== 1 || x !== 1 || y !== 1) return undefined;
        return { data: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
      },
    };
    const source = createTerrainPackagePyramidHeightSource(pkg, descriptor, archive, {
      onParentFallback: (event) =>
        fallbacks.push([
          event.requestedLevel,
          event.resolvedLevel,
          event.resolvedAddress.x,
          event.resolvedAddress.z,
        ]),
    });
    const tile = await source.load({ level: 2, x: 3, z: 2 }, new AbortController().signal);

    expect(calls).toEqual([
      [2, 3, 2],
      [1, 1, 1],
    ]);
    expect(fallbacks).toEqual([[2, 1, 1, 1]]);
    const origin = terrainPyramidTileOrigin(descriptor, { level: 2, x: 3, z: 2 });
    const size = terrainPyramidTileSize(descriptor, 2);
    expect(tile?.sampleHeight(origin[0] + size / 2, origin[1] + size / 2)).toBeCloseTo(275, 1);
  });

  it('coalesces and caches decoded ancestors shared by sparse descendant requests', async () => {
    const pkg = packageDescriptor();
    const descriptor = terrainPyramidDescriptorFromPackage(pkg);
    const png = encodePng16({ width: 3, height: 3, data: new Float32Array(9).fill(0.5) });
    const calls: string[] = [];
    const archive: TerrainTileArchive = {
      async getZxy(level, x, y): Promise<{ data: ArrayBuffer } | undefined> {
        calls.push(`${level}/${x}/${y}`);
        if (level !== 1 || x !== 0 || y !== 0) return undefined;
        await Promise.resolve();
        return { data: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) };
      },
    };
    let fallbacks = 0;
    const source = createTerrainPackagePyramidHeightSource(pkg, descriptor, archive, {
      onParentFallback: () => fallbacks++,
    });
    const signal = new AbortController().signal;
    await Promise.all([
      source.load({ level: 2, x: 0, z: 0 }, signal),
      source.load({ level: 2, x: 1, z: 0 }, signal),
    ]);
    await source.load({ level: 2, x: 0, z: 0 }, signal);

    expect(calls).toEqual(['2/0/0', '2/1/0', '1/0/0']);
    expect(fallbacks).toBe(3);
  });

  it('keeps semantic detail above DEM levels only when ancestor fallback is enabled', async () => {
    const pkg = packageDescriptor();
    const archive: TerrainTileArchive = {
      async getHeader() {
        return { minZoom: 2, maxZoom: 5, tileType: 2 };
      },
      async getZxy(): Promise<undefined> {
        return undefined;
      },
    };
    const opened = await openTerrainPackagePyramid(pkg, { archive });
    expect(opened.descriptor.minLevel).toBe(2);
    expect(opened.descriptor.maxLevel).toBe(8);
    const exact = await openTerrainPackagePyramid(pkg, { archive, parentFallback: false });
    expect(exact.descriptor.maxLevel).toBe(5);
  });
});

describe('terrain package semantic sidecars', () => {
  function semanticPackage(): TerrainPackageDescriptor {
    return packageDescriptor({
      tileMatrix: {
        scheme: 'tms',
        minLevel: 0,
        maxLevel: 8,
        rootTiles: [1, 1],
        tileResolution: 3,
      },
      landcover: {
        source: { kind: 'pmtiles', path: 'semantics.pmtiles' },
        encoding: 'mvt',
        layer: 'landcover',
      },
      features: {
        source: { kind: 'pmtiles', path: 'semantics.pmtiles' },
        encoding: 'mvt',
        layers: ['water', 'transportation', 'building'],
      },
    });
  }

  it('maps TMS rows and passes only declared source layers to the decoder', async () => {
    const pkg = semanticPackage();
    const archiveCalls: number[][] = [];
    const decodeCalls: unknown[] = [];
    const archive: TerrainTileArchive = {
      async getZxy(level, x, y): Promise<{ data: ArrayBuffer }> {
        archiveCalls.push([level, x, y]);
        return { data: Uint8Array.of(7, 8, 9).buffer };
      },
    };
    const decoder = {
      decode(data: Uint8Array, context: unknown) {
        decodeCalls.push([Array.from(data), context]);
        return createEmptyTerrainSemanticTile();
      },
    };
    const source = createTerrainPackageSemanticSource(pkg, 'features', archive, decoder);
    await expect(
      source.load({ level: 2, x: 1, z: 0 }, new AbortController().signal),
    ).resolves.toMatchObject({ format: 'molen/terrain-semantics@1' });

    expect(archiveCalls).toEqual([[2, 1, 3]]);
    expect(decodeCalls).toEqual([
      [
        [7, 8, 9],
        {
          address: { level: 2, x: 1, z: 0 },
          content: 'features',
          encoding: 'mvt',
          layers: ['water', 'transportation', 'building'],
        },
      ],
    ]);
  });

  it('clips each sidecar to its archive levels and reuses a shared archive', async () => {
    const pkg = semanticPackage();
    const archive: TerrainTileArchive = {
      async getHeader() {
        return { minZoom: 2, maxZoom: 6, tileType: 1 };
      },
      async getZxy(): Promise<undefined> {
        return undefined;
      },
    };
    const opened = await openTerrainPackageSemantics(pkg, {
      decoder: { decode: () => createEmptyTerrainSemanticTile() },
      landcoverArchive: archive,
      featuresArchive: archive,
    });
    expect(opened.landcover).toMatchObject({ minLevel: 2, maxLevel: 6, archive });
    expect(opened.features).toMatchObject({ minLevel: 2, maxLevel: 6, archive });
    await expect(
      opened.landcover?.source.load({ level: 1, x: 0, z: 0 }, new AbortController().signal),
    ).resolves.toBeUndefined();
  });

  it('rejects archive encodings and malformed decoder output at the boundary', async () => {
    const pkg = semanticPackage();
    const wrongArchive: TerrainTileArchive = {
      async getHeader() {
        return { minZoom: 0, maxZoom: 8, tileType: 2 };
      },
      async getZxy(): Promise<{ data: ArrayBuffer }> {
        return { data: new ArrayBuffer(0) };
      },
    };
    await expect(
      openTerrainPackageSemantics(pkg, {
        decoder: { decode: () => createEmptyTerrainSemanticTile() },
        landcoverArchive: wrongArchive,
        featuresArchive: wrongArchive,
      }),
    ).rejects.toThrow(/tile type must match mvt/);

    const source = createTerrainPackageSemanticSource(pkg, 'landcover', wrongArchive, {
      decode: () => ({ ...createEmptyTerrainSemanticTile(), landcover: undefined }) as never,
    });
    await expect(
      source.load({ level: 2, x: 0, z: 0 }, new AbortController().signal),
    ).rejects.toThrow(/collections must be arrays/);
  });

  it('shares one in-flight archive read and full decode for co-located semantic layers', async () => {
    const pkg = semanticPackage();
    let archiveReads = 0;
    const contexts: unknown[] = [];
    const archive: TerrainTileArchive = {
      async getZxy(): Promise<{ data: ArrayBuffer }> {
        archiveReads++;
        await Promise.resolve();
        return { data: Uint8Array.of(1, 2, 3).buffer };
      },
    };
    const source = createTerrainPackageCombinedSemanticSource(pkg, archive, {
      decode: (_data, context) => {
        contexts.push(context);
        return createEmptyTerrainSemanticTile();
      },
    });
    const address = { level: 4, x: 3, z: 5 };
    await Promise.all([
      source.load(address, new AbortController().signal),
      source.load(address, new AbortController().signal),
    ]);
    expect(archiveReads).toBe(1);
    expect(contexts).toEqual([
      {
        address,
        content: 'all',
        encoding: 'mvt',
        layers: ['landcover', 'water', 'transportation', 'building'],
      },
    ]);
  });
});

describe('terrain package metersPerUnit (Mercator scale)', () => {
  const geoPackage = (): TerrainPackageDescriptor =>
    packageDescriptor({
      coordinateSpace: {
        kind: 'geospatial',
        crs: 'EPSG:3857',
        ellipsoid: 'WGS84',
        bounds: [-122.2, 47.5, -121.9, 47.7],
      },
    });

  it('scales the projected pyramid root and coverage by cos(center latitude)', () => {
    const pkg = geoPackage();
    const s = webMercatorScaleAtLatitude(47.6);
    const d = terrainPyramidDescriptorFromPackage(pkg);
    expect(d.metersPerUnit).toBeCloseTo(s, 12);
    expect(d.rootSize).toBeCloseTo(WEB_MERCATOR_HALF_WORLD_METERS * 2 * s, 3);
    expect(d.origin[0]).toBeCloseTo(-WEB_MERCATOR_HALF_WORLD_METERS * s, 3);
    const [minX] = wgs84ToWebMercator(-122.2, 47.5);
    expect(d.coverage?.[0]).toBeCloseTo(minX * s, 3);
    const fixed = terrainDescriptorFromPackage(pkg, 8);
    expect(fixed.metersPerUnit).toBeCloseTo(s, 12);
    expect(fixed.chunkSize).toBeCloseTo(((WEB_MERCATOR_HALF_WORLD_METERS * 2) / 2 ** 8) * s, 6);
  });

  it('leaves local packages unscaled', () => {
    const pkg = packageDescriptor({
      coordinateSpace: { kind: 'local', units: 'meters', bounds: [0, 0, 1000, 1000] },
    });
    expect(terrainPyramidDescriptorFromPackage(pkg).metersPerUnit).toBeUndefined();
    expect(terrainDescriptorFromPackage(pkg, 2).metersPerUnit).toBeUndefined();
  });
});
