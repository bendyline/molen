/**
 * Attached props: instances of pack or builtin models placed on a building from the recipe's
 * prop list. Anchors: `roof-ridge` (along pitched ridges, dominant wing first), `roof-flat`
 * (jittered grid inside the outline, margin from every edge), `roof-edge` (along outer edges at
 * the eave or parapet). `wall-any` and `ground-any` are reserved and place nothing yet.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import { distancePointToRing, pointInPolygon, ringBounds } from './geometry2d';
import type { RecipeProp } from './recipe';
import { hashCoord, unit01 } from './seed';
import type { RGB, Vec2, Vec3 } from './types';

export interface PropPlacement {
  model: string;
  x: number;
  y: number;
  z: number;
  /** three.js rotation about +y. */
  yaw: number;
  scale: number;
  color: RGB;
}

export interface RidgeLine {
  a: Vec3;
  b: Vec3;
  /** Yaw that aligns a model's +x with the ridge direction. */
  yaw: number;
  /** 0 = dominant wing. */
  priority: number;
}

export interface PropContext {
  outline: readonly Vec2[];
  holes: readonly (readonly Vec2[])[];
  /** Roof (eave) height. */
  eave: number;
  /** Parapet height above the eave, 0 without one. */
  parapetHeight: number;
  ridges: readonly RidgeLine[];
  /** Yaw of the footprint frame (models on flat roofs align with it). */
  frameYaw: number;
  salt: number;
}

/** Yaw (three.js rotation about +y) that maps a model's +x to the direction (dx, dz). */
export function yawForDirection(dx: number, dz: number): number {
  return -dmath.atan2(dz, dx);
}

function yawFor(prop: RecipeProp, aligned: number, hash: number, stream: number): number {
  switch (prop.yaw) {
    case 'random':
      return unit01(hash, stream) * dmath.TAU;
    case 'fixed':
      return 0;
    default:
      return aligned;
  }
}

function placeOnRidges(
  prop: RecipeProp,
  context: PropContext,
  propIndex: number,
  out: PropPlacement[],
): number {
  const ridges = [...context.ridges].sort((p, q) => p.priority - q.priority);
  let placed = 0;
  for (let index = 0; index < ridges.length && placed < prop.count; index++) {
    const ridge = ridges[index] as RidgeLine;
    const dx = ridge.b[0] - ridge.a[0];
    const dz = ridge.b[2] - ridge.a[2];
    const length = Math.hypot(dx, dz);
    const hash = hashCoord(propIndex, index, context.salt);
    const usable = length - 2 * prop.margin;
    let t = 0.5;
    if (usable > 0) {
      // Near one end (a third of the usable ridge), the end chosen by the seed.
      const fromStart = unit01(hash, 1) < 0.5;
      const along = prop.margin + unit01(hash, 2) * Math.min(usable, usable * 0.35);
      t = (fromStart ? along : length - along) / length;
    }
    out.push({
      model: prop.model,
      x: ridge.a[0] + dx * t,
      y: ridge.a[1] + (ridge.b[1] - ridge.a[1]) * t,
      z: ridge.a[2] + dz * t,
      yaw: yawFor(prop, ridge.yaw, hash, 3),
      scale: prop.scale,
      color: prop.color,
    });
    placed++;
  }
  return placed;
}

function clearOf(point: Vec2, context: PropContext, margin: number): boolean {
  if (!pointInPolygon(point, context.outline, context.holes)) return false;
  if (distancePointToRing(point, context.outline) < margin) return false;
  for (const hole of context.holes) {
    if (distancePointToRing(point, hole) < margin) return false;
  }
  return true;
}

function placeOnFlatRoof(
  prop: RecipeProp,
  context: PropContext,
  propIndex: number,
  out: PropPlacement[],
): number {
  const bounds = ringBounds(context.outline);
  const cell = Math.max(prop.spacing, 1);
  const columns = Math.min(64, Math.ceil((bounds[2] - bounds[0]) / cell));
  const rows = Math.min(64, Math.ceil((bounds[3] - bounds[1]) / cell));
  const candidates: Array<{ point: Vec2; u: number; hash: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const hash = hashCoord(column, row, context.salt + propIndex * 7919);
      const point: Vec2 = [
        bounds[0] + (column + 0.2 + unit01(hash, 0) * 0.6) * cell,
        bounds[1] + (row + 0.2 + unit01(hash, 1) * 0.6) * cell,
      ];
      if (!clearOf(point, context, prop.margin)) continue;
      candidates.push({ point, u: unit01(hash, 2), hash });
    }
  }
  candidates.sort((p, q) => p.u - q.u || p.point[0] - q.point[0] || p.point[1] - q.point[1]);
  const chosen = candidates.slice(0, prop.count);
  for (const candidate of chosen) {
    out.push({
      model: prop.model,
      x: candidate.point[0],
      y: context.eave,
      z: candidate.point[1],
      yaw: yawFor(prop, context.frameYaw, candidate.hash, 3),
      scale: prop.scale,
      color: prop.color,
    });
  }
  return chosen.length;
}

function placeOnEdges(
  prop: RecipeProp,
  context: PropContext,
  propIndex: number,
  out: PropPlacement[],
): number {
  const spots: Array<{ point: Vec2; yaw: number }> = [];
  const ring = context.outline;
  const spacing = Math.max(prop.spacing, 0.5);
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] as Vec2;
    const b = ring[(index + 1) % ring.length] as Vec2;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 2 * prop.margin + 0.1) continue;
    const outward = yawForDirection(dz / length, -dx / length);
    const slots = Math.max(1, Math.floor((length - 2 * prop.margin) / spacing));
    const step = (length - 2 * prop.margin) / slots;
    for (let slot = 0; slot < slots; slot++) {
      const s = prop.margin + (slot + 0.5) * step;
      spots.push({ point: [a[0] + (dx / length) * s, a[1] + (dz / length) * s], yaw: outward });
    }
  }
  if (spots.length === 0) return 0;
  const count = Math.min(prop.count, spots.length);
  const y = context.eave + (context.parapetHeight > 0 ? context.parapetHeight - 0.15 : -0.1);
  for (let index = 0; index < count; index++) {
    const spot = spots[Math.floor((index * spots.length) / count)] as { point: Vec2; yaw: number };
    const hash = hashCoord(propIndex, index, context.salt);
    out.push({
      model: prop.model,
      x: spot.point[0],
      y,
      z: spot.point[1],
      yaw: yawFor(prop, spot.yaw, hash, 3),
      scale: prop.scale,
      color: prop.color,
    });
  }
  return count;
}

/** Place every visible prop of a recipe; returns the number of instances added to `out`. */
export function placeProps(
  props: readonly RecipeProp[],
  context: PropContext,
  out: PropPlacement[],
): number {
  let placed = 0;
  props.forEach((prop, index) => {
    if (prop.count <= 0) return;
    switch (prop.anchor) {
      case 'roof-ridge':
        placed += placeOnRidges(prop, context, index, out);
        break;
      case 'roof-flat':
        placed += placeOnFlatRoof(prop, context, index, out);
        break;
      case 'roof-edge':
        placed += placeOnEdges(prop, context, index, out);
        break;
      default:
        break;
    }
  });
  return placed;
}
