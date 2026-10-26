/**
 * Vector-tile decoding in a worker. A tile's MVT bytes become its semantic features on the main
 * thread otherwise, 10-18 ms each for a town at a jet's speed: in a frame already full at High
 * detail, each was a late frame. The decoded tile is plain data, so the worker posts it back.
 */
import { createProtomapsTerrainMvtDecoder } from './mvt-semantic-decoder';
import type { TerrainSemanticTileDecodeContext, TerrainSemanticTileDecoder } from './package-types';
import type { TerrainSemanticTile } from './semantic-types';

interface DecodeRequest {
  id: number;
  data: Uint8Array;
  context: TerrainSemanticTileDecodeContext;
}
interface DecodeReply {
  id: number;
  tile?: TerrainSemanticTile;
  error?: string;
}

/** The part of a `Worker` (or a worker's global scope) the decoder needs. */
export interface TerrainSemanticDecoderWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener?(type: 'message', listener: (event: { data: unknown }) => void): void;
  terminate?(): void;
}

/** Serve decode requests in a worker, with the Protomaps preset unless given another decoder. */
export function installTerrainSemanticDecoderWorker(
  scope: Pick<TerrainSemanticDecoderWorker, 'postMessage' | 'addEventListener'>,
  decoder: TerrainSemanticTileDecoder = createProtomapsTerrainMvtDecoder(),
): void {
  scope.addEventListener('message', (event) => {
    const request = event.data as DecodeRequest;
    void (async () => {
      try {
        const tile = await decoder.decode(request.data, request.context);
        scope.postMessage({ id: request.id, tile } satisfies DecodeReply);
      } catch (error) {
        scope.postMessage({
          id: request.id,
          error: error instanceof Error ? error.message : String(error),
        } satisfies DecodeReply);
      }
    })();
  });
}

/**
 * A decoder that hands each tile to `worker` (one running `installTerrainSemanticDecoderWorker`).
 * The bytes are copied before they cross, as an archive may cache and reuse them.
 */
export function createTerrainSemanticDecoderWorker(
  worker: TerrainSemanticDecoderWorker,
): TerrainSemanticTileDecoder & { dispose(): void } {
  const pending = new Map<
    number,
    { resolve: (tile: TerrainSemanticTile) => void; reject: (error: Error) => void }
  >();
  let nextId = 1;
  let disposed = false;
  const listener = (event: { data: unknown }): void => {
    const reply = event.data as DecodeReply;
    const waiter = pending.get(reply.id);
    if (waiter === undefined) return;
    pending.delete(reply.id);
    if (reply.tile !== undefined) waiter.resolve(reply.tile);
    else waiter.reject(new Error(reply.error ?? 'Semantic tile decoding failed'));
  };
  worker.addEventListener('message', listener);
  return {
    decode(data, context) {
      if (disposed) return Promise.reject(new Error('Semantic decoder worker is disposed'));
      const id = nextId++;
      const copy = data.slice();
      return new Promise<TerrainSemanticTile>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, data: copy, context } satisfies DecodeRequest, [copy.buffer]);
      });
    },
    dispose() {
      disposed = true;
      worker.removeEventListener?.('message', listener);
      for (const waiter of pending.values())
        waiter.reject(new Error('Semantic decoder worker is disposed'));
      pending.clear();
      worker.terminate?.();
    },
  };
}
