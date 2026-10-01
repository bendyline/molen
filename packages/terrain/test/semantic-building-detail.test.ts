import { describe, expect, it } from 'vitest';
import { createTerrainPackageSemanticLayers } from '../src/package-semantic-client';
import type { TerrainPackageDescriptor, TerrainTileArchive } from '../src/package-types';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import type { TerrainPyramidTileAddress } from '../src/pyramid-types';
import {
  composeTerrainBuildingDetail,
  createBuildingDetailTerrainSemanticSource,
} from '../src/semantic-building-detail';
import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
  type TerrainSemanticRing,
  type TerrainSemanticTile,
} from '../src/semantic-types';

function rect(minU: number, minV: number, maxU: number, maxV: number): TerrainSemanticRing {
  return [
    [minU, minV],
    [maxU, minV],
    [maxU, maxV],
    [minU, maxV],
  ];
}

function tileWith(buildings: TerrainBuildingFeature[], generalized = false): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.buildings = buildings;
  if (generalized) tile.buildingsGeneralized = true;
  return tile;
}

function bounds(feature: TerrainBuildingFeature): [number, number, number, number] {
  const points = feature.polygons.flatMap((polygon) => polygon.outer);
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}

const parent: TerrainPyramidTileAddress = { level: 14, x: 10, z: 20 };
// Children of 14/10/20 at level 15: x 20-21, z 40-41.
const children = (tiles: Record<string, TerrainSemanticTile | undefined>) =>
  [
    [20, 40],
    [21, 40],
    [20, 41],
    [21, 41],
  ].map(([x, z]) => ({ x: x as number, z: z as number, tile: tiles[`${x}/${z}`] }));

describe('building detail composition', () => {
  it('keeps a house that straddles a detail seam once, whole', () => {
    // A small house across the vertical seam: complete in both left and right children (each
    // keeps it inside its buffer), at child-local coordinates offset by one tile.
    const house = (offset: number): TerrainBuildingFeature => ({
      id: 7,
      class: 'building',
      polygons: [{ outer: rect(0.98 - offset, 0.4, 1.02 - offset, 0.45) }],
    });
    const composed = composeTerrainBuildingDetail(
      tileWith([], true),
      parent,
      15,
      children({
        '20/40': tileWith([house(0)]),
        '21/40': tileWith([house(1)]),
        '20/41': tileWith([]),
        '21/41': tileWith([]),
      }),
    );
    expect(composed?.buildings).toHaveLength(1);
    const [minU, minV, maxU, maxV] = bounds(composed?.buildings[0] as TerrainBuildingFeature);
    expect([minU, minV, maxU, maxV]).toEqual([0.49, 0.2, 0.51, 0.225]);
    expect(composed?.buildingsGeneralized).toBe(false);
    expect(composed?.buildingSourceLevel).toBe(15);
  });

  it('joins the clipped copies of a large footprint into one', () => {
    // A long hall from u 0.3 to 0.7 of the parent. Each child clipped it at its buffer (1/64).
    const buffer = 1 / 64;
    const hall = (minU: number, maxU: number): TerrainBuildingFeature => ({
      id: 'hall',
      class: 'building',
      height: 12,
      polygons: [{ outer: rect(minU, 0.2, maxU, 0.3) }],
    });
    const composed = composeTerrainBuildingDetail(
      undefined,
      parent,
      15,
      children({
        '20/40': tileWith([hall(0.6, 1 + buffer)]),
        '21/40': tileWith([hall(-buffer, 0.4)]),
        '20/41': tileWith([]),
        '21/41': tileWith([]),
      }),
    );
    expect(composed?.buildings).toHaveLength(1);
    const feature = composed?.buildings[0] as TerrainBuildingFeature;
    expect(feature.height).toBe(12);
    expect(feature.polygons).toHaveLength(1);
    const [minU, , maxU] = bounds(feature);
    expect(minU).toBeCloseTo(0.3, 9);
    expect(maxU).toBeCloseTo(0.7, 9);
  });

  it('gives a footprint without an id to the detail tile holding its center', () => {
    const shed = (offset: number): TerrainBuildingFeature => ({
      class: 'building',
      polygons: [{ outer: rect(0.97 - offset, 0.1, 1.01 - offset, 0.12) }],
    });
    const composed = composeTerrainBuildingDetail(
      undefined,
      parent,
      15,
      children({
        '20/40': tileWith([shed(0)]),
        '21/40': tileWith([shed(1)]),
        '20/41': tileWith([]),
        '21/41': tileWith([]),
      }),
    );
    expect(composed?.buildings).toHaveLength(1);
    expect(bounds(composed?.buildings[0] as TerrainBuildingFeature)[0]).toBeCloseTo(0.485, 9);
  });

  it('keeps the coarse buildings where the detail sidecar has no tiles', () => {
    const coarse = tileWith(
      [
        { id: 'block-nw', polygons: [{ outer: rect(0.1, 0.1, 0.3, 0.3) }] },
        { id: 'block-se', polygons: [{ outer: rect(0.7, 0.7, 0.9, 0.9) }] },
      ],
      true,
    );
    coarse.pois = [
      { id: 'cafe-nw', class: 'cafe', point: [0.2, 0.2] },
      { id: 'cafe-se', class: 'cafe', point: [0.8, 0.8] },
    ];
    const detailed = tileWith([{ id: 'house', polygons: [{ outer: rect(0.2, 0.2, 0.3, 0.3) }] }]);
    detailed.pois = [
      { id: 'bakery', class: 'bakery', point: [0.5, 0.5] },
      { id: 'buffered', class: 'bakery', point: [1.01, 0.5] },
    ];
    const composed = composeTerrainBuildingDetail(
      coarse,
      parent,
      15,
      // Only the north-west child exists.
      children({ '20/40': detailed }),
    );
    expect(composed?.buildings.map((b) => b.id).sort()).toEqual(['block-se', 'house']);
    expect(composed?.pois?.map((p) => p.id).sort()).toEqual(['bakery', 'cafe-se']);
    expect(composed?.pois?.find((p) => p.id === 'bakery')?.point).toEqual([0.25, 0.25]);
    // Partly detailed: still treated as generalized, but the footprints say where they came from.
    expect(composed?.buildingsGeneralized).toBe(true);
    expect(composed?.buildingSourceLevel).toBe(15);
    // Roads and land use are the coarse tile's.
    expect(composed?.transportation).toBe(coarse.transportation);
  });

  it('returns the coarse tile untouched when no detail tile exists', () => {
    const coarse = tileWith([{ id: 1, polygons: [{ outer: rect(0.1, 0.1, 0.2, 0.2) }] }], true);
    expect(composeTerrainBuildingDetail(coarse, parent, 15, children({}))).toBe(coarse);
  });
});

describe('building detail source', () => {
  const coarse = (): TerrainSemanticTile =>
    tileWith([{ id: 'merged', polygons: [{ outer: rect(0, 0, 1, 1) }] }], true);
  const house = (address: TerrainPyramidTileAddress): TerrainSemanticTile =>
    tileWith([
      { id: `house-${address.x}-${address.z}`, polygons: [{ outer: rect(0.4, 0.4, 0.6, 0.6) }] },
    ]);

  it('composes tiles within maxDepth, reuses detail tiles, and leaves coarser tiles alone', async () => {
    const detailLoads: string[] = [];
    const source = createBuildingDetailTerrainSemanticSource(
      { load: async () => coarse() },
      {
        load: async (address) => {
          detailLoads.push(`${address.level}/${address.x}/${address.z}`);
          return house(address);
        },
      },
      { level: 15, maxDepth: 2 },
    );
    const signal = new AbortController().signal;
    const level13 = await source.load({ level: 13, x: 5, z: 10 }, signal);
    expect(level13?.buildings).toHaveLength(16);
    expect(detailLoads).toHaveLength(16);
    // A level-14 tile inside it reads four of the same detail tiles again from the cache.
    const level14 = await source.load({ level: 14, x: 10, z: 20 }, signal);
    expect(level14?.buildings).toHaveLength(4);
    expect(detailLoads).toHaveLength(16);
    const level12 = await source.load({ level: 12, x: 2, z: 5 }, signal);
    expect(level12?.buildings.map((b) => b.id)).toEqual(['merged']);
    expect(detailLoads).toHaveLength(16);
  });

  it('serves tiles finer than the detail level from the covering detail tile', async () => {
    const source = createBuildingDetailTerrainSemanticSource(
      { load: async () => coarse() },
      { load: async (address) => house(address) },
      { level: 15 },
    );
    const tile = await source.load({ level: 16, x: 41, z: 81 }, new AbortController().signal);
    // The house's center (0.5, 0.5) of 15/20/40 lies in the 16/41/81 quadrant (u, v ≥ 0.5).
    expect(tile?.buildings.map((b) => b.id)).toEqual(['house-20-40']);
    expect(tile?.buildingsGeneralized).toBe(false);
  });
});

describe('building detail in a terrain package', () => {
  function descriptor(): TerrainPackageDescriptor {
    return {
      format: 'molen/terrain-package@1',
      name: 'detail-test',
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
      features: {
        source: { kind: 'pmtiles', url: 'https://tiles.example/features.pmtiles' },
        encoding: 'mvt',
        layers: ['transportation', 'building'],
        profile: 'protomaps-basemap@1',
        buildingDetail: {
          source: { kind: 'pmtiles', url: 'https://tiles.example/detail.pmtiles' },
          level: 11,
        },
      },
      attribution: [{ text: 'Test', license: 'CC0-1.0' }],
      provenance: { compiler: 'test', compilerVersion: '1', sources: [{ id: 't', release: '1' }] },
      files: [
        {
          path: 'elevation.pmtiles',
          sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          bytes: 1,
        },
      ],
    };
  }

  const archive = (minZoom: number, maxZoom: number, tag: string): TerrainTileArchive => ({
    async getHeader() {
      return { minZoom, maxZoom, tileType: 1 };
    },
    async getZxy(level) {
      return level >= minZoom && level <= maxZoom
        ? { data: new TextEncoder().encode(tag).buffer as ArrayBuffer }
        : undefined;
    },
  });

  it('feeds the human-feature layer detail buildings and decodes only buildings for them', async () => {
    const contexts: string[] = [];
    let rendered: TerrainSemanticTile | undefined;
    const opened = await createTerrainPackageSemanticLayers(descriptor(), {
      featuresArchive: archive(0, 9, 'coarse'),
      buildingDetailArchive: archive(11, 11, 'detail'),
      decoder: {
        decode(data, context) {
          const tag = new TextDecoder().decode(data);
          contexts.push(`${tag}@${context.address.level}:${context.layers.join(',')}`);
          return tag === 'detail'
            ? tileWith([
                {
                  id: `h${context.address.x}-${context.address.z}`,
                  polygons: [{ outer: rect(0.4, 0.4, 0.6, 0.6) }],
                },
              ])
            : tileWith([{ id: 'merged', polygons: [{ outer: rect(0, 0, 1, 1) }] }], true);
        },
      },
      featuresLayer: {
        renderer: {
          createTile(tile) {
            rendered = tile;
            return undefined;
          },
        },
      },
    });
    expect(opened.semantics.buildingDetail?.level).toBe(11);
    await opened.layers
      .find((layer) => layer.category === 'human-feature')
      ?.createTile({
        address: { level: 10, x: 3, z: 3 },
        signal: new AbortController().signal,
      } as TerrainPyramidTileLayerContext);
    expect(rendered?.buildings.map((b) => b.id).sort()).toEqual(['h6-6', 'h6-7', 'h7-6', 'h7-7']);
    expect(rendered?.buildingSourceLevel).toBe(11);
    expect(contexts.filter((c) => c.startsWith('detail'))).toEqual(
      Array(4).fill('detail@11:building'),
    );
  });

  it('carries on with the feature tiles when the detail archive is unusable', async () => {
    const opened = await createTerrainPackageSemanticLayers(descriptor(), {
      featuresArchive: archive(0, 9, 'coarse'),
      buildingDetailArchive: archive(12, 14, 'detail'),
      decoder: { decode: () => createEmptyTerrainSemanticTile() },
    });
    expect(opened.semantics.buildingDetail).toBeUndefined();
    expect(opened.semantics.buildingDetailError?.message).toMatch(/do not include level 11/);
    expect(opened.layers.some((layer) => layer.category === 'human-feature')).toBe(true);
    const unreachable = await createTerrainPackageSemanticLayers(descriptor(), {
      featuresArchive: archive(0, 9, 'coarse'),
      buildingDetailArchive: {
        getHeader: () => Promise.reject(new Error('404 archive-set.json')),
        getZxy: async () => undefined,
      },
      decoder: { decode: () => createEmptyTerrainSemanticTile() },
    });
    expect(unreachable.semantics.buildingDetailError?.message).toBe('404 archive-set.json');
  });
});
