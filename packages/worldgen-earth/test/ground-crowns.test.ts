import { readFile } from 'node:fs/promises';
import {
  createEmptyTerrainSemanticTile,
  TERRAIN_GROUND_CROWNS,
  terrainGroundCrown,
} from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, PLACEMENT_STRIDE, samplePlacements } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { batchGroundCrowns } from '../src/kernel/ground-crowns';
import { projectWgs84 } from '../src/kernel/projection';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';
import { scatterRequestFromTile } from '../src/kernel/semantic-adapter';
import { worldgenTileBudgetForQuality } from '../src/kernel/tile-budgets';

const json = async (name: string) =>
  JSON.parse(await readFile(new URL(`../../../content/ecology/${name}`, import.meta.url), 'utf8'));
const catalog = regionalCatalogSchema.parse(await json('regional.catalog.json'));
const environment = createRegionalEnvironment(
  { atlas: await json('ecoregions.json'), catalogs: [catalog] },
  1,
);

const square = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as [number, number][];

describe('shrubs on the painted crowns', () => {
  it("maps a batch's local meters onto the ground's world pattern", () => {
    const geom = { originX: -10_712_345.5, originZ: 3_812_007.25, size: 300 };
    const crowns = batchGroundCrowns(createEmptyTerrainSemanticTile(), geom);
    const [i0, j0, i1, j1] = crowns.cells([0, 0, geom.size, geom.size]);
    const { cell } = TERRAIN_GROUND_CROWNS;
    expect([i0, j0]).toEqual([Math.floor(geom.originX / cell), Math.floor(geom.originZ / cell)]);
    expect([i1, j1]).toEqual([
      Math.floor((geom.originX + geom.size) / cell),
      Math.floor((geom.originZ + geom.size) / cell),
    ]);
    for (const [i, j] of [
      [i0, j0],
      [i0 + 7, j1 - 3],
    ] as const) {
      const local = crowns.crown(i, j);
      const world = terrainGroundCrown(i, j);
      expect(local.x + geom.originX).toBeCloseTo(world.x, 6);
      expect(local.z + geom.originZ).toBeCloseTo(world.z, 6);
      expect(local.radius).toBe(world.radius);
    }
    // No footprints, nothing paved over.
    expect(crowns.open?.(150, 150, 'open_ground')).toBe(1);
  });

  it('paves over built-up ground as the land cover does, and only urban classes', () => {
    const tile = createEmptyTerrainSemanticTile();
    // A block of houses covering the tile's south-west corner.
    tile.buildings = Array.from({ length: 36 }, (_, k) => {
      const x = 0.02 + (k % 6) * 0.04,
        z = 0.02 + Math.floor(k / 6) * 0.04;
      return {
        polygons: [
          {
            outer: [
              [x, z],
              [x + 0.03, z],
              [x + 0.03, z + 0.03],
              [x, z + 0.03],
            ] as [number, number][],
          },
        ],
      };
    });
    const crowns = batchGroundCrowns(tile, { originX: 0, originZ: 0, size: 500 });
    expect(crowns.open?.(60, 60, 'residential')).toBeLessThan(0.2);
    expect(crowns.open?.(60, 60, 'scrub')).toBe(1);
    expect(crowns.open?.(450, 450, 'residential')).toBe(1);
  });

  it("stands a desert shrub on every crown Yuma's open ground paints", () => {
    const [x, z] = projectWgs84(-114.6459, 32.6875);
    const geom = {
      level: 16,
      x: 0,
      z: 0,
      originX: x,
      originZ: z,
      size: 200,
      metersPerUnit: 1,
      levelBelowMax: 0,
    };
    const scatter = environment.scatter([x, z, x + 200, z + 200]);
    if (!scatter) throw new Error('Missing habitat');
    const crownRule = scatter.doc.rules.find((rule) => rule.crowns !== undefined);
    const brush = crownRule?.crowns?.open_ground ?? 0;
    expect(brush).toBeGreaterThan(0.3);
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [{ class: 'open_ground', polygons: [{ outer: square }] }];
    const request = scatterRequestFromTile(tile, geom, scatter.doc.defaults.avoid, 1);
    const crowns = batchGroundCrowns(tile, geom);
    const sets = samplePlacements({
      ...scatter,
      crowns,
      request,
      ground: FLAT_GROUND,
      tier: 0,
      budget: worldgenTileBudgetForQuality('balanced', 0),
    });
    const placed = new Set<string>();
    for (const set of sets)
      for (let k = 0; k < set.count; k++) {
        const at = k * PLACEMENT_STRIDE;
        placed.add(
          `${(set.data[at] as number).toFixed(2)},${(set.data[at + 2] as number).toFixed(2)}`,
        );
      }
    const [i0, j0, i1, j1] = crowns.cells([0, 0, 200, 200]);
    let painted = 0;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const crown = crowns.crown(i, j);
        if (crown.x < 0 || crown.z < 0 || crown.x >= 200 || crown.z >= 200) continue;
        if (crown.brush > brush) continue;
        painted++;
        expect(placed.has(`${crown.x.toFixed(2)},${crown.z.toFixed(2)}`)).toBe(true);
      }
    // About a third of the 625 cells hold a crown at the open ground's brush.
    expect(painted).toBeGreaterThan(150);
  });
});
