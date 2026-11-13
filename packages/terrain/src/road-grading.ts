/**
 * Road grading for streamed tiles: gathers what one tile cannot know (its neighbors' roads and
 * the ground beyond its edges) and applies the two pure passes, `gradeRoadEarthworks` to the
 * tile's ground and `gradeTransportSeparations` to its bridges.
 *
 * Both passes must give adjacent tiles the same answer along their shared edge. So neither
 * reads the tile's own ground: heights come from one fixed elevation level, sampled as a function
 * of world position, and roads from the tile and the eight around it.
 */
import { gradeTransportSeparationSteps } from './grade-separation';
import type { Heightfield } from './heightfield';
import { pointInPolygon, polygonBounds } from './polygon';
import type { TerrainPyramidHeightSource, TerrainPyramidTileLayerContext } from './pyramid-stream';
import {
  type TerrainPyramidDescriptor,
  type TerrainPyramidTileAddress,
  terrainPyramidTileCount,
  terrainPyramidTileKey,
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
} from './pyramid-types';
import {
  beginRoadEarthworks,
  clipRoadLine,
  ROAD_PROFILE_WINDOW,
  type RoadEarthworkLine,
  roadEarthworkLines,
  roadProfileHeight,
} from './road-earthworks';
import type { TerrainSemanticTileRenderer, TerrainSemanticTileSource } from './semantic-client';
import type {
  TerrainBridgeProfileSample,
  TerrainSemanticLine,
  TerrainSemanticPolygon,
  TerrainSemanticTile,
  TerrainTransportationFeature,
  TerrainWaterFeature,
} from './semantic-types';

export interface TerrainRoadGradingOptions {
  /** Road tiles; neighbors are read from it too (it should share the layer's decoded tiles). */
  features: TerrainSemanticTileSource;
  /**
   * Elevation for bridge grading. Optional when `transformHeightfield` is installed on the
   * stream, which hands its own source over with the first tile.
   */
  heights?: TerrainPyramidHeightSource;
  /** Coarsest tile level graded (default: every level the features source answers). */
  minLevel?: number;
  /** Level the ground for roads (default true); false keeps bridge grading only. */
  earthworks?: boolean;
  /** Coarsest rendered grid (meters between vertices) whose ground is leveled (default 28). */
  maxSpacing?: number;
}

export interface TerrainRoadGrading {
  /**
   * Level the ground under and beside a tile's roads: the stream's `transformHeightfield`.
   * Compose it before any transform that must win (an airport's leveling).
   */
  transformHeightfield(
    context: TerrainPyramidTileLayerContext,
    source: TerrainPyramidHeightSource,
  ): Promise<Heightfield>;
  /**
   * A tile whose bridges, and the roads climbing to them, carry height profiles that clear
   * whatever they cross, worked out with the tiles around it so the profiles meet at tile
   * edges. Returns the tile itself when it has nothing to grade.
   */
  gradeTile(
    tile: TerrainSemanticTile,
    context: Pick<TerrainPyramidTileLayerContext, 'address' | 'pyramid' | 'signal'>,
  ): Promise<TerrainSemanticTile>;
  dispose(): void;
}

interface TileRoads {
  transportation: readonly TerrainTransportationFeature[];
  water: readonly TerrainWaterFeature[];
  /** The tile's ways to grade the ground for, with the profiles read for them so far. */
  lines?: RoadEarthworkLine[];
}

/** Meters beyond a tile within which a neighbor's bridges and approaches still matter to it. */
const SEPARATION_REACH = 400;
/** Meters between the stations bridge profiles are worked out at. */
const SEPARATION_SPACING = 6;
/** Meters two halves of a way cut at a tile edge may end apart and still be joined. */
const CUT_TOLERANCE = 1.5;
const NEVER = new AbortController().signal;
/** Main-thread time (ms) one tile's grading takes before letting a frame through. */
const SLICE_MS = 2;

/** Yield to the event loop: a macrotask, without a timer's clamped delay where there is one. */
function breathe(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(0);
  });
}

function remember<T>(cache: Map<string, T>, key: string, value: T, limit: number): T {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value as string);
  return value;
}

/** Share one grading between a terrain stream and its features layer. */
export function createTerrainRoadGrading(options: TerrainRoadGradingOptions): TerrainRoadGrading {
  let heights = options.heights;
  let disposed = false;
  const roads = new Map<string, Promise<TileRoads | undefined>>();
  const fields = new Map<string, Promise<Heightfield | undefined>>();
  const gradedTiles = new WeakMap<TerrainSemanticTile, Promise<TerrainSemanticTile>>();

  /** One tile's roads, kept for the tiles around it; failures and gaps are asked for again. */
  const roadsOf = (address: TerrainPyramidTileAddress): Promise<TileRoads | undefined> => {
    const count = terrainPyramidTileCount(address.level);
    if (address.x < 0 || address.z < 0 || address.x >= count || address.z >= count)
      return Promise.resolve(undefined);
    const key = terrainPyramidTileKey(address);
    const known = roads.get(key);
    if (known) return remember(roads, key, known, 160);
    // Never cancelled with the tile that asked: its neighbors will ask for the same roads.
    const pending = options.features
      .load(address, NEVER)
      .then((tile) =>
        tile ? { transportation: tile.transportation, water: tile.water } : undefined,
      )
      .catch(() => undefined);
    void pending.then((value) => {
      if (value === undefined && roads.get(key) === pending) roads.delete(key);
    });
    return remember(roads, key, pending, 160);
  };
  /** A tile's roads and those of the eight tiles around it, by offset. */
  const neighborhood = async (
    address: TerrainPyramidTileAddress,
    own?: TileRoads,
  ): Promise<{ dx: number; dz: number; roads: TileRoads }[]> => {
    const offsets: [number, number][] = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) offsets.push([dx, dz]);
    const loaded = await Promise.all(
      offsets.map(([dx, dz]) =>
        dx === 0 && dz === 0 && own
          ? own
          : roadsOf({ level: address.level, x: address.x + dx, z: address.z + dz }),
      ),
    );
    return offsets.flatMap(([dx, dz], i) => {
      const tile = loaded[i];
      return tile ? [{ dx, dz, roads: tile }] : [];
    });
  };
  /**
   * The natural ground over a world rectangle, as a function of position alone: one elevation
   * level two below the finest (about the resolution elevation data is surveyed at), whichever
   * tile asks. Returns undefined when that level has nothing there.
   */
  const reference = async (
    pyramid: TerrainPyramidDescriptor,
    source: TerrainPyramidHeightSource,
    bounds: readonly [number, number, number, number],
    level: number,
  ): Promise<((x: number, z: number) => number) | undefined> => {
    const size = terrainPyramidTileSize(pyramid, level);
    const count = terrainPyramidTileCount(level);
    const column = (x: number): number =>
      Math.max(0, Math.min(count - 1, Math.floor((x - pyramid.origin[0]) / size)));
    const row = (z: number): number =>
      Math.max(0, Math.min(count - 1, Math.floor((z - pyramid.origin[1]) / size)));
    const tiles = new Map<string, Heightfield>();
    const wanted: Promise<void>[] = [];
    for (let z = row(bounds[1]); z <= row(bounds[3]); z++)
      for (let x = column(bounds[0]); x <= column(bounds[2]); x++) {
        const address = { level, x, z };
        const key = terrainPyramidTileKey(address);
        let pending = fields.get(key);
        if (!pending) {
          pending = source.load(address, NEVER).catch(() => undefined);
          const asked = pending;
          void asked.then((value) => {
            if (value === undefined && fields.get(key) === asked) fields.delete(key);
          });
        }
        remember(fields, key, pending, 48);
        wanted.push(
          pending.then((field) => {
            if (field) tiles.set(`${x}/${z}`, field);
          }),
        );
      }
    await Promise.all(wanted);
    if (tiles.size === 0) return undefined;
    let last: Heightfield | undefined,
      lastX = -1,
      lastZ = -1;
    const fallback = tiles.values().next().value as Heightfield;
    return (x, z) => {
      const cx = column(x),
        cz = row(z);
      if (cx !== lastX || cz !== lastZ || !last) {
        lastX = cx;
        lastZ = cz;
        last = tiles.get(`${cx}/${cz}`) ?? fallback;
      }
      return last.sampleHeight(x, z);
    };
  };
  const referenceLevel = (pyramid: TerrainPyramidDescriptor, level: number): number =>
    Math.max(pyramid.minLevel, Math.min(level, pyramid.maxLevel - 2));

  return {
    async transformHeightfield(context, source) {
      heights ??= source;
      const { heightfield, address, pyramid, origin, tileSize, signal } = context;
      if (disposed || options.earthworks === false || signal.aborted) return heightfield;
      if (address.level < (options.minLevel ?? pyramid.minLevel)) return heightfield;
      const side = context.surfaceResolution ?? heightfield.cols;
      const spacing = tileSize / Math.max(1, side - 1);
      const maxSpacing = options.maxSpacing ?? 28;
      if (spacing > maxSpacing) return heightfield;
      const around = await neighborhood(address);
      if (signal.aborted || around.length === 0) return heightfield;
      const lines: RoadEarthworkLine[] = [];
      for (const { dx, dz, roads: tile } of around) {
        // Built once for a tile, then graded into it and each tile around it.
        tile.lines ??= roadEarthworkLines(
          tile.transportation,
          [origin[0] + dx * tileSize, origin[1] + dz * tileSize],
          tileSize,
        );
        for (const line of tile.lines) lines.push(line);
      }
      if (lines.length === 0) return heightfield;
      // As far as a bench and its blend reach past the tile, and a profile's window past that.
      const reach = 16 + spacing * 2.7 + ROAD_PROFILE_WINDOW + 12;
      const ground = await reference(
        pyramid,
        source,
        [
          origin[0] - reach,
          origin[1] - reach,
          origin[0] + tileSize + reach,
          origin[1] + tileSize + reach,
        ],
        referenceLevel(pyramid, address.level),
      );
      if (signal.aborted || !ground) return heightfield;
      const own = around.find((tile) => tile.dx === 0 && tile.dz === 0)?.roads;
      const lakes = (own?.water ?? [])
        .flatMap((feature) => feature.polygons ?? [])
        .map((polygon): [TerrainSemanticPolygon, ReturnType<typeof polygonBounds>] => [
          polygon,
          polygonBounds(polygon),
        ]);
      const water =
        lakes.length === 0
          ? undefined
          : (x: number, z: number): boolean => {
              const u = (x - origin[0]) / tileSize,
                v = (z - origin[1]) / tileSize;
              return lakes.some(
                ([polygon, bounds]) =>
                  u >= bounds[0] &&
                  u <= bounds[2] &&
                  v >= bounds[1] &&
                  v <= bounds[3] &&
                  pointInPolygon([u, v], polygon),
              );
            };
      const pass = beginRoadEarthworks(heightfield, ground, {
        surfaceResolution: side,
        maxSpacing,
        ...(water ? { water } : {}),
      });
      if (!pass) return heightfield;
      // A town tile is thousands of stations: a few milliseconds of work, taken a slice at a
      // time so that tiles streaming in under a fast camera do not each hold a frame.
      let slice = performance.now();
      for (const line of lines) {
        pass.add(line);
        if (performance.now() - slice < SLICE_MS) continue;
        await breathe();
        if (signal.aborted) return heightfield;
        slice = performance.now();
      }
      return pass.finish();
    },
    gradeTile(tile, context) {
      const known = gradedTiles.get(tile);
      if (known) return known;
      const work = (async (): Promise<TerrainSemanticTile> => {
        const { address, pyramid, signal } = context;
        if (disposed || signal.aborted || !heights) return tile;
        if (address.level < (options.minLevel ?? pyramid.minLevel)) return tile;
        const tileSize = terrainPyramidTileSize(pyramid, address.level);
        const origin = terrainPyramidTileOrigin(pyramid, address);
        const around = await neighborhood(address, {
          transportation: tile.transportation,
          water: tile.water,
        });
        if (signal.aborted) return tile;
        // Every tile's roads are cut to its own square, this tile's and its neighbors' alike,
        // so both tiles that share an edge work on the same pieces, stationed the same way,
        // and give a road crossing the edge one height there. Neighbors' roads stop where
        // they can no longer matter.
        const square = [0, 0, 1, 1] as const;
        let buffer = 0;
        const pieces: TerrainTransportationFeature[] = [];
        const owners: [feature: number, line: number][] = [];
        tile.transportation.forEach((feature, f) => {
          if (feature.tunnel) return;
          feature.lines.forEach((line, l) => {
            for (const [u, v] of line) buffer = Math.max(buffer, -u, u - 1, -v, v - 1);
            for (const piece of clipRoadLine(line, square)) {
              if (piece.length < 2) continue;
              pieces.push({ ...feature, lines: [piece] });
              owners.push([f, l]);
            }
          });
        });
        const margin = Math.min(1, SEPARATION_REACH / tileSize);
        const outer = [-margin, -margin, 1 + margin, 1 + margin] as const;
        const beyondTile: TerrainTransportationFeature[] = [];
        for (const { dx, dz, roads: neighbor } of around) {
          if (dx === 0 && dz === 0) continue;
          for (const feature of neighbor.transportation) {
            if (feature.tunnel) continue;
            const lines: TerrainSemanticLine[] = [];
            for (const line of feature.lines)
              for (const own of clipRoadLine(line, square))
                for (const near of clipRoadLine(
                  own.map(([u, v]): [number, number] => [u + dx, v + dz]),
                  outer,
                ))
                  if (near.length > 1) lines.push(near);
            if (lines.length > 0) beyondTile.push({ ...feature, lines });
          }
        }
        if (
          !pieces.some((feature) => feature.bridge) &&
          !beyondTile.some((feature) => feature.bridge)
        )
          return tile;
        const reach = SEPARATION_REACH + ROAD_PROFILE_WINDOW + 12;
        const ground = await reference(
          pyramid,
          heights,
          [
            origin[0] - reach,
            origin[1] - reach,
            origin[0] + tileSize + reach,
            origin[1] + tileSize + reach,
          ],
          referenceLevel(pyramid, address.level),
        );
        if (signal.aborted || !ground) return tile;
        // An interchange and what surrounds it is tens of thousands of stations: taken a few
        // milliseconds at a time, like the earthworks.
        const steps = gradeTransportSeparationSteps(
          pieces,
          tileSize,
          (x, z, dx, dz) => roadProfileHeight(ground, origin[0] + x, origin[1] + z, dx, dz),
          {
            context: beyondTile,
            endTolerance: CUT_TOLERANCE,
            spacing: SEPARATION_SPACING,
            // Graded over the reference ground, drawn on the tile's own.
            anchored: true,
            // A road is drawn a little past the tile's edge: its profile reaches there too.
            extend: Math.min(0.05, buffer) * tileSize + SEPARATION_SPACING,
          },
        );
        let graded: readonly TerrainTransportationFeature[];
        for (let slice = performance.now(); ; ) {
          const step = steps.next();
          if (step.done) {
            graded = step.value;
            break;
          }
          if (performance.now() - slice < SLICE_MS) continue;
          await breathe();
          if (signal.aborted) return tile;
          slice = performance.now();
        }
        if (graded === pieces) return tile;
        // Back onto the tile's own lines: each keeps its geometry and takes the profile of its
        // piece (of its pieces, end to end, where the tile's edge cut it more than once).
        const profiles = new Map<number, Map<number, TerrainBridgeProfileSample[]>>();
        graded.forEach((feature, i) => {
          const samples = feature.bridgeApproachProfile;
          if (!samples?.length || feature === pieces[i]) return;
          const [f, l] = owners[i] as [number, number];
          const lines = profiles.get(f) ?? new Map<number, TerrainBridgeProfileSample[]>();
          lines.set(l, [...(lines.get(l) ?? []), ...samples]);
          profiles.set(f, lines);
        });
        if (profiles.size === 0) return tile;
        return {
          ...tile,
          transportation: tile.transportation.flatMap((feature, f) => {
            const lines = profiles.get(f);
            if (!lines) return [feature];
            return feature.lines.map((line, l) => {
              const samples = lines.get(l);
              return samples
                ? { ...feature, lines: [line], bridgeApproachProfile: samples }
                : { ...feature, lines: [line] };
            });
          }),
        };
      })();
      gradedTiles.set(tile, work);
      // A cancelled or failed pass is tried again by the next caller.
      void work.then(
        (result) => {
          if (result === tile) gradedTiles.delete(tile);
        },
        () => gradedTiles.delete(tile),
      );
      return work;
    },
    dispose() {
      disposed = true;
      roads.clear();
      fields.clear();
    },
  };
}

/** Grade each tile's bridges (see `TerrainRoadGrading.gradeTile`) before it is drawn. */
export function withTerrainRoadGrading(
  renderer: TerrainSemanticTileRenderer,
  grading: TerrainRoadGrading,
): TerrainSemanticTileRenderer {
  return {
    createEmptyTile: (context) => renderer.createEmptyTile?.(context),
    async createTile(tile, context) {
      return renderer.createTile(await grading.gradeTile(tile, context), context);
    },
    disposeTile: (object) => renderer.disposeTile?.(object),
  };
}
