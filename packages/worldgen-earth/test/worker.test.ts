import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import type { HeightSampler, Vec3 } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { createInThreadWorldgenGenerator } from '../src/client/generators';
import { createWorldgenWorkerBridge, type WorkerLike } from '../src/client/worker-bridge';
import type { TileGeometry } from '../src/kernel/semantic-adapter';
import {
  createWorldgenWorkerHandler,
  type WorldgenWorkerRequest,
  type WorldgenWorkerResult,
} from '../src/kernel/worker-protocol';
import { installWorldgenWorker } from '../src/worker';
import { loadDefaultAtlas, loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const atlas = await loadDefaultAtlas();

function tile(): TerrainSemanticTile {
  const t = createEmptyTerrainSemanticTile();
  t.landcover.push({
    id: 'forest',
    class: 'forest',
    density: 1,
    polygons: [
      {
        outer: [
          [0.1, 0.1],
          [0.5, 0.1],
          [0.5, 0.5],
          [0.1, 0.5],
        ],
      },
    ],
  });
  for (let index = 0; index < 6; index++) {
    const u = 0.55 + index * 0.06;
    t.buildings.push({
      id: `b${index}`,
      class: 'house',
      polygons: [
        {
          outer: [
            [u, 0.6],
            [u + 0.04, 0.6],
            [u + 0.04, 0.65],
            [u, 0.65],
          ],
        },
      ],
    });
  }
  t.transportation.push({
    id: 'road',
    class: 'residential',
    lines: [
      [
        [0, 0.58],
        [1, 0.58],
      ],
    ],
  });
  return t;
}

const geom: TileGeometry = {
  level: 14,
  x: 5,
  z: 7,
  originX: 1000,
  originZ: 2000,
  size: 800,
  metersPerUnit: 1,
  levelBelowMax: 0,
};

const ground: HeightSampler = {
  sampleHeight: (x, z) => 40 + (x - 1000) * 0.02 + Math.sin(z * 0.01) * 3,
  slopeAt: () => 0.02,
  normalAt: (): Vec3 => [-0.02, 1, 0],
};

/** In-memory worker: the handler on one side, a `WorkerLike` on the other. */
function fakeWorker(): WorkerLike & { results: WorldgenWorkerResult[] } {
  const listeners = new Set<(event: { data: unknown }) => void>();
  const results: WorldgenWorkerResult[] = [];
  let inbound: ((event: { data: unknown }) => void) | undefined;
  const handler = installWorldgenWorker({
    postMessage: (message) => {
      results.push(message as WorldgenWorkerResult);
      for (const listener of listeners) listener({ data: message });
    },
    addEventListener: (_type, listener) => {
      inbound = listener;
    },
  });
  void handler;
  return {
    results,
    postMessage: (message) => inbound?.({ data: message }),
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
}

describe('worldgen worker protocol', () => {
  it.each([
    false,
    true,
  ])('produces byte-identical worker output with interiors=%s', async (interiors) => {
    const request = {
      tile: tile(),
      geom,
      ground,
      resolution: 65,
      features: { buildings: true, scatter: true, interiors },
    };
    const inThread = createInThreadWorldgenGenerator(pack, { atlas });
    const direct = await inThread.generate(request, new AbortController().signal);
    expect(direct?.stats.buildingsRendered).toBe(6);
    expect(direct?.placements.length).toBeGreaterThan(0);

    const bridge = createWorldgenWorkerBridge(fakeWorker(), { pack, atlas, metersPerUnit: 1 });
    const viaWorker = await bridge.generate(request, new AbortController().signal);
    expect(viaWorker?.hash).toBe(direct?.hash);
    expect(viaWorker?.stats).toEqual(direct?.stats);
    expect(viaWorker?.records).toEqual(direct?.records);
    expect(direct?.records.every((r) => Boolean(r.interior) === interiors)).toBe(true);
    expect(viaWorker?.buildings?.positions.length).toBe(direct?.buildings?.positions.length);
    bridge.dispose();
  });

  it('cancels between steps and reports an unconfigured worker', async () => {
    const port: WorldgenWorkerResult[] = [];
    const handler = createWorldgenWorkerHandler({
      postMessage: (message) => {
        port.push(message as WorldgenWorkerResult);
      },
    });
    await handler.handle({
      kind: 'generate',
      id: 1,
      tile: tile(),
      geom,
      ground: {
        cols: 2,
        rows: 2,
        originX: 0,
        originZ: 0,
        sizeX: 1,
        sizeZ: 1,
        heights: new Float32Array(4),
      },
    } satisfies WorldgenWorkerRequest);
    expect(port[0]?.error).toContain('not configured');

    const worker = fakeWorker();
    const bridge = createWorldgenWorkerBridge(worker, { pack, atlas, metersPerUnit: 1 });
    const controller = new AbortController();
    const pending = bridge.generate(
      { tile: tile(), geom, ground, resolution: 65, features: { buildings: true, scatter: true } },
      controller.signal,
    );
    controller.abort();
    expect(await pending).toBeUndefined();
    bridge.dispose();
  });
});
