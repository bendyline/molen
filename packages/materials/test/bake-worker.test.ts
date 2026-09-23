import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  createMaterialBakeWorkerPool,
  installMaterialBakeWorker,
  type MaterialBakeWorker,
} from '../src/bake-worker';
import { bakeMatGraph } from '../src/matgraph';
import type { MatGraphDoc } from '../src/matgraph-types';
import { bakePixelGrid } from '../src/pixelgrid';
import type { PixelGridDoc } from '../src/pixelgrid-types';
import { registerMaterialSchemas } from '../src/schema';

registerMaterialSchemas();

/** Every baker takes a validated (defaults-applied) document; so does every test fixture. */
function validated<T>(kind: 'matgraph' | 'pixelgrid', doc: unknown): T {
  const parsed = validateByKind(kind, doc);
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as T;
}

function worker() {
  type Event = { data?: unknown; message?: string };
  const listeners = new Map<string, (event: Event) => void>();
  const requests: unknown[] = [];
  let handler: ((event: Event) => void) | undefined;
  let terminated = false;
  installMaterialBakeWorker({
    addEventListener(_type, listener) {
      handler = listener;
    },
    postMessage(message, transfer) {
      listeners.get('message')?.({ data: structuredClone(message, { transfer: transfer ?? [] }) });
    },
  });
  const port: MaterialBakeWorker = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    postMessage(message) {
      requests.push(structuredClone(message));
    },
    terminate() {
      terminated = true;
    },
  };
  return {
    port,
    requests,
    get terminated() {
      return terminated;
    },
    run() {
      handler?.({ data: requests.shift() });
    },
    fail() {
      listeners.get('error')?.({ message: 'worker crashed' });
    },
  };
}

describe('material bake workers', () => {
  it('bounds concurrency and transfers byte-identical multi-slot graphs and pixel art', async () => {
    const graph = validated<MatGraphDoc>('matgraph', {
      format: 'molen/matgraph@1',
      size: [8, 8],
      seed: 7,
      nodes: [
        { id: 'height', type: 'noise', params: {} },
        { id: 'normal', type: 'height-to-normal', input: 'height', params: {} },
      ],
      outputs: { baseColor: 'height', roughness: 'height', normal: 'normal' },
    });
    // Both slots enabled: the two slots share one buffer, so this also covers the worker's
    // de-duplication of the structured-clone transfer list (a repeated buffer would throw).
    const pixel = validated<PixelGridDoc>('pixelgrid', {
      format: 'molen/pixelgrid@1',
      size: [2, 2],
      palette: { a: '#ffffff', b: 'transparent' },
      rows: ['ab', 'ba'],
      slots: { baseColor: true, emissive: true },
      filter: 'nearest',
    });
    const a = worker(),
      b = worker(),
      timings: number[] = [];
    const pool = createMaterialBakeWorkerPool([a.port, b.port], {
      onTiming: (value) => timings.push(value),
    });
    const jobs = [
      pool.bake('matgraph', graph),
      pool.bake('pixelgrid', pixel),
      pool.bake('matgraph', graph),
    ];
    expect(a.requests.length + b.requests.length).toBe(2);
    a.run();
    expect(a.requests.length + b.requests.length).toBe(2);
    b.run();
    a.run();
    const outputs = await Promise.all(jobs);
    expect(outputs).toEqual([bakeMatGraph(graph), bakePixelGrid(pixel), bakeMatGraph(graph)]);
    expect(timings).toHaveLength(3);
    pool.dispose();
    expect(a.terminated && b.terminated).toBe(true);
  });
  it('settles queued and active jobs when a worker fails or the pool is disposed', async () => {
    const a = worker();
    const pool = createMaterialBakeWorkerPool([a.port]);
    const pixel = validated<PixelGridDoc>('pixelgrid', {
      format: 'molen/pixelgrid@1',
      size: [1, 1],
      palette: { a: '#ffffff' },
      rows: ['a'],
      filter: 'nearest',
    });
    const jobs = [
      pool.bake('pixelgrid', pixel).catch((e) => e.message),
      pool.bake('pixelgrid', pixel).catch((e) => e.message),
    ];
    a.fail();
    expect(await Promise.all(jobs)).toEqual(['worker crashed', 'worker crashed']);
    pool.dispose();
    expect(a.terminated).toBe(true);
    const b = worker(),
      next = createMaterialBakeWorkerPool([b.port]);
    const pending = next.bake('pixelgrid', pixel).catch((e) => e.message);
    next.dispose();
    expect(await pending).toBe('Material baker disposed');
  });
});
