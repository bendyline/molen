import { getSchema } from '@bendyline/molen-schema';
import {
  markTerrainGroundSurface,
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
  it.each([
    'loaded',
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
      structures: createStructureIndex(catalog()),
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
      expect(area(ground.geometry)).toBeCloseTo(mode === 'loaded' ? 10000 - 192 : 10000, 2);
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
});
