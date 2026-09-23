import { describe, expect, it } from 'vitest';
import {
  createProfiledTerrainPackageSemanticLayers,
  createTerrainPackageSemanticLayers,
} from '../src/package-semantic-client';
import type { TerrainPackageDescriptor, TerrainTileArchive } from '../src/package-types';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { createEmptyTerrainSemanticTile } from '../src/semantic-types';

function descriptor(semantics = true): TerrainPackageDescriptor {
  return {
    format: 'molen/terrain-package@1',
    name: 'semantic-test',
    version: '1',
    coordinateSpace: { kind: 'local', units: 'meters', bounds: [0, 0, 1024, 1024] },
    tileMatrix: {
      scheme: 'xyz',
      minLevel: 0,
      maxLevel: 10,
      rootTiles: [1, 1],
      tileResolution: 33,
    },
    elevation: {
      source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
      encoding: 'png16',
      height: { min: 0, max: 100 },
    },
    ...(semantics
      ? {
          landcover: {
            source: { kind: 'pmtiles' as const, path: 'world.pmtiles' },
            encoding: 'mvt' as const,
            layer: 'landcover' as const,
            profile: 'protomaps-basemap@1' as const,
          },
          features: {
            source: { kind: 'pmtiles' as const, path: 'world.pmtiles' },
            encoding: 'mvt' as const,
            layers: ['water', 'transportation', 'building'] as const,
            profile: 'protomaps-basemap@1' as const,
          },
        }
      : {}),
    attribution: [{ text: 'Test', license: 'CC0-1.0' }],
    provenance: {
      compiler: 'test',
      compilerVersion: '1',
      sources: [{ id: 'test', release: '1' }],
    },
    files: [
      {
        path: 'elevation.pmtiles',
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
        bytes: 1,
      },
    ],
  };
}

const archive: TerrainTileArchive = {
  async getHeader() {
    return { minZoom: 2, maxZoom: 8, tileType: 1 };
  },
  async getZxy(): Promise<undefined> {
    return undefined;
  },
};

describe('terrain package semantic layer wiring', () => {
  it('joins separate sidecars for Human surfaces and mapped trees in classification', async () => {
    const pkg = descriptor();
    if (pkg.landcover) pkg.landcover.source = { kind: 'pmtiles', path: 'land.pmtiles' };
    const localArchive: TerrainTileArchive = {
      ...archive,
      async getZxy() {
        return { data: new Uint8Array([1]).buffer };
      },
    };
    if (pkg.features) pkg.features.layers = [...pkg.features.layers, 'poi'];
    let parking = 0;
    let trees = 0;
    const opened = await createTerrainPackageSemanticLayers(pkg, {
      landcoverArchive: localArchive,
      featuresArchive: { ...localArchive },
      decoder: {
        decode: (_data, context) => {
          const tile = createEmptyTerrainSemanticTile();
          if (context.content === 'landcover')
            tile.landcover.push({
              class: 'parking',
              polygons: [
                {
                  outer: [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                  ],
                },
              ],
            });
          else tile.pois = [{ id: 1, class: 'tree', point: [0.5, 0.5], height: 7 }];
          return tile;
        },
      },
      landcoverLayer: {
        renderer: {
          createTile(tile) {
            trees = tile.pois?.length ?? 0;
            return undefined;
          },
        },
      },
      featuresLayer: {
        renderer: {
          createTile(tile) {
            parking = tile.landcover.length;
            return undefined;
          },
        },
      },
    });
    await opened.layers
      .find((layer) => layer.category === 'human-feature')
      ?.createTile({
        address: { level: 8, x: 0, z: 0 },
        signal: new AbortController().signal,
      } as TerrainPyramidTileLayerContext);
    expect(parking).toBe(1);
    await opened.layers
      .find((layer) => layer.category === 'classification')
      ?.createTile({
        address: { level: 8, x: 0, z: 0 },
        signal: new AbortController().signal,
      } as TerrainPyramidTileLayerContext);
    expect(trees).toBe(1);
  });
  it('keeps hydrology at every available level while bounding optional decoration', async () => {
    const opened = await createTerrainPackageSemanticLayers(descriptor(), {
      decoder: { decode: () => createEmptyTerrainSemanticTile() },
      landcoverArchive: archive,
      featuresArchive: archive,
    });
    expect(opened.layers).toHaveLength(3);
    expect(opened.layers[0]).toMatchObject({
      id: 'land-classification',
      category: 'classification',
      visible: false,
      minLevel: 6,
      maxLevel: 8,
    });
    expect(opened.layers[1]).toMatchObject({
      id: 'water-features',
      category: 'hydrology',
      visible: false,
      minLevel: 2,
      maxLevel: 8,
    });
    expect(opened.layers[2]).toMatchObject({
      id: 'human-features',
      category: 'human-feature',
      visible: false,
      minLevel: 7,
      maxLevel: 8,
    });
    expect(opened.semantics.landcover?.archive).toBe(archive);
    expect(opened.semantics.features?.archive).toBe(archive);
  });

  it('supports renderer/bound overrides and an entirely bare package', async () => {
    const renderer = { createTile: () => undefined };
    const customized = await createTerrainPackageSemanticLayers(descriptor(), {
      decoder: { decode: () => createEmptyTerrainSemanticTile() },
      landcoverArchive: archive,
      featuresArchive: archive,
      featuresLayer: { id: 'custom-features', minLevel: 4, maxLevel: 7, renderer },
    });
    expect(customized.layers[2]).toMatchObject({
      id: 'custom-features',
      minLevel: 4,
      maxLevel: 7,
    });

    const bare = await createTerrainPackageSemanticLayers(descriptor(false), {
      decoder: { decode: () => createEmptyTerrainSemanticTile() },
    });
    expect(bare.layers).toEqual([]);
  });

  it('selects a decoder only for an explicitly supported package profile', async () => {
    const profiled = await createProfiledTerrainPackageSemanticLayers(descriptor(), {
      landcoverArchive: archive,
      featuresArchive: archive,
    });
    expect(profiled.layers).toHaveLength(3);

    const unknown = descriptor();
    if (unknown.features !== undefined) delete unknown.features.profile;
    await expect(
      createProfiledTerrainPackageSemanticLayers(unknown, {
        landcoverArchive: archive,
        featuresArchive: archive,
      }),
    ).rejects.toThrow(/supported profile or an explicit decoder/);
  });
});
