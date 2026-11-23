/**
 * A coarser tile's small footprints become stand-ins in the adapter, without the full
 * per-building pipeline (see splitStandIns in semantic-adapter.ts): which footprints, on which
 * levels, and that every one of them is still drawn.
 */
import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { MAP_OVERRIDE_TAG } from '../src/kernel/map-override-tags';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { generateWorldgenTile } from '../src/kernel/tile-generate';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
/** A 2.4 km tile one level behind the finest. */
const geom: TileGeometry = {
  level: 14,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 2400,
  metersPerUnit: 1,
  levelBelowMax: 1,
};
const flat = {
  sampleHeight: () => 20,
  slopeAt: () => 0,
  normalAt: (): [number, number, number] => [0, 1, 0],
};
/** 300 rectangles in a 20 x 15 grid, each a little larger than the one before. */
function town(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  for (let index = 0; index < 300; index++) {
    const u = 0.05 + (index % 20) * 0.045;
    const v = 0.05 + Math.floor(index / 20) * 0.06;
    const w = (8 + index * 0.05) / 2400;
    const d = 10 / 2400;
    const feature: TerrainBuildingFeature = {
      id: index + 1,
      class: 'building',
      polygons: [
        {
          outer: [
            [u, v],
            [u + w, v],
            [u + w, v + d],
            [u, v + d],
          ],
        },
      ],
    };
    if (index === 7) feature.height = 30;
    tile.buildings.push(feature);
  }
  return tile;
}
/** Vertices for fifty plain buildings: the fifty largest are worked up, the rest stand in. */
const budgets = { maxBuildings: 1000, maxBuildingVertices: 24 * 50, maxStandIns: 1000 };
const adapt = (
  tile: TerrainSemanticTile,
  at: TileGeometry = geom,
  ground: { on: typeof flat | undefined } = { on: flat },
) =>
  semanticTileToBatch(
    tile,
    at,
    { pack, budgets, features: { buildings: true, scatter: false } },
    ground.on,
  );

describe('stand-ins made in the adapter', () => {
  it('works up the largest footprints the vertex budget could draw and boxes the rest', () => {
    const batch = adapt(town());
    expect(batch.buildings).toHaveLength(50);
    expect(batch.standIns).toHaveLength(250);
    // The fifty widest are the last fifty of the grid; they keep the map's order.
    const widths = batch.buildings.map((request) => request.outline[1]?.[0] ?? 0);
    expect(
      batch.buildings.every((request) => {
        const width = (request.outline[1]?.[0] ?? 0) - (request.outline[0]?.[0] ?? 0);
        return width > 8 + 249 * 0.05;
      }),
    ).toBe(true);
    expect(widths).toHaveLength(50);
    // A stand-in is its footprint: ten metres deep, standing on the ground at 20 m.
    for (const box of batch.standIns ?? []) {
      expect(Math.min(box.sx, box.sz)).toBeGreaterThan(7.9);
      expect(Math.max(box.sx, box.sz)).toBeLessThan(21);
      expect(box.y).toBeCloseTo(19.4, 6);
    }
    // The one with a mapped height keeps it; the others take their style's guess.
    const tall = (batch.standIns ?? []).filter((box) => box.sy > 28);
    expect(tall).toHaveLength(1);
  });

  it('draws every footprint: real geometry while the budget lasts, then boxes', () => {
    const output = generateWorldgenTile({
      tile: town(),
      geom,
      ground: flat,
      pack,
      budgets,
      features: { buildings: true, scatter: false, interiors: false },
    });
    expect(output.stats.buildingsIn).toBe(300);
    expect(output.stats.buildingsDropped).toBe(0);
    expect(output.stats.buildingsRendered + output.stats.buildingsBoxed).toBe(300);
    expect(output.stats.buildingsRendered).toBeGreaterThan(0);
    expect(output.stats.buildingsRendered).toBeLessThanOrEqual(50);
    const boxes = output.placements.filter((set) => set.modelRef.startsWith('builtin:box'));
    expect(boxes.reduce((sum, set) => sum + set.count, 0)).toBe(output.stats.buildingsBoxed);
  });

  it('splits nothing on the finest level, without a ground, or within the budget', () => {
    expect(adapt(town(), { ...geom, levelBelowMax: 0 }).standIns).toBeUndefined();
    expect(adapt(town(), { ...geom, levelBelowMax: 0 }).buildings).toHaveLength(300);
    expect(adapt(town(), geom, { on: undefined }).standIns).toBeUndefined();
    const roomy = semanticTileToBatch(
      town(),
      geom,
      {
        pack,
        budgets: { ...budgets, maxBuildingVertices: 24 * 300 },
        features: { buildings: true, scatter: false },
      },
      flat,
    );
    expect(roomy.standIns).toBeUndefined();
    expect(roomy.buildings).toHaveLength(300);
  });

  it("always works up a host's building in full, however small", () => {
    const tile = town();
    const kiosk = tile.buildings[0] as TerrainBuildingFeature;
    kiosk.tags = { [MAP_OVERRIDE_TAG]: 'fair' };
    const batch = adapt(tile);
    // Fifty by size, and the kiosk, which is the smallest footprint of all.
    expect(batch.buildings.length).toBeGreaterThanOrEqual(50);
    expect(
      batch.buildings.some((request) => {
        const width = (request.outline[1]?.[0] ?? 0) - (request.outline[0]?.[0] ?? 0);
        return Math.abs(width - 8) < 1e-6;
      }),
    ).toBe(true);
    expect((batch.standIns?.length ?? 0) + batch.buildings.length).toBe(300);
  });
});
