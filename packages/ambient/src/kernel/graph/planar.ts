/**
 * Planar split: turn overlapping drafts into a node/edge graph. Drafts of one class are cut where
 * they share a vertex (any grade: a shared map vertex is a real connection), where they cross at
 * the same grade (same layer, neither on a bridge nor in a tunnel), and where one ends on
 * another (T-junctions). Nearby split points snap into one node. Work is bounded per tile.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { EdgeDraft, Point2 } from './drafts';

export interface PlanarNode {
  x: number;
  z: number;
  layer: number;
  class: EdgeDraft['class'];
}

export interface PlanarPiece {
  draft: number;
  from: number;
  to: number;
  points: Point2[];
  /** Absolute heights per point when the draft supplied them. */
  heights?: number[];
}

export interface PlanarResult {
  nodes: PlanarNode[];
  pieces: PlanarPiece[];
  /** True when the comparison budget ran out and some crossings were not detected. */
  degraded: boolean;
}

export interface PlanarOptions {
  /** Points closer than this merge into one node (metres). */
  snap?: number;
  maxSegments?: number;
  maxComparisons?: number;
}

interface Segment {
  draft: number;
  index: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  length: number;
  start: number;
}

const CELL = 32;
/** Numeric cell key: unique while |cell z| < 2^26 (any Web Mercator coordinate at 0.6 m cells). */
const KEY_SPAN = 134_217_728;
function cellKey(x: number, z: number): number {
  return x * KEY_SPAN + z;
}
const CLASS_INDEX: Readonly<Record<EdgeDraft['class'], number>> = {
  road: 0,
  rail: 1,
  walk: 2,
  air: 3,
};

/** Cumulative distances of a polyline. */
export function cumulative(points: readonly Point2[]): number[] {
  const out = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point2;
    const b = points[i] as Point2;
    total += dmath.hypot(b[0] - a[0], b[1] - a[1]);
    out.push(total);
  }
  return out;
}

function sameGrade(a: EdgeDraft, b: EdgeDraft): boolean {
  return a.layer === b.layer && !a.bridge && !b.bridge && !a.tunnel && !b.tunnel;
}

/** Split drafts into pieces between nodes. Drafts only connect within their class. */
export function planarSplit(
  drafts: readonly EdgeDraft[],
  options: PlanarOptions = {},
): PlanarResult {
  const snap = options.snap ?? 0.6;
  const maxSegments = options.maxSegments ?? 6000;
  const maxComparisons = options.maxComparisons ?? 120_000;
  const distances = drafts.map((d) => cumulative(d.points));
  const cuts: number[][] = drafts.map((_, i) => [0, (distances[i] as number[]).at(-1) as number]);
  const segments: Segment[] = [];
  const cells = new Map<number, number[]>();
  let degraded = false;
  drafts.forEach((draft, d) => {
    const dist = distances[d] as number[];
    for (let i = 1; i < draft.points.length; i++) {
      if (segments.length >= maxSegments) {
        degraded = true;
        return;
      }
      const a = draft.points[i - 1] as Point2;
      const b = draft.points[i] as Point2;
      const length = (dist[i] as number) - (dist[i - 1] as number);
      if (length <= 1e-9) continue;
      const index = segments.length;
      segments.push({
        draft: d,
        index: i - 1,
        ax: a[0],
        az: a[1],
        bx: b[0],
        bz: b[1],
        length,
        start: dist[i - 1] as number,
      });
      const x0 = dmath.floor((dmath.min(a[0], b[0]) - snap) / CELL);
      const x1 = dmath.floor((dmath.max(a[0], b[0]) + snap) / CELL);
      const z0 = dmath.floor((dmath.min(a[1], b[1]) - snap) / CELL);
      const z1 = dmath.floor((dmath.max(a[1], b[1]) + snap) / CELL);
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const key = cellKey(x, z);
          const list = cells.get(key);
          if (list === undefined) cells.set(key, [index]);
          else list.push(index);
        }
    }
  });

  const seen = new Set<number>();
  let comparisons = 0;
  const n = segments.length;
  const cellKeys = [...cells.keys()].sort((a, b) => a - b);
  search: for (const key of cellKeys) {
    const list = cells.get(key) as number[];
    for (let i = 0; i < list.length; i++) {
      const s1 = segments[list[i] as number] as Segment;
      const d1 = drafts[s1.draft] as EdgeDraft;
      for (let j = i + 1; j < list.length; j++) {
        const s2 = segments[list[j] as number] as Segment;
        if (s1.draft === s2.draft) continue;
        const d2 = drafts[s2.draft] as EdgeDraft;
        if (d1.class !== d2.class) continue;
        const lo = dmath.min(list[i] as number, list[j] as number);
        const hi = dmath.max(list[i] as number, list[j] as number);
        const pair = lo * n + hi;
        if (seen.has(pair)) continue;
        seen.add(pair);
        if (++comparisons > maxComparisons) {
          degraded = true;
          break search;
        }
        intersect(s1, s2, d1, d2, snap, cuts);
      }
    }
  }

  // Snap every cut point into nodes (per class), in deterministic draft order.
  const nodes: PlanarNode[] = [];
  const nodeCells: Map<number, number[]>[] = [new Map(), new Map(), new Map(), new Map()];
  const nodeAt = (x: number, z: number, draft: EdgeDraft): number => {
    const cx = dmath.floor(x / snap);
    const cz = dmath.floor(z / snap);
    const classCells = nodeCells[CLASS_INDEX[draft.class]] as Map<number, number[]>;
    let best = -1;
    let bestDistance = snap;
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) {
        const list = classCells.get(cellKey(cx + ox, cz + oz));
        if (list === undefined) continue;
        for (const id of list) {
          const node = nodes[id] as PlanarNode;
          const distance = dmath.hypot(node.x - x, node.z - z);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = id;
          }
        }
      }
    if (best >= 0) return best;
    const id = nodes.length;
    nodes.push({ x, z, layer: draft.layer, class: draft.class });
    const key = cellKey(cx, cz);
    const list = classCells.get(key);
    if (list === undefined) classCells.set(key, [id]);
    else list.push(id);
    return id;
  };

  const pieces: PlanarPiece[] = [];
  drafts.forEach((draft, d) => {
    const dist = distances[d] as number[];
    const total = dist.at(-1) as number;
    const sorted = [...new Set((cuts[d] as number[]).map((c) => dmath.clamp(c, 0, total)))].sort(
      (a, b) => a - b,
    );
    const stops: { s: number; node: number }[] = [];
    for (const s of sorted) {
      const p = pointAt(draft.points, dist, s);
      const node = nodeAt(p[0], p[1], draft);
      const last = stops[stops.length - 1];
      // Consecutive cuts on one node collapse; a long run back to the same node is a loop.
      if (last !== undefined && last.node === node && s - last.s < 1) continue;
      stops.push({ s, node });
    }
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1] as { s: number; node: number };
      const b = stops[i] as { s: number; node: number };
      const sliced = slice(draft.points, dist, a.s, b.s, draft.heights);
      const from = nodes[a.node] as PlanarNode;
      const to = nodes[b.node] as PlanarNode;
      sliced.points[0] = [from.x, from.z];
      sliced.points[sliced.points.length - 1] = [to.x, to.z];
      pieces.push({
        draft: d,
        from: a.node,
        to: b.node,
        points: sliced.points,
        ...(sliced.heights !== undefined ? { heights: sliced.heights } : {}),
      });
    }
  });
  return { nodes, pieces, degraded };
}

function intersect(
  s1: Segment,
  s2: Segment,
  d1: EdgeDraft,
  d2: EdgeDraft,
  snap: number,
  cuts: number[][],
): void {
  const rx = s1.bx - s1.ax;
  const rz = s1.bz - s1.az;
  const qx = s2.bx - s2.ax;
  const qz = s2.bz - s2.az;
  const denom = rx * qz - rz * qx;
  const tEps = snap / s1.length;
  const uEps = snap / s2.length;
  const last1 = s1.index === d1.points.length - 2;
  const last2 = s2.index === d2.points.length - 2;
  if (dmath.abs(denom) > 1e-9 * s1.length * s2.length) {
    const wx = s2.ax - s1.ax;
    const wz = s2.az - s1.az;
    const t = (wx * qz - wz * qx) / denom;
    const u = (wx * rz - wz * rx) / denom;
    if (t < -tEps || t > 1 + tEps || u < -uEps || u > 1 + uEps) {
      endpointProjections(s1, s2, d1, d2, snap, cuts);
      return;
    }
    const tc = dmath.clamp(t, 0, 1);
    const uc = dmath.clamp(u, 0, 1);
    const atVertex1 = t <= tEps || t >= 1 - tEps;
    const atVertex2 = u <= uEps || u >= 1 - uEps;
    // Slightly-off extensions are only tolerated at draft ends (T-junctions, snapped joins).
    if ((t < 0 && !(s1.index === 0)) || (t > 1 && !last1)) {
      if (!(atVertex1 && atVertex2)) return;
    }
    if ((u < 0 && !(s2.index === 0)) || (u > 1 && !last2)) {
      if (!(atVertex1 && atVertex2)) return;
    }
    // A vertex shared by both drafts is a mapped connection at any grade; anything else (a
    // crossing, a T-junction) connects only at the same grade.
    if (!(atVertex1 && atVertex2) && !sameGrade(d1, d2)) return;
    (cuts[s1.draft] as number[]).push(s1.start + tc * s1.length);
    (cuts[s2.draft] as number[]).push(s2.start + uc * s2.length);
    return;
  }
  endpointProjections(s1, s2, d1, d2, snap, cuts);
}

/** Near-parallel or near-miss segments: connect a draft end that lies on the other segment. */
function endpointProjections(
  s1: Segment,
  s2: Segment,
  d1: EdgeDraft,
  d2: EdgeDraft,
  snap: number,
  cuts: number[][],
): void {
  const tryEnd = (end: Segment, other: Segment, atStart: boolean): void => {
    const px = atStart ? end.ax : end.bx;
    const pz = atStart ? end.az : end.bz;
    const ox = other.bx - other.ax;
    const oz = other.bz - other.az;
    const t = dmath.clamp(((px - other.ax) * ox + (pz - other.az) * oz) / other.length ** 2, 0, 1);
    const cx = other.ax + ox * t;
    const cz = other.az + oz * t;
    if (dmath.hypot(px - cx, pz - cz) > snap) return;
    (cuts[end.draft] as number[]).push(atStart ? end.start : end.start + end.length);
    (cuts[other.draft] as number[]).push(other.start + t * other.length);
  };
  const oneOrOther = (a: Segment, da: EdgeDraft, b: Segment, db: EdgeDraft): void => {
    if (!sameGrade(da, db)) return;
    if (a.index === 0) tryEnd(a, b, true);
    if (a.index === da.points.length - 2) tryEnd(a, b, false);
  };
  oneOrOther(s1, d1, s2, d2);
  oneOrOther(s2, d2, s1, d1);
}

function pointAt(points: readonly Point2[], dist: readonly number[], s: number): Point2 {
  let i = 1;
  while (i < dist.length - 1 && (dist[i] as number) < s) i++;
  const a = points[i - 1] as Point2;
  const b = points[i] as Point2;
  const d0 = dist[i - 1] as number;
  const len = (dist[i] as number) - d0;
  const t = len > 0 ? dmath.clamp((s - d0) / len, 0, 1) : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function slice(
  points: readonly Point2[],
  dist: readonly number[],
  s0: number,
  s1: number,
  heights?: readonly number[],
): { points: Point2[]; heights?: number[] } {
  const out: Point2[] = [pointAt(points, dist, s0)];
  const hs: number[] | undefined =
    heights !== undefined ? [heightAt(heights, dist, s0)] : undefined;
  for (let i = 1; i < points.length - 1; i++) {
    const d = dist[i] as number;
    if (d > s0 + 1e-6 && d < s1 - 1e-6) {
      out.push([...(points[i] as Point2)]);
      hs?.push(heights?.[i] as number);
    }
  }
  out.push(pointAt(points, dist, s1));
  hs?.push(heightAt(heights as number[], dist, s1));
  return hs !== undefined ? { points: out, heights: hs } : { points: out };
}

function heightAt(heights: readonly number[], dist: readonly number[], s: number): number {
  let i = 1;
  while (i < dist.length - 1 && (dist[i] as number) < s) i++;
  const d0 = dist[i - 1] as number;
  const len = (dist[i] as number) - d0;
  const t = len > 0 ? dmath.clamp((s - d0) / len, 0, 1) : 0;
  return (heights[i - 1] as number) + ((heights[i] as number) - (heights[i - 1] as number)) * t;
}
