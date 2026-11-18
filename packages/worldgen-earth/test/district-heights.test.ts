import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GUESS_STOREYS,
  districtLevels,
  guessCeiling,
  measuredStoreys,
  shaftLevels,
  withDistrictLevels,
} from '../src/kernel/district-heights';
import { MAP_OVERRIDE_TAG } from '../src/kernel/map-override-tags';

/** A square footprint `side` tile units across with its lower corner at (u, v). */
function square(u: number, v: number, side: number): TerrainBuildingFeature['polygons'] {
  return [
    {
      outer: [
        [u, v],
        [u + side, v],
        [u + side, v + side],
        [u, v + side],
      ],
    },
  ];
}

/** A 1,000 m tile with a downtown grid of 30 m blocks on a 40 m pitch. */
function downtown(feature: Partial<TerrainBuildingFeature> = {}) {
  const tile = createEmptyTerrainSemanticTile();
  for (let i = 0; i < 25; i++)
    for (let j = 0; j < 25; j++)
      tile.buildings.push({
        id: i * 25 + j,
        class: 'building',
        subclass: 'commercial',
        polygons: square(i * 0.04, j * 0.04, 0.03),
        ...feature,
      });
  return tile;
}

describe('district height priors', () => {
  it('raises unmeasured commercial blocks in a dense core, deterministically', () => {
    const tile = withDistrictLevels(downtown(), [0, 0], 1000);
    const levels = tile.buildings.map((b) => b.levels);
    expect(levels.every((value) => value !== undefined && value >= 2 && value <= 16)).toBe(true);
    expect(Math.max(...(levels as number[]))).toBeGreaterThan(4);
    expect(withDistrictLevels(downtown(), [0, 0], 1000)).toEqual(tile);
  });

  it('leaves mapped heights, homes, shops and suburbs to their own data and styles', () => {
    for (const feature of [
      { height: 9 },
      { levels: 2 },
      { subclass: 'house' },
      { subclass: 'retail' },
    ])
      expect(withDistrictLevels(downtown(feature), [0, 0], 1000).buildings[0]?.levels).toBe(
        feature.levels,
      );
    const suburb = createEmptyTerrainSemanticTile();
    for (let i = 0; i < 10; i++)
      suburb.buildings.push({ id: i, class: 'building', polygons: square(i * 0.1, 0.5, 0.02) });
    expect(withDistrictLevels(suburb, [0, 0], 1000)).toBe(suburb);
  });

  it("leaves a host's building at the height its owner gave it, or none", () => {
    // In the middle of a core that raises every unmeasured block around it.
    const tile = downtown();
    const index = 12 * 25 + 12;
    const mapped = tile.buildings[index] as TerrainBuildingFeature;
    const { id: _id, ...unmeasured } = mapped;
    const host: TerrainBuildingFeature = {
      ...unmeasured,
      id: 'override:lot:hall',
      tags: { [MAP_OVERRIDE_TAG]: 'lot' },
    };
    tile.buildings[index] = host;
    const result = withDistrictLevels(tile, [0, 0], 1000);
    expect(result.buildings[index]).toBe(host);
    expect(result.buildings[index + 1]?.levels).toBeGreaterThanOrEqual(2);
    // The tag alone decides it: the same footprint untagged gets the district's prior.
    tile.buildings[index] = { ...unmeasured, id: 'mapped' };
    expect(withDistrictLevels(tile, [0, 0], 1000).buildings[index]?.levels).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('reads how tall a place is built from its measured buildings, when it has enough', () => {
    const tile = downtown();
    // No building measured: nothing to say, and a guess stops at an ordinary block of flats.
    expect(measuredStoreys(tile, 1000)).toBeUndefined();
    expect(guessCeiling(tile, 1000)).toBe(DEFAULT_GUESS_STOREYS);
    expect(guessCeiling(tile, 1000, 3)).toBe(3);
    // Seven measured is still too few; a mast or a minaret is not a building's height.
    for (let i = 0; i < 7; i++) (tile.buildings[i] as TerrainBuildingFeature).height = 40;
    tile.buildings.push({
      id: 'mast',
      class: 'building',
      height: 90,
      polygons: square(0.99, 0.99, 0.005),
    });
    expect(measuredStoreys(tile, 1000)).toBeUndefined();
    // A low town with a few towers: four in five measured buildings are within three storeys.
    for (let i = 7; i < 60; i++) (tile.buildings[i] as TerrainBuildingFeature).levels = 1 + (i % 3);
    expect(measuredStoreys(tile, 1000)).toBe(3);
    expect(guessCeiling(tile, 1000)).toBe(DEFAULT_GUESS_STOREYS);
    // A core of towers says so.
    for (let i = 0; i < 60; i++) {
      const feature = tile.buildings[i] as TerrainBuildingFeature;
      delete feature.levels;
      feature.height = 38 + (i % 5) * 6;
    }
    expect(measuredStoreys(tile, 1000)).toBeGreaterThanOrEqual(12);
    expect(guessCeiling(tile, 1000)).toBeGreaterThanOrEqual(12);
  });

  it('keeps a dense old town low and lets a measured core rise', () => {
    // Dense ground and nothing measured: a medina covers as much as a downtown.
    const town = withDistrictLevels(downtown(), [0, 0], 1000);
    const guessed = town.buildings.map((b) => b.levels as number);
    expect(Math.max(...guessed)).toBe(DEFAULT_GUESS_STOREYS);
    // The same town in a region whose blocks are three storeys.
    const low = withDistrictLevels(downtown(), [0, 0], 1000, 3);
    expect(Math.max(...low.buildings.map((b) => b.levels as number))).toBe(3);
    // Sixty towers measured among the same blocks: the rest may stand as tall as the prior says.
    const core = downtown();
    for (let i = 0; i < 60; i++) (core.buildings[i * 10] as TerrainBuildingFeature).height = 60;
    const raised = withDistrictLevels(core, [0, 0], 1000)
      .buildings.filter((b) => b.height === undefined)
      .map((b) => b.levels as number);
    expect(Math.max(...raised)).toBeGreaterThan(DEFAULT_GUESS_STOREYS);
    expect(Math.max(...raised)).toBeLessThanOrEqual(16);
  });

  it('reads a mapped height on a sliver of ground as a tower, not floors of flats', () => {
    // The Torre del Mangia: 102 m on 21 m². Nine tiers of openings, not 29 storeys.
    expect(shaftLevels(102, 21)).toBe(9);
    // A campanile, a minaret and a chimney.
    expect(shaftLevels(77, 65)).toBe(7);
    expect(shaftLevels(56, 9)).toBe(5);
    expect(shaftLevels(24, 12)).toBe(2);
    // Anything a floor can be laid in keeps its storeys: a tower block, a slab, and the
    // narrowest inhabited kind, nine floors on a 40 m² city lot.
    expect(shaftLevels(36, 400)).toBeUndefined();
    expect(shaftLevels(102, 900)).toBeUndefined();
    expect(shaftLevels(30, 40)).toBeUndefined();
    // A point tower is slim and still floors: 150 m on a 20 m plate.
    expect(shaftLevels(150, 400)).toBeUndefined();
    expect(shaftLevels(85, 210)).toBe(8);
    // Low things are sheds and kiosks whatever their plan.
    expect(shaftLevels(12, 2)).toBeUndefined();
    expect(shaftLevels(30, 0)).toBeUndefined();
  });

  it('does not count a lone big box as a dense block', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings.push({ id: 1, class: 'building', polygons: square(0.4, 0.4, 0.12) });
    expect(withDistrictLevels(tile, [0, 0], 1000)).toBe(tile);
    expect(districtLevels(['building'], 'residential', 2000, 0.8, 'x')).toBeUndefined();
    expect(districtLevels(['office'], undefined, 2000, 0.8, 'x')).toBeGreaterThan(4);
  });
});
