import { getSchema } from '@bendyline/molen-schema';
import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  type TerrainSemanticTile,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import { StructureModelLibrary } from '@bendyline/molen-worldgen/client';
import { emptyWorldgenStats } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWorldgenSemanticRenderers } from '../src/client/renderers';
import { resolveStructureElevation } from '../src/client/structure-elevation';
import { createStructureIndex, type StructurePlacement } from '../src/kernel/structure-index';
import { registerStructurePlacementsSchema } from '../src/kernel/structure-index-schema';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const entry: StructurePlacement = {
  id: 'bridge',
  title: 'Bank-referenced bridge',
  asset: 'example.bridge',
  anchor: worldToWgs84(1, 50, 50),
  minLevel: 0,
  status: 'preview',
  source: 'https://example.org/bridge',
  terrainReference: {
    anchor: worldToWgs84(1, 150, 50),
    modelHeight: 8,
    basis: 'Measured bank at native deck Y8',
  },
};
const reference = { anchor: worldToWgs84(1, 150, 50), modelHeight: 8, basis: 'Measured bank' };
const catalog = (item = entry) => ({
  format: 'molen/structure-placements@1' as const,
  title: 'Bridge',
  entries: [item],
});
function context(signal = new AbortController().signal): TerrainPyramidTileLayerContext {
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
      height: { min: 10, max: 20 },
      layers: [],
      skirts: false,
    },
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(new Float32Array(9), 3, 3, {
      origin: [0, 0],
      worldSize: [100, 100],
      height: { min: 10, max: 20 },
    }),
    signal,
  };
}
describe('landmark ground reference', () => {
  it('rejects invalid reference evidence and incompatible absolute datums', () => {
    registerStructurePlacementsSchema();
    expect(getSchema('structure-placements')?.zod.safeParse(catalog()).success).toBe(true);
    for (const item of [
      { ...entry, datum: 'sea-level' as const },
      { ...entry, terrainReference: { ...reference, modelHeight: NaN } },
      { ...entry, terrainReference: { ...reference, basis: '' } },
      {
        ...entry,
        terrainReference: { ...reference, anchor: [190, 0] as [number, number] },
      },
    ]) {
      expect(getSchema('structure-placements')?.zod.safeParse(catalog(item)).success).toBe(false);
      expect(() => createStructureIndex(catalog(item))).toThrow();
    }
  });
  it('never uses a clamped tile-edge sample for a reference on a neighboring tile', async () => {
    const tile = context(),
      sample = vi.spyOn(tile.heightfield, 'sampleHeight');
    expect(await resolveStructureElevation(entry, tile, 1)).toBeUndefined();
    expect(sample).not.toHaveBeenCalled();
    const remote = vi.fn(async () => 53);
    expect(
      await resolveStructureElevation(
        { ...entry, scale: [1, 2, 1], elevation: 1.5 },
        tile,
        1,
        remote,
      ),
    ).toBe(38.5);
    expect(remote).toHaveBeenCalledWith(
      entry.terrainReference?.anchor,
      expect.objectContaining({ signal: tile.signal }),
    );
  });
  it('requires a cross-tile host sampler for every extended terrain piece', async () => {
    const extended: StructurePlacement = { ...entry, bounds: [-0.001, -0.001, 0.002, 0.001] };
    expect(getSchema('structure-placements')?.zod.safeParse(catalog(extended)).success).toBe(true);
    expect(() => createStructureIndex(catalog(extended))).not.toThrow();
    const a = context(),
      b = {
        ...context(),
        origin: [100, 0] as [number, number],
        heightfield: new Heightfield(new Float32Array(9), 3, 3, {
          origin: [100, 0],
          worldSize: [100, 100],
          height: { min: 80, max: 90 },
        }),
      };
    const first = vi.spyOn(a.heightfield, 'sampleHeight'),
      second = vi.spyOn(b.heightfield, 'sampleHeight');
    expect(await resolveStructureElevation(extended, a, 1)).toBeUndefined();
    expect(await resolveStructureElevation(extended, b, 1)).toBeUndefined();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    const sample = vi.fn(async (_coordinate: readonly [number, number]) => 53);
    expect(await resolveStructureElevation(extended, a, 1, sample)).toBe(45);
    expect(await resolveStructureElevation(extended, b, 1, sample)).toBe(45);
    expect(sample.mock.calls.map((call) => call[0])).toEqual([reference.anchor, reference.anchor]);
  });
  it('retains local terrain and absolute datum behavior, with explicit missing coverage', async () => {
    const tile = context(),
      local = { ...entry, terrainReference: undefined };
    expect(await resolveStructureElevation(local, tile, 1)).toBe(10);
    expect(await resolveStructureElevation(local, tile, 1, () => undefined)).toBeUndefined();
    await expect(resolveStructureElevation(local, tile, 1, () => Infinity)).rejects.toThrow(
      'Invalid terrain',
    );
    const remote = vi.fn(() => 99);
    expect(
      await resolveStructureElevation(
        { ...local, datum: 'sea-level', elevation: 26.34 },
        tile,
        1,
        remote,
      ),
    ).toBe(26.34);
    expect(remote).not.toHaveBeenCalled();
  });
  it('validates explicit approach heights in both data and direct runtime catalogs', () => {
    const absolute: StructurePlacement = {
      ...entry,
      terrainReference: undefined,
      datum: 'sea-level',
      bounds: [-0.001, -0.001, 0.001, 0.001],
      replaceRoads: { length: 100, width: 20, deckHeights: [3, 5] },
    };
    expect(getSchema('structure-placements')?.zod.safeParse(catalog(absolute)).success).toBe(true);
    expect(() => createStructureIndex(catalog(absolute))).not.toThrow();
    for (const replaceRoads of [
      { length: -1, width: 20 },
      { length: 100, width: 0 },
      {
        length: 100,
        width: 20,
        outline: [
          [-5, -5],
          [5, 5],
          [-5, 5],
          [5, -5],
        ] as [number, number][],
      },
      { length: 100, width: 20, deckHeights: [3, Infinity] as [number, number] },
      { length: 100, width: 20, deckHeights: [3, 5] as [number, number], deckHeight: 4 },
    ]) {
      const invalid = { ...absolute, replaceRoads };
      expect(getSchema('structure-placements')?.zod.safeParse(catalog(invalid)).success).toBe(
        false,
      );
      expect(() => createStructureIndex(catalog(invalid))).toThrow('road');
    }
  });
  it.each([
    false,
    true,
  ])('suppresses only successfully loaded bridge spans (load failure: %s)', async (failure) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const models = new StructureModelLibrary(async () => {
      if (failure) throw new Error('Unavailable bridge asset');
      return new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4), new THREE.MeshStandardMaterial()),
      );
    });
    const roadRenderer = {
      createTileAsync: vi.fn(async (_tile: TerrainSemanticTile) => new THREE.Group()),
      dispose() {},
    };
    const bridge: StructurePlacement = {
      ...entry,
      terrainReference: undefined,
      datum: 'sea-level',
      bounds: [-0.001, -0.001, 0.001, 0.001],
      elevation: 30,
      replaceRoads: { length: 40, width: 20, deckHeights: [5, 7] },
    };
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(catalog(bridge)),
      structureObjects: models,
      roads: { surfaceRenderer: roadRenderer as never },
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
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    });
    try {
      const object = await renderers.humanFeatures.createTile(tile, context());
      const actual = roadRenderer.createTileAsync.mock.calls[0]?.[0];
      if (failure) expect(actual).toBe(tile);
      else {
        expect(actual?.transportation[0]?.lines).toEqual([
          [
            [0, 0.5],
            [expect.closeTo(0.3), 0.5],
          ],
          [
            [0.7, 0.5],
            [1, 0.5],
          ],
        ]);
        expect(actual?.transportation[0]?.bridgeConnections?.map((c) => c.elevation)).toEqual([
          35, 37,
        ]);
      }
      if (object) renderers.humanFeatures.disposeTile?.(object);
    } finally {
      renderers.dispose();
      models.dispose();
      warn.mockRestore();
    }
  });
  it.each([
    'loaded',
    'missing',
    'cancelled',
  ] as const)('publishes only resolved models and releases them (%s)', async (mode) => {
    const released = vi.fn();
    const abort = new AbortController(),
      loader = vi.fn(async () =>
        new THREE.Group().add(
          new THREE.Mesh(
            (() => {
              const g = new THREE.BoxGeometry(2, 3, 4);
              g.addEventListener('dispose', released);
              return g;
            })(),
            new THREE.MeshStandardMaterial(),
          ),
        ),
      );
    const models = new StructureModelLibrary(loader);
    const sampler = vi.fn(async () => {
      if (mode === 'cancelled') abort.abort();
      return mode === 'missing' ? undefined : 53;
    });
    const r = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(catalog()),
      structureObjects: models,
      sampleStructureTerrain: sampler,
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
    try {
      const object = await r.humanFeatures.createTile(
        createEmptyTerrainSemanticTile(),
        context(abort.signal),
      );
      const placed = object?.getObjectByName('structure:bridge');
      if (mode === 'loaded') {
        expect(placed?.position.y).toBe(45);
        expect(placed?.userData.structureElevation).toBe(45);
        expect(loader).toHaveBeenCalledTimes(1);
      } else {
        expect(placed).toBeUndefined();
        expect(loader).not.toHaveBeenCalled();
      }
      if (object) r.humanFeatures.disposeTile?.(object);
      await Promise.resolve();
      expect(released).toHaveBeenCalledTimes(mode === 'loaded' ? 1 : 0);
    } finally {
      r.dispose();
      models.dispose();
    }
  });
  it.each([
    false,
    true,
  ])('keeps extended reference pieces and road fallback coherent (host: %s)', async (host) => {
    const load = vi.fn(async () =>
      new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(180, 2, 10), new THREE.MeshStandardMaterial()),
      ),
    );
    const models = new StructureModelLibrary(load);
    const extended: StructurePlacement = {
      ...entry,
      bounds: [-0.001, -0.001, 0.002, 0.001],
      replaceRoads: { length: 180, width: 10, deckHeight: 1 },
    };
    const seen: TerrainSemanticTile[] = [];
    const r = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex(catalog(extended)),
      structureObjects: models,
      ...(host ? { sampleStructureTerrain: async () => 53 } : {}),
      roads: {
        surfaceRenderer: {
          createTileAsync: async (tile: TerrainSemanticTile) => {
            seen.push(tile);
            return new THREE.Group();
          },
          dispose() {},
        } as never,
      },
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
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'highway',
      bridge: true,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    });
    const outputs: THREE.Object3D[] = [];
    try {
      for (const offset of [0, 100]) {
        const ctx = {
          ...context(),
          origin: [offset, 0] as [number, number],
          heightfield: new Heightfield(new Float32Array(9), 3, 3, {
            origin: [offset, 0],
            worldSize: [100, 100],
            height: { min: offset, max: offset + 10 },
          }),
        };
        const out = await r.humanFeatures.createTile(tile, ctx);
        if (out) outputs.push(out);
        const piece = out?.getObjectByName('structure:bridge');
        if (host) expect(piece?.userData.structureElevation).toBe(45);
        else expect(piece).toBeUndefined();
      }
      if (host) {
        expect(load).toHaveBeenCalledTimes(1);
        expect(seen[0]?.transportation).toHaveLength(0);
        expect(seen[1]?.transportation[0]?.bridgeConnections?.map((c) => c.elevation)).toEqual([
          46, 46,
        ]);
      } else {
        expect(load).not.toHaveBeenCalled();
        expect(seen).toEqual([tile, tile]);
      }
    } finally {
      for (const out of outputs) r.humanFeatures.disposeTile?.(out);
      r.dispose();
      models.dispose();
    }
  });
});
