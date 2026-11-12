import { FrameAdmissionQueue } from '@bendyline/molen-client';
import {
  createTerrainSurfaceRenderer,
  markTerrainGroundSurface,
  TerrainGroundCutoutController,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import {
  ModelLibrary,
  StructureLodStreamer,
  StructureModelLibrary,
} from '@bendyline/molen-worldgen/client';
import { emptyWorldgenStats } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWorldgenSemanticRenderers } from '../src/client/renderers';
import { withoutBuildingCutouts } from '../src/client/structure-building-cutout';
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
    false,
    true,
  ])('keeps a streamed bridge oriented, elevated and clipped through an upgrade (coarse %s)', async (coarse) => {
    let now = 0;
    const objects = new StructureLodStreamer(
      async () => ({
        bounds: {
          aabb: { min: [-300, -4, -10], max: [300, 4, 10] },
          sphere: { center: [0, 0, 0], radius: 301 },
        },
        runtimeLods: {
          recipe: 1,
          masterHash: `sha256:${'0'.repeat(64)}`,
          levels: (['skyline', 'district', 'street', 'closeup'] as const).map((name, i) => ({
            name,
            file: `model.${name}.glb`,
            hash: `sha256:${String(i).repeat(64)}`,
            bytes: 2000,
            gzipBytes: 1000,
            cpuBytes: 2000,
            gpuBytes: 2000,
            triangles: 12,
            drawCalls: 1,
            errorMeters: i === 3 ? 0 : 100,
          })),
        },
      }),
      async () =>
        new THREE.Group().add(
          new THREE.Mesh(new THREE.BoxGeometry(600, 8, 20), new THREE.MeshStandardMaterial()),
        ),
      { clock: () => now },
    );
    const renderers = createWorldgenSemanticRenderers(pack, {
      distantBuildings: coarse,
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Span',
        entries: [
          {
            id: 'span',
            title: 'Span',
            asset: 'span',
            anchor: [0, 0],
            bounds: [-0.003, -0.003, 0.003, 0.003],
            heading: Math.PI / 4,
            elevation: 12,
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
    if (coarse) ctx.address.level = 1;
    ctx.origin = [-100, -100];
    const root = await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), ctx);
    const placed = root?.getObjectByName('structure:span');
    if (!root || !placed) throw new Error('Missing bridge');
    const before = new THREE.Box3().setFromObject(placed);
    expect(before.min.x).toBeGreaterThanOrEqual(-0.001);
    expect(before.max.x).toBeLessThanOrEqual(200.001);
    expect(before.min.y).toBeCloseTo(8);
    expect(before.max.y).toBeCloseTo(16);
    const child = placed.children[0];
    const oldMesh = placed.getObjectByProperty('isMesh', true) as THREE.Mesh;
    const dispose = vi.spyOn(oldMesh.geometry, 'dispose');
    now = 2000;
    for (let i = 0; i < 4; i++) {
      objects.update({ position: [0, 20, 0], verticalFov: 45, viewportHeight: 900 });
      for (let j = 0; j < 20; j++) await Promise.resolve();
    }
    expect(placed.userData.landmarkLod).toBe('closeup');
    expect(placed.children[0]).not.toBe(child);
    expect(new THREE.Box3().setFromObject(placed).equals(before)).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
    renderers.humanFeatures.disposeTile?.(root);
    objects.dispose();
    renderers.dispose();
    expect(objects.stats().gpuBytes).toBe(0);
  });
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
      // GPU-ready (x, y, z, pad) vertices: normalized offsets times positionScale meters.
      positions: new Int16Array([0, 0, 0, 0, 32767, 0, 0, 0, 0, 0, 32767, 0]),
      positionScale: 1,
      center: [0, 0, 0] as [number, number, number],
      normals: new Int8Array(12),
      uvs: new Float32Array(6),
      colors: new Uint8Array(12),
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
      // The worldgen request is admitted first, then the cells.
      await vi.waitFor(() => expect(queue.pending).toBe(1));
      frames.shift()?.();
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

  it.each([
    { source: 'exact', side: 36, generalized: false, replaced: true },
    { source: 'exact merged block', side: 150, generalized: false, replaced: true },
    { source: 'generalized own footprint', side: 36, generalized: true, replaced: true },
    { source: 'generalized merged block', side: 150, generalized: true, replaced: false },
    // A stadium bowl or cloister mapped as a ring holds its landmark's anchor in the hole.
    { source: 'ring around its courtyard', side: 70, hole: 40, generalized: false, replaced: true },
    {
      source: 'block around a courtyard',
      side: 150,
      hole: 120,
      generalized: false,
      replaced: false,
    },
    // A landmark's own off-centre part (an observation level, a leg) lies inside its extent.
    {
      source: 'off-centre part inside the model',
      side: 12,
      offset: 10,
      generalized: false,
      replaced: true,
    },
    {
      source: 'neighbour beside the model',
      side: 12,
      offset: 30,
      generalized: false,
      replaced: false,
    },
    {
      source: 'generalized part off-centre',
      side: 12,
      offset: 10,
      generalized: true,
      replaced: false,
    },
  ])('replaces the $source under a loaded landmark: $replaced', async (fixture) => {
    // A 40 m wide landmark anchored at world (50, 60) on a 200 m tile at the origin.
    const source = new THREE.Group().add(
      new THREE.Mesh(new THREE.BoxGeometry(40, 180, 40), new THREE.MeshStandardMaterial()),
    );
    const objects = new StructureModelLibrary(async () => source);
    const half = fixture.side / 2 / 200;
    const shift = ('offset' in fixture ? fixture.offset : 0) / 200;
    const [u, v] = [50 / 200 + shift, 60 / 200];
    const square = (h: number) =>
      [
        [u - h, v - h],
        [u + h, v - h],
        [u + h, v + h],
        [u - h, v + h],
      ] as Array<[number, number]>;
    const footprint = {
      polygons: [
        {
          outer: square(half),
          ...('hole' in fixture ? { holes: [square(fixture.hole / 2 / 200)] } : {}),
        },
      ],
      height: 150,
    };
    const buildingCounts: number[] = [];
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Landmark',
        entries: [
          {
            id: 'tower',
            title: 'Tower',
            asset: 'tower-model',
            anchor: worldToWgs84(1, 50, 60),
            replaceFootprint: true,
            minLevel: 0,
            status: 'preview',
            source: 'test',
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request: WorldgenGenerateRequest) => {
          if (request.features?.buildings) buildingCounts.push(request.tile.buildings.length);
          return output();
        },
        dispose() {},
      },
    });
    const root = await renderers.humanFeatures.createTile(
      {
        ...createEmptyTerrainSemanticTile(),
        buildings: [footprint],
        ...(fixture.generalized ? { buildingsGeneralized: true } : {}),
      },
      context(new AbortController().signal),
    );
    expect(root?.getObjectByName('structure:tower')).toBeDefined();
    expect(buildingCounts).toEqual([fixture.replaced ? 0 : 1]);
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  });

  it.each([
    // A ballpark's parked roof: mapped as its own building, off the anchor and its extent box.
    {
      source: 'part over the model arm',
      box: [95, 52, 125, 68],
      generalized: false,
      replaced: true,
    },
    {
      source: 'building beside the arm',
      box: [95, 72, 125, 88],
      generalized: false,
      replaced: false,
    },
    {
      source: 'unrelated building in an empty corner inside the model extent',
      box: [76, 72, 94, 78],
      generalized: false,
      replaced: false,
    },
    { source: 'generalized arm part', box: [95, 52, 125, 68], generalized: true, replaced: false },
  ])('replaces the $source by model footprint: $replaced', async (fixture) => {
    // An L-shaped landmark anchored at world (50, 60): a 40 m block plus a 60 by 20 m arm east.
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(40, 60, 40),
      new THREE.MeshStandardMaterial(),
    );
    const arm = new THREE.Mesh(new THREE.BoxGeometry(60, 50, 20), new THREE.MeshStandardMaterial());
    arm.position.x = 50;
    const objects = new StructureModelLibrary(async () => new THREE.Group().add(block, arm));
    const [minX, minZ, maxX, maxZ] = fixture.box.map((value) => value / 200) as [
      number,
      number,
      number,
      number,
    ];
    const buildingCounts: number[] = [];
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Landmark',
        entries: [
          {
            id: 'ballpark',
            title: 'Ballpark',
            asset: 'ballpark-model',
            anchor: worldToWgs84(1, 50, 60),
            replaceFootprint: true,
            minLevel: 0,
            status: 'preview',
            source: 'test',
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request: WorldgenGenerateRequest) => {
          if (request.features?.buildings) buildingCounts.push(request.tile.buildings.length);
          return output();
        },
        dispose() {},
      },
    });
    const root = await renderers.humanFeatures.createTile(
      {
        ...createEmptyTerrainSemanticTile(),
        buildings: [
          {
            polygons: [
              {
                outer: [
                  [minX, minZ],
                  [maxX, minZ],
                  [maxX, maxZ],
                  [minX, maxZ],
                ],
              },
            ],
            height: 50,
          },
        ],
        ...(fixture.generalized ? { buildingsGeneralized: true } : {}),
      },
      context(new AbortController().signal),
    );
    expect(root?.getObjectByName('structure:ballpark')).toBeDefined();
    expect(buildingCounts).toEqual([fixture.replaced ? 0 : 1]);
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  });

  it.each([
    {
      // The Smith Tower: the anchor lies in its 75 m base outline, but the 141 m shaft and the
      // spire are separate parts mapped toward one side, mostly beside the model's footprint.
      source: 'the parts mapped inside a replaced outline',
      buildings: [
        { box: [30, 40, 70, 110], height: 75 },
        { box: [35, 72, 65, 105], height: 141, part: true },
        { box: [45, 95, 55, 100], height: 148, part: true },
        { box: [75, 40, 95, 80], height: 30 },
      ],
      kept: [30],
    },
    {
      // Holes are not inside: a building in a replaced cloister's courtyard is its own.
      source: "a building in a replaced ring's courtyard",
      buildings: [
        { box: [15, 25, 85, 95], hole: [20, 30, 80, 90], height: 20 },
        { box: [72, 82, 78, 88], height: 8 },
      ],
      kept: [8],
    },
  ])('replaces $source', async (fixture) => {
    // A 40 m wide landmark anchored at world (50, 60) on a 200 m tile at the origin.
    const objects = new StructureModelLibrary(async () =>
      new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(40, 147, 40), new THREE.MeshStandardMaterial()),
      ),
    );
    const ring = ([minX, minZ, maxX, maxZ]: number[]) =>
      [
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ].map(([x, z]) => [(x as number) / 200, (z as number) / 200] as [number, number]);
    const kept: number[][] = [];
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Landmark',
        entries: [
          {
            id: 'tower',
            title: 'Tower',
            asset: 'tower-model',
            anchor: worldToWgs84(1, 50, 60),
            replaceFootprint: true,
            minLevel: 0,
            status: 'preview',
            source: 'test',
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request: WorldgenGenerateRequest) => {
          if (request.features?.buildings)
            kept.push(request.tile.buildings.map((building) => building.height ?? 0));
          return output();
        },
        dispose() {},
      },
    });
    const root = await renderers.humanFeatures.createTile(
      {
        ...createEmptyTerrainSemanticTile(),
        buildings: fixture.buildings.map(
          (building: { box: number[]; hole?: number[]; height: number; part?: boolean }) => ({
            polygons: [
              {
                outer: ring(building.box),
                ...(building.hole ? { holes: [ring(building.hole)] } : {}),
              },
            ],
            height: building.height,
            ...(building.part ? { class: 'building_part' } : {}),
          }),
        ),
      },
      context(new AbortController().signal),
    );
    expect(root?.getObjectByName('structure:tower')).toBeDefined();
    expect(kept).toEqual([fixture.kept]);
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  });

  it.each([
    'landmark tile first',
    'neighbour first',
  ])('replaces a neighbour tile part the landmark covers: %s', async (order) => {
    // Anchored at world (150, 60) near tile 0's east edge; its arm reaches 30 m into tile 1.
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(40, 60, 40),
      new THREE.MeshStandardMaterial(),
    );
    const arm = new THREE.Mesh(new THREE.BoxGeometry(60, 50, 20), new THREE.MeshStandardMaterial());
    arm.position.x = 50;
    const objects = new StructureModelLibrary(async () => new THREE.Group().add(block, arm));
    // Buildings handed to the generator per tile X, in call order.
    const counts: Record<number, number[]> = { 0: [], 1: [] };
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Landmark',
        entries: [
          {
            id: 'ballpark',
            title: 'Ballpark',
            asset: 'ballpark-model',
            anchor: worldToWgs84(1, 150, 60),
            replaceFootprint: true,
            minLevel: 0,
            status: 'preview',
            source: 'test',
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request: WorldgenGenerateRequest) => {
          if (request.features?.buildings)
            counts[request.geom.x]?.push(request.tile.buildings.length);
          return output();
        },
        dispose() {},
      },
    });
    // Tile 1 spans world X 200..400; its mapped part sits under the arm at X 205..225.
    const part = {
      polygons: [
        {
          outer: [
            [0.025, 0.26],
            [0.125, 0.26],
            [0.125, 0.34],
            [0.025, 0.34],
          ] as Array<[number, number]>,
        },
      ],
      height: 50,
    };
    const tile = (x: number) => {
      const ctx = context(new AbortController().signal);
      ctx.address = { ...ctx.address, x };
      ctx.origin = [x * 200, 0];
      return renderers.humanFeatures.createTile(
        { ...createEmptyTerrainSemanticTile(), buildings: x === 1 ? [part] : [] },
        ctx,
      );
    };
    const settle = async () => {
      for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    };
    let landmark: THREE.Object3D | undefined;
    if (order === 'landmark tile first') {
      landmark = await tile(0);
      await tile(1);
      expect(counts[1]).toEqual([0]);
    } else {
      await tile(1);
      landmark = await tile(0);
      await settle();
      // Generated with the part, then regenerated without it once the landmark loaded.
      expect(counts[1]).toEqual([1, 0]);
    }
    expect(landmark?.getObjectByName('structure:ballpark')).toBeDefined();
    if (landmark) renderers.humanFeatures.disposeTile?.(landmark);
    await settle();
    // Evicting the landmark's tile hands the neighbour its mapped building back.
    expect(counts[1]?.at(-1)).toBe(1);
    renderers.dispose();
    objects.dispose();
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

  it('keeps sunken floors and openings whole while resident tile ownership changes', async () => {
    const loads = vi.fn(async () => {
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(80, 0.4, 80),
        new THREE.MeshStandardMaterial(),
      );
      floor.position.y = -6;
      return new THREE.Group().add(floor);
    });
    const models = new ModelLibrary(loads);
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Excavation',
        entries: [
          {
            id: 'excavation',
            title: 'Excavation',
            asset: 'excavation',
            anchor: [0, 0],
            bounds: [-0.0004, -0.0004, 0.0004, 0.0004],
            datum: 'sea-level',
            groundCutout: {
              outline: [
                [-40, -40],
                [40, -40],
                [40, 40],
                [-40, 40],
              ],
              basis: 'test',
            },
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
    const scene = new THREE.Scene();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial(),
    );
    const original = ground.geometry;
    markTerrainGroundSurface(ground);
    scene.add(ground);
    const cuts = new TerrainGroundCutoutController();
    const roots: THREE.Object3D[] = [];
    for (const x of [-5, 5]) {
      const ctx = context(new AbortController().signal);
      ctx.origin = [x, -5];
      ctx.tileSize = 10;
      const root = await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), ctx);
      expect(root).toBeDefined();
      if (!root) throw new Error('Missing excavation');
      root.position.set(x, 0, -5);
      scene.add(root);
      scene.updateMatrixWorld(true);
      const model = root.getObjectByName('structure:excavation');
      expect(model).toBeDefined();
      if (!model) throw new Error('Missing excavation model');
      const box = new THREE.Box3().setFromObject(model);
      expect(box.min.x).toBe(-40);
      expect(box.max.x).toBe(40);
      roots.push(root);
    }
    const firstMesh = roots[0]?.getObjectByProperty('isMesh', true) as THREE.Mesh;
    const secondMesh = roots[1]?.getObjectByProperty('isMesh', true) as THREE.Mesh;
    expect(firstMesh.geometry).toBe(secondMesh.geometry);
    expect(loads).toHaveBeenCalledOnce();
    const heightAt = (x: number) =>
      new THREE.Raycaster(
        new THREE.Vector3(x, 20, 0),
        new THREE.Vector3(0, -1, 0),
        0,
        40,
      ).intersectObject(scene, true)[0]?.point.y;
    cuts.update(scene);
    expect(heightAt(30)).toBeCloseTo(-5.8);
    expect(heightAt(50)).toBeCloseTo(0);
    scene.remove(roots[0] as THREE.Object3D);
    renderers.humanFeatures.disposeTile?.(roots[0] as THREE.Object3D);
    cuts.update(scene);
    expect(models.get('excavation')).toBeDefined();
    expect(heightAt(30)).toBeCloseTo(-5.8);
    scene.remove(roots[1] as THREE.Object3D);
    renderers.humanFeatures.disposeTile?.(roots[1] as THREE.Object3D);
    cuts.update(scene);
    expect(models.get('excavation')).toBeUndefined();
    expect(ground.geometry).toBe(original);
    expect(heightAt(30)).toBeCloseTo(0);
    renderers.dispose();
    models.dispose();
    cuts.dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
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

  it("keeps prop batches to a tile's quarters (one on coarser tiles) while preserving every placement in world coordinates", async () => {
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
    // Placements spread over kilometres still compile as at most four instanced meshes on a
    // finest tile (its quarters, so near detail stays round the camera) and one on a coarser one.
    expect(counts[0]).toBeLessThanOrEqual(4);
    expect(counts[1]).toBe(1);
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

it('awaits regional placement coverage before generating a terrain tile', async () => {
  const ready = deferred<[]>();
  const index = createStructureIndex({
    format: 'molen/structure-placement-data@1',
    title: 'empty',
    entries: [],
  });
  const queryAsync = vi.fn(() => ready.promise);
  const generate = vi.fn(async () => output());
  const renderers = createWorldgenSemanticRenderers(pack, {
    structures: { ...index, queryAsync },
    generator: { generate, dispose: vi.fn() },
  });
  const tileContext = context(new AbortController().signal);
  const task = renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), tileContext);
  expect(queryAsync).toHaveBeenCalledTimes(1);
  expect(generate).not.toHaveBeenCalled();
  ready.resolve([]);
  const object = await task;
  expect(generate).toHaveBeenCalled();
  if (object) renderers.humanFeatures.disposeTile?.(object);
  renderers.dispose();
});

describe('map overrides in the worldgen renderers', () => {
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  };
  /** A footprint by world X/Z, on the 200 m tile whose west edge is at `originX`. */
  const box = (
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    originX = 0,
  ): { outer: [number, number][] } => ({
    outer: [
      [(minX - originX) / 200, minZ / 200],
      [(maxX - originX) / 200, minZ / 200],
      [(maxX - originX) / 200, maxZ / 200],
      [(minX - originX) / 200, maxZ / 200],
    ],
  });
  /** What a map override leaves on the buildings it injects. */
  const host = { 'molen:override': 'lot' };
  type Ids = Array<string | number | undefined>;
  const solid = (width: number, height: number, depth: number): THREE.Mesh =>
    new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial());

  it('keeps a host building where a landmark replaces the mapped footprint', async () => {
    // A 40 m wide landmark anchored at world (50, 60) on a 200 m tile at the origin.
    const objects = new StructureModelLibrary(async () =>
      new THREE.Group().add(solid(40, 180, 40)),
    );
    const received: Ids[] = [];
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Landmark',
        entries: [
          {
            id: 'tower',
            title: 'Tower',
            asset: 'tower-model',
            anchor: worldToWgs84(1, 50, 60),
            replaceFootprint: true,
            minLevel: 0,
            status: 'preview',
            source: 'test',
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request: WorldgenGenerateRequest) => {
          if (request.features?.buildings)
            received.push(request.tile.buildings.map((building) => building.id));
          return output();
        },
        dispose() {},
      },
    });
    const root = await renderers.humanFeatures.createTile(
      {
        ...createEmptyTerrainSemanticTile(),
        buildings: [
          // The landmark's own mapped footprint, and a part mapped inside it.
          { id: 'mapped', polygons: [box(32, 42, 68, 78)] },
          { id: 'mapped-part', class: 'building_part', polygons: [box(40, 50, 50, 60)] },
          // What a host put in the same place: under the model, and inside the replaced outline.
          { id: 'override:lot:shed', polygons: [box(32, 42, 68, 78)], tags: host },
          { id: 'override:lot:kiosk', polygons: [box(52, 62, 60, 70)], tags: host },
        ],
      },
      context(new AbortController().signal),
    );
    expect(root?.getObjectByName('structure:tower')).toBeDefined();
    expect(received).toEqual([['override:lot:shed', 'override:lot:kiosk']]);
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  });

  it('leaves a host building whole where a landmark cuts mapped buildings', () => {
    const footprint = box(20, 20, 120, 120);
    const source = {
      ...createEmptyTerrainSemanticTile(),
      buildings: [
        { id: 'mapped', polygons: [footprint] },
        { id: 'override:lot:shed', polygons: [box(20, 20, 120, 120)], tags: host },
      ],
    };
    const cutout: [number, number][] = [
      [40, 40],
      [60, 40],
      [60, 60],
      [40, 60],
    ];
    // Trimmed at the mask, and dropped whole above a coverage share: neither touches the host's.
    const trimmed = withoutBuildingCutouts(source, { origin: [0, 0], tileSize: 200 }, [cutout]);
    expect(trimmed.buildings[0]?.polygons[0]?.holes).toHaveLength(1);
    expect(trimmed.buildings[1]).toBe(source.buildings[1]);
    const dropped = withoutBuildingCutouts(
      source,
      { origin: [0, 0], tileSize: 200 },
      [],
      [
        {
          outlines: [
            [
              [0, 0],
              [200, 0],
              [200, 200],
              [0, 200],
            ],
          ],
          minimumCoverage: 0.9,
        },
      ],
    );
    expect(dropped.buildings).toEqual([source.buildings[1]]);
  });

  /**
   * An L-shaped landmark anchored at world (150, 60) on the tile at the origin: a 40 m block,
   * and an arm that reaches 30 m into the next tile east. `hide()` takes it off the map, as a
   * map override clearing it does.
   */
  function ballpark() {
    const objects = new StructureModelLibrary(async () => {
      const arm = solid(60, 50, 20);
      arm.position.x = 50;
      return new THREE.Group().add(solid(40, 60, 40), arm);
    });
    const index = createStructureIndex({
      format: 'molen/structure-placements@1',
      title: 'Landmark',
      entries: [
        {
          id: 'ballpark',
          title: 'Ballpark',
          asset: 'ballpark-model',
          anchor: worldToWgs84(1, 150, 60),
          replaceFootprint: true,
          minLevel: 0,
          status: 'preview',
          source: 'test',
        },
      ],
    });
    let hidden = false;
    // Buildings handed to the generator per tile X, in call order.
    const received: Record<number, Ids[]> = { 0: [], 1: [] };
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: {
        ...index,
        query: (bounds, options) => (hidden ? [] : index.query(bounds, options)),
      },
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request: WorldgenGenerateRequest) => {
          if (request.features?.buildings)
            received[request.geom.x]?.push(request.tile.buildings.map((building) => building.id));
          return output();
        },
        dispose() {},
      },
    });
    return {
      renderers,
      received,
      hide: () => {
        hidden = true;
      },
      tile: async (
        x: number,
        buildings: Array<{
          id: string;
          polygons: Array<{ outer: [number, number][] }>;
          tags?: Record<string, string>;
        }>,
      ): Promise<THREE.Object3D> => {
        const ctx = context(new AbortController().signal);
        ctx.address = { ...ctx.address, x };
        ctx.origin = [x * 200, 0];
        const root = await renderers.humanFeatures.createTile(
          { ...createEmptyTerrainSemanticTile(), buildings },
          ctx,
        );
        if (!root) throw new Error(`Missing tile ${x}`);
        return root;
      },
      dispose: () => {
        renderers.dispose();
        objects.dispose();
      },
    };
  }
  // Under the landmark's block on its own tile, and under its arm on the next.
  const under = { id: 'under', polygons: [box(135, 45, 165, 75)] };
  const shed = { id: 'override:lot:shed', polygons: [box(135, 45, 165, 75)], tags: host };
  const part = { id: 'part', polygons: [box(205, 52, 225, 68, 200)] };

  it("generates a replaced tile under the outgoing tile's landmark footprint unless it was superseded", async () => {
    const f = ballpark();
    const outgoing = await f.tile(0, [under]);
    expect(outgoing.getObjectByName('structure:ballpark')).toBeDefined();
    expect(f.received[0]).toEqual([[]]);
    // The map changes: the landmark is cleared. A rectangle elsewhere supersedes nothing here.
    f.hide();
    f.renderers.supersede([1000, 1000, 1100, 1100]);
    const replacement = await f.tile(0, [under, shed]);
    expect(replacement.getObjectByName('structure:ballpark')).toBeUndefined();
    // The outgoing tile still shares the footprint: the mapped building under it is dropped, and
    // only the tag keeps what the host placed.
    expect(f.received[0]).toEqual([[], ['override:lot:shed']]);
    // It heals when the outgoing tile goes, with a second generation of the replacement.
    f.renderers.humanFeatures.disposeTile?.(outgoing);
    await settle();
    expect(f.received[0]).toEqual([[], ['override:lot:shed'], ['under', 'override:lot:shed']]);
    f.renderers.humanFeatures.disposeTile?.(replacement);
    f.dispose();
  });

  it('builds the replacement of a superseded tile once, and hands a neighbour its buildings back once', async () => {
    const f = ballpark();
    const outgoing = await f.tile(0, [under]);
    const neighbour = await f.tile(1, [part]);
    expect(f.received).toEqual({ 0: [[]], 1: [[]] });
    f.hide();
    // Inside the first tile only: a rectangle touching a tile's edge reaches it too.
    f.renderers.supersede([10, 10, 190, 190]);
    const replacement = await f.tile(0, [under, shed]);
    // Generated as the map now is, while the outgoing tile and its landmark are still there.
    expect(outgoing.getObjectByName('structure:ballpark')).toBeDefined();
    expect(f.received[0]).toEqual([[], ['under', 'override:lot:shed']]);
    await settle();
    expect(f.received[1]).toEqual([[]]);
    f.renderers.humanFeatures.disposeTile?.(outgoing);
    await settle();
    // The replacement stands as generated; the neighbour under the arm is generated again, once.
    expect(f.received[0]).toEqual([[], ['under', 'override:lot:shed']]);
    expect(f.received[1]).toEqual([[], ['part']]);
    for (const root of [replacement, neighbour]) f.renderers.humanFeatures.disposeTile?.(root);
    f.dispose();
  });

  it('spends no quality rebuild on a superseded tile', async () => {
    const f = ballpark();
    const outgoing = await f.tile(0, [under]);
    const neighbour = await f.tile(1, [part]);
    f.renderers.supersede([10, 10, 190, 190]);
    f.renderers.setQuality('high');
    await settle();
    expect(f.received[0]).toHaveLength(1);
    expect(f.received[1]).toHaveLength(2);
    // Not superseded: rebuilt as any resident is.
    f.renderers.setQuality('economy');
    await settle();
    expect(f.received[0]).toHaveLength(1);
    expect(f.received[1]).toHaveLength(3);
    for (const root of [outgoing, neighbour]) f.renderers.humanFeatures.disposeTile?.(root);
    f.dispose();
  });

  /**
   * Two neighbouring tiles of a small town: a tower that replaces its footprint on the first,
   * and on the second only a statue, which replaces nothing.
   */
  async function town() {
    const objects = new StructureModelLibrary(async (ref) =>
      new THREE.Group().add(ref === 'statue-model' ? solid(10, 6, 10) : solid(40, 180, 40)),
    );
    const placement = (id: string, x: number, z: number, replaceFootprint: boolean) => ({
      id,
      title: id === 'tower' ? 'Tower' : 'Statue',
      asset: `${id}-model`,
      anchor: worldToWgs84(1, x, z),
      ...(replaceFootprint ? { replaceFootprint } : {}),
      minLevel: 0,
      status: 'preview' as const,
      source: 'test',
    });
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Landmarks',
        entries: [placement('tower', 50, 60, true), placement('statue', 350, 150, false)],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: { generate: async () => output(), dispose() {} },
    });
    const roots: THREE.Object3D[] = [];
    const tile = async (x: number, buildings: unknown[]): Promise<THREE.Object3D> => {
      const ctx = context(new AbortController().signal);
      ctx.address = { ...ctx.address, x };
      ctx.origin = [x * 200, 0];
      const root = await renderers.humanFeatures.createTile(
        { ...createEmptyTerrainSemanticTile(), buildings } as ReturnType<
          typeof createEmptyTerrainSemanticTile
        >,
        ctx,
      );
      if (!root) throw new Error(`Missing tile ${x}`);
      roots.push(root);
      return root;
    };
    const depot = {
      id: 'a',
      class: 'building',
      subclass: 'warehouse',
      name: 'Depot',
      height: 12,
      levels: 3,
      polygons: [box(90, 90, 110, 110)],
    };
    const rest = [
      { id: 'b', polygons: [box(120, 90, 130, 110)] },
      // Cut by the tile's east edge; the other half is on the next tile under the same id.
      { id: 'edge', polygons: [box(180, 20, 200, 40)] },
      { id: 'outline', class: 'building', polygons: [box(20, 120, 60, 160)] },
      { id: 'part', class: 'building_part', polygons: [box(30, 130, 40, 140)] },
      { id: 'orphan', class: 'building_part', polygons: [box(150, 20, 160, 30)] },
      { id: 'override:lot:shed', polygons: [box(100, 160, 120, 180)], tags: host },
    ];
    await tile(0, [depot, ...rest]);
    await tile(1, [{ id: 'edge', polygons: [box(200, 20, 220, 40, 200)] }]);
    return {
      renderers,
      tile,
      rest,
      dispose: () => {
        for (const root of roots) renderers.humanFeatures.disposeTile?.(root);
        renderers.dispose();
        objects.dispose();
      },
    };
  }
  /** A hit with its numbers rounded: tile coordinates do not come back to the last bit. */
  const rounded = <T>(value: T): T =>
    JSON.parse(
      JSON.stringify(value, (_key, item) =>
        typeof item === 'number' ? Math.round(item * 1e6) / 1e6 : item,
      ),
    );

  it('finds the buildings near a point, nearest first, within the radius', async () => {
    const t = await town();
    const near = t.renderers.buildingsNear(112, 100, 30);
    expect(near.map((hit) => hit.id)).toEqual(['a', 'b']);
    expect(rounded(near[0])).toEqual({
      kind: 'building',
      id: 'a',
      name: 'Depot',
      class: 'warehouse',
      outlines: [
        [
          [90, 90],
          [110, 90],
          [110, 110],
          [90, 110],
        ],
      ],
      bounds: [90, 90, 110, 110],
      height: 12,
      levels: 3,
      distance: 2,
    });
    expect(near[1]?.distance).toBeCloseTo(8, 6);
    // The default radius is 30.
    expect(t.renderers.buildingsNear(112, 100).map((hit) => hit.id)).toEqual(['a', 'b']);
    // Inside a footprint the distance is 0.
    expect(t.renderers.buildingsNear(100, 100, 5).map((hit) => [hit.id, hit.distance])).toEqual([
      ['a', 0],
    ]);
    expect(t.renderers.buildingsNear(112, 100, 5).map((hit) => hit.id)).toEqual(['a']);
    expect(t.renderers.buildingsNear(112, 100, 1)).toEqual([]);
    expect(t.renderers.buildingsNear(1000, 1000, 30)).toEqual([]);
    t.dispose();
    expect(t.renderers.buildingsNear(100, 100, 5)).toEqual([]);
  });

  it('reports a building once, whole: across a tile edge and with its parts', async () => {
    const t = await town();
    const edge = t.renderers.buildingsNear(200, 30, 5);
    expect(edge.map((hit) => hit.id)).toEqual(['edge']);
    expect(edge[0]?.outlines).toHaveLength(2);
    expect(rounded(edge[0]?.bounds)).toEqual([180, 20, 220, 40]);
    expect(edge[0]?.distance).toBeCloseTo(0, 6);
    // A part is the outline around it; one with no outline is its own building.
    expect(t.renderers.buildingsNear(35, 135, 5).map((hit) => hit.id)).toEqual(['outline']);
    expect(t.renderers.buildingsNear(155, 25, 2).map((hit) => hit.id)).toEqual(['orphan']);
    // What a host placed says which override it came with.
    expect(t.renderers.buildingsNear(110, 170, 5)).toMatchObject([
      { kind: 'building', id: 'override:lot:shed', override: 'lot', distance: 0 },
    ]);
    expect(t.renderers.buildingsNear(100, 100, 5)[0]?.override).toBeUndefined();
    t.dispose();
  });

  it('reports the landmarks standing on a tile, whether or not they replace a footprint', async () => {
    const t = await town();
    const [lon, lat] = worldToWgs84(1, 50, 60);
    const tower = t.renderers.buildingsNear(50, 60, 5);
    expect(tower).toHaveLength(1);
    expect(tower[0]).toMatchObject({ kind: 'landmark', id: 'tower', name: 'Tower', distance: 0 });
    expect(tower[0]?.anchor?.[0]).toBeCloseTo(lon, 12);
    expect(tower[0]?.anchor?.[1]).toBeCloseTo(lat, 12);
    // The extent it stands on: the 40 m model around its anchor, to the footprint grid's cell.
    const [minX, minZ, maxX, maxZ] = tower[0]?.bounds ?? [0, 0, 0, 0];
    for (const [value, expected] of [
      [minX, 30],
      [minZ, 40],
      [maxX, 70],
      [maxZ, 80],
    ] as const)
      expect(Math.abs(value - expected)).toBeLessThan(2);
    expect(tower[0]?.outlines).toHaveLength(1);
    // A landmark that replaces nothing is standing there all the same, on a tile of its own.
    const statue = t.renderers.buildingsNear(350, 150, 2);
    expect(statue).toMatchObject([{ kind: 'landmark', id: 'statue', name: 'Statue', distance: 0 }]);
    expect(rounded(statue[0]?.bounds)).toEqual([345, 145, 355, 155]);
    // From outside, its distance is to its extent.
    expect(t.renderers.buildingsNear(365, 150, 12)[0]?.distance).toBeCloseTo(10, 6);
    t.dispose();
  });

  it('reads the tile that replaces another at the same address', async () => {
    const t = await town();
    const replacement = await t.tile(0, [
      { id: 'a2', polygons: [box(90, 90, 110, 110)] },
      ...t.rest,
    ]);
    expect(t.renderers.buildingsNear(100, 100, 5).map((hit) => hit.id)).toEqual(['a2']);
    // Still one building across the edge, from the replacement and the neighbour.
    expect(t.renderers.buildingsNear(200, 30, 5)[0]?.outlines).toHaveLength(2);
    expect(t.renderers.buildingsNear(50, 60, 5).map((hit) => hit.id)).toEqual(['tower']);
    t.renderers.humanFeatures.disposeTile?.(replacement);
    expect(t.renderers.buildingsNear(100, 100, 5).map((hit) => hit.id)).toEqual(['a']);
    t.dispose();
  });
});
