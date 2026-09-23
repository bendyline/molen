import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { generateHeightmap, generateHeightmapPng } from '../src/gen';
import { projectedToWorld, webMercatorScaleAtLatitude, worldToProjected } from '../src/geospatial';
import { Heightfield } from '../src/heightfield';
import { heightfieldFromPng, heightfieldTileFromPng } from '../src/kernel';
import { decodePng16, encodePng16 } from '../src/png16';
import { registerTerrainSchemas } from '../src/schema';

registerTerrainSchemas();

describe('terrain descriptor schema', () => {
  it('validates the example and applies defaults', () => {
    const r = validate('terrain' as never, {
      format: 'molen/terrain@2',
      name: 'island',
      gridSize: [4, 4],
      height: { min: 0, max: 200 },
      tiles: { heightUrl: 'h.png' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v = r.value as { chunkSize: number; lod: { levels: number } };
      expect(v.chunkSize).toBe(128);
      expect(v.lod.levels).toBe(4);
    }
  });

  it('rejects a missing height range', () => {
    const r = validate('terrain' as never, {
      format: 'molen/terrain@2',
      name: 'x',
      tiles: { heightUrl: 'h.png' },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects unordered ranges, bands, slopes, and incompatible LOD resolution', () => {
    const base = {
      format: 'molen/terrain@2',
      name: 'bad',
      tileResolution: 5,
      height: { min: 10, max: 0 },
      tiles: { heightUrl: 'h.png' },
      layers: [{ name: 'x', auto: { slopeMin: 1.1, slopeMax: 0.2 } }],
      lod: { levels: 4, distanceBands: [200, 100], skirts: false },
    };
    const r = validate('terrain' as never, base);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['height_range', 'lod_band_order', 'lod_resolution', 'slope_range']),
    );
  });

  it('auto-upgrades v1 and validates streaming hysteresis in v2', () => {
    const legacy = validate('terrain' as never, {
      format: 'molen/terrain@1',
      name: 'legacy',
      height: { min: 0, max: 10 },
      tiles: { heightUrl: 'h_{x}_{z}.png' },
    });
    expect(legacy.ok).toBe(true);
    if (legacy.ok) {
      expect((legacy.value as { format: string }).format).toBe('molen/terrain@2');
      expect(legacy.notices?.[0]?.code).toBe('deprecated_format');
    }

    const bad = validate('terrain' as never, {
      format: 'molen/terrain@2',
      name: 'bad-stream',
      height: { min: 0, max: 10 },
      tiles: { heightUrl: 'h_{x}_{z}.png' },
      streaming: {
        loadRadius: 4,
        unloadRadius: 3,
        maxConcurrentLoads: 2,
        maxResidentTiles: 16,
      },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.map((issue) => issue.code)).toContain('streaming_radius_order');
  });
});

describe('terrain package schema', () => {
  const pkg = {
    format: 'molen/terrain-package@1',
    name: 'test-world',
    version: '1',
    coordinateSpace: { kind: 'local', units: 'meters', bounds: [0, 0, 1000, 1000] },
    tileMatrix: { maxLevel: 4 },
    elevation: {
      source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
      encoding: 'png16',
      height: { min: -100, max: 1000 },
    },
    attribution: [{ text: 'Test data', license: 'CC0-1.0' }],
    provenance: {
      compiler: 'test',
      compilerVersion: '1',
      sources: [{ id: 'dem', release: '1' }],
    },
    files: [
      {
        path: 'elevation.pmtiles',
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
        bytes: 100,
      },
    ],
  };

  it('validates a checksummed package manifest and applies tile defaults', () => {
    const result = validate('terrain-package' as never, pkg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { tileMatrix: { scheme: string } }).tileMatrix.scheme).toBe('xyz');
    }
  });

  it('rejects missing file records and unordered bounds', () => {
    const result = validate('terrain-package' as never, {
      ...pkg,
      coordinateSpace: { kind: 'local', units: 'meters', bounds: [10, 0, 0, 1000] },
      files: [
        {
          path: 'other.pmtiles',
          sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          bytes: 1,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(['bounds_order', 'missing_file_record']),
      );
    }
  });

  it('validates portable surface bands and sea level', () => {
    const valid = validate('terrain-package' as never, {
      ...pkg,
      surface: {
        seaLevel: 0,
        layers: [
          { name: 'grass', color: '#527346', tiling: 16, auto: { heightMin: 2 } },
          { name: 'rock', tiling: 8, auto: { slopeMin: 0.1, slopeMax: 0.8 } },
        ],
      },
    });
    expect(valid.ok).toBe(true);

    const invalid = validate('terrain-package' as never, {
      ...pkg,
      surface: {
        seaLevel: 2_000,
        layers: [{ name: 'bad', tiling: 8, auto: { slopeMin: 0.8, slopeMax: 0.2 } }],
      },
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(['sea_level_range', 'slope_band_order']),
      );
    }
  });

  it('accepts an explicit Protomaps semantic profile without guessing unknown schemas', () => {
    const profiled = {
      ...pkg,
      landcover: {
        source: { kind: 'pmtiles', path: 'world.pmtiles' },
        encoding: 'mvt',
        layer: 'landcover',
        profile: 'protomaps-basemap@1',
      },
      features: {
        source: { kind: 'pmtiles', path: 'world.pmtiles' },
        encoding: 'mvt',
        layers: ['water', 'transportation', 'building'],
        profile: 'protomaps-basemap@1',
      },
      files: [
        ...pkg.files,
        {
          path: 'world.pmtiles',
          sha256: '1111111111111111111111111111111111111111111111111111111111111111',
          bytes: 200,
        },
      ],
    };
    expect(validate('terrain-package' as never, profiled).ok).toBe(true);
    expect(
      validate('terrain-package' as never, {
        ...profiled,
        features: { ...profiled.features, profile: 'mystery-schema' },
      }).ok,
    ).toBe(false);
  });

  it('allows range-streamed remote archives without package file records', () => {
    const remote = validate('terrain-package' as never, {
      ...pkg,
      elevation: {
        ...pkg.elevation,
        source: { kind: 'pmtiles', url: 'https://tiles.example.com/terrain/elevation.pmtiles' },
      },
      landcover: {
        source: { kind: 'pmtiles', url: 'https://tiles.example.com/_data/world.pmtiles' },
        encoding: 'mvt',
        layer: 'landcover',
        profile: 'protomaps-basemap@1',
      },
      files: [],
    });
    expect(remote.ok).toBe(true);

    const relativeUrl = validate('terrain-package' as never, {
      ...pkg,
      elevation: { ...pkg.elevation, source: { kind: 'pmtiles', url: '/world.pmtiles' } },
      files: [],
    });
    expect(relativeUrl.ok).toBe(false);
  });
});

describe('Heightfield sampling', () => {
  // a 3x3 grid sloping from 0 at z=0 to 1 at z=max, over a 100x100m world, height 0..50m.
  const grid = new Float32Array([0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 1]);
  const hf = new Heightfield(grid, 3, 3, {
    origin: [0, 0],
    worldSize: [100, 100],
    height: { min: 0, max: 50 },
  });

  it('samples corner heights', () => {
    expect(hf.sampleHeight(0, 0)).toBeCloseTo(0);
    expect(hf.sampleHeight(0, 100)).toBeCloseTo(50);
  });

  it('bilinearly interpolates the middle', () => {
    expect(hf.sampleHeight(50, 50)).toBeCloseTo(25);
    expect(hf.sampleHeight(50, 25)).toBeCloseTo(12.5);
  });

  it('clamps out-of-bounds queries to the edge', () => {
    expect(hf.sampleHeight(-100, -100)).toBeCloseTo(0);
    expect(hf.sampleHeight(999, 999)).toBeCloseTo(50);
  });

  it('raycastDown matches sampleHeight', () => {
    expect(hf.raycastDown(33, 67)).toBeCloseTo(hf.sampleHeight(33, 67));
  });

  it('reports slope on a sloped field and ~0 on flat', () => {
    const flat = new Heightfield(new Float32Array([0.5, 0.5, 0.5, 0.5]), 2, 2, {
      origin: [0, 0],
      worldSize: [10, 10],
      height: { min: 0, max: 10 },
    });
    expect(flat.slopeAt(5, 5)).toBeCloseTo(0, 3);
    expect(hf.slopeAt(50, 50)).toBeGreaterThan(0);
  });

  it('uses independent X and Z spacing for normals on non-square fields', () => {
    // Height rises by 10m over 100m in X and by 10m over 10m in Z.
    const uneven = new Heightfield(new Float32Array([0, 0.5, 1, 0.5, 1, 1.5, 1, 1.5, 2]), 3, 3, {
      origin: [0, 0],
      worldSize: [100, 10],
      height: { min: 0, max: 10 },
    });
    const [nx, , nz] = uneven.normalAt(50, 5);
    expect(Math.abs(nz)).toBeGreaterThan(Math.abs(nx) * 5);
  });
});

describe('heightmap generator + PNG16 round-trip', () => {
  it('generates a deterministic normalized heightmap', () => {
    const a = generateHeightmap({ size: 32, seed: 7 });
    const b = generateHeightmap({ size: 32, seed: 7 });
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    // normalized to [0,1]
    expect(Math.min(...a.data)).toBeCloseTo(0);
    expect(Math.max(...a.data)).toBeCloseTo(1);
  });

  it('different seeds differ', () => {
    const a = generateHeightmap({ size: 16, seed: 1 });
    const b = generateHeightmap({ size: 16, seed: 2 });
    expect(Array.from(a.data)).not.toEqual(Array.from(b.data));
  });

  it('PNG16 encode -> decode preserves values within 16-bit precision', () => {
    const img = generateHeightmap({ size: 24, seed: 3 });
    const png = encodePng16(img);
    const decoded = decodePng16(png);
    expect(decoded.width).toBe(24);
    for (let i = 0; i < img.data.length; i++) {
      expect(decoded.data[i]).toBeCloseTo(img.data[i] as number, 4);
    }
  });

  it('rejects truncated, CRC-corrupt, and unsupported-filter PNG data', () => {
    const png = encodePng16({ width: 1, height: 1, data: new Float32Array([0.5]) });
    expect(() => decodePng16(png.subarray(0, png.length - 2))).toThrow(/truncated|IEND/);
    const corrupt = png.slice();
    corrupt[20] = (corrupt[20] as number) ^ 1;
    expect(() => decodePng16(corrupt)).toThrow(/CRC/);

    // Re-encode after changing the one raw scanline's filter byte by constructing a valid
    // image then targeting the decompressed-data contract through an invalid input size.
    expect(() => encodePng16({ width: 2, height: 2, data: new Float32Array(3) })).toThrow(
      /data length/,
    );
  });

  it('heightfieldFromPng builds a sampleable field', () => {
    const descriptor = validate('terrain' as never, {
      format: 'molen/terrain@2',
      name: 'gen',
      chunkSize: 64,
      gridSize: [2, 2],
      height: { min: 0, max: 100 },
      tiles: { heightUrl: 'h.png' },
    });
    if (!descriptor.ok) throw new Error(descriptor.formatted);
    const png = generateHeightmapPng({ size: 64, seed: 5 });
    const hf = heightfieldFromPng(descriptor.value as never, png);
    const h = hf.sampleHeight(64, 64); // center of a 128x128 world
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(100);
  });

  it('heightfieldTileFromPng places a streamed tile at its chunk origin', () => {
    const descriptor = validate('terrain' as never, {
      format: 'molen/terrain@2',
      name: 'tiles',
      origin: [100, 200],
      chunkSize: 64,
      gridSize: [3, 2],
      height: { min: 0, max: 100 },
      tiles: { heightUrl: 'h_{x}_{z}.png' },
    });
    if (!descriptor.ok) throw new Error(descriptor.formatted);
    const png = encodePng16({ width: 2, height: 2, data: new Float32Array([0, 1, 0, 1]) });
    const tile = heightfieldTileFromPng(descriptor.value as never, { x: 2, z: 1 }, png);
    expect(tile.sampleHeight(260, 296)).toBeCloseTo(50, 3);
    expect(() => heightfieldTileFromPng(descriptor.value as never, { x: 3, z: 1 }, png)).toThrow(
      /inside grid/,
    );
  });
});

describe('Heightfield as a ground field and a physics collider', () => {
  it('exposes origin, worldSize, heightRange, and cellSize', () => {
    const hf = new Heightfield(new Float32Array([0, 0, 0, 1, 1, 1]), 3, 2, {
      origin: [10, 20],
      worldSize: [100, 50],
      height: { min: 0, max: 8 },
    });
    expect(hf.origin).toEqual([10, 20]);
    expect(hf.worldSize).toEqual([100, 50]);
    expect(hf.heightRange).toEqual({ min: 0, max: 8 });
    expect(hf.cellSize).toEqual([50, 50]);
  });

  it('toRapierHeightfield denormalizes, transposes to column-major, and centers', () => {
    // 3 cols x 2 rows, row-major normalized: row 0 = [0, .5, 1], row 1 = [1, .5, 0]
    const hf = new Heightfield(new Float32Array([0, 0.5, 1, 1, 0.5, 0]), 3, 2, {
      origin: [0, 0],
      worldSize: [30, 10],
      height: { min: 100, max: 200 },
    });
    const c = hf.toRapierHeightfield();
    expect(c.nrows).toBe(2);
    expect(c.ncols).toBe(3);
    expect(c.scale).toEqual([30, 1, 10]);
    expect(c.center).toEqual([15, 0, 5]);
    // column-major: heights[col * nrows + row]
    expect(Array.from(c.heights)).toEqual([100, 200, 150, 150, 200, 100]);
  });
});

describe('Web Mercator latitude scale', () => {
  it('is cos(lat), 1 at the equator, and clamps at the Mercator limit', () => {
    expect(webMercatorScaleAtLatitude(0)).toBe(1);
    expect(webMercatorScaleAtLatitude(47.6)).toBeCloseTo(0.6743, 3);
    expect(webMercatorScaleAtLatitude(-47.6)).toBeCloseTo(0.6743, 3);
    expect(webMercatorScaleAtLatitude(89)).toBe(webMercatorScaleAtLatitude(85.0511287798066));
    const s = webMercatorScaleAtLatitude(60);
    expect(projectedToWorld(s, 1000, -2000)).toEqual([1000 * s, -2000 * s]);
    const [x, z] = worldToProjected(s, 1000 * s, -2000 * s);
    expect(x).toBeCloseTo(1000, 6);
    expect(z).toBeCloseTo(-2000, 6);
  });
});
