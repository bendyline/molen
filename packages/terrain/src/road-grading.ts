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
 */
import { gradeTransportSeparationSteps } from './grade-separation';
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
import type { TerrainSemanticTileRenderer, TerrainSemanticTileSource } from './semantic-client';
import type {
  TerrainBridgeProfileSample,
  TerrainSemanticLine,
  TerrainSemanticTile,
  TerrainTransportationFeature,
  TerrainWaterFeature,
} from './semantic-types';
import { PATH_SURFACE_LIFT, ROAD_SURFACE_LIFT, transportKind } from './transport-features';

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

/** One graded way of a solve: what kind of road it is, and its stations (see `SOLVED_STRIDE`). */
interface SolvedWay {
  signature: string;
  data: Float64Array;
}

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
  /** Segments of `ways` by the cells they come near, as way and station in turn. */
  cells: Map<number, number[]>;
  /** The ground the grading read, in the tile's own meters; absent when it graded nothing. */
  ground?: (x: number, z: number, dx: number, dz: number) => number;
}

/** Numbers to a station of a `SolvedWay`: world x and z, elevation, flatness, anchor, ground. */
const SOLVED_STRIDE = 6;
/** Meters to a cell of a solve's index of segments, and how near a segment a point is on it. */
const SOLVED_CELL = 32;
const SOLVED_REACH = 0.5;
const solvedCell = (cx: number, cz: number): number => (cx + 0x200000) * 0x400000 + cz + 0x200000;
/** What tells one road from another where two gradings are matched by position. */
const roadSignature = (feature: TerrainTransportationFeature): string =>
  `${feature.class}/${feature.subclass ?? ''}/${feature.bridge === true ? 1 : 0}`;
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
  /** A tile's grading, and while it is worked out the tiles that wait for it. */
  const solves = new Map<
    string,
    { promise: Promise<Solve | undefined>; waiters: Set<AbortSignal> | undefined }
  >();
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
  /**
   * Grade one tile's bridges with the roads around it (see `Solve`). Undefined when a tile or
   * the ground it needs could not be read: asked again by the next caller.
   */
  const solve = async (
    address: TerrainPyramidTileAddress,
    pyramid: TerrainPyramidDescriptor,
    own: TileRoads,
    wanted: () => boolean,
  ): Promise<Solve | undefined> => {
    if (disposed || !heights) return undefined;
    const tileSize = terrainPyramidTileSize(pyramid, address.level);
    const origin = terrainPyramidTileOrigin(pyramid, address);
    const around = await neighborhood(address, own);
    if (!wanted()) return undefined;
    // Every tile's roads are cut to its own square, this tile's and its neighbors' alike,
    // so both tiles that share an edge work on the same pieces, stationed the same way,
    // and give a road crossing the edge one height there. Neighbors' roads stop where
    // they can no longer matter.
    const square = [0, 0, 1, 1] as const;
    let buffer = 0;
    const pieces: TerrainTransportationFeature[] = [];
    const owners: [feature: number, line: number][] = [];
    own.transportation.forEach((feature, f) => {
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
          for (const piece of clipRoadLine(line, square))
            for (const near of clipRoadLine(
              piece.map(([u, v]): [number, number] => [u + dx, v + dz]),
              outer,
            ))
              if (near.length > 1) lines.push(near);
        if (lines.length > 0) beyondTile.push({ ...feature, lines });
      }
    }
    const solved: Solve = {
      transportation: own.transportation,
      pieces,
      owners,
      profiles: new Map(),
      ways: [],
      cells: new Map(),
    };
    if (!pieces.some((feature) => feature.bridge) && !beyondTile.some((feature) => feature.bridge))
      return solved;
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
    if (disposed || !ground || !wanted()) return undefined;
    solved.ground = (x, z, dx, dz) =>
      roadProfileHeight(ground, origin[0] + x, origin[1] + z, dx, dz);
    // An interchange and what surrounds it is tens of thousands of stations: taken a few
    // milliseconds at a time, like the earthworks.
    const steps = gradeTransportSeparationSteps(pieces, tileSize, solved.ground, {
      context: beyondTile,
      endTolerance: CUT_TOLERANCE,
      spacing: SEPARATION_SPACING,
      // Graded over the reference ground, drawn on the tile's own.
      anchored: true,
      // A road is drawn a little past the tile's edge: its profile reaches there too.
      extend: Math.min(0.05, buffer) * tileSize + SEPARATION_SPACING,
      profiled(feature, _line, samples) {
        if (samples.length < 2) return;
        const data = new Float64Array(samples.length * SOLVED_STRIDE);
        samples.forEach((sample, i) => {
          data[i * SOLVED_STRIDE] = origin[0] + sample.point[0] * tileSize;
          data[i * SOLVED_STRIDE + 1] = origin[1] + sample.point[1] * tileSize;
          data[i * SOLVED_STRIDE + 2] = sample.elevation;
          data[i * SOLVED_STRIDE + 3] = sample.flatness;
          data[i * SOLVED_STRIDE + 4] = sample.anchor ?? 0;
          data[i * SOLVED_STRIDE + 5] = sample.ground ?? 0;
        });
        const index = solved.ways.length;
        solved.ways.push({ signature: roadSignature(feature), data });
        for (let i = 0; i + 1 < samples.length; i++) {
          const ax = data[i * SOLVED_STRIDE] as number,
            az = data[i * SOLVED_STRIDE + 1] as number,
            bx = data[(i + 1) * SOLVED_STRIDE] as number,
            bz = data[(i + 1) * SOLVED_STRIDE + 1] as number;
          for (
            let cx = Math.floor((Math.min(ax, bx) - SOLVED_REACH) / SOLVED_CELL);
            cx <= Math.floor((Math.max(ax, bx) + SOLVED_REACH) / SOLVED_CELL);
            cx++
          )
            for (
              let cz = Math.floor((Math.min(az, bz) - SOLVED_REACH) / SOLVED_CELL);
              cz <= Math.floor((Math.max(az, bz) + SOLVED_REACH) / SOLVED_CELL);
              cz++
            ) {
              const key = solvedCell(cx, cz);
              const list = solved.cells.get(key);
              if (list) list.push(index, i);
              else solved.cells.set(key, [index, i]);
            }
        }
      },
    });
    let graded: readonly TerrainTransportationFeature[];
    for (let slice = performance.now(); ; ) {
      const step = steps.next();
      if (step.done) {
        graded = step.value;
        break;
      }
      if (performance.now() - slice < SLICE_MS) continue;
      await breathe();
      if (disposed || !wanted()) return undefined;
      slice = performance.now();
    }
    if (graded === pieces) return solved;
    graded.forEach((feature, i) => {
      const samples = feature.bridgeApproachProfile;
      if (samples?.length && feature !== pieces[i]) solved.profiles.set(i, samples);
    });
    return solved;
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
      known.waiters?.add(signal);
      return remember(solves, key, known, 64).promise;
    }
    const waiters = new Set([signal]);
    const entry: { promise: Promise<Solve | undefined>; waiters: Set<AbortSignal> | undefined } = {
      promise: Promise.resolve(undefined),
      waiters,
    };
    const wanted = (): boolean => {
      for (const waiter of waiters) if (!waiter.aborted) return true;
      // Forgotten in the same breath: whoever asks next starts afresh rather than waiting
      // on a grading that has stopped.
      if (solves.get(key) === entry) solves.delete(key);
      return false;
    };
    entry.promise = roadsOf(address)
      .then((roads) => (roads ? solve(address, pyramid, roads, wanted) : undefined))
      .catch(() => undefined);
    void entry.promise.then((value) => {
      entry.waiters = undefined;
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
    const list = solved.cells.get(
      solvedCell(Math.floor(x / SOLVED_CELL), Math.floor(z / SOLVED_CELL)),
    );
    if (!list) return undefined;
    let nearest = SOLVED_REACH;
    let found: [number, number, number, number] | undefined;
    for (let k = 0; k < list.length; k += 2) {
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
    const around = new Map<number, Solve>();
    await Promise.all(
      [...wanted].map(async (slot) => {
        const dx = (slot % 3) - 1,
          dz = Math.floor(slot / 3) - 1;
        const solved = await solveOf(
          { level: address.level, x: address.x + dx, z: address.z + dz },
          pyramid,
          signal,
        );
        if (solved) around.set(slot, solved);
      }),
    );
    if (disposed || around.size === 0) return profiles;
    // A road on the ground here that a tile beside this one has climbing: it gets a profile
    // too, on the ground in this tile's grading, to carry that tile's share of it.
    const ground = center.ground;
    if (ground)
      center.pieces.forEach((piece, i) => {
        if (profiles.has(i) || piece.bridge) return;
        const line = piece.lines[0] as TerrainSemanticLine;
        const signature = roadSignature(piece);
        const lift = transportKind(piece) === 'path' ? PATH_SURFACE_LIFT : ROAD_SURFACE_LIFT;
        let climbs = false;
        for (let k = 0; k < line.length && !climbs; k++) {
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
            // Off the ground by more than a seam would show.
            climbs =
              theirs !== undefined &&
              theirs[0] > ground(u * tileSize, v * tileSize, tx, tz) + lift + 0.1;
            if (climbs) break;
          }
        }
        if (!climbs) return;
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
      });
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
      roads.clear();
      solves.clear();
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
