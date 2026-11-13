/**
 * Cemetery headstones: rows in sections on a world grid, clear of drives and buildings, owned by
 * one tile each, and admitted by the batch as tinted boxes.
 */
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, generateWorldgenBatch } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { landSiteProps } from '../src/kernel/land-sites';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const SIZE = 400;
function geometry(x = 0, z = 0, overrides: Partial<TileGeometry> = {}): TileGeometry {
  return {
    level: 15,
    x,
    z,
    originX: 4_000_000 + x * SIZE,
    originZ: 3_000_000 + z * SIZE,
    size: SIZE,
    metersPerUnit: 1,
    levelBelowMax: 0,
    ...overrides,
  };
}
const rectangle = (u0: number, v0: number, u1: number, v1: number): TerrainSemanticPolygon => ({
  outer: [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ],
});
function cemetery(polygon = rectangle(-1 / 64, -1 / 64, 65 / 64, 65 / 64)): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.landcover.push({ id: 3, class: 'cemetery', polygons: [polygon] });
  return tile;
}

describe('cemetery headstones', () => {
  it('stands tinted stone boxes in rows across a mapped cemetery', () => {
    const source = cemetery(),
      before = structuredClone(source);
    const stones = landSiteProps(source, geometry());
    expect(source).toEqual(before);
    // 16 hectares of cemetery holds more stones than a tile draws. Observed: 3,000, the limit.
    expect(stones.length).toBeGreaterThan(1500);
    expect(stones.length).toBeLessThanOrEqual(3000);
    expect(new Set(stones.map((stone) => stone.identity)).size).toBe(stones.length);
    // A meter of ground at this latitude (25°) is 1.11 units of the frame.
    const meter = Math.cosh(3_000_200 / 6_378_137);
    for (const stone of stones) {
      expect(stone.model).toBe('builtin:box');
      const [width, height, depth] = (stone.scale as [number, number, number]).map(
        (value) => value / meter,
      ) as [number, number, number];
      expect(width).toBeGreaterThan(0.49);
      expect(width).toBeLessThan(0.91);
      expect(height).toBeGreaterThan(0.11);
      expect(height).toBeLessThan(2.21);
      expect(depth).toBeGreaterThan(0.15);
      // Stone, not paint: every tint is a near-neutral between dark granite and marble.
      const [r, g, b] = stone.color as [number, number, number];
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(0.15);
      expect(Math.min(r, g, b)).toBeGreaterThan(0.4);
      expect(Math.max(r, g, b)).toBeLessThanOrEqual(1);
    }
    // Rows: every stone shares a line, east-west or north-south, with others of its section.
    const tally = (axis: 0 | 1) => {
      const counts = new Map<number, number>();
      for (const stone of stones) {
        const line = Math.round(stone.at[axis] * 100);
        counts.set(line, (counts.get(line) ?? 0) + 1);
      }
      return counts;
    };
    const lines = tally(1),
      columns = tally(0);
    const aligned = stones.filter(
      (stone) =>
        (lines.get(Math.round(stone.at[1] * 100)) ?? 0) >= 4 ||
        (columns.get(Math.round(stone.at[0] * 100)) ?? 0) >= 4,
    );
    // Observed: all but 3 of 3,000 (a row of a thinly filled section can hold three stones).
    expect(aligned.length).toBeGreaterThan(stones.length * 0.95);

    expect(landSiteProps(source, geometry())).toEqual(stones);
    expect(landSiteProps(source, geometry(), { seed: 9 })).not.toEqual(stones);
    expect(landSiteProps(source, geometry(), false)).toEqual([]);
    expect(landSiteProps(source, geometry(0, 0, { levelBelowMax: 1 }))).toEqual([]);
    const park = createEmptyTerrainSemanticTile();
    park.landcover.push({ class: 'park', polygons: [rectangle(0, 0, 1, 1)] });
    expect(landSiteProps(park, geometry())).toEqual([]);
  });

  it('gives each stone to one tile and keeps rows straight across the edge', () => {
    // A band of cemetery across two tiles, small enough that neither tile reaches its limit.
    const band = rectangle(-1 / 64, 0.25, 65 / 64, 0.5);
    const west = landSiteProps(cemetery(band), geometry(0, 0));
    const east = landSiteProps(cemetery(band), geometry(1, 0));
    // Observed: 1,094 stones in the western tile's four hectares.
    expect(west.length).toBeGreaterThan(200);
    expect(east.length).toBeGreaterThan(200);
    for (const list of [west, east])
      for (const stone of list) {
        expect(stone.at[0]).toBeGreaterThanOrEqual(0);
        expect(stone.at[0]).toBeLessThan(SIZE);
      }
    // One wide tile over the same ground holds exactly the stones of the two, where they stand.
    const both = landSiteProps(
      cemetery(rectangle(-1 / 128, 0.125, 129 / 128, 0.25)),
      geometry(0, 0, { size: SIZE * 2 }),
    );
    const placed = (list: typeof west, shift: number) =>
      new Map(
        list.map((stone) => [
          stone.identity,
          [Math.round((stone.at[0] + shift) * 1e6), Math.round(stone.at[1] * 1e6)],
        ]),
      );
    expect(west.length + east.length).toBe(both.length);
    expect(placed(both, 0)).toEqual(new Map([...placed(west, 0), ...placed(east, SIZE)]));
  });

  it('stays inside the cemetery and clear of its drives, buildings and water', () => {
    const tile = cemetery(rectangle(0.2, 0.2, 0.8, 0.8));
    tile.transportation.push({
      class: 'minor_road',
      subclass: 'service',
      lines: [
        [
          [0.2, 0.5],
          [0.8, 0.5],
        ],
      ],
    });
    tile.buildings.push({ class: 'chapel', polygons: [rectangle(0.3, 0.3, 0.36, 0.34)] });
    tile.water.push({ class: 'water', polygons: [rectangle(0.6, 0.6, 0.7, 0.7)] });
    tile.landcover.push({ class: 'wood', polygons: [rectangle(0.6, 0.25, 0.75, 0.4)] });
    const stones = landSiteProps(tile, geometry());
    expect(stones.length).toBeGreaterThan(200);
    let wooded = 0;
    for (const { at } of stones) {
      const u = at[0] / SIZE,
        v = at[1] / SIZE;
      expect(u > 0.2 && u < 0.8 && v > 0.2 && v < 0.8).toBe(true);
      // Two and a half meters inside the boundary, off the drive, and more than a meter from
      // the chapel and the pond.
      expect(Math.min(u - 0.2, 0.8 - u, v - 0.2, 0.8 - v) * SIZE).toBeGreaterThan(2.4);
      expect(Math.abs(v - 0.5) * SIZE).toBeGreaterThan(3);
      expect(u > 0.2975 && u < 0.3625 && v > 0.2975 && v < 0.3425).toBe(false);
      expect(u > 0.5975 && u < 0.7025 && v > 0.5975 && v < 0.7025).toBe(false);
      if (u > 0.6 && u < 0.75 && v > 0.25 && v < 0.4) wooded++;
    }
    // Graves lie under the cemetery's own trees.
    expect(wooded).toBeGreaterThan(0);
  });

  it('reaches the batch with the buildings, tinted, and not with the plants', () => {
    const tile = cemetery();
    const built = semanticTileToBatch(tile, geometry(), {
      pack,
      features: { buildings: true, scatter: false },
    });
    const stones = landSiteProps(tile, geometry());
    expect(built.props).toEqual(stones);
    const output = generateWorldgenBatch({ ...built, ground: FLAT_GROUND });
    const boxes = output.placements.find((set) => set.setId === 'mapped:builtin:box');
    expect(boxes?.count).toBe(stones.length);
    const first = [...stones].sort((a, b) => (a.identity < b.identity ? -1 : 1))[0];
    const [r, g, b] = first?.color as [number, number, number];
    expect([...(boxes?.data.slice(7, 10) ?? [])]).toEqual([
      Math.fround(r),
      Math.fround(g),
      Math.fround(b),
    ]);
    const planted = semanticTileToBatch(tile, geometry(), {
      pack,
      features: { buildings: false, scatter: true },
    });
    expect(planted.props).toEqual([]);
  });
});
