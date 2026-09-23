/**
 * Footprint analysis: clean an outline, find its dominant orientation, snap it to a rectilinear
 * shape when it is one, classify the shape (box, L, T, U, ...), and decompose it into roof wings.
 * Rotation- and translation-invariant: the same shape anywhere at any angle yields congruent
 * results (within float rounding).
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import {
  type Bounds2,
  cleanRing,
  distancePointToRing,
  ensureOrientation,
  isSimpleRing,
  minAreaRectangle,
  ringArea,
  ringBounds,
  ringCentroid,
  ringPerimeter,
  ringSignedArea,
  ringStrictlyInside,
  ringsOverlap,
} from './geometry2d';
import { decomposeRectilinear, type Wing } from './rectangles';
import type { Vec2 } from './types';

/** Rigid frame: local = R(world - origin) with R = [[c, s], [-s, c]]. */
export interface Frame {
  ox: number;
  oz: number;
  c: number;
  s: number;
}

export function toLocal(frame: Frame, point: Vec2): Vec2 {
  const dx = point[0] - frame.ox;
  const dz = point[1] - frame.oz;
  return [frame.c * dx + frame.s * dz, -frame.s * dx + frame.c * dz];
}

export function toWorld(frame: Frame, local: Vec2): Vec2 {
  return [
    frame.ox + frame.c * local[0] - frame.s * local[1],
    frame.oz + frame.s * local[0] + frame.c * local[1],
  ];
}

/** Rotate a local direction into world space (no translation). */
export function directionToWorld(frame: Frame, local: Vec2): Vec2 {
  return [frame.c * local[0] - frame.s * local[1], frame.s * local[0] + frame.c * local[1]];
}

export type FootprintKind =
  | 'box'
  | 'L'
  | 'T'
  | 'U'
  | 'Z'
  | 'stair'
  | 'H'
  | 'plus'
  | 'courtyard'
  | 'complex'
  | 'irregular'
  | 'degenerate';

export interface FootprintOptions {
  /** tan of the maximum edge angle from an axis that still snaps (default tan 10°). */
  angleTolerance: number;
  /** Absolute off-axis tolerance in meters (absorbs source quantization). */
  snapTolerance: number;
  /** Outlines below this area (m²) are degenerate. */
  minArea: number;
  maxVertices: number;
  maxWings: number;
  /** Below this axis strength (0..1) an outline has no dominant orientation. */
  minAxisStrength: number;
}

export const DEFAULT_FOOTPRINT_OPTIONS: FootprintOptions = Object.freeze({
  angleTolerance: 0.1763,
  snapTolerance: 0.9,
  minArea: 4,
  maxVertices: 256,
  maxWings: 4,
  minAxisStrength: 0.35,
});

export interface FootprintAnalysis {
  kind: FootprintKind;
  rectilinear: boolean;
  /** Cleaned outline in the caller coordinates (positive orientation). */
  outline: Vec2[];
  holes: Vec2[][];
  frame: Frame;
  /** Outline in the frame; snapped when `rectilinear`. */
  localOutline: Vec2[];
  localHoles: Vec2[][];
  width: number;
  depth: number;
  area: number;
  perimeter: number;
  centroid: Vec2;
  bounds: Bounds2;
  vertexCount: number;
  reflexCount: number;
  axisStrength: number;
  /** width / depth, always >= 1. */
  elongation: number;
  /** area / (width * depth) in 0..1. */
  rectangularity: number;
  wings: Wing[];
  /**
   * One message per input hole that was dropped as unusable (outside the outline, crossing it,
   * or overlapping a hole already kept). Absent when every hole was kept. A broken ring is
   * dropped rather than thrown on: one bad inner ring must not cost the whole building.
   */
  holeNotices?: string[];
}

interface FramedOutline {
  frame: Frame;
  local: Vec2[];
  width: number;
  depth: number;
}

function frameOutline(c: number, s: number, outline: readonly Vec2[]): FramedOutline {
  let minU = Number.POSITIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  for (const point of outline) {
    const u = c * point[0] + s * point[1];
    const v = -s * point[0] + c * point[1];
    minU = Math.min(minU, u);
    minV = Math.min(minV, v);
    maxU = Math.max(maxU, u);
    maxV = Math.max(maxV, v);
  }
  const frame: Frame = { ox: c * minU - s * minV, oz: s * minU + c * minV, c, s };
  return {
    frame,
    local: outline.map((point) => toLocal(frame, point)),
    width: maxU - minU,
    depth: maxV - minV,
  };
}

function dominantAngle(outline: readonly Vec2[]): { angle: number; strength: number } {
  let sumCos = 0;
  let sumSin = 0;
  let total = 0;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index] as Vec2;
    const b = outline[(index + 1) % outline.length] as Vec2;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 1e-9) continue;
    const c1 = dx / length;
    const s1 = dz / length;
    const cos2 = c1 * c1 - s1 * s1;
    const sin2 = 2 * c1 * s1;
    sumCos += length * (cos2 * cos2 - sin2 * sin2);
    sumSin += length * (2 * sin2 * cos2);
    total += length;
  }
  if (total <= 0) return { angle: 0, strength: 0 };
  return { angle: dmath.atan2(sumSin, sumCos) / 4, strength: Math.hypot(sumCos, sumSin) / total };
}

function alignedLength(local: readonly Vec2[], axis: 0 | 1, angleTolerance: number): number {
  let length = 0;
  for (let index = 0; index < local.length; index++) {
    const a = local[index] as Vec2;
    const b = local[(index + 1) % local.length] as Vec2;
    const du = Math.abs(b[0] - a[0]);
    const dv = Math.abs(b[1] - a[1]);
    const along = axis === 0 ? du : dv;
    const across = axis === 0 ? dv : du;
    if (across <= angleTolerance * along) length += along;
  }
  return length;
}

/** Choose a canonical frame: width >= depth, centroid in the +u (then +v) half. */
function canonicalFrame(
  outline: readonly Vec2[],
  angle: number,
  angleTolerance: number,
): FramedOutline {
  let c = dmath.cos(angle);
  let s = dmath.sin(angle);
  let framed = frameOutline(c, s, outline);
  if (framed.depth > framed.width * (1 + 1e-9)) {
    [c, s] = [-s, c];
    framed = frameOutline(c, s, outline);
  } else if (Math.abs(framed.width - framed.depth) < 0.01 * framed.width) {
    if (
      alignedLength(framed.local, 1, angleTolerance) >
      alignedLength(framed.local, 0, angleTolerance)
    ) {
      [c, s] = [-s, c];
      framed = frameOutline(c, s, outline);
    }
  }
  const centroid = ringCentroid(framed.local);
  const du = centroid[0] - framed.width / 2;
  const dv = centroid[1] - framed.depth / 2;
  if (Math.abs(du) > 1e-3 * Math.max(1, framed.width)) {
    if (du < 0) framed = frameOutline(-c, -s, outline);
  } else if (Math.abs(dv) > 1e-3 * Math.max(1, framed.depth) && dv < 0) {
    framed = frameOutline(-c, -s, outline);
  }
  return framed;
}

export interface SnapResult {
  ring: Vec2[];
  /** Largest distance from an input vertex to the snapped outline, in meters. */
  displacement: number;
}

function edgeClass(a: Vec2, b: Vec2, options: FootprintOptions): 'H' | 'V' | undefined {
  const du = Math.abs(b[0] - a[0]);
  const dv = Math.abs(b[1] - a[1]);
  const aligned =
    Math.min(du, dv) <= Math.max(options.snapTolerance, options.angleTolerance * Math.max(du, dv));
  if (!aligned) return undefined;
  return du >= dv ? 'H' : 'V';
}

/** Snap a local ring to axis-aligned edges; undefined when it is not rectilinear. */
export function snapRectilinear(
  local: readonly Vec2[],
  options: FootprintOptions,
): SnapResult | undefined {
  let ring = local.map((point): Vec2 => [point[0], point[1]]);
  for (let iteration = 0; iteration < 8; iteration++) {
    if (ring.length < 4) return undefined;
    const classes: Array<'H' | 'V'> = [];
    for (let index = 0; index < ring.length; index++) {
      const cls = edgeClass(ring[index] as Vec2, ring[(index + 1) % ring.length] as Vec2, options);
      if (cls === undefined) return undefined;
      classes.push(cls);
    }
    // Merge consecutive edges of the same class by dropping the shared vertex.
    let merged = true;
    while (merged && ring.length >= 4) {
      merged = false;
      for (let index = 0; index < ring.length; index++) {
        const previousEdge = classes[(index + ring.length - 1) % ring.length];
        if (previousEdge === classes[index]) {
          ring.splice(index, 1);
          classes.splice(index, 1);
          merged = true;
          break;
        }
      }
    }
    if (ring.length < 4 || ring.length % 2 !== 0) return undefined;
    const finalClasses: Array<'H' | 'V'> = [];
    for (let index = 0; index < ring.length; index++) {
      const cls = edgeClass(ring[index] as Vec2, ring[(index + 1) % ring.length] as Vec2, options);
      if (cls === undefined) return undefined;
      finalClasses.push(cls);
    }
    const snapped: Vec2[] = ring.map((point, index) => {
      const previous = ring[(index + ring.length - 1) % ring.length] as Vec2;
      const next = ring[(index + 1) % ring.length] as Vec2;
      const previousClass = finalClasses[(index + ring.length - 1) % ring.length];
      const nextClass = finalClasses[index];
      if (previousClass === nextClass) return [point[0], point[1]];
      const u = previousClass === 'V' ? (previous[0] + point[0]) / 2 : (point[0] + next[0]) / 2;
      const v = previousClass === 'H' ? (previous[1] + point[1]) / 2 : (point[1] + next[1]) / 2;
      return [u, v];
    });
    let shortest = Number.POSITIVE_INFINITY;
    let shortestIndex = -1;
    for (let index = 0; index < snapped.length; index++) {
      const a = snapped[index] as Vec2;
      const b = snapped[(index + 1) % snapped.length] as Vec2;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < shortest) {
        shortest = length;
        shortestIndex = index;
      }
    }
    if (shortest < 0.6 && snapped.length - 2 >= 4) {
      const removeSecond = (shortestIndex + 1) % snapped.length;
      ring = snapped.filter((_, index) => index !== shortestIndex && index !== removeSecond);
      continue;
    }
    ring = snapped;
    break;
  }
  if (ring.length < 4) return undefined;
  let displacement = 0;
  for (const point of local) {
    displacement = Math.max(displacement, distancePointToRing(point, ring));
  }
  return { ring, displacement };
}

function reflexFlags(ring: readonly Vec2[]): boolean[] {
  const sign = ringSignedArea(ring) >= 0 ? 1 : -1;
  return ring.map((point, index) => {
    const previous = ring[(index + ring.length - 1) % ring.length] as Vec2;
    const next = ring[(index + 1) % ring.length] as Vec2;
    const cross =
      (point[0] - previous[0]) * (next[1] - point[1]) -
      (point[1] - previous[1]) * (next[0] - point[0]);
    return cross * sign < 0;
  });
}

function canonicalGaps(flags: readonly boolean[]): number[] {
  const reflexIndices = flags.flatMap((flag, index) => (flag ? [index] : []));
  if (reflexIndices.length === 0) return [];
  const gaps: number[] = [];
  for (let index = 0; index < reflexIndices.length; index++) {
    const current = reflexIndices[index] as number;
    const next = reflexIndices[(index + 1) % reflexIndices.length] as number;
    const distance = (((next - current) % flags.length) + flags.length) % flags.length;
    gaps.push(reflexIndices.length === 1 ? flags.length - 1 : distance - 1);
  }
  let best = gaps;
  for (let rotation = 1; rotation < gaps.length; rotation++) {
    const candidate = gaps.slice(rotation).concat(gaps.slice(0, rotation));
    for (let index = 0; index < candidate.length; index++) {
      const a = candidate[index] as number;
      const b = best[index] as number;
      if (a < b) {
        best = candidate;
        break;
      }
      if (a > b) break;
    }
  }
  return best;
}

/** Classify a snapped rectilinear ring by its reflex-vertex pattern. */
export function classifyRectilinear(ring: readonly Vec2[], hasHoles: boolean): FootprintKind {
  if (hasHoles) return 'courtyard';
  const flags = reflexFlags(ring);
  const reflex = flags.filter(Boolean).length;
  const n = ring.length;
  if (n === 4 && reflex === 0) return 'box';
  if (n === 6 && reflex === 1) return 'L';
  const gaps = canonicalGaps(flags).join(',');
  if (n === 8 && reflex === 2) {
    if (gaps === '0,6') return 'U';
    if (gaps === '1,5') return 'stair';
    if (gaps === '2,4') return 'T';
    if (gaps === '3,3') return 'Z';
  }
  if (n === 12 && reflex === 4) {
    if (gaps === '0,4,0,4') return 'H';
    if (gaps === '2,2,2,2') return 'plus';
  }
  return 'complex';
}

function degenerate(outline: Vec2[]): FootprintAnalysis {
  const bounds = outline.length > 0 ? ringBounds(outline) : ([0, 0, 0, 0] as Bounds2);
  return {
    kind: 'degenerate',
    rectilinear: false,
    outline,
    holes: [],
    frame: { ox: bounds[0], oz: bounds[1], c: 1, s: 0 },
    localOutline: outline.map((point): Vec2 => [point[0] - bounds[0], point[1] - bounds[1]]),
    localHoles: [],
    width: bounds[2] - bounds[0],
    depth: bounds[3] - bounds[1],
    area: outline.length >= 3 ? ringArea(outline) : 0,
    perimeter: outline.length >= 2 ? ringPerimeter(outline) : 0,
    centroid: outline.length > 0 ? ringCentroid(outline) : [0, 0],
    bounds,
    vertexCount: outline.length,
    reflexCount: 0,
    axisStrength: 0,
    elongation: 1,
    rectangularity: 0,
    wings: [],
  };
}

/**
 * Keep only the holes a building can be built around: a real ring (>= 3 points, >= 1 m2, not
 * self-intersecting) that lies strictly inside the outline and shares no area with a hole
 * already kept. Imported multipolygon sources routinely carry inner rings that sit outside
 * their outer ring, straddle it, or duplicate each other; accepted, they triangulate into
 * geometry outside the footprint and `buildWalls` raises a wall for every ring, so the building
 * sprouts a detached wall tube beside the house. Ties break by input order, so results are
 * stable.
 */
function usableHoles(
  outer: readonly Vec2[],
  holes: readonly (readonly Vec2[])[],
): { holes: Vec2[][]; notices: string[] } {
  const kept: Vec2[][] = [];
  const keptFrom: number[] = [];
  const notices: string[] = [];
  holes.forEach((raw, index) => {
    const cleaned = cleanRing(raw);
    // Slivers and stubs are below the noise floor of the source data, not a data error.
    if (cleaned.length < 3 || ringArea(cleaned) < 1) return;
    const hole = ensureOrientation(cleaned, false);
    if (!isSimpleRing(hole)) {
      notices.push(`hole ${index}: self-intersecting ring dropped`);
      return;
    }
    if (!ringStrictlyInside(hole, outer)) {
      notices.push(`hole ${index}: not strictly inside the outline; dropped`);
      return;
    }
    const clash = kept.findIndex((other) => ringsOverlap(hole, other));
    if (clash >= 0) {
      notices.push(`hole ${index}: overlaps hole ${keptFrom[clash]}; dropped`);
      return;
    }
    kept.push(hole);
    keptFrom.push(index);
  });
  return { holes: kept, notices };
}

export function analyzeFootprint(
  outline: readonly Vec2[],
  holes: readonly (readonly Vec2[])[] = [],
  options: FootprintOptions = DEFAULT_FOOTPRINT_OPTIONS,
): FootprintAnalysis {
  let outer = cleanRing(outline);
  let tolerance = 0.05;
  for (let attempt = 0; attempt < 6 && outer.length > options.maxVertices; attempt++) {
    tolerance *= 2;
    outer = cleanRing(outer, 0.05, tolerance);
  }
  if (outer.length < 3) return degenerate(outer);
  outer = ensureOrientation(outer, true);
  const area = ringArea(outer);
  const bounds = ringBounds(outer);
  if (
    area < options.minArea ||
    bounds[2] - bounds[0] < 1.5 ||
    bounds[3] - bounds[1] < 1.5 ||
    outer.length > options.maxVertices
  ) {
    return degenerate(outer);
  }
  const { holes: cleanHoles, notices: holeNotices } = usableHoles(outer, holes);
  const simple = isSimpleRing(outer);
  const { angle, strength } = dominantAngle(outer);
  const usableAngle = strength >= options.minAxisStrength ? angle : minAreaRectangle(outer).angle;
  const framed = canonicalFrame(outer, usableAngle, options.angleTolerance);
  const localHoles = cleanHoles.map((hole) => hole.map((point) => toLocal(framed.frame, point)));
  const perimeter = ringPerimeter(outer);
  const centroid = ringCentroid(outer);
  const base: FootprintAnalysis = {
    kind: 'irregular',
    rectilinear: false,
    outline: outer,
    holes: cleanHoles,
    frame: framed.frame,
    localOutline: framed.local,
    localHoles,
    width: framed.width,
    depth: framed.depth,
    area,
    perimeter,
    centroid,
    bounds,
    vertexCount: outer.length,
    reflexCount: reflexFlags(outer).filter(Boolean).length,
    axisStrength: strength,
    elongation: framed.depth > 1e-9 ? framed.width / framed.depth : 1,
    rectangularity: framed.width * framed.depth > 1e-9 ? area / (framed.width * framed.depth) : 0,
    wings: [],
    ...(holeNotices.length > 0 ? { holeNotices } : {}),
  };
  if (!simple || strength < options.minAxisStrength) return base;
  const snapped = snapRectilinear(framed.local, options);
  if (snapped === undefined) return base;
  const snappedArea = ringArea(snapped.ring);
  const maxDisplacement = Math.max(1.2, 0.08 * Math.max(framed.width, framed.depth));
  if (Math.abs(snappedArea - area) > 0.12 * area || snapped.displacement > maxDisplacement) {
    return base;
  }
  const snappedHoles: Vec2[][] = [];
  for (const hole of localHoles) {
    const snappedHole = snapRectilinear(hole, options);
    if (snappedHole === undefined) return base;
    snappedHoles.push(ensureOrientation(snappedHole.ring, false));
  }
  const ring = ensureOrientation(snapped.ring, true);
  const kind = classifyRectilinear(ring, snappedHoles.length > 0);
  const wings = decomposeRectilinear(ring, snappedHoles, options.maxWings) ?? [];
  const snappedBounds = ringBounds(ring);
  return {
    ...base,
    kind: wings.length === 0 && kind !== 'box' ? 'complex' : kind,
    rectilinear: true,
    localOutline: ring,
    localHoles: snappedHoles,
    width: snappedBounds[2] - snappedBounds[0],
    depth: snappedBounds[3] - snappedBounds[1],
    vertexCount: ring.length,
    reflexCount: reflexFlags(ring).filter(Boolean).length,
    wings,
  };
}
