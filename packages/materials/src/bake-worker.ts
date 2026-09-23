import { bakeMatGraph } from './matgraph';
import type { MatGraphDoc } from './matgraph-types';
import { bakePixelGrid } from './pixelgrid';
import type { PixelGridDoc } from './pixelgrid-types';
import type { BakedMaterial } from './types';

export interface MaterialBaker {
  bake(kind: 'matgraph', doc: MatGraphDoc): Promise<BakedMaterial>;
  bake(kind: 'pixelgrid', doc: PixelGridDoc): Promise<BakedMaterial>;
}
export interface MaterialBakeWorker {
  postMessage(message: unknown): void;
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
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
type Request = { kind: 'bake'; id: number } & (
  | { format: 'matgraph'; doc: MatGraphDoc }
  | { format: 'pixelgrid'; doc: PixelGridDoc }
);
interface Reply {
  kind: 'baked';
  id: number;
  material?: BakedMaterial;
  milliseconds: number;
  error?: string;
}

/** Validated graph documents in, exactly the synchronous baker's pixels out. */
export function installMaterialBakeWorker(
  port: Pick<MaterialBakeWorker, 'postMessage' | 'addEventListener'>,
): void {
  const now = (): number =>
    (globalThis as { performance?: { now(): number } }).performance?.now() ?? Date.now();
  port.addEventListener('message', (event) => {
    const request = event.data as Request;
    if (request?.kind !== 'bake') return;
    const began = now();
    try {
      const material =
        request.format === 'matgraph' ? bakeMatGraph(request.doc) : bakePixelGrid(request.doc);
      const buffers = [
        ...new Set(Object.values(material.slots).map((image) => image.data.buffer)),
      ] as ArrayBuffer[];
      port.postMessage(
        {
          kind: 'baked',
          id: request.id,
          material,
          milliseconds: now() - began,
        } satisfies Reply,
        buffers,
      );
    } catch (error) {
      port.postMessage({
        kind: 'baked',
        id: request.id,
        error: String(error),
        milliseconds: now() - began,
      } satisfies Reply);
    }
  });
}

/** A bounded caller-owned pool. One graph at a time per worker; dispose terminates owned workers. */
export function createMaterialBakeWorkerPool(
  workers: readonly MaterialBakeWorker[],
  options: { onTiming?: (milliseconds: number) => void } = {},
): MaterialBaker & { dispose(): void } {
  if (workers.length === 0 || new Set(workers).size !== workers.length)
    throw new Error('Material baking needs distinct workers');
  interface Job {
    request: Request;
    resolve: (value: BakedMaterial) => void;
    reject: (error: Error) => void;
  }
  const queue: Job[] = [];
  const active = new Map<MaterialBakeWorker, Job>();
  const cleanup: Array<() => void> = [];
  let nextId = 0,
    disposed = false;
  let failure: Error | undefined;
  const pump = (): void => {
    if (disposed || failure) return;
    for (const worker of workers) {
      if (active.has(worker)) continue;
      const job = queue.shift();
      if (!job) break;
      active.set(worker, job);
      try {
        worker.postMessage(job.request);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };
  const fail = (error: Error): void => {
    failure = error;
    for (const job of [...active.values(), ...queue]) job.reject(error);
    active.clear();
    queue.length = 0;
  };
  for (const worker of workers) {
    const message = (event: { data?: unknown }): void => {
      const reply = event.data as Reply,
        job = active.get(worker);
      if (disposed || reply?.kind !== 'baked' || !job || reply.id !== job.request.id) return;
      active.delete(worker);
      if (reply.error || !reply.material)
        job.reject(new Error(reply.error ?? 'Material worker returned no pixels'));
      else job.resolve(reply.material);
      pump();
      options.onTiming?.(reply.milliseconds);
    };
    const error = (event: { message?: string }): void =>
      fail(new Error(event.message ?? 'Material worker failed'));
    worker.addEventListener('message', message);
    worker.addEventListener('error', error);
    cleanup.push(() => {
      worker.removeEventListener?.('message', message);
      worker.removeEventListener?.('error', error);
      worker.terminate?.();
    });
  }
  return {
    bake(
      format: 'matgraph' | 'pixelgrid',
      doc: MatGraphDoc | PixelGridDoc,
    ): Promise<BakedMaterial> {
      if (disposed || failure)
        return Promise.reject(failure ?? new Error('Material baker disposed'));
      return new Promise((resolve, reject) => {
        queue.push({
          request: { kind: 'bake', id: ++nextId, format, doc } as Request,
          resolve,
          reject,
        });
        pump();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      fail(new Error('Material baker disposed'));
      for (const close of cleanup) close();
    },
  };
}
