import { FrameAdmissionQueue } from '@bendyline/molen-client';
import {
  createTerrainSurfaceRenderer,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import { ModelLibrary, StructureModelLibrary } from '@bendyline/molen-worldgen/client';
import { emptyWorldgenStats } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWorldgenSemanticRenderers } from '../src/client/renderers';
import type { WorldgenGenerateRequest } from '../src/client/worker-bridge';
import { createStructureIndex } from '../src/kernel/structure-index';
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
  it.each([
    undefined,
    '1929-12-31',
    '1930-01-01',
    '1933-12-31',
    '1934-01-01',
  ])('loads and releases only in-region archival models for explicit date %s', async (viewingDate) => {
    const source = new THREE.Group().add(
      new THREE.Mesh(new THREE.BoxGeometry(5, 20, 5), new THREE.MeshStandardMaterial()),
    );
    const load = vi.fn(async () => source);
    const disposeGeometry = vi.spyOn((source.children[0] as THREE.Mesh).geometry, 'dispose');
    const objects = new StructureModelLibrary(load);
    const historical = {
      id: 'archive.local',
      title: 'Historical local tower',
      asset: 'archive.local',
      anchor: worldToWgs84(1, 50, 60),
      status: 'historical' as const,
      minLevel: 0,
      source: 'https://example.com/dated-plan',
      appearance: {
        kind: 'historical' as const,
        currentWorldEligible: false as const,
        validFrom: '1930-01-01',
        validUntil: '1934-01-01',
      },
    };
    const renderers = createWorldgenSemanticRenderers(pack, {
      ...(viewingDate !== undefined ? { viewingDate } : {}),
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Archive',
        entries: [
          historical,
          { ...historical, id: 'archive.remote', asset: 'archive.remote', anchor: [50, 40] },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: { generate: async () => output(), dispose() {} },
    });
    const root = await renderers.humanFeatures.createTile(
      createEmptyTerrainSemanticTile(),
      context(new AbortController().signal),
    );
    const eligible =
      viewingDate !== undefined && viewingDate >= '1930-01-01' && viewingDate < '1934-01-01';
    expect(load.mock.calls.map(([ref]) => ref)).toEqual(eligible ? ['archive.local'] : []);
    expect(!!root?.getObjectByName('structure:archive.local')).toBe(eligible);
    if (root) renderers.humanFeatures.disposeTile?.(root);
    expect(disposeGeometry).toHaveBeenCalledTimes(eligible ? 1 : 0);
    renderers.dispose();
    objects.dispose();
    if (!eligible) {
      (source.children[0] as THREE.Mesh).geometry.dispose();
      ((source.children[0] as THREE.Mesh).material as THREE.Material).dispose();
    }
  });

  it('disposes resident clipped geometry on renderer shutdown and tolerates a later tile eviction', async () => {
    const geometry = new THREE.BoxGeometry(600, 8, 20);
    const material = new THREE.MeshStandardMaterial();
    const source = new THREE.Group().add(new THREE.Mesh(geometry, material));
    const releaseSource = vi.spyOn(geometry, 'dispose');
    const releaseMaterial = vi.spyOn(material, 'dispose');
    const objects = new StructureModelLibrary(async () => source);
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Span',
        entries: [
          {
            id: 'span',
            title: 'Span',
            asset: 'unique.span',
            anchor: [0, 0],
            bounds: [-0.003, -0.001, 0.003, 0.001],
            datum: 'sea-level',
            minLevel: 0,
            status: 'preview',
            source: 'https://example.com',
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: { generate: async () => output(), dispose() {} },
    });
    const ctx = context(new AbortController().signal);
    ctx.origin = [-100, -100];
    const root = await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), ctx);
    if (!root) throw new Error('Missing structure tile');
    const scene = new THREE.Scene();
    scene.add(root);
    const mesh = root
      .getObjectByName('structure:span')
      ?.getObjectByProperty('isMesh', true) as THREE.Mesh;
    const releaseClipped = vi.spyOn(mesh.geometry, 'dispose');
    renderers.dispose();
    expect(root.parent).toBeNull();
    expect(releaseSource).toHaveBeenCalledOnce();
    expect(releaseClipped).toHaveBeenCalledOnce();
    expect(releaseMaterial).toHaveBeenCalledOnce();
    renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
    expect(releaseSource).toHaveBeenCalledOnce();
    expect(releaseClipped).toHaveBeenCalledOnce();
    expect(releaseMaterial).toHaveBeenCalledOnce();
  });

  it('keeps original structure UVs, textures, and PBR materials until its final tile is released', async () => {
    const geometry = new THREE.BoxGeometry(10, 20, 8);
    const texture = new THREE.DataTexture(new Uint8Array([100, 120, 140, 255]), 1, 1);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.8,
      roughness: 0.2,
    });
    const source = new THREE.Group().add(new THREE.Mesh(geometry, material));
    const releaseGeometry = vi.spyOn(geometry, 'dispose');
    const releaseTexture = vi.spyOn(texture, 'dispose');
    const releaseMaterial = vi.spyOn(material, 'dispose');
    const objects = new StructureModelLibrary(async () => source);
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Detailed',
        entries: [
          {
            id: 'detailed',
            title: 'Detailed',
            asset: 'unique.detailed',
            anchor: worldToWgs84(1, 50, 60),
            heading: Math.PI / 3,
            scale: [2, 1, 2],
            elevation: 4,
            minLevel: 0,
            status: 'preview',
            source: 'https://example.com',
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: { generate: async () => output(), dispose() {} },
    });
    const root = await renderers.humanFeatures.createTile(
      createEmptyTerrainSemanticTile(),
      context(new AbortController().signal),
    );
    const placed = root?.getObjectByName('structure:detailed');
    const mesh = placed?.getObjectByProperty('isMesh', true) as THREE.Mesh;
    expect(mesh.geometry.getAttribute('uv')).toBe(geometry.getAttribute('uv'));
    expect(mesh.material).toBe(material);
    expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(texture);
    expect(placed?.position.x).toBeCloseTo(50);
    expect(placed?.position.z).toBeCloseTo(60);
    expect(placed?.position.y).toBe(4);
    expect(placed?.rotation.y).toBeCloseTo(Math.PI / 3);
    expect(releaseGeometry).not.toHaveBeenCalled();
    if (root) renderers.humanFeatures.disposeTile?.(root);
    expect(releaseGeometry).toHaveBeenCalledOnce();
    expect(releaseTexture).toHaveBeenCalledOnce();
    expect(releaseMaterial).toHaveBeenCalledOnce();
    renderers.dispose();
    objects.dispose();
  });
  it.each([
    false,
    true,
  ])('suppresses a category building only after its model loads (failure=%s)', async (fails) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = new THREE.Group().add(
      new THREE.Mesh(new THREE.BoxGeometry(8, 20, 8), new THREE.MeshStandardMaterial()),
    );
    const loads = vi.fn(async () => {
      if (fails) throw new Error('missing model');
      return source;
    });
    const models = new ModelLibrary(loads);
    const generated = vi.fn(async (_input: WorldgenGenerateRequest) => output());
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Categories',
        entries: [],
        rules: [
          {
            id: 'mill',
            title: 'Mill',
            asset: 'generic.mill',
            source: 'https://example.com',
            dimensions: [8, 20, 8],
            match: { classes: ['windmill'] },
            minLevel: 0,
          },
        ],
      }),
      structureModels: models,
      roads: { renderTransportation: false },
      generator: { generate: generated, dispose() {} },
    });
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = [
      {
        id: 1,
        class: 'windmill',
        polygons: [
          {
            outer: [
              [0.4, 0.4],
              [0.5, 0.4],
              [0.5, 0.5],
              [0.4, 0.5],
            ],
          },
        ],
      },
    ];
    try {
      const root = await renderers.humanFeatures.createTile(
        tile,
        context(new AbortController().signal),
      );
      expect(loads).toHaveBeenCalledOnce();
      expect(generated.mock.calls[0]?.[0]?.tile.buildings).toHaveLength(fails ? 1 : 0);
      if (!fails) expect(models.get('generic.mill')).toBeDefined();
      if (root) renderers.humanFeatures.disposeTile?.(root);
      expect(models.get('generic.mill')).toBeUndefined();
    } finally {
      renderers.dispose();
      models.dispose();
      warn.mockRestore();
    }
  });

  it('does not load a unique model without matching orientation evidence', async () => {
    const loads = vi.fn(async () => new THREE.Group());
    const models = new ModelLibrary(loads);
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Gated',
        entries: [
          {
            id: 'landmark',
            title: 'Landmark',
            asset: 'unique.landmark',
            anchor: worldToWgs84(1, 100, 100),
            orientation: 'mapped',
            mapIdentity: { wikidata: 'Q42' },
            minLevel: 0,
            status: 'preview',
            source: 'https://example.com',
          },
        ],
      }),
      structureModels: models,
      roads: { renderTransportation: false },
      generator: { generate: async () => output(), dispose() {} },
    });
    const root = await renderers.humanFeatures.createTile(
      createEmptyTerrainSemanticTile(),
      context(new AbortController().signal),
    );
    expect(loads).not.toHaveBeenCalled();
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    models.dispose();
  });

  it.each([
    false,
    true,
  ])('batches building cells within the frame budget and cleans cancellation (%s)', async (cancel) => {
    const frames: Array<() => void> = [];
    const queue = new FrameAdmissionQueue({
      schedule: (callback) => frames.push(callback),
      now: () => 0,
      maxJobs: 2,
    });
    const generated = output();
    generated.buildingCells = Array.from({ length: 3 }, (_, i) => ({
      key: String(i),
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
      normals: new Float32Array(9),
      uvs: new Float32Array(6),
      colors: new Uint8Array(9),
      indices: new Uint16Array([0, 1, 2]),
      structuralIndices: new Uint16Array([0, 1, 2]),
      groups: [],
      bounds: [0, 0, 0, 1, 1, 1] as [number, number, number, number, number, number],
    }));
    const renderers = createWorldgenSemanticRenderers(pack, {
      lodPolicy: { viewportHeight: 720, maxPixelError: 2 },
      roads: { renderTransportation: false },
      generator: { generate: async () => generated, dispose() {} },
    });
    const controller = new AbortController();
    const disposeGeometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    try {
      const pending = renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), {
        ...context(controller.signal),
        admission: queue,
      });
      await vi.waitFor(() => expect(queue.pending).toBe(3));
      expect(frames).toHaveLength(1);
      frames.shift()?.();
      expect(queue.pending).toBe(1); // Respects the existing two-job frame budget.
      if (cancel) {
        controller.abort();
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        expect(queue.pending).toBe(0);
        expect(disposeGeometry).toHaveBeenCalledTimes(6); // Three LODs per completed cell.
        return;
      }
      frames.shift()?.();
      const root = await pending;
      expect(
        root?.children.find((child) => child.name.endsWith(':architecture'))?.children,
      ).toHaveLength(3);
      if (root) renderers.humanFeatures.disposeTile?.(root);
    } finally {
      queue.dispose();
      renderers.dispose();
      disposeGeometry.mockRestore();
    }
  });

  it('loads only nearby structures and releases their geometry with the tile', async () => {
    const loads: string[] = [];
    const structureModels = new ModelLibrary(async (ref) => {
      loads.push(ref);
      return new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    });
    const structures = createStructureIndex({
      format: 'molen/structure-placements@1',
      title: 'Resident landmarks',
      entries: [
        {
          id: 'near',
          title: 'Near',
          asset: 'near-model',
          anchor: [0.0001, -0.0001],
          minLevel: 0,
          status: 'preview',
          source: 'test',
        },
        {
          id: 'chicago',
          title: 'Chicago',
          asset: 'far-model',
          anchor: [-87.6, 41.9],
          minLevel: 0,
          status: 'preview',
          source: 'test',
        },
      ],
    });
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures,
      structureModels,
      roads: { renderTransportation: false },
      generator: { generate: async () => output(), dispose() {} },
    });
    const root = await renderers.humanFeatures.createTile(
      createEmptyTerrainSemanticTile(),
      context(new AbortController().signal),
    );
    expect(root?.getObjectByName('structure:near')).toBeDefined();
    expect(loads).toEqual(['near-model']);
    expect(structureModels.get('near-model')).toBeDefined();
    if (root) renderers.humanFeatures.disposeTile?.(root);
    expect(structureModels.get('near-model')).toBeUndefined();
    renderers.dispose();
    structureModels.dispose();
  });

  it('assigns an exact tile-edge anchor to one tile', async () => {
    const structureModels = new ModelLibrary();
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Boundary',
        entries: [
          {
            id: 'boundary',
            title: 'Boundary',
            asset: 'builtin:box',
            anchor: [0, 0],
            minLevel: 0,
            status: 'preview',
            source: 'test',
          },
        ],
      }),
      structureModels,
      roads: { renderTransportation: false },
      generator: { generate: async () => output(), dispose() {} },
    });
    const left = context(new AbortController().signal);
    left.origin = [-200, 0];
    const right = context(new AbortController().signal);
    const first = await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), left);
    const second = await renderers.humanFeatures.createTile(
      createEmptyTerrainSemanticTile(),
      right,
    );
    expect(first?.getObjectByName('structure:boundary')).toBeUndefined();
    expect(second?.getObjectByName('structure:boundary')).toBeDefined();
    if (first) renderers.humanFeatures.disposeTile?.(first);
    if (second) renderers.humanFeatures.disposeTile?.(second);
    renderers.dispose();
    structureModels.dispose();
  });

  it('loads extended bridge ends without the anchor tile and releases clipped geometry and shared assets', async () => {
    const loads = vi.fn(async () =>
      new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(600, 6, 20), new THREE.MeshStandardMaterial()),
      ),
    );
    const models = new ModelLibrary(loads);
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Bridge',
        entries: [
          {
            id: 'span',
            title: 'Span',
            asset: 'span',
            anchor: [0, 0],
            bounds: [-0.003, -0.001, 0.003, 0.001],
            datum: 'sea-level',
            elevation: 12,
            minLevel: 0,
            status: 'preview',
            source: 'test',
          },
        ],
      }),
      structureModels: models,
      roads: { renderTransportation: false },
      generator: { generate: async () => output(), dispose() {} },
    });
    const roots: THREE.Object3D[] = [];
    for (const x of [-300, 100]) {
      const ctx = context(new AbortController().signal);
      ctx.origin = [x, -100];
      const root = (await renderers.humanFeatures.createTile(
        createEmptyTerrainSemanticTile(),
        ctx,
      )) as THREE.Object3D;
      const mesh = root
        .getObjectByName('structure:span')
        ?.getObjectByProperty('isMesh', true) as THREE.Mesh;
      expect(mesh.geometry.boundingBox?.min.x).toBeGreaterThanOrEqual(0);
      expect(mesh.geometry.boundingBox?.max.x).toBeLessThanOrEqual(200);
      expect(mesh.geometry.boundingBox?.min.y).toBe(9);
      roots.push(root);
    }
    expect(loads).toHaveBeenCalledOnce();
    const mesh = roots[0]
      ?.getObjectByName('structure:span')
      ?.getObjectByProperty('isMesh', true) as THREE.Mesh;
    const disposed = vi.spyOn(mesh.geometry, 'dispose');
    renderers.humanFeatures.disposeTile?.(roots[0] as THREE.Object3D);
    expect(disposed).toHaveBeenCalledOnce();
    expect(models.get('span')).toBeDefined();
    renderers.humanFeatures.disposeTile?.(roots[1] as THREE.Object3D);
    expect(models.get('span')).toBeUndefined();
    renderers.dispose();
    models.dispose();
  });

  it('keeps procedural bridge roads when an authored replacement fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const models = new ModelLibrary(async () => {
      throw new Error('missing model');
    });
    const roadGenerate = vi.fn(async () => new THREE.Group());
    const surfaces = createTerrainSurfaceRenderer({}, { generate: roadGenerate, dispose() {} });
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Missing',
        entries: [
          {
            id: 'missing',
            title: 'Missing',
            asset: 'missing',
            anchor: [0, 0],
            bounds: [-0.003, -0.001, 0.003, 0.001],
            datum: 'sea-level',
            replaceRoads: { length: 600, width: 20 },
            minLevel: 0,
            status: 'preview',
            source: 'test',
          },
        ],
      }),
      structureModels: models,
      roads: { surfaceRenderer: surfaces },
      generator: { generate: async () => output(), dispose() {} },
    });
    try {
      const tile = createEmptyTerrainSemanticTile();
      tile.transportation.push({
        class: 'highway',
        bridge: true,
        lines: [
          [
            [0, 0],
            [1, 0],
          ],
        ],
      });
      const root = await renderers.humanFeatures.createTile(
        tile,
        context(new AbortController().signal),
      );
      expect(roadGenerate.mock.calls[0]?.[0]).toBe(tile);
      if (root) renderers.humanFeatures.disposeTile?.(root);
    } finally {
      renderers.dispose();
      models.dispose();
      surfaces.dispose();
      warn.mockRestore();
    }
  });

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
