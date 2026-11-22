import { readFile } from 'node:fs/promises';
import {
  createEmptyTerrainSemanticTile,
  TERRAIN_GROUND_CROWNS,
  terrainGroundCrown,
} from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, PLACEMENT_STRIDE, sampleScatter } from '@bendyline/molen-worldgen/kernel';
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

  /**
   * The crowns a square tile of open ground paints at a place, and how many of them carry a plant
   * in the tile's near placements (and none among its placements).
   */
  function crownsAt(
    longitude: number,
    latitude: number,
    size: number,
    quality: 'economy' | 'balanced' | 'high',
  ): { brush: number; painted: number; planted: number; layered: number } {
    const [x, z] = projectWgs84(longitude, latitude);
    const geom = {
      level: 16,
      x: 0,
      z: 0,
      originX: x,
      originZ: z,
      size,
      metersPerUnit: 1,
      levelBelowMax: 0,
    };
    const scatter = environment.scatter([x, z, x + size, z + size]);
    if (!scatter) throw new Error('Missing habitat');
    const crownRule = scatter.doc.rules.find((rule) => rule.crowns !== undefined);
    const brush = crownRule?.crowns?.open_ground ?? 0;
    const tile = createEmptyTerrainSemanticTile();
    tile.landcover = [{ class: 'open_ground', polygons: [{ outer: square }] }];
    const request = scatterRequestFromTile(tile, geom, scatter.doc.defaults.avoid, 1);
    const crowns = batchGroundCrowns(tile, geom);
    const sample = sampleScatter({
      ...scatter,
      crowns,
      request,
      ground: FLAT_GROUND,
      tier: 0,
      budget: worldgenTileBudgetForQuality(quality, 0),
    });
    // Plants by the crown cell they stand in (a crown keeps at least a meter inside its cell, so
    // float32 positions cannot land in the next one), with their positions and reach bytes.
    const { cell } = TERRAIN_GROUND_CROWNS;
    const cellOf = (px: number, pz: number) =>
      `${Math.floor((geom.originX + px) / cell)},${Math.floor((geom.originZ + pz) / cell)}`;
    const placed = new Map<string, [number, number, number | undefined]>();
    const near = sample.near;
    for (let k = 0; k < (near?.count ?? 0); k++) {
      const px = near?.data[k * PLACEMENT_STRIDE] as number,
        pz = near?.data[k * PLACEMENT_STRIDE + 2] as number;
      placed.set(cellOf(px, pz), [px, pz, near?.reach?.[k]]);
    }
    const layer = new Set<string>();
    for (const set of sample.placements)
      for (let k = 0; k < set.count; k++) {
        const px = set.data[k * PLACEMENT_STRIDE] as number,
          pz = set.data[k * PLACEMENT_STRIDE + 2] as number;
        layer.add(`${px.toFixed(1)},${pz.toFixed(1)}`);
      }
    const [i0, j0, i1, j1] = crowns.cells([0, 0, size, size]);
    let painted = 0,
      planted = 0,
      layered = 0;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const crown = crowns.crown(i, j);
        if (crown.x < 0 || crown.z < 0 || crown.x >= size || crown.z >= size) continue;
        if (crown.brush > brush) continue;
        painted++;
        const plant = placed.get(`${i},${j}`);
        // On its crown, carrying the crown's reach byte: the ground paints the crown again
        // exactly where a host stops drawing the plant.
        if (
          plant !== undefined &&
          Math.hypot(plant[0] - crown.x, plant[1] - crown.z) < 0.01 &&
          plant[2] === Math.round(crown.reach * 255)
        )
          planted++;
        if (layer.has(`${crown.x.toFixed(1)},${crown.z.toFixed(1)}`)) layered++;
      }
    return { brush, painted, planted, layered };
  }

  it("stands a desert shrub on every crown Yuma's open ground paints", () => {
    const yuma = crownsAt(-114.6459, 32.6875, 200, 'balanced');
    expect(yuma.brush).toBeGreaterThan(0.3);
    // About a third of the 625 cells hold a crown at the open ground's brush.
    expect(yuma.painted).toBeGreaterThan(150);
    expect(yuma.planted).toBe(yuma.painted);
    expect(yuma.layered).toBe(0);
  });

  it('plants every crown of a whole zoom-13 tile, past any scatter cap', () => {
    // Buena, Washington, in the steppe: a zoom-13 tile there is about 3.4 km across. Its open
    // ground paints about 42,000 crowns; the rule's own cap once planted 2,180 to 8,910 of them,
    // and the rest faded from dark discs to bare ground as a driver reached them.
    const buena = crownsAt(-120.3092, 46.4156, 3370, 'high');
    expect(buena.painted).toBeGreaterThan(30_000);
    expect(buena.planted).toBe(buena.painted);
    expect(buena.layered).toBe(0);
  });
});
