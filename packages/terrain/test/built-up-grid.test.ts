import { describe, expect, it } from 'vitest';
import { createBuiltUpTileEnricher } from '../src/built-up-client';
import {
  decodeBuiltUpGrid,
  sampleTerrainBuiltUp,
  type TerrainBuiltUpGrid,
  terrainBuiltUpCoverage,
  terrainBuiltUpCovers,
  withTerrainBuiltUp,
} from '../src/built-up-grid';
import {
  deriveTerrainSemanticTilePacket,
  packTerrainSemanticTile,
  rememberTerrainSemanticTilePacket,
  terrainSemanticTileFromPacket,
  terrainSemanticTilePacket,
} from '../src/semantic-packet';
import {
  assertTerrainSemanticTile,
  createEmptyTerrainSemanticTile,
  setTerrainSemanticTileContentHash,
  terrainSemanticTileChecked,
  terrainSemanticTileContentHash,
} from '../src/semantic-types';

/** A 4 x 4 grid at level 10: 40% built in the north-west quarter, 10% in one south-east cell. */
const grid = (): TerrainBuiltUpGrid => ({
  format: 'molen/built-up-grid@1',
  level: 10,
  x: 244,
  z: 380,
  resolution: 4,
  source: 'fixture',
  year: 2020,
  runs: [2, 40, 2, 0, 2, 40, 2, 0, 7, 0, 1, 10],
});
const address = { level: 10, x: 244, z: 380 };
const source = {
  urlTemplate: 'https://test.invalid/{z}/{x}/{y}.json',
  level: 10,
  source: 'fixture',
  year: 2020,
};
const signal = new AbortController().signal;

describe('built-up grid', () => {
  it('rejects truncated, overflowing and out-of-range data', () => {
    for (const changed of [
      { runs: [16] },
      { runs: [15, 0] },
      { runs: [17, 0] },
      { runs: [16, 101] },
      { runs: [16, 0.5] },
      { resolution: 512 },
      { format: 'molen/agriculture-grid@1' },
    ])
      expect(() => decodeBuiltUpGrid({ ...grid(), ...changed } as TerrainBuiltUpGrid)).toThrow();
    expect(Array.from(decodeBuiltUpGrid(grid())).slice(0, 6)).toEqual([40, 40, 0, 0, 40, 40]);
  });

  it('gives a tile the cells lying over it, at the grid level and finer', () => {
    const whole = terrainBuiltUpCoverage(address, grid());
    expect(whole).toMatchObject({ columns: 4, rows: 4, box: [0, 0, 1, 1], source: 'fixture' });
    expect(whole?.values.slice(0, 4)).toEqual([0.4, 0.4, 0, 0]);
    // The south-east child holds the grid's last four cells.
    const child = terrainBuiltUpCoverage({ level: 11, x: 489, z: 761 }, grid());
    expect(child).toMatchObject({ columns: 2, rows: 2, box: [0, 0, 1, 1] });
    expect(child?.values).toEqual([0, 0, 0, 0.1]);
    // A tile finer than one cell reads the cell around it: the box reaches past the tile.
    const deep = terrainBuiltUpCoverage({ level: 13, x: 244 * 8, z: 380 * 8 }, grid());
    expect(deep).toMatchObject({ columns: 1, rows: 1, box: [0, 0, 2, 2], values: [0.4] });
    // Not this grid's descendant.
    expect(terrainBuiltUpCoverage({ level: 10, x: 245, z: 380 }, grid())).toBeUndefined();
    expect(terrainBuiltUpCoverage({ level: 9, x: 122, z: 190 }, grid())).toBeUndefined();
  });

  it('samples by tile-unit point, reading the nearest cell past the edge', () => {
    const coverage = terrainBuiltUpCoverage(address, grid());
    if (coverage === undefined) throw new Error('no coverage');
    expect(sampleTerrainBuiltUp(coverage, 0.1, 0.1)).toBe(0.4);
    expect(sampleTerrainBuiltUp(coverage, 0.6, 0.1)).toBe(0);
    expect(sampleTerrainBuiltUp(coverage, 0.9, 0.9)).toBe(0.1);
    expect(sampleTerrainBuiltUp(coverage, 1.4, 1.2)).toBe(0.1);
    expect(sampleTerrainBuiltUp(coverage, -0.2, -3)).toBe(0.4);
  });

  it('keeps a checked tile checked and rejects malformed coverage', () => {
    const tile = createEmptyTerrainSemanticTile();
    assertTerrainSemanticTile(tile);
    const coverage = terrainBuiltUpCoverage(address, grid());
    if (coverage === undefined) throw new Error('no coverage');
    const enriched = withTerrainBuiltUp(tile, coverage);
    expect(enriched.builtUp).toBe(coverage);
    expect(tile.builtUp).toBeUndefined();
    expect(terrainSemanticTileChecked(enriched)).toBe(true);
    expect(() =>
      assertTerrainSemanticTile({
        ...createEmptyTerrainSemanticTile(),
        builtUp: { ...coverage, values: [0.4] },
      }),
    ).toThrow(/builtUp/);
    expect(() =>
      assertTerrainSemanticTile({
        ...createEmptyTerrainSemanticTile(),
        builtUp: { ...coverage, values: coverage.values.map(() => 1.5) },
      }),
    ).toThrow(/builtUp/);
  });

  it('rides on the packet a decoded tile crosses to workers in', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings.push({
      class: 'building',
      polygons: [
        {
          outer: [
            [0.1, 0.1],
            [0.2, 0.1],
            [0.2, 0.2],
          ],
        },
      ],
    });
    const coverage = terrainBuiltUpCoverage(address, grid());
    if (coverage === undefined) throw new Error('no coverage');
    // A tile made on this thread has no packet, with or without evidence.
    expect(terrainSemanticTilePacket(withTerrainBuiltUp(tile, coverage))).toBeUndefined();
    // One from a decoder worker keeps its packet, with the evidence beside the packed points.
    const packet = packTerrainSemanticTile(tile);
    rememberTerrainSemanticTilePacket(tile, packet);
    const enriched = withTerrainBuiltUp(tile, coverage);
    const carried = terrainSemanticTilePacket(enriched);
    expect(carried?.points).toBe(packet.points);
    expect(carried?.builtUp).toBe(coverage);
    const received = terrainSemanticTileFromPacket(structuredClone(carried as typeof packet));
    expect(received.builtUp).toEqual(coverage);
    expect(received.buildings).toEqual(tile.buildings);
    // A tile derived from the enriched one (footprints filtered) still has a packet, and the evidence.
    const filtered = { ...enriched, buildings: [] };
    deriveTerrainSemanticTilePacket(enriched, filtered);
    const derived = terrainSemanticTilePacket(filtered);
    expect(derived?.builtUp).toBe(coverage);
    expect(terrainSemanticTileFromPacket(structuredClone(derived as typeof packet))).toMatchObject({
      buildings: [],
      builtUp: coverage,
    });
  });

  it('knows which tiles a bounded source covers', () => {
    // Level-10 tile 244/380 spans about 265.8°E..., i.e. -94.22..-93.87 longitude, 41.2..41.5 N.
    const inside = { bounds: [-95, 41, -93, 42] as [number, number, number, number] };
    const outside = { bounds: [0, 41, 5, 42] as [number, number, number, number] };
    expect(terrainBuiltUpCovers({}, address)).toBe(true);
    expect(terrainBuiltUpCovers(inside, address)).toBe(true);
    expect(terrainBuiltUpCovers(outside, address)).toBe(false);
  });
});

describe('built-up tile enricher', () => {
  it('shares one bounded download between tiles and names the grid in the content hash', async () => {
    let calls = 0;
    const enrich = createBuiltUpTileEnricher(source, undefined, {
      fetch: (async () => {
        calls++;
        return new Response(JSON.stringify(grid()));
      }) as typeof fetch,
    });
    const tile = createEmptyTerrainSemanticTile();
    setTerrainSemanticTileContentHash(tile, 'base');
    const base = { load: async () => tile };
    const [a, b, child] = await Promise.all([
      enrich(base).load(address, signal),
      enrich(base).load(address, signal),
      enrich({ load: async () => createEmptyTerrainSemanticTile() }).load(
        { level: 11, x: 489, z: 761 },
        signal,
      ),
    ]);
    expect(calls).toBe(1);
    expect(a?.builtUp?.values).toHaveLength(16);
    // One enriched tile per base tile.
    expect(b).toBe(a);
    expect(child?.builtUp?.values).toEqual([0, 0, 0, 0.1]);
    expect(a && terrainSemanticTileContentHash(a)).toBe(
      'base|builtUp:fixture@2020:10/244/380>10/244/380',
    );
  });

  it('reads a missing document as nothing built, inside the bounds only', async () => {
    const missing = (async () => new Response(null, { status: 404 })) as typeof fetch;
    const base = { load: async () => createEmptyTerrainSemanticTile() };
    const everywhere = createBuiltUpTileEnricher(source, undefined, { fetch: missing });
    expect((await everywhere(base).load(address, signal))?.builtUp).toMatchObject({
      columns: 1,
      rows: 1,
      values: [0],
    });
    let calls = 0;
    const elsewhere = createBuiltUpTileEnricher({ ...source, bounds: [0, 41, 5, 42] }, undefined, {
      fetch: (async () => {
        calls++;
        return new Response(null, { status: 404 });
      }) as typeof fetch,
    });
    expect((await elsewhere(base).load(address, signal))?.builtUp).toBeUndefined();
    expect(calls).toBe(0);
  });

  it('leaves tiles without evidence when the download fails, the identity is wrong or the tile is coarser', async () => {
    const base = { load: async () => createEmptyTerrainSemanticTile() };
    const errors: string[] = [];
    const failing = createBuiltUpTileEnricher(source, undefined, {
      fetch: (async () => new Response('nope', { status: 500 })) as typeof fetch,
      onError: (error) => errors.push(error.message),
    });
    expect((await failing(base).load(address, signal))?.builtUp).toBeUndefined();
    expect(errors).toHaveLength(1);
    const wrong = createBuiltUpTileEnricher(source, undefined, {
      fetch: (async () => new Response(JSON.stringify({ ...grid(), year: 2015 }))) as typeof fetch,
      onError: (error) => errors.push(error.message),
    });
    expect((await wrong(base).load(address, signal))?.builtUp).toBeUndefined();
    expect(errors[1]).toMatch(/identity/);
    let calls = 0;
    const counted = createBuiltUpTileEnricher(source, undefined, {
      fetch: (async () => {
        calls++;
        return new Response(JSON.stringify(grid()));
      }) as typeof fetch,
    });
    expect(
      (await counted(base).load({ level: 9, x: 122, z: 190 }, signal))?.builtUp,
    ).toBeUndefined();
    expect(calls).toBe(0);
    expect(() => createBuiltUpTileEnricher({ ...source, urlTemplate: 'no-tokens.json' })).toThrow();
  });
});
