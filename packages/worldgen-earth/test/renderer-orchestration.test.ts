import {
  createTerrainSurfaceRenderer,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import { createEmptyTerrainSemanticTile, Heightfield } from '@bendyline/molen-terrain/kernel';
import { ModelLibrary } from '@bendyline/molen-worldgen/client';
import { emptyWorldgenStats } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWorldgenSemanticRenderers } from '../src/client/renderers';
import type { WorldgenTileOutput } from '../src/kernel/tile-generate';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((fulfill, fail) => {
    resolve = fulfill;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function context(signal: AbortSignal): TerrainPyramidTileLayerContext {
  return {
    address: { level: 3, x: 0, z: 0 },
    tileSize: 200,
    origin: [0, 0],
    pyramid: {
      name: 'parallel-tile-test',
      origin: [0, 0],
      rootSize: 1600,
      minLevel: 0,
      maxLevel: 3,
      tileResolution: 3,
      height: { min: 0, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(new Float32Array(9), 3, 3, {
      origin: [0, 0],
      worldSize: [200, 200],
      height: { min: 0, max: 20 },
    }),
    signal,
  };
}

function output(): WorldgenTileOutput {
  return {
    placements: [],
    records: [],
    stats: emptyWorldgenStats(),
    hash: 'sha256:empty',
    skippedByOwnership: 0,
    clippedPieces: 0,
  };
}

function fixture(prepareObject?: (object: THREE.Object3D, signal: AbortSignal) => Promise<void>) {
  const roads = deferred<THREE.Group | undefined>();
  const buildings = deferred<WorldgenTileOutput | undefined>();
  const roadGenerate = vi.fn(() => roads.promise);
  const buildingGenerate = vi.fn(() => buildings.promise);
  const surfaces = createTerrainSurfaceRenderer({}, { generate: roadGenerate, dispose: vi.fn() });
  const renderers = createWorldgenSemanticRenderers(pack, {
    ...(prepareObject ? { prepareObject } : {}),
    roads: { surfaceRenderer: surfaces },
    generator: { generate: buildingGenerate, dispose: vi.fn() },
  });
  const controller = new AbortController();
  const group = new THREE.Group();
  group.name = 'late-road-result';
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.terrainOwnedGeometry = true;
  group.add(mesh);
  const disposeGeometry = vi.spyOn(geometry, 'dispose');
  return {
    roads,
    buildings,
    roadGenerate,
    buildingGenerate,
    surfaces,
    renderers,
    controller,
    group,
    disposeGeometry,
    start: () =>
      renderers.humanFeatures.createTile(
        createEmptyTerrainSemanticTile(),
        context(controller.signal),
      ),
    dispose: () => {
      renderers.dispose();
      surfaces.dispose();
      material.dispose();
    },
  };
}

describe('worldgen human-feature tile orchestration', () => {
  it('retains resident architecture until replacement resource preparation finishes', async () => {
    const prepared = deferred<void>();
    const prepare = vi.fn(() => prepared.promise);
    const f = fixture(prepare);
    f.roads.resolve(f.group);
    f.buildings.resolve(output());
    const root = await f.start();
    const original = root?.children.find((child) => child.name.endsWith(':architecture'));
    f.renderers.setQuality('high');
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    expect(root?.children).toContain(original);
    prepared.resolve();
    await vi.waitFor(() => expect(root?.children).not.toContain(original));
    expect(root?.getObjectByName(f.group.name)).toBe(f.group);
    if (root) f.renderers.humanFeatures.disposeTile?.(root);
    f.dispose();
  });

  it('uses larger distant prop cells while preserving every placement in world coordinates', async () => {
    const data = new Float32Array(64 * 10);
    const expected: string[] = [];
    for (let z = 0; z < 8; z++)
      for (let x = 0; x < 8; x++) {
        const position = [100 + 600 * x, 0, 100 + 600 * z];
        data.set([...position, 0, 1, 1, 1, 1, 1, 1], (z * 8 + x) * 10);
        expected.push(position.join(','));
      }
    const models = new ModelLibrary(async () =>
      new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
      ),
    );
    const renderers = createWorldgenSemanticRenderers(pack, {
      models,
      roads: { renderTransportation: false },
      generator: {
        generate: async () => ({
          ...output(),
          placements: [{ setId: 'test', modelRef: 'test:cube', count: 64, data }],
        }),
        dispose() {},
      },
    });
    const roots: THREE.Object3D[] = [];
    const counts: number[] = [];
    for (const level of [3, 1]) {
      const ctx = context(new AbortController().signal);
      ctx.address = { ...ctx.address, level };
      const root = await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), ctx);
      expect(root).toBeDefined();
      if (!root) throw new Error('Missing prop tile');
      roots.push(root);
      root.updateMatrixWorld(true);
      const positions: string[] = [];
      let meshes = 0;
      root.traverseVisible((object) => {
        if (!(object instanceof THREE.InstancedMesh)) return;
        meshes++;
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, matrix);
          const point = new THREE.Vector3()
            .setFromMatrixPosition(matrix)
            .applyMatrix4(object.matrixWorld);
          positions.push(point.toArray().join(','));
        }
      });
      expect(positions.sort()).toEqual([...expected].sort());
      counts.push(meshes);
    }
    expect(counts[1]).toBeLessThan((counts[0] as number) / 4);
    for (const root of roots) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    models.dispose();
  });

  it('upgrades resident buildings in place without replacing roads, and cancels superseded work', async () => {
    const f = fixture();
    f.roads.resolve(f.group);
    f.buildings.resolve(output());
    const root = await f.start();
    expect(root).toBeDefined();
    const original = root?.children.find((child) => child.name.endsWith(':architecture'));
    const high = deferred<WorldgenTileOutput | undefined>();
    f.buildingGenerate.mockImplementationOnce(() => high.promise);
    f.renderers.setQuality('high');
    expect(f.buildingGenerate).toHaveBeenCalledTimes(2);
    expect(root?.children).toContain(original);
    high.resolve(output());
    await vi.waitFor(() => expect(root?.children).not.toContain(original));
    expect(root?.getObjectByName(f.group.name)).toBe(f.group);
    expect(f.roadGenerate).toHaveBeenCalledTimes(1);
    const upgraded = root?.children.find((child) => child.name.endsWith(':architecture'));
    const economy = deferred<WorldgenTileOutput | undefined>();
    f.buildingGenerate.mockImplementationOnce(() => economy.promise);
    f.renderers.setQuality('economy');
    f.renderers.setQuality('high');
    economy.resolve(output());
    await vi.waitFor(() => expect(f.buildingGenerate).toHaveBeenCalledTimes(3));
    // Drain the cancelled continuation before inspecting the surviving architecture.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root?.children).toContain(upgraded);
    const pending = deferred<WorldgenTileOutput | undefined>();
    f.buildingGenerate.mockImplementationOnce(() => pending.promise);
    f.renderers.setQuality('economy');
    if (root) f.renderers.humanFeatures.disposeTile?.(root);
    pending.resolve(output());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root?.children).toContain(upgraded);
    expect(f.disposeGeometry).toHaveBeenCalledTimes(1);
    f.dispose();
  });

  it('starts building generation while the independent road job is still pending', async () => {
    const f = fixture();
    const done = vi.fn();
    const created = Promise.resolve(f.start()).then((value) => {
      done();
      return value;
    });
    expect(f.roadGenerate).toHaveBeenCalledTimes(1);
    expect(f.buildingGenerate).toHaveBeenCalledTimes(1);
    f.buildings.resolve(output());
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    f.roads.resolve(f.group);
    const root = await created;
    expect(root?.getObjectByName(f.group.name)).toBe(f.group);
    expect(f.disposeGeometry).not.toHaveBeenCalled();
    if (root) f.renderers.humanFeatures.disposeTile?.(root);
    expect(f.disposeGeometry).toHaveBeenCalledTimes(1);
    expect(f.surfaces.stats().tiles).toBe(0);
    f.dispose();
  });

  it('disposes a late road result before propagating its building peer failure', async () => {
    const f = fixture();
    const failure = new Error('building generation failed');
    const done = vi.fn();
    const created = Promise.resolve(f.start()).catch((error: unknown) => {
      done();
      return error;
    });
    f.buildings.reject(failure);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    f.roads.resolve(f.group);
    expect(await created).toBe(failure);
    expect(f.disposeGeometry).toHaveBeenCalledTimes(1);
    expect(f.surfaces.stats().tiles).toBe(0);
    f.dispose();
  });

  it('settles the building peer before propagating a road failure', async () => {
    const f = fixture();
    const failure = new Error('road generation failed');
    const done = vi.fn();
    const created = Promise.resolve(f.start()).catch((error: unknown) => {
      done();
      return error;
    });
    f.roads.reject(failure);
    await Promise.resolve();
    expect(f.buildingGenerate).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    f.buildings.resolve(output());
    expect(await created).toBe(failure);
    expect(f.surfaces.stats().tiles).toBe(0);
    f.dispose();
  });

  it('cleans up late geometry when both jobs finish after the tile was aborted', async () => {
    const f = fixture();
    const created = f.start();
    f.controller.abort();
    f.roads.resolve(f.group);
    f.buildings.resolve(output());
    expect(await created).toBeUndefined();
    expect(f.disposeGeometry).toHaveBeenCalledTimes(1);
    expect(f.surfaces.stats().tiles).toBe(0);
    f.dispose();
  });

  it('does not dispatch either job for an already-aborted tile', async () => {
    const f = fixture();
    f.controller.abort();
    expect(await f.start()).toBeUndefined();
    expect(f.roadGenerate).not.toHaveBeenCalled();
    expect(f.buildingGenerate).not.toHaveBeenCalled();
    f.dispose();
  });
});
