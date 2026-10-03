import { validate } from '@bendyline/molen-schema';
import { PMTiles, type RangeResponse, type Source } from 'pmtiles';
import { describe, expect, it } from 'vitest';
import {
  createTerrainArchiveSetRouter,
  encodeTerrainArchiveSetCells,
  type TerrainArchiveSetDescriptor,
  terrainArchiveSetTierCells,
} from '../src/archive-set';
import { createTerrainArchiveSetArchive } from '../src/archive-set-client';
import {
  encodeGeohash,
  geohashBounds,
  geohashFromIndex,
  geohashIndex,
  terrainTileGeohash,
} from '../src/geohash';
import { writePmtilesArchive } from '../src/pmtiles-writer';
import { registerTerrainSchemas } from '../src/schema';

registerTerrainSchemas();

/** The XYZ tile holding a point. */
function tileAt(level: number, longitude: number, latitude: number): [number, number] {
  const count = 2 ** level;
  const r = (latitude * Math.PI) / 180;
  return [
    Math.floor(((longitude + 180) / 360) * count),
    Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * count),
  ];
}

const SEATTLE = [-122.3321, 47.6062] as const;
const PARIS = [2.3522, 48.8566] as const;

function worldSet(): TerrainArchiveSetDescriptor {
  return {
    format: 'molen/archive-set@1',
    name: 'world-elevation',
    tileType: 'png',
    base: { url: 'base.pmtiles', minLevel: 0, maxLevel: 5 },
    archives: [],
    geohash: [
      {
        precision: 2,
        minLevel: 6,
        maxLevel: 8,
        url: 'g2/{cell}.pmtiles',
        cells: encodeTerrainArchiveSetCells(['c2', 'u0']),
      },
      {
        precision: 3,
        minLevel: 9,
        maxLevel: 13,
        url: 'build/g3/{cell}.pmtiles',
        cells: encodeTerrainArchiveSetCells(['c23', 'c22', 'u09']),
      },
    ],
  };
}

describe('geohash', () => {
  it('encodes, indexes and bounds standard geohashes', () => {
    expect(encodeGeohash(SEATTLE[0], SEATTLE[1], 4)).toBe('c23n');
    expect(encodeGeohash(PARIS[0], PARIS[1], 5)).toBe('u09tv');
    expect(encodeGeohash(-180, -90, 3)).toBe('000');
    expect(encodeGeohash(180, 90, 3)).toBe('zzz');
    expect(geohashIndex('c23')).toBe(11 * 1024 + 2 * 32 + 3);
    for (const hash of ['0', 'c23', 'u09tv', 'zzzzzz']) {
      expect(geohashFromIndex(geohashIndex(hash), hash.length)).toBe(hash);
    }
    const [west, south, east, north] = geohashBounds('c23');
    expect(east - west).toBeCloseTo(1.40625, 9);
    expect(north - south).toBeCloseTo(1.40625, 9);
    expect(SEATTLE[0]).toBeGreaterThanOrEqual(west);
    expect(SEATTLE[0]).toBeLessThan(east);
    expect(SEATTLE[1]).toBeGreaterThanOrEqual(south);
    expect(SEATTLE[1]).toBeLessThan(north);
    expect(() => geohashIndex('c2a')).toThrow(/not a geohash/);
    expect(() => encodeGeohash(0, 0, 7)).toThrow(RangeError);
  });

  it('gives every tile to the cell holding its center', () => {
    const [x, y] = tileAt(15, SEATTLE[0], SEATTLE[1]);
    expect(terrainTileGeohash(15, x, y, 3)).toBe('c23');
    // A coarse tile straddles cells; its center decides.
    const [cx, cy] = tileAt(8, SEATTLE[0], SEATTLE[1]);
    const count = 2 ** 8;
    const centerLongitude = ((cx + 0.5) / count) * 360 - 180;
    const centerLatitude =
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * (cy + 0.5)) / count))) * 180) / Math.PI;
    expect(terrainTileGeohash(8, cx, cy, 3)).toBe(
      encodeGeohash(centerLongitude, centerLatitude, 3),
    );
  });
});

describe('geohash-partitioned archive sets', () => {
  it('routes the base, then each tier by the cell of the tile center', () => {
    const router = createTerrainArchiveSetRouter(worldSet());
    expect(router.minLevel).toBe(0);
    expect(router.maxLevel).toBe(13);
    expect(router.resolve(3, 1, 2)?.kind).toBe('base');
    const [x7, y7] = tileAt(7, SEATTLE[0], SEATTLE[1]);
    expect(router.resolve(7, x7, y7)).toMatchObject({
      kind: 'cell',
      cell: 'c2',
      id: 'g2:c2',
      url: 'g2/c2.pmtiles',
    });
    const [x12, y12] = tileAt(12, SEATTLE[0], SEATTLE[1]);
    expect(router.resolve(12, x12, y12)).toMatchObject({
      kind: 'cell',
      cell: 'c23',
      url: 'build/g3/c23.pmtiles',
    });
    // Cells without an archive, levels past every tier, and out-of-range tiles cost nothing.
    const [ox, oy] = tileAt(12, -140, 30);
    expect(router.resolve(12, ox, oy)).toBeUndefined();
    expect(router.resolve(14, x12 * 4, y12 * 4)).toBeUndefined();
    expect(router.resolve(12, -1, 0)).toBeUndefined();
    expect(terrainArchiveSetTierCells(worldSet().geohash?.[1] as never).sort()).toEqual([
      'c22',
      'c23',
      'u09',
    ]);
  });

  it('rejects overlapping tiers, bad templates and cells past the precision', () => {
    const overlapping = {
      ...worldSet(),
      geohash: [
        { precision: 2, minLevel: 6, maxLevel: 9, url: 'a/{cell}.pmtiles', cells: '1' },
        { precision: 3, minLevel: 9, maxLevel: 13, url: 'b/{cell}.pmtiles', cells: '1' },
      ],
    };
    expect(() => createTerrainArchiveSetRouter(overlapping)).toThrow(/share levels/);
    expect(() =>
      createTerrainArchiveSetRouter({
        ...worldSet(),
        geohash: [{ precision: 3, minLevel: 9, maxLevel: 13, url: 'g3.pmtiles', cells: '1' }],
      }),
    ).toThrow(/\{cell\}/);
    expect(() =>
      createTerrainArchiveSetRouter({
        ...worldSet(),
        geohash: [{ precision: 1, minLevel: 9, maxLevel: 13, url: '{cell}.pmtiles', cells: '32' }],
      }),
    ).toThrow(/outside 32 cells/);
    // Quadtree archives still need their partition level.
    expect(() =>
      createTerrainArchiveSetRouter({
        ...worldSet(),
        archives: [{ id: 'a', url: 'a.pmtiles', minLevel: 9, maxLevel: 9, partitions: '0' }],
      }),
    ).toThrow(/partitionLevel/);
  });

  it('validates as molen/archive-set@1 without a partition level', () => {
    expect(validate('archive-set' as never, worldSet()).ok).toBe(true);
    const bad = validate('archive-set' as never, {
      ...worldSet(),
      base: { url: 'base.pmtiles', minLevel: 0, maxLevel: 6 },
      archives: [{ id: 'a', url: 'a.pmtiles', minLevel: 14, maxLevel: 14, partitions: '0' }],
      geohash: [
        { precision: 2, minLevel: 6, maxLevel: 9, url: 'a/{cell}.pmtiles', cells: '1' },
        { precision: 3, minLevel: 9, maxLevel: 13, url: 'b/{cell}.pmtiles', cells: '99999' },
      ],
    });
    expect(bad.ok).toBe(false);
    const codes = bad.ok ? [] : bad.issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'missing_partition_level',
        'base_overlap',
        'tier_overlap',
        'cell_range',
      ]),
    );
  });

  it('opens one archive per cell from the URL template, lazily', async () => {
    const [x12, y12] = tileAt(12, SEATTLE[0], SEATTLE[1]);
    const bytes = writePmtilesArchive(
      [{ z: 12, x: x12, y: y12, data: new TextEncoder().encode('seattle') }],
      { tileType: 'png', bounds: [-123.75, 46.4, -120.9, 47.8] },
    );
    const opened: string[] = [];
    const archive = createTerrainArchiveSetArchive(worldSet(), {
      baseUrl: 'https://tiles.example/terrain/world/archive-set.json',
      openArchive: (url, id) => {
        opened.push(`${id} ${url}`);
        const source: Source = {
          getKey: () => id,
          getBytes: async (offset: number, length: number): Promise<RangeResponse> => ({
            data: bytes.slice(offset, offset + length).buffer,
          }),
        };
        return new PMTiles(source);
      },
    });
    const tile = await archive.getZxy(12, x12, y12);
    expect(new TextDecoder().decode(tile?.data)).toBe('seattle');
    const [ox, oy] = tileAt(12, -140, 30);
    expect(await archive.getZxy(12, ox, oy)).toBeUndefined();
    expect(opened).toEqual(['g3:c23 https://tiles.example/terrain/world/build/g3/c23.pmtiles']);
    expect(archive.openArchiveIds()).toEqual(['g3:c23']);
    expect((await archive.getHeader()).maxZoom).toBe(13);
  });
});
