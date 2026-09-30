/**
 * Positions along lanes. A lane's `s` runs from 0 at its (trimmed) start to `length` at its end;
 * negative `s` lies on the connector curve that led onto the lane from the previous lane, so an
 * agent turning through a junction core follows a smooth arc instead of jumping between lanes.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import { lineSegmentIndex, sampleTerrainLine } from '@bendyline/molen-terrain/kernel';
import type { LaneMovement, LaneSample, TransportEdge, TransportLane } from './types';

/** Edge-path distance of lane coordinate `s` (clamped to the lane). */
export function laneEdgeDistance(lane: TransportLane, edge: TransportEdge, s: number): number {
  const clamped = dmath.clamp(s, 0, lane.length);
  return lane.dir === 1 ? lane.trimStart + clamped : edge.path.length - lane.trimStart - clamped;
}

/** Lane coordinate of edge-path distance `d`. */
export function laneCoordinate(lane: TransportLane, edge: TransportEdge, d: number): number {
  return lane.dir === 1 ? d - lane.trimStart : edge.path.length - d - lane.trimStart;
}

/** Height of the edge surface at an edge-path distance. */
export function edgeHeight(edge: TransportEdge, d: number): number {
  const path = edge.path;
  const i = lineSegmentIndex(path, d);
  const d0 = path.distances[i] ?? 0;
  const d1 = path.distances[i + 1] ?? d0;
  const y0 = edge.ys[i] ?? 0;
  const y1 = edge.ys[i + 1] ?? y0;
  const t = d1 > d0 ? dmath.clamp((d - d0) / (d1 - d0), 0, 1) : 0;
  return y0 + (y1 - y0) * t;
}

/** Sample a lane at `s` within [0, length], writing into `out`. */
export function sampleLaneBody(
  lane: TransportLane,
  edge: TransportEdge,
  s: number,
  out: LaneSample,
): LaneSample {
  const d = laneEdgeDistance(lane, edge, s);
  const p = sampleTerrainLine(edge.path, d, lane.dir * lane.offset);
  out.x = p.x;
  out.z = p.z;
  out.dx = p.dx * lane.dir;
  out.dz = p.dz * lane.dir;
  out.y = edgeHeight(edge, d) + lane.lift;
  const ahead = edgeHeight(edge, dmath.clamp(d + lane.dir * 2, 0, edge.path.length));
  const behind = edgeHeight(edge, dmath.clamp(d - lane.dir * 2, 0, edge.path.length));
  out.grade = (ahead - behind) / 4;
  return out;
}

/** Point and tangent on a movement's connector at arc-length fraction `t` in [0, 1]. */
export function sampleConnector(move: LaneMovement, t: number, out: LaneSample): LaneSample {
  const u = dmath.clamp(t, 0, 1);
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  out.x = a * move.p0[0] + b * move.p1[0] + c * move.p2[0];
  out.y = a * move.p0[1] + b * move.p1[1] + c * move.p2[1];
  out.z = a * move.p0[2] + b * move.p1[2] + c * move.p2[2];
  let dx = 2 * (1 - u) * (move.p1[0] - move.p0[0]) + 2 * u * (move.p2[0] - move.p1[0]);
  let dz = 2 * (1 - u) * (move.p1[2] - move.p0[2]) + 2 * u * (move.p2[2] - move.p1[2]);
  const dy = 2 * (1 - u) * (move.p1[1] - move.p0[1]) + 2 * u * (move.p2[1] - move.p1[1]);
  const length = dmath.hypot(dx, dz);
  if (length > 1e-9) {
    dx /= length;
    dz /= length;
    out.grade = dy / length;
  } else {
    dx = move.p2[0] - move.p0[0];
    dz = move.p2[2] - move.p0[2];
    const l = dmath.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    out.grade = 0;
  }
  out.dx = dx;
  out.dz = dz;
  return out;
}

/** Arc length of a quadratic Bezier (8-chord approximation). */
export function connectorLength(
  p0: readonly [number, number, number],
  p1: readonly [number, number, number],
  p2: readonly [number, number, number],
): number {
  let total = 0;
  let px = p0[0];
  let pz = p0[2];
  for (let i = 1; i <= 8; i++) {
    const u = i / 8;
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    const x = a * p0[0] + b * p1[0] + c * p2[0];
    const z = a * p0[2] + b * p1[2] + c * p2[2];
    total += dmath.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return total;
}

/** A fresh sample record. */
export function laneSample(): LaneSample {
  return { x: 0, y: 0, z: 0, dx: 0, dz: 1, grade: 0 };
}
