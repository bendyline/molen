import {
  createTerrainPyramidStream,
  type TerrainPyramidView,
} from '@bendyline/molen-terrain/client';
import {
  Heightfield,
  type TerrainPyramidDescriptor,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEarthTilePreloader } from '../src/client/preload';

afterEach(() => vi.useRealTimers());

// A deterministic latency fixture, not a hardware benchmark: 512 m tiles with a 500 ms
// fetch/decode, 1500 ms semantic build and 250 ms GPU preparation for each object. The
// camera travels continuously; nothing waits for streaming after the initial view settles.
async function fly(
  speed: number,
  preload: boolean,
): Promise<{ ready: number; samples: number; peakResident: number; peakBytes: number }> {
  const descriptor: TerrainPyramidDescriptor = {
    name: 'flight-latency',
    origin: [0, 0],
    rootSize: 32768,
    minLevel: 6,
    maxLevel: 6,
    tileResolution: 3,
    height: { min: 0, max: 100 },
    layers: [{ name: 'ground', color: '#668855', tiling: 1 }],
    skirts: true,
  };
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const stream = createTerrainPyramidStream(
    descriptor,
    {
      async load(address) {
        await wait(500);
        const size = terrainPyramidTileSize(descriptor, address.level);
        return new Heightfield(new Float32Array(9), 3, 3, {
          origin: terrainPyramidTileOrigin(descriptor, address),
          worldSize: [size, size],
          height: descriptor.height,
        });
      },
    },
    {
      maxScreenSpaceError: 1,
      viewDistance: 160,
      maxSelectedTiles: 16,
      maxResidentTiles: 48,
      maxResidentBytes: 20_000,
      maxConcurrentLoads: 4,
      maxConcurrentLayerLoads: 4,
      prepareObject: async () => wait(250),
      layers: [
        {
          id: 'buildings',
          category: 'human-feature',
          async createTile() {
            await wait(1500);
            return new THREE.Group();
          },
        },
      ],
    },
  );
  const planner = createEarthTilePreloader();
  const view = (x: number): TerrainPyramidView => ({
    position: [8448 + x, 120, 8448],
    direction: [1, -0.1, 0],
    verticalFov: Math.PI / 3,
    viewportHeight: 900,
    aspect: 16 / 9,
  });
  let ready = 0;
  let samples = 0;
  let peakResident = 0;
  let peakBytes = 0;
  try {
    stream.update(view(0));
    await vi.advanceTimersByTimeAsync(10_000);
    await stream.whenIdle();
    for (let tick = 0; tick <= 600; tick++) {
      const now = tick * 100;
      const current = view((speed * now) / 1000);
      stream.update(current, preload ? planner.views(now, current, true) : []);
      await vi.advanceTimersByTimeAsync(100);
      peakResident = Math.max(peakResident, stream.pressure().residentTiles);
      peakBytes = Math.max(peakBytes, stream.pressure().residentBytes);
      if (now >= 12_000) {
        samples++;
        if (stream.isAreaReady(current.position[0] + 100, current.position[2], 5)) ready++;
      }
    }
    return { ready, samples, peakResident, peakBytes };
  } finally {
    stream.dispose();
    await vi.advanceTimersByTimeAsync(2000);
  }
}

describe('continuous flight under tile preparation latency', () => {
  it.each([150, 350])('has nearby forward detail ready at %s m/s before arrival', async (speed) => {
    vi.useFakeTimers();
    const reactive = await fly(speed, false);
    const predictive = await fly(speed, true);
    const before = reactive.ready / reactive.samples;
    const after = predictive.ready / predictive.samples;
    console.info(
      `Flight ${speed} m/s: forward detail ready ${(100 * before).toFixed(1)}% -> ${(100 * after).toFixed(1)}%; peak ${predictive.peakResident}/48 resident tiles`,
    );
    expect(after).toBeGreaterThan(0.95);
    expect(after - before).toBeGreaterThan(0.2);
    expect(predictive.peakResident).toBeLessThanOrEqual(48);
    expect(predictive.peakBytes).toBeLessThanOrEqual(20_000);
  }, 30_000);
});
