/**
 * Road grading for streamed tiles: gathers what one tile cannot know (its neighbors' roads and
 * the ground beyond its edges) and applies the two pure passes, `gradeRoadEarthworks` to the
 * tile's ground and `gradeTransportSeparations` to its bridges.
 *
 * Both passes must give adjacent tiles the same answer along their shared edge. So neither
 * reads the tile's own ground: heights come from one fixed elevation level, sampled as a function
 * of world position, and roads from the tile and the eight around it. For bridges that is not
 * enough (an interchange reaches farther than a tile reads), so near an edge a road takes its
 * height from both tiles' gradings, which both tiles read alike (see `blend`).
 *
 * The heavy part of each is done off the main thread where the height source can: the ground by
 * `gradeEarthworks`, a tile's bridges by `gradeSeparations` (see road-separation.ts). What stays
 * here is gathering the roads, cutting them to their tiles, and the blend along tile edges.
 *
 * The earthworks also cut the approaches to tunnel portals down to them (tunnel-portals.ts):
 * the portals around a tile are found in its neighborhood's roads, each approach graded below its
 * profile along the way, and the depth reached at each portal is what `tunnelPortalGround` tells
 * the bores, so a bore starts where its road comes down.
 */
import type { Heightfield } from './heightfield';
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
  roadEarthworkLineReaches,
  roadEarthworkLines,
  roadEarthworkWater,
  roadProfileHeight,
  roadReferenceGround,
} from './road-earthworks';
import {
  breathe,
  gradeRoadSeparationSteps,
  ROAD_SEPARATION_REACH,
  ROAD_SEPARATION_SPACING,
  ROAD_SEPARATION_WAY_STRIDE,
  RoadSeparationPacker,
  type RoadSeparationRequest,
  type RoadSeparationResult,
  roadSeparationCellRange,
  roadSeparationProfile,
  roadSeparationSignature,
} from './road-separation';
import type { TerrainSemanticTileRenderer, TerrainSemanticTileSource } from './semantic-client';
import type {
  TerrainBridgeProfileSample,
  TerrainSemanticLine,
  TerrainSemanticTile,
  TerrainTransportationFeature,
  TerrainWaterFeature,
} from './semantic-types';
import { PATH_SURFACE_LIFT, ROAD_SURFACE_LIFT, transportKind } from './transport-features';
import {
  findTerrainTunnelPortals,
  isInferredTerrainTunnel,
  TERRAIN_TUNNEL_CUTTING_REACH,
  TERRAIN_TUNNEL_INWARD_REACH,
  type TerrainTunnelCutting,
  type TerrainTunnelPortalSource,
  terrainTunnelCutting,
  terrainTunnelCuttingDepths,
  terrainTunnelCuttingLines,
  terrainTunnelWays,
} from './tunnel-portals';

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

export interface TerrainRoadGrading extends TerrainTunnelPortalSource {
  /**
   * Level the ground under and beside a tile's roads: the stream's `transformHeightfield`.
   * Compose it before any transform that must win (an airport's leveling). Approaches to tunnel
   * portals are cut down to them; `tunnelPortalGround` answers, for a level this has graded, the
   * ground a portal's road reaches it at.
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

/** One graded way of a solve: what kind of road it is, and its stations (see `SOLVED_STRIDE`). */
interface SolvedWay {
  signature: string;
  data: Float64Array;
}

/** A road's profile height at a point of the tile, along a direction: the ground a grading read. */
type RoadGround = (x: number, z: number, dx: number, dz: number) => number;

/**
 * One tile's bridges graded with the roads around it: the tile's own roads cut to its square
 * (`pieces`, each of line `owners[i]` of `transportation`), the profiles the grading gave them,
 * and every way it gave a profile, the roads around among them, in world meters.
 */
interface Solve {
  transportation: readonly TerrainTransportationFeature[];
  pieces: TerrainTransportationFeature[];
  owners: [feature: number, line: number][];
  profiles: Map<number, TerrainBridgeProfileSample[]>;
  ways: SolvedWay[];
  /**
   * Segments of `ways` by the cells they come near, as way and station in turn: a
   * `RoadSeparationResult`'s index (see `roadSeparationCellRange`), undefined without ways.
   */
  cells?: Pick<RoadSeparationResult, 'cellKeys' | 'cellEnds' | 'cells'>;
  /** Graded over a reference ground: only then is there a ground to read (see `ground`). */
  graded: boolean;
  /**
   * The ground the grading read, in the tile's own meters. Present when the grading was done on
   * this thread; one done elsewhere reads it here only if the blend asks (see `groundOf`).
   */
  ground?: RoadGround;
  groundLoad?: Promise<RoadGround | undefined>;
}

/** A tile's grading in the cache: while it is worked out, the tiles waiting for it. */
interface SolveEntry {
  promise: Promise<Solve | undefined>;
  waiters: Set<AbortSignal> | undefined;
  /** Take note of another tile waiting, to stop the grading once none is left. */
  watch?: ((waiter: AbortSignal) => void) | undefined;
}

/** Numbers to a station of a `SolvedWay`: world x and z, elevation, flatness, anchor, ground. */
const SOLVED_STRIDE = ROAD_SEPARATION_WAY_STRIDE;
/** How near a segment a point is on it, meters. */
const SOLVED_REACH = ROAD_SEPARATION_REACH;
const roadSignature = roadSeparationSignature;
/** Whether two lists of roads are the same roads, feature for feature and line for line. */
function sameRoads(
  a: readonly TerrainTransportationFeature[],
  b: readonly TerrainTransportationFeature[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i] as TerrainTransportationFeature,
      q = b[i] as TerrainTransportationFeature;
    if (p === q) continue;
    if (
      p.class !== q.class ||
      p.subclass !== q.subclass ||
      p.bridge !== q.bridge ||
      p.tunnel !== q.tunnel ||
      p.deckElevation !== q.deckElevation ||
      p.bridgeConnections?.length !== q.bridgeConnections?.length ||
      p.bridgeApproachProfile?.length !== q.bridgeApproachProfile?.length ||
      p.lines.length !== q.lines.length
    )
      return false;
    for (let l = 0; l < p.lines.length; l++) {
      const m = p.lines[l] as TerrainSemanticLine,
        n = q.lines[l] as TerrainSemanticLine;
      if (m === n) continue;
      if (m.length !== n.length) return false;
      for (const k of [0, m.length - 1])
        if (m[k]?.[0] !== n[k]?.[0] || m[k]?.[1] !== n[k]?.[1]) return false;
    }
  }
  return true;
}

/** Meters beyond a tile within which a neighbor's bridges and approaches still matter to it. */
const SEPARATION_REACH = 400;
/**
 * Meters from a tile's edge, to either side, within which a road takes its height from both
 * tiles' gradings (see `blend`). Inside what each tile reads beyond its own edge, with room to
 * spare: at the far end of the band a tile's share is nothing, as is what it knows.
 */
const BLEND_REACH = 300;
/** Meters between the stations bridge profiles are worked out at. */
const SEPARATION_SPACING = ROAD_SEPARATION_SPACING;
const NEVER = new AbortController().signal;
/** Main-thread time (ms) one tile's grading takes before letting a frame through. */
const SLICE_MS = 2;
/**
 * Meters beyond a tile within which a tunnel portal's cutting can still reach its ground: as far
 * as an approach is cut, and as far as the tile's grading reaches past its edge (see `reach`).
 */
const PORTAL_REACH = TERRAIN_TUNNEL_CUTTING_REACH + 150;

function remember<T>(cache: Map<string, T>, key: string, value: T, limit: number): T {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value as string);
  return value;
}

/** Share one grading between a terrain stream and its features layer. */
export function createTerrainRoadGrading(options: TerrainRoadGradingOptions): TerrainRoadGrading {
  let heights = options.heights;
  /**
   * The stream's own source, as `transformHeightfield` is handed it. A host's `heights` is often
   * a thin stand-in for it (`load` alone, until the stream exists), and only the source itself
   * can grade bridges off the main thread.
   */
  let streamSource: TerrainPyramidHeightSource | undefined;
  /** Who grades a tile's bridges off the main thread, if anyone can. */
  const separator = (): TerrainPyramidHeightSource | undefined =>
    heights?.gradeSeparations ? heights : streamSource?.gradeSeparations ? streamSource : undefined;
  let disposed = false;
  /** Gradings under way elsewhere, to call off when this is disposed. */
  const stops = new Set<AbortController>();
  const roads = new Map<string, Promise<TileRoads | undefined>>();
  /** A tile's grading, and while it is worked out the tiles that wait for it. */
  const solves = new Map<string, SolveEntry>();
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
  const reference = (
    pyramid: TerrainPyramidDescriptor,
    source: TerrainPyramidHeightSource,
    bounds: readonly [number, number, number, number],
    level: number,
  ): Promise<((x: number, z: number) => number) | undefined> =>
    roadReferenceGround(
      pyramid,
      (address) => {
        // Kept for the tiles around: failures and gaps are asked for again.
        const key = terrainPyramidTileKey(address);
        let pending = fields.get(key);
        if (!pending) {
          pending = source.load(address, NEVER).catch(() => undefined);
          const asked = pending;
          void asked.then((value) => {
            if (value === undefined && fields.get(key) === asked) fields.delete(key);
          });
        }
        return remember(fields, key, pending, 48);
      },
      bounds,
      level,
    );
  const referenceLevel = (pyramid: TerrainPyramidDescriptor, level: number): number =>
    Math.max(pyramid.minLevel, Math.min(level, pyramid.maxLevel - 2));
  /** The levels whose ground this has graded, and so whose portals' approaches it has cut. */
  const cutLevels = new Set<number>();
  /** The pyramid the stream grades, as the first tile handed over told it. */
  let gradedPyramid: TerrainPyramidDescriptor | undefined;
  const cuttings = new Map<string, Promise<TerrainTunnelCutting[] | undefined>>();
  /**
   * The cuttings of the tunnel portals that can reach a tile's ground: those within
   * `PORTAL_REACH` of it, found in the roads of the tile and the eight around it. Every answer
   * reads only what lies near its portal (see tunnel-portals.ts), so tiles that share a portal
   * cut it alike. Undefined when the ground could not be read: asked again by the next caller.
   */
  const cuttingsOf = (
    address: TerrainPyramidTileAddress,
    pyramid: TerrainPyramidDescriptor,
    source: TerrainPyramidHeightSource,
  ): Promise<TerrainTunnelCutting[] | undefined> => {
    const key = terrainPyramidTileKey(address);
    const known = cuttings.get(key);
    if (known) return remember(cuttings, key, known, 64);
    const work = (async (): Promise<TerrainTunnelCutting[] | undefined> => {
      const around = await neighborhood(address);
      if (!around.some(({ roads: tile }) => tile.transportation.some(isInferredTerrainTunnel)))
        return [];
      const tileSize = terrainPyramidTileSize(pyramid, address.level);
      const origin = terrainPyramidTileOrigin(pyramid, address);
      const ways = terrainTunnelWays(
        around.map(({ dx, dz, roads: tile }) => ({
          dx,
          dz,
          transportation: tile.transportation,
        })),
        origin,
        tileSize,
      );
      const seeds = findTerrainTunnelPortals(ways, [
        origin[0] - PORTAL_REACH,
        origin[1] - PORTAL_REACH,
        origin[0] + tileSize + PORTAL_REACH,
        origin[1] + tileSize + PORTAL_REACH,
      ]);
      if (seeds.length === 0) return [];
      // The ground along each approach's profile and over each bore's first stretch.
      const margin = PORTAL_REACH + TERRAIN_TUNNEL_INWARD_REACH + ROAD_PROFILE_WINDOW + 10;
      const ground = await reference(
        pyramid,
        source,
        [
          origin[0] - margin,
          origin[1] - margin,
          origin[0] + tileSize + margin,
          origin[1] + tileSize + margin,
        ],
        referenceLevel(pyramid, address.level),
      );
      if (!ground) return undefined;
      return seeds.map((seed) => terrainTunnelCutting(seed, ground));
    })().catch(() => undefined);
    void work.then((value) => {
      if (value === undefined && cuttings.get(key) === work) cuttings.delete(key);
    });
    return remember(cuttings, key, work, 64);
  };
  /**
   * A tile's ways with the approaches to portals cut down, and graded lines for the approaches
   * the ground is not otherwise graded for (paths). Lines are copied, never changed: the same
   * line is graded into each tile around its own.
   */
  const withCuttings = (
    lines: readonly RoadEarthworkLine[],
    cut: readonly TerrainTunnelCutting[],
  ): RoadEarthworkLine[] => {
    const result = lines.map((line) => {
      const depths = terrainTunnelCuttingDepths(line.points, line.bounds, cut);
      return depths ? { ...line, depths } : line;
    });
    for (const line of terrainTunnelCuttingLines(cut)) result.push(line);
    return result;
  };
  /**
   * Grade one tile's bridges with the roads around it (see `Solve`). Undefined when a tile or
   * the ground it needs could not be read: asked again by the next caller.
   */
  const solve = async (
    address: TerrainPyramidTileAddress,
    pyramid: TerrainPyramidDescriptor,
    own: TileRoads,
    wanted: () => boolean,
    /** Aborted once nobody wants the grading: one under way off this thread is called off. */
    signal: AbortSignal,
  ): Promise<Solve | undefined> => {
    if (disposed || !heights) return undefined;
    const tileSize = terrainPyramidTileSize(pyramid, address.level);
    const origin = terrainPyramidTileOrigin(pyramid, address);
    const around = await neighborhood(address, own);
    if (!wanted()) return undefined;
    const solved: Solve = {
      transportation: own.transportation,
      pieces: [],
      owners: [],
      profiles: new Map(),
      ways: [],
      graded: false,
    };
    // No bridge in the tile or around it, as most tiles have none: nothing to grade, and
    // nothing reads the pieces of a tile that graded no way. Told before the roads are cut,
    // which for nine tiles of streets was time spent on every tile of every town.
    if (!around.some(({ roads: tile }) => tile.transportation.some((f) => f.bridge && !f.tunnel)))
      return solved;
    // Every tile's roads are cut to its own square, this tile's and its neighbors' alike,
    // so both tiles that share an edge work on the same pieces, stationed the same way,
    // and give a road crossing the edge one height there. Neighbors' roads stop where
    // they can no longer matter.
    const square = [0, 0, 1, 1] as const;
    let buffer = 0;
    const { pieces, owners } = solved;
    // The ways as they go to whoever grades them (the tile's own, then those around it), and
    // which piece each of the tile's own is: ways that take no part in grading are not sent.
    const packer = new RoadSeparationPacker();
    const sent: number[] = [];
    let bridges = false;
    own.transportation.forEach((feature, f) => {
      if (feature.tunnel) return;
      feature.lines.forEach((line, l) => {
        for (const [u, v] of line) buffer = Math.max(buffer, -u, u - 1, -v, v - 1);
        for (const piece of clipRoadLine(line, square)) {
          if (piece.length < 2) continue;
          if (packer.add(feature, piece)) sent.push(pieces.length);
          if (feature.bridge) bridges = true;
          pieces.push({ ...feature, lines: [piece] });
          owners.push([f, l]);
        }
      });
    });
    packer.endOwn();
    const margin = Math.min(1, SEPARATION_REACH / tileSize);
    const outer = [-margin, -margin, 1 + margin, 1 + margin] as const;
    for (const { dx, dz, roads: neighbor } of around) {
      if (dx === 0 && dz === 0) continue;
      for (const feature of neighbor.transportation) {
        if (feature.tunnel) continue;
        for (const line of feature.lines)
          for (const piece of clipRoadLine(line, square))
            for (const near of clipRoadLine(
              piece.map(([u, v]): [number, number] => [u + dx, v + dz]),
              outer,
            )) {
              if (near.length < 2) continue;
              packer.add(feature, near);
              if (feature.bridge) bridges = true;
            }
      }
    }
    if (!bridges) return solved;
    solved.graded = true;
    // Bridges, but none that takes part (their heights were surveyed or authored): no way is
    // given a profile, and nothing reads the ground of a tile that graded no way.
    if (!packer.bridges) return solved;
    const reach = SEPARATION_REACH + ROAD_PROFILE_WINDOW + 12;
    const request = (): RoadSeparationRequest =>
      packer.request({
        address,
        // A road is drawn a little past the tile's edge: its profile reaches there too.
        extend: Math.min(0.05, buffer) * tileSize + SEPARATION_SPACING,
        referenceLevel: referenceLevel(pyramid, address.level),
        reach,
      });
    let result: RoadSeparationResult | undefined;
    const elsewhere = separator();
    if (elsewhere?.gradeSeparations) {
      // Off the main thread where the source can: an interchange and what surrounds it is
      // tens of thousands of stations, 139 ms of each second of a flight over a city of
      // viaducts when taken here between frames.
      let answer: RoadSeparationResult | null | undefined;
      let failed = false;
      try {
        answer = await elsewhere.gradeSeparations(request(), signal);
      } catch {
        // Whoever was to grade it cannot: graded here, as without them.
        failed = true;
      }
      if (disposed || !wanted()) return undefined;
      if (!failed) {
        // Called off, or no reference ground to grade over: asked again by the next caller.
        if (!answer) return undefined;
        result = answer;
      }
    }
    if (result === undefined) {
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
      if (disposed || !ground || !wanted()) return undefined;
      solved.ground = (x, z, dx, dz) =>
        roadProfileHeight(ground, origin[0] + x, origin[1] + z, dx, dz);
      // Taken a few milliseconds at a time, like the earthworks.
      const steps = gradeRoadSeparationSteps(request(), origin, tileSize, ground);
      for (let slice = performance.now(); ; ) {
        const step = steps.next();
        if (step.done) {
          result = step.value;
          break;
        }
        if (performance.now() - slice < SLICE_MS) continue;
        await breathe();
        if (disposed || !wanted()) return undefined;
        slice = performance.now();
      }
    }
    // Back onto the tile's pieces, and the graded ways as the tiles around will read them.
    for (let k = 0; k < result.profiled.length; k++)
      solved.profiles.set(
        sent[result.profiled[k] as number] as number,
        roadSeparationProfile(result, k),
      );
    result.signatures.forEach((signature, way) => {
      const from = way === 0 ? 0 : (result.wayEnds[way - 1] as number);
      solved.ways.push({
        signature,
        data: result.ways.subarray(
          from * SOLVED_STRIDE,
          (result.wayEnds[way] as number) * SOLVED_STRIDE,
        ),
      });
    });
    // Only the index and the stations are kept: the profiles now stand on the pieces.
    if (solved.ways.length > 0)
      solved.cells = {
        cellKeys: result.cellKeys,
        cellEnds: result.cellEnds,
        cells: result.cells,
      };
    return solved;
  };
  /**
   * The ground a tile's grading read, for the blend: the grading's own when it was done on this
   * thread, else read here the first time it is asked for, from the same elevation level over
   * the same reach. Undefined for a tile that graded nothing, and where it cannot be read.
   */
  const groundOf = (
    solved: Solve,
    address: TerrainPyramidTileAddress,
    pyramid: TerrainPyramidDescriptor,
  ): Promise<RoadGround | undefined> => {
    const source = heights;
    if (solved.ground || !solved.graded || !source) return Promise.resolve(solved.ground);
    solved.groundLoad ??= (async (): Promise<RoadGround | undefined> => {
      const tileSize = terrainPyramidTileSize(pyramid, address.level);
      const origin = terrainPyramidTileOrigin(pyramid, address);
      const reach = SEPARATION_REACH + ROAD_PROFILE_WINDOW + 12;
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
      ).catch(() => undefined);
      if (ground)
        solved.ground = (x, z, dx, dz) =>
          roadProfileHeight(ground, origin[0] + x, origin[1] + z, dx, dz);
      return solved.ground;
    })();
    return solved.groundLoad;
  };
  /**
   * The grading of a tile's plain roads, kept for the tiles around it. `signal` is the tile
   * that waits for it: a grading goes on while any tile that asked still wants it, and stops
   * when none does (a fast flight asks for tiles it never draws, and each asks for eight more).
   */
  const solveOf = (
    address: TerrainPyramidTileAddress,
    pyramid: TerrainPyramidDescriptor,
    signal: AbortSignal,
  ): Promise<Solve | undefined> => {
    const count = terrainPyramidTileCount(address.level);
    if (address.x < 0 || address.z < 0 || address.x >= count || address.z >= count)
      return Promise.resolve(undefined);
    const key = terrainPyramidTileKey(address);
    const known = solves.get(key);
    if (known) {
      if (known.waiters && !known.waiters.has(signal)) {
        known.waiters.add(signal);
        known.watch?.(signal);
      }
      return remember(solves, key, known, 64).promise;
    }
    const waiters = new Set([signal]);
    const entry: SolveEntry = { promise: Promise.resolve(undefined), waiters };
    const wanted = (): boolean => {
      for (const waiter of waiters) if (!waiter.aborted) return true;
      // Forgotten in the same breath: whoever asks next starts afresh rather than waiting
      // on a grading that has stopped.
      if (solves.get(key) === entry) solves.delete(key);
      return false;
    };
    // A grading under way off this thread is told when the last tile waiting for it gives up.
    const stop = new AbortController();
    stops.add(stop);
    const watched: [AbortSignal, () => void][] = [];
    entry.watch = (waiter) => {
      const gone = (): void => {
        if (!wanted()) stop.abort();
      };
      waiter.addEventListener('abort', gone, { once: true });
      watched.push([waiter, gone]);
    };
    entry.watch(signal);
    entry.promise = roadsOf(address)
      .then((roads) => (roads ? solve(address, pyramid, roads, wanted, stop.signal) : undefined))
      .catch(() => undefined);
    void entry.promise.then((value) => {
      entry.waiters = undefined;
      entry.watch = undefined;
      stops.delete(stop);
      for (const [waiter, gone] of watched) waiter.removeEventListener('abort', gone);
      if (value === undefined && solves.get(key) === entry) solves.delete(key);
    });
    return remember(solves, key, entry, 64).promise;
  };
  /**
   * The height a solve gave a road at a world position, with how level its cross-section is
   * and how much it follows the drawn ground: the station of a way of that kind within half a
   * meter, running along one of `directions` (unit vectors: the road's segments that meet
   * there, both of them at a bend). Where two ways meet there (a road cut at a tile edge), the
   * higher, as joined roads agree. Undefined when the solve has no such road there.
   */
  const solvedAt = (
    solved: Solve,
    x: number,
    z: number,
    directions: readonly (readonly [number, number])[],
    signature: string,
  ): [elevation: number, flatness: number, anchor: number, ground: number] | undefined => {
    const index = solved.cells;
    if (!index) return undefined;
    const [from, to] = roadSeparationCellRange(index, x, z);
    const list = index.cells;
    let nearest = SOLVED_REACH;
    let found: [number, number, number, number] | undefined;
    for (let k = from; k < to; k += 2) {
      const way = solved.ways[list[k] as number] as SolvedWay;
      if (way.signature !== signature) continue;
      const at = (list[k + 1] as number) * SOLVED_STRIDE;
      const ax = way.data[at] as number,
        az = way.data[at + 1] as number,
        bx = way.data[at + SOLVED_STRIDE] as number,
        bz = way.data[at + SOLVED_STRIDE + 1] as number;
      const sx = bx - ax,
        sz = bz - az;
      const length2 = sx * sx + sz * sz;
      const length = Math.sqrt(length2);
      // Another road of the kind crossing this one is not it.
      if (
        length > 1e-6 &&
        !directions.some(([tx, tz]) => Math.abs(sx * tx + sz * tz) >= 0.7 * length)
      )
        continue;
      const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / length2)) : 0;
      const distance = Math.hypot(x - ax - sx * t, z - az - sz * t);
      if (distance > nearest + 0.05) continue;
      const value = (offset: number): number =>
        (way.data[at + offset] as number) +
        ((way.data[at + SOLVED_STRIDE + offset] as number) - (way.data[at + offset] as number)) * t;
      const elevation = value(2);
      if (found && distance > nearest - 0.05 && elevation <= found[0]) continue;
      nearest = Math.min(nearest, distance);
      found = [elevation, value(3), value(4), value(5)];
    }
    return found;
  };
  /**
   * The profiles of a tile's pieces with each sample set where the tiles that see it agree.
   *
   * Every tile grades its bridges from what lies within reach of it, and an interchange
   * reaches farther than that: one tile sees the ramp that lifts a deck, the next does not, and
   * each drew its half of the deck at its own height, a step of meters across the road along
   * the tile edge. So within `BLEND_REACH` of an edge a road takes its height from both tiles'
   * gradings, half and half on the edge itself and wholly its own tile's from the reach inward
   * (four tiles' at a corner). Each tile reads the same gradings of the same point, so the two
   * halves of a road meet whatever each grading made of it; and a mix of profiles that each
   * clear what they cross clears it too.
   */
  /**
   * The directions of the segments meeting at point `k` of a polyline: the one arriving and the
   * one leaving. Not their mean: where a road doubles back (the two carriageways of a divided
   * road joined end to end at the junction where it stops being divided), that points across
   * both and matches neither.
   */
  const directionsAt = (
    points: readonly (readonly [number, number])[],
    k: number,
  ): [number, number][] => {
    const out: [number, number][] = [];
    const at = points[k] as readonly [number, number];
    for (const other of [points[k - 1], points[k + 1]]) {
      if (!other) continue;
      const length = Math.hypot(other[0] - at[0], other[1] - at[1]);
      if (length > 1e-9) out.push([(other[0] - at[0]) / length, (other[1] - at[1]) / length]);
    }
    return out;
  };
  const blend = async (
    center: Solve,
    address: TerrainPyramidTileAddress,
    pyramid: TerrainPyramidDescriptor,
    signal: AbortSignal,
  ): Promise<Map<number, TerrainBridgeProfileSample[]>> => {
    const tileSize = terrainPyramidTileSize(pyramid, address.level);
    const origin = terrainPyramidTileOrigin(pyramid, address);
    const band = Math.min(0.5, BLEND_REACH / tileSize);
    /** A tile's share of a point at `t` (0 to 1 across it), by how far inside its edges. */
    const share = (t: number): number =>
      Math.max(0, Math.min(1, (t + band) / (2 * band), (1 + band - t) / (2 * band)));
    const profiles = new Map(center.profiles);
    // Which of the tiles around have a say in any sample.
    const wanted = new Set<number>();
    const consider = (u: number, v: number): void => {
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++)
          if ((dx !== 0 || dz !== 0) && share(u - dx) * share(v - dz) > 1e-4)
            wanted.add((dz + 1) * 3 + dx + 1);
    };
    for (const samples of profiles.values())
      for (const sample of samples) consider(sample.point[0], sample.point[1]);
    if (wanted.size === 0) return profiles;
    const finished = new Map<number, Solve>();
    await Promise.all(
      [...wanted].map(async (slot) => {
        const dx = (slot % 3) - 1,
          dz = Math.floor(slot / 3) - 1;
        const solved = await solveOf(
          { level: address.level, x: address.x + dx, z: address.z + dz },
          pyramid,
          signal,
        );
        if (solved) finished.set(slot, solved);
      }),
    );
    // In the tiles' own order, not the order their gradings happened to finish in: the sums
    // below are then the same numbers whenever a tile is graded, to the last bit. Summed as
    // they finished, a road's height moved by a rounding error from one visit to the next.
    const around = new Map([...finished].sort((a, b) => a[0] - b[0]));
    if (disposed || around.size === 0) return profiles;
    // A road on the ground here that a tile beside this one has climbing: it gets a profile
    // too, on the ground in this tile's grading, to carry that tile's share of it. First the
    // roads a tile beside this one has a height for at all, and where: only for those is the
    // ground read, which a grading done off this thread has yet to bring here.
    const raised: { piece: number; at: number[] }[] = [];
    if (center.graded)
      center.pieces.forEach((piece, i) => {
        if (profiles.has(i) || piece.bridge) return;
        const line = piece.lines[0] as TerrainSemanticLine;
        const signature = roadSignature(piece);
        // u, v, the road's direction there, and the height the tile beside gives it.
        const at: number[] = [];
        for (let k = 0; k < line.length; k++) {
          const [u, v] = line[k] as [number, number];
          const directions = directionsAt(line, k);
          const [tx, tz] = directions[0] ?? [1, 0];
          for (const [slot, solved] of around) {
            const dx = (slot % 3) - 1,
              dz = Math.floor(slot / 3) - 1;
            if (solved.ways.length === 0 || share(u - dx) * share(v - dz) <= 1e-4) continue;
            const theirs = solvedAt(
              solved,
              origin[0] + u * tileSize,
              origin[1] + v * tileSize,
              directions,
              signature,
            );
            if (theirs !== undefined) at.push(u, v, tx, tz, theirs[0]);
          }
        }
        if (at.length > 0) raised.push({ piece: i, at });
      });
    const ground = raised.length > 0 ? await groundOf(center, address, pyramid) : undefined;
    if (disposed) return profiles;
    if (ground)
      for (const { piece: i, at } of raised) {
        const piece = center.pieces[i] as TerrainTransportationFeature;
        const line = piece.lines[0] as TerrainSemanticLine;
        const lift = transportKind(piece) === 'path' ? PATH_SURFACE_LIFT : ROAD_SURFACE_LIFT;
        let climbs = false;
        // Off the ground by more than a seam would show.
        for (let k = 0; k < at.length && !climbs; k += 5)
          climbs =
            (at[k + 4] as number) >
            ground(
              (at[k] as number) * tileSize,
              (at[k + 1] as number) * tileSize,
              at[k + 2] as number,
              at[k + 3] as number,
            ) +
              lift +
              0.1;
        if (!climbs) continue;
        const samples: TerrainBridgeProfileSample[] = [];
        for (let k = 0; k + 1 < line.length; k++) {
          const [au, av] = line[k] as [number, number],
            [bu, bv] = line[k + 1] as [number, number];
          const length = Math.hypot(bu - au, bv - av) * tileSize;
          if (length < 1e-4) continue;
          const count = Math.max(1, Math.ceil(length / SEPARATION_SPACING));
          for (let j = k === 0 ? 0 : 1; j <= count; j++) {
            const u = au + ((bu - au) * j) / count,
              v = av + ((bv - av) * j) / count;
            const level = ground(
              u * tileSize,
              v * tileSize,
              ((bu - au) * tileSize) / length,
              ((bv - av) * tileSize) / length,
            );
            samples.push({
              point: [u, v],
              elevation: level + lift,
              flatness: 0,
              ground: level,
              anchor: 1,
            });
          }
        }
        if (samples.length > 1) profiles.set(i, samples);
      }
    for (const [i, samples] of profiles) {
      const piece = center.pieces[i] as TerrainTransportationFeature;
      const signature = roadSignature(piece);
      const lift = transportKind(piece) === 'path' ? PATH_SURFACE_LIFT : ROAD_SURFACE_LIFT;
      const points = samples.map((sample) => sample.point);
      profiles.set(
        i,
        samples.map((sample, k) => {
          const [u, v] = sample.point;
          const own = share(u) * share(v);
          if (own >= 1 - 1e-4) return sample;
          const directions = directionsAt(points, k);
          const x = origin[0] + u * tileSize,
            z = origin[1] + v * tileSize;
          // This tile's grading is read as the tiles around read it: the same answer both ways.
          const mine = solvedAt(center, x, z, directions, signature) ?? [
            sample.elevation,
            sample.flatness,
            sample.anchor ?? 0,
            sample.ground ?? 0,
          ];
          let weight = own,
            elevation = own * mine[0],
            flatness = own * mine[1],
            anchor = own * mine[2],
            ground = own * mine[3];
          for (const [slot, solved] of around) {
            const dx = (slot % 3) - 1,
              dz = Math.floor(slot / 3) - 1;
            const theirs = share(u - dx) * share(v - dz);
            if (theirs <= 0) continue;
            // A road with no profile there lies on the ground; a deck with none is not known.
            const value =
              solvedAt(solved, x, z, directions, signature) ??
              (piece.bridge || sample.ground === undefined
                ? undefined
                : ([sample.ground + lift, 0, 1, sample.ground] as const));
            if (!value) continue;
            weight += theirs;
            elevation += theirs * value[0];
            flatness += theirs * value[1];
            anchor += theirs * value[2];
            ground += theirs * value[3];
          }
          if (weight <= 0) return sample;
          return {
            ...sample,
            elevation: elevation / weight,
            flatness: flatness / weight,
            // What a deck's landing was graded over is each grading's own reading too.
            ...(sample.anchor !== undefined ? { anchor: anchor / weight } : {}),
            ...(sample.ground !== undefined ? { ground: ground / weight } : {}),
          };
        }),
      );
    }
    return profiles;
  };

  return {
    async tunnelPortalGround(level, x, z) {
      const pyramid = gradedPyramid;
      const source = streamSource ?? heights;
      if (disposed || !pyramid || !source || !cutLevels.has(level)) return undefined;
      const size = terrainPyramidTileSize(pyramid, level);
      const address = {
        level,
        x: Math.floor((x - pyramid.origin[0]) / size),
        z: Math.floor((z - pyramid.origin[1]) / size),
      };
      let nearest: TerrainTunnelCutting | undefined;
      let best = 1.5;
      for (const cutting of (await cuttingsOf(address, pyramid, source)) ?? []) {
        const distance = Math.hypot(cutting.x - x, cutting.z - z);
        if (distance < best) {
          best = distance;
          nearest = cutting;
        }
      }
      return nearest?.ground;
    },
    async transformHeightfield(context, source) {
      heights ??= source;
      streamSource ??= source;
      const { heightfield, address, pyramid, origin, tileSize, signal } = context;
      if (disposed || options.earthworks === false || signal.aborted) return heightfield;
      if (address.level < (options.minLevel ?? pyramid.minLevel)) return heightfield;
      const side = context.surfaceResolution ?? heightfield.cols;
      const spacing = tileSize / Math.max(1, side - 1);
      const maxSpacing = options.maxSpacing ?? 28;
      if (spacing > maxSpacing) return heightfield;
      // This level's ground is graded, and its portals' approaches cut: the bores ask.
      cutLevels.add(address.level);
      gradedPyramid ??= pyramid;
      const around = await neighborhood(address);
      if (signal.aborted || around.length === 0) return heightfield;
      let lines: RoadEarthworkLine[] = [];
      for (const { dx, dz, roads: tile } of around) {
        // Built once for a tile, then graded into it and each tile around it.
        tile.lines ??= roadEarthworkLines(
          tile.transportation,
          [origin[0] + dx * tileSize, origin[1] + dz * tileSize],
          tileSize,
        );
        for (const line of tile.lines) lines.push(line);
      }
      // Approaches to tunnel portals go down their cuttings.
      const cut = (await cuttingsOf(address, pyramid, source))?.filter((c) => c.depth > 0) ?? [];
      if (signal.aborted) return heightfield;
      if (cut.length > 0) lines = withCuttings(lines, cut);
      if (lines.length === 0) return heightfield;
      // As far as a bench and its blend reach past the tile, and a profile's window past that.
      const reach = 16 + spacing * 2.7 + ROAD_PROFILE_WINDOW + 12;
      const lakes = (
        around.find((tile) => tile.dx === 0 && tile.dz === 0)?.roads.water ?? []
      ).flatMap((feature) => feature.polygons ?? []);
      if (source.gradeEarthworks) {
        // Off the main thread where the source can: a town tile's thousands of stations were
        // 4-9% of it in a low flight over a city, taken between frames a slice at a time.
        const reaching = lines.filter((line) =>
          roadEarthworkLineReaches(line, origin, [tileSize, tileSize], spacing),
        );
        if (reaching.length === 0) return heightfield;
        const graded = await source.gradeEarthworks(
          {
            address,
            heightfield,
            surfaceResolution: side,
            maxSpacing,
            lines: reaching,
            water: lakes,
            referenceLevel: referenceLevel(pyramid, address.level),
            reach,
          },
          signal,
        );
        return graded ?? heightfield;
      }
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
      const water = roadEarthworkWater(lakes, origin, tileSize);
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
        // The grading kept for this tile serves when it is of these roads; a tile whose roads
        // a host has changed is graded on its own.
        const plain = await roadsOf(address);
        if (signal.aborted) return tile;
        const center =
          plain && sameRoads(plain.transportation, tile.transportation)
            ? await solveOf(address, pyramid, signal)
            : await solve(
                address,
                pyramid,
                { transportation: tile.transportation, water: tile.water },
                () => !signal.aborted,
                signal,
              );
        if (signal.aborted || !center || center.ways.length === 0) return tile;
        const blended = await blend(center, address, pyramid, signal);
        if (signal.aborted) return tile;
        // Back onto the tile's own lines: each keeps its geometry and takes the profile of its
        // piece (of its pieces, end to end, where the tile's edge cut it more than once).
        const profiles = new Map<number, Map<number, TerrainBridgeProfileSample[]>>();
        center.owners.forEach(([f, l], i) => {
          const samples = blended.get(i);
          if (!samples?.length) return;
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
      for (const stop of stops) stop.abort();
      stops.clear();
      roads.clear();
      solves.clear();
      fields.clear();
      cuttings.clear();
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
