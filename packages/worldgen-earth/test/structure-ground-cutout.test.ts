import { readFile } from 'node:fs/promises';
import { getSchema } from '@bendyline/molen-schema';
import {
  createTerrainSemanticObject,
  markTerrainGroundSurface,
  markTerrainWaterSurface,
  TerrainGroundCutoutController,
  type TerrainPyramidTileLayerContext,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import { StructureModelLibrary } from '@bendyline/molen-worldgen/client';
import { emptyWorldgenStats } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWorldgenSemanticRenderers } from '../src/client/renderers';
import { createStructureIndex, type StructurePlacement } from '../src/kernel/structure-index';
import { registerStructurePlacementsSchema } from '../src/kernel/structure-index-schema';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const base: StructurePlacement = {
  id: 'bowl',
  title: 'Sunken stadium',
  asset: 'example.stadium',
  anchor: worldToWgs84(1, 50, 50),
  heading: Math.PI / 4,
  scale: [2, 1, 2],
  groundCutout: {
    outline: [
      [-4, -3],
      [4, -3],
      [4, 3],
      [-4, 3],
    ],
    basis: 'Measured native facade boundary',
  },
  minLevel: 0,
  status: 'preview',
  source: 'https://example.com/stadium',
};
const primaryOpening = base.groundCutout?.outline;
if (!primaryOpening) throw new Error('Missing primary test opening');
function catalog(entry = base) {
  return { format: 'molen/structure-placements@1' as const, title: 'Stadium', entries: [entry] };
}
function context(signal: AbortSignal): TerrainPyramidTileLayerContext {
  return {
    address: { level: 0, x: 0, z: 0 },
    origin: [0, 0],
    tileSize: 100,
    pyramid: {
      name: 'test',
      origin: [0, 0],
      rootSize: 100,
      minLevel: 0,
      maxLevel: 0,
      tileResolution: 3,
      height: { min: 0, max: 10 },
      layers: [],
      skirts: false,
    },
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(new Float32Array(9), 3, 3, {
      origin: [0, 0],
      worldSize: [100, 100],
      height: { min: 0, max: 10 },
    }),
    signal,
  };
}
function area(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position'),
    ix = g.index;
  let a = 0;
  for (let i = 0; i < (ix?.count ?? p.count); i += 3) {
    const [u, v, w] = [0, 1, 2].map((j) => (ix ? ix.getX(i + j) : i + j)) as [
      number,
      number,
      number,
    ];
    a +=
      Math.abs(
        (p.getX(v) - p.getX(u)) * (p.getZ(w) - p.getZ(u)) -
          (p.getZ(v) - p.getZ(u)) * (p.getX(w) - p.getX(u)),
      ) / 2;
  }
  return a;
}
describe('geographic structure ground cutouts', () => {
  it('validates bounded water openings independently of ground openings', () => {
    registerStructurePlacementsSchema();
    const entry: StructurePlacement = {
      ...base,
      datum: 'sea-level',
      bounds: [-0.01, -0.01, 0.01, 0.01],
      waterCutout: {
        outlines: [primaryOpening],
        basis: 'Independently mapped lake component',
      },
    };
    const schema = getSchema('structure-placements')?.zod;
    if (!schema) throw new Error('Missing placements schema');
    expect(schema.safeParse(catalog(entry)).success).toBe(true);
    expect(() => createStructureIndex(catalog(entry))).not.toThrow();
    for (const change of [
      { bounds: undefined },
      { waterCutout: { outlines: [], basis: 'lake' } },
      {
        waterCutout: {
          outlines: [
            [
              [0, 0],
              [1, 1],
              [0, 1],
              [1, 0],
            ],
          ],
          basis: 'crossing',
        },
      },
      { waterCutout: { outlines: [primaryOpening], basis: ' ' } },
    ]) {
      const invalid = { ...entry, ...change } as StructurePlacement;
      expect(schema.safeParse(catalog(invalid)).success).toBe(false);
      expect(() => createStructureIndex(catalog(invalid))).toThrow(/water cutout/);
    }
  });
  it.each([
    'loaded',
    'failed',
    'cancelled',
  ] as const)('replaces only covered native water after model publication and restores it (%s)', async (mode) => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {}),
      abort = new AbortController(),
      ctx = context(abort.signal);
    const entry: StructurePlacement = {
      ...base,
      datum: 'sea-level',
      bounds: [-0.01, -0.01, 0.01, 0.01],
      waterCutout: {
        outlines: [primaryOpening],
        basis: 'One lake component;unrelated polygon shares its source ID',
      },
    };
    const models = new StructureModelLibrary(async () => {
      if (mode === 'failed') throw Error('missing GLB');
      if (mode === 'cancelled') abort.abort();
      return new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(8, 12, 6), new THREE.MeshStandardMaterial()),
      );
    });
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(catalog(entry)),
      structureObjects: models,
      roads: { renderTransportation: false },
      generator: {
        generate: async () => ({
          placements: [],
          records: [],
          stats: emptyWorldgenStats(),
          hash: 'empty',
          skippedByOwnership: 0,
          clippedPieces: 0,
        }),
        dispose() {},
      },
    });
    const source = createEmptyTerrainSemanticTile();
    source.water = [
      {
        id: 123,
        polygons: [
          {
            outer: [
              [0.05, 0.05],
              [0.75, 0.05],
              [0.75, 0.95],
              [0.05, 0.95],
            ],
          },
          {
            outer: [
              [0.8, 0.8],
              [0.95, 0.8],
              [0.95, 0.95],
              [0.8, 0.95],
            ],
          },
        ],
      },
    ];
    const native = createTerrainSemanticObject(source, ctx, {
        renderLandcover: false,
        renderTransportation: false,
        renderBuildings: false,
      }),
      water = native.getObjectByName('semantic:water') as THREE.Mesh;
    const scene = new THREE.Group(),
      ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2).translate(50, 0, 50),
      );
    markTerrainGroundSurface(ground);
    scene.add(ground, native);
    const originalWater = water.geometry,
      originalGround = ground.geometry,
      cuts = new TerrainGroundCutoutController();
    let root: THREE.Object3D | undefined;
    try {
      root =
        (await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), ctx)) ??
        undefined;
      if (root) scene.add(root);
      cuts.update(scene);
      expect(area(water.geometry)).toBeCloseTo(mode === 'loaded' ? 6525 - 192 : 6525, 2);
      expect(area(ground.geometry)).toBeCloseTo(mode === 'loaded' ? 10000 - 192 : 10000, 2);
      const remote = new THREE.Raycaster(
        new THREE.Vector3(87, 50, 87),
        new THREE.Vector3(0, -1, 0),
      ).intersectObject(water, false);
      expect(remote.length).toBeGreaterThan(0);
      if (root) renderers.humanFeatures.disposeTile?.(root);
      cuts.update(scene);
      expect(water.geometry).toBe(originalWater);
      expect(ground.geometry).toBe(originalGround);
    } finally {
      cuts.dispose();
      renderers.dispose();
      models.dispose();
      water.geometry.dispose();
      ground.geometry.dispose();
      warning.mockRestore();
    }
  });
  it('accepts the actual placement catalog, including separated mosque and barge ground openings', async () => {
    registerStructurePlacementsSchema();
    const document = JSON.parse(
      await readFile(
        new URL('../../../content/earth/structures/placements/authoring.json', import.meta.url),
        'utf8',
      ),
    );
    // Runtime schema validation is exercised by the placement compiler tests.
    expect(() => createStructureIndex(document)).not.toThrow();
  });
  it('validates concave/closed rings and rejects crossing, degenerate, nonfinite or unsubstantiated openings', () => {
    registerStructurePlacementsSchema();
    const schema = getSchema('structure-placements');
    expect(schema?.zod.safeParse(catalog()).success).toBe(true);
    expect(() => createStructureIndex(catalog())).not.toThrow();
    for (const outline of [
      [
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
      ],
      [
        [0, 0],
        [0, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [Infinity, 0],
        [1, 1],
      ],
    ] as [number, number][][]) {
      expect(() =>
        createStructureIndex(catalog({ ...base, groundCutout: { outline, basis: 'test' } })),
      ).toThrow('ground cutout');
    }
    expect(() =>
      createStructureIndex(
        catalog({
          ...base,
          groundCutout: { outline: base.groundCutout?.outline ?? [], basis: '' },
        }),
      ),
    ).toThrow('ground cutout');
  });
  it('validates each separate opening through the schema and index', () => {
    registerStructurePlacementsSchema();
    const groundCutout = {
      outline: base.groundCutout?.outline ?? [],
      basis: 'Measured native facade boundary',
      additionalOutlines: [
        [
          [6, -1],
          [8, -1],
          [8, 1],
          [6, 1],
        ],
      ] as [number, number][][],
    };
    const doc = catalog({ ...base, groundCutout });
    expect(getSchema('structure-placements')?.zod.safeParse(doc).success).toBe(true);
    expect(() => createStructureIndex(doc)).not.toThrow();
    groundCutout.additionalOutlines = [
      [
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
      ],
    ];
    expect(getSchema('structure-placements')?.zod.safeParse(doc).success).toBe(false);
    expect(() => createStructureIndex(doc)).toThrow('ground cutout');
  });
  it.each([
    'loaded',
    'bounded',
    'failed',
    'cancelled',
  ] as const)('opens only successfully published models and restores after disposal (%s)', async (mode) => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {}),
      abort = new AbortController();
    const models = new StructureModelLibrary(async () => {
      if (mode === 'failed') throw Error('missing GLB');
      if (mode === 'cancelled') abort.abort();
      return new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(8, 12, 6), new THREE.MeshStandardMaterial()),
      );
    });
    const r = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(
        catalog({
          ...base,
          ...(mode === 'bounded'
            ? {
                datum: 'sea-level' as const,
                bounds: [
                  worldToWgs84(1, 0, 100)[0],
                  worldToWgs84(1, 0, 100)[1],
                  worldToWgs84(1, 100, 0)[0],
                  worldToWgs84(1, 100, 0)[1],
                ] as [number, number, number, number],
              }
            : {}),
          groundCutout: {
            outline: base.groundCutout?.outline ?? [],
            basis: 'Measured native facade boundary',
            additionalOutlines: [
              [
                [6, -1],
                [8, -1],
                [8, 1],
                [6, 1],
              ],
            ],
          },
        }),
      ),
      structureObjects: models,
      roads: { renderTransportation: false },
      generator: {
        generate: async () => ({
          placements: [],
          records: [],
          stats: emptyWorldgenStats(),
          hash: 'empty',
          skippedByOwnership: 0,
          clippedPieces: 0,
        }),
        dispose() {},
      },
    });
    const scene = new THREE.Group(),
      ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2).translate(50, 0, 50),
      );
    markTerrainGroundSurface(ground);
    scene.add(ground);
    const original = ground.geometry,
      cutouts = new TerrainGroundCutoutController();
    try {
      const root = await r.humanFeatures.createTile(
        createEmptyTerrainSemanticTile(),
        context(abort.signal),
      );
      if (root) scene.add(root);
      cutouts.update(scene);
      expect(area(ground.geometry)).toBeCloseTo(
        mode === 'loaded' || mode === 'bounded' ? 10000 - 192 - 16 : 10000,
        2,
      );
      if (root) r.humanFeatures.disposeTile?.(root);
      cutouts.update(scene);
      expect(ground.geometry).toBe(original);
    } finally {
      cutouts.dispose();
      r.dispose();
      models.dispose();
      warning.mockRestore();
    }
  });
  it.each([
    false,
    true,
  ])('preserves gaps between separate openings and restores both (bounded: %s)', async (bounded) => {
    const primary = base.groundCutout?.outline;
    if (!primary) throw Error('Missing primary fixture outline');
    const entry: StructurePlacement = {
      ...base,
      ...(bounded ? ({ bounds: [-0.01, -0.01, 0.01, 0.01], datum: 'sea-level' } as const) : {}),
      groundCutout: {
        outline: primary,
        outlines: [
          primary,
          [
            [8, -2],
            [12, -2],
            [12, 2],
            [8, 2],
          ],
        ],
        basis: 'Two independently mapped building boundaries',
      },
    };
    registerStructurePlacementsSchema();
    expect(getSchema('structure-placements')?.zod.safeParse(catalog(entry)).success).toBe(true);
    const models = new StructureModelLibrary(async () =>
      new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(8, 12, 6), new THREE.MeshStandardMaterial()),
      ),
    );
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(catalog(entry)),
      structureObjects: models,
      roads: { renderTransportation: false },
      generator: {
        generate: async () => ({
          placements: [],
          records: [],
          stats: emptyWorldgenStats(),
          hash: 'empty',
          skippedByOwnership: 0,
          clippedPieces: 0,
        }),
        dispose() {},
      },
    });
    const scene = new THREE.Group(),
      ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2).translate(50, 0, 50),
      );
    markTerrainGroundSurface(ground);
    scene.add(ground);
    const original = ground.geometry,
      cutouts = new TerrainGroundCutoutController();
    try {
      const root = await renderers.humanFeatures.createTile(
        createEmptyTerrainSemanticTile(),
        context(new AbortController().signal),
      );
      if (!root) throw Error('Missing placed model');
      scene.add(root);
      cutouts.update(scene);
      // Native areas 48 + 16, scaled 2× on both axes. The gap remains rendered ground.
      expect(area(ground.geometry)).toBeCloseTo(10000 - (48 + 16) * 4, 2);
      renderers.humanFeatures.disposeTile?.(root);
      cutouts.update(scene);
      expect(ground.geometry).toBe(original);
    } finally {
      cutouts.dispose();
      renderers.dispose();
      models.dispose();
    }
  });
  it.each([
    'ground',
    'water',
  ] as const)('keeps %s openings aligned with resident models as tile owners load and unload', async (kind) => {
    const entry: StructurePlacement = {
      ...base,
      heading: 0,
      scale: [1, 1, 1],
      bounds: [-0.01, -0.01, 0.01, 0.01],
      datum: 'sea-level',
      groundCutout: {
        outline: [
          [-50, -10],
          [100, -10],
          [100, 10],
          [-50, 10],
        ],
        outlines: [
          [
            [-50, -10],
            [100, -10],
            [100, 10],
            [-50, 10],
          ],
          [
            [110, -10],
            [130, -10],
            [130, 10],
            [110, 10],
          ],
        ],
        basis: 'Two source floors crossing resident tile boundaries',
      },
    };
    if (kind === 'water') {
      const outlines = entry.groundCutout?.outlines;
      if (!outlines) throw new Error('Missing bounded test openings');
      entry.waterCutout = {
        outlines,
        basis: 'Two source water components crossing resident tile boundaries',
      };
      delete entry.groundCutout;
    }
    const models = new StructureModelLibrary(async () =>
      new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(400, 4, 40), new THREE.MeshStandardMaterial()),
      ),
    );
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(catalog(entry)),
      structureObjects: models,
      roads: { renderTransportation: false },
      generator: {
        generate: async () => ({
          placements: [],
          records: [],
          stats: emptyWorldgenStats(),
          hash: 'empty',
          skippedByOwnership: 0,
          clippedPieces: 0,
        }),
        dispose() {},
      },
    });
    const scene = new THREE.Group(),
      ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 100).rotateX(-Math.PI / 2).translate(100, 0, 50),
      );
    (kind === 'water' ? markTerrainWaterSurface : markTerrainGroundSurface)(ground);
    scene.add(ground);
    const original = ground.geometry,
      cutouts = new TerrainGroundCutoutController();
    let left: THREE.Object3D | undefined, right: THREE.Object3D | undefined;
    try {
      left =
        (await renderers.humanFeatures.createTile(
          createEmptyTerrainSemanticTile(),
          context(new AbortController().signal),
        )) ?? undefined;
      expect(left).toBeDefined();
      scene.add(left as THREE.Object3D);
      cutouts.update(scene);
      // Ground-opening models remain whole in each resident owner. Their full opening
      // therefore stays covered even beyond that owner's bounds. Water-only models
      // keep the ordinary bounded clipping policy.
      expect(area(ground.geometry)).toBeCloseTo(kind === 'ground' ? 16600 : 18000, 2);
      const next = {
        ...context(new AbortController().signal),
        origin: [100, 0] as [number, number],
        address: { level: 0, x: 1, z: 0 },
      };
      right =
        (await renderers.humanFeatures.createTile(createEmptyTerrainSemanticTile(), next)) ??
        undefined;
      expect(right).toBeDefined();
      (right as THREE.Object3D).position.x = 100;
      scene.add(right as THREE.Object3D);
      cutouts.update(scene);
      expect(area(ground.geometry)).toBeCloseTo(16600, 2);
      renderers.humanFeatures.disposeTile?.(left as THREE.Object3D);
      scene.remove(left as THREE.Object3D);
      left = undefined;
      cutouts.update(scene);
      // The second ground owner still renders the whole model and both openings.
      expect(area(ground.geometry)).toBeCloseTo(kind === 'ground' ? 16600 : 18600, 2);
      renderers.humanFeatures.disposeTile?.(right as THREE.Object3D);
      scene.remove(right as THREE.Object3D);
      right = undefined;
      cutouts.update(scene);
      expect(ground.geometry).toBe(original);
    } finally {
      if (left) renderers.humanFeatures.disposeTile?.(left);
      if (right) renderers.humanFeatures.disposeTile?.(right);
      cutouts.dispose();
      renderers.dispose();
      models.dispose();
    }
  });
  it('rejects empty, excessive or invalid secondary ground outlines in both validators', () => {
    registerStructurePlacementsSchema();
    const primary = base.groundCutout?.outline;
    if (!primary) throw Error('Missing primary fixture outline');
    const crossed: [number, number][] = [
      [0, 0],
      [2, 2],
      [0, 2],
      [2, 0],
    ];
    for (const outlines of [[], Array.from({ length: 65 }, () => primary), [primary, crossed]]) {
      const entry = { ...base, groundCutout: { outline: primary, outlines, basis: 'test' } };
      expect(() => createStructureIndex(catalog(entry))).toThrow('ground cutout');
      expect(getSchema('structure-placements')?.zod.safeParse(catalog(entry)).success).toBe(false);
    }
  });
});
