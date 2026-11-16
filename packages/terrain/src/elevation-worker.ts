/** PNG decoding, ancestor resampling, terrain meshing, road earthworks and ground cuts behind a
 * transferable worker boundary. Archive I/O stays on the host, including synthetic/native
 * archives; decoded caches stay here.
 */
import {
  cutTerrainGroundRequest,
  type TerrainGroundCutRequest,
  type TerrainGroundCutResult,
} from './ground-cutout';
import { Heightfield } from './heightfield';
import { buildChunkGeometry, type ChunkGeometry } from './mesh';
import {
  createTerrainPackagePyramidHeightSource,
  type TerrainParentFallbackEvent,
} from './package-client';
import type { TerrainPackageDescriptor, TerrainTileArchive } from './package-types';
import { surfaceDescriptor, type TerrainPyramidHeightSource } from './pyramid-stream';
import type { TerrainPyramidDescriptor, TerrainPyramidTileAddress } from './pyramid-types';
import { gradeRoadEarthworksRequest } from './road-earthworks';
import type { TerrainSemanticPolygon } from './semantic-types';

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
  stage: 'decode' | 'resample' | 'mesh' | 'earthworks' | 'cut';
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
  /** Earthworks moved nothing: the field sent stands. */
  unchanged?: true;
}
/** A `RoadEarthworksRequest` as it crosses: the field as samples, the lines as their arrays. */
interface EarthworksMessage {
  surfaceResolution: number;
  maxSpacing: number;
  lines: { points: Float64Array; halfWidth: number; bounds: [number, number, number, number] }[];
  water: TerrainSemanticPolygon[];
  referenceLevel: number;
  reach: number;
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
  | { kind: 'field'; id: number; address: TerrainPyramidTileAddress }
  | {
      kind: 'earthworks';
      id: number;
      address: TerrainPyramidTileAddress;
      field: FieldMessage;
      earthworks: EarthworksMessage;
    }
  | {
      kind: 'mesh';
      id: number;
      address: TerrainPyramidTileAddress;
      resolution: number;
      field: FieldMessage;
    }
  | { kind: 'cut'; id: number; cut: TerrainGroundCutRequest }
  | { kind: 'cancel'; id: number }
  | { kind: 'archive-result'; id: number; data?: ArrayBuffer; error?: string };
interface CutReply {
  kind: 'cut';
  id: number;
  error?: string;
  result?: TerrainGroundCutResult;
}
type Reply =
  | PreparedReply
  | CutReply
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
    return meshEvery(
      hf,
      address,
      Math.max(1, Math.ceil((descriptor.tileResolution - 1) / (resolution - 1))),
    );
  };
  /** Mesh every `step`th sample of a field. */
  const meshEvery = (
    hf: Heightfield,
    address: TerrainPyramidTileAddress,
    step: number,
  ): ChunkGeometry => {
    if (!descriptor) throw new Error('Elevation worker is not configured');
    const begin = performance.now();
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
  const fieldOf = (hf: Heightfield): FieldMessage => ({
    grid: hf.copySamples(),
    cols: hf.cols,
    rows: hf.rows,
    origin: hf.origin,
    worldSize: hf.worldSize,
    height: hf.heightRange,
  });
  const heightfieldOf = (field: FieldMessage): Heightfield =>
    new Heightfield(field.grid, field.cols, field.rows, {
      origin: field.origin,
      worldSize: field.worldSize,
      height: field.height,
      validated: true,
    });
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
        const field = fieldOf(hf);
        send({ kind: 'prepared', id: request.id, field, geometry }, [
          field.grid.buffer,
          ...geometryBuffers(geometry),
        ]);
      };
      void prepare()
        .catch((error) => send({ kind: 'prepared', id: request.id, error: String(error) }))
        .finally(() => requests.delete(request.id));
    } else if (request.kind === 'field') {
      // The field alone, for a reader that draws nothing from it (a reference ground, a bore).
      const controller = new AbortController();
      requests.set(request.id, controller);
      const read = async (): Promise<void> => {
        if (!source) throw new Error('Elevation worker is not configured');
        const hf = await source.load(request.address, controller.signal);
        if (!hf || controller.signal.aborted) {
          send({ kind: 'prepared', id: request.id });
          return;
        }
        const field = fieldOf(hf);
        send({ kind: 'prepared', id: request.id, field }, [field.grid.buffer]);
      };
      void read()
        .catch((error) => send({ kind: 'prepared', id: request.id, error: String(error) }))
        .finally(() => requests.delete(request.id));
    } else if (request.kind === 'earthworks') {
      // A tile's ground graded for its roads and meshed again, in one trip: tens of milliseconds
      // for a city tile, which the host otherwise spends between its frames.
      const controller = new AbortController();
      requests.set(request.id, controller);
      const grade = async (): Promise<void> => {
        const pyramid = descriptor;
        const elevation = source;
        if (!elevation || !pyramid) throw new Error('Elevation worker is not configured');
        const hf = heightfieldOf(request.field);
        const begin = performance.now();
        const graded = await gradeRoadEarthworksRequest(
          pyramid,
          (address) => elevation.load(address, controller.signal),
          { address: request.address, heightfield: hf, ...request.earthworks },
        );
        if (controller.signal.aborted) {
          send({ kind: 'prepared', id: request.id });
          return;
        }
        send({
          kind: 'timing',
          timing: { stage: 'earthworks', milliseconds: performance.now() - begin },
        });
        if (graded === hf) {
          send({ kind: 'prepared', id: request.id, unchanged: true });
          return;
        }
        const side = Math.max(2, Math.floor(request.earthworks.surfaceResolution));
        const geometry = meshEvery(
          graded,
          request.address,
          Math.max(1, Math.floor((pyramid.tileResolution - 1) / (side - 1))),
        );
        const field = fieldOf(graded);
        send({ kind: 'prepared', id: request.id, field, geometry }, [
          field.grid.buffer,
          ...geometryBuffers(geometry),
        ]);
      };
      void grade()
        .catch((error) => send({ kind: 'prepared', id: request.id, error: String(error) }))
        .finally(() => requests.delete(request.id));
    } else if (request.kind === 'cut') {
      // Openings cut from a ground mesh (see TerrainGroundCutoutController): tens of
      // milliseconds of clipping for a tile's land cover over a shoreline. A task later, so a
      // cut called off while it waited its turn (its tile left the view) is not made at all.
      const controller = new AbortController();
      requests.set(request.id, controller);
      setTimeout(() => {
        requests.delete(request.id);
        if (controller.signal.aborted) {
          send({ kind: 'cut', id: request.id });
          return;
        }
        try {
          const begin = performance.now();
          const { result, transfer } = cutTerrainGroundRequest(request.cut);
          send({
            kind: 'timing',
            timing: { stage: 'cut', milliseconds: performance.now() - begin },
          });
          send({ kind: 'cut', id: request.id, result }, transfer as Transferable[]);
        } catch (error) {
          send({ kind: 'cut', id: request.id, error: String(error) });
        }
      }, 0);
    } else if (request.kind === 'mesh') {
      // A field the host changed (see TerrainPyramidHeightSource.meshPrepared): meshed as above.
      try {
        const hf = heightfieldOf(request.field);
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
  const cuts = new Map<
    number,
    {
      resolve: (result: TerrainGroundCutResult | undefined) => void;
      reject: (error: Error) => void;
    }
  >();
  const listener = ({ data }: { data?: unknown }): void => {
    const reply = data as Reply;
    if (disposed) return;
    if (reply.kind === 'cut') {
      const waiter = cuts.get(reply.id);
      cuts.delete(reply.id);
      if (reply.error) waiter?.reject(new Error(reply.error));
      else waiter?.resolve(reply.result);
    } else if (reply.kind === 'prepared') {
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
    for (const waiter of cuts.values()) waiter.reject(failure);
    cuts.clear();
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
    return { heightfield: heightfieldOf(reply.field), geometry: reply.geometry };
  };
  const heightfieldOf = (f: FieldMessage): Heightfield =>
    new Heightfield(f.grid, f.cols, f.rows, {
      origin: f.origin,
      worldSize: f.worldSize,
      height: f.height,
      // The worker built and checked this field; only its samples crossed.
      validated: true,
    });
  const cutGround: NonNullable<TerrainPyramidHeightSource['cutGround']> = (cut, signal) => {
    if (disposed || signal.aborted || failure) return Promise.resolve(undefined);
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const abort = (): void => {
        worker.postMessage({ kind: 'cancel', id });
        cuts.delete(id);
        resolve(undefined);
      };
      signal.addEventListener('abort', abort, { once: true });
      cuts.set(id, {
        resolve: (result) => {
          signal.removeEventListener('abort', abort);
          resolve(result);
        },
        reject: (error) => {
          signal.removeEventListener('abort', abort);
          reject(error);
        },
      });
      // No transfer list: the mesh's arrays are copied across, and the mesh stays as it is.
      worker.postMessage({ kind: 'cut', id, cut } satisfies Request);
    });
  };
  /** The mesh the worker made of each field it graded, until the stream asks for it. */
  const graded = new WeakMap<Heightfield, { side: number; geometry: ChunkGeometry }>();
  const gradeEarthworks: NonNullable<TerrainPyramidHeightSource['gradeEarthworks']> = async (
    earthworks,
    signal,
  ) => {
    if (disposed || signal.aborted) return undefined;
    if (failure) throw failure;
    const { heightfield, address, lines, water, ...rest } = earthworks;
    // A copy crosses: the caller keeps its field, which stands when nothing moves.
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
      (id) => ({
        kind: 'earthworks',
        id,
        address,
        field,
        earthworks: {
          ...rest,
          // Copied as they cross; the lines' own arrays stay for the next tile that needs them.
          lines: lines.map((line) => ({
            points: line.points,
            halfWidth: line.halfWidth,
            bounds: line.bounds,
          })),
          water: [...water],
        },
      }),
      signal,
      [grid.buffer],
    );
    if (disposed || signal.aborted) return undefined;
    if (reply.unchanged) return heightfield;
    if (!reply.field) return undefined;
    const result = heightfieldOf(reply.field);
    if (reply.geometry)
      graded.set(result, {
        side: Math.max(2, Math.floor(earthworks.surfaceResolution)),
        geometry: reply.geometry,
      });
    return result;
  };
  const meshPrepared: NonNullable<TerrainPyramidHeightSource['meshPrepared']> = async (
    heightfield,
    address,
    signal,
    resolution,
  ) => {
    if (disposed || signal.aborted) return undefined;
    if (failure) throw failure;
    // Graded here a moment ago: the worker meshed it in the same trip.
    const ready = graded.get(heightfield);
    if (ready !== undefined) {
      graded.delete(heightfield);
      const step = Math.max(1, Math.ceil((descriptor.tileResolution - 1) / (resolution - 1)));
      if (ready.side === Math.floor((descriptor.tileResolution - 1) / step) + 1)
        return ready.geometry;
    }
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
    gradeEarthworks,
    cutGround,
    // The field alone: meshed too, as it once was, each reference tile a road grading read cost
    // the worker a full-resolution mesh that nobody drew, about as many as the tiles on show.
    async load(address, signal) {
      if (disposed || signal.aborted) return undefined;
      if (failure) throw failure;
      const reply = await request((id) => ({ kind: 'field', id, address }), signal);
      if (disposed || signal.aborted || !reply.field) return undefined;
      return heightfieldOf(reply.field);
    },
    dispose() {
      disposed = true;
      worker.removeEventListener?.('message', listener);
      worker.removeEventListener?.('error', onError);
      for (const [id, waiter] of pending) waiter.resolve({ kind: 'prepared', id });
      pending.clear();
      for (const waiter of cuts.values()) waiter.resolve(undefined);
      cuts.clear();
      if (options.ownsWorker !== false) worker.terminate?.();
    },
  };
}
