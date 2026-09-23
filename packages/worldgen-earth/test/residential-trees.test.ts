import {
  createEmptyTerrainSemanticTile,
  pointInPolygon,
  type TerrainSemanticTile,
  webMercatorScaleAtLatitude,
  wgs84ToWebMercator,
} from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, generateWorldgenBatch, type Vec2 } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { createRegionResolver } from '../src/kernel/region';
import type { RegionAtlasDoc } from '../src/kernel/region-atlas-types';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultAtlas, loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const atlas = await loadDefaultAtlas();
const metersPerUnit = webMercatorScaleAtLatitude(47.6);
function geometry(lon = -122.03, lat = 47.61): TileGeometry {
  const [x, z] = wgs84ToWebMercator(lon, lat);
  return {
    level: 15,
    x: 0,
    z: 0,
    originX: x * metersPerUnit,
    originZ: z * metersPerUnit,
    size: 200,
    metersPerUnit,
    levelBelowMax: 0,
  };
}
const rect = (x: number, z: number, w: number, h: number): Vec2[] => [
  [x, z],
  [x + w, z],
  [x + w, z + h],
  [x, z + h],
];
function neighborhood(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.buildings = Array.from({ length: 9 }, (_, i) => ({
    id: i,
    class: 'house',
    polygons: [{ outer: rect(0.18 + (i % 3) * 0.25, 0.18 + Math.floor(i / 3) * 0.25, 0.06, 0.05) }],
  }));
  return tile;
}
function batch(tile: TerrainSemanticTile, geom = geometry(), doc = atlas) {
  return semanticTileToBatch(tile, geom, {
    pack,
    atlas: doc,
    regions: createRegionResolver(doc, { metersPerUnit }),
    features: { buildings: false, scatter: true },
  });
}
function trees(tile: TerrainSemanticTile, geom = geometry(), doc = atlas, keep = 1) {
  const input = batch(tile, geom, doc);
  if (input.scatter) input.scatter.keep = keep;
  return generateWorldgenBatch({ ...input, ground: FLAT_GROUND }).placements.flatMap((set) =>
    Array.from({ length: set.count }, (_, i) => ({
      model: set.modelRef,
      x: set.data[i * 10] as number,
      z: set.data[i * 10 + 2] as number,
      data: [...set.data.slice(i * 10, (i + 1) * 10)],
    })),
  );
}

describe('residential tree infill', () => {
  it('fills unmapped PNW yards deterministically, including the scatter-only worker pass', () => {
    const tile = neighborhood();
    const result = trees(tile);
    expect(result.length).toBeGreaterThan(80);
    expect(result.length).toBeLessThan(300);
    expect(trees(tile)).toEqual(result);
    tile.buildings.reverse();
    expect(trees(tile)).toEqual(result);
    // Every footprint, including neighboring houses, remains clear.
    for (const tree of result)
      for (const building of tile.buildings) {
        const ring = building.polygons[0]?.outer as Vec2[];
        const min = ring[0] as Vec2,
          max = ring[2] as Vec2;
        const distance = Math.hypot(
          Math.max(min[0] * 200 - tree.x, 0, tree.x - max[0] * 200),
          Math.max(min[1] * 200 - tree.z, 0, tree.z - max[1] * 200),
        );
        expect(distance).toBeGreaterThan(3);
      }
    expect(batch(tile).buildings).toEqual([]);
  });

  it('uses the house identity and keeps thinning nested without moving surviving trees', () => {
    const tile = neighborhood();
    const full = trees(tile);
    const coarse = trees(tile, geometry(), atlas, 0.3);
    expect(coarse.length).toBeGreaterThan(0);
    expect(coarse.length).toBeLessThan(full.length);
    for (const tree of coarse) expect(full).toContainEqual(tree);
    const lighter = structuredClone(atlas);
    const pnw = lighter.regions.find((region) => region.id === 'us.pnw');
    if (pnw) pnw.bindings.treeFillFactor = 0.3;
    for (const tree of trees(tile, geometry(), lighter)) expect(full).toContainEqual(tree);
    for (const building of tile.buildings) building.id = `other:${building.id}`;
    expect(trees(tile)).not.toEqual(full);
  });

  it('does not infer canopy in deserts, unconfigured regions, or generalized building data', () => {
    const tile = neighborhood();
    expect(trees(tile, geometry(-112, 33.45))).toEqual([]);
    expect(trees(tile, geometry(20, 20))).toEqual([]);
    tile.buildingsGeneralized = true;
    expect(trees(tile)).toEqual([]);
  });

  it('protects roads, water, parking, sports fields, mapped trees and existing forest', () => {
    const tile = neighborhood();
    tile.transportation = [
      {
        class: 'residential',
        width: 6,
        lines: [
          [
            [0, 0.36],
            [1, 0.36],
          ],
        ],
      },
    ];
    tile.water = [{ class: 'water', polygons: [{ outer: rect(0.32, 0, 0.06, 1) }] }];
    tile.landcover = [
      { class: 'residential', polygons: [{ outer: rect(0, 0, 1, 1) }] },
      ...['parking', 'pitch', 'forest', 'sand', 'farmland'].map((kind, i) => ({
        class: kind,
        polygons: [{ outer: rect(i * 0.2, 0.8, 0.2, 0.2) }],
      })),
    ];
    tile.pois = [{ id: 'tree', class: 'tree', point: [0.5, 0.5], crownDiameter: 12 }];
    const input = batch(tile);
    const patches = input.scatter?.polygons.filter((polygon) => polygon.seed !== undefined) ?? [];
    expect(patches.length).toBeGreaterThan(0);
    for (const patch of patches) expect(patch.ring.every((p) => p[1] <= 160.00001)).toBe(true);
    const result = trees(tile).filter(
      (tree) =>
        tree.z < 159 && tree.model.startsWith('builtin:tree.') && !tree.model.includes('.mapped.'),
    );
    expect(result.length).toBeGreaterThan(0);
    for (const tree of result) {
      expect(Math.abs(tree.z - 72)).toBeGreaterThan(7);
      expect(tree.x < 61 || tree.x > 79).toBe(true);
      expect(Math.hypot(tree.x - 100, tree.z - 100)).toBeGreaterThan(6);
    }
  });

  it('skips non-houses and fully occupied sites, and honors mapped landcover holes', () => {
    const tile = neighborhood();
    for (const building of tile.buildings) building.class = 'warehouse';
    expect(trees(tile)).toEqual([]);
    for (const building of tile.buildings) building.class = 'building';
    expect(trees(tile).length).toBeGreaterThan(0); // Small unclassified footprints remain usable.
    tile.buildings.push({ id: 100, class: 'warehouse', polygons: [{ outer: rect(0, 0, 1, 1) }] });
    expect(trees(tile)).toEqual([]);
    tile.buildings.pop();
    const opening = rect(0.1, 0.1, 0.8, 0.8);
    tile.landcover = [
      { class: 'parking', polygons: [{ outer: rect(0, 0, 1, 1), holes: [opening] }] },
    ];
    const result = trees(tile);
    expect(result.length).toBeGreaterThan(0);
    for (const tree of result)
      expect(pointInPolygon([tree.x / 200, tree.z / 200], { outer: opening })).toBe(true);
  });

  it('rejects steep ground and obeys instance budgets', () => {
    const input = batch(neighborhood());
    const steep = generateWorldgenBatch({
      ...input,
      ground: { ...FLAT_GROUND, slopeAt: () => 0.9 },
    });
    expect(steep.placements).toEqual([]);
    const capped = generateWorldgenBatch({
      ...input,
      ground: FLAT_GROUND,
      budgets: { maxInstances: 5 },
    });
    expect(capped.placements.reduce((n, set) => n + set.count, 0)).toBe(5);
  });

  it('gives a buffered home the same canopy in neighboring tiles with no duplicate trees', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = [
      {
        id: 'edge-house',
        class: 'house',
        polygons: [{ outer: rect(394 / 800, 194 / 800, 12 / 800, 10 / 800) }],
      },
    ];
    const geom = { ...geometry(), size: 800 };
    const keys = (rows: ReturnType<typeof trees>, offset = 0) =>
      rows.map((row) => `${row.model}:${(row.x + offset).toFixed(3)},${row.z.toFixed(3)}`);
    const whole = keys(trees(tile, geom)).sort();
    expect(whole.length).toBeGreaterThan(10);
    const split = [0, 400]
      .flatMap((offset) => {
        const part = structuredClone(tile);
        for (const feature of part.buildings)
          for (const polygon of feature.polygons)
            polygon.outer = polygon.outer.map(([x, z]) => [(x * 800 - offset) / 400, z * 2]);
        return keys(trees(part, { ...geom, size: 400, originX: geom.originX + offset }), offset);
      })
      .sort();
    expect(new Set(split).size).toBe(split.length);
    expect(split).toEqual(whole);
  });

  it('resolves fill for each house even when only one region intersects a boundary tile', () => {
    const tile = neighborhood(),
      geom = geometry();
    const local: RegionAtlasDoc = {
      ...atlas,
      default: { buildings: [], scatter: 'molen.worldgen.scatter.pnw', treeFillFactor: 0 },
      regions: [
        {
          id: 'local',
          priority: 1,
          bbox: [-122.04, 47.6, -122.029, 47.62],
          bindings: { buildings: [], treeFillFactor: 1 },
        },
      ],
    };
    const region = createRegionResolver(local, { metersPerUnit });
    const input = batch(tile, geom, local);
    expect(input.scatter?.polygons.some((p) => p.seed !== undefined)).toBe(true);
    expect(
      region.intersecting([geom.originX, geom.originZ, geom.originX + 200, geom.originZ + 200]),
    ).toHaveLength(1);
    expect(input.scatter?.polygons.filter((p) => p.seed !== undefined).length).toBe(3);
  });
});
