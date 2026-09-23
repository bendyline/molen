import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import {
  createTerrainLandcoverWorkerBridge,
  installTerrainLandcoverWorker,
  type TerrainLandcoverWorker,
} from '../src/landcover-worker';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { createLandcoverMesh } from '../src/semantic-client';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';

function fixture(): {
  tile: ReturnType<typeof createEmptyTerrainSemanticTile>;
  context: TerrainPyramidTileLayerContext;
} {
  const tile = createEmptyTerrainSemanticTile();
  tile.landcover.push({
    id: 'forest',
    class: 'forest',
    polygons: [
      {
        outer: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        holes: [
          [
            [0.3, 0.3],
            [0.3, 0.6],
            [0.6, 0.6],
            [0.6, 0.3],
          ],
        ],
      },
    ],
  });
  const heightfield = new Heightfield(
    new Float32Array([0, 0.3, 0.6, 0.2, 0.5, 0.8, 0.3, 0.6, 1]),
    3,
    3,
    { origin: [200, 400], worldSize: [100, 100], height: { min: 0, max: 20 } },
  );
  const context: TerrainPyramidTileLayerContext = {
    address: { level: 0, x: 0, z: 0 },
    pyramid: {
      name: 'test',
      origin: [200, 400],
      rootSize: 100,
      minLevel: 0,
      maxLevel: 0,
      tileResolution: 3,
      height: heightfield.heightRange,
      layers: [],
      skirts: false,
    },
    descriptor: {
      format: 'molen/terrain@2',
      name: 'test',
      origin: [200, 400],
      chunkSize: 100,
      tileResolution: 3,
      gridSize: [1, 1],
      height: heightfield.heightRange,
      layers: [],
      tiles: { heightUrl: '' },
      streaming: { loadRadius: 1, unloadRadius: 2, maxConcurrentLoads: 1, maxResidentTiles: 1 },
      collision: { enabled: false },
      lod: { levels: 1, distanceBands: [], skirts: false },
    },
    heightfield,
    origin: [200, 400],
    tileSize: 100,
    surfaceResolution: 3,
    signal: new AbortController().signal,
    admission: { run: async (task) => task() },
  };
  return { tile, context };
}

function worker() {
  const listeners = new Map<string, (event: { data?: unknown; message?: string }) => void>();
  let handler: ((event: { data?: unknown }) => void) | undefined;
  const requests: unknown[] = [];
  const replies: unknown[] = [];
  installTerrainLandcoverWorker({
    addEventListener: (_type, listener) => {
      handler = listener;
    },
    postMessage: (message, transfer) => {
      replies.push(structuredClone(message, { transfer: transfer as ArrayBuffer[] }));
    },
  });
  const bridge: TerrainLandcoverWorker = {
    addEventListener: (type, listener) => {
      listeners.set(type, listener);
    },
    removeEventListener: (type) => {
      listeners.delete(type);
    },
    postMessage: (message, transfer) => {
      requests.push(structuredClone(message, { transfer: transfer as ArrayBuffer[] }));
    },
    terminate() {},
  };
  return {
    bridge,
    requests,
    run() {
      handler?.({ data: requests.shift() });
      listeners.get('message')?.({ data: replies.shift() });
    },
    fail() {
      listeners.get('error')?.({ message: 'worker crashed' });
    },
  };
}

describe('land-cover worker', () => {
  it('transfers the same indexed mesh as in-thread draping without detaching resident heights', async () => {
    const { tile, context } = fixture();
    const thread = worker();
    const bridge = createTerrainLandcoverWorkerBridge(thread.bridge);
    const options = { landcoverColors: { forest: '#123456' }, landcoverOffset: 0.3 };
    const direct = createLandcoverMesh(tile, context, options) as THREE.Mesh;
    const before = context.heightfield.sampleHeight(235, 450);
    const result = bridge.generate(tile, context, options);
    thread.run();
    const mesh = (await result) as THREE.Mesh;
    for (const attr of ['position', 'normal', 'color']) {
      expect(mesh.geometry.getAttribute(attr).array).toEqual(
        direct.geometry.getAttribute(attr).array,
      );
    }
    expect(mesh.geometry.index?.array).toEqual(direct.geometry.index?.array);
    expect(context.heightfield.sampleHeight(235, 450)).toBe(before);
    expect(mesh.renderOrder).toBe(direct.renderOrder);
    expect((mesh.material as THREE.MeshStandardMaterial).roughness).toBe(
      (direct.material as THREE.MeshStandardMaterial).roughness,
    );
    mesh.geometry.dispose();
    direct.geometry.dispose();
    bridge.dispose();
  });

  it('drops cancelled queued work, settles active aborts, and rejects worker failures', async () => {
    const { tile, context } = fixture();
    const thread = worker();
    const bridge = createTerrainLandcoverWorkerBridge(thread.bridge);
    const firstAbort = new AbortController();
    const queuedAbort = new AbortController();
    const first = bridge.generate(tile, { ...context, signal: firstAbort.signal }, {});
    const queued = bridge.generate(tile, { ...context, signal: queuedAbort.signal }, {});
    queuedAbort.abort();
    firstAbort.abort();
    expect(await first).toBeUndefined();
    expect(await queued).toBeUndefined();
    thread.run();
    expect(thread.requests).toHaveLength(0);
    const failed = bridge.generate(tile, context, {});
    thread.fail();
    await expect(failed).rejects.toThrow('worker crashed');
    bridge.dispose();
  });
});
