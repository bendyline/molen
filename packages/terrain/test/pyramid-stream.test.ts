import { FrameAdmissionQueue } from '@bendyline/molen-client';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import {
  createTerrainPyramidStream,
  selectTerrainPyramidTiles,
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

function flatTile(d: TerrainPyramidDescriptor, address: TerrainPyramidTileAddress): Heightfield {
  const origin = terrainPyramidTileOrigin(d, address);
  const size = terrainPyramidTileSize(d, address.level);
  return new Heightfield(new Float32Array(9).fill(address.level / 4), 3, 3, {
    origin,
    worldSize: [size, size],
    height: d.height,
  });
}

const VIEW = {
  position: [2, 10, 2] as [number, number, number],
  verticalFov: Math.PI / 2,
  viewportHeight: 1_000,
};

describe('screen-space terrain pyramid', () => {
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
      expect(stream.object.getObjectByName('tile:1/0/0')?.visible).toBe(false);
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
        maxConcurrentLayerLoads: 4,
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
        expect(stream.object.getObjectByName('layer:landuse:1/0/0')?.visible).toBe(false);
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
      expect(stream.object.getObjectByName('layer:landuse:0/0/0')?.visible).toBe(false);
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
      expect(stream.object.getObjectByName('layer:landuse:0/0/0')?.visible).toBe(false);
      failBuildings?.(new Error('unavailable buildings'));
      await stream.whenIdle();
      expect(stream.object.getObjectByName('layer:landuse:0/0/0')?.visible).toBe(true);
    } finally {
      stream.dispose();
    }
  });

  it('releases a staged handoff when its unfinished layer is hidden and discards late results', async () => {
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
        maxConcurrentLayerLoads: 4,
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
      expect(stream.displayedTiles()).toEqual([{ level: 0, x: 0, z: 0 }]);
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
    expect(stream.object.getObjectByName('layer:forest:1/0/0')?.visible).toBe(false);
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
    expect(stream.object.getObjectByName('layer:roads:0/0/0')?.visible).toBe(false);
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
      expect(stream.object.getObjectByName('layer:detail:1/0/0')?.visible).toBe(false);
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
      { load: async (address) => flatTile(d, address) },
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
});
