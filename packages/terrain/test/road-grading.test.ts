import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bridgeDeckHeightFn } from '../src/bridge-profile';
import {
  createTerrainElevationWorkerSource,
  type ElevationStageTiming,
  type ElevationWorkerLike,
  installTerrainElevationWorker,
} from '../src/elevation-worker';
import { TERRAIN_GRADE_SEPARATION } from '../src/grade-separation';
import { Heightfield } from '../src/heightfield';
import { terrainLinePath } from '../src/line-path';
import { buildChunkGeometry } from '../src/mesh';
import { createTerrainPackagePyramidHeightSource } from '../src/package-client';
import type { TerrainPackageDescriptor } from '../src/package-types';
import { encodePng16 } from '../src/png16';
import {
  surfaceDescriptor,
  type TerrainPyramidHeightSource,
  type TerrainPyramidTileLayerContext,
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
  type TerrainBridgeProfileSample,
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

/** Two ends of an in-process channel that copies what crosses, as a worker's does. */
function ports(): [ElevationWorkerLike, ElevationWorkerLike] {
  type Event = { data?: unknown; message?: string };
  const listeners = [new Set<(event: Event) => void>(), new Set<(event: Event) => void>()];
  return [0, 1].map((side) => ({
    postMessage(message: unknown, transfer?: Transferable[]) {
      const data = structuredClone(message, { transfer: transfer ?? [] });
      queueMicrotask(() => {
        for (const handler of listeners[1 - side] ?? []) handler({ data });
      });
    },
    addEventListener(type: 'message' | 'error', handler: (event: Event) => void) {
      if (type === 'message') listeners[side]?.add(handler);
    },
    removeEventListener(_type: 'message' | 'error', handler: (event: Event) => void) {
      listeners[side]?.delete(handler);
    },
  })) as [ElevationWorkerLike, ElevationWorkerLike];
}

describe('road grading across tiles', () => {
  it('grades in the elevation worker to the ground the main thread makes, meshed in one trip', async () => {
    // The hillside as an elevation archive, so both ways read the same stored heights.
    const side = pyramid.tileResolution;
    const archive = {
      async getZxy(level: number, x: number, y: number) {
        const size = terrainPyramidTileSize(pyramid, level);
        const data = new Float32Array(side * side);
        for (let row = 0; row < side; row++)
          for (let column = 0; column < side; column++)
            data[row * side + column] =
              (hillside((x + column / (side - 1)) * size, (y + row / (side - 1)) * size) -
                RANGE.min) /
              (RANGE.max - RANGE.min);
        return { data: encodePng16({ width: side, height: side, data }).slice().buffer };
      },
    };
    const pkg = { tileMatrix: { scheme: 'xyz' } } as TerrainPackageDescriptor;
    const direct = createTerrainPackagePyramidHeightSource(pkg, pyramid, archive);
    const [host, thread] = ports();
    installTerrainElevationWorker(thread);
    const timings: ElevationStageTiming[] = [];
    const worker = createTerrainElevationWorkerSource(host, pkg, pyramid, archive, {
      onTiming: (timing) => timings.push(timing),
    });
    const roads = (): TerrainSemanticTileSource =>
      featuresFor({
        // A street across the tile, one along its edge in the neighbor, one out of reach.
        '3/3': [
          way([
            [0.1, 0.2],
            [0.9, 0.7],
          ]),
        ],
        '4/3': [
          way([
            [0.015, 0],
            [0.015, 1],
          ]),
          way([
            [0.6, 0],
            [0.6, 1],
          ]),
        ],
      });
    const address = { level: 3, x: 3, z: 3 };
    const onMain = createTerrainRoadGrading({ features: roads() });
    const inWorker = createTerrainRoadGrading({ features: roads() });
    const mainContext = await context(direct, address);
    const workerContext = await context(worker, address);
    // A field read for its heights alone costs the worker no mesh.
    expect(timings.filter((timing) => timing.stage === 'mesh')).toHaveLength(0);
    expect(workerContext.heightfield.copySamples()).toEqual(mainContext.heightfield.copySamples());
    const expected = await onMain.transformHeightfield(mainContext, direct);
    const graded = await inWorker.transformHeightfield(workerContext, worker);
    expect(expected).not.toBe(mainContext.heightfield);
    expect(graded).not.toBe(workerContext.heightfield);
    expect(graded.copySamples()).toEqual(expected.copySamples());
    expect(timings.filter((timing) => timing.stage === 'earthworks')).toHaveLength(1);
    // The mesh the stream asks for next came back with the field: no second trip.
    const meshes = timings.filter((timing) => timing.stage === 'mesh').length;
    expect(meshes).toBe(1);
    const geometry = await worker.meshPrepared?.(graded, address, workerContext.signal, 65);
    expect(timings.filter((timing) => timing.stage === 'mesh')).toHaveLength(meshes);
    expect(geometry).toEqual(
      buildChunkGeometry(graded, surfaceDescriptor(pyramid, address), address.x, address.z, {
        localCoordinates: true,
      }),
    );
    // A tile no road reaches keeps its field, without asking the worker anything.
    const empty = { level: 3, x: 1, z: 6 };
    const emptyContext = await context(worker, empty);
    const before = timings.length;
    expect(await inWorker.transformHeightfield(emptyContext, worker)).toBe(
      emptyContext.heightfield,
    );
    expect(timings).toHaveLength(before);
    // Cancelled on the way: the tile's own field, as when grading on the main thread.
    const cancelled = new AbortController();
    const pending = inWorker.transformHeightfield(
      { ...workerContext, signal: cancelled.signal },
      worker,
    );
    cancelled.abort();
    expect(await pending).toBe(workerContext.heightfield);
    onMain.dispose();
    inWorker.dispose();
    worker.dispose?.();
  });

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

  it('keeps a raised road level where it doubles back near a tile edge', async () => {
    const heights = heightsFor(() => 0);
    // A deck over a street lands on a road that runs east, turns back 20 m short of the next
    // tile and returns: the two carriageways of a divided road, joined at the junction where
    // it stops being divided. The turn is in reach of the next tile's grading.
    const tiles = {
      '3/3': [
        way([
          [0.825, 0.3],
          [0.825, 0.7],
        ]),
        way(
          [
            [0.75, 0.5],
            [0.9, 0.5],
          ],
          { bridge: true },
        ),
        way(
          [
            [0.9, 0.5],
            [0.95, 0.51],
            [0.9, 0.52],
          ],
          { oneway: true },
        ),
      ],
      '4/3': [
        way([
          [0.5, 0.2],
          [0.5, 0.8],
        ]),
      ],
    };
    const grading = createTerrainRoadGrading({ features: featuresFor(tiles), heights });
    const graded = await grading.gradeTile(tileOf(tiles['3/3']), {
      address: { level: 3, x: 3, z: 3 },
      pyramid,
      signal: new AbortController().signal,
    });
    const road = graded.transportation.find(
      (f) => f.oneway === true,
    ) as TerrainTransportationFeature;
    const samples = road.bridgeApproachProfile ?? [];
    const apex = samples.findIndex(
      (sample) => Math.hypot(sample.point[0] - 0.95, sample.point[1] - 0.51) < 1e-6,
    );
    expect(apex).toBeGreaterThan(0);
    const [before, at, after] = [samples[apex - 1], samples[apex], samples[apex + 1]] as [
      TerrainBridgeProfileSample,
      TerrainBridgeProfileSample,
      TerrainBridgeProfileSample,
    ];
    // Still off the ground at the turn, and no lower there than on either side of it.
    expect(at.elevation).toBeGreaterThan(1);
    expect(at.elevation).toBeGreaterThan(Math.min(before.elevation, after.elevation) - 0.3);
  });

  it('draws a deck at one height on a tile edge where the two tiles grade it differently', async () => {
    // Flat ground that climbs 20 m to a bank in the tile east of the two graded here.
    const ground = (x: number): number => Math.max(0, Math.min(1, (x - 1700) / 300)) * 20;
    const heights = heightsFor(ground);
    const buffer = 1 / 64;
    const deck = { bridge: true as const };
    // A viaduct from the middle of tile 3 to that bank in tile 5. Tile 4 reads tile 5 and
    // grades the deck up to the bank; tile 3 cannot, and takes the deck to end in the air
    // where what it reads stops. Each alone, the deck steps where the two tiles meet.
    const tiles = {
      '3/3': [
        way([
          [0.2, 0.5],
          [0.5, 0.5],
        ]),
        way(
          [
            [0.5, 0.5],
            [1 + buffer, 0.5],
          ],
          deck,
        ),
      ],
      '4/3': [
        way(
          [
            [-buffer, 0.5],
            [1 + buffer, 0.5],
          ],
          deck,
        ),
      ],
      '5/3': [
        way(
          [
            [-buffer, 0.5],
            [0.25, 0.5],
          ],
          deck,
        ),
        way([
          [0.25, 0.5],
          [0.8, 0.5],
        ]),
      ],
    };
    const drawn = async (
      features: TerrainSemanticTileSource,
      x: number,
      at: number,
    ): Promise<number> => {
      const grading = createTerrainRoadGrading({ features, heights });
      const tile = tileOf(tiles[`${x}/3` as keyof typeof tiles]);
      const graded = await grading.gradeTile(tile, {
        address: { level: 3, x, z: 3 },
        pyramid,
        signal: new AbortController().signal,
      });
      const feature = graded.transportation.find((f) => f.bridge) as TerrainTransportationFeature;
      const origin = x * SIZE;
      const path = terrainLinePath(feature.lines[0] as TerrainSemanticPoint[], SIZE);
      return bridgeDeckHeightFn(path, (px) => ground(origin + px), {
        clearance: 6,
        approachLift: 0.32,
        connects: [true, true],
        approachProfile: (feature.bridgeApproachProfile ?? []).map((sample) => ({
          ...sample,
          point: [sample.point[0] * SIZE, sample.point[1] * SIZE] as TerrainSemanticPoint,
        })),
      })(at, 1200);
    };
    const features = featuresFor(tiles);
    const [west, east] = await Promise.all([drawn(features, 3, SIZE), drawn(features, 4, 0)]);
    expect(west).toBeCloseTo(east, 2);
    // The two do grade it differently: with no tile 5 to read, both take the deck to end in
    // the air at the same place, and stand elsewhere on the edge.
    const { '5/3': _beyond, ...near } = tiles;
    const short = featuresFor(near);
    const [alone] = await Promise.all([drawn(short, 3, SIZE), drawn(short, 4, 0)]);
    expect(Math.abs(alone - west)).toBeGreaterThan(0.5);
    // And well inside its tile each keeps its own grading: the deck still lands on its road.
    expect(await drawn(features, 3, 0.5 * SIZE)).toBeCloseTo(0.32, 1);
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
