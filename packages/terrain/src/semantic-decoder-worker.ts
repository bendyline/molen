/**
 * Vector-tile decoding in a worker. A tile's MVT bytes become its semantic features on the main
 * thread otherwise, 10-18 ms each for a town at a jet's speed: in a frame already full at High
 * detail, each was a late frame. The decoded tile is plain data, so the worker posts it back,
 * its points packed into one buffer (see packTerrainSemanticTile).
 */
import { createProtomapsTerrainMvtDecoder } from './mvt-semantic-decoder';
import type { TerrainSemanticTileDecodeContext, TerrainSemanticTileDecoder } from './package-types';
import {
  packTerrainSemanticTile,
  rememberTerrainSemanticTilePacket,
  unpackTerrainSemanticTile,
} from './semantic-packet';
import {
  assertTerrainSemanticTile,
  markTerrainSemanticTileChecked,
  setTerrainSemanticTileContentHash,
  type TerrainSemanticTile,
} from './semantic-types';

interface DecodeRequest {
  id: number;
  data: Uint8Array;
  context: TerrainSemanticTileDecodeContext;
}
interface DecodeReply {
  id: number;
  /** The tile with its lines packed into `points` (see packTerrainSemanticTile), as JSON when
   * it has no number JSON loses, else as an object. */
  json?: string;
  tile?: unknown;
  points?: Float64Array;
  /** A content hash of the packed tile (see terrainSemanticTileContentHash). */
  hash?: string;
  error?: string;
}

/** Two multiply-xor lanes over the packed tile's JSON text and point bits, plus their sizes. */
function packedHash(json: string, points: Float64Array): string {
  let a = 0xdeadbeef ^ json.length;
  let b = 0x41c6ce57 ^ points.length;
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    a = Math.imul(a ^ code, 2654435761);
    b = Math.imul(b ^ code, 1597334677);
  }
  const words = new Uint32Array(points.buffer, points.byteOffset, points.length * 2);
  for (let i = 0; i < words.length; i++) {
    const word = words[i] as number;
    a = Math.imul(a ^ word, 2654435761);
    b = Math.imul(b ^ word, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return `packed:${(b >>> 0).toString(16).padStart(8, '0')}${(a >>> 0).toString(16).padStart(8, '0')}:${json.length}:${points.length}`;
}

export { packTerrainSemanticTile, unpackTerrainSemanticTile } from './semantic-packet';

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
        const decoded = await decoder.decode(request.data, request.context);
        // Checked here, off the main thread; the receiver records it as checked.
        assertTerrainSemanticTile(decoded);
        const packed = packTerrainSemanticTile(decoded);
        // The worldgen cache keys tiles by content: hashed here rather than on the main thread.
        const hash = packed.json !== undefined ? packedHash(packed.json, packed.points) : undefined;
        scope.postMessage(
          {
            id: request.id,
            ...packed,
            ...(hash !== undefined ? { hash } : {}),
          } satisfies DecodeReply,
          [packed.points.buffer],
        );
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
    const packed = reply.json !== undefined ? JSON.parse(reply.json) : reply.tile;
    if (packed !== undefined) {
      const tile =
        reply.points !== undefined
          ? unpackTerrainSemanticTile(packed, reply.points)
          : (packed as TerrainSemanticTile);
      markTerrainSemanticTileChecked(tile);
      if (reply.hash !== undefined) setTerrainSemanticTileContentHash(tile, reply.hash);
      // Kept for the workers the tile goes on to (see terrainSemanticTilePacket); unpacking
      // rebuilt the object form, leaving the JSON text and points untouched.
      if (reply.json !== undefined && reply.points !== undefined)
        rememberTerrainSemanticTilePacket(tile, { json: reply.json, points: reply.points });
      waiter.resolve(tile);
    } else waiter.reject(new Error(reply.error ?? 'Semantic tile decoding failed'));
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
