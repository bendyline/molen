/** PNG decoding, ancestor resampling and terrain meshing behind a transferable worker boundary.
 * Archive I/O stays on the host, including synthetic/native archives; decoded caches stay here.
 */
import { Heightfield } from './heightfield';
import { buildChunkGeometry, type ChunkGeometry } from './mesh';
import {
  createTerrainPackagePyramidHeightSource,
  type TerrainParentFallbackEvent,
} from './package-client';
import type { TerrainPackageDescriptor, TerrainTileArchive } from './package-types';
import { surfaceDescriptor, type TerrainPyramidHeightSource } from './pyramid-stream';
import type { TerrainPyramidDescriptor, TerrainPyramidTileAddress } from './pyramid-types';

export interface ElevationWorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message' | 'error',
    listener: (event: { data?: unknown; message?: string }) => void,
  ): void;
  removeEventListener?(
    type: 'message' | 'error',
    listener: (event: { data?: unknown; message?: string }) => void,
  ): void;
  terminate?(): void;
}
export interface ElevationStageTiming {
  stage: 'decode' | 'resample' | 'mesh';
  milliseconds: number;
}
export interface ElevationWorkerOptions {
  /** Defaults on for geospatial packages; false preserves raw DEM samples. */
  filterElevation?: boolean;
  onTiming?: (timing: ElevationStageTiming) => void;
  onParentFallback?: (event: TerrainParentFallbackEvent) => void;
  ownsWorker?: boolean;
  parentFallback?: boolean;
}
interface FieldMessage {
  grid: Float32Array;
  cols: number;
  rows: number;
  origin: [number, number];
  worldSize: [number, number];
  height: { min: number; max: number };
}
interface PreparedReply {
  kind: 'prepared';
  id: number;
  error?: string;
  field?: FieldMessage;
  geometry?: ChunkGeometry;
}
type Request =
  | {
      kind: 'configure';
      pkg: TerrainPackageDescriptor;
      descriptor: TerrainPyramidDescriptor;
      parentFallback: boolean;
      filterElevation?: boolean;
    }
  | { kind: 'prepare'; id: number; address: TerrainPyramidTileAddress; resolution: number }
  | {
      kind: 'mesh';
      id: number;
      address: TerrainPyramidTileAddress;
      resolution: number;
      field: FieldMessage;
    }
  | { kind: 'cancel'; id: number }
  | { kind: 'archive-result'; id: number; data?: ArrayBuffer; error?: string };
type Reply =
  | PreparedReply
  | { kind: 'archive'; id: number; level: number; x: number; y: number }
  | { kind: 'timing'; timing: ElevationStageTiming }
  | { kind: 'fallback'; event: TerrainParentFallbackEvent };

export function installTerrainElevationWorker(port: ElevationWorkerLike): void {
  let descriptor: TerrainPyramidDescriptor | undefined;
  let source: TerrainPyramidHeightSource | undefined;
  let archiveId = 0;
  const archiveRequests = new Map<
    number,
    { resolve: (data: { data: ArrayBuffer } | undefined) => void; reject: (error: Error) => void }
  >();
  const requests = new Map<number, AbortController>();
  const send = (message: Reply, transfer?: Transferable[]): void =>
    port.postMessage(message, transfer);
  const mesh = (
    hf: Heightfield,
    address: TerrainPyramidTileAddress,
    resolution: number,
  ): ChunkGeometry => {
    if (!descriptor) throw new Error('Elevation worker is not configured');
    const begin = performance.now();
    const step = Math.max(1, Math.ceil((descriptor.tileResolution - 1) / (resolution - 1)));
    const geometry = buildChunkGeometry(
      hf,
      surfaceDescriptor(descriptor, address),
      address.x,
      address.z,
      {
        localCoordinates: true,
        step,
      },
    );
    // Topology is cached in the worker and must not be detached by transfer.
    geometry.indices = geometry.indices.slice();
    send({ kind: 'timing', timing: { stage: 'mesh', milliseconds: performance.now() - begin } });
    return geometry;
  };
  const geometryBuffers = (geometry: ChunkGeometry): Transferable[] => [
    geometry.positions.buffer,
    geometry.normals.buffer,
    geometry.colors.buffer,
    geometry.indices.buffer,
  ];
  const archive: TerrainTileArchive = {
    getZxy(level, x, y) {
      const id = ++archiveId;
      return new Promise((resolve, reject) => {
        archiveRequests.set(id, { resolve, reject });
        send({ kind: 'archive', id, level, x, y });
      });
    },
  };
  port.addEventListener('message', ({ data }) => {
    const request = data as Request;
    if (request.kind === 'configure') {
      descriptor = request.descriptor;
      source = createTerrainPackagePyramidHeightSource(request.pkg, descriptor, archive, {
        ...(request.filterElevation !== undefined
          ? { filterElevation: request.filterElevation }
          : {}),
        parentFallback: request.parentFallback,
        onParentFallback: (event) => send({ kind: 'fallback', event }),
        onTiming: (timing) => send({ kind: 'timing', timing }),
      });
    } else if (request.kind === 'archive-result') {
      const pending = archiveRequests.get(request.id);
      archiveRequests.delete(request.id);
      if (request.error) pending?.reject(new Error(request.error));
      else pending?.resolve(request.data ? { data: request.data } : undefined);
    } else if (request.kind === 'cancel') requests.get(request.id)?.abort();
    else if (request.kind === 'prepare') {
      const controller = new AbortController();
      requests.set(request.id, controller);
      const prepare = async (): Promise<void> => {
        if (!source || !descriptor) throw new Error('Elevation worker is not configured');
        const hf = await source.load(request.address, controller.signal);
        if (!hf || controller.signal.aborted) {
          send({ kind: 'prepared', id: request.id });
          return;
        }
        const geometry = mesh(hf, request.address, request.resolution);
        const field = {
          grid: hf.copySamples(),
          cols: hf.cols,
          rows: hf.rows,
          origin: hf.origin,
          worldSize: hf.worldSize,
          height: hf.heightRange,
        };
        send({ kind: 'prepared', id: request.id, field, geometry }, [
          field.grid.buffer,
          ...geometryBuffers(geometry),
        ]);
      };
      void prepare()
        .catch((error) => send({ kind: 'prepared', id: request.id, error: String(error) }))
        .finally(() => requests.delete(request.id));
    } else if (request.kind === 'mesh') {
      // A field the host changed (see TerrainPyramidHeightSource.meshPrepared): meshed as above.
      try {
        const { field } = request;
        const hf = new Heightfield(field.grid, field.cols, field.rows, {
          origin: field.origin,
          worldSize: field.worldSize,
          height: field.height,
          validated: true,
        });
        const geometry = mesh(hf, request.address, request.resolution);
        send({ kind: 'prepared', id: request.id, geometry }, geometryBuffers(geometry));
      } catch (error) {
        send({ kind: 'prepared', id: request.id, error: String(error) });
      }
    }
  });
}

export function createTerrainElevationWorkerSource(
  worker: ElevationWorkerLike,
  pkg: TerrainPackageDescriptor,
  descriptor: TerrainPyramidDescriptor,
  archive: TerrainTileArchive,
  options: ElevationWorkerOptions = {},
): TerrainPyramidHeightSource {
  let disposed = false,
    nextId = 0;
  let failure: Error | undefined;
  const pending = new Map<
    number,
    { resolve: (reply: PreparedReply) => void; reject: (error: Error) => void }
  >();
  const listener = ({ data }: { data?: unknown }): void => {
    const reply = data as Reply;
    if (disposed) return;
    if (reply.kind === 'prepared') {
      const waiter = pending.get(reply.id);
      pending.delete(reply.id);
      if (reply.error) waiter?.reject(new Error(reply.error));
      else waiter?.resolve(reply);
    } else if (reply.kind === 'timing') options.onTiming?.(reply.timing);
    else if (reply.kind === 'fallback') options.onParentFallback?.(reply.event);
    else if (reply.kind === 'archive') {
      void archive
        .getZxy(reply.level, reply.x, reply.y)
        .then((tile) => {
          if (disposed) return;
          const buffer = tile?.data.slice(0);
          worker.postMessage(
            { kind: 'archive-result', id: reply.id, ...(buffer ? { data: buffer } : {}) },
            buffer ? [buffer] : [],
          );
        })
        .catch((error) => {
          if (!disposed)
            worker.postMessage({ kind: 'archive-result', id: reply.id, error: String(error) });
        });
    }
  };
  worker.addEventListener('message', listener);
  const onError = (event: { message?: string }): void => {
    failure = new Error(event.message ?? 'Elevation worker failed');
    for (const waiter of pending.values()) waiter.reject(failure);
    pending.clear();
  };
  worker.addEventListener('error', onError);
  worker.postMessage({
    kind: 'configure',
    pkg,
    descriptor,
    parentFallback: options.parentFallback !== false,
    ...(options.filterElevation !== undefined ? { filterElevation: options.filterElevation } : {}),
  } satisfies Request);
  const request = (
    message: (id: number) => Request,
    signal: AbortSignal,
    transfer: Transferable[] = [],
  ): Promise<PreparedReply> => {
    const id = ++nextId;
    return new Promise<PreparedReply>((resolve, reject) => {
      const abort = (): void => {
        worker.postMessage({ kind: 'cancel', id });
        pending.delete(id);
        resolve({ kind: 'prepared', id });
      };
      signal.addEventListener('abort', abort, { once: true });
      pending.set(id, {
        resolve: (value) => {
          signal.removeEventListener('abort', abort);
          resolve(value);
        },
        reject: (error) => {
          signal.removeEventListener('abort', abort);
          reject(error);
        },
      });
      worker.postMessage(message(id), transfer);
    });
  };
  const loadPrepared: NonNullable<TerrainPyramidHeightSource['loadPrepared']> = async (
    address,
    signal,
    resolution,
  ) => {
    if (disposed || signal.aborted) return undefined;
    if (failure) throw failure;
    const reply = await request((id) => ({ kind: 'prepare', id, address, resolution }), signal);
    if (disposed || signal.aborted || !reply.field || !reply.geometry) return undefined;
    const f = reply.field;
    return {
      heightfield: new Heightfield(f.grid, f.cols, f.rows, {
        origin: f.origin,
        worldSize: f.worldSize,
        height: f.height,
        // The worker built and checked this field; only its samples crossed.
        validated: true,
      }),
      geometry: reply.geometry,
    };
  };
  const meshPrepared: NonNullable<TerrainPyramidHeightSource['meshPrepared']> = async (
    heightfield,
    address,
    signal,
    resolution,
  ) => {
    if (disposed || signal.aborted) return undefined;
    if (failure) throw failure;
    // A copy crosses: the caller keeps its field for sampling and layers.
    const grid = heightfield.copySamples();
    const field: FieldMessage = {
      grid,
      cols: heightfield.cols,
      rows: heightfield.rows,
      origin: heightfield.origin,
      worldSize: heightfield.worldSize,
      height: heightfield.heightRange,
    };
    const reply = await request(
      (id) => ({ kind: 'mesh', id, address, resolution, field }),
      signal,
      [grid.buffer],
    );
    return disposed || signal.aborted ? undefined : reply.geometry;
  };
  return {
    loadPrepared,
    meshPrepared,
    async load(address, signal) {
      return (await loadPrepared(address, signal, descriptor.tileResolution))?.heightfield;
    },
    dispose() {
      disposed = true;
      worker.removeEventListener?.('message', listener);
      worker.removeEventListener?.('error', onError);
      for (const [id, waiter] of pending) waiter.resolve({ kind: 'prepared', id });
      pending.clear();
      if (options.ownsWorker !== false) worker.terminate?.();
    },
  };
}
