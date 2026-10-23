import type { TerrainPyramidTileLayerContext } from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  Heightfield,
  polygonArea,
  worldToWgs84,
} from '@bendyline/molen-terrain/kernel';
import { ModelLibrary } from '@bendyline/molen-worldgen/client';
import { emptyWorldgenStats } from '@bendyline/molen-worldgen/kernel';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWorldgenSemanticRenderers } from '../src/client/renderers';
import {
  structureBuildingCutout,
  structureBuildingCutouts,
  withoutBuildingCutouts,
} from '../src/client/structure-building-cutout';
import type { WorldgenGenerateRequest } from '../src/client/worker-bridge';
import { createStructureIndex, type StructurePlacement } from '../src/kernel/structure-index';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const rect = (a: number, b: number, c: number, d: number): [number, number][] => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const context = { origin: [0, 0] as [number, number], tileSize: 200 };
const baseCutout = { outline: rect(-10, -10, 10, 10), basis: 'Modeled site boundary' };
const entry: StructurePlacement = {
  id: 'shrine',
  title: 'Shrine',
  asset: 'test.shrine',
  anchor: worldToWgs84(1, 50, 60),
  datum: 'sea-level',
  bounds: [-0.01, -0.01, 0.01, 0.01],
  minLevel: 0,
  status: 'preview',
  source: 'https://example.com',
  replaceFootprint: true,
  buildingCutout: baseCutout,
};
const tile = () => ({
  ...createEmptyTerrainSemanticTile(),
  buildings: [
    { id: 'merged', height: 9, polygons: [{ outer: rect(0.1, 0.1, 0.6, 0.6) }] },
    { id: 'part', height: 35, polygons: [{ outer: rect(0.23, 0.28, 0.27, 0.32) }] },
    { id: 'neighbor', height: 14, polygons: [{ outer: rect(0.7, 0.1, 0.8, 0.2) }] },
  ],
});

describe('explicit landmark building cutouts', () => {
  it('replaces a nearly covered whole building without trimming an overlapping neighbor', () => {
    const source = {
        ...createEmptyTerrainSemanticTile(),
        buildings: [
          { id: 'stadium', polygons: [{ outer: rect(0, 0, 1, 1) }] },
          { id: 'pavilion', polygons: [{ outer: rect(0.995, 0, 1.5, 1) }] },
        ],
      },
      before = structuredClone(source);
    const result = withoutBuildingCutouts(
      source,
      context,
      [],
      [
        {
          outlines: [rect(-1, -1, 199.8, 201)],
          minimumCoverage: 0.995,
        },
      ],
    );
    expect(result.buildings).toEqual([source.buildings[1]]);
    expect(result.buildings[0]).toBe(source.buildings[1]);
    expect(source).toEqual(before);
  });
  it('clips generalized merged blocks instead of retaining the original stadium under a model', () => {
    const source = { ...tile(), buildingsGeneralized: true };
    const result = withoutBuildingCutouts(
      source,
      context,
      [],
      [{ outlines: [rect(40, 50, 60, 70)], minimumCoverage: 0.995 }],
    );
    expect(result.buildings.map((b) => b.id)).toEqual(['merged', 'neighbor']);
    expect(result.buildings[0]?.polygons[0]?.holes).toHaveLength(1);
    expect(result.buildings[1]).toBe(source.buildings[2]);
    expect(source.buildings).toHaveLength(3);
  });
  it('measures all components and holes, without counting overlapping masks twice', () => {
    const source = {
      ...createEmptyTerrainSemanticTile(),
      buildings: [
        {
          id: 'parts',
          polygons: [
            { outer: rect(0, 0, 1, 1), holes: [rect(0.1, 0.1, 0.9, 0.9)] },
            { outer: rect(2, 0, 3, 1) },
          ],
        },
      ],
    };
    const first = rect(-1, -1, 201, 201);
    expect(
      withoutBuildingCutouts(
        source,
        context,
        [],
        [{ outlines: [first, first], minimumCoverage: 0.4 }],
      ),
    ).toBe(source);
    expect(
      withoutBuildingCutouts(
        source,
        context,
        [],
        [{ outlines: [first, first, rect(399, -1, 601, 201)], minimumCoverage: 0.995 }],
      ).buildings,
    ).toEqual([]);
  });
  it('keeps coverage decisions separate for independently placed landmarks', () => {
    const source = {
      ...createEmptyTerrainSemanticTile(),
      buildings: [{ polygons: [{ outer: rect(0, 0, 1, 1) }] }],
    };
    expect(
      withoutBuildingCutouts(
        source,
        context,
        [],
        [
          { outlines: [rect(-1, -1, 102, 201)], minimumCoverage: 0.995 },
          { outlines: [rect(98, -1, 201, 201)], minimumCoverage: 0.995 },
        ],
      ),
    ).toBe(source);
  });
  it.each([
    0,
    -0.1,
    1.001,
    NaN,
    Infinity,
  ])('rejects invalid whole-building coverage: %s', (minimumCoverage) => {
    expect(() =>
      createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'invalid',
        entries: [{ ...entry, buildingCutout: { ...baseCutout, minimumCoverage } }],
      }),
    ).toThrow(/building cutout/);
  });
  it('uses independent masks without clearing a mapped building in their gap', () => {
    const source = {
        ...createEmptyTerrainSemanticTile(),
        buildings: [
          { id: 'west', height: 4, polygons: [{ outer: rect(0.15, 0.25, 0.2, 0.3) }] },
          { id: 'gap', height: 8, polygons: [{ outer: rect(0.24, 0.25, 0.26, 0.3) }] },
          { id: 'east', height: 6, polygons: [{ outer: rect(0.3, 0.25, 0.35, 0.3) }] },
        ],
      },
      mask = {
        ...entry,
        buildingCutout: {
          outline: rect(-20, -10, 20, 0),
          outlines: [rect(-21, -11, -9, 1), rect(9, -11, 21, 1)],
          basis: 'Two independent mapped buildings',
        },
      };
    const outlines = structureBuildingCutouts(mask, 1),
      result = withoutBuildingCutouts(source, context, outlines);
    expect(outlines).toHaveLength(2);
    expect(result.buildings.map((b) => b.id)).toEqual(['gap']);
    expect(result.buildings[0]).toBe(source.buildings[1]);
    expect(source.buildings).toHaveLength(3);
    expect(() =>
      createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'test',
        entries: [mask],
      }),
    ).not.toThrow();
    for (const invalid of [
      [],
      Array.from({ length: 65 }, () => rect(0, 0, 1, 1)),
      [
        [
          [0, 0],
          [1, 1],
          [0, 1],
          [1, 0],
        ],
      ],
    ])
      expect(() =>
        createStructureIndex({
          format: 'molen/structure-placements@1',
          title: 'test',
          entries: [
            {
              ...mask,
              buildingCutout: { ...mask.buildingCutout, outlines: invalid as [number, number][][] },
            },
          ],
        }),
      ).toThrow(/building cutout/);
  });
  it('preserves the remainder and attributes of a merged building and never mutates the source tile', () => {
    const source = tile(),
      before = structuredClone(source),
      mask = structureBuildingCutout(entry, 1);
    if (!mask) throw Error('Missing fixture cutout');
    const result = withoutBuildingCutouts(source, context, [mask]);
    expect(result.buildings.map((b) => b.id)).toEqual(['merged', 'neighbor']);
    const merged = result.buildings[0];
    if (!merged) throw Error('Lost merged building');
    expect(merged.height).toBe(9);
    expect(merged.polygons[0]?.holes).toHaveLength(1);
    expect(merged.polygons.reduce((n, p) => n + polygonArea(p), 0) * 40000).toBeCloseTo(9600, 6);
    expect(result.buildings[1]).toBe(source.buildings[2]);
    expect(source).toEqual(before);
    expect(withoutBuildingCutouts(source, context, [])).toBe(source);
  });
  it('uses model yaw and nonuniform scale in world coordinates', () => {
    const p = structureBuildingCutout({ ...entry, heading: Math.PI / 2, scale: [2, 1, 3] }, 1);
    if (!p) throw Error('Missing fixture cutout');
    expect(p[0]?.[0]).toBeCloseTo(20);
    expect(p[0]?.[1]).toBeCloseTo(80);
    expect(p[2]?.[0]).toBeCloseTo(80);
    expect(p[2]?.[1]).toBeCloseTo(40);
  });
  it('keeps holes and disconnected remnants when a mask crosses the map feature', () => {
    const source = {
      ...createEmptyTerrainSemanticTile(),
      buildings: [
        { height: 10, polygons: [{ outer: rect(0, 0, 1, 1), holes: [rect(0.1, 0.1, 0.2, 0.2)] }] },
      ],
    };
    const result = withoutBuildingCutouts(source, context, [rect(90, -10, 110, 210)]);
    expect(result.buildings[0]?.polygons).toHaveLength(2);
    expect(result.buildings[0]?.polygons.reduce((n, p) => n + polygonArea(p), 0)).toBeCloseTo(0.89);
  });
  it('requires a valid site boundary and geographic bounds', () => {
    const doc = {
      format: 'molen/structure-placements@1' as const,
      title: 'test',
      entries: [{ ...entry, bounds: undefined }],
    };
    expect(() => createStructureIndex(doc)).toThrow(/building cutout/);
    expect(() =>
      createStructureIndex({
        ...doc,
        entries: [
          {
            ...entry,
            buildingCutout: {
              outline: [
                [0, 0],
                [1, 1],
                [0, 1],
                [1, 0],
              ],
              basis: 'crossed',
            },
          },
        ],
      }),
    ).toThrow(/building cutout/);
  });
  it.each([
    { success: true, minimumCoverage: undefined },
    { success: false, minimumCoverage: undefined },
    { success: true, minimumCoverage: 0.995 },
    { success: false, minimumCoverage: 0.995 },
    { success: true, minimumCoverage: 0.995, generalized: true },
    { success: false, minimumCoverage: 0.995, generalized: true },
  ])('changes map buildings only after a successful load: %j', async ({
    success,
    minimumCoverage,
    generalized,
  }) => {
    const source = { ...tile(), buildingsGeneralized: generalized ?? false },
      seen: WorldgenGenerateRequest[] = [];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const models = new ModelLibrary(async () => {
      if (!success) throw Error('Unavailable');
      return new THREE.Group().add(
        new THREE.Mesh(new THREE.BoxGeometry(20, 30, 20), new THREE.MeshStandardMaterial()),
      );
    });
    const renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Site',
        entries: [{ ...entry, buildingCutout: { ...baseCutout, minimumCoverage } }],
      }),
      structureModels: models,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request) => {
          seen.push(request);
          return {
            placements: [],
            records: [],
            stats: emptyWorldgenStats(),
            hash: 'sha256:empty',
            skippedByOwnership: 0,
            clippedPieces: 0,
          };
        },
        dispose() {},
      },
    });
    const ctx = {
      ...context,
      address: { level: 3, x: 0, z: 0 },
      pyramid: {
        name: 'cutout',
        origin: [0, 0],
        rootSize: 1600,
        minLevel: 0,
        maxLevel: 3,
        tileResolution: 3,
        height: { min: 0, max: 20 },
        layers: [],
        skirts: false,
      },
      descriptor: {},
      heightfield: new Heightfield(new Float32Array(9), 3, 3, {
        origin: [0, 0],
        worldSize: [200, 200],
        height: { min: 0, max: 20 },
      }),
      signal: new AbortController().signal,
    } as TerrainPyramidTileLayerContext;
    try {
      const root = await renderers.humanFeatures.createTile(source, ctx);
      const request = seen.find((r) => r.features?.buildings);
      expect(request).toBeDefined();
      if (!request) throw Error('Missing building request');
      expect(request.tile.buildings.map((b) => b.id)).toEqual(
        success ? ['merged', 'neighbor'] : ['merged', 'part', 'neighbor'],
      );
      expect(request.tile.buildings[0]?.polygons[0]?.holes?.length ?? 0).toBe(
        success && (minimumCoverage === undefined || generalized) ? 1 : 0,
      );
      if (minimumCoverage !== undefined && !generalized)
        expect(request.tile.buildings[0]).toBe(source.buildings[0]);
      expect(source.buildings).toHaveLength(3);
      if (root) renderers.humanFeatures.disposeTile?.(root);
      expect(withoutBuildingCutouts(source, context, [])).toBe(source);
    } finally {
      renderers.dispose();
      models.dispose();
      warn.mockRestore();
    }
  });
});
