import { describe, expect, it, vi } from 'vitest';
import { createAgricultureTileEnricher } from '../src/agriculture-client';
import {
  applyAgricultureGrid,
  decodeAgricultureGrid,
  type TerrainAgricultureGrid,
} from '../src/agriculture-grid';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';

const grid = (): TerrainAgricultureGrid => ({
  format: 'molen/agriculture-grid@1',
  level: 10,
  x: 244,
  z: 380,
  resolution: 2,
  source: 'fixture',
  year: 2021,
  palette: [{}, {}, { crop: 'maize' }],
  runs: [1, 0, 3, 2],
});
const address = { level: 10, x: 244, z: 380 };
const polygon = {
  outer: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ] as [number, number][],
};

describe('agricultural retrieval', () => {
  it('rejects oversized, truncated, overflowing and invalid RLE data', () => {
    for (const changed of [
      { runs: [1, 2] },
      { runs: [5, 2] },
      { runs: [4, 7] },
      { runs: [4, 2, 0] },
      { resolution: 512 },
      { palette: [{ confidence: 1.1 }] },
    ])
      expect(() => decodeAgricultureGrid({ ...grid(), ...changed })).toThrow();
  });
  it('uses source observations on farmland and preserves explicit mapped crops and forests', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [
      { id: 1, class: 'farmland', polygons: [polygon] },
      { id: 2, class: 'orchard', crop: 'olives', polygons: [polygon] },
      { id: 3, class: 'forest', polygons: [polygon] },
    ];
    const result = applyAgricultureGrid(tile, address, grid());
    expect(result.landcover.find((entry) => entry.id === 1)).toMatchObject({
      crop: 'maize',
      agriculture: { source: 'fixture', year: 2021 },
    });
    expect(result.landcover.slice(-2)).toEqual(tile.landcover.slice(-2));
    expect(tile.landcover[0]?.crop).toBeUndefined();
  });
  it('keeps classified cells and their anchors fixed through overzoom', () => {
    const tile = createEmptyTerrainSemanticTile();
    const parent = applyAgricultureGrid(tile, address, grid());
    const child = applyAgricultureGrid(tile, { level: 11, x: 489, z: 760 }, grid());
    expect(child.landcover).toHaveLength(1);
    expect(child.landcover[0]?.agriculture).toEqual(parent.landcover[0]?.agriculture);
    expect(child.landcover[0]?.polygons).toEqual([polygon]);
  });
  it('does not introduce coarse polygon explosions or low-confidence observations', () => {
    const many = { ...grid(), resolution: 64, runs: [4096, 2] };
    expect(
      applyAgricultureGrid(createEmptyTerrainSemanticTile(), address, many).landcover,
    ).toHaveLength(0);
    const weak = grid();
    weak.palette[2] = { crop: 'maize', confidence: 0.3 };
    expect(
      applyAgricultureGrid(createEmptyTerrainSemanticTile(), address, weak).landcover,
    ).toHaveLength(0);
  });
  it('enriches small mapped polygons inside an overzoomed cell and keeps unnamed fields distinct', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [
      {
        class: 'farmland',
        polygons: [
          {
            outer: [
              [0.1, 0.1],
              [0.2, 0.1],
              [0.2, 0.2],
              [0.1, 0.2],
            ],
          },
        ],
      },
    ];
    const inside = applyAgricultureGrid(tile, { level: 14, x: 3913, z: 6081 }, grid());
    expect(inside.landcover.at(-1)?.crop).toBe('maize');
    const source = grid();
    source.palette.push({ crop: 'rice' });
    source.runs = [1, 2, 3, 3];
    tile.landcover = [0, 0.6].map((x) => ({
      class: 'farmland',
      polygons: [
        {
          outer: [
            [x, 0.1],
            [x + 0.2, 0.1],
            [x + 0.2, 0.2],
            [x, 0.2],
          ],
        },
      ],
    }));
    const result = applyAgricultureGrid(tile, address, source).landcover.slice(-2);
    expect(result.map((feature) => feature.crop)).toEqual(['maize', 'rice']);
    expect(result[0]?.agriculture?.fieldId).not.toBe(result[1]?.agriculture?.fieldId);
  });
  it('shares bounded downloads across semantic layers and preserves fallback on missing tiles', async () => {
    let calls = 0;
    const source = {
      urlTemplate: 'https://test.invalid/{z}/{x}/{y}.json',
      level: 10,
      source: 'fixture',
      year: 2021,
    };
    const enrich = createAgricultureTileEnricher(source, undefined, {
      fetch: (async () => {
        calls++;
        return new Response(JSON.stringify(grid()));
      }) as typeof fetch,
    });
    const base = { load: async () => createEmptyTerrainSemanticTile() };
    const signal = new AbortController().signal;
    const [a, b] = await Promise.all([
      enrich(base).load(address, signal),
      enrich(base).load(address, signal),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(a?.landcover.length).toBe(3);
    const missing = createAgricultureTileEnricher(source, undefined, {
      fetch: (async () => new Response(null, { status: 404 })) as typeof fetch,
    });
    expect(await missing(base).load(address, signal)).toEqual(await base.load());
  });
  it('rejects mismatched provenance and byte overruns without taking down the basemap', async () => {
    for (const payload of [JSON.stringify({ ...grid(), year: 2025 }), ' '.repeat(2048)]) {
      const errors: Error[] = [];
      const enrich = createAgricultureTileEnricher(
        {
          urlTemplate: 'https://test.invalid/{z}/{x}/{y}',
          level: 10,
          source: 'fixture',
          year: 2021,
          maxTileBytes: 1024,
        },
        undefined,
        {
          fetch: (async () => new Response(payload)) as typeof fetch,
          onError: (error) => errors.push(error),
        },
      );
      const base = createEmptyTerrainSemanticTile();
      expect(
        await enrich({ load: async () => base }).load(address, new AbortController().signal),
      ).toBe(base);
      expect(errors).toHaveLength(1);
    }
  });
  it('shares a failure cooldown, then retries a recovered source', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    let calls = 0;
    const enrich = createAgricultureTileEnricher(
      { urlTemplate: 'https://test.invalid/{z}/{x}/{y}', level: 10, source: 'fixture', year: 2021 },
      undefined,
      {
        fetch: (async () => {
          calls++;
          return new Response(calls === 1 ? 'invalid' : JSON.stringify(grid()));
        }) as typeof fetch,
      },
    );
    const source = enrich({ load: async () => createEmptyTerrainSemanticTile() });
    const signal = new AbortController().signal;
    try {
      expect((await source.load(address, signal))?.landcover).toHaveLength(0);
      expect((await source.load(address, signal))?.landcover).toHaveLength(0);
      expect(calls).toBe(1);
      now.mockReturnValue(31_001);
      expect((await source.load(address, signal))?.landcover).toHaveLength(3);
      expect(calls).toBe(2);
    } finally {
      now.mockRestore();
    }
  });
});
