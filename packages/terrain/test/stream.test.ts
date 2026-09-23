import { validate } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { TerrainDescriptor } from '../src/descriptor-types';
import { Heightfield } from '../src/heightfield';
import { registerTerrainSchemas } from '../src/schema';
import {
  createTerrainStream,
  resolveTerrainTileUrl,
  type TerrainHeightTileSource,
  type TerrainStream,
  type TerrainTileLayer,
  terrainStreamBudgetForQuality,
} from '../src/stream';
import type { TerrainTileAddress } from '../src/tile';

registerTerrainSchemas();

function descriptor(overrides: Partial<TerrainDescriptor> = {}): TerrainDescriptor {
  const result = validate('terrain' as never, {
    format: 'molen/terrain@2',
    name: 'stream',
    origin: [0, 0],
    chunkSize: 10,
    tileResolution: 5,
    gridSize: [5, 5],
    height: { min: 0, max: 100 },
    tiles: { heightUrl: 'h_{x}_{z}.png' },
    lod: { levels: 3, distanceBands: [8, 18], skirts: true },
    streaming: {
      loadRadius: 1.1,
      unloadRadius: 1.5,
      maxConcurrentLoads: 2,
      maxResidentTiles: 8,
    },
    ...overrides,
  });
  if (!result.ok) throw new Error(result.formatted);
  return result.value as TerrainDescriptor;
}

function flatTile(
  d: TerrainDescriptor,
  address: TerrainTileAddress,
  normalized = 0.5,
): Heightfield {
  return new Heightfield(new Float32Array(25).fill(normalized), 5, 5, {
    origin: [d.origin[0] + address.x * d.chunkSize, d.origin[1] + address.z * d.chunkSize],
    worldSize: [d.chunkSize, d.chunkSize],
    height: d.height,
  });
}

describe('fixed-grid terrain streaming', () => {
  it('provides monotonic portable quality budgets', () => {
    const economy = terrainStreamBudgetForQuality('economy');
    const balanced = terrainStreamBudgetForQuality('balanced');
    const high = terrainStreamBudgetForQuality('high');
    expect(economy.maxResidentTiles).toBeLessThan(balanced.maxResidentTiles);
    expect(balanced.maxResidentTiles).toBeLessThan(high.maxResidentTiles);
    expect(economy.unloadRadius).toBeGreaterThanOrEqual(economy.loadRadius);
    expect(balanced.unloadRadius).toBeGreaterThanOrEqual(balanced.loadRadius);
    expect(high.unloadRadius).toBeGreaterThanOrEqual(high.loadRadius);
  });

  it('prioritizes the nearest tile and bounds concurrent loads', async () => {
    const d = descriptor();
    const calls: string[] = [];
    let active = 0;
    let maxActive = 0;
    const source: TerrainHeightTileSource = {
      async load(address): Promise<Heightfield> {
        calls.push(`${address.x}_${address.z}`);
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 0));
        active--;
        return flatTile(d, address);
      },
    };
    const stream = createTerrainStream(d, source, { cameraPos: [15, 10, 15] });
    await stream.whenIdle();

    expect(calls[0]).toBe('1_1');
    expect(maxActive).toBe(2);
    expect(stream.stats().resident).toBe(5);
    expect(stream.stats().resident).toBeLessThanOrEqual(d.streaming.maxResidentTiles);
    expect(stream.stats().decodedSamples).toBe(125);
    expect(stream.stats().geometryBytes).toBeGreaterThan(0);
    expect(stream.stats().triangles).toBeGreaterThan(0);
    expect(stream.stats().drawCalls).toBe(5);
    stream.dispose();
  });

  it('evicts outside the hysteresis radius and samples resident heights', async () => {
    const d = descriptor({
      gridSize: [5, 1],
      streaming: {
        loadRadius: 0.6,
        unloadRadius: 0.8,
        maxConcurrentLoads: 1,
        maxResidentTiles: 2,
      },
    });
    const source: TerrainHeightTileSource = {
      async load(address): Promise<Heightfield> {
        return flatTile(d, address, address.x / 4);
      },
    };
    const stream = createTerrainStream(d, source, { cameraPos: [5, 5, 5] });
    await stream.whenIdle();
    expect(stream.sampleHeight(5, 5)).toBeCloseTo(0);

    stream.update([45, 5, 5]);
    await stream.whenIdle();
    expect(stream.residentTiles()).toEqual([{ x: 4, z: 0 }]);
    expect(stream.sampleHeight(45, 5)).toBeCloseTo(100);
    expect(stream.sampleHeight(5, 5)).toBeUndefined();
    expect(stream.stats().evictions).toBeGreaterThan(0);
    stream.dispose();
  });

  it('loads optional layer objects on demand and toggles them without reloading', async () => {
    const d = descriptor({ gridSize: [1, 1] });
    let creates = 0;
    let disposes = 0;
    const layer: TerrainTileLayer = {
      id: 'trees',
      category: 'classification',
      visible: false,
      createTile(): THREE.Object3D {
        creates++;
        return new THREE.Group();
      },
      disposeTile(): void {
        disposes++;
      },
    };
    const source: TerrainHeightTileSource = {
      async load(address): Promise<Heightfield> {
        return flatTile(d, address);
      },
    };
    const stream = createTerrainStream(d, source, {
      cameraPos: [5, 5, 5],
      layers: [layer],
    });
    await stream.whenIdle();
    expect(creates).toBe(0);

    stream.setLayerVisible('trees', true);
    await stream.whenIdle();
    expect(creates).toBe(1);
    expect(stream.stats().layerObjects).toBe(1);
    expect(stream.stats().instances).toBe(0);
    stream.setLayerVisible('trees', false);
    expect(stream.object.getObjectByName('layer:trees:0_0')?.visible).toBe(false);
    stream.setLayerVisible('trees', true);
    await stream.whenIdle();
    expect(creates).toBe(1);
    stream.dispose();
    expect(disposes).toBe(1);
  });

  it('keeps missing tiles stable until explicitly retried', async () => {
    const d = descriptor({ gridSize: [1, 1] });
    let attempts = 0;
    const errors: unknown[] = [];
    const source: TerrainHeightTileSource = {
      async load(address): Promise<Heightfield | undefined> {
        attempts++;
        // A genuine 404: the tile does not exist, so nothing should retry it.
        if (attempts === 1) return undefined;
        return flatTile(d, address);
      },
    };
    const stream = createTerrainStream(d, source, {
      cameraPos: [5, 5, 5],
      retryDelayMs: 1,
      onError: (error) => errors.push(error),
    });
    await stream.whenIdle();
    expect(stream.failedTiles()).toEqual([{ x: 0, z: 0 }]);
    expect(stream.tileFailures()).toEqual([
      { address: { x: 0, z: 0 }, state: 'missing', attempts: 0 },
    ]);
    expect(stream.stats().missing).toBe(1);
    expect(attempts).toBe(1);

    stream.update([5, 5, 5]);
    await stream.whenIdle();
    expect(attempts).toBe(1);
    stream.retryFailed();
    await stream.whenIdle();
    expect(attempts).toBe(2);
    expect(stream.stats().resident).toBe(1);
    expect(errors).toHaveLength(1);
    stream.dispose();
  });

  it('retries a thrown transient failure with backoff and recovers', async () => {
    const d = descriptor({ gridSize: [1, 1] });
    let attempts = 0;
    const source: TerrainHeightTileSource = {
      async load(address): Promise<Heightfield> {
        attempts++;
        if (attempts === 1) throw new Error('terrain tile 0_0 failed: HTTP 503');
        return flatTile(d, address);
      },
    };
    // Snapshot the observable state at the moment the first attempt fails.
    let pending: ReturnType<TerrainStream['tileFailures']> = [];
    let stableWhileRetrying: TerrainTileAddress[] = [];
    const stream = createTerrainStream(d, source, {
      cameraPos: [5, 5, 5],
      retryDelayMs: 5,
      onError: () => {
        pending = stream.tileFailures();
        stableWhileRetrying = stream.failedTiles();
      },
    });
    await stream.whenIdle();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.state).toBe('retrying');
    expect(pending[0]?.attempts).toBe(1);
    expect(pending[0]?.nextAttemptAt).toBeGreaterThan(0);
    // A tile that is still being retried is not reported as a stable hole.
    expect(stableWhileRetrying).toEqual([]);

    expect(attempts).toBe(2);
    expect(stream.stats().resident).toBe(1);
    expect(stream.stats().retrying).toBe(0);
    expect(stream.stats().failed).toBe(0);
    expect(stream.tileFailures()).toEqual([]);
    stream.dispose();
  });

  it('gives up after the retry budget and distinguishes that from a missing tile', async () => {
    const d = descriptor({ gridSize: [1, 1] });
    let attempts = 0;
    const errors: unknown[] = [];
    const source: TerrainHeightTileSource = {
      async load(): Promise<Heightfield> {
        attempts++;
        throw new Error('terrain tile 0_0 failed: HTTP 503');
      },
    };
    const stream = createTerrainStream(d, source, {
      cameraPos: [5, 5, 5],
      maxRetries: 2,
      retryDelayMs: 1,
      onError: (error) => errors.push(error),
    });
    await stream.whenIdle();
    expect(attempts).toBe(3);
    expect(errors).toHaveLength(3);
    const failures = stream.tileFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0]?.state).toBe('failed');
    expect(failures[0]?.attempts).toBe(3);
    expect((failures[0]?.error as Error).message).toMatch(/503/);
    expect(stream.failedTiles()).toEqual([{ x: 0, z: 0 }]);
    expect(stream.stats()).toMatchObject({ failed: 1, missing: 0, retrying: 0 });

    stream.update([5, 5, 5]);
    await stream.whenIdle();
    expect(attempts).toBe(3);
    stream.dispose();
  });

  it('times out a stalled request instead of pinning a load slot forever', async () => {
    const d = descriptor({ gridSize: [1, 1] });
    let attempts = 0;
    const stalls: Array<ReturnType<typeof setTimeout>> = [];
    const source: TerrainHeightTileSource = {
      async load(address): Promise<Heightfield> {
        attempts++;
        if (attempts > 1) return flatTile(d, address);
        // Never settles inside the deadline, and ignores the abort signal on purpose.
        return new Promise<Heightfield>((resolve) => {
          stalls.push(setTimeout(() => resolve(flatTile(d, address)), 30_000));
        });
      },
    };
    const errors: unknown[] = [];
    const stream = createTerrainStream(d, source, {
      cameraPos: [5, 5, 5],
      requestTimeoutMs: 20,
      retryDelayMs: 1,
      onError: (error) => errors.push(error),
    });
    await stream.whenIdle();
    expect(attempts).toBe(2);
    expect(stream.stats().resident).toBe(1);
    expect(stream.stats().loading).toBe(0);
    expect((errors[0] as Error).name).toBe('TimeoutError');
    expect((errors[0] as Error).message).toMatch(/timed out after 20 ms/);
    for (const stall of stalls) clearTimeout(stall);
    stream.dispose();
  });

  it('joins adjacent tile normals across their shared border', async () => {
    const d = descriptor({
      gridSize: [2, 1],
      lod: { levels: 1, distanceBands: [], skirts: true },
    });
    // A smooth analytic surface sampled by each tile over its own inclusive bounds.
    const surface = (x: number, z: number): number =>
      0.5 + 0.21 * Math.sin(x / 7) * Math.cos(z / 11) + 0.1 * Math.sin((x + z) / 5);
    const tileField = (address: TerrainTileAddress): Heightfield => {
      const res = d.tileResolution;
      const cell = d.chunkSize / (res - 1);
      const ox = d.origin[0] + address.x * d.chunkSize;
      const oz = d.origin[1] + address.z * d.chunkSize;
      const grid = new Float32Array(res * res);
      for (let r = 0; r < res; r++) {
        for (let c = 0; c < res; c++) grid[r * res + c] = surface(ox + c * cell, oz + r * cell);
      }
      return new Heightfield(grid, res, res, {
        origin: [ox, oz],
        worldSize: [d.chunkSize, d.chunkSize],
        height: d.height,
      });
    };
    const source: TerrainHeightTileSource = {
      async load(address): Promise<Heightfield> {
        return tileField(address);
      },
    };
    const stream = createTerrainStream(d, source, { cameraPos: [10, 5, 5] });
    await stream.whenIdle();
    expect(stream.residentTiles()).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ]);

    const normalsOf = (key: string): Float32Array => {
      const mesh = stream.object.getObjectByName(`surface:${key}:lod1`) as THREE.Mesh;
      return mesh.geometry.getAttribute('normal').array as Float32Array;
    };
    const west = normalsOf('0_0');
    const east = normalsOf('1_0');
    const res = d.tileResolution;
    let worst = 0;
    for (let r = 0; r < res; r++) {
      const a = (r * res + res - 1) * 3;
      const b = (r * res + 0) * 3;
      worst = Math.max(
        worst,
        Math.hypot(
          (west[a] as number) - (east[b] as number),
          (west[a + 1] as number) - (east[b + 1] as number),
          (west[a + 2] as number) - (east[b + 2] as number),
        ),
      );
      // The border heights agree, so the border normals must agree exactly too.
      expect(west[a]).toBe(east[b]);
      expect(west[a + 1]).toBe(east[b + 1]);
      expect(west[a + 2]).toBe(east[b + 2]);
    }
    expect(worst).toBe(0);
    stream.dispose();
  });

  it('resolves URL templates without making the provider format part of residency', () => {
    expect(resolveTerrainTileUrl('tiles/h_{x}_{z}.png', { x: 3, z: 7 }, 'https://x.test/a/')).toBe(
      'https://x.test/a/tiles/h_3_7.png',
    );
  });
});
