import { describe, expect, it } from 'vitest';
import {
  createTerrainSemanticDecoderWorker,
  installTerrainSemanticDecoderWorker,
  type TerrainSemanticDecoderWorker,
} from '../src/semantic-decoder-worker';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';

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
});
