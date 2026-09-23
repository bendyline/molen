import { describe, expect, it } from 'vitest';
import {
  createTerrainElevationWorkerSource,
  type ElevationStageTiming,
  type ElevationWorkerLike,
  installTerrainElevationWorker,
} from '../src/elevation-worker';
import { buildChunkGeometry, terrainTopology } from '../src/mesh';
import { createTerrainPackagePyramidHeightSource } from '../src/package-client';
import type { TerrainPackageDescriptor } from '../src/package-types';
import { encodePng16 } from '../src/png16';
import { surfaceDescriptor } from '../src/pyramid-stream';
import type { TerrainPyramidDescriptor } from '../src/pyramid-types';
import { applySurfaceHeightMorph, prepareSurfaceHeightMorph } from '../src/surface-morph';

function ports(): [ElevationWorkerLike, ElevationWorkerLike] {
  type Event = { data?: unknown; message?: string };
  const listeners = [new Set<(event: Event) => void>(), new Set<(event: Event) => void>()];
  return [0, 1].map((side) => ({
    postMessage(message: unknown, transfer?: Transferable[]) {
      const data = structuredClone(message, { transfer: transfer ?? [] });
      queueMicrotask(() => {
        for (const handler of listeners[1 - side] ?? []) handler({ data });
      });
    },
    addEventListener(type: 'message' | 'error', handler: (event: Event) => void) {
      if (type === 'message') listeners[side]?.add(handler);
    },
    removeEventListener(_type: 'message' | 'error', handler: (event: Event) => void) {
      listeners[side]?.delete(handler);
    },
  })) as [ElevationWorkerLike, ElevationWorkerLike];
}

describe('terrain graphics preparation', () => {
  it('worker decoding, ancestor resampling and meshes match direct results through actual transfers', async () => {
    const descriptor: TerrainPyramidDescriptor = {
      name: 'worker',
      origin: [100, 200],
      rootSize: 100,
      minLevel: 0,
      maxLevel: 2,
      tileResolution: 3,
      height: { min: 0, max: 100 },
      layers: [],
      skirts: true,
    };
    const pkg = { tileMatrix: { scheme: 'xyz' } } as TerrainPackageDescriptor;
    const png = encodePng16({
      width: 3,
      height: 3,
      data: new Float32Array([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
    });
    const archive = {
      async getZxy(level: number) {
        return level === 0 ? { data: png.slice().buffer } : undefined;
      },
    };
    const [host, thread] = ports();
    installTerrainElevationWorker(thread);
    const timings: ElevationStageTiming[] = [];
    const source = createTerrainElevationWorkerSource(host, pkg, descriptor, archive, {
      onTiming: (timing) => timings.push(timing),
    });
    const direct = createTerrainPackagePyramidHeightSource(pkg, descriptor, archive);
    for (const address of [
      { level: 0, x: 0, z: 0 },
      { level: 2, x: 1, z: 2 },
      { level: 2, x: 2, z: 1 },
    ]) {
      const signal = new AbortController().signal;
      const actual = await source.loadPrepared?.(address, signal, 3);
      const field = await direct.load(address, signal);
      expect(actual?.heightfield.copySamples()).toEqual(field?.copySamples());
      const mesh = buildChunkGeometry(
        field as NonNullable<typeof field>,
        surfaceDescriptor(descriptor, address),
        address.x,
        address.z,
        { localCoordinates: true },
      );
      expect(actual?.geometry).toEqual(mesh);
      expect(terrainTopology(3, true).byteLength).toBeGreaterThan(0);
    }
    expect(timings.filter((t) => t.stage === 'decode')).toHaveLength(1);
    expect(timings.filter((t) => t.stage === 'resample')).toHaveLength(2);
    expect(timings.filter((t) => t.stage === 'mesh')).toHaveLength(3);
    expect(png.byteLength).toBeGreaterThan(0);
    const aborted = new AbortController();
    aborted.abort();
    expect(await source.load({ level: 0, x: 0, z: 0 }, aborted.signal)).toBeUndefined();
    source.dispose?.();
  });

  it('shares compact topology without changing index order and keeps large grids Uint32', () => {
    expect(terrainTopology(3, false)).toBe(terrainTopology(3, false));
    expect(Array.from(terrainTopology(2, false))).toEqual([0, 2, 1, 1, 2, 3]);
    expect(terrainTopology(129, true)).toBeInstanceOf(Uint16Array);
    expect(terrainTopology(257, true)).toBeInstanceOf(Uint32Array);
  });

  it('morphs from the rendered parent triangles and ends at the exact target without horizontal drift', () => {
    const parent = new Float32Array([0, 0, 0, 10, 0, 0, 0, 0, 10, 10, 10, 10]);
    const positions = new Float32Array([2, 8, 2, 8, 12, 8]);
    const target = positions.slice();
    const morph = prepareSurfaceHeightMorph(positions, {
      positions: parent,
      resolution: 2,
      size: 10,
      offsetX: 0,
      offsetZ: 0,
    });
    expect(morph).toBeDefined();
    applySurfaceHeightMorph(positions, morph as NonNullable<typeof morph>, 0);
    expect(Array.from(positions)).toEqual([2, 0, 2, 8, 6, 8]);
    applySurfaceHeightMorph(positions, morph as NonNullable<typeof morph>, 0.5);
    expect(Array.from(positions)).toEqual([2, 4, 2, 8, 9, 8]);
    applySurfaceHeightMorph(positions, morph as NonNullable<typeof morph>, 1);
    expect(positions).toEqual(target);
  });
});
