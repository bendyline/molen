/**
 * Three-free grade separation shared by pavement and traffic: which way passes over which, how
 * high each deck stands, and how the roads joined to a raised deck climb to meet it.
 *
 * A bridge flag marks the structural span only. Many basemaps keep neither the OSM `layer` tag
 * nor any height, so a stack of ramps arrives as so many bridges with nothing to order them. The
 * inference here is that of the engineer who built them: a deck clears whatever it crosses by a
 * truck's height and its own depth, ramps fly over the roads they join, and nothing climbs
 * faster than its class of road can. It is an inference that yields a buildable interchange,
 * not a survey of the real one.
 *
 * Every rule reads only what lies near the thing it decides, so two tiles that both see a
 * crossing reach the same answer about it.
 */
import type {
  TerrainBridgeProfileSample,
  TerrainSemanticPoint,
  TerrainTransportationFeature,
} from './semantic-types';
import {
  isAeroway,
  isTransportLink,
  PATH_SURFACE_LIFT,
  ROAD_SURFACE_LIFT,
  type TransportKind,
  transportKind,
  transportWidth,
} from './transport-features';

/** What a way carries, for the room it needs overhead. */
export type TerrainGradeFamily = 'road' | 'rail' | 'path';

/**
 * Meters from the surface of a way to the surface of a deck crossing over it: the clear height
 * its traffic needs (5.1 m over a road, the 16 ft 9 in of US practice with resurfacing allowance
 * and well over the 14 ft legal minimum; 7 m over a railway, for double-stack trains and wires;
 * 3 m over a footpath) plus 1.4 m of girder and slab.
 */
export const TERRAIN_GRADE_SEPARATION: Readonly<Record<TerrainGradeFamily, number>> = {
  road: 6.5,
  rail: 8.4,
  path: 4.4,
};
/** Meters a deck stands over ground it spans with nothing mapped beneath (water, mostly). */
const FREE_CLEARANCE: Readonly<Record<TerrainGradeFamily, number>> = { road: 6, rail: 6, path: 3 };
/** A clipped or dangling end is taken to carry on as structure for this many meters. */
const FREE_END_DEPTH = 120;
/** No inferred deck stands higher than this above the profile its ends give it. */
const MAX_RISE = 30;
/** Meters a deck may rise above where it would stand alone to stay level with one beside it. */
const BESIDE_ALLOWANCE = 2.5;
/** Meters from a bridge within which a way can cross it or climb to it, and the cell that sorts by. */
const BRIDGE_REACH = 260;
const BRIDGE_ZONE = 64;
/** Meters one deck's span must stand over another's, where they cross, to be taken as the upper. */
const SPAN_MARGIN = 3;
/** Meters along a structure past which its distance from the ground no longer orders decks. */
const LOCAL_DEPTH = 150;
/** Meters along a deck from its landing over which it stops following the ground drawn there. */
const ANCHOR_REACH = 40;
/** Meters along two ways within which a join between them makes a crossing a junction. */
const JUNCTION_REACH = 8;
/** Lift (m) below which a ground road counts as lying on the ground. */
const LIFT_EPSILON = 0.02;
/** Lift (m) at which a climbing road's cross-section has left the ground's crossfall behind. */
const FLAT_LIFT = 0.6;

export interface GradeSeparationOptions {
  /**
   * Ways that cross, join and carry approaches like any other but are not returned: the
   * neighboring tiles' roads, in the frame of `features`.
   */
  context?: readonly TerrainTransportationFeature[];
  /**
   * Join line ends lying within this many meters of each other without sharing a vertex, as the
   * two halves of a road cut at a tile edge do (default 0: only shared vertices join).
   */
  endTolerance?: number;
  /** Meters between profile samples (default 4). */
  spacing?: number;
  /**
   * Carry each returned way's profile on into the context way joined to its end, this many
   * meters: a tile's road reaches a little past its edge, into the half its neighbor holds.
   */
  extend?: number;
  /**
   * `groundAt` is not the ground the roads will be drawn on (it reads one elevation level for
   * a tile and its neighbors alike): record with each sample the ground it was graded over, so
   * the profile can be moved onto the real ground where it rests on it. See
   * `TerrainBridgeProfileSample.anchor`.
   */
  anchored?: boolean;
}

interface Way {
  feature: TerrainTransportationFeature;
  /** Index into the returned features, or -1 for context. */
  output: number;
  line: number;
  bridge: boolean;
  family: TerrainGradeFamily;
  lift: number;
  grade: number;
  halfWidth: number;
  layer: number | undefined;
  /**
   * Where a deck of this kind stands among decks that cross it with no layer mapped, lowest
   * first: footbridges and railways, freeway carriageways, streets, then ramps.
   */
  standing: number;
  points: TerrainSemanticPoint[];
  /** Node of each point; nodes of a way are contiguous from `first`. */
  vertexNodes: number[];
  first: number;
  count: number;
}

interface Crossing {
  upper: number;
  /** Arc distance along the upper way. */
  at: number;
  lower: number;
  /** Arc distance along the lower way. */
  beneath: number;
  lowerNode: number;
  separation: number;
  /** Half-length (m) of the upper way held clear, and of the lower way kept beneath it. */
  hold: number;
  under: number;
  /** Waiting to be looked at again. */
  queued: boolean;
}

/** Steepest sustained grade of a class of way; stairs climb as stairs do. */
function maxGrade(feature: TerrainTransportationFeature, kind: TransportKind): number {
  const category = (feature.subclass ?? feature.class).toLowerCase();
  if (kind === 'rail') return /light|tram|subway|monorail|funicular/.test(category) ? 0.06 : 0.03;
  if (kind === 'path') return /steps/.test(category) ? 0.5 : 0.1;
  if (kind === 'service') return 0.1;
  const link = isTransportLink(feature);
  if (kind === 'motorway') return link ? 0.07 : 0.05;
  if (link) return 0.08;
  if (/^(trunk|primary)/.test(category)) return 0.06;
  if (/^(secondary|tertiary)/.test(category)) return 0.07;
  return 0.08;
}

function eligible(feature: TerrainTransportationFeature): boolean {
  return (
    !feature.tunnel &&
    feature.deckElevation === undefined &&
    !feature.bridgeConnections?.length &&
    !feature.bridgeApproachProfile?.length &&
    feature.class !== 'ferry' &&
    feature.subclass !== 'ferry' &&
    !isAeroway(feature)
  );
}

/** A binary max-heap of node numbers by a key captured on insertion. */
class Heap {
  private readonly nodes: number[] = [];
  private readonly keys: number[] = [];
  get size(): number {
    return this.nodes.length;
  }
  push(node: number, key: number): void {
    let i = this.nodes.length;
    this.nodes.push(node);
    this.keys.push(key);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((this.keys[parent] as number) >= key) break;
      this.nodes[i] = this.nodes[parent] as number;
      this.keys[i] = this.keys[parent] as number;
      i = parent;
    }
    this.nodes[i] = node;
    this.keys[i] = key;
  }
  pop(): [node: number, key: number] {
    const top: [number, number] = [this.nodes[0] as number, this.keys[0] as number];
    const node = this.nodes.pop() as number,
      key = this.keys.pop() as number;
    const size = this.nodes.length;
    if (size > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= size) break;
        if (child + 1 < size && (this.keys[child + 1] as number) > (this.keys[child] as number))
          child++;
        if ((this.keys[child] as number) <= key) break;
        this.nodes[i] = this.nodes[child] as number;
        this.keys[i] = this.keys[child] as number;
        i = child;
      }
      this.nodes[i] = node;
      this.keys[i] = key;
    }
    return top;
  }
}

/**
 * Give every inferred bridge, and every road that must climb to one, a sampled height profile
 * (`bridgeApproachProfile`), leaving surveyed and authored heights alone.
 *
 * - A deck meets the roads at its ends where they stand, spans straight between them, and rises
 *   toward a free clearance over ground with nothing mapped beneath it.
 * - Wherever it crosses another way without sharing a vertex it clears that way's surface by
 *   `TERRAIN_GRADE_SEPARATION`, held across the lower way's width. Between two bridges the
 *   mapped `layer` decides which is on top; without one, the deck whose span already stands
 *   well above the other's, then what each carries (ramps over streets over freeway
 *   carriageways and railways), then the one farther along its structure from where it lands.
 * - A deck falls away from that height no faster than its class allows, and where it reaches
 *   its end still raised, the roads joined to it there carry the rest of the descent, each at
 *   its own grade.
 *
 * `groundAt` takes tile-local meters and, for callers that level roads along their own direction,
 * the unit direction of the way at that point. Coordinates and profiles stay tile-normalized.
 */
export function gradeTransportSeparations(
  features: readonly TerrainTransportationFeature[],
  tileSize: number,
  groundAt: (x: number, z: number, dx: number, dz: number) => number,
  options: GradeSeparationOptions = {},
): readonly TerrainTransportationFeature[] {
  const steps = gradeTransportSeparationSteps(features, tileSize, groundAt, options);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/**
 * `gradeTransportSeparations` as resumable steps of a few milliseconds each: a host on the main
 * thread runs them until its time for the frame is up and carries on in the next. An interchange
 * with its neighbors is tens of thousands of stations, too long to hold a frame for.
 */
export function* gradeTransportSeparationSteps(
  features: readonly TerrainTransportationFeature[],
  tileSize: number,
  groundAt: (x: number, z: number, dx: number, dz: number) => number,
  options: GradeSeparationOptions = {},
): Generator<undefined, readonly TerrainTransportationFeature[], undefined> {
  const context = options.context ?? [];
  if (
    !features.some((f) => f.bridge && eligible(f)) &&
    !context.some((f) => f.bridge && eligible(f))
  )
    return features;
  const spacing = Math.max(1, options.spacing ?? 4);
  // A way far from every bridge neither crosses one nor climbs to one: leave it out. A tile
  // with one overpass among a thousand streets then costs little more than the overpass.
  const nearBridge = new Set<number>();
  const zone = (x: number, z: number): number =>
    (Math.floor(x / BRIDGE_ZONE) + 32768) * 65536 + Math.floor(z / BRIDGE_ZONE) + 32768;
  for (const list of [features, context])
    for (const feature of list) {
      if (!feature.bridge || !eligible(feature)) continue;
      for (const line of feature.lines)
        for (let i = 0; i + 1 < line.length; i++) {
          const a = line[i] as TerrainSemanticPoint,
            b = line[i + 1] as TerrainSemanticPoint;
          const lowX = Math.floor((Math.min(a[0], b[0]) * tileSize - BRIDGE_REACH) / BRIDGE_ZONE),
            highX = Math.floor((Math.max(a[0], b[0]) * tileSize + BRIDGE_REACH) / BRIDGE_ZONE),
            lowZ = Math.floor((Math.min(a[1], b[1]) * tileSize - BRIDGE_REACH) / BRIDGE_ZONE),
            highZ = Math.floor((Math.max(a[1], b[1]) * tileSize + BRIDGE_REACH) / BRIDGE_ZONE);
          for (let x = lowX; x <= highX; x++)
            for (let z = lowZ; z <= highZ; z++)
              nearBridge.add(zone(x * BRIDGE_ZONE, z * BRIDGE_ZONE));
        }
    }

  // --- Ways and their stations. ---
  const ways: Way[] = [];
  const xs: number[] = [],
    zs: number[] = [],
    along: number[] = [],
    tangentX: number[] = [],
    tangentZ: number[] = [],
    wayOf: number[] = [];
  const addWays = (feature: TerrainTransportationFeature, output: number): void => {
    if (!eligible(feature)) return;
    const kind = transportKind(feature);
    const family: TerrainGradeFamily = kind === 'rail' ? 'rail' : kind === 'path' ? 'path' : 'road';
    feature.lines.forEach((line, lineIndex) => {
      const points: TerrainSemanticPoint[] = [];
      for (const [u, v] of line) {
        const p: TerrainSemanticPoint = [u * tileSize, v * tileSize];
        const last = points.at(-1);
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1e-4) points.push(p);
      }
      if (points.length < 2) return;
      if (!feature.bridge && !points.some((p) => nearBridge.has(zone(p[0], p[1])))) return;
      const way: Way = {
        feature,
        output,
        line: lineIndex,
        bridge: feature.bridge === true,
        family,
        lift: kind === 'path' ? PATH_SURFACE_LIFT : ROAD_SURFACE_LIFT,
        grade: maxGrade(feature, kind),
        halfWidth: transportWidth(feature, kind) / 2,
        layer: feature.layer,
        standing:
          kind === 'path'
            ? 0
            : kind === 'rail' || (kind === 'motorway' && !isTransportLink(feature))
              ? 1
              : isTransportLink(feature)
                ? 3
                : 2,
        points,
        vertexNodes: [],
        first: xs.length,
        count: 0,
      };
      const index = ways.length;
      let distance = 0;
      const direction = (i: number): TerrainSemanticPoint => {
        const a = points[i] as TerrainSemanticPoint,
          b = points[i + 1] as TerrainSemanticPoint;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      };
      for (let i = 0; i + 1 < points.length; i++) {
        const a = points[i] as TerrainSemanticPoint,
          b = points[i + 1] as TerrainSemanticPoint;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const [dx, dz] = direction(i);
        const steps = Math.max(1, Math.ceil(length / spacing));
        for (let j = i === 0 ? 0 : 1; j <= steps; j++) {
          const t = j / steps;
          let tx = dx,
            tz = dz;
          // A vertex takes the bisector of the segments it joins.
          if (j === steps && i + 2 < points.length) {
            const [nx, nz] = direction(i + 1);
            const sum = Math.hypot(dx + nx, dz + nz);
            if (sum > 1e-6) {
              tx = (dx + nx) / sum;
              tz = (dz + nz) / sum;
            }
          }
          if (j === 0 || j === steps) way.vertexNodes.push(xs.length);
          xs.push(a[0] + (b[0] - a[0]) * t);
          zs.push(a[1] + (b[1] - a[1]) * t);
          along.push(distance + length * t);
          tangentX.push(tx);
          tangentZ.push(tz);
          wayOf.push(index);
        }
        distance += length;
      }
      way.count = xs.length - way.first;
      ways.push(way);
    });
  };
  for (let index = 0; index < features.length; index++) {
    addWays(features[index] as TerrainTransportationFeature, index);
    if ((index & 255) === 255) yield;
  }
  for (let index = 0; index < context.length; index++) {
    addWays(context[index] as TerrainTransportationFeature, -1);
    if ((index & 255) === 255) yield;
  }
  yield;
  const nodeCount = xs.length;
  const wayAt = (node: number): Way => ways[wayOf[node] as number] as Way;

  // --- Joins: ways meet where they share a vertex. ---
  const links: (number[] | undefined)[] = new Array(nodeCount);
  const link = (a: number, b: number): void => {
    if (a === b) return;
    let list = links[a];
    if (!list) {
      list = [];
      links[a] = list;
    }
    if (!list.includes(b)) list.push(b);
    list = links[b];
    if (!list) {
      list = [];
      links[b] = list;
    }
    if (!list.includes(a)) list.push(a);
  };
  const effectiveLayer = (way: Way): number =>
    way.bridge ? Math.max(1, way.layer ?? 1) : (way.layer ?? 0);
  const joins = (a: Way, aEnd: boolean, b: Way, bEnd: boolean): boolean => {
    if (a.bridge === b.bridge) return effectiveLayer(a) === effectiveLayer(b);
    // A deck meets the ground only at an end: its own, or that of a way that climbs to it. A
    // vertex inside both is a road passing beneath that a mapper tied to the bridge.
    return aEnd || bEnd;
  };
  const vertexKey = (node: number): number =>
    (Math.round((xs[node] as number) * 10) + 0x2000000) * 0x4000000 +
    Math.round((zs[node] as number) * 10) +
    0x2000000;
  const shared = new Map<number, number[]>();
  for (const way of ways)
    for (const node of way.vertexNodes) {
      const key = vertexKey(node);
      const list = shared.get(key);
      if (list) list.push(node);
      else shared.set(key, [node]);
    }
  const isEnd = (node: number): boolean => {
    const way = wayAt(node);
    return node === way.first || node === way.first + way.count - 1;
  };
  for (const list of shared.values())
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i] as number,
          b = list[j] as number;
        if (joins(wayAt(a), isEnd(a), wayAt(b), isEnd(b))) link(a, b);
      }
  yield;
  // Spatial index of every way's mapped segments, for loose ends and crossings.
  const cellSize = 24;
  type Segment = { way: number; index: number };
  const grid = new Map<number, Segment[]>();
  const cellKey = (x: number, z: number): number => (x + 0x100000) * 0x200000 + z + 0x100000;
  const segmentCells = (way: Way, index: number, visit: (key: number) => void, pad = 0): void => {
    const a = way.points[index] as TerrainSemanticPoint,
      b = way.points[index + 1] as TerrainSemanticPoint;
    const minX = Math.floor((Math.min(a[0], b[0]) - pad) / cellSize),
      maxX = Math.floor((Math.max(a[0], b[0]) + pad) / cellSize),
      minZ = Math.floor((Math.min(a[1], b[1]) - pad) / cellSize),
      maxZ = Math.floor((Math.max(a[1], b[1]) + pad) / cellSize);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) visit(cellKey(x, z));
  };
  ways.forEach((way, w) => {
    for (let index = 0; index + 1 < way.points.length; index++)
      segmentCells(way, index, (key) => {
        const list = grid.get(key);
        if (list) list.push({ way: w, index });
        else grid.set(key, [{ way: w, index }]);
      });
  });
  /** The node of `way` nearest arc distance `at`. */
  const nodeNear = (way: Way, at: number): number => {
    let low = way.first,
      high = way.first + way.count - 1;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if ((along[middle] as number) <= at) low = middle;
      else high = middle;
    }
    return at - (along[low] as number) <= (along[high] as number) - at ? low : high;
  };
  // An end that shares no vertex may still lie on another way: tile simplification drops the
  // vertex of a straight road where a side road meets it, and the two halves of a way cut at a
  // tile edge end a few decimeters apart. Join each loose end to the nearest way within reach,
  // one of its own kind before any other.
  const reach = Math.max(0.6, options.endTolerance ?? 0);
  ways.forEach((way, w) => {
    for (const node of [way.first, way.first + way.count - 1]) {
      if (links[node]) continue;
      const x = xs[node] as number,
        z = zs[node] as number;
      let best = -1,
        bestScore = Number.POSITIVE_INFINITY;
      const seen = new Set<Segment>();
      for (
        let cx = Math.floor((x - reach) / cellSize);
        cx <= Math.floor((x + reach) / cellSize);
        cx++
      )
        for (
          let cz = Math.floor((z - reach) / cellSize);
          cz <= Math.floor((z + reach) / cellSize);
          cz++
        )
          for (const segment of grid.get(cellKey(cx, cz)) ?? []) {
            if (segment.way === w || seen.has(segment)) continue;
            seen.add(segment);
            const other = ways[segment.way] as Way;
            const a = other.points[segment.index] as TerrainSemanticPoint,
              b = other.points[segment.index + 1] as TerrainSemanticPoint;
            const dx = b[0] - a[0],
              dz = b[1] - a[1];
            const length2 = dx * dx + dz * dz;
            const t = length2
              ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2))
              : 0;
            const distance = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
            if (distance > reach) continue;
            const target = nodeNear(
              other,
              (along[other.vertexNodes[segment.index] as number] as number) +
                t * Math.sqrt(length2),
            );
            // A deck's loose end lands on a road; a road's loose end never climbs onto a deck
            // it merely passes beneath.
            if (!joins(way, true, other, isEnd(target))) continue;
            if (!way.bridge && other.bridge && !isEnd(target)) continue;
            const score =
              distance +
              (other.family === way.family ? 0 : reach) +
              (other.bridge === way.bridge ? 0 : reach);
            if (score < bestScore) {
              bestScore = score;
              best = target;
            }
          }
      if (best >= 0) link(node, best);
    }
  });

  yield;
  // --- Heights: the ground, read only where something asks. ---
  const ground = new Float64Array(nodeCount).fill(Number.NaN);
  const groundOf = (node: number): number => {
    let value = ground[node] as number;
    if (Number.isNaN(value)) {
      value = groundAt(
        xs[node] as number,
        zs[node] as number,
        tangentX[node] as number,
        tangentZ[node] as number,
      );
      ground[node] = value;
    }
    return value;
  };
  /** Lowest surface a node may take: the ground road as mapped, or a deck's span. */
  const floor = new Float64Array(nodeCount).fill(Number.NaN);
  const floorOf = (node: number): number => {
    let value = floor[node] as number;
    if (Number.isNaN(value)) {
      value = groundOf(node) + wayAt(node).lift;
      floor[node] = value;
    }
    return value;
  };
  const height = new Float64Array(nodeCount).fill(Number.NaN);
  const heightOf = (node: number): number => {
    const value = height[node] as number;
    return Number.isNaN(value) ? floorOf(node) : value;
  };
  /** Each node's neighbors along its way and across joins, with the length between them. */
  const neighbors = (node: number, visit: (other: number, length: number) => void): void => {
    const way = wayAt(node);
    if (node > way.first) visit(node - 1, (along[node] as number) - (along[node - 1] as number));
    if (node < way.first + way.count - 1)
      visit(node + 1, (along[node + 1] as number) - (along[node] as number));
    for (const other of links[node] ?? []) visit(other, 0);
  };

  // --- Decks: spans between the roads at their ends. ---
  const depth = new Float64Array(nodeCount).fill(Number.POSITIVE_INFINITY);
  const component = new Int32Array(nodeCount).fill(-1);
  let components = 0;
  for (const seed of ways) {
    if (!seed.bridge || component[seed.first] !== -1) continue;
    const id = components++;
    if ((id & 7) === 7) yield;
    const members: number[] = [];
    const stack = [seed.first];
    component[seed.first] = id;
    while (stack.length) {
      const node = stack.pop() as number;
      members.push(node);
      neighbors(node, (other) => {
        if (component[other] !== -1 || !wayAt(other).bridge) return;
        component[other] = id;
        stack.push(other);
      });
    }
    // Points of the structure that matter to its shape: its ends and its joins. Joined points
    // are one point (`group`); those where it meets the ground, or where the map or the tile
    // stops short, have a known height.
    const group = new Map<number, number>();
    const find = (node: number): number => {
      let root = node;
      while (group.get(root) !== root) root = group.get(root) as number;
      group.set(node, root);
      return root;
    };
    const fixed = new Map<number, number>();
    const sources: { node: number; start: number }[] = [];
    for (const node of members) {
      const joined = links[node];
      if (!joined && !isEnd(node)) continue;
      if (!group.has(node)) group.set(node, node);
      for (const other of joined ?? []) {
        if (!wayAt(other).bridge) continue;
        if (!group.has(other)) group.set(other, other);
        group.set(find(node), find(other));
      }
    }
    for (const node of group.keys()) {
      let landing = Number.NEGATIVE_INFINITY;
      for (const other of links[node] ?? [])
        if (!wayAt(other).bridge) landing = Math.max(landing, floorOf(other));
      const free = landing === Number.NEGATIVE_INFINITY && !links[node];
      if (free) landing = groundOf(node) + FREE_CLEARANCE[wayAt(node).family];
      if (landing === Number.NEGATIVE_INFINITY) continue;
      const root = find(node);
      fixed.set(root, Math.max(fixed.get(root) ?? Number.NEGATIVE_INFINITY, landing));
      sources.push({ node, start: free ? FREE_END_DEPTH : 0 });
    }
    // How far along the structure each point is from the ground.
    const heap = new Heap();
    for (const { node, start } of sources) {
      if (start >= (depth[node] as number)) continue;
      depth[node] = start;
      heap.push(node, -start);
    }
    while (heap.size) {
      const [node, key] = heap.pop();
      if (-key > (depth[node] as number)) continue;
      neighbors(node, (other, length) => {
        if (component[other] !== id) return;
        const next = -key + length;
        if (next >= (depth[other] as number)) return;
        depth[other] = next;
        heap.push(other, -next);
      });
    }
    // Between its known heights the structure runs straight: along one span the chord between
    // its banks, and through a junction of spans the height that leaves every span straight
    // (each junction the average of its neighbors, weighted by how near they are).
    const spans: { from: number; to: number; a: number; b: number; length: number }[] = [];
    const structure = new Set<number>();
    for (const node of members) structure.add(wayOf[node] as number);
    for (const w of structure) {
      const way = ways[w] as Way;
      let previous = -1;
      for (let node = way.first; node < way.first + way.count; node++) {
        if (!group.has(node)) continue;
        if (previous >= 0)
          spans.push({
            from: previous,
            to: node,
            a: find(previous),
            b: find(node),
            length: Math.max(1e-3, (along[node] as number) - (along[previous] as number)),
          });
        previous = node;
      }
    }
    const level = new Map<number, number>(fixed);
    if (fixed.size > 0) {
      let mean = 0;
      for (const value of fixed.values()) mean += value / fixed.size;
      const free = [...new Set([...group.keys()].map(find))].filter((root) => !fixed.has(root));
      for (const root of free) level.set(root, mean);
      for (let pass = 0; pass < 200 && free.length > 0; pass++) {
        let moved = 0;
        for (const root of free) {
          let total = 0,
            weight = 0;
          for (const span of spans) {
            if (span.a === span.b || (span.a !== root && span.b !== root)) continue;
            const other = span.a === root ? span.b : span.a;
            total += (level.get(other) as number) / span.length;
            weight += 1 / span.length;
          }
          if (weight === 0) continue;
          const next = total / weight;
          moved = Math.max(moved, Math.abs(next - (level.get(root) as number)));
          level.set(root, next);
        }
        if (moved < 1e-3) break;
      }
    }
    const chord = new Map<number, number>();
    for (const span of spans) {
      const from = level.get(span.a),
        to = level.get(span.b);
      if (from === undefined || to === undefined) continue;
      for (let node = span.from; node <= span.to; node++)
        chord.set(
          node,
          from +
            ((to - from) * ((along[node] as number) - (along[span.from] as number))) / span.length,
        );
    }
    for (const node of members) {
      const way = wayAt(node);
      const clearance = FREE_CLEARANCE[way.family];
      const below = groundOf(node);
      const reach = depth[node] as number;
      const hump = Math.min(
        clearance,
        way.lift + way.grade * (Number.isFinite(reach) ? reach : FREE_END_DEPTH),
      );
      floor[node] = Math.max(chord.get(node) ?? below + clearance, below + hump);
    }
  }

  yield;
  // --- Crossings: where one way passes over another without meeting it. ---
  interface Meeting {
    a: number;
    aAt: number;
    /** East-west share of the way's direction at the crossing. */
    ax: number;
    b: number;
    bAt: number;
    bx: number;
    sine: number;
  }
  const meetings: Meeting[] = [];
  // Each pair of segments is looked at once, however many cells they share.
  const seen = new Set<number>();
  const segmentBase: number[] = [];
  let segmentCount = 0;
  for (const way of ways) {
    segmentBase.push(segmentCount);
    segmentCount += way.points.length - 1;
  }
  /** Whether `way` near arc distance `at` is joined to way `other` near its `otherAt`. */
  const joinedNear = (way: Way, at: number, other: number, otherAt: number): boolean => {
    const center = nodeNear(way, at);
    for (const step of [-1, 1])
      for (
        let node = step < 0 ? center : center + 1;
        node >= way.first &&
        node < way.first + way.count &&
        Math.abs((along[node] as number) - at) <= JUNCTION_REACH;
        node += step
      )
        for (const target of links[node] ?? [])
          if (
            wayOf[target] === other &&
            Math.abs((along[target] as number) - otherAt) <= JUNCTION_REACH
          )
            return true;
    return false;
  };
  for (let w = 0, visited = 0; w < ways.length; w++) {
    const way = ways[w] as Way;
    if (!way.bridge) continue;
    if ((++visited & 15) === 0) yield;
    for (let index = 0; index + 1 < way.points.length; index++) {
      const a = way.points[index] as TerrainSemanticPoint,
        b = way.points[index + 1] as TerrainSemanticPoint;
      const rx = b[0] - a[0],
        rz = b[1] - a[1];
      const length = Math.hypot(rx, rz);
      const own = (segmentBase[w] as number) + index;
      segmentCells(way, index, (key) => {
        for (const candidate of grid.get(key) ?? []) {
          const other = ways[candidate.way] as Way;
          // Two decks meet once, whichever is visited first.
          if (other.bridge && candidate.way < w) continue;
          if (candidate.way === w && candidate.index <= index + 1) continue;
          const id = own * segmentCount + (segmentBase[candidate.way] as number) + candidate.index;
          if (seen.has(id)) continue;
          seen.add(id);
          const c = other.points[candidate.index] as TerrainSemanticPoint,
            d = other.points[candidate.index + 1] as TerrainSemanticPoint;
          const sx = d[0] - c[0],
            sz = d[1] - c[1];
          const cross = rx * sz - rz * sx;
          const otherLength = Math.hypot(sx, sz);
          const sine = Math.abs(cross) / (length * otherLength || 1);
          if (sine < 0.05) continue;
          const t = ((c[0] - a[0]) * sz - (c[1] - a[1]) * sx) / cross,
            u = ((c[0] - a[0]) * rz - (c[1] - a[1]) * rx) / cross;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          // Meeting at a vertex of both is a junction, or a mapper's tie, never a flyover.
          const nearEnd = (fraction: number, span: number): boolean =>
            Math.min(fraction, 1 - fraction) * span < 0.75;
          if (nearEnd(t, length) && nearEnd(u, otherLength)) continue;
          const aAt = (along[way.vertexNodes[index] as number] as number) + t * length,
            bAt = (along[other.vertexNodes[candidate.index] as number] as number) + u * otherLength;
          // A way looping over itself crosses there; a kink in it does not.
          if (candidate.way === w && Math.abs(aAt - bAt) < 30) continue;
          // Nor do two ways joined right there: a ramp's last segment often overshoots the
          // centerline of the road it merges into.
          if (joinedNear(way, aAt, candidate.way, bAt)) continue;
          meetings.push({
            a: w,
            aAt,
            ax: rx / (length || 1),
            b: candidate.way,
            bAt,
            bx: sx / (otherLength || 1),
            sine,
          });
        }
      });
    }
  }
  yield;
  const pairKey = (a: number, b: number): string => `${a}/${b}`;
  const crossings: Crossing[] = [];
  /** The crossings each node lies beneath, to look at again when it rises. */
  const above = new Map<number, Crossing[]>();
  const cross = (meeting: Meeting, over: boolean): Crossing => {
    const upper = over ? meeting.a : meeting.b,
      lower = over ? meeting.b : meeting.a;
    const upperAt = over ? meeting.aAt : meeting.bAt,
      lowerAt = over ? meeting.bAt : meeting.aAt;
    const beneath = ways[lower] as Way;
    const skew = Math.max(0.25, meeting.sine);
    const crossing: Crossing = {
      upper,
      at: upperAt,
      lower,
      beneath: lowerAt,
      lowerNode: nodeNear(beneath, lowerAt),
      separation: TERRAIN_GRADE_SEPARATION[beneath.family],
      hold: Math.min(40, (beneath.halfWidth + 1.5) / skew),
      under: Math.min(40, ((ways[upper] as Way).halfWidth + 1.5) / skew),
      queued: false,
    };
    crossings.push(crossing);
    const list = above.get(crossing.lowerNode);
    if (list) list.push(crossing);
    else above.set(crossing.lowerNode, [crossing]);
    return crossing;
  };
  // Decks side by side (twin carriageways, a footway along a road bridge) stand level with each
  // other: they read as one structure, and crossing different things must not split them.
  const deckCells = new Map<string, number[]>();
  const deckCell = 12;
  for (const way of ways) {
    if (!way.bridge) continue;
    for (let node = way.first; node < way.first + way.count; node++) {
      const key = `${Math.floor((xs[node] as number) / deckCell)}/${Math.floor((zs[node] as number) / deckCell)}`;
      const list = deckCells.get(key);
      if (list) list.push(node);
      else deckCells.set(key, [node]);
    }
  }
  const stacked = new Set<string>();
  for (const meeting of meetings) {
    stacked.add(pairKey(meeting.a, meeting.b));
    stacked.add(pairKey(meeting.b, meeting.a));
  }
  const beside: (number[] | undefined)[] = new Array(nodeCount);
  for (const way of ways) {
    if (!way.bridge) continue;
    for (let node = way.first; node < way.first + way.count; node++) {
      const x = xs[node] as number,
        z = zs[node] as number;
      const cx = Math.floor(x / deckCell),
        cz = Math.floor(z / deckCell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (const other of deckCells.get(`${cx + dx}/${cz + dz}`) ?? []) {
            if (other <= node) continue;
            const peer = wayAt(other);
            if (peer === way || effectiveLayer(peer) !== effectiveLayer(way)) continue;
            // Two decks that cross are stacked, however nearly parallel they run there.
            if (stacked.has(pairKey(wayOf[node] as number, wayOf[other] as number))) continue;
            const ox = (xs[other] as number) - x,
              oz = (zs[other] as number) - z;
            const distance = Math.hypot(ox, oz);
            const gap = distance - way.halfWidth - peer.halfWidth;
            if (gap < -1 || gap > 4) continue;
            const tx = tangentX[node] as number,
              tz = tangentZ[node] as number;
            // Abreast: parallel, and across from each other rather than ahead.
            if (
              Math.abs(tx * (tangentX[other] as number) + tz * (tangentZ[other] as number)) < 0.94
            )
              continue;
            if (Math.abs(ox * tx + oz * tz) > 0.35 * distance + 1) continue;
            for (const [from, to] of [
              [node, other],
              [other, node],
            ] as const) {
              const list = beside[from];
              if (list) list.push(to);
              else beside[from] = [to];
            }
          }
    }
  }

  // A footway carried on a road's deck (its sidewalk, mapped on its own) stands where the road
  // does, not where a footbridge would.
  for (const way of ways) {
    if (!way.bridge || way.family !== 'path') continue;
    let carried = 0,
      standing = 0;
    for (let node = way.first; node < way.first + way.count; node++) {
      let best = -1;
      for (const other of beside[node] ?? [])
        if (wayAt(other).family !== 'path') best = Math.max(best, wayAt(other).standing);
      if (best < 0) continue;
      carried++;
      standing = Math.max(standing, best);
    }
    if (carried * 2.5 >= way.count) way.standing = standing;
  }
  // Which of two decks is on top where they cross. Nothing but the two structures near the
  // crossing decides it, so every tile that sees the crossing decides alike: the mapped layer;
  // else the deck whose span already stands well above the other's; else what the decks carry
  // (ramps fly over streets, streets over freeway carriageways and railways); else the one
  // farther from where it lands, which has had the length to climb; else the one running more
  // nearly north and south.
  const over = (meeting: Meeting): boolean => {
    const a = ways[meeting.a] as Way,
      b = ways[meeting.b] as Way;
    const na = nodeNear(a, meeting.aAt),
      nb = nodeNear(b, meeting.bAt);
    const reach = (node: number): number => Math.min(LOCAL_DEPTH, depth[node] as number);
    if (meeting.a === meeting.b) return (depth[na] as number) >= (depth[nb] as number);
    if (effectiveLayer(a) !== effectiveLayer(b)) return effectiveLayer(a) > effectiveLayer(b);
    // The ground has a say: a bridge between two hilltops is over a ramp in the valley,
    // whatever each carries.
    const higher = floorOf(na) - floorOf(nb);
    if (Math.abs(higher) > SPAN_MARGIN) return higher > 0;
    if (a.standing !== b.standing) return a.standing > b.standing;
    if (Math.abs(reach(na) - reach(nb)) > 12) return reach(na) > reach(nb);
    return Math.abs(meeting.ax) <= Math.abs(meeting.bx);
  };
  for (const meeting of meetings) cross(meeting, !(ways[meeting.b] as Way).bridge || over(meeting));

  yield;
  // --- Decks: each clears what it crosses, and falls away no faster than its class. ---
  const queue: number[] = [];
  const queued = new Uint8Array(nodeCount);
  const waiting: Crossing[] = [];
  const recheck = (crossing: Crossing): void => {
    if (crossing.queued) return;
    crossing.queued = true;
    waiting.push(crossing);
  };
  /** Deck heights before decks side by side are leveled with each other. */
  let alone: Float64Array | undefined;
  const raise = (node: number, value: number): boolean => {
    const next = Math.min(value, floorOf(node) + MAX_RISE);
    if (next <= heightOf(node) + 1e-3) return false;
    height[node] = next;
    if (!queued[node]) {
      queued[node] = 1;
      queue.push(node);
    }
    for (const crossing of above.get(node) ?? []) recheck(crossing);
    return true;
  };
  const settle = (): void => {
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head] as number;
      queued[node] = 0;
      const way = wayAt(node);
      const value = heightOf(node);
      neighbors(node, (other, length) => {
        if (!wayAt(other).bridge) return;
        raise(other, length === 0 ? value : value - way.grade * length);
      });
      // Level with the deck beside it, but only so far above where it stood alone: twins
      // differ by decimeters, while a ramp's switchback legs run side by side a story apart.
      if (alone)
        for (const other of beside[node] ?? [])
          raise(other, Math.min(value, (alone[other] as number) + BESIDE_ALLOWANCE));
    }
    queue.length = 0;
  };
  // Vertical curves round every break in grade over about this far, so a crossing is held that
  // much wider than the way beneath it.
  const rounding = spacing * 2;
  /**
   * Visit the nodes of `way` within `half` of `at`, and the first beyond each end of that
   * stretch with how far beyond it lies: a stretch is a length of road, not a set of stations,
   * and two tiles that station the same road differently must hold the same length of it.
   */
  const held = (
    way: Way,
    at: number,
    half: number,
    visit: (node: number, beyond: number) => void,
  ): void => {
    const center = nodeNear(way, at);
    for (let node = center; node >= way.first; node--) {
      const beyond = Math.max(0, at - (along[node] as number) - half);
      visit(node, beyond);
      if (beyond > 0) break;
    }
    for (let node = center + 1; node < way.first + way.count; node++) {
      const beyond = Math.max(0, (along[node] as number) - at - half);
      visit(node, beyond);
      if (beyond > 0) break;
    }
  };
  // Work through the crossings whose lower way has moved, each raising its upper way and that
  // in turn whatever crosses over it. Bounded, in case two decks are each mapped over the other.
  const clear = (): void => {
    settle();
    for (let budget = crossings.length * 24 + 64; waiting.length > 0 && budget > 0; budget--) {
      const crossing = waiting.pop() as Crossing;
      crossing.queued = false;
      const need = heightOf(crossing.lowerNode) + crossing.separation;
      const upper = ways[crossing.upper] as Way;
      held(upper, crossing.at, crossing.hold + rounding, (node, beyond) => {
        raise(node, need - upper.grade * beyond);
      });
      settle();
    }
    for (const crossing of waiting) crossing.queued = false;
    waiting.length = 0;
  };
  const bridgeNodes: number[] = [];
  for (const way of ways)
    if (way.bridge)
      for (let node = way.first; node < way.first + way.count; node++) bridgeNodes.push(node);
  const placeDecks = (): void => {
    for (const node of bridgeNodes)
      if (!queued[node]) {
        queued[node] = 1;
        queue.push(node);
      }
    for (const crossing of crossings) recheck(crossing);
    clear();
    if (alone !== undefined || !beside.some((list) => list !== undefined)) return;
    alone = new Float64Array(nodeCount);
    for (const node of bridgeNodes) alone[node] = heightOf(node);
    for (const node of bridgeNodes)
      if (beside[node] && !queued[node]) {
        queued[node] = 1;
        queue.push(node);
      }
    clear();
  };

  // --- Approaches: the roads at a raised deck's ends carry the rest of the descent. ---
  // Lift passes down the ranks only: a road rises to stay with a railway it crosses on the
  // level and a footpath with the road it crosses, never the other way round, so a footbridge's
  // steps come down to the street rather than lifting the street to the footbridge.
  const rank = (way: Way): number => (way.family === 'rail' ? 0 : way.family === 'road' ? 1 : 2);
  /** Grade (m/m) at which a lift may fall to a point that holds it down: a ramp, or stairs. */
  const steep = (way: Way): number => (way.family === 'path' ? 0.5 : 0.25);
  const lift = new Float64Array(nodeCount);
  /** The structure (deck component) each node's lift climbs to. */
  const origin = new Int32Array(nodeCount).fill(-1);
  /** Held to its lift: at a deck's end, or where it meets a way that outranks it. */
  const fixed = new Uint8Array(nodeCount);
  // A road climbing to a structure lies on the ground wherever that same structure passes over
  // it: an approach must never lift the thing its own bridge has to clear, or the two would
  // chase each other upward. Under any other structure it may stay raised, and is cleared so.
  const under = new Map<number, { structure: number; from: number; to: number }[]>();
  for (const crossing of crossings) {
    if ((ways[crossing.lower] as Way).bridge) continue;
    const spans = under.get(crossing.lower) ?? [];
    spans.push({
      structure: component[(ways[crossing.upper] as Way).first] as number,
      from: crossing.beneath - crossing.under,
      to: crossing.beneath + crossing.under,
    });
    under.set(crossing.lower, spans);
  }
  /** Meters along its way from `node` to where `structure` passes over that way (0 beneath it). */
  const clearOf = (node: number, structure: number): number => {
    let nearest = Number.POSITIVE_INFINITY;
    const at = along[node] as number;
    for (const span of under.get(wayOf[node] as number) ?? [])
      if (span.structure === structure)
        nearest = Math.min(nearest, Math.max(0, span.from - at, at - span.to));
    return nearest;
  };
  /** Whether any structure passes over `node`. */
  const beneathDeck = (node: number): boolean => {
    const at = along[node] as number;
    return (under.get(wayOf[node] as number) ?? []).some(
      (span) => at >= span.from && at <= span.to,
    );
  };
  /** Where each node being rounded sits in the list, else -1. */
  const slot = new Int32Array(nodeCount).fill(-1);
  // A road is many ways end to end (its tags change, a tile cuts it): the curve runs on through
  // each join, or every join would be a kink.
  const onward = new Int32Array(nodeCount).fill(-2);
  /** The node one station past `node` in the way that carries on from its end, else -1. */
  const onwardOf = (node: number): number => {
    let known = onward[node] as number;
    if (known !== -2) return known;
    known = -1;
    const way = wayAt(node);
    if (isEnd(node)) {
      let ends = 0;
      for (const other of links[node] ?? []) {
        const peer = wayAt(other);
        if (peer === way || peer.bridge !== way.bridge || peer.family !== way.family) continue;
        if (!isEnd(other) || peer.count < 2) continue;
        ends++;
        known = other === peer.first ? other + 1 : other - 1;
      }
      // Three ways meeting are a junction, not one road carrying on.
      if (ends !== 1) known = -1;
    }
    onward[node] = known;
    return known;
  };
  /** Round `nodes` over a few stations (a vertical curve at each break in grade). */
  const round = (
    nodes: readonly number[],
    pinned: (node: number) => boolean,
    read: (node: number) => number,
    write: (node: number, value: number) => void,
  ): void => {
    if (nodes.length === 0) return;
    nodes.forEach((node, i) => {
      slot[node] = i;
    });
    let values = Float64Array.from(nodes, read);
    for (let pass = 0; pass < 3; pass++) {
      const next = values.slice();
      nodes.forEach((node, i) => {
        if (pinned(node)) return;
        const way = wayAt(node);
        let total = 2 * (values[i] as number),
          count = 2;
        for (const other of [node - 1, node + 1, onwardOf(node)]) {
          if (other < 0) continue;
          if (other !== onward[node] && (other < way.first || other >= way.first + way.count))
            continue;
          const j = slot[other] as number;
          total += j < 0 ? read(other) : (values[j] as number);
          count++;
        }
        next[i] = total / count;
      });
      values = next;
    }
    nodes.forEach((node, i) => {
      slot[node] = -1;
      write(node, values[i] as number);
    });
  };
  let climbed: number[] = [];
  const touched = new Uint8Array(nodeCount);
  const touch = (node: number): void => {
    if (touched[node]) return;
    touched[node] = 1;
    climbed.push(node);
  };
  // The ground nodes joined to something, by rank: only they can be held to a lift.
  const joined: number[][] = [[], [], []];
  const pathCells = new Map<number, number[]>();
  const roadCell = 16;
  const roadCellKey = (x: number, z: number): number =>
    (Math.floor(x / roadCell) + 0x100000) * 0x200000 + Math.floor(z / roadCell) + 0x100000;
  for (const way of ways) {
    if (way.bridge) continue;
    const tier = rank(way);
    for (let node = way.first; node < way.first + way.count; node++) {
      if (links[node]) (joined[tier] as number[]).push(node);
      if (tier !== 2) continue;
      const key = roadCellKey(xs[node] as number, zs[node] as number);
      const list = pathCells.get(key);
      if (list) list.push(node);
      else pathCells.set(key, [node]);
    }
  }
  const placeApproaches = (final: boolean): void => {
    for (const node of climbed) {
      touched[node] = 0;
      height[node] = Number.NaN;
      lift[node] = 0;
      origin[node] = -1;
      fixed[node] = 0;
    }
    climbed = [];
    // Lifted roads, for the footpaths beside them: a sidewalk shares no vertex with the street
    // it follows, and would otherwise stay in the ditch while the street climbed.
    const roadCells = new Map<number, number[]>();
    for (let tier = 0; tier < 3; tier++) {
      // Where this rank is held: at a deck's end to the deck, and where it meets a way that
      // outranks it to that way's lift (the ground, if that way does not climb).
      const sources: number[] = [];
      for (const node of joined[tier] as number[]) {
        let value = Number.NEGATIVE_INFINITY,
          from = -1;
        for (const other of links[node] as number[]) {
          const peer = wayAt(other);
          const candidate = peer.bridge
            ? heightOf(other) - floorOf(node)
            : rank(peer) < tier
              ? (lift[other] as number)
              : Number.NEGATIVE_INFINITY;
          if (candidate > value) {
            value = candidate;
            from = peer.bridge ? (component[other] as number) : (origin[other] as number);
          }
        }
        if (value === Number.NEGATIVE_INFINITY) continue;
        fixed[node] = 1;
        lift[node] = Math.max(0, value);
        origin[node] = from;
        touch(node);
        if ((lift[node] as number) > LIFT_EPSILON) sources.push(node);
      }
      // How high a lift may stand on each node of a way: no more than a steep ramp above the
      // nearest point of that way that is held to a lower lift of its own.
      const ramp = (way: Way): Float64Array | null => {
        const held = (node: number): number | undefined =>
          fixed[node] ? (lift[node] as number) : undefined;
        let any = false;
        for (let n = way.first; n < way.first + way.count && !any; n++) any = held(n) !== undefined;
        if (!any) return null;
        const cap = new Float64Array(way.count);
        const slope = steep(way);
        let bound = Number.POSITIVE_INFINITY;
        for (let n = way.first; n < way.first + way.count; n++) {
          if (n > way.first) bound += slope * ((along[n] as number) - (along[n - 1] as number));
          bound = Math.min(bound, held(n) ?? Number.POSITIVE_INFINITY);
          cap[n - way.first] = bound;
        }
        bound = Number.POSITIVE_INFINITY;
        for (let n = way.first + way.count - 1; n >= way.first; n--) {
          if (n < way.first + way.count - 1)
            bound += slope * ((along[n + 1] as number) - (along[n] as number));
          bound = Math.min(bound, held(n) ?? Number.POSITIVE_INFINITY);
          cap[n - way.first] = Math.min(cap[n - way.first] as number, bound);
        }
        return cap;
      };
      const pinnedCaps = new Map<number, Float64Array | null>();
      const capOf = (node: number, structure: number): number => {
        const w = wayOf[node] as number;
        const way = ways[w] as Way;
        let pinned = pinnedCaps.get(w);
        if (pinned === undefined) {
          pinned = ramp(way);
          pinnedCaps.set(w, pinned);
        }
        // A lift climbing to `structure` also falls to the ground wherever that structure
        // passes over the way.
        return Math.min(
          pinned ? (pinned[node - way.first] as number) : Number.POSITIVE_INFINITY,
          steep(way) * clearOf(node, structure),
        );
      };
      if (tier === 2 && roadCells.size > 0) {
        // Footpaths beside a lifted road, within a sidewalk's reach of its edge and running
        // with it, ride on its embankment (as far as the points holding them down allow).
        const candidates = new Set<number>();
        for (const key of roadCells.keys())
          for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++)
              for (const node of pathCells.get(key + dx * 0x200000 + dz) ?? [])
                candidates.add(node);
        for (const node of candidates) {
          if (fixed[node] !== 0) continue;
          const x = xs[node] as number,
            z = zs[node] as number;
          let nearest = Number.POSITIVE_INFINITY,
            value = 0,
            from = -1;
          for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++)
              for (const other of roadCells.get(roadCellKey(x, z) + dx * 0x200000 + dz) ?? []) {
                const peer = wayAt(other);
                const ox = (xs[other] as number) - x,
                  oz = (zs[other] as number) - z;
                const distance = Math.hypot(ox, oz);
                if (distance >= nearest || distance > peer.halfWidth + 6) continue;
                const tx = tangentX[node] as number,
                  tz = tangentZ[node] as number;
                if (
                  Math.abs(tx * (tangentX[other] as number) + tz * (tangentZ[other] as number)) <
                  0.9
                )
                  continue;
                if (Math.abs(ox * tx + oz * tz) > 0.5 * distance + 2) continue;
                nearest = distance;
                value = lift[other] as number;
                from = origin[other] as number;
              }
          value = Math.min(value, capOf(node, from));
          if (value <= Math.max(LIFT_EPSILON, lift[node] as number)) continue;
          lift[node] = value;
          origin[node] = from;
          touch(node);
          sources.push(node);
        }
      }
      const spread: number[] = [...sources];
      for (let head = 0; head < spread.length; head++) {
        const node = spread[head] as number;
        const way = wayAt(node);
        const value = lift[node] as number,
          structure = origin[node] as number;
        neighbors(node, (other, length) => {
          const peer = wayAt(other);
          if (peer.bridge || rank(peer) !== tier || fixed[other] !== 0) return;
          const next = Math.min(
            length === 0 ? value : value - way.grade * length,
            capOf(other, structure),
            MAX_RISE,
          );
          if (next <= (lift[other] as number) + 1e-3 || next <= LIFT_EPSILON) return;
          touch(other);
          lift[other] = next;
          origin[other] = structure;
          spread.push(other);
        });
      }
      const climbing: number[] = [];
      for (const node of climbed)
        if ((lift[node] as number) > LIFT_EPSILON && rank(wayAt(node)) === tier)
          climbing.push(node);
      if (final && climbing.length) {
        // Round the breaks in grade, holding every held point, then let joined roads agree.
        const rounded = new Set<number>(climbing);
        for (const node of climbing) {
          const way = wayAt(node);
          for (const other of [node - 1, node + 1])
            if (other >= way.first && other < way.first + way.count && !rounded.has(other)) {
              rounded.add(other);
              touch(other);
            }
        }
        round(
          [...rounded],
          (node) => fixed[node] !== 0 || (lift[node] === 0 && beneathDeck(node)),
          (node) => lift[node] as number,
          (node, value) => {
            lift[node] = value;
          },
        );
        for (let pass = 0; pass < 2; pass++)
          for (const node of rounded)
            for (const other of links[node] ?? []) {
              const peer = wayAt(other);
              if (peer.bridge || rank(peer) !== tier || fixed[other] !== 0) continue;
              if ((lift[node] as number) > (lift[other] as number) + 1e-6) {
                touch(other);
                lift[other] = lift[node] as number;
                rounded.add(other);
              }
            }
        for (const node of rounded) if ((lift[node] as number) > LIFT_EPSILON) climbing.push(node);
      }
      for (const node of climbing) {
        height[node] = floorOf(node) + (lift[node] as number);
        if (tier !== 1) continue;
        const key = roadCellKey(xs[node] as number, zs[node] as number);
        const list = roadCells.get(key);
        if (list) list.push(node);
        else roadCells.set(key, [node]);
      }
    }
  };

  // A road raised toward one structure and crossed by another lifts what the second must clear,
  // so decks and approaches are placed in turn until they agree (heights only ever rise).
  for (let turn = 0; turn < 4; turn++) {
    yield;
    placeDecks();
    yield;
    const before = crossings.map((crossing) => heightOf(crossing.lowerNode));
    placeApproaches(false);
    if (
      crossings.every((crossing, i) => heightOf(crossing.lowerNode) <= (before[i] as number) + 0.05)
    )
      break;
  }
  // Vertical curves on the decks: round their heights, holding each where it lands on a road.
  // A cut end holds its height too: the tile beside this one assumes the same of its half.
  const lands = (node: number): boolean =>
    links[node] === undefined
      ? isEnd(node)
      : (links[node] as number[]).some((other) => !wayAt(other).bridge);
  round(bridgeNodes, lands, heightOf, (node, value) => {
    // Never into the ground it spans.
    height[node] = Math.max(value, groundOf(node) + wayAt(node).lift);
  });
  yield;
  placeApproaches(true);
  yield;
  // Make good what rounding took from a crossing, then let joined decks agree: the higher holds.
  for (const crossing of crossings) {
    const need = heightOf(crossing.lowerNode) + crossing.separation;
    const upper = ways[crossing.upper] as Way;
    held(upper, crossing.at, crossing.hold, (node, beyond) => {
      const least = need - upper.grade * beyond;
      if (heightOf(node) < least) height[node] = Math.min(least, floorOf(node) + MAX_RISE);
    });
  }
  for (let pass = 0; pass < 2; pass++)
    for (const node of bridgeNodes)
      for (const other of links[node] ?? [])
        if (wayAt(other).bridge && heightOf(node) > heightOf(other) + 1e-6)
          height[other] = heightOf(node);

  // --- Profiles for the decks and for every road that climbs. ---
  const profiled = new Map<number, Map<number, Way>>();
  for (const way of ways) {
    if (way.output < 0) continue;
    let wanted = way.bridge;
    for (let node = way.first; !wanted && node < way.first + way.count; node++)
      wanted = (lift[node] as number) > LIFT_EPSILON;
    if (!wanted) continue;
    const lines = profiled.get(way.output) ?? new Map<number, Way>();
    lines.set(way.line, way);
    profiled.set(way.output, lines);
  }
  if (profiled.size === 0) return features;
  const sampleOf = (node: number): TerrainBridgeProfileSample => {
    const way = wayAt(node);
    const elevation = heightOf(node);
    // A deck follows the ground drawn under its landing, and less of it the farther along.
    const reach = Math.min(1, (depth[node] as number) / ANCHOR_REACH);
    return {
      point: [(xs[node] as number) / tileSize, (zs[node] as number) / tileSize],
      elevation,
      flatness: way.bridge ? 1 : Math.max(0, Math.min(1, (elevation - floorOf(node)) / FLAT_LIFT)),
      ...(options.anchored
        ? { ground: groundOf(node), anchor: way.bridge ? 1 - reach * reach * (3 - 2 * reach) : 1 }
        : {}),
    };
  };
  /**
   * The nodes of the context way that carries `way` on past its end `end` (the other half of a
   * way cut at a tile edge), nearest first, out to `options.extend` meters.
   */
  const carriedOn = (way: Way, end: number): number[] => {
    const reach = options.extend ?? 0;
    if (reach <= 0) return [];
    for (const other of links[end] ?? []) {
      const peer = wayAt(other);
      if (peer.output >= 0 || peer.bridge !== way.bridge || peer.family !== way.family) continue;
      if (!isEnd(other)) continue;
      const step = other === peer.first ? 1 : -1;
      const nodes: number[] = [];
      for (
        let node = other + step;
        node >= peer.first &&
        node < peer.first + peer.count &&
        Math.abs((along[node] as number) - (along[other] as number)) <= reach;
        node += step
      )
        nodes.push(node);
      return nodes;
    }
    return [];
  };
  return features.flatMap((feature, index) => {
    const lines = profiled.get(index);
    if (!lines) return [feature];
    return feature.lines.map((line, lineIndex) => {
      const way = lines.get(lineIndex);
      if (!way) return { ...feature, lines: [line] };
      const last = way.first + way.count - 1;
      const nodes = carriedOn(way, way.first).reverse();
      for (let node = way.first; node <= last; node++) nodes.push(node);
      for (const node of carriedOn(way, last)) nodes.push(node);
      return { ...feature, lines: [line], bridgeApproachProfile: nodes.map(sampleOf) };
    });
  });
}
