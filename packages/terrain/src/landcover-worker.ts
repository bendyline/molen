/** Off-thread terrain-grid draping and vertex welding. No WebGL context is created in workers. */
import * as THREE from 'three';
import { Heightfield } from './heightfield';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import { createLandcoverMesh, type TerrainSemanticMeshOptions } from './semantic-client';
import type { TerrainSemanticTile } from './semantic-types';

export interface TerrainLandcoverGenerator {
  generate(
    tile: TerrainSemanticTile,
    context: TerrainPyramidTileLayerContext,
    options: TerrainSemanticMeshOptions,
  ): Promise<THREE.Object3D | undefined>;
  dispose(): void;
}

export interface TerrainLandcoverWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message' | 'error',
    listener: (event: { data?: unknown; message?: string }) => void,
  ): void;
  removeEventListener(
    type: 'message' | 'error',
    listener: (event: { data?: unknown; message?: string }) => void,
  ): void;
  terminate(): void;
}

interface Request {
  id: number;
  tile: TerrainSemanticTile;
  context: Omit<TerrainPyramidTileLayerContext, 'heightfield' | 'signal' | 'admission'>;
  ground: {
    samples: Float32Array;
    cols: number;
    rows: number;
    origin: [number, number];
    worldSize: [number, number];
    height: { min: number; max: number };
  };
  options: Pick<TerrainSemanticMeshOptions, 'landcoverColors' | 'landcoverOffset'>;
}
interface Result {
  id: number;
  geometry?: {
    positions: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
    indices: Uint16Array | Uint32Array;
  };
  error?: string;
}

/** Pure message handler, usable with a worker scope or a test port. */
export function installTerrainLandcoverWorker(
  scope: Pick<TerrainLandcoverWorker, 'postMessage' | 'addEventListener'>,
): void {
  scope.addEventListener('message', (event) => {
    const request = event.data as Request;
    try {
      const ground = request.ground;
      const heightfield = new Heightfield(ground.samples, ground.cols, ground.rows, ground);
      const mesh = createLandcoverMesh(
        request.tile,
        { ...request.context, heightfield, signal: new AbortController().signal },
        request.options,
      );
      const result: Result = { id: request.id };
      if (mesh) {
        result.geometry = {
          positions: mesh.geometry.getAttribute('position').array as Float32Array,
          normals: mesh.geometry.getAttribute('normal').array as Float32Array,
          colors: mesh.geometry.getAttribute('color').array as Float32Array,
          indices: mesh.geometry.index?.array as Uint16Array | Uint32Array,
        };
        mesh.geometry.dispose();
      }
      scope.postMessage(
        result,
        result.geometry
          ? Object.values(result.geometry).map((array) => array.buffer as ArrayBuffer)
          : [],
      );
    } catch (error) {
      scope.postMessage({ id: request.id, error: (error as Error).message } satisfies Result);
    }
  });
}

/** One active job per worker; aborted queued jobs never perform expensive draping. */
export function createTerrainLandcoverWorkerBridge(
  worker: TerrainLandcoverWorker,
): TerrainLandcoverGenerator {
  interface Job {
    request: Request;
    signal: AbortSignal;
    resolve: (value: THREE.Object3D | undefined) => void;
    reject: (error: Error) => void;
    options: TerrainSemanticMeshOptions;
    cleanup: () => void;
  }
  const queue: Job[] = [];
  let active: Job | undefined;
  let nextId = 1;
  let disposed = false;
  // Match the in-thread landcover material; custom materials remain on the rendering thread.
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 });
  const pump = (): void => {
    if (active || disposed) return;
    while (queue.length) {
      const job = queue.shift() as Job;
      if (job.signal.aborted) {
        job.cleanup();
        job.resolve(undefined);
        continue;
      }
      active = job;
      worker.postMessage(job.request, [job.request.ground.samples.buffer]);
      return;
    }
  };
  const receive = (event: { data?: unknown }): void => {
    const result = event.data as Result;
    const job = active;
    if (!job || result.id !== job.request.id) return;
    active = undefined;
    job.cleanup();
    if (job.signal.aborted || disposed) job.resolve(undefined);
    else if (result.error) job.reject(new Error(result.error));
    else if (!result.geometry) job.resolve(undefined);
    else {
      const data = result.geometry;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
      const mesh = new THREE.Mesh(geometry, job.options.materials?.landcover ?? material);
      mesh.name = 'semantic:landcover';
      mesh.receiveShadow = true;
      mesh.renderOrder = 1;
      mesh.userData.terrainOwnedGeometry = true;
      job.resolve(mesh);
    }
    pump();
  };
  const fail = (event: { message?: string }): void => {
    disposed = true;
    for (const job of [...(active ? [active] : []), ...queue]) {
      job.cleanup();
      job.reject(new Error(event.message ?? 'Terrain landcover worker failed'));
    }
    active = undefined;
    queue.length = 0;
  };
  worker.addEventListener('message', receive);
  worker.addEventListener('error', fail);
  return {
    generate(tile, context, options) {
      if (disposed || context.signal.aborted) return Promise.resolve(undefined);
      const { heightfield, signal, admission: _admission, ...rest } = context;
      const request: Request = {
        id: nextId++,
        tile: { ...tile, buildings: [], transportation: [], water: [] },
        context: rest,
        ground: {
          samples: heightfield.copySamples(),
          cols: heightfield.cols,
          rows: heightfield.rows,
          origin: heightfield.origin,
          worldSize: heightfield.worldSize,
          height: heightfield.heightRange,
        },
        options: {
          ...(options.landcoverColors ? { landcoverColors: options.landcoverColors } : {}),
          ...(options.landcoverOffset !== undefined
            ? { landcoverOffset: options.landcoverOffset }
            : {}),
        },
      };
      return new Promise((resolve, reject) => {
        const abort = (): void => {
          resolve(undefined);
        };
        signal.addEventListener('abort', abort, { once: true });
        queue.push({
          request,
          signal,
          options,
          resolve,
          reject,
          cleanup: () => signal.removeEventListener('abort', abort),
        });
        pump();
      });
    },
    dispose() {
      disposed = true;
      worker.removeEventListener('message', receive);
      worker.removeEventListener('error', fail);
      worker.terminate();
      for (const job of [...(active ? [active] : []), ...queue]) {
        job.cleanup();
        job.resolve(undefined);
      }
      active = undefined;
      queue.length = 0;
      material.dispose();
    },
  };
}
