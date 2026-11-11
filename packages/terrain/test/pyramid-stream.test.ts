import { FrameAdmissionQueue } from '@bendyline/molen-client';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  setTerrainGroundCutout,
  TerrainGroundCutoutController,
  terrainGroundSourceGeometry,
} from '../src/ground-cutout';
import { Heightfield } from '../src/heightfield';
import { buildChunkGeometry } from '../src/mesh';
import {
  createTerrainPyramidStream,
  selectTerrainPyramidTiles,
  surfaceDescriptor,
  TERRAIN_COVERS_GROUND,
  type TerrainPyramidHeightSource,
  type TerrainPyramidTileLayer,
  terrainPyramidBudgetForQuality,
} from '../src/pyramid-stream';
import {
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidTileKey,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from '../src/pyramid-types';

function descriptor(overrides: Partial<TerrainPyramidDescriptor> = {}): TerrainPyramidDescriptor {
  return {
    name: 'pyramid-test',
    origin: [0, 0],
    rootSize: 16,
    minLevel: 0,
    maxLevel: 2,
    tileResolution: 3,
    height: { min: 0, max: 100 },
    layers: [{ name: 'ground', color: '#668855', tiling: 1 }],
    skirts: true,
    ...overrides,
  };
}

function flatTile(
  d: TerrainPyramidDescriptor,
  address: TerrainPyramidTileAddress,
  normalizedHeight = address.level / 4,
): Heightfield {
  const origin = terrainPyramidTileOrigin(d, address);
  const size = terrainPyramidTileSize(d, address.level);
  return new Heightfield(new Float32Array(9).fill(normalizedHeight), 3, 3, {
    origin,
    worldSize: [size, size],
    height: d.height,
  });
}

/** Whether a named object is on screen: a hidden tile leaves the scene graph altogether. */
function drawn(stream: { object: THREE.Object3D }, name: string): boolean {
  return stream.object.getObjectByName(name)?.visible === true;
}

const VIEW = {
  position: [2, 10, 2] as [number, number, number],
  verticalFov: Math.PI / 2,
  viewportHeight: 1_000,
};

describe('screen-space terrain pyramid', () => {
  it('keeps fine work spatially prioritized behind a much coarser displayed ancestor', async () => {
    const d = descriptor();
    const priorities = new Map<string, () => number>();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (a) => flatTile(d, a) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 32,
        maxResidentTiles: 64,
        maxConcurrentLoads: 32,
        maxConcurrentLayerLoads: 32,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address, priority }) {
              if (address.level === 0) return new THREE.Group();
              if (priority) priorities.set(terrainPyramidTileKey(address), priority);
              return new Promise<THREE.Object3D>(() => {});
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      stream.setBudget({ maxScreenSpaceError: 1 });
      await expect.poll(() => priorities.has('2/3/3')).toBe(true);
      expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
      expect(priorities.get('2/0/0')?.()).toBe(0);
      expect(priorities.get('2/3/3')?.()).toBeGreaterThan(10);
      const approach = { ...VIEW, position: [14, 10, 14] as [number, number, number] };
      // A future tile keeps its preparation lead through downstream worker/admission queues,
      // even while nearer off-route tiles fill a wide view. A changed route drops that boost.
      stream.update(VIEW, [approach]);
      expect(priorities.get('2/3/3')?.()).toBeLessThan(priorities.get('2/1/0')?.() ?? 0);
      stream.update(VIEW);
      expect(priorities.get('2/3/3')?.()).toBeGreaterThan(priorities.get('2/1/0')?.() ?? Infinity);
      stream.update({ ...VIEW, position: [14, 10, 14] });
      expect(priorities.get('2/3/3')?.()).toBe(0);
      expect(priorities.get('2/0/0')?.()).toBeGreaterThan(10);
    } finally {
      stream.dispose();
    }
  });

  it('keeps independent detail workers moving while water requests are stalled', async () => {
    const d = descriptor({ minLevel: 2, maxLevel: 2 });
    const water = vi.fn(() => new Promise<THREE.Object3D>(() => {}));
    const land = vi.fn(() => new THREE.Group());
    const buildings = vi.fn(() => new THREE.Group());
    let releaseHeights!: () => void;
    const laterHeights = new Promise<void>((resolve) => {
      releaseHeights = resolve;
    });
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) => {
          if (address.x >= 2) await laterHeights;
          return flatTile(d, address);
        },
      },
      {
        initialView: VIEW,
        viewDistance: 100,
        maxScreenSpaceError: 1,
        maxSelectedTiles: 16,
        maxResidentTiles: 32,
        maxConcurrentLoads: 16,
        maxConcurrentLayerLoads: 6,
        layers: [
          { id: 'water', category: 'hydrology', createTile: water },
          { id: 'land', category: 'classification', createTile: land },
          { id: 'buildings', category: 'human-feature', createTile: buildings },
        ],
      },
    );
    try {
      await expect.poll(() => buildings.mock.calls.length).toBe(8);
      // The first group has exhausted its useful work. Water must not borrow the slots the
      // next heights' landcover/buildings will need when those heights become resident.
      releaseHeights();
      await expect.poll(() => buildings.mock.calls.length).toBe(16);
      expect(land).toHaveBeenCalledTimes(16);
      expect(water.mock.calls.length).toBeGreaterThan(0);
      expect(stream.loading().layers).toBeLessThanOrEqual(6);
      expect(stream.isAreaReady(2, 2, 1)).toBe(false);
    } finally {
      releaseHeights();
      stream.dispose();
    }
  });

  it.each([
    false,
    true,
  ])('shares graded heights with terrain, physics and layers (worker=%s)', async (worker) => {
    const d = descriptor({ maxLevel: 0 });
    const address = { level: 0, x: 0, z: 0 };
    const original = flatTile(d, address);
    const graded = new Heightfield(new Float32Array(9).fill(0.1), 3, 3, {
      origin: d.origin,
      worldSize: [16, 16],
      height: d.height,
    });
    const source: TerrainPyramidHeightSource = {
      load: async () => original,
      ...(worker
        ? {
            loadPrepared: async () => ({
              heightfield: original,
              geometry: buildChunkGeometry(original, surfaceDescriptor(d, address), 0, 0, {
                localCoordinates: true,
              }),
            }),
            // The worker meshes the graded field too, off the main thread.
            meshPrepared: vi.fn(async (field: Heightfield) =>
              buildChunkGeometry(field, surfaceDescriptor(d, address), 0, 0, {
                localCoordinates: true,
              }),
            ),
          }
        : {}),
    };
    const createTile = vi.fn(() => new THREE.Group());
    const transformHeightfield = vi.fn(async (context, raw) => {
      expect(context.heightfield).toBe(original);
      expect(raw).toBe(source);
      expect(context.signal.aborted).toBe(false);
      return graded;
    });
    const stream = createTerrainPyramidStream(d, source, {
      initialView: VIEW,
      viewDistance: 100,
      maxScreenSpaceError: 10000,
      maxSelectedTiles: 4,
      maxResidentTiles: 8,
      maxConcurrentLoads: 4,
      transformHeightfield,
      layers: [{ id: 'pavement', category: 'human-feature', createTile }],
    });
    try {
      await stream.whenIdle();
      expect(transformHeightfield).toHaveBeenCalledOnce();
      expect(createTile).toHaveBeenCalledWith(expect.objectContaining({ heightfield: graded }));
      if (worker)
        expect(source.meshPrepared).toHaveBeenCalledWith(
          graded,
          address,
          expect.any(AbortSignal),
          expect.any(Number),
        );
      expect(original.sampleHeight(2, 2)).toBe(0);
      expect(stream.sampleHeight(2, 2)).toBeCloseTo(10, 5);
      expect(stream.sampleSurfaceHeight(2, 2)).toBeCloseTo(10, 5);
      stream.object.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(2, 100, 2), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(stream.object, true)[0]?.point.y).toBeCloseTo(10, 5);
    } finally {
      stream.dispose();
    }
  });

  it.each([3, 5, 9])('samples displayed triangles at surface resolution %i', async (resolution) => {
    const d = descriptor({ maxLevel: 0, tileResolution: 9, origin: [1000, 2000], rootSize: 100 });
    const samples = Float32Array.from(
      { length: 81 },
      (_, i) =>
        (((i % 9) - 4) ** 2 + (Math.floor(i / 9) - 4) ** 2) / 50 +
        (((i % 9) + Math.floor(i / 9)) % 3) * 0.1,
    );
    const field = new Heightfield(samples, 9, 9, {
      origin: d.origin,
      worldSize: [100, 100],
      height: d.height,
    });
    const stream = createTerrainPyramidStream(
      d,
      { load: async () => field },
      {
        initialView: { ...VIEW, position: [1050, 100, 2050] },
        viewDistance: 200,
        maxScreenSpaceError: 10000,
        maxSelectedTiles: 4,
        maxResidentTiles: 8,
        maxConcurrentLoads: 4,
        maxSurfaceTileResolution: resolution,
      },
    );
    try {
      await stream.whenIdle();
      stream.object.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      let largestDifference = 0;
      for (const [x, z] of [
        [1003, 2007],
        [1021, 2064],
        [1077, 2012],
        [1096, 2091],
      ]) {
        ray.set(new THREE.Vector3(x, 1000, z), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObject(stream.object, true)[0];
        expect(hit).toBeDefined();
        expect(stream.sampleSurfaceHeight(x, z)).toBeCloseTo(hit?.point.y ?? NaN, 5);
        expect(stream.sampleHeight(x, z)).toBe(field.sampleHeight(x, z));
        largestDifference = Math.max(
          largestDifference,
          Math.abs(field.sampleHeight(x, z) - (hit?.point.y ?? NaN)),
        );
      }
      expect(largestDifference).toBeGreaterThan(0.1);
      expect(stream.sampleSurfaceHeight(999, 2000)).toBeUndefined();
    } finally {
      stream.dispose();
    }
  });

  it('samples the current refinement morph instead of jumping ahead to its target height', async () => {
    const d = descriptor({ maxLevel: 1 });
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10000,
        viewDistance: 100,
        morphMilliseconds: 1000,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
      },
    );
    try {
      await stream.whenIdle();
      expect(stream.sampleSurfaceHeight(2, 2)).toBe(0);
      stream.setBudget({ maxScreenSpaceError: 1 });
      await stream.whenIdle();
      expect(stream.sampleHeight(2, 2)).toBe(25);
      expect(stream.sampleSurfaceHeight(2, 2)).toBe(0);
      stream.updateTransitions(performance.now() + 500);
      const mid = stream.sampleSurfaceHeight(2, 2) ?? NaN;
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(25);
      stream.object.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(2, 100, 2), new THREE.Vector3(0, -1, 0));
      expect(mid).toBeCloseTo(ray.intersectObject(stream.object, true)[0]?.point.y ?? NaN, 5);
      stream.updateTransitions(performance.now() + 2000);
      expect(stream.sampleSurfaceHeight(2, 2)).toBe(25);
    } finally {
      stream.dispose();
    }
  });

  it('keeps all four approaching families at the minimum render selection budget', async () => {
    const d = descriptor({ rootSize: 512, minLevel: 4, maxLevel: 4 });
    const stream = createTerrainPyramidStream(
      d,
      { load: async (a) => flatTile(d, a) },
      {
        maxScreenSpaceError: 1,
        viewDistance: 1,
        maxSelectedTiles: 16,
        maxResidentTiles: 32,
        maxConcurrentLoads: 4,
      },
    );
    try {
      stream.update(
        { ...VIEW, position: [80, 10, 80] },
        [176, 272, 368, 464].map((x) => ({ ...VIEW, position: [x, 10, 80] })),
      );
      await stream.whenIdle();
      expect(stream.stats()).toMatchObject({ preloading: 16, preloaded: 16 });
      expect(stream.pressure().residentTiles).toBeLessThanOrEqual(32);
    } finally {
      stream.dispose();
    }
  });

  it('samples cached ground behind the camera without waiting for it to become visible', async () => {
    const d = descriptor();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 32,
        maxResidentTiles: 64,
        maxConcurrentLoads: 4,
      },
    );
    try {
      stream.update(VIEW);
      await stream.whenIdle();
      stream.update({ ...VIEW, position: [14, 10, 14], direction: [1, 0, 0], aspect: 1 });
      await stream.whenIdle();
      expect(stream.displayedTiles()).not.toContainEqual({ level: 2, x: 0, z: 0 });
      expect(stream.residentTiles()).toContainEqual(
        expect.objectContaining({ level: 2, x: 0, z: 0 }),
      );
      expect(stream.sampleHeight(2, 2)).toBe(50);
      expect(stream.sampleSurfaceHeight(2, 2)).toBe(50);
      expect(stream.sampleHeight(-1, -1)).toBeUndefined();
    } finally {
      stream.dispose();
    }
  });

  it('reserves forward progress for upcoming tiles already in the current selection', async () => {
    const d = descriptor({ rootSize: 512, minLevel: 4, maxLevel: 4 });
    const jobs: TerrainPyramidTileAddress[] = [];
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        maxScreenSpaceError: 1,
        viewDistance: 160,
        maxSelectedTiles: 128,
        maxResidentTiles: 256,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address }) {
              jobs.push(address);
              return new Promise<THREE.Object3D>(() => {});
            },
          },
        ],
      },
    );
    try {
      stream.update({ ...VIEW, position: [80, 10, 80] }, [{ ...VIEW, position: [176, 10, 80] }]);
      await expect.poll(() => jobs.length).toBe(4);
      expect(stream.stats().preloading).toBe(0);
      expect(jobs.filter((address) => address.x >= 4)).toHaveLength(2);
    } finally {
      stream.dispose();
    }
  });

  it('publishes inherited ground detail with fine surfaces while new buildings on other tiles finish', async () => {
    const d = descriptor({ maxLevel: 1 });
    const buildings = new Map<string, (object: THREE.Object3D) => void>();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10000,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 5, // Four held building jobs plus the landcover lane.,
        layers: [
          { id: 'land', category: 'land-classification', createTile: () => new THREE.Group() },
          {
            id: 'buildings',
            category: 'human-feature',
            minLevel: 1,
            createTile({ address }) {
              return new Promise<THREE.Object3D>((resolve) =>
                buildings.set(terrainPyramidTileKey(address), resolve),
              );
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      stream.setBudget({ maxScreenSpaceError: 1 });
      await expect.poll(() => buildings.size).toBe(4);
      buildings.get('1/0/0')?.(new THREE.Group());
      await expect.poll(() => stream.isAreaReady(2, 2, 1)).toBe(true);
      expect(stream.object.getObjectByName('layer:land:1/0/0')?.visible).toBe(true);
      // Hidden tiles leave the scene graph, so "not drawn" also covers a detached tile.
      expect(drawn(stream, 'layer:land:0/0/0')).toBe(false);
      expect(stream.object.getObjectByName('layer:land:1/1/1')?.visible).toBe(true);
      expect(stream.isAreaReady(12, 12, 1)).toBe(false);
      expect(stream.loading().layers).toBe(3);
    } finally {
      stream.dispose();
    }
  });

  it('finishes a nearby replacement family before unrelated closer leaves so prepared detail can display', async () => {
    const d = descriptor();
    const pending: Array<{
      address: TerrainPyramidTileAddress;
      resolve: (object: THREE.Object3D) => void;
    }> = [];
    const view = { ...VIEW, position: [7.9, 10, 3] as [number, number, number] };
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: view,
        maxScreenSpaceError: 2500,
        viewDistance: 100,
        maxSelectedTiles: 32,
        maxResidentTiles: 64,
        maxConcurrentLoads: 32,
        maxConcurrentLayerLoads: 1,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address }) {
              if (address.level < 2) return new THREE.Group();
              return new Promise<THREE.Object3D>((resolve) => pending.push({ address, resolve }));
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      expect(stream.displayedTiles().every((tile) => tile.level === 1)).toBe(true);
      stream.setBudget({ maxScreenSpaceError: 1 });
      await expect.poll(() => stream.loading().tiles).toBe(0);
      for (let i = 0; i < 4; i++) {
        await expect.poll(() => pending.length).toBe(i + 1);
        const job = pending[i];
        // The adjacent parent's first leaf is only 0.1 m away, but does not release the
        // already-prepared leaf under the camera. Its own four siblings must finish first.
        expect(job?.address.x).toBeLessThan(2);
        expect(job?.address.z).toBeLessThan(2);
        job?.resolve(new THREE.Group());
      }
      await expect.poll(() => stream.isAreaReady(7.9, 3, 0.01)).toBe(true);
    } finally {
      stream.dispose();
    }
  });

  it('finishes the replacement family before finer selected leaves held behind it', async () => {
    const d = descriptor();
    const pending: Array<{
      level: number;
      signal: AbortSignal;
      resolve: (object: THREE.Object3D) => void;
    }> = [];
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10000,
        viewDistance: 100,
        maxSelectedTiles: 32,
        maxResidentTiles: 64,
        maxConcurrentLoads: 32,
        maxConcurrentLayerLoads: 1,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address, signal }) {
              if (address.level === 0) return new THREE.Group();
              return new Promise<THREE.Object3D>((resolve) =>
                pending.push({ level: address.level, signal, resolve }),
              );
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      stream.setBudget({ maxScreenSpaceError: 1 });
      await expect.poll(() => stream.loading().tiles).toBe(0);
      expect(pending).toHaveLength(1);
      // Finer surfaces arriving makes their older ancestors reclaimable, except for the
      // replacement family still needed to publish them. Camera updates must not restart it.
      for (let i = 0; i < 10; i++) stream.update(VIEW);
      stream.setBudget({ maxResidentBytes: 1 });
      expect(pending[0]?.signal.aborted).toBe(false);
      expect(pending).toHaveLength(1);
      pending[0]?.resolve(new THREE.Group());
      await expect.poll(() => pending.length).toBe(2);
      expect(pending[1]?.level).toBe(1);
    } finally {
      stream.dispose();
    }
  });

  it('keeps the predicted route when a transient future-tile failure retries', async () => {
    const d = descriptor({ rootSize: 512, minLevel: 4, maxLevel: 4 });
    let attempts = 0;
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address) {
          if (address.x === 9 && address.z === 2 && ++attempts === 1)
            throw new Error('temporary network failure');
          return flatTile(d, address);
        },
      },
      {
        maxScreenSpaceError: 1,
        viewDistance: 12,
        maxSelectedTiles: 4,
        maxResidentTiles: 12,
        maxConcurrentLoads: 1,
        retryDelayMs: 5,
        maxRetryDelayMs: 5,
      },
    );
    try {
      stream.update({ ...VIEW, position: [80, 10, 80] }, [{ ...VIEW, position: [304, 10, 80] }]);
      await stream.whenIdle();
      expect(attempts).toBe(2);
      expect(stream.stats()).toMatchObject({ preloading: 4, preloaded: 4, failed: 0 });
    } finally {
      stream.dispose();
    }
  });

  it('gives forward preparation a bounded layer slot while current-view work stays queued', async () => {
    const d = descriptor({ rootSize: 512, minLevel: 4, maxLevel: 4 });
    const jobs: Array<{ key: string; resolve: (object: THREE.Object3D) => void }> = [];
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        maxScreenSpaceError: 1,
        viewDistance: 45,
        maxSelectedTiles: 16,
        maxResidentTiles: 40,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address }) {
              return new Promise<THREE.Object3D>((resolve) =>
                jobs.push({ key: terrainPyramidTileKey(address), resolve }),
              );
            },
          },
        ],
      },
    );
    try {
      stream.update({ ...VIEW, position: [80, 10, 80] }, [{ ...VIEW, position: [304, 10, 80] }]);
      await expect.poll(() => jobs.length).toBe(4);
      // A completion must not repeatedly give its slot to the remaining current-view backlog.
      jobs[0]?.resolve(new THREE.Group());
      await expect.poll(() => jobs.length).toBe(5);
      expect(jobs.filter(({ key }) => Number(key.split('/')[1]) >= 8)).toHaveLength(2);
      expect(stream.loading().layers).toBe(4);
    } finally {
      stream.dispose();
    }
  });

  it('suspends speculative work under byte pressure instead of rebuilding evicted preloads', async () => {
    const d = descriptor({ rootSize: 512, minLevel: 4, maxLevel: 4 });
    const reads: string[] = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) => {
          reads.push(terrainPyramidTileKey(address));
          return flatTile(d, address);
        },
      },
      {
        maxScreenSpaceError: 1,
        viewDistance: 12,
        maxSelectedTiles: 4,
        maxResidentTiles: 12,
        maxConcurrentLoads: 1,
        maxResidentBytes: 1,
      },
    );
    const current = { ...VIEW, position: [80, 10, 80] as [number, number, number] };
    const future = { ...VIEW, position: [304, 10, 80] as [number, number, number] };
    try {
      stream.update(current);
      await stream.whenIdle();
      for (let i = 0; i < 10; i++) {
        stream.update(current, [future]);
        await stream.whenIdle();
      }
      expect(reads).toEqual(['4/2/2']);
      expect(stream.isAreaReady(80, 80, 1)).toBe(true);
      stream.setBudget({ maxResidentBytes: 1_000_000 });
      await stream.whenIdle();
      expect(stream.stats()).toMatchObject({ preloading: 4, preloaded: 4 });
    } finally {
      stream.dispose();
    }
  });

  it('reclaims redundant ancestors before displacing prepared flight-route tiles', async () => {
    const d = descriptor({ rootSize: 4096, minLevel: 0, maxLevel: 7 });
    const current = { ...VIEW, position: [80, 10, 80] as [number, number, number] };
    const future = { ...VIEW, position: [304, 10, 80] as [number, number, number] };
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        maxScreenSpaceError: 1,
        viewDistance: 12,
        maxSelectedTiles: 4,
        maxResidentTiles: 8,
        maxConcurrentLoads: 2,
        layers: [{ id: 'detail', category: 'human-feature', createTile: () => new THREE.Group() }],
      },
    );
    try {
      stream.update(current);
      await stream.whenIdle();
      expect(stream.isAreaReady(80, 80, 1)).toBe(true);
      stream.update(current, [future]);
      await stream.whenIdle();
      expect(stream.stats()).toMatchObject({ preloading: 4, preloaded: 4 });
      expect(stream.stats().resident).toBeLessThanOrEqual(8);
      expect(stream.isAreaReady(80, 80, 1)).toBe(true);
      stream.update(future);
      expect(stream.isAreaReady(304, 80, 1)).toBe(true);
    } finally {
      stream.dispose();
    }
  });

  it('prepares future terrain, layers and GPU resources while keeping them hidden, then reuses them on arrival', async () => {
    const d = descriptor({ rootSize: 512, minLevel: 4, maxLevel: 4 });
    const current = { ...VIEW, position: [80, 10, 80] as [number, number, number] };
    const future = { ...VIEW, position: [304, 10, 80] as [number, number, number] };
    const heights: string[] = [];
    const layers: string[] = [];
    const prepared: THREE.Object3D[] = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address) {
          heights.push(terrainPyramidTileKey(address));
          return flatTile(d, address);
        },
      },
      {
        maxScreenSpaceError: 1,
        viewDistance: 45,
        maxSelectedTiles: 16,
        maxResidentTiles: 40,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        prepareObject: async (object) => {
          prepared.push(object);
        },
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address }) {
              layers.push(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
        ],
      },
    );
    try {
      stream.update(current);
      await stream.whenIdle();
      const displayed = stream.displayedTiles();
      stream.update(current, [future]);
      await stream.whenIdle();
      expect(stream.displayedTiles()).toEqual(displayed);
      expect(stream.stats()).toMatchObject({ preloading: 4, preloaded: 4 });
      expect(layers.filter((key) => Number(key.split('/')[1]) >= 8).sort()).toEqual([
        '4/8/2',
        '4/8/3',
        '4/9/2',
        '4/9/3',
      ]);
      // A prepared tile stays out of the scene graph until it is displayed.
      const target = prepared.find((o) => o.name === 'tile:4/9/2') as THREE.Group;
      const detail = prepared.find((o) => o.name === 'layer:detail:4/9/2') as THREE.Group;
      expect(stream.object.getObjectByName('tile:4/9/2')).toBeUndefined();
      expect(target.visible).toBe(false);
      expect(prepared).toContain(target);
      expect(prepared).toContain(detail);
      const heightReads = heights.filter((key) => key === '4/9/2').length;
      stream.update(future);
      // No wait: all three stages completed before arrival.
      expect(stream.isAreaReady(304, 80, 1)).toBe(true);
      expect(target.visible).toBe(true);
      expect(detail.visible).toBe(true);
      expect(stream.object.getObjectByName('tile:4/9/2')).toBe(target);
      await stream.whenIdle();
      expect(heights.filter((key) => key === '4/9/2')).toHaveLength(heightReads);
      expect(layers.filter((key) => key === '4/9/2')).toHaveLength(1);
      expect(stream.stats().resident).toBeLessThanOrEqual(40);
    } finally {
      stream.dispose();
    }
  });

  it('releases obsolete height slots immediately when travel changes direction', async () => {
    const d = descriptor({ rootSize: 512, minLevel: 4, maxLevel: 4 });
    const reads: Array<{ key: string; signal: AbortSignal; resolve: () => void }> = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address, signal) {
          await new Promise<void>((resolve) =>
            reads.push({ key: terrainPyramidTileKey(address), signal, resolve }),
          );
          return flatTile(d, address);
        },
      },
      {
        maxScreenSpaceError: 1,
        viewDistance: 12,
        maxSelectedTiles: 4,
        maxResidentTiles: 12,
        maxConcurrentLoads: 1,
      },
    );
    try {
      stream.update({ ...VIEW, position: [80, 10, 80] });
      expect(reads).toHaveLength(1);
      stream.update({ ...VIEW, position: [304, 10, 80] });
      expect(reads[0]?.signal.aborted).toBe(true);
      expect(reads).toHaveLength(2);
      expect(reads[1]?.key).toBe('4/9/2');
      reads[0]?.resolve();
      reads[1]?.resolve();
      await stream.whenIdle();
      expect(stream.residentTiles()).toEqual([{ level: 4, x: 9, z: 2 }]);
      expect(stream.stats().failed).toBe(0);
    } finally {
      stream.dispose();
    }
  });

  it.each([
    false,
    true,
  ])('applies spatial colors to world coordinates on prepared=%s meshes and preserves declined vertices', async (prepared) => {
    const d = descriptor({ origin: [100, 200], maxLevel: 0, skirts: false });
    const calls: number[][] = [];
    const source: TerrainPyramidHeightSource = { load: async (address) => flatTile(d, address) };
    if (prepared)
      source.loadPrepared = async (address) => {
        const heightfield = flatTile(d, address);
        return {
          heightfield,
          geometry: buildChunkGeometry(
            heightfield,
            surfaceDescriptor(d, address),
            address.x,
            address.z,
            { localCoordinates: true },
          ),
        };
      };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: { ...VIEW, position: [102, 10, 202] },
      maxScreenSpaceError: 10000,
      viewDistance: 100,
      maxSelectedTiles: 1,
      maxResidentTiles: 2,
      maxConcurrentLoads: 1,
      surfaceColor(x, y, z, slope, base) {
        calls.push([x, y, z, slope, ...base]);
        return x === 100 ? [0.1, 0.2, 0.3] : x === 108 ? undefined : [Number.NaN, 0, 0];
      },
    });
    try {
      await stream.whenIdle();
      const mesh = stream.object.getObjectByName('surface:0/0/0') as THREE.Mesh;
      const colors = mesh.geometry.getAttribute('color');
      expect(calls).toHaveLength(9);
      for (const [i, sample] of calls.entries()) {
        expect(sample[0]).toBeGreaterThanOrEqual(100);
        expect(sample[2]).toBeGreaterThanOrEqual(200);
        expect(sample[3]).toBe(0);
        const expected = sample[0] === 100 ? [0.1, 0.2, 0.3] : sample.slice(4);
        expect(colors.getX(i)).toBeCloseTo(expected[0] ?? 0);
        expect(colors.getY(i)).toBeCloseTo(expected[1] ?? 0);
        expect(colors.getZ(i)).toBeCloseTo(expected[2] ?? 0);
      }
    } finally {
      stream.dispose();
    }
  });

  it('skips drawing bare terrain under a displayed layer that covers its whole tile', async () => {
    const d = descriptor({ maxLevel: 0, skirts: false });
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 1,
        maxResidentTiles: 2,
        maxConcurrentLoads: 1,
        layers: [
          {
            id: 'landcover',
            category: 'land-classification',
            createTile() {
              const cover = new THREE.Group();
              cover.userData[TERRAIN_COVERS_GROUND] = true;
              return cover;
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      const surface = stream.object.getObjectByName('surface:0/0/0') as THREE.Mesh;
      // Still displayed for the stream's own bookkeeping, but drawn by no camera.
      expect(surface.visible).toBe(true);
      expect(surface.layers.mask).toBe(0);
      stream.setLayerVisible('landcover', false);
      expect(surface.layers.mask).toBe(1);
      stream.setLayerVisible('landcover', true);
      await stream.whenIdle();
      expect(surface.layers.mask).toBe(0);
    } finally {
      stream.dispose();
    }
  });

  it('refines detailed ancestors in small families instead of waiting for every distant leaf', async () => {
    const d = descriptor();
    const pending = new Map<string, (object: THREE.Object3D) => void>();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 32,
        maxResidentTiles: 64,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 20,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address }) {
              if (address.level < 2) return new THREE.Group();
              return new Promise<THREE.Object3D>((resolve) =>
                pending.set(terrainPyramidTileKey(address), resolve),
              );
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      stream.setBudget({ maxScreenSpaceError: 1 });
      await expect.poll(() => pending.size).toBe(16);
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(stream.displayedTiles().every((address) => address.level === 1)).toBe(true);
      for (let x = 0; x < 2; x++)
        for (let z = 0; z < 2; z++) pending.get(`2/${x}/${z}`)?.(new THREE.Group());
      await expect
        .poll(() => stream.displayedTiles().filter((address) => address.level === 2).length)
        .toBe(4);
      expect(stream.displayedTiles().filter((address) => address.level === 1)).toHaveLength(3);
      expect(stream.stats().loadingLayers).toBe(12);
      for (const resolve of pending.values()) resolve(new THREE.Group());
      await stream.whenIdle();
      expect(stream.displayedTiles()).toHaveLength(16);
    } finally {
      stream.dispose();
    }
  });

  it('publishes nearby detail without waiting for every new layer under a bare ancestor', async () => {
    const d = descriptor({ maxLevel: 1 });
    const pending = new Map<string, (object: THREE.Object3D) => void>();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        layers: [
          {
            id: 'human',
            category: 'human-feature',
            minLevel: 1,
            createTile({ address }) {
              return new Promise<THREE.Object3D>((resolve) =>
                pending.set(terrainPyramidTileKey(address), resolve),
              );
            },
          },
        ],
      },
    );
    try {
      await expect.poll(() => pending.size).toBe(4);
      pending.get('1/0/0')?.(new THREE.Group());
      await expect
        .poll(() => stream.object.getObjectByName('layer:human:1/0/0')?.visible)
        .toBe(true);
      expect(stream.stats().loadingLayers).toBe(3);
      expect(stream.displayedTiles()).toHaveLength(4);
    } finally {
      stream.dispose();
    }
  });

  it('reports an area ready once its own tiles and layers are on screen, whatever loads elsewhere', async () => {
    const d = descriptor({ maxLevel: 1 });
    const pending = new Map<string, (object: THREE.Object3D) => void>();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        layers: [
          {
            id: 'human',
            category: 'human-feature',
            minLevel: 1,
            createTile({ address }) {
              return new Promise<THREE.Object3D>((resolve) =>
                pending.set(terrainPyramidTileKey(address), resolve),
              );
            },
          },
        ],
      },
    );
    try {
      await expect.poll(() => pending.size).toBe(4);
      // Level-1 tiles are 8 m squares; (3, 3) ± 2 lies inside 1/0/0, whose buildings are loading.
      expect(stream.isAreaReady(3, 3, 2)).toBe(false);
      pending.get('1/0/0')?.(new THREE.Group());
      await expect.poll(() => stream.isAreaReady(3, 3, 2)).toBe(true);
      expect(stream.stats().loadingLayers).toBe(3);
      // Reaching over the x = 8 border takes in 1/1/0, whose layer is still loading.
      expect(stream.isAreaReady(7, 3, 2)).toBe(false);
      expect(stream.isAreaReady(100, 100, 1)).toBe(false);
      for (const resolve of pending.values()) resolve(new THREE.Group());
      await expect.poll(() => stream.isAreaReady(7, 3, 2)).toBe(true);
    } finally {
      stream.dispose();
    }
  });

  it('keeps overlapping detail visible through the surface fallback during a 20 degree turn', async () => {
    const d = descriptor({ rootSize: 256, maxLevel: 4 });
    const view = {
      ...VIEW,
      position: [120, 10, 120] as [number, number, number],
      direction: [0, 0, -1] as [number, number, number],
      aspect: 1.4,
    };
    let hold = false;
    const pending: Array<() => void> = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address) {
          if (hold) await new Promise<void>((resolve) => pending.push(resolve));
          return flatTile(d, address);
        },
      },
      {
        initialView: view,
        maxScreenSpaceError: 1,
        viewDistance: 300,
        maxSelectedTiles: 128,
        maxResidentTiles: 256,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        layers: [
          {
            id: 'human',
            category: 'human-feature',
            minLevel: 4,
            createTile: () => new THREE.Group(),
          },
        ],
      },
    );
    const visibleDetail = (): Set<string> => {
      const result = new Set<string>();
      stream.object.traverseVisible((object) => {
        if (object.name.startsWith('layer:human:')) result.add(object.name);
      });
      return result;
    };
    try {
      await stream.whenIdle();
      const before = visibleDetail();
      expect(before.size).toBeGreaterThan(0);
      hold = true;
      stream.update({ ...view, direction: [Math.sin(Math.PI / 9), 0, -Math.cos(Math.PI / 9)] });
      expect(stream.stats().fallbackLeaves).toBeGreaterThan(0);
      const after = visibleDetail();
      expect([...before].filter((key) => after.has(key)).length).toBeGreaterThan(before.size / 2);
      hold = false;
      for (const finish of pending) finish();
      await stream.whenIdle();
      stream.update(view);
      await stream.whenIdle();
      expect(visibleDetail()).toEqual(before);
    } finally {
      stream.dispose();
      for (const finish of pending) finish();
    }
  });

  it('warms peripheral water while deferring buildings until a turn brings them into view', async () => {
    const d = descriptor({ rootSize: 8_192, maxLevel: 6, tileResolution: 9 });
    const turn = (degrees: number) => {
      const r = (degrees * Math.PI) / 180;
      return {
        position: [4_096, 40, 4_096] as [number, number, number],
        verticalFov: 0.7,
        viewportHeight: 600,
        direction: [Math.sin(r), -0.15, -Math.cos(r)] as [number, number, number],
        aspect: 1.5,
      };
    };
    const loads = new Map<string, number>();
    const layered = new Set<string>();
    const watered = new Set<string>();
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address) {
          const key = terrainPyramidTileKey(address);
          loads.set(key, (loads.get(key) ?? 0) + 1);
          return flatTile(d, address);
        },
      },
      {
        initialView: turn(0),
        maxScreenSpaceError: 4,
        viewDistance: 3_000,
        maxSelectedTiles: 256,
        maxResidentTiles: 1_024,
        maxConcurrentLoads: 16,
        maxConcurrentLayerLoads: 16,
        peripheralDegrees: 60,
        layers: [
          {
            id: 'water',
            category: 'hydrology',
            createTile({ address }) {
              watered.add(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
          {
            id: 'human',
            category: 'human-feature',
            createTile({ address }) {
              layered.add(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      const displayed = stream.displayedTiles().map(terrainPyramidTileKey);
      const bare = displayed.filter((key) => !layered.has(key));
      expect(bare.length).toBeGreaterThan(0);
      for (const key of bare) {
        expect(watered.has(key)).toBe(true);
        expect(stream.object.getObjectByName(`layer:water:${key}`)?.visible).toBe(true);
      }
      expect(stream.isAreaReady(4_096, 4_096, 30)).toBe(true);
      stream.update(turn(70));
      await stream.whenIdle();
      const nowLayered = bare.filter((key) => layered.has(key));
      expect(nowLayered.length).toBeGreaterThan(0);
      // The ground was already there: turning did not fetch it again.
      expect(nowLayered.every((key) => loads.get(key) === 1)).toBe(true);
    } finally {
      stream.dispose();
    }
  }, 30_000);

  it('places a shadowed layer published after its tile has rendered', async () => {
    const d = descriptor({ maxLevel: 1 });
    const pending: Array<() => void> = [];
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        shadows: true,
        layers: [
          {
            id: 'human',
            category: 'human-feature',
            minLevel: 1,
            createTile() {
              const tower = new THREE.Mesh(
                new THREE.BoxGeometry(1, 20, 1),
                new THREE.MeshBasicMaterial(),
              );
              tower.position.set(2, 0, 3);
              return new Promise<THREE.Object3D>((resolve) =>
                pending.push(() => resolve(new THREE.Group().add(tower))),
              );
            },
          },
        ],
      },
    );
    try {
      await expect.poll(() => pending.length).toBe(4);
      // A frame renders the tiles before their layers arrive, settling every world matrix.
      stream.object.updateMatrixWorld();
      for (const resolve of pending) resolve();
      await stream.whenIdle();
      stream.object.updateMatrixWorld();
      const tower = (stream.object.getObjectByName('layer:human:1/1/1') as THREE.Group)
        .children[0] as THREE.Mesh;
      const origin = terrainPyramidTileOrigin(d, { level: 1, x: 1, z: 1 });
      expect(tower.castShadow).toBe(true);
      expect(new THREE.Vector3().setFromMatrixPosition(tower.matrixWorld).toArray()).toEqual([
        origin[0] + 2,
        0,
        origin[1] + 3,
      ]);
    } finally {
      stream.dispose();
    }
  });

  it('freezes static tile transforms and leaves marked moving parts alone', async () => {
    const d = descriptor({ maxLevel: 1 });
    // What a renderer preparing each object sees: shaders are built for these flags.
    const prepared = new Map<string, { cast: boolean; receive: boolean }>();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        prepareObject: async (object) => {
          object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh)
              prepared.set(child.uuid, { cast: child.castShadow, receive: child.receiveShadow });
          });
        },
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        shadows: true,
        layers: [
          {
            id: 'human',
            category: 'human-feature',
            minLevel: 1,
            createTile() {
              const building = new THREE.Mesh(
                new THREE.BoxGeometry(1, 20, 1),
                new THREE.MeshBasicMaterial(),
              );
              building.position.set(2, 0, 3);
              const flag = new THREE.Group();
              flag.name = 'flag';
              flag.userData.dynamicTransform = true;
              return new THREE.Group().add(building, flag);
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      expect(stream.object.matrixAutoUpdate).toBe(false);
      const layer = stream.object.getObjectByName('layer:human:1/0/0') as THREE.Group;
      const [building, flag] = layer.children as [THREE.Mesh, THREE.Group];
      expect(layer.matrixAutoUpdate).toBe(false);
      expect(building.matrixAutoUpdate).toBe(false);
      // Frozen with its placement already composed.
      expect(new THREE.Vector3().setFromMatrixPosition(building.matrix).toArray()).toEqual([
        2, 0, 3,
      ]);
      expect(flag.matrixAutoUpdate).toBe(true);
      // Shadows: the tall building casts, everything receives, and an ordinary (unforced)
      // matrix pass still places it inside its tile.
      expect(building.castShadow).toBe(true);
      expect(building.receiveShadow).toBe(true);
      expect(prepared.get(building.uuid)).toEqual({ cast: true, receive: true });
      const tile = stream.object.getObjectByName('tile:1/0/0') as THREE.Group;
      const surface = tile.children.find((child) => (child as THREE.Mesh).isMesh) as THREE.Mesh;
      expect(prepared.get(surface.uuid)?.receive).toBe(true);
      expect(tile.matrixAutoUpdate).toBe(false);
      expect(tile.children.every((child) => !child.matrixAutoUpdate)).toBe(true);
    } finally {
      stream.dispose();
    }
  });

  it('keeps on-screen detail when a new leaf has only a distant ancestor left in the cache', async () => {
    // A small resident cap evicts the intermediate levels. Panning then selects leaves whose only
    // resident ancestor is near the root; standing that ancestor in for one new leaf must not hide
    // every detailed tile beneath it for the whole view.
    const d = descriptor({ rootSize: 256, maxLevel: 4 });
    const view = {
      ...VIEW,
      position: [120, 10, 120] as [number, number, number],
      direction: [0, -0.3, -1] as [number, number, number],
      aspect: 1.4,
    };
    let hold = false;
    const pending: Array<() => void> = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address) {
          if (hold) await new Promise<void>((resolve) => pending.push(resolve));
          return flatTile(d, address);
        },
      },
      {
        initialView: view,
        maxScreenSpaceError: 1,
        viewDistance: 300,
        maxSelectedTiles: 128,
        maxResidentTiles: 256,
        maxConcurrentLoads: 8,
      },
    );
    try {
      await stream.whenIdle();
      const before = stream.displayedTiles().map(terrainPyramidTileKey);
      expect(Math.max(...stream.displayedTiles().map((tile) => tile.level))).toBe(4);
      // Evict everything that is not on screen: the intermediate levels go with the warm cache.
      stream.setBudget({ maxResidentBytes: 1 });
      const shown = new Set(before);
      expect(
        stream
          .residentTiles()
          .filter((tile) => tile.level === 3 && !shown.has(terrainPyramidTileKey(tile))).length,
      ).toBe(0);
      stream.setBudget({ maxResidentBytes: 1 << 30 });
      hold = true;
      stream.update({ ...view, position: [150, 10, 120] });
      const after = new Set(stream.displayedTiles().map(terrainPyramidTileKey));
      const kept = before.filter((key) => after.has(key));
      expect(kept.length).toBeGreaterThan(before.length / 2);
      expect(Math.min(...stream.displayedTiles().map((tile) => tile.level))).toBeGreaterThan(0);
      hold = false;
      for (const finish of pending.splice(0)) finish();
      await stream.whenIdle();
      expect(Math.max(...stream.displayedTiles().map((tile) => tile.level))).toBe(4);
    } finally {
      hold = false;
      for (const finish of pending) finish();
      stream.dispose();
    }
  });

  it('does not pin usable descendants behind a bare ancestor after a layer exhausts retries', async () => {
    const d = descriptor({ maxLevel: 1 });
    let available = false;
    let failedAttempts = 0;
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) => flatTile(d, address),
      },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        maxRetries: 1,
        retryDelayMs: 1,
        layers: [
          {
            id: 'land',
            category: 'classification',
            minLevel: 1,
            createTile: () => new THREE.Group(),
          },
          {
            id: 'human',
            category: 'human-feature',
            minLevel: 1,
            createTile({ address }) {
              if (!available && address.x === 0 && address.z === 0) {
                failedAttempts++;
                throw new Error('unavailable detail');
              }
              return new THREE.Group();
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      expect(failedAttempts).toBe(2);
      expect(stream.stats()).toMatchObject({ failedLayers: 1, retryingLayers: 0 });
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(stream.object.getObjectByName('layer:land:1/0/0')?.visible).toBe(true);
      expect(stream.object.getObjectByName('layer:human:1/1/1')?.visible).toBe(true);
      available = true;
      stream.setLayerVisible('human', false);
      stream.setLayerVisible('human', true);
      await stream.whenIdle();
      expect(stream.stats().failedLayers).toBe(0);
      expect(stream.object.getObjectByName('layer:human:1/0/0')?.visible).toBe(true);
    } finally {
      stream.dispose();
    }
  });
  it.each([
    'throw',
    'stall',
    'preparation',
  ] as const)('recovers Human detail after a %s during descent without a manual reset', async (failure) => {
    const d = descriptor({ maxLevel: 1 });
    const attempts = new Map<string, number>();
    const late: Array<(object: THREE.Object3D) => void> = [];
    const latePreparations: Array<() => void> = [];
    const signals: AbortSignal[] = [];
    const disposed: THREE.Object3D[] = [];
    let preparations = 0;
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) => flatTile(d, address),
      },
      {
        initialView: { ...VIEW, position: [2, 20_000, 2] },
        maxScreenSpaceError: 1,
        viewDistance: 30_000,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        maxResidentTiles: 16,
        layerTimeoutMs: 30,
        retryDelayMs: 1,
        layers: [
          {
            id: 'human',
            category: 'human-feature',
            minLevel: 1,
            createTile({ address, signal }) {
              const key = terrainPyramidTileKey(address);
              const attempt = (attempts.get(key) ?? 0) + 1;
              attempts.set(key, attempt);
              if (attempt === 1 && failure === 'throw') throw new Error('temporary decode failure');
              if (attempt === 1 && failure === 'stall') {
                signals.push(signal);
                return new Promise<THREE.Object3D>((resolve) => late.push(resolve));
              }
              const group = new THREE.Group();
              group.name = `human:${key}`;
              return group;
            },
            disposeTile: (object) => {
              disposed.push(object);
            },
          },
        ],
        prepareObject(object) {
          if (failure === 'preparation' && object.name.startsWith('human:') && preparations++ < 4)
            return new Promise<void>((resolve) => latePreparations.push(resolve));
          return Promise.resolve();
        },
      },
    );
    try {
      await stream.whenIdle();
      expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
      stream.update(VIEW);
      await stream.whenIdle();
      expect([...attempts.values()]).toEqual([2, 2, 2, 2]);
      expect(stream.stats()).toMatchObject({
        loadingLayers: 0,
        failedLayers: 0,
        retryingLayers: 0,
      });
      expect(stream.displayedTiles()).toHaveLength(4);
      for (const address of stream.displayedTiles())
        expect(
          stream.object.getObjectByName(`human:${terrainPyramidTileKey(address)}`)?.visible,
        ).toBe(true);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      for (const resolve of late) resolve(new THREE.Group());
      for (const resolve of latePreparations) resolve();
      await expect.poll(() => disposed.length).toBe(failure === 'throw' ? 0 : 4);
      stream.update({ ...VIEW, position: [2, 20_000, 2] });
      await stream.whenIdle();
      expect(drawn(stream, 'tile:1/0/0')).toBe(false);
      stream.update(VIEW);
      await stream.whenIdle();
      expect(stream.object.getObjectByName('tile:1/0/0')?.visible).toBe(true);
      expect([...attempts.values()]).toEqual([2, 2, 2, 2]);
    } finally {
      stream.dispose();
    }
  });

  it('refines projected sample spacing and honors portable selection budgets', () => {
    const d = descriptor();
    const coarse = selectTerrainPyramidTiles(d, VIEW, {
      maxScreenSpaceError: 10_000,
      viewDistance: 100,
      maxSelectedTiles: 64,
    });
    expect(coarse.tiles).toEqual([{ level: 0, x: 0, z: 0 }]);

    const detailed = selectTerrainPyramidTiles(d, VIEW, {
      maxScreenSpaceError: 1,
      viewDistance: 100,
      maxSelectedTiles: 64,
    });
    expect(detailed.tiles).toHaveLength(16);
    expect(detailed.tiles.every((tile) => tile.level === 2)).toBe(true);

    const economy = terrainPyramidBudgetForQuality('economy');
    const high = terrainPyramidBudgetForQuality('high');
    expect(economy.maxScreenSpaceError).toBeGreaterThan(high.maxScreenSpaceError);
    expect(economy.maxResidentTiles).toBeLessThan(high.maxResidentTiles);
    expect(economy.maxSurfaceTileResolution).toBeLessThan(high.maxSurfaceTileResolution);
  });

  it('caps surface mesh density without reducing source height resolution', async () => {
    const resolution = 257;
    let layerResolution: number | undefined;
    const d = descriptor({ maxLevel: 0, tileResolution: resolution });
    const source: TerrainPyramidHeightSource = {
      async load(): Promise<Heightfield> {
        return new Heightfield(
          new Float32Array(resolution * resolution).fill(0.5),
          resolution,
          resolution,
          {
            origin: [0, 0],
            worldSize: [d.rootSize, d.rootSize],
            height: d.height,
          },
        );
      },
    };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: VIEW,
      maxScreenSpaceError: 10_000,
      viewDistance: 100,
      maxSelectedTiles: 1,
      maxSurfaceTileResolution: 33,
      layers: [
        {
          id: 'ground-overlay',
          category: 'classification',
          visible: true,
          createTile(context) {
            layerResolution = context.surfaceResolution;
            return new THREE.Group();
          },
        },
      ],
      maxConcurrentLoads: 1,
      maxResidentTiles: 2,
    });
    await stream.whenIdle();

    expect(stream.stats().decodedSamples).toBe(resolution * resolution);
    expect(stream.stats().triangles).toBe(2_304);
    expect(layerResolution).toBe(33);
    stream.dispose();
  });

  it('retains nearby source detail at small device resolutions while coarsening the distance', () => {
    const d = descriptor({
      rootSize: 2 ** 25,
      origin: [-(2 ** 24), -(2 ** 24)],
      minLevel: 8,
      maxLevel: 15,
      tileResolution: 257,
      height: { min: -100, max: 9_000 },
    });
    for (const viewportHeight of [350, 450, 720]) {
      const selection = selectTerrainPyramidTiles(
        d,
        {
          position: [512, 101.7, 512],
          verticalFov: Math.PI / 3,
          viewportHeight,
          direction: [0, 0, -1],
          aspect: 16 / 9,
        },
        {
          maxScreenSpaceError: 10,
          viewDistance: 12_000,
          maxSelectedTiles: 16,
        },
      );
      const containing = selection.tiles.find((tile) => {
        const origin = terrainPyramidTileOrigin(d, tile);
        const size = terrainPyramidTileSize(d, tile.level);
        return (
          origin[0] <= 512 && origin[1] <= 512 && origin[0] + size > 512 && origin[1] + size > 512
        );
      });
      expect(containing?.level).toBe(15);
      expect(selection.tiles.length).toBeLessThanOrEqual(16);
      expect(selection.tiles.some((tile) => tile.level < 15)).toBe(true);
      expect(selection.effectiveViewDistance).toBe(12_000);
      expect(selection.effectiveScreenSpaceError).toBeLessThan(500);
    }
  });

  it('uses the camera cone without sacrificing coarse coverage at altitude', () => {
    const d = descriptor({ rootSize: 1_024, maxLevel: 6, tileResolution: 33 });
    const radial = selectTerrainPyramidTiles(
      d,
      { position: [512, 180, 512], verticalFov: Math.PI / 3, viewportHeight: 900 },
      { maxScreenSpaceError: 3, viewDistance: 600, maxSelectedTiles: 1_024 },
    );
    const directed = selectTerrainPyramidTiles(
      d,
      {
        position: [512, 180, 512],
        direction: [0, -0.3, -1],
        aspect: 16 / 9,
        verticalFov: Math.PI / 3,
        viewportHeight: 900,
      },
      { maxScreenSpaceError: 3, viewDistance: 600, maxSelectedTiles: 1_024 },
    );
    expect(directed.tiles.length).toBeLessThan(radial.tiles.length);
    expect(directed.effectiveViewDistance).toBe(600);
    const minCoveredZ = Math.min(
      ...directed.tiles.map((tile) => tile.z * terrainPyramidTileSize(d, tile.level)),
    );
    expect(minCoveredZ).toBeLessThan(128);
  });

  it('loads parents first and swaps to children only when selected coverage is complete', async () => {
    const d = descriptor({ maxLevel: 1 });
    const calls: string[] = [];
    const childResolvers: Array<() => void> = [];
    const source: TerrainPyramidHeightSource = {
      async load(address): Promise<Heightfield> {
        calls.push(terrainPyramidTileKey(address));
        if (address.level > 0) {
          await new Promise<void>((resolve) => childResolvers.push(resolve));
        }
        return flatTile(d, address);
      },
    };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: VIEW,
      maxScreenSpaceError: 1,
      viewDistance: 100,
      maxSelectedTiles: 8,
      maxConcurrentLoads: 1,
      maxResidentTiles: 16,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls[0]).toBe('0/0/0');
    expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);

    childResolvers.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);

    while (stream.stats().queued > 0 || stream.stats().loading > 0) {
      childResolvers.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await stream.whenIdle();
    expect(stream.displayedTiles()).toEqual([
      { level: 1, x: 0, z: 0 },
      { level: 1, x: 1, z: 0 },
      { level: 1, x: 0, z: 1 },
      { level: 1, x: 1, z: 1 },
    ]);
    expect(stream.stats()).toMatchObject({ selected: 4, displayed: 4, fallbackLeaves: 0 });
    expect(stream.sampleHeight(1, 1)).toBeCloseTo(25);
    stream.dispose();
  });

  it('keeps the parent surface and detail until every replacement child layer settles', async () => {
    const d = descriptor({ maxLevel: 1 });
    const childResolvers = new Map<string, (object: THREE.Object3D | undefined) => void>();
    const layer: TerrainPyramidTileLayer = {
      id: 'details',
      createTile({ address }) {
        if (address.level === 0) return new THREE.Group();
        return new Promise<THREE.Object3D | undefined>((resolve) => {
          childResolvers.set(terrainPyramidTileKey(address), resolve);
        });
      },
      category: 'human-feature',
    };
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        layers: [layer],
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        maxResidentTiles: 16,
        maxResidentBytes: 1,
      },
    );

    await expect.poll(() => childResolvers.size).toBe(4);
    expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
    const parent = stream.object.getObjectByName('layer:details:0/0/0');
    expect(parent?.visible).toBe(true);
    expect(stream.residentTiles()).toContainEqual(expect.objectContaining({ level: 0 }));
    expect(stream.pressure().overBudget).toBe(true);

    const pendingChildren = [...childResolvers.entries()];
    for (const [index, [, resolve]] of pendingChildren.slice(0, -1).entries()) {
      resolve(index === 0 ? undefined : new THREE.Group());
      await new Promise((settled) => setTimeout(settled, 0));
      expect(parent?.visible).toBe(true);
    }
    pendingChildren.at(-1)?.[1](new THREE.Group());
    await stream.whenIdle();

    expect(parent?.visible).toBe(false);
    expect(stream.displayedTiles()).toHaveLength(4);
    expect(
      pendingChildren
        .filter(([, resolve]) => resolve !== pendingChildren[0]?.[1])
        .every(([key]) => stream.object.getObjectByName(`layer:details:${key}`)?.visible === true),
    ).toBe(true);
    stream.dispose();
  });

  it('stages all layers and GPU preparation before a whole-tile swap, then reuses warm LODs', async () => {
    const d = descriptor({ maxLevel: 1 });
    const buildings = new Map<string, (object: THREE.Object3D | undefined) => void>();
    const creates: string[] = [];
    let finishPreparation: (() => void) | undefined;
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 5, // Four held building jobs plus the landcover lane.,
        maxResidentTiles: 16,
        layers: [
          {
            id: 'landuse',
            category: 'classification',
            createTile({ address }) {
              creates.push(`landuse:${terrainPyramidTileKey(address)}`);
              return new THREE.Group();
            },
          },
          {
            id: 'buildings',
            category: 'human-feature',
            createTile({ address }) {
              const key = terrainPyramidTileKey(address);
              creates.push(`buildings:${key}`);
              if (address.level === 0) return new THREE.Group();
              return new Promise<THREE.Object3D | undefined>((resolve) =>
                buildings.set(key, resolve),
              );
            },
          },
        ],
        async prepareObject(object) {
          if (object.name === 'last-building') {
            await new Promise<void>((resolve) => {
              finishPreparation = resolve;
            });
          }
        },
      },
    );
    try {
      await stream.whenIdle();
      const parent = [{ level: 0, x: 0, z: 0 }];
      expect(stream.displayedTiles()).toEqual(parent);
      stream.setBudget({ maxScreenSpaceError: 1 });
      await expect.poll(() => buildings.size).toBe(4);
      const assertParent = (): void => {
        expect(stream.displayedTiles()).toEqual(parent);
        expect(stream.sampleHeight(2, 2)).toBe(0);
        expect(stream.object.getObjectByName('layer:landuse:0/0/0')?.visible).toBe(true);
        expect(stream.object.getObjectByName('layer:buildings:0/0/0')?.visible).toBe(true);
        expect(drawn(stream, 'layer:landuse:1/0/0')).toBe(false);
      };
      assertParent();
      const resolvers = [...buildings.values()];
      resolvers[0]?.(undefined); // A legitimately empty child must still complete the cut.
      resolvers[1]?.(new THREE.Group());
      resolvers[2]?.(new THREE.Group());
      const last = new THREE.Group();
      last.name = 'last-building';
      resolvers[3]?.(last);
      await expect.poll(() => finishPreparation !== undefined).toBe(true);
      assertParent();
      finishPreparation?.();
      await stream.whenIdle();
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(stream.sampleHeight(2, 2)).toBe(25);
      expect(drawn(stream, 'layer:landuse:0/0/0')).toBe(false);
      const child = stream.object.getObjectByName('layer:landuse:1/0/0');
      expect(child?.visible).toBe(true);
      expect(last.visible).toBe(true);
      expect(creates).toHaveLength(10);
      for (let round = 0; round < 3; round++) {
        stream.setBudget({ maxScreenSpaceError: 10_000 });
        expect(stream.displayedTiles()).toEqual(parent);
        stream.setBudget({ maxScreenSpaceError: 1 });
        await stream.whenIdle();
        expect(stream.displayedTiles()).toHaveLength(4);
        expect(stream.object.getObjectByName('layer:landuse:1/0/0')).toBe(child);
        expect(child?.visible).toBe(true);
        expect(creates).toHaveLength(10);
      }
    } finally {
      finishPreparation?.();
      stream.dispose();
    }
  });

  it('retains complete children while a coarser replacement fails and retries above the resident cap', async () => {
    const d = descriptor({ maxLevel: 1 });
    let parentAvailable = false;
    let finishParent: ((object: THREE.Object3D) => void) | undefined;
    let failParent: ((error: Error) => void) | undefined;
    let attempts = 0;
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) =>
          address.level === 0 && !parentAvailable ? undefined : flatTile(d, address),
      },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 2,
        maxResidentTiles: 16,
        maxRetries: 0,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address }) {
              if (address.level === 1) return new THREE.Group();
              attempts++;
              return new Promise<THREE.Object3D>((resolve, reject) => {
                finishParent = resolve;
                failParent = reject;
              });
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      expect(stream.displayedTiles()).toHaveLength(4);
      parentAvailable = true;
      stream.setBudget({ maxScreenSpaceError: 10_000, maxSelectedTiles: 1, maxResidentTiles: 2 });
      stream.retryFailed();
      await expect.poll(() => attempts).toBe(1);
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(stream.sampleHeight(2, 2)).toBe(25);
      failParent?.(new Error('temporary layer failure'));
      await stream.whenIdle();
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(stream.object.getObjectByName('layer:detail:1/0/0')?.visible).toBe(true);
      stream.retryFailed();
      await expect.poll(() => attempts).toBe(2);
      expect(stream.displayedTiles()).toHaveLength(4);
      finishParent?.(new THREE.Group());
      await stream.whenIdle();
      expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
      expect(stream.object.getObjectByName('layer:detail:0/0/0')?.visible).toBe(true);
      expect(stream.residentTiles().length).toBeLessThanOrEqual(2);
    } finally {
      stream.dispose();
    }
  });

  it('does not expose partial cold layers, but publishes usable detail after a layer failure', async () => {
    const d = descriptor({ maxLevel: 0 });
    let failBuildings: ((error: Error) => void) | undefined;
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 1,
        maxConcurrentLoads: 1,
        maxConcurrentLayerLoads: 2,
        maxResidentTiles: 2,
        maxRetries: 0,
        layers: [
          { id: 'landuse', category: 'classification', createTile: () => new THREE.Group() },
          {
            id: 'buildings',
            category: 'human-feature',
            createTile: () =>
              new Promise<THREE.Object3D>((_, reject) => {
                failBuildings = reject;
              }),
          },
        ],
      },
    );
    try {
      await expect.poll(() => stream.stats().layerObjects).toBe(1);
      expect(stream.displayedTiles()).toHaveLength(1);
      expect(drawn(stream, 'layer:landuse:0/0/0')).toBe(false);
      failBuildings?.(new Error('unavailable buildings'));
      await stream.whenIdle();
      expect(stream.object.getObjectByName('layer:landuse:0/0/0')?.visible).toBe(true);
    } finally {
      stream.dispose();
    }
  });

  it('publishes staged layers when an unfinished layer is hidden and discards late results', async () => {
    const d = descriptor({ maxLevel: 1 });
    const pending: Array<{ resolve: (object: THREE.Object3D) => void; signal: AbortSignal }> = [];
    let disposed = 0;
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 5, // Four held building jobs plus the landcover lane.,
        maxResidentTiles: 16,
        layers: [
          {
            id: 'landuse',
            category: 'classification',
            minLevel: 1,
            createTile: () => new THREE.Group(),
          },
          {
            id: 'buildings',
            category: 'human-feature',
            minLevel: 1,
            createTile({ signal }) {
              return new Promise<THREE.Object3D>((resolve) => pending.push({ resolve, signal }));
            },
            disposeTile() {
              disposed++;
            },
          },
        ],
      },
    );
    try {
      await expect.poll(() => pending.length).toBe(4);
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(drawn(stream, 'layer:landuse:1/0/0')).toBe(false);
      stream.setLayerVisible('buildings', false);
      await stream.whenIdle();
      expect(stream.displayedTiles()).toHaveLength(4);
      expect(stream.object.getObjectByName('layer:landuse:1/0/0')?.visible).toBe(true);
      expect(pending.every(({ signal }) => signal.aborted)).toBe(true);
      for (const { resolve } of pending) resolve(new THREE.Group());
      await expect.poll(() => disposed).toBe(4);
      expect(stream.stats().layerObjects).toBe(4);
    } finally {
      stream.dispose();
    }
  });

  it('prepares intermediate fallback layers when a selected descendant is missing', async () => {
    const d = descriptor();
    const prepared: string[] = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) =>
          address.level === 2 && address.x === 0 && address.z === 0
            ? undefined
            : flatTile(d, address),
      },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 1,
        maxResidentTiles: 32,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            minLevel: 1,
            async createTile({ address }) {
              await new Promise((resolve) => setTimeout(resolve, 0));
              prepared.push(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      expect(prepared).toContain('1/0/0');
      expect(stream.displayedTiles()).toContainEqual({ level: 1, x: 0, z: 0 });
      expect(stream.displayedTiles()).not.toContainEqual({ level: 0, x: 0, z: 0 });
      expect(stream.object.getObjectByName('layer:detail:1/0/0')?.visible).toBe(true);
    } finally {
      stream.dispose();
    }
  });

  it('joins adjacent same-level tile normals across their shared border', async () => {
    const d = descriptor({ maxLevel: 1, tileResolution: 5 });
    // A smooth analytic surface, sampled by each tile over its own inclusive bounds.
    const surface = (x: number, z: number): number =>
      0.5 + 0.2 * Math.sin(x / 3) * Math.cos(z / 5) + 0.1 * Math.sin((x + z) / 2);
    const analyticTile = (address: TerrainPyramidTileAddress): Heightfield => {
      const origin = terrainPyramidTileOrigin(d, address);
      const size = terrainPyramidTileSize(d, address.level);
      const res = d.tileResolution;
      const cell = size / (res - 1);
      const grid = new Float32Array(res * res);
      for (let r = 0; r < res; r++) {
        for (let c = 0; c < res; c++) {
          grid[r * res + c] = surface(origin[0] + c * cell, origin[1] + r * cell);
        }
      }
      return new Heightfield(grid, res, res, {
        origin,
        worldSize: [size, size],
        height: d.height,
      });
    };
    const source: TerrainPyramidHeightSource = {
      async load(address): Promise<Heightfield> {
        return analyticTile(address);
      },
    };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: VIEW,
      maxScreenSpaceError: 1,
      viewDistance: 100,
      maxSelectedTiles: 8,
      maxConcurrentLoads: 4,
      maxResidentTiles: 16,
    });
    await stream.whenIdle();

    const normalsOf = (key: string): Float32Array => {
      const mesh = stream.object.getObjectByName(`surface:${key}`) as THREE.Mesh;
      return mesh.geometry.getAttribute('normal').array as Float32Array;
    };
    const west = normalsOf('1/0/0');
    const east = normalsOf('1/1/0');
    const res = d.tileResolution;
    for (let r = 0; r < res; r++) {
      const a = (r * res + res - 1) * 3;
      const b = (r * res + 0) * 3;
      expect(west[a]).toBe(east[b]);
      expect(west[a + 1]).toBe(east[b + 1]);
      expect(west[a + 2]).toBe(east[b + 2]);
    }
    stream.dispose();
  });

  it('retries a transient child failure and leaves a 404 alone', async () => {
    const d = descriptor({ maxLevel: 1 });
    const attempts = new Map<string, number>();
    const source: TerrainPyramidHeightSource = {
      async load(address): Promise<Heightfield | undefined> {
        const key = terrainPyramidTileKey(address);
        const count = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, count);
        // 1/0/0 is a dropped request that recovers; 1/1/1 genuinely does not exist.
        if (key === '1/0/0' && count === 1) throw new Error('HTTP 503');
        if (key === '1/1/1') return undefined;
        return flatTile(d, address);
      },
    };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: VIEW,
      maxScreenSpaceError: 1,
      viewDistance: 100,
      maxSelectedTiles: 8,
      maxConcurrentLoads: 4,
      maxResidentTiles: 16,
      retryDelayMs: 1,
    });
    await stream.whenIdle();
    expect(attempts.get('1/0/0')).toBe(2);
    expect(attempts.get('1/1/1')).toBe(1);
    expect(stream.residentTiles()).toContainEqual({ level: 1, x: 0, z: 0 });
    expect(stream.failedTiles()).toEqual([{ level: 1, x: 1, z: 1 }]);
    expect(stream.tileFailures()).toEqual([
      { address: { level: 1, x: 1, z: 1 }, state: 'missing', attempts: 0 },
    ]);
    expect(stream.stats()).toMatchObject({ missing: 1, retrying: 0, failed: 1 });
    stream.dispose();
  });

  it('tries an abandoned tile again after its cool-down, so an outage leaves no hole', async () => {
    const d = descriptor({ maxLevel: 1 });
    let now = 1_000_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    let outage = true;
    let attempts = 0;
    const source: TerrainPyramidHeightSource = {
      async load(address): Promise<Heightfield | undefined> {
        if (terrainPyramidTileKey(address) !== '1/0/0') return flatTile(d, address);
        attempts++;
        // A dropped connection that outlasts the quick retries.
        if (outage) throw new TypeError('Failed to fetch');
        return flatTile(d, address);
      },
    };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: VIEW,
      maxScreenSpaceError: 1,
      viewDistance: 100,
      maxSelectedTiles: 8,
      maxConcurrentLoads: 4,
      maxResidentTiles: 16,
      maxRetries: 1,
      retryDelayMs: 1,
      failedRetryDelayMs: 10_000,
    });
    try {
      await stream.whenIdle();
      expect(attempts).toBe(2);
      expect(stream.tileFailures()).toMatchObject([
        { address: { level: 1, x: 0, z: 0 }, state: 'failed', nextAttemptAt: now + 10_000 },
      ]);
      // Cooling down: replans leave the source alone.
      now += 9_999;
      stream.update(VIEW);
      await stream.whenIdle();
      expect(attempts).toBe(2);
      // The first replan after the cool-down tries again; a further failure waits twice as long.
      now += 1;
      stream.update(VIEW);
      await stream.whenIdle();
      expect(attempts).toBe(3);
      expect(stream.tileFailures()[0]?.nextAttemptAt).toBe(now + 20_000);
      outage = false;
      now += 10_000;
      stream.update(VIEW);
      await stream.whenIdle();
      expect(attempts).toBe(3);
      now += 10_000;
      stream.update(VIEW);
      await stream.whenIdle();
      expect(attempts).toBe(4);
      expect(stream.residentTiles()).toContainEqual({ level: 1, x: 0, z: 0 });
      expect(stream.tileFailures()).toEqual([]);
    } finally {
      stream.dispose();
      clock.mockRestore();
    }
  });

  it('fills in water whose layer failed once the cool-down passes', async () => {
    const d = descriptor({ maxLevel: 1 });
    let now = 1_000_000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    let outage = true;
    let attempts = 0;
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        maxRetries: 0,
        failedRetryDelayMs: 10_000,
        layers: [
          {
            id: 'water',
            category: 'hydrology',
            minLevel: 1,
            createTile({ address }) {
              if (address.x !== 0 || address.z !== 0) return new THREE.Group();
              attempts++;
              if (outage) throw new TypeError('Failed to fetch');
              return new THREE.Group();
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      expect(attempts).toBe(1);
      expect(stream.stats()).toMatchObject({ failedLayers: 1, retryingLayers: 0 });
      expect(stream.object.getObjectByName('layer:water:1/0/0')).toBeUndefined();
      outage = false;
      now += 10_000;
      stream.update(VIEW);
      await stream.whenIdle();
      expect(attempts).toBe(2);
      expect(stream.stats().failedLayers).toBe(0);
      expect(stream.object.getObjectByName('layer:water:1/0/0')?.visible).toBe(true);
    } finally {
      stream.dispose();
      clock.mockRestore();
    }
  });

  it('retains the resident parent when one selected child fails', async () => {
    const d = descriptor({ maxLevel: 1 });
    const source: TerrainPyramidHeightSource = {
      async load(address): Promise<Heightfield | undefined> {
        if (terrainPyramidTileKey(address) === '1/1/1') return undefined;
        return flatTile(d, address);
      },
    };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: VIEW,
      maxScreenSpaceError: 1,
      viewDistance: 100,
      maxSelectedTiles: 8,
      maxConcurrentLoads: 4,
      maxResidentTiles: 16,
    });
    await stream.whenIdle();
    expect(stream.failedTiles()).toEqual([{ level: 1, x: 1, z: 1 }]);
    expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
    expect(stream.stats().fallbackLeaves).toBe(1);
    stream.dispose();
  });

  it('keeps radial coarse coverage resident while a mouse turn selects disjoint detail', async () => {
    const d = descriptor({ rootSize: 1_024, minLevel: 1, maxLevel: 3, tileResolution: 33 });
    const eastView = {
      position: [512, 100, -200] as [number, number, number],
      verticalFov: 0.45,
      viewportHeight: 900,
      direction: [1, -0.1, 1] as [number, number, number],
      aspect: 1,
    };
    const westView = {
      ...eastView,
      direction: [-1, -0.1, 1] as [number, number, number],
    };
    const selectionOptions = {
      maxScreenSpaceError: 1,
      viewDistance: 2_000,
      maxSelectedTiles: 64,
    };
    const eastKeys = new Set(
      selectTerrainPyramidTiles(d, eastView, selectionOptions).tiles.map(terrainPyramidTileKey),
    );
    const westKeys = selectTerrainPyramidTiles(d, westView, selectionOptions).tiles.map(
      terrainPyramidTileKey,
    );
    expect(westKeys.some((key) => eastKeys.has(key))).toBe(false);

    const source: TerrainPyramidHeightSource = {
      async load(address): Promise<Heightfield> {
        return flatTile(d, address);
      },
    };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: eastView,
      ...selectionOptions,
      maxConcurrentLoads: 8,
      maxResidentTiles: 128,
    });
    await stream.whenIdle();
    expect(stream.residentTiles().filter((tile) => tile.level === 1)).toHaveLength(4);

    stream.update(westView);
    const turningStats = stream.stats();
    expect(turningStats.fallbackLeaves).toBeGreaterThan(0);
    expect(turningStats.displayed).toBeGreaterThan(0);
    expect(turningStats.minDisplayedLevel).toBe(1);
    stream.dispose();
  });

  it('loads level-bounded semantic layers only for displayed adaptive tiles', async () => {
    const d = descriptor({ maxLevel: 1 });
    let creates = 0;
    let disposes = 0;
    const layer: TerrainPyramidTileLayer = {
      id: 'forest',
      category: 'classification',
      visible: false,
      minLevel: 1,
      createTile() {
        creates++;
        return new THREE.Group();
      },
      disposeTile() {
        disposes++;
      },
    };
    const source: TerrainPyramidHeightSource = {
      async load(address): Promise<Heightfield> {
        return flatTile(d, address);
      },
    };
    const stream = createTerrainPyramidStream(d, source, {
      initialView: VIEW,
      layers: [layer],
      maxScreenSpaceError: 1,
      viewDistance: 100,
      maxSelectedTiles: 8,
      maxConcurrentLoads: 4,
      maxResidentTiles: 16,
    });
    await stream.whenIdle();
    expect(creates).toBe(0);

    stream.setLayerVisible('forest', true);
    await stream.whenIdle();
    expect(creates).toBe(4);
    expect(stream.stats().layerObjects).toBe(4);
    expect(stream.object.getObjectByName('layer:forest:1/0/0')?.visible).toBe(true);
    stream.setLayerVisible('forest', false);
    expect(drawn(stream, 'layer:forest:1/0/0')).toBe(false);
    stream.dispose();
    expect(disposes).toBe(4);
  });

  it('finishes semantic loads when a wanted ancestor is temporarily hidden', async () => {
    const d = descriptor({ maxLevel: 1 });
    let resolveLayer: ((object: THREE.Object3D) => void) | undefined;
    let layerSignal: AbortSignal | undefined;
    const layer: TerrainPyramidTileLayer = {
      id: 'roads',
      category: 'human-feature',
      maxLevel: 0,
      createTile(context) {
        layerSignal = context.signal;
        return new Promise<THREE.Object3D>((resolve) => {
          resolveLayer = resolve;
        });
      },
    };
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        layers: [layer],
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 1,
        maxConcurrentLayerLoads: 1,
        maxResidentTiles: 16,
      },
    );
    while (resolveLayer === undefined) await new Promise((resolve) => setTimeout(resolve, 0));
    while (stream.displayedTiles().some((tile) => tile.level === 0)) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(layerSignal?.aborted).toBe(false);
    resolveLayer(new THREE.Group());
    await stream.whenIdle();

    expect(stream.stats().layerObjects).toBe(1);
    expect(drawn(stream, 'layer:roads:0/0/0')).toBe(false);
    stream.dispose();
  });

  it('prepares selected detail before a slow sibling allows the terrain handoff', async () => {
    const d = descriptor({ maxLevel: 1 });
    let finishTerrain: (() => void) | undefined;
    const prepared: string[] = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) => {
          if (address.level === 1 && address.x === 1 && address.z === 1) {
            await new Promise<void>((resolve) => {
              finishTerrain = resolve;
            });
          }
          return flatTile(d, address);
        },
      },
      {
        initialView: VIEW,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            minLevel: 1,
            createTile({ address }) {
              prepared.push(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
        ],
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 1,
        maxResidentTiles: 16,
      },
    );
    try {
      await expect.poll(() => prepared.length).toBe(3);
      expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
      expect(drawn(stream, 'layer:detail:1/0/0')).toBe(false);
      finishTerrain?.();
      await stream.whenIdle();
      expect(prepared).toHaveLength(4);
      expect(stream.object.getObjectByName('layer:detail:1/0/0')?.visible).toBe(true);
    } finally {
      finishTerrain?.();
      stream.dispose();
    }
  });

  it('loads forward terrain and detail before nearer tiles in the turn guard band', async () => {
    const d = descriptor({ rootSize: 32, minLevel: 3, maxLevel: 3 });
    const heights: string[] = [];
    const layers: string[] = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address) {
          heights.push(terrainPyramidTileKey(address));
          return flatTile(d, address);
        },
      },
      {
        initialView: {
          position: [16.1, 10, 12.1],
          direction: [0, 0, 1],
          aspect: 1,
          verticalFov: Math.PI / 3,
          viewportHeight: 1_000,
        },
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            visible: false,
            createTile({ address }) {
              layers.push(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
        ],
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 64,
        maxConcurrentLoads: 1,
        maxConcurrentLayerLoads: 1,
        maxResidentTiles: 128,
      },
    );
    try {
      await stream.whenIdle();
      // The camera sits 0.1 units from 3/4/2, behind it in the turn margin; 3/4/4 is
      // 3.9 units ahead. Both are selected, but forward coverage must win in both queues.
      stream.setLayerVisible('detail', true);
      await stream.whenIdle();
      for (const requests of [heights, layers]) {
        expect(requests[0]).toBe('3/4/3');
        expect(requests).toContain('3/4/2');
        expect(requests.indexOf('3/4/4')).toBeLessThan(requests.indexOf('3/4/2'));
      }
    } finally {
      stream.dispose();
    }
  });

  it.each([
    1, 4,
  ])('shows water across the view before slow detail with %i layer slots', async (slots) => {
    const d = descriptor({ minLevel: 1, maxLevel: 1 });
    const pending: Array<() => void> = [];
    let hold = true;
    const waterLoads: string[] = [];
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: slots,
        maxResidentTiles: 16,
        layers: [
          // Deliberately first: layer declaration order must not starve lake coverage.
          ...(['classification', 'human-feature'] as const).map((category) => ({
            id: category,
            category,
            async createTile() {
              if (hold) await new Promise<void>((resolve) => pending.push(resolve));
              return new THREE.Group();
            },
          })),
          {
            id: 'water',
            category: 'hydrology',
            createTile({ address }) {
              waterLoads.push(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
        ],
      },
    );
    try {
      await vi.waitFor(() => {
        expect(waterLoads).toHaveLength(4);
        for (const key of waterLoads)
          expect(stream.object.getObjectByName(`layer:water:${key}`)?.visible).toBe(true);
      });
      expect(stream.isAreaReady(2, 2, 1)).toBe(false);
      hold = false;
      for (const finish of pending) finish();
      await stream.whenIdle();
      expect(stream.isAreaReady(2, 2, 1)).toBe(true);
      stream.setLayerVisible('water', false);
      expect(
        waterLoads.every((key) => !stream.object.getObjectByName(`layer:water:${key}`)?.visible),
      ).toBe(true);
      stream.setLayerVisible('water', true);
      await stream.whenIdle();
      expect(waterLoads).toHaveLength(4);
    } finally {
      stream.dispose();
      hold = false;
      for (const finish of pending) finish();
    }
  });

  it('remembers empty hydrology tiles so they cannot starve farther water', async () => {
    const d = descriptor({ maxLevel: 1 });
    const loaded: string[] = [];
    const layer: TerrainPyramidTileLayer = {
      id: 'water',
      category: 'hydrology',
      minLevel: 1,
      async createTile({ address }) {
        loaded.push(terrainPyramidTileKey(address));
        return address.x === 1 && address.z === 1 ? new THREE.Group() : undefined;
      },
    };
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        layers: [layer],
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 1,
        maxResidentTiles: 16,
      },
    );
    try {
      await stream.whenIdle();
      expect(loaded).toHaveLength(4);
      expect(new Set(loaded).size).toBe(4);
      expect(stream.stats().loadingLayers).toBe(0);
      expect(stream.stats().layerObjects).toBe(1);
      expect(stream.object.getObjectByName('layer:water:1/1/1')?.visible).toBe(true);

      stream.update(VIEW);
      stream.setLayerVisible('water', false);
      stream.setLayerVisible('water', true);
      await stream.whenIdle();
      expect(loaded).toHaveLength(4);
    } finally {
      stream.dispose();
    }
  });

  it('keeps parent water until all child shorelines are ready without waiting for new buildings', async () => {
    const d = descriptor({ maxLevel: 1 });
    const pending = new Map<string, () => void>();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10000,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 8,
        layers: [
          {
            id: 'water',
            category: 'hydrology',
            async createTile({ address }) {
              if (address.level === 1)
                await new Promise<void>((resolve) =>
                  pending.set(terrainPyramidTileKey(address), resolve),
                );
              return new THREE.Group();
            },
          },
          {
            id: 'buildings',
            category: 'human-feature',
            minLevel: 1,
            createTile: () => new Promise<THREE.Object3D>(() => {}),
          },
        ],
      },
    );
    const visibleWater = () => {
      const names: string[] = [];
      stream.object.traverseVisible((object) => {
        if (object.name.startsWith('layer:water:')) names.push(object.name);
      });
      return names.sort();
    };
    try {
      await stream.whenIdle();
      expect(visibleWater()).toEqual(['layer:water:0/0/0']);
      stream.setBudget({ maxScreenSpaceError: 1 });
      await vi.waitFor(() => expect(pending.size).toBe(4));
      const finishes = [...pending.values()];
      for (const finish of finishes.slice(0, 3)) finish();
      await vi.waitFor(() => expect(stream.stats().layerObjects).toBe(4));
      expect(visibleWater()).toEqual(['layer:water:0/0/0']);
      finishes[3]?.();
      await vi.waitFor(() =>
        expect(visibleWater()).toEqual([
          'layer:water:1/0/0',
          'layer:water:1/0/1',
          'layer:water:1/1/0',
          'layer:water:1/1/1',
        ]),
      );
      expect(stream.isAreaReady(2, 2, 1)).toBe(false);
    } finally {
      stream.dispose();
      for (const finish of pending.values()) finish();
    }
  });

  it('bounds concurrent semantic work and drains the visible queue', async () => {
    const d = descriptor({ maxLevel: 1 });
    const resolvers: Array<(object: THREE.Object3D) => void> = [];
    let creates = 0;
    const layer: TerrainPyramidTileLayer = {
      id: 'features',
      category: 'human-feature',
      minLevel: 1,
      createTile() {
        creates++;
        return new Promise<THREE.Object3D>((resolve) => resolvers.push(resolve));
      },
    };
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        layers: [layer],
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 8,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 2,
        maxResidentTiles: 16,
      },
    );
    while (creates < 2) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stream.stats().loadingLayers).toBe(2);
    expect(creates).toBe(2);

    resolvers.shift()?.(new THREE.Group());
    while (creates < 3) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stream.stats().loadingLayers).toBe(2);
    while (resolvers.length > 0) {
      resolvers.shift()?.(new THREE.Group());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await stream.whenIdle();
    expect(stream.stats().layerObjects).toBe(4);
    stream.dispose();
  });
});

it('does not reload covered ancestors after the cache evicts them', async () => {
  // A small package deep in a large pyramid needs a long ancestor chain to reach its leaves.
  const d = descriptor({
    rootSize: 1_000_000,
    minLevel: 0,
    maxLevel: 15,
    tileResolution: 257,
    coverage: [500, 500, 530, 530],
  });
  let loads = 0;
  const stream = createTerrainPyramidStream(
    d,
    {
      async load(address) {
        loads++;
        return flatTile(d, address);
      },
    },
    {
      maxScreenSpaceError: 1,
      viewDistance: 1000,
      maxSelectedTiles: 4,
      maxResidentTiles: 8,
      maxConcurrentLoads: 4,
      maxSurfaceTileResolution: 3,
    },
  );
  const view = {
    position: [500, 20, 500] as [number, number, number],
    direction: [1, 0, 0] as [number, number, number],
    aspect: 1.7,
    verticalFov: 1,
    viewportHeight: 720,
  };
  stream.update(view);
  await stream.whenIdle();
  expect(stream.stats().evictions).toBeGreaterThan(0);
  expect(stream.stats().fallbackLeaves).toBe(0);
  const loaded = loads;
  const evictions = stream.stats().evictions;
  for (let frame = 0; frame < 4; frame++) {
    stream.update(view);
    await stream.whenIdle();
  }
  expect(loads).toBe(loaded);
  expect(stream.stats().evictions).toBe(evictions);
  expect(stream.displayedTiles()).toHaveLength(4);
  stream.dispose();
});

describe('runtime terrain budgets', () => {
  it('coarsens and releases cache in place while preserving covered ground', async () => {
    const d = descriptor({ maxLevel: 2 });
    let loads = 0;
    const options = {
      initialView: VIEW,
      maxScreenSpaceError: 1,
      viewDistance: 100,
      maxSelectedTiles: 16,
      maxResidentTiles: 32,
      maxConcurrentLoads: 4,
    };
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address) {
          loads++;
          return flatTile(d, address);
        },
      },
      options,
    );
    await stream.whenIdle();
    expect(stream.displayedTiles()).toHaveLength(16);
    const originalObject = stream.object;
    const previousLoads = loads;

    stream.setBudget({ maxScreenSpaceError: 10_000, maxSelectedTiles: 1, maxResidentTiles: 2 });
    expect(stream.object).toBe(originalObject);
    expect(stream.sampleHeight(2, 2)).toBeDefined();
    await stream.whenIdle();
    expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
    expect(stream.residentTiles().length).toBeLessThanOrEqual(2);
    expect(loads).toBe(previousLoads);
    expect(options.maxSelectedTiles).toBe(16);

    // Snapshots and rejected patches cannot mutate an active stream.
    const snapshot = stream.getBudget();
    snapshot.maxSelectedTiles = 99;
    expect(stream.getBudget().maxSelectedTiles).toBe(1);
    expect(() => stream.setBudget({ maxSelectedTiles: 2 })).toThrow('parent-safe refinement');
    expect(() => stream.setBudget({ maxResidentBytes: Number.NaN })).toThrow('maxResidentBytes');
    expect(stream.getBudget().maxSelectedTiles).toBe(1);
    stream.setBudget({ maxScreenSpaceError: 1, maxSelectedTiles: 16, maxResidentTiles: 32 });
    await stream.whenIdle();
    expect(stream.displayedTiles()).toHaveLength(16);
    expect(stream.stats().fallbackLeaves).toBe(0);
    stream.dispose();
  });

  it('keeps nearby semantic detail loading after entering the minimum device tier', async () => {
    const d = descriptor({
      rootSize: 2 ** 25,
      origin: [-(2 ** 24), -(2 ** 24)],
      minLevel: 8,
      maxLevel: 15,
      tileResolution: 257,
      height: { min: -100, max: 9_000 },
    });
    const view = {
      position: [512, 101.7, 512] as [number, number, number],
      verticalFov: Math.PI / 3,
      viewportHeight: 450,
      direction: [0, 0, -1] as [number, number, number],
      aspect: 16 / 9,
    };
    const stream = createTerrainPyramidStream(
      d,
      // Ground at sea level, under the camera.
      { load: async (address) => flatTile(d, address, 100 / 9_100) },
      {
        initialView: view,
        ...terrainPyramidBudgetForQuality('balanced'),
        layers: [
          {
            id: 'nearby-buildings',
            category: 'human-feature',
            minLevel: 15,
            createTile: () => new THREE.Group(),
          },
        ],
      },
    );
    await stream.whenIdle();
    stream.setBudget({
      maxScreenSpaceError: 10,
      viewDistance: 12_000,
      maxSelectedTiles: 16,
      maxResidentTiles: 64,
      maxSurfaceTileResolution: 17,
      maxConcurrentLoads: 2,
      maxConcurrentLayerLoads: 1,
      maxResidentBytes: 96 * 1_048_576,
    });
    await stream.whenIdle();
    expect(stream.stats().fallbackLeaves).toBe(0);
    expect(stream.stats().selected).toBeLessThanOrEqual(16);
    expect(stream.stats().maxDisplayedLevel).toBe(15);
    const visibleFeatures: THREE.Object3D[] = [];
    stream.object.traverseVisible((object) => {
      if (object.name.startsWith('layer:nearby-buildings:15/')) visibleFeatures.push(object);
    });
    expect(visibleFeatures.length).toBeGreaterThan(0);
    expect(stream.sampleHeight(512, 512)).toBeDefined();
    stream.dispose();
  });

  it('keeps descendants visible above a reduced cap until a missing parent can replace them', async () => {
    const d = descriptor({ maxLevel: 2 });
    let parentAvailable = false;
    let resolveParent: (() => void) | undefined;
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address) {
          if (address.level === 0) {
            if (!parentAvailable) return undefined;
            await new Promise<void>((resolve) => {
              resolveParent = resolve;
            });
          }
          return flatTile(d, address);
        },
      },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 16,
        maxResidentTiles: 32,
        maxConcurrentLoads: 4,
      },
    );
    await stream.whenIdle();
    expect(stream.displayedTiles()).toHaveLength(16);
    stream.setBudget({ maxScreenSpaceError: 10_000, maxSelectedTiles: 1, maxResidentTiles: 2 });
    expect(stream.displayedTiles()).toHaveLength(16);
    expect(stream.pressure().overBudget).toBe(true);
    expect(stream.sampleHeight(2, 2)).toBeDefined();

    parentAvailable = true;
    stream.retryFailed();
    expect(stream.stats().loading).toBe(1);
    expect(stream.displayedTiles()).toHaveLength(16);
    expect(resolveParent).toBeDefined();
    resolveParent?.();
    await stream.whenIdle();
    expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
    expect(stream.residentTiles().length).toBeLessThanOrEqual(2);
    expect(stream.pressure().overBudget).toBe(false);
    stream.dispose();
  });

  it('reports retained allocation pressure without traversing the scene and protects visible coverage', async () => {
    const d = descriptor({ maxLevel: 1 });
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) => flatTile(d, address),
      },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 4,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        layers: [
          {
            id: 'boxes',
            category: 'human-feature',
            minLevel: 1,
            createTile: () =>
              new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()),
            disposeTile(object) {
              const mesh = object as THREE.Mesh;
              mesh.geometry.dispose();
              (mesh.material as THREE.Material).dispose();
            },
          },
        ],
      },
    );
    await stream.whenIdle();
    const pressure = stream.pressure();
    expect(pressure.geometryBytes).toBe(stream.stats().geometryBytes);
    expect(pressure.decodedHeightBytes).toBe(stream.stats().decodedSamples * 4);
    expect(pressure.residentBytes).toBe(pressure.geometryBytes + pressure.decodedHeightBytes);
    expect(pressure.byteRatio).toBe(0);
    expect(pressure.displayedBytes).toBeGreaterThan(0);
    expect(pressure.displayedBytes).toBeLessThanOrEqual(pressure.residentBytes);
    const traverse = stream.object.traverse;
    stream.object.traverse = () => {
      throw new Error('pressure must not traverse geometry');
    };
    expect(stream.pressure()).toEqual(pressure);
    stream.object.traverse = traverse;

    stream.setBudget({ maxResidentBytes: 1 });
    expect(stream.pressure().overBudget).toBe(true);
    expect(stream.pressure().byteRatio).toBeGreaterThan(1);
    stream.setBudget({ maxResidentBytes: undefined });
    expect(stream.pressure().maxResidentBytes).toBeUndefined();
    expect(stream.pressure().byteRatio).toBe(0);
    expect(stream.pressure().overBudget).toBe(false);
    expect(stream.displayedTiles()).toHaveLength(4);
    expect(stream.sampleHeight(2, 2)).toBeDefined();
    stream.dispose();
    expect(stream.pressure().residentBytes).toBe(0);
    expect(stream.pressure().residentTiles).toBe(0);
  });

  it('distinguishes a full reclaimable cache from the displayed working set for quality recovery', async () => {
    const d = descriptor({ maxLevel: 2 });
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 16,
        maxResidentTiles: 32,
        maxConcurrentLoads: 4,
      },
    );
    await stream.whenIdle();
    const retained = stream.pressure().residentBytes;
    const cap = Math.ceil(retained / 0.99);
    stream.setBudget({ maxScreenSpaceError: 10_000, maxResidentBytes: cap });
    await stream.whenIdle();
    const pressure = stream.pressure();
    expect(pressure.residentBytes).toBe(retained);
    expect(pressure.byteRatio).toBeGreaterThan(0.98);
    expect(pressure.byteRatio).toBeLessThanOrEqual(1);
    expect(stream.displayedTiles()).toHaveLength(1);
    expect(pressure.displayedBytes).toBeGreaterThan(0);
    expect(pressure.displayedBytes).toBeLessThan(retained * 0.1);
    expect(pressure.displayedByteRatio).toBe(pressure.displayedBytes / cap);
    expect(pressure.displayedByteRatio).toBeLessThan(0.1);
    stream.refreshMemoryUsage();
    expect(stream.pressure()).toEqual(pressure);
    stream.setBudget({ maxResidentBytes: undefined });
    expect(stream.pressure().displayedBytes).toBe(pressure.displayedBytes);
    expect(stream.pressure().displayedByteRatio).toBe(0);
    stream.dispose();
    expect(stream.pressure().displayedBytes).toBe(0);
  });

  it('counts shared LOD attributes and instance backing buffers once per retained object', async () => {
    const d = descriptor({ maxLevel: 0 });
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const transforms = new Float32Array(new THREE.Matrix4().elements);
    const colors = new Float32Array([0.4, 0.5, 0.6]);
    const material = new THREE.MeshBasicMaterial();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 1,
        maxResidentTiles: 2,
        maxConcurrentLoads: 1,
        layers: [
          {
            id: 'shared-lods',
            category: 'human-feature',
            visible: false,
            createTile() {
              const group = new THREE.Group();
              for (let detail = 0; detail < 3; detail++) {
                const geometry = new THREE.BufferGeometry();
                // Distinct BufferAttributes and array views retain one underlying vertex allocation.
                geometry.setAttribute(
                  'position',
                  new THREE.BufferAttribute(vertices.subarray(0, 9), 3),
                );
                geometry.setAttribute('normal', new THREE.BufferAttribute(vertices.subarray(9), 3));
                geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
                const mesh = new THREE.InstancedMesh(geometry, material, 0);
                mesh.count = 1;
                mesh.instanceMatrix = new THREE.InstancedBufferAttribute(
                  transforms.subarray(0),
                  16,
                );
                mesh.instanceColor = new THREE.InstancedBufferAttribute(colors.subarray(0), 3);
                group.add(mesh);
              }
              return group;
            },
            disposeTile(group) {
              group.traverse((object) => {
                const mesh = object as THREE.InstancedMesh;
                if (mesh.isInstancedMesh) {
                  mesh.geometry.dispose();
                  mesh.dispose();
                }
              });
            },
          },
        ],
      },
    );
    await stream.whenIdle();
    const surfaceBytes = stream.pressure().geometryBytes;
    stream.setLayerVisible('shared-lods', true);
    await stream.whenIdle();
    const layerBytes = vertices.byteLength + transforms.byteLength + colors.byteLength + 3 * 6;
    expect(stream.pressure().geometryBytes).toBe(surfaceBytes + layerBytes);
    expect(stream.stats().geometryBytes).toBe(surfaceBytes + layerBytes);
    expect(stream.stats().instances).toBe(3);
    stream.dispose();
    material.dispose();
  });

  it('refreshes pressure after a resident adapter replaces its geometry in place', async () => {
    const d = descriptor({ maxLevel: 0 });
    const layer = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 1,
        maxResidentTiles: 2,
        maxConcurrentLoads: 1,
        layers: [{ id: 'mutable', category: 'human-feature', createTile: () => layer }],
      },
    );
    await stream.whenIdle();
    const original = stream.pressure();
    const geometry = new THREE.BoxGeometry();
    layer.add(new THREE.Mesh(geometry, material));
    const changedBytes = stream.stats().geometryBytes;
    expect(changedBytes).toBeGreaterThan(original.geometryBytes);
    stream.refreshMemoryUsage();
    expect(stream.pressure().geometryBytes).toBe(changedBytes);
    expect(stream.pressure().displayedBytes).toBe(stream.pressure().residentBytes);
    expect(stream.pressure().residentBytes - original.residentBytes).toBe(
      changedBytes - original.geometryBytes,
    );
    layer.clear();
    geometry.dispose();
    stream.refreshMemoryUsage();
    expect(stream.pressure()).toEqual(original);
    stream.dispose();
    expect(stream.pressure().residentBytes).toBe(0);
    material.dispose();
  });

  it('changes surface density lazily and keeps resident layer draping aligned', async () => {
    const d = descriptor({ tileResolution: 129, maxLevel: 1 });
    const layerResolutions: Array<[number, number | undefined]> = [];
    const stream = createTerrainPyramidStream(
      d,
      {
        load: async (address) => flatTile(d, address),
      },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        maxSurfaceTileResolution: 65,
        viewDistance: 100,
        maxSelectedTiles: 4,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        layers: [
          {
            id: 'drape',
            category: 'classification',
            visible: false,
            createTile(context) {
              layerResolutions.push([context.address.level, context.surfaceResolution]);
              return new THREE.Group();
            },
          },
        ],
      },
    );
    await stream.whenIdle();
    const parent = stream.object.getObjectByName('surface:0/0/0') as THREE.Mesh;
    const geometry = parent.geometry;
    stream.setBudget({ maxSurfaceTileResolution: 33 });
    stream.setLayerVisible('drape', true);
    await stream.whenIdle();
    expect(parent.geometry).toBe(geometry);
    expect(layerResolutions).toEqual([[0, 65]]);

    stream.setBudget({ maxScreenSpaceError: 1 });
    await stream.whenIdle();
    expect(layerResolutions.filter(([level]) => level === 1)).toHaveLength(4);
    expect(
      layerResolutions
        .filter(([level]) => level === 1)
        .every(([, resolution]) => resolution === 33),
    ).toBe(true);
    stream.dispose();
  });

  it('reduces concurrency without restarting in-flight height requests', async () => {
    const d = descriptor({ maxLevel: 1 });
    const pending: Array<() => void> = [];
    const signals: AbortSignal[] = [];
    let calls = 0;
    const stream = createTerrainPyramidStream(
      d,
      {
        async load(address, signal) {
          calls++;
          signals.push(signal);
          await new Promise<void>((resolve) => pending.push(resolve));
          return flatTile(d, address);
        },
      },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 4,
        maxResidentTiles: 16,
        maxConcurrentLoads: 3,
      },
    );
    expect(calls).toBe(3);
    stream.setBudget({ maxConcurrentLoads: 1, maxConcurrentLayerLoads: 1 });
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
    pending.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(3);
    pending.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(3);
    while (pending.length > 0) {
      pending.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(stream.stats().loading).toBeLessThanOrEqual(1);
    }
    await stream.whenIdle();
    expect(calls).toBe(5);
    expect(stream.displayedTiles()).toHaveLength(4);
    stream.dispose();
  });
});

describe('terrain selection stability', () => {
  it('retains detail inside the hysteresis band and coarsens beyond it', () => {
    const d = descriptor({ height: { min: -1, max: 0 }, maxLevel: 1 });
    const options = { maxScreenSpaceError: 40, viewDistance: 1000, maxSelectedTiles: 4 };
    const near = selectTerrainPyramidTiles(d, { ...VIEW, position: [8, 90, 8] }, options);
    expect(near.tiles).toHaveLength(4);
    const band = { ...VIEW, position: [8, 110, 8] as [number, number, number] };
    expect(selectTerrainPyramidTiles(d, band, options).tiles).toHaveLength(1);
    expect(
      selectTerrainPyramidTiles(d, band, { ...options, previousTiles: near.tiles }).tiles,
    ).toHaveLength(4);
    expect(
      selectTerrainPyramidTiles(
        d,
        { ...VIEW, position: [8, 130, 8] },
        { ...options, previousTiles: near.tiles },
      ).tiles,
    ).toHaveLength(1);
  });
  it('keeps ground just outside the view at reduced detail, so a turn reveals selected terrain', () => {
    const d = descriptor({ rootSize: 4_096, maxLevel: 6, tileResolution: 33 });
    const turn = (degrees: number) => {
      const r = (degrees * Math.PI) / 180;
      return {
        position: [2_048, 120, 2_048] as [number, number, number],
        verticalFov: 0.8,
        viewportHeight: 900,
        direction: [Math.sin(r), -0.2, -Math.cos(r)] as [number, number, number],
        aspect: 1.6,
      };
    };
    const base = { maxScreenSpaceError: 2, viewDistance: 3_000, maxSelectedTiles: 600 };
    const rect = (tile: TerrainPyramidTileAddress): [number, number, number, number] => {
      const [x, z] = terrainPyramidTileOrigin(d, tile);
      const size = terrainPyramidTileSize(d, tile.level);
      return [x, z, x + size, z + size];
    };
    // Share of a selection's area that another selection already had ground for.
    const covered = (
      tiles: readonly TerrainPyramidTileAddress[],
      by: readonly TerrainPyramidTileAddress[],
    ): number => {
      let area = 0;
      let inside = 0;
      for (const tile of tiles) {
        const [x0, z0, x1, z1] = rect(tile);
        area += (x1 - x0) * (z1 - z0);
        for (const other of by) {
          const [a0, b0, a1, b1] = rect(other);
          inside +=
            Math.max(0, Math.min(x1, a1) - Math.max(x0, a0)) *
            Math.max(0, Math.min(z1, b1) - Math.max(z0, b0));
        }
      }
      return inside / area;
    };
    const plain = selectTerrainPyramidTiles(d, turn(0), base).tiles;
    const wide = selectTerrainPyramidTiles(d, turn(0), { ...base, peripheralDegrees: 30 }).tiles;
    const turned = selectTerrainPyramidTiles(d, turn(20), base).tiles;
    expect(covered(turned, plain)).toBeLessThan(0.97);
    expect(covered(turned, wide)).toBeGreaterThan(0.999);
    // The band is coarser than the view it flanks: fewer, larger tiles than at full detail.
    const bandOf = (tiles: readonly TerrainPyramidTileAddress[]) =>
      tiles.filter((tile) => covered([tile], plain) === 0);
    const full = selectTerrainPyramidTiles(d, turn(0), {
      ...base,
      peripheralDegrees: 30,
      peripheralDetail: 1,
    }).tiles;
    expect(bandOf(wide).length).toBeGreaterThan(0);
    expect(bandOf(wide).length).toBeLessThan(bandOf(full).length * 0.7);
    expect(() => selectTerrainPyramidTiles(d, turn(0), { ...base, peripheralDetail: 0 })).toThrow();
    // The surround keeps the rest of the circle as well, coarser again: a half turn finds
    // ground already selected, where the peripheral band alone has none behind the camera.
    const round = selectTerrainPyramidTiles(d, turn(0), {
      ...base,
      peripheralDegrees: 30,
      surroundDetail: 0.1,
    }).tiles;
    const behind = selectTerrainPyramidTiles(d, turn(180), base).tiles;
    expect(covered(behind, wide)).toBeLessThan(0.5);
    expect(covered(behind, round)).toBeGreaterThan(0.999);
    expect(round.length).toBeLessThan(wide.length + behind.length * 0.5);
    // Only within its own distance.
    const close = selectTerrainPyramidTiles(d, turn(0), {
      ...base,
      peripheralDegrees: 30,
      surroundDetail: 0.1,
      surroundDistance: 400,
    }).tiles;
    expect(covered(behind, close)).toBeLessThan(covered(behind, round));
    expect(() => selectTerrainPyramidTiles(d, turn(0), { ...base, surroundDetail: 0 })).toThrow();
    expect(() => selectTerrainPyramidTiles(d, turn(0), { ...base, surroundDistance: 0 })).toThrow();
  });

  it('does not cut away terrain behind the azimuth when a pitched camera sees the ground beneath it', () => {
    const d = descriptor();
    const options = { maxScreenSpaceError: 1, viewDistance: 100, maxSelectedTiles: 64 };
    const radial = selectTerrainPyramidTiles(d, VIEW, options);
    const pitched = selectTerrainPyramidTiles(
      d,
      { ...VIEW, direction: [0, -1, -0.01], aspect: 1.5 },
      options,
    );
    expect(pitched.tiles).toEqual(radial.tiles);
  });
});

describe('budgeted terrain publication', () => {
  it('keeps parent coverage while child admissions are spread across frames', async () => {
    const callbacks: Array<() => void> = [];
    const queue = new FrameAdmissionQueue({
      maxJobs: 1,
      schedule: (callback) => callbacks.push(callback),
    });
    const d = descriptor({ maxLevel: 1 });
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10000,
        viewDistance: 100,
        maxSelectedTiles: 4,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        admission: queue,
      },
    );
    async function frame() {
      await new Promise((resolve) => setTimeout(resolve, 0));
      callbacks.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    for (let i = 0; i < 20 && stream.displayedTiles().length === 0; i++) await frame();
    expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
    stream.setBudget({ maxScreenSpaceError: 1 });
    const states: number[][] = [];
    for (let i = 0; i < 30; i++) {
      await frame();
      const levels = stream.displayedTiles().map((t) => t.level);
      states.push(levels);
      expect(levels).not.toHaveLength(0);
      expect(levels.includes(0) || levels.filter((l) => l === 1).length === 4).toBe(true);
      if (!stream.stats().loading && queue.pending === 0) break;
    }
    expect(states.some((levels) => levels.includes(0))).toBe(true);
    expect(stream.displayedTiles().filter((t) => t.level === 1)).toHaveLength(4);
    stream.dispose();
    queue.dispose();
  });

  it('admits ground as urgent work and marks it for urgent preparation', async () => {
    const priorities = new Map<string, string | undefined>();
    const prepared: unknown[] = [];
    const d = descriptor({ maxLevel: 0 });
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 4,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        admission: {
          run: async (task, options) => {
            priorities.set(options?.label ?? '', options?.priority);
            return task();
          },
        },
        prepareObject: async (object) => {
          prepared.push(object.userData.admissionPriority);
        },
      },
    );
    for (let i = 0; i < 20 && stream.displayedTiles().length === 0; i++)
      await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stream.displayedTiles()).toHaveLength(1);
    expect(priorities.get('terrain-assembly')).toBe('urgent');
    expect(priorities.get('terrain-publication')).toBe('urgent');
    expect(prepared).toEqual(['urgent']);
    stream.dispose();
  });

  it('finishes a cut a pass left unfinished on later frames, without another stream update', async () => {
    // Hosts update the stream ten times a second while the camera is still: a cut that outran
    // one budget waited that long for each next slice, and ground a descent had just shown stood
    // uncut over its own harbor for most of a second (Seattle's waterfront).
    let now = 0;
    let tick = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => (now += tick));
    const d = descriptor({ maxLevel: 0 });
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 4,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        layers: [
          {
            id: 'cutters',
            category: 'human-feature',
            createTile() {
              const group = new THREE.Group();
              const owner = new THREE.Object3D();
              setTerrainGroundCutout(owner, [
                [2, 2],
                [6, 2],
                [6, 6],
              ]);
              group.add(owner);
              return group;
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      const surface = stream.object.getObjectByName('surface:0/0/0') as THREE.Mesh;
      const cut = () => surface.geometry !== terrainGroundSourceGeometry(surface);
      expect(cut()).toBe(true);
      stream.setLayerVisible('cutters', false);
      expect(cut()).toBe(false);
      // From here every reading of the clock is 5 ms on: each pass cuts one slice.
      tick = 5;
      stream.setLayerVisible('cutters', true);
      expect(cut()).toBe(false);
      for (let frame = 0; frame < 50 && !cut(); frame++) stream.updateTransitions();
      expect(cut()).toBe(true);
    } finally {
      stream.dispose();
      clock.mockRestore();
    }
  });

  it('recomputes ground cutouts only when visibility or a surface changes', async () => {
    // whenIdle waits for loading, not frame-budgeted cuts. Keep the clock fixed so setup
    // finishes cutting even on a busy runner; this test measures invalidation, not budgets.
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const update = vi.spyOn(TerrainGroundCutoutController.prototype, 'update');
    const d = descriptor({ maxLevel: 0 });
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 10_000,
        viewDistance: 100,
        maxSelectedTiles: 4,
        maxResidentTiles: 16,
        maxConcurrentLoads: 4,
        layers: [
          {
            id: 'cutters',
            category: 'human-feature',
            createTile() {
              const group = new THREE.Group();
              const owner = new THREE.Object3D();
              setTerrainGroundCutout(owner, [
                [2, 2],
                [6, 2],
                [6, 6],
              ]);
              group.add(owner);
              return group;
            },
          },
        ],
      },
    );
    try {
      await stream.whenIdle();
      expect(update).toHaveBeenCalled();
      update.mockClear();
      // A still camera reselects ten times a second; nothing it shows has changed.
      for (let i = 0; i < 5; i++) stream.update(VIEW);
      expect(update).not.toHaveBeenCalled();
      stream.setLayerVisible('cutters', false);
      expect(update).toHaveBeenCalled();
    } finally {
      stream.dispose();
      update.mockRestore();
      clock.mockRestore();
    }
  });
});

describe('building ahead of a moving camera', () => {
  const grid = descriptor({ rootSize: 4096, minLevel: 4, maxLevel: 4 });
  const row = 2048 + 128;
  const key = (x: number, z = 8): string => terrainPyramidTileKey({ level: 4, x, z });

  function view(x: number, z = row, direction: [number, number, number] = [1, -0.1, 0]) {
    return {
      position: [x, 50, z] as [number, number, number],
      direction,
      aspect: 1.5,
      verticalFov: 1,
      viewportHeight: 720,
    };
  }

  interface Rig {
    stream: ReturnType<typeof createTerrainPyramidStream>;
    built: string[];
    /** Fly at `speed` along +x for `seconds`, in 0.1 s updates, letting work finish each step. */
    fly(speed: number, seconds: number): Promise<void>;
  }

  function rig(
    options: Partial<Parameters<typeof createTerrainPyramidStream>[2]> = {},
    source: Partial<TerrainPyramidHeightSource> = {},
  ): Rig {
    const built: string[] = [];
    let now = 0;
    let x = 2048;
    const stream = createTerrainPyramidStream(
      grid,
      { load: async (address) => flatTile(grid, address), ...source },
      {
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address }) {
              built.push(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
        ],
        maxScreenSpaceError: 1,
        viewDistance: 600,
        maxSelectedTiles: 32,
        maxConcurrentLoads: 4,
        maxConcurrentLayerLoads: 4,
        maxResidentTiles: 128,
        now: () => now,
        ...options,
      },
    );
    return {
      stream,
      built,
      async fly(speed, seconds) {
        for (let step = 0; step < seconds * 10; step++) {
          now += 100;
          x += speed / 10;
          stream.update(view(x));
          await stream.whenIdle();
        }
      },
    };
  }

  it('builds ground the track reaches before the camera selects it, then shows it finished', async () => {
    const { stream, built, fly } = rig();
    try {
      await fly(100, 2);
      const stats = stream.stats();
      expect(stats.cameraSpeed).toBeGreaterThan(50);
      expect(stats.aheadTiles).toBeGreaterThan(0);
      expect(stats.aheadReady).toBe(stats.aheadTiles);
      // 600 units of range from x = 2248 ends in tile 11; the 20 s track reaches far past it.
      const ahead = key(12);
      expect(stream.displayedTiles().map(terrainPyramidTileKey)).not.toContain(ahead);
      expect(built).toContain(ahead);
      const builds = built.filter((tile) => tile === ahead).length;
      await fly(100, 6);
      expect(stream.displayedTiles().map(terrainPyramidTileKey)).toContain(ahead);
      expect(built.filter((tile) => tile === ahead)).toHaveLength(builds);
      const [band] = stream.viewCoverage([1_000]);
      expect(band?.complete).toBeGreaterThan(0);
      expect(band?.bare).toBe(0);
    } finally {
      stream.dispose();
    }
  });

  it('follows the arc of a turn, not its tangent, when choosing what to build', async () => {
    let now = 0;
    const requested: string[] = [];
    const stream = createTerrainPyramidStream(
      grid,
      {
        async load(address) {
          requested.push(terrainPyramidTileKey(address));
          return flatTile(grid, address);
        },
      },
      {
        maxScreenSpaceError: 1,
        viewDistance: 300,
        maxSelectedTiles: 32,
        maxConcurrentLoads: 4,
        maxResidentTiles: 200,
        now: () => now,
      },
    );
    try {
      // A circle of radius 800 at 100 units per second, heading +x at the start.
      const rate = 100 / 800;
      const pose = (time: number) => {
        const heading = rate * time;
        return view(1200 + 800 * Math.sin(heading), 1200 + 800 * (1 - Math.cos(heading)), [
          Math.cos(heading),
          -0.1,
          Math.sin(heading),
        ]);
      };
      for (let step = 0; step <= 40; step++) {
        // The turn rate takes a couple of seconds to settle; judge what is asked for after that.
        if (step === 30) requested.length = 0;
        now += 100;
        stream.update(pose(step / 10));
        await stream.whenIdle();
      }
      // Twelve seconds from here the circle is near (1927, 2333), in tile 7/9, and past the first
      // quarter by then. The tangent from here would be near (2636, 1873), in tile 10/7.
      const resident = stream.residentTiles().map(terrainPyramidTileKey);
      expect(resident).toContain(terrainPyramidTileKey({ level: 4, x: 7, z: 9 }));
      expect(requested).not.toContain(terrainPyramidTileKey({ level: 4, x: 10, z: 7 }));
    } finally {
      stream.dispose();
    }
  });

  it('does nothing ahead for a resting camera, one isolated move, or when turned off', async () => {
    const resting = rig();
    const off = rig({ lookAhead: false });
    try {
      await resting.fly(0, 3);
      expect(resting.stream.stats().aheadTiles).toBe(0);
      await off.fly(100, 3);
      expect(off.stream.stats().aheadTiles).toBe(0);
      resting.stream.update(view(3000));
      await resting.stream.whenIdle();
      expect(resting.stream.stats().aheadTiles).toBe(0);
    } finally {
      resting.stream.dispose();
      off.stream.dispose();
    }
  });

  it('starts layers for where a fast camera will be, not the ground beneath it', async () => {
    const { stream, built, fly } = rig({ maxConcurrentLayerLoads: 1 });
    try {
      stream.setLayerVisible('detail', false);
      await fly(400, 2);
      built.length = 0;
      stream.setLayerVisible('detail', true);
      await stream.whenIdle();
      // At x = 2848, in tile 11. A second and a half on, the camera is in tile 13.
      expect(built[0]).toBe(key(13));
      expect(built.indexOf(key(11))).toBeGreaterThan(built.indexOf(key(13)));
    } finally {
      stream.dispose();
    }
  });

  it('finishes what is on screen before ground ahead, with a slot left free', async () => {
    const resolvers: Array<(object: THREE.Object3D) => void> = [];
    const started: string[] = [];
    const { stream, fly } = rig({
      layers: [
        {
          id: 'detail',
          category: 'human-feature',
          visible: false,
          createTile({ address }) {
            started.push(terrainPyramidTileKey(address));
            return new Promise<THREE.Object3D>((resolve) => resolvers.push(resolve));
          },
        },
      ],
      maxConcurrentLayerLoads: 3,
    });
    try {
      await fly(100, 2);
      const onScreen = new Set(stream.displayedTiles().map(terrainPyramidTileKey));
      stream.setLayerVisible('detail', true);
      while (resolvers.length > 0) {
        // Past the visible tiles only tiles ahead remain, and they leave a slot free.
        if (started.filter((tile) => onScreen.has(tile)).length === onScreen.size) {
          expect(stream.stats().loadingLayers).toBeLessThanOrEqual(2);
        }
        resolvers.shift()?.(new THREE.Group());
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const firstAhead = started.findIndex((tile) => !onScreen.has(tile));
      expect(firstAhead).toBeGreaterThanOrEqual(onScreen.size - 1);
      expect(started.length).toBeGreaterThan(onScreen.size);
    } finally {
      for (const resolve of resolvers) resolve(new THREE.Group());
      stream.dispose();
    }
  });

  it('keeps near ground over old ground, so a loop keeps what comes round again', async () => {
    const stream = createTerrainPyramidStream(
      grid,
      { load: async (address) => flatTile(grid, address) },
      {
        maxScreenSpaceError: 1,
        viewDistance: 1,
        maxSelectedTiles: 1,
        maxConcurrentLoads: 1,
        maxResidentTiles: 4,
      },
    );
    const visit = async (x: number): Promise<void> => {
      const { direction: _direction, aspect: _aspect, ...radial } = view(x * 256 + 128);
      stream.update(radial);
      await stream.whenIdle();
    };
    try {
      // Near first, then far away, then back beside the first. Least recently used would drop
      // the first tile, the ground the camera has come back to, and keep the one it left behind.
      await visit(1);
      await visit(14);
      await visit(2);
      await visit(3);
      const resident = stream.residentTiles().map(terrainPyramidTileKey);
      expect(resident).toContain(key(1));
      expect(resident).not.toContain(key(14));
    } finally {
      stream.dispose();
    }
  });

  it('gives up tiles ahead rather than anything the camera needs', async () => {
    const { stream, fly } = rig({ maxResidentTiles: 64 });
    try {
      await fly(100, 2);
      expect(stream.stats().aheadReady).toBeGreaterThan(0);
      stream.setBudget({ maxResidentTiles: 32, maxSelectedTiles: 16 });
      await fly(100, 1);
      const stats = stream.stats();
      expect(stats.resident).toBeLessThanOrEqual(32);
      expect(stats.fallbackLeaves).toBe(0);
      expect(stream.viewCoverage([])[0]?.empty).toBe(0);
    } finally {
      stream.dispose();
    }
  });

  it('stops building ahead at the limit instead of churning tiles in and out', async () => {
    const asked: string[] = [];
    const { stream, fly } = rig(
      { maxResidentTiles: 64, maxSelectedTiles: 8, viewDistance: 300 },
      {
        async load(address) {
          asked.push(terrainPyramidTileKey(address));
          return flatTile(grid, address);
        },
      },
    );
    try {
      await fly(100, 2);
      // No room for anything hidden: a tile ahead would be loaded only to be evicted, and again.
      stream.setBudget({ maxResidentBytes: 1 });
      asked.length = 0;
      await fly(100, 2);
      const loads = new Map<string, number>();
      for (const tile of asked) loads.set(tile, (loads.get(tile) ?? 0) + 1);
      expect(Math.max(0, ...loads.values())).toBeLessThanOrEqual(1);
      expect(stream.stats().fallbackLeaves).toBe(0);
    } finally {
      stream.dispose();
    }
  });

  it('stops building ahead once memory gives a tile ahead up, rather than building it again', async () => {
    const asked: string[] = [];
    // A tile's layers outweigh its ground many times over, as a city's buildings do: room judged
    // when a tile's ground arrived is gone once its layers have.
    const { stream, fly } = rig(
      {
        viewDistance: 300,
        // A host's request window, as wide as Earth's: a burst of loads ahead starts at once.
        maxConcurrentLoads: 12,
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile: () =>
              new THREE.Mesh(
                new THREE.BufferGeometry().setAttribute(
                  'position',
                  new THREE.BufferAttribute(new Float32Array(3 * 2_000), 3),
                ),
              ),
          },
        ],
      },
      {
        async load(address) {
          asked.push(terrainPyramidTileKey(address));
          return flatTile(grid, address);
        },
      },
    );
    try {
      await fly(100, 2);
      // Room for the ground on screen and as much again, not for every tile ahead.
      const { displayedBytes } = stream.pressure();
      stream.setBudget({ maxResidentBytes: Math.ceil(displayedBytes * 2) });
      asked.length = 0;
      await fly(100, 8);
      const loads = new Map<string, number>();
      for (const tile of asked) loads.set(tile, (loads.get(tile) ?? 0) + 1);
      expect(Math.max(0, ...loads.values())).toBeLessThanOrEqual(1);
      expect(stream.stats().fallbackLeaves).toBe(0);
      expect(stream.viewCoverage([])[0]?.empty).toBe(0);
    } finally {
      stream.dispose();
    }
  });

  it('asks once for ground past the edge of the data and does not report it', async () => {
    const errors: unknown[] = [];
    const asked: string[] = [];
    const { stream, fly } = rig(
      { onError: (error) => errors.push(error) },
      {
        async load(address) {
          asked.push(terrainPyramidTileKey(address));
          return address.x >= 12 ? undefined : flatTile(grid, address);
        },
      },
    );
    try {
      await fly(100, 3);
      expect(asked.filter((tile) => tile === key(12))).toHaveLength(1);
      expect(errors).toHaveLength(0);
    } finally {
      stream.dispose();
    }
  });
});

describe('terrain selection at altitude', () => {
  const d = descriptor({
    rootSize: 2 ** 16,
    minLevel: 4,
    maxLevel: 10,
    tileResolution: 257,
    height: { min: 0, max: 5_000 },
  });
  const options = { maxScreenSpaceError: 3.5, viewDistance: 60_000, maxSelectedTiles: 512 };
  const view = (altitude: number) => ({
    position: [2 ** 15 + 100, altitude, 2 ** 15 + 100] as [number, number, number],
    verticalFov: Math.PI / 3,
    viewportHeight: 900,
  });
  const finest = (tiles: readonly TerrainPyramidTileAddress[]): number =>
    Math.max(...tiles.map((tile) => tile.level));

  it('measures height above the ground a tile holds, not above the height range', () => {
    const ground = () => ({ min: 40, max: 60 });
    const low = selectTerrainPyramidTiles(d, view(100), { ...options, tileHeight: ground });
    const high = selectTerrainPyramidTiles(d, view(4_000), { ...options, tileHeight: ground });
    expect(finest(low.tiles)).toBeGreaterThan(finest(high.tiles));
    // The camera is inside the 0-5000 range, so without ground heights altitude changes nothing.
    const blind = selectTerrainPyramidTiles(d, view(4_000), options);
    expect(finest(blind.tiles)).toBe(finest(low.tiles));
  });

  it('lets a tile without heights use its nearest known ancestor', () => {
    // Only the root tiles are known: everything beneath them has to inherit to stay coarse.
    const tileHeight = (address: TerrainPyramidTileAddress) =>
      address.level === d.minLevel ? { min: 40, max: 60 } : undefined;
    const { tiles } = selectTerrainPyramidTiles(d, view(4_000), { ...options, tileHeight });
    expect(finest(tiles)).toBeLessThan(10);
  });

  it('lets the stream refine by the real ground once it holds the tiles', async () => {
    const stream = createTerrainPyramidStream(
      d,
      // Ground at 50 m on every tile, in the package's 0-5000 m encoding.
      { load: async (address) => flatTile(d, address, 0.01) },
      {
        ...options,
        viewDistance: 8_000,
        maxSelectedTiles: 64,
        maxSurfaceTileResolution: 3,
        initialView: view(4_000),
        maxConcurrentLoads: 8,
        maxResidentTiles: 512,
      },
    );
    try {
      await stream.whenIdle();
      // The opening selection had no ground to go on; the next one does.
      for (let update = 0; update < 3; update++) {
        stream.update(view(4_000));
        await stream.whenIdle();
      }
      expect(stream.stats().maxDisplayedLevel).toBeLessThan(10);
    } finally {
      stream.dispose();
    }
  });
});

describe('heightfield extent', () => {
  it('reports the ground it holds rather than its encoding range', () => {
    const field = new Heightfield(new Float32Array([0.1, 0.2, 0.3, 0.4]), 2, 2, {
      origin: [0, 0],
      worldSize: [10, 10],
      height: { min: 0, max: 1_000 },
    });
    const extent = field.heightExtent();
    expect(extent.min).toBeCloseTo(100);
    expect(extent.max).toBeCloseTo(400);
  });
});

describe('hidden tiles', () => {
  const d = descriptor({ maxLevel: 2 });

  async function hideParent(): Promise<ReturnType<typeof createTerrainPyramidStream>> {
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 16,
        maxConcurrentLoads: 4,
        maxResidentTiles: 32,
      },
    );
    await stream.whenIdle();
    return stream;
  }

  it('leaves the scene graph, so a cached tile costs no per-frame traversal', async () => {
    const stream = await hideParent();
    try {
      const resident = stream.residentTiles().map(terrainPyramidTileKey);
      const displayed = stream.displayedTiles().map(terrainPyramidTileKey);
      expect(resident.length).toBeGreaterThan(displayed.length);
      const attached = stream.object.children.map((child) => child.name).sort();
      expect(attached).toEqual(displayed.map((key) => `tile:${key}`).sort());
    } finally {
      stream.dispose();
    }
  });

  it('still counts their memory, and returns the same objects when shown again', async () => {
    const stream = await hideParent();
    try {
      const child = stream.object.getObjectByName('tile:2/0/0');
      expect(child).toBeDefined();
      const allocated = stream.stats().geometryBytes;
      expect(allocated).toBeGreaterThan(stream.pressure().displayedBytes * 0.5);
      // Far away and back: everything near here is hidden, then shown again untouched.
      stream.update({ ...VIEW, position: [14, 10, 14] });
      await stream.whenIdle();
      stream.update(VIEW);
      await stream.whenIdle();
      expect(stream.object.getObjectByName('tile:2/0/0')).toBe(child);
    } finally {
      stream.dispose();
    }
  });

  it('resolves world matrices while away and refreshes them on return', async () => {
    const groups: THREE.Group[] = [];
    const stream = createTerrainPyramidStream(
      d,
      { load: async (address) => flatTile(d, address) },
      {
        initialView: VIEW,
        maxScreenSpaceError: 1,
        viewDistance: 100,
        maxSelectedTiles: 16,
        maxConcurrentLoads: 4,
        maxResidentTiles: 32,
        createTileGroup() {
          const group = new THREE.Group();
          groups.push(group);
          return group;
        },
      },
    );
    const world = new THREE.Group();
    world.add(stream.object);
    try {
      await stream.whenIdle();
      // The root stays resident behind its children.
      const root = groups.find((group) => group.name === 'tile:0/0/0') as THREE.Group;
      expect(stream.object.children).not.toContain(root);
      // The floating origin moves while the tile is away.
      world.position.set(2_000, 0, 0);
      world.updateMatrix();
      world.updateMatrixWorld(true);
      // Upward walks still reach the world, as a layer preparing on a hidden tile needs.
      expect(root.parent).toBe(stream.object);
      root.updateWorldMatrix(true, false);
      expect(root.matrixWorld.elements[12]).toBeCloseTo(2_000);
      root.matrixWorld.elements[12] = 0;
      stream.setBudget({ maxSelectedTiles: 1 });
      await stream.whenIdle();
      expect(stream.object.children).toContain(root);
      world.updateMatrixWorld();
      expect(root.matrixWorld.elements[12]).toBeCloseTo(2_000);
    } finally {
      stream.dispose();
    }
  });
});

describe('terrain work at speed', () => {
  const d = descriptor({ rootSize: 4096, minLevel: 2, maxLevel: 5 });
  const view = (x: number, y = 10) => ({
    position: [x, y, 2048] as [number, number, number],
    direction: [1, -0.1, 0] as [number, number, number],
    aspect: 1.5,
    verticalFov: 1,
    viewportHeight: 720,
  });
  const options = {
    maxScreenSpaceError: 1,
    viewDistance: 1_000,
    maxSelectedTiles: 64,
    maxConcurrentLoads: 8,
    maxResidentTiles: 512,
  };
  const source = { load: async (address: TerrainPyramidTileAddress) => flatTile(d, address, 0) };

  /** A stream on the test descriptor, flown along +x at a given speed in 0.1 s steps. */
  const flight = (overrides: Partial<Parameters<typeof createTerrainPyramidStream>[2]> = {}) => {
    let now = 0;
    const camera = { x: 1_000 };
    const stream = createTerrainPyramidStream(d, source, {
      ...options,
      now: () => now,
      ...overrides,
    });
    const fly = async (speed: number, seconds: number): Promise<void> => {
      for (let step = 0; step < seconds * 10; step++) {
        now += 100;
        camera.x += speed / 10;
        stream.update(view(camera.x));
        await stream.whenIdle();
      }
    };
    const finest = () => stream.displayedTiles().filter((tile) => tile.level === 5);
    return { stream, camera, fly, finest };
  };

  it('builds levels the camera crosses too quickly only near its track, and spreads them when it slows', async () => {
    const { stream, camera, fly, finest } = flight();
    try {
      await fly(0, 1);
      expect(stream.stats().speedLevel).toBe(5);
      const atRest = finest().length;
      expect(atRest).toBeGreaterThan(20);
      // A level 5 tile is 128 across: crossed in 3.2 s at 40 per second, under the 5 s limit.
      // 60 s carries the camera past everything it built at rest, onto ground it has to build.
      await fly(40, 60);
      expect(stream.stats().speedLevel).toBe(4);
      // At 5 / (3.2 * 0.25) times the error, level 5 reaches 0.16 of the 1000 view distance from
      // the camera and the points it is predicted to reach: only the level 4 tiles (256 across)
      // beside its track refine, where at rest the whole view did.
      const fast = finest();
      expect(fast.length).toBeGreaterThan(0);
      expect(fast.length).toBeLessThan(atRest);
      for (const tile of fast) {
        const parentZ = Math.floor(tile.z / 2) * 256;
        expect(Math.max(parentZ - 2_048, 2_048 - (parentZ + 256), 0)).toBeLessThan(200);
        expect(tile.x * 128).toBeGreaterThan(camera.x - 400);
      }
      await fly(0, 8);
      expect(stream.stats().speedLevel).toBe(5);
      expect(finest().length).toBeGreaterThan(atRest * 0.8);
    } finally {
      stream.dispose();
    }
  });

  it('keeps finer ground it has built on screen when it speeds up', async () => {
    // Room for the whole view at the finest level, so only speed could coarsen anything.
    const roomy = { maxSelectedTiles: 512, maxResidentTiles: 2_048 };
    const popsMoving = async (speed: number): Promise<number> => {
      const { stream, fly, finest } = flight(roomy);
      try {
        await fly(0, 1);
        const atRest = finest().length;
        const before = stream.stats().coarsenedInView;
        await fly(speed, 120 / speed);
        // 120 into a view 1000 deep: nearly all of it is still on screen.
        expect(finest().length).toBeGreaterThan(atRest * 0.8);
        expect(stream.stats().speedLevel).toBe(speed > 25.6 ? 4 : 5);
        return stream.stats().coarsenedInView - before;
      } finally {
        stream.dispose();
      }
    };
    expect(await popsMoving(20)).toBe(0);
    expect(await popsMoving(40)).toBe(0);
  });

  it('does not let layers under way for ground the camera has left hold up new ground', async () => {
    const started: number[] = [];
    const stream = createTerrainPyramidStream(d, source, {
      ...options,
      maxConcurrentLayerLoads: 2,
      layers: [
        {
          id: 'cover',
          category: 'classification',
          createTile({ address }) {
            const west = address.x * terrainPyramidTileSize(d, address.level);
            started.push(west);
            // Ground round the first view never finishes; the rest builds at once.
            return west < 1_500 ? new Promise<THREE.Object3D>(() => {}) : new THREE.Group();
          },
        },
      ],
    });
    try {
      stream.update(view(500));
      await expect.poll(() => started.length).toBe(2);
      // Both slots are taken. Far to the east none of that ground is wanted any longer.
      stream.update(view(3_500));
      await expect.poll(() => started.some((west) => west >= 3_000)).toBe(true);
    } finally {
      stream.dispose();
    }
  });

  it('can build none of those levels', async () => {
    const { stream, fly } = flight({ lookAhead: { fastDetail: 0 } });
    try {
      await fly(0, 1);
      await fly(40, 60);
      expect(stream.stats().speedLevel).toBe(4);
      expect(stream.stats().maxDisplayedLevel).toBe(4);
    } finally {
      stream.dispose();
    }
  });

  it('holds a level limit against speed noise around the threshold', async () => {
    let now = 0;
    let x = 1_000;
    const stream = createTerrainPyramidStream(d, source, { ...options, now: () => now });
    try {
      const seen = new Set<number>();
      // 128 / 5 is 25.6 per second. Waver just either side of it once the limit has engaged.
      for (let step = 0; step < 120; step++) {
        now += 100;
        const speed = step < 40 ? 40 : step % 2 === 0 ? 26 : 25;
        x += speed / 10;
        stream.update(view(x));
        if (step >= 60) seen.add(stream.stats().speedLevel);
        await stream.whenIdle();
      }
      expect([...seen]).toEqual([4]);
    } finally {
      stream.dispose();
    }
  });

  it('restores detail right after a teleport, with no further updates', async () => {
    let now = 0;
    let x = 1_000;
    const stream = createTerrainPyramidStream(d, source, { ...options, now: () => now });
    try {
      for (let step = 0; step < 30; step++) {
        now += 100;
        x += 4;
        stream.update(view(x));
        await stream.whenIdle();
      }
      expect(stream.stats().speedLevel).toBe(4);
      // A jump too soon after the last update to measure as a speed, and nothing after it.
      now += 2;
      stream.update(view(3_500));
      await stream.whenIdle();
      expect(stream.stats().speedLevel).toBe(5);
      expect(stream.stats().maxDisplayedLevel).toBe(5);
    } finally {
      stream.dispose();
    }
  });

  it('restores detail for a host that stops updating when the camera stops', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let now = 0;
    let x = 1_000;
    const stream = createTerrainPyramidStream(d, source, { ...options, now: () => now });
    try {
      for (let step = 0; step < 30; step++) {
        now += 100;
        x += 4;
        stream.update(view(x));
        await vi.advanceTimersByTimeAsync(10);
      }
      expect(stream.stats().speedLevel).toBe(4);
      expect(stream.stats().cameraSpeed).toBeGreaterThan(30);
      // The camera has arrived and nothing calls update again.
      await vi.advanceTimersByTimeAsync(2_000);
      expect(stream.stats().cameraSpeed).toBe(0);
      expect(stream.stats().speedLevel).toBe(5);
      expect(stream.stats().maxDisplayedLevel).toBe(5);
    } finally {
      stream.dispose();
      vi.useRealTimers();
    }
  });

  it('can be told not to limit detail at speed', async () => {
    let now = 0;
    let x = 1_000;
    const stream = createTerrainPyramidStream(d, source, {
      ...options,
      now: () => now,
      lookAhead: { minTileSeconds: 0 },
    });
    try {
      for (let step = 0; step < 30; step++) {
        now += 100;
        x += 4;
        stream.update(view(x));
        await stream.whenIdle();
      }
      expect(stream.stats().speedLevel).toBe(5);
    } finally {
      stream.dispose();
    }
  });

  it('honors a selection level limit below the descriptor', () => {
    const { tiles } = selectTerrainPyramidTiles(d, view(2_000), {
      maxScreenSpaceError: 1,
      viewDistance: 1_000,
      maxSelectedTiles: 64,
      maxLevel: 3,
    });
    expect(Math.max(...tiles.map((tile) => tile.level))).toBe(3);
  });

  it('keeps its last refinements while a tight tile budget decides', () => {
    // A budget far below what the view asks for: the error it settles for is many times the target,
    // so only the order the budget goes in decides which ground is fine.
    const tight = { maxScreenSpaceError: 1, viewDistance: 1_000, maxSelectedTiles: 24 };
    const changed = (keep: boolean): number => {
      let previous = selectTerrainPyramidTiles(d, view(1_000), tight).tiles;
      let total = 0;
      for (let x = 1_005; x <= 1_400; x += 5) {
        const next = selectTerrainPyramidTiles(d, view(x), {
          ...tight,
          ...(keep ? { previousTiles: previous } : {}),
        }).tiles;
        const before = new Set(previous.map(terrainPyramidTileKey));
        total += next.filter((tile) => !before.has(terrainPyramidTileKey(tile))).length;
        previous = next;
      }
      return total;
    };
    expect(
      selectTerrainPyramidTiles(d, view(1_000), tight).effectiveScreenSpaceError,
    ).toBeGreaterThan(2);
    expect(changed(true)).toBeLessThan(changed(false));
  });

  it('refines a level with a raised error multiple only nearer the camera', () => {
    const select = (refineScale?: (tile: TerrainPyramidTileAddress) => number) =>
      selectTerrainPyramidTiles(d, view(2_000), {
        maxScreenSpaceError: 150,
        viewDistance: 1_000,
        maxSelectedTiles: 512,
        ...(refineScale ? { refineScale } : {}),
      }).tiles;
    // Farthest edge of a level-5 tile from the camera, along the ground.
    const reach = (tiles: TerrainPyramidTileAddress[]): number =>
      Math.max(
        ...tiles
          .filter((tile) => tile.level === 5)
          .map((tile) =>
            Math.hypot(
              Math.max(Math.abs(tile.x * 128 - 2_000), Math.abs((tile.x + 1) * 128 - 2_000)),
              Math.max(Math.abs(tile.z * 128 - 2_048), Math.abs((tile.z + 1) * 128 - 2_048)),
            ),
          ),
      );
    const plain = select();
    const scaled = select((tile) => (tile.level === 4 ? 4 : 1));
    expect(reach(scaled)).toBeLessThan(reach(plain) / 2);
    // Coarser levels refine as before, and a multiple below 1 is no multiple.
    expect(scaled.some((tile) => tile.level === 4)).toBe(true);
    expect(select(() => 0.25)).toEqual(plain);
  });

  it('builds ahead only from spare capacity on the main thread', async () => {
    let now = 0;
    let x = 1_000;
    const grid = descriptor({ rootSize: 4096, minLevel: 4, maxLevel: 4 });
    const built: string[] = [];
    let pending = 100;
    const stream = createTerrainPyramidStream(
      grid,
      { load: async (address) => flatTile(grid, address, 0) },
      {
        ...options,
        viewDistance: 600,
        now: () => now,
        admission: {
          run: async (task) => task(),
          get pending() {
            return pending;
          },
        },
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile({ address }) {
              built.push(terrainPyramidTileKey(address));
              return new THREE.Group();
            },
          },
        ],
      },
    );
    const seen = new Set<string>();
    const fly = async (seconds: number): Promise<void> => {
      for (let step = 0; step < seconds * 10; step++) {
        now += 100;
        x += 10;
        stream.update(view(x));
        for (const tile of stream.displayedTiles()) seen.add(terrainPyramidTileKey(tile));
        await stream.whenIdle();
      }
    };
    try {
      await fly(2);
      expect(stream.stats().aheadTiles).toBeGreaterThan(0);
      // Behind the backlog, only ground the camera has selected gets built.
      expect(built.filter((key) => !seen.has(key))).toEqual([]);
      pending = 0;
      await fly(1);
      expect(built.filter((key) => !seen.has(key)).length).toBeGreaterThan(0);
    } finally {
      stream.dispose();
    }
  });

  it('lets a build finish into the cache when its tile falls out of the plan', async () => {
    let finish: (object: THREE.Object3D) => void = () => {};
    let signal: AbortSignal | undefined;
    const grid = descriptor({ rootSize: 4096, minLevel: 4, maxLevel: 4 });
    const stream = createTerrainPyramidStream(
      grid,
      { load: async (address) => flatTile(grid, address, 0) },
      {
        ...options,
        viewDistance: 200,
        maxConcurrentLayerLoads: 1,
        initialView: view(1_100),
        layers: [
          {
            id: 'detail',
            category: 'human-feature',
            createTile(context) {
              signal = context.signal;
              return new Promise<THREE.Object3D>((resolve) => {
                finish = resolve;
              });
            },
          },
        ],
      },
    );
    try {
      while (signal === undefined) await new Promise((resolve) => setTimeout(resolve, 0));
      // Far away: nothing near the first view is wanted now, but its worker job is already running.
      stream.update(view(3_500));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(signal.aborted).toBe(false);
      finish(new THREE.Group());
    } finally {
      stream.dispose();
    }
  });
});
