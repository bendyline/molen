import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bridgeDeckHeightFn } from '../src/bridge-profile';
import { TERRAIN_GRADE_SEPARATION } from '../src/grade-separation';
import { Heightfield } from '../src/heightfield';
import { terrainLinePath } from '../src/line-path';
import type {
  TerrainPyramidHeightSource,
  TerrainPyramidTileLayerContext,
} from '../src/pyramid-stream';
import {
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from '../src/pyramid-types';
import { renderedGroundSampler } from '../src/rendered-ground';
import { createTerrainRoadGrading, withTerrainRoadGrading } from '../src/road-grading';
import type { TerrainSemanticTileSource } from '../src/semantic-client';
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
} from '../src/semantic-types';

const RANGE = { min: -50, max: 250 };
// Level 3 tiles of 400 m; the reference ground is read one level... two levels up, at level 1.
const pyramid: TerrainPyramidDescriptor = {
  name: 'road-grading-test',
  origin: [0, 0],
  rootSize: 3200,
  minLevel: 0,
  maxLevel: 3,
  tileResolution: 65,
  height: RANGE,
  layers: [],
  skirts: false,
};
const SIZE = terrainPyramidTileSize(pyramid, 3);
const hillside = (x: number, z: number): number =>
  z * 0.05 + 1.5 * Math.sin(x / 13) * Math.cos(z / 17);

function heightsFor(ground: (x: number, z: number) => number): TerrainPyramidHeightSource & {
  loads: string[];
} {
  const loads: string[] = [];
  return {
    loads,
    async load(address) {
      loads.push(`${address.level}/${address.x}/${address.z}`);
      const size = terrainPyramidTileSize(pyramid, address.level);
      const origin = terrainPyramidTileOrigin(pyramid, address);
      const side = pyramid.tileResolution;
      const grid = new Float32Array(side * side);
      for (let row = 0; row < side; row++)
        for (let column = 0; column < side; column++)
          grid[row * side + column] =
            (ground(
              origin[0] + (column / (side - 1)) * size,
              origin[1] + (row / (side - 1)) * size,
            ) -
              RANGE.min) /
            (RANGE.max - RANGE.min);
      return new Heightfield(grid, side, side, { origin, worldSize: [size, size], height: RANGE });
    },
  };
}
function featuresFor(
  tiles: Record<string, TerrainTransportationFeature[]>,
): TerrainSemanticTileSource & {
  loads: string[];
} {
  const loads: string[] = [];
  return {
    loads,
    async load(address) {
      const key = `${address.x}/${address.z}`;
      loads.push(key);
      const transportation = tiles[key];
      if (!transportation) return undefined;
      const tile = createEmptyTerrainSemanticTile();
      tile.transportation = transportation;
      return tile;
    },
  };
}
const way = (
  line: TerrainSemanticPoint[],
  extra: Partial<TerrainTransportationFeature> = {},
): TerrainTransportationFeature => ({
  class: 'major_road',
  subclass: 'secondary',
  width: 10,
  lines: [line],
  ...extra,
});
async function context(
  heights: TerrainPyramidHeightSource,
  address: TerrainPyramidTileAddress,
  extra: Partial<TerrainPyramidTileLayerContext> = {},
): Promise<TerrainPyramidTileLayerContext> {
  const signal = new AbortController().signal;
  return {
    address,
    pyramid,
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: (await heights.load(address, signal)) as Heightfield,
    surfaceResolution: 65,
    origin: terrainPyramidTileOrigin(pyramid, address),
    tileSize: SIZE,
    signal,
    ...extra,
  };
}
const tileOf = (transportation: TerrainTransportationFeature[]): TerrainSemanticTile => ({
  ...createEmptyTerrainSemanticTile(),
  transportation,
});

describe('road grading across tiles', () => {
  it('levels the ground for a road in the next tile that runs along the shared edge', async () => {
    const heights = heightsFor(hillside);
    const features = featuresFor({
      '3/3': [],
      // 6 m east of the edge, in the neighbor only.
      '4/3': [
        way([
          [0.015, 0],
          [0.015, 1],
        ]),
      ],
    });
    const grading = createTerrainRoadGrading({ features });
    const west = await context(heights, { level: 3, x: 3, z: 3 });
    const east = await context(heights, { level: 3, x: 4, z: 3 });
    const [leveledWest, leveledEast] = await Promise.all([
      grading.transformHeightfield(west, heights),
      grading.transformHeightfield(east, heights),
    ]);
    expect(leveledWest).not.toBe(west.heightfield);
    // Read from one elevation level, two below the finest, for both tiles.
    expect(heights.loads.filter((key) => key.startsWith('1/')).length).toBeGreaterThan(0);
    let moved = 0;
    const edge = east.origin[0];
    for (let z = west.origin[1]; z <= west.origin[1] + SIZE; z += SIZE / 64) {
      // To the precision heights are stored at.
      expect(leveledWest.sampleHeight(edge, z)).toBeCloseTo(leveledEast.sampleHeight(edge, z), 3);
      moved = Math.max(moved, Math.abs(leveledWest.sampleHeight(edge, z) - hillside(edge, z)));
    }
    expect(moved).toBeGreaterThan(0.3);
    // The road itself is level across in the tile that draws it.
    const ground = renderedGroundSampler(leveledEast, east.origin, SIZE, 65);
    for (let z = east.origin[1] + 40; z < east.origin[1] + SIZE - 40; z += 23)
      expect(Math.abs(ground(edge + 1.5, z) - ground(edge + 10.5, z))).toBeLessThan(0.05);
    grading.dispose();
  });

  it('skips tiles whose grid is too coarse, levels it is not asked for, and cancelled tiles', async () => {
    const heights = heightsFor(hillside);
    const tiles = {
      '3/3': [
        way([
          [0, 0.5],
          [1, 0.5],
        ]),
      ],
    };
    const address = { level: 3, x: 3, z: 3 };
    const base = await context(heights, address);
    const untouched = async (
      options: Partial<Parameters<typeof createTerrainRoadGrading>[0]>,
      extra: Partial<TerrainPyramidTileLayerContext> = {},
    ): Promise<boolean> => {
      const grading = createTerrainRoadGrading({ features: featuresFor(tiles), ...options });
      const tile = { ...base, ...extra };
      return (await grading.transformHeightfield(tile, heights)) === tile.heightfield;
    };
    expect(await untouched({})).toBe(false);
    expect(await untouched({ earthworks: false })).toBe(true);
    expect(await untouched({ minLevel: 4 })).toBe(true);
    expect(await untouched({}, { surfaceResolution: 9 })).toBe(true);
    expect(await untouched({ maxSpacing: 60 }, { surfaceResolution: 9 })).toBe(false);
    const cancelled = new AbortController();
    cancelled.abort();
    expect(await untouched({}, { signal: cancelled.signal })).toBe(true);
  });

  it('clears a road in the next tile, and agrees with that tile where the bridge is cut', async () => {
    const flat = (): number => 3;
    const heights = heightsFor(flat);
    // A bridge 100 m long across the edge between tiles 3 and 4, with its buffer either side;
    // the road it crosses lies 30 m into the eastern tile.
    const buffer = 1 / 64;
    const deck = { bridge: true as const };
    const tiles = {
      '3/3': [
        way([
          [0.3, 0.5],
          [0.875, 0.5],
        ]),
        way(
          [
            [0.875, 0.5],
            [1 + buffer, 0.5],
          ],
          deck,
        ),
      ],
      '4/3': [
        way(
          [
            [-buffer, 0.5],
            [0.125, 0.5],
          ],
          deck,
        ),
        way([
          [0.125, 0.5],
          [0.7, 0.5],
        ]),
        way(
          [
            [0.075, 0],
            [0.075, 1],
          ],
          { class: 'highway', subclass: 'motorway' },
        ),
      ],
    };
    const grading = createTerrainRoadGrading({ features: featuresFor(tiles), heights });
    const graded = async (x: number): Promise<TerrainTransportationFeature[]> => {
      const address = { level: 3, x, z: 3 };
      const tile = tileOf(tiles[`${x}/3` as keyof typeof tiles]);
      const result = await grading.gradeTile(tile, {
        address,
        pyramid,
        signal: new AbortController().signal,
      });
      expect(result).not.toBe(tile);
      // The same decoded tile is graded once.
      expect(
        await grading.gradeTile(tile, { address, pyramid, signal: new AbortController().signal }),
      ).toBe(result);
      return result.transportation;
    };
    const [west, east] = await Promise.all([graded(3), graded(4)]);
    const heightAt = (feature: TerrainTransportationFeature, x: number): number => {
      const path = terrainLinePath(feature.lines[0] as TerrainSemanticPoint[], SIZE);
      return bridgeDeckHeightFn(path, flat, {
        clearance: 6,
        approachLift: 0.32,
        connects: [true, true],
        approachProfile: (feature.bridgeApproachProfile ?? []).map((sample) => ({
          ...sample,
          point: [sample.point[0] * SIZE, sample.point[1] * SIZE] as TerrainSemanticPoint,
        })),
      })(x, 200);
    };
    const westDeck = west.find((f) => f.bridge) as TerrainTransportationFeature,
      eastDeck = east.find((f) => f.bridge) as TerrainTransportationFeature;
    // Over the motorway, 30 m into the eastern tile: clear of its surface.
    expect(heightAt(eastDeck, 30)).toBeGreaterThanOrEqual(
      3.32 + TERRAIN_GRADE_SEPARATION.road - 0.01,
    );
    // At the edge the western tile, which has no road to cross, stands where the eastern does.
    expect(heightAt(westDeck, SIZE)).toBeGreaterThan(8);
    expect(heightAt(westDeck, SIZE)).toBeCloseTo(heightAt(eastDeck, 0), 1);
    // And its approach climbs from the ground to where the deck begins.
    const approach = west.find((f) => !f.bridge) as TerrainTransportationFeature;
    expect(approach.bridgeApproachProfile?.at(-1)?.elevation).toBeGreaterThan(4.5);
    expect(approach.bridgeApproachProfile?.at(-1)?.elevation).toBeCloseTo(
      westDeck.bridgeApproachProfile?.[0]?.elevation as number,
      5,
    );
    expect(approach.bridgeApproachProfile?.[0]?.elevation).toBeCloseTo(3.32, 2);
    // Profiles graded over the reference ground say so, for whoever draws them.
    expect(westDeck.bridgeApproachProfile?.[0]?.ground).toBeCloseTo(3, 5);
    expect(westDeck.bridgeApproachProfile?.[0]?.anchor).toBe(1);
  });

  it('hands the graded tile to the renderer it wraps, and tiles without bridges as they came', async () => {
    const heights = heightsFor(() => 0);
    const tiles = {
      '3/3': [
        way(
          [
            [0.2, 0.5],
            [0.8, 0.5],
          ],
          { bridge: true },
        ),
      ],
      '6/6': [
        way([
          [0.2, 0.5],
          [0.8, 0.5],
        ]),
      ],
    };
    const grading = createTerrainRoadGrading({ features: featuresFor(tiles), heights });
    const seen: TerrainSemanticTile[] = [];
    const renderer = withTerrainRoadGrading(
      {
        createTile(tile) {
          seen.push(tile);
          return new THREE.Group();
        },
      },
      grading,
    );
    const bridged = tileOf(tiles['3/3']),
      plain = tileOf(tiles['6/6']);
    await renderer.createTile(bridged, await context(heights, { level: 3, x: 3, z: 3 }));
    await renderer.createTile(plain, await context(heights, { level: 3, x: 6, z: 6 }));
    expect(seen[0]).not.toBe(bridged);
    expect(seen[0]?.transportation[0]?.bridgeApproachProfile?.length).toBeGreaterThan(0);
    expect(bridged.transportation[0]?.bridgeApproachProfile).toBeUndefined();
    expect(seen[1]).toBe(plain);
  });
});
