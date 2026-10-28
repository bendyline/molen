import { describe, expect, it } from 'vitest';
import {
  createTerrainSemanticDecoderWorker,
  installTerrainSemanticDecoderWorker,
  packTerrainSemanticTile,
  type TerrainSemanticDecoderWorker,
  unpackTerrainSemanticTile,
} from '../src/semantic-decoder-worker';
import { terrainSemanticTilePacket } from '../src/semantic-packet';
import {
  createEmptyTerrainSemanticTile,
  terrainSemanticTileContentHash,
} from '../src/semantic-types';

/** A worker and its global scope, connected in memory with structured cloning. */
function pair(): { worker: TerrainSemanticDecoderWorker; scope: TerrainSemanticDecoderWorker } {
  const toWorker: Array<(event: { data: unknown }) => void> = [];
  const toHost: Array<(event: { data: unknown }) => void> = [];
  const deliver = (listeners: typeof toWorker, message: unknown, transfer?: Transferable[]) => {
    const data = structuredClone(message, { transfer: transfer ?? [] });
    queueMicrotask(() => {
      for (const listener of listeners) listener({ data });
    });
  };
  return {
    worker: {
      postMessage: (message, transfer) => deliver(toWorker, message, transfer),
      addEventListener: (_type, listener) => toHost.push(listener),
    },
    scope: {
      postMessage: (message, transfer) => deliver(toHost, message, transfer),
      addEventListener: (_type, listener) => toWorker.push(listener),
    },
  };
}

describe('semantic tiles decoded in a worker', () => {
  it('returns what the worker decodes, keeps the caller bytes and reports failures', async () => {
    const { worker, scope } = pair();
    installTerrainSemanticDecoderWorker(scope, {
      decode(data, context) {
        if (data.length === 0) throw new Error('empty tile');
        const tile = createEmptyTerrainSemanticTile();
        tile.pois = [
          { class: `bytes-${data.length}-level-${context.address.level}`, point: [0, 0] },
        ];
        return tile;
      },
    });
    const decoder = createTerrainSemanticDecoderWorker(worker);
    const bytes = new Uint8Array([1, 2, 3]);
    const context = {
      address: { level: 14, x: 1, z: 2 },
      content: 'all' as const,
      encoding: 'mvt' as const,
      layers: ['poi'],
    };
    const tile = await decoder.decode(bytes, context);
    expect(tile.pois?.[0]?.class).toBe('bytes-3-level-14');
    expect(bytes.byteLength).toBe(3);
    await expect(decoder.decode(new Uint8Array(), context)).rejects.toThrow('empty tile');
    decoder.dispose();
    await expect(decoder.decode(bytes, context)).rejects.toThrow('disposed');
  });

  it('packs every line into one buffer and rebuilds the tile exactly', async () => {
    const tile = createEmptyTerrainSemanticTile();
    const ring = (x: number): [number, number][] => [
      [x, 0.1],
      [x + 0.1, 0.1],
      [x + 0.1, 0.2],
      [x, 0.2],
    ];
    tile.buildings = [
      {
        id: 7,
        class: 'building',
        height: 12,
        polygons: [{ outer: ring(0.1), holes: [ring(0.12).map(([u, v]) => [u / 2, v])] }],
      },
    ];
    tile.landcover = [{ class: 'park', polygons: [{ outer: ring(0.5) }] }];
    tile.transportation = [
      {
        class: 'minor_road',
        lines: [
          [
            [0, 0.5],
            [1 / 3, 0.5000000001],
          ],
          [
            [0.2, 0.25],
            [0.2, 0.3],
          ],
        ],
      },
    ];
    tile.pois = [{ class: 'bus_stop', point: [0.25, 0.75] }];
    const original = structuredClone(tile);
    const packed = packTerrainSemanticTile(tile);
    expect(packed.points).toHaveLength((4 + 4 + 4 + 2 + 2) * 2);
    // No point arrays are left to clone one by one.
    expect(packed.json).not.toMatch(/\[\s*0\.1\s*,/);
    expect(unpackTerrainSemanticTile(JSON.parse(packed.json ?? ''), packed.points)).toEqual(
      original,
    );
    // Numbers JSON would change go marked in the JSON, and come back exactly.
    const odd = structuredClone(original);
    (odd.buildings[0] as { height?: number }).height = Number.NaN;
    (odd.buildings[0] as { minHeight?: number }).minHeight = -0;
    (odd.pois as { point: [number, number] }[])[0] = {
      class: 'bus_stop',
      point: [-0, Infinity],
    } as never;
    const marked = packTerrainSemanticTile(odd);
    expect(marked.json).toBeDefined();
    const back = unpackTerrainSemanticTile(JSON.parse(marked.json ?? ''), marked.points);
    expect(back).toEqual(odd);
    expect(Object.is(back.buildings[0]?.minHeight, -0)).toBe(true);
    expect(Object.is(back.pois?.[0]?.point[0], -0)).toBe(true);
    // An undefined array entry, which JSON would turn to null, keeps the tile an object.
    const holey = structuredClone(original);
    (holey.buildings[0] as { tags?: unknown }).tags = { list: [1, undefined] } as never;
    const kept = packTerrainSemanticTile(holey);
    expect(kept.json).toBeUndefined();
    expect(unpackTerrainSemanticTile(structuredClone(kept.tile), kept.points)).toEqual(holey);

    const { worker, scope } = pair();
    installTerrainSemanticDecoderWorker(scope, { decode: () => structuredClone(original) });
    const decoder = createTerrainSemanticDecoderWorker(worker);
    const context = {
      address: { level: 15, x: 0, z: 0 },
      content: 'all' as const,
      encoding: 'mvt' as const,
      layers: ['buildings'],
    };
    const decoded = await decoder.decode(new Uint8Array([1]), context);
    expect(decoded).toEqual(original);
    // Hashed in the worker for content-keyed caches: equal content, equal hash.
    const hash = terrainSemanticTileContentHash(decoded);
    // It keeps the packet it arrived as, for the workers it goes on to.
    expect(terrainSemanticTilePacket(decoded)?.points).toHaveLength((4 + 4 + 4 + 2 + 2) * 2);
    expect(hash).toMatch(/^packed:/);
    expect(terrainSemanticTileContentHash(await decoder.decode(new Uint8Array([2]), context))).toBe(
      hash,
    );
    decoder.dispose();
  });
});
