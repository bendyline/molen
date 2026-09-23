import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import {
  createDefaultTerrainSemanticRenderer,
  disposeTerrainSemanticObject,
} from '../src/semantic-client';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';
import {
  createTerrainSurfaceObject,
  createTerrainSurfaceRenderer,
  disposeTerrainSurfaceObject,
} from '../src/surface-client';
import {
  createTerrainSurfaceWorkerBridge,
  installTerrainSurfaceWorker,
  type TerrainSurfaceWorker,
} from '../src/surface-worker';

function context(): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 0, z: 0 },
    tileSize: 200,
    origin: [1000, 2000],
    pyramid: {
      name: 'surface-test',
      origin: [1000, 2000],
      rootSize: 1600,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 3,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(
      new Float32Array([0, 0.2, 0.1, 0.3, 0.8, 0.4, 0.1, 0.2, 0]),
      3,
      3,
      { origin: [1000, 2000], worldSize: [200, 200], height: { min: 0, max: 20 } },
    ),
    signal: new AbortController().signal,
    admission: { run: async (task) => task() },
  };
}

function fixture() {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation.push(
    {
      class: 'major_road',
      subclass: 'primary',
      width: 12,
      lanes: 4,
      lines: [
        [
          [-0.1, 0.3],
          [1.1, 0.3],
        ],
      ],
    },
    {
      class: 'minor_road',
      subclass: 'residential',
      width: 8,
      lines: [
        [
          [0.3, -0.1],
          [0.3, 1.1],
        ],
      ],
    },
  );
  tile.landcover.push({
    class: 'parking',
    polygons: [
      {
        outer: [
          [0.45, 0.45],
          [1.1, 0.45],
          [1.1, 1.1],
          [0.45, 1.1],
        ],
        holes: [
          [
            [0.6, 0.6],
            [0.6, 0.73],
            [0.73, 0.73],
            [0.73, 0.6],
          ],
        ],
      },
    ],
  });
  tile.transportation.push({
    class: 'path',
    subclass: 'footway',
    width: 2.4,
    lines: [
      [
        [0.5, 0.8],
        [1, 0.8],
      ],
    ],
  });
  tile.landcover.push({ class: 'plaza', polygons: tile.landcover[0]?.polygons ?? [] });
  return tile;
}

function worker() {
  const listeners = new Map<string, (event: { data?: unknown; message?: string }) => void>();
  let handler: ((event: { data?: unknown }) => void) | undefined;
  const requests: unknown[] = [];
  const replies: unknown[] = [];
  installTerrainSurfaceWorker({
    addEventListener: (_type, listener) => {
      handler = listener;
    },
    postMessage: (message, transfer) => {
      replies.push(structuredClone(message, { transfer: transfer as ArrayBuffer[] }));
    },
  });
  const bridge: TerrainSurfaceWorker = {
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

describe('surface worker', () => {
  it.each([
    'modern',
    '1910',
    'minimal',
  ] as const)('transfers exact %s surfaces, fixtures and culling bounds without detaching resident data', async (style) => {
    const tile = fixture();
    const ctx = context();
    const thread = worker();
    const bridge = createTerrainSurfaceWorkerBridge(thread.bridge);
    const before = ctx.heightfield.sampleHeight(1050, 2080);
    // Repeated jobs exercise shared fixture geometry after previous transfers.
    for (let repeat = 0; repeat < 2; repeat++) {
      const direct = createTerrainSurfaceObject(tile, ctx, { style });
      const generated = bridge.generate(tile, ctx, { style });
      thread.run();
      const actual = (await generated) as THREE.Group;
      expect(actual.userData).toEqual(direct.userData);
      expect(actual.children.map((child) => child.name)).toEqual(
        direct.children.map((child) => child.name),
      );
      const directMeshes: THREE.Object3D[] = [];
      direct.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) directMeshes.push(child);
      });
      const actualMeshes: THREE.Object3D[] = [];
      actual.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) actualMeshes.push(child);
      });
      for (const [index, child] of directMeshes.entries()) {
        const expected = child as THREE.Mesh;
        const mesh = actualMeshes[index] as THREE.Mesh;
        for (const attr of ['position', 'normal', 'color']) {
          const actual = mesh.geometry.getAttribute(attr)?.array;
          const wanted = expected.geometry.getAttribute(attr)?.array;
          // Compare exact transferable bytes without recursively boxing millions of numbers.
          expect(actual?.constructor).toBe(wanted?.constructor);
          if (actual && wanted)
            expect(
              Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength).equals(
                Buffer.from(wanted.buffer, wanted.byteOffset, wanted.byteLength),
              ),
            ).toBe(true);
        }
        expect(mesh.castShadow).toBe(expected.castShadow);
        expect(mesh.receiveShadow).toBe(expected.receiveShadow);
        expect((mesh.material as THREE.MeshStandardMaterial).roughness).toBe(
          (expected.material as THREE.MeshStandardMaterial).roughness,
        );
        expect((mesh.material as THREE.MeshStandardMaterial).side).toBe(
          (expected.material as THREE.MeshStandardMaterial).side,
        );
        const instances = mesh as THREE.InstancedMesh;
        const expectedInstances = expected as THREE.InstancedMesh;
        if (instances.isInstancedMesh) {
          expect(instances.count).toBe(expectedInstances.count);
          expect(instances.instanceMatrix.array).toEqual(expectedInstances.instanceMatrix.array);
          expect(instances.instanceColor?.array).toEqual(expectedInstances.instanceColor?.array);
          expectedInstances.computeBoundingSphere();
          expect(instances.boundingSphere).toEqual(expectedInstances.boundingSphere);
        } else {
          expected.geometry.computeBoundingSphere();
          expect(mesh.geometry.boundingSphere).toEqual(expected.geometry.boundingSphere);
        }
      }
      expect(ctx.heightfield.sampleHeight(1050, 2080)).toBe(before);
      disposeTerrainSurfaceObject(actual);
      disposeTerrainSurfaceObject(direct);
    }
    bridge.dispose();
  });

  it('drops aborted queued jobs before copying heights and settles aborts, failures and disposal', async () => {
    const ctx = context();
    const tile = fixture();
    const thread = worker();
    const bridge = createTerrainSurfaceWorkerBridge(thread.bridge);
    const copies = vi.spyOn(ctx.heightfield, 'copySamples');
    const activeAbort = new AbortController();
    const queuedAbort = new AbortController();
    const active = bridge.generate(tile, { ...ctx, signal: activeAbort.signal }, {});
    const queued = bridge.generate(tile, { ...ctx, signal: queuedAbort.signal }, {});
    expect(copies).toHaveBeenCalledTimes(1);
    queuedAbort.abort();
    activeAbort.abort();
    await expect(active).resolves.toBeUndefined();
    await expect(queued).resolves.toBeUndefined();
    thread.run();
    expect(copies).toHaveBeenCalledTimes(1);
    expect(thread.requests).toHaveLength(0);
    const failed = bridge.generate(tile, ctx, {});
    const failedQueued = bridge.generate(tile, ctx, {});
    thread.fail();
    await expect(failed).rejects.toThrow('worker crashed');
    await expect(failedQueued).rejects.toThrow('worker crashed');
    await expect(bridge.generate(tile, ctx, {})).rejects.toThrow('worker crashed');
    bridge.dispose();
    const freshThread = worker();
    const fresh = createTerrainSurfaceWorkerBridge(freshThread.bridge);
    const pending = fresh.generate(tile, ctx, {});
    const pendingQueued = fresh.generate(tile, ctx, {});
    fresh.dispose();
    await expect(pending).resolves.toBeUndefined();
    await expect(pendingQueued).resolves.toBeUndefined();
    fresh.dispose();
  });

  it('keeps stream readiness attached to the newest style and retains visible surfaces during updates', async () => {
    const thread = worker();
    const controller = createTerrainSurfaceRenderer(
      {},
      createTerrainSurfaceWorkerBridge(thread.bridge),
    );
    const renderer = createDefaultTerrainSemanticRenderer({
      surfaceRenderer: controller,
      renderBuildings: false,
      renderLandcover: false,
      renderWater: false,
    });
    let ready = false;
    const initial = Promise.resolve(renderer.createTile(fixture(), context())).then((value) => {
      ready = true;
      return value;
    });
    const older = controller.setOptions({ style: '1910' });
    const newest = controller.setOptions({ style: 'minimal' });
    thread.run();
    await Promise.resolve();
    expect(ready).toBe(false);
    expect(controller.stats()).toMatchObject({ tiles: 1, loading: 1 });
    // The cancelled intermediate revision never reached the worker.
    expect(thread.requests).toHaveLength(1);
    thread.run();
    const object = (await initial) as THREE.Group;
    await Promise.all([older, newest]);
    expect(controller.stats()).toMatchObject({ style: 'minimal', loading: 0 });
    expect(object.getObjectByName('semantic:surfaces')?.userData.surfaceStyle).toBe('minimal');
    const initialRevision = controller.stats().geometryRevision;
    expect(initialRevision).toBeGreaterThan(0);
    const oldGeometry = (object.getObjectByName('surface:areas') as THREE.Mesh).geometry;
    const disposal = vi.spyOn(oldGeometry, 'dispose');
    const modern = controller.setOptions({
      style: 'modern',
      details: { parkedVehicles: PARKED_VEHICLES },
    });
    expect(object.getObjectByName('semantic:surfaces')?.userData.surfaceStyle).toBe('minimal');
    expect(disposal).not.toHaveBeenCalled();
    expect(controller.stats().geometryRevision).toBe(initialRevision);
    thread.run();
    await modern;
    expect(disposal).toHaveBeenCalledTimes(1);
    expect(controller.stats().parkedCars).toBeGreaterThan(0);
    const replacementRevision = controller.stats().geometryRevision;
    expect(replacementRevision).toBeGreaterThan(initialRevision);
    disposeTerrainSemanticObject(object);
    expect(controller.stats().tiles).toBe(0);
    expect(controller.stats().geometryRevision).toBeGreaterThan(replacementRevision);
    controller.dispose();
  });

  it('unregisters a cancelled initial tile without publishing a placeholder or late result', async () => {
    const thread = worker();
    const controller = createTerrainSurfaceRenderer(
      {},
      createTerrainSurfaceWorkerBridge(thread.bridge),
    );
    const abort = new AbortController();
    const initial = controller.createTileAsync(fixture(), { ...context(), signal: abort.signal });
    expect(controller.stats().loading).toBe(1);
    abort.abort();
    await expect(initial).resolves.toBeUndefined();
    expect(controller.stats()).toMatchObject({ tiles: 0, loading: 0 });
    thread.run();
    expect(controller.stats().tiles).toBe(0);
    controller.dispose();
  });
});

import { Buffer } from 'node:buffer';
import { PARKED_VEHICLES } from './helpers/content';
