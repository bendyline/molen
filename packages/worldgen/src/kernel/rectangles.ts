/**
 * Rectangle decomposition of a snapped rectilinear outline into overlapping "wings" that each
 * carry one roof. Overlaps are intentional: an L is two full-length rectangles whose roofs meet
 * in a valley, which is how the real house is built.
 */

import { type Bounds2, intersectBounds, pointInPolygon } from './geometry2d';
import type { Vec2 } from './types';

export interface Wing {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  longAxis: 'u' | 'v';
  /** 0 = dominant wing (highest ridge). */
  priority: number;
  /** Whether the start and end of the long axis reach the outline (gable ends visible). */
  endOnOutline: [boolean, boolean];
}

const MAX_GRID = 13;
const MAX_CANDIDATES = 24;
const EPSILON = 1e-6;

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) {
    const last = unique.at(-1);
    if (last === undefined || value - last > EPSILON) unique.push(value);
  }
  return unique;
}

interface Candidate {
  i0: number;
  j0: number;
  i1: number;
  j1: number;
  area: number;
  cells: Uint8Array;
}

export function wingWidth(wing: Wing): number {
  return wing.u1 - wing.u0;
}

export function wingDepth(wing: Wing): number {
  return wing.v1 - wing.v0;
}

export function wingArea(wing: Wing): number {
  return wingWidth(wing) * wingDepth(wing);
}

function wingBounds(wing: Wing): Bounds2 {
  return [wing.u0, wing.v0, wing.u1, wing.v1];
}

function contains(outer: Wing, inner: Wing): boolean {
  return (
    inner.u0 >= outer.u0 - EPSILON &&
    inner.u1 <= outer.u1 + EPSILON &&
    inner.v0 >= outer.v0 - EPSILON &&
    inner.v1 <= outer.v1 + EPSILON
  );
}

/**
 * Cover the inside cells of a rectilinear polygon with the fewest maximal rectangles (at most
 * `maxWings`). Returns undefined when the grid is too fine or no cover fits the wing budget.
 */
export function decomposeRectilinear(
  outline: readonly Vec2[],
  holes: readonly (readonly Vec2[])[],
  maxWings: number,
): Wing[] | undefined {
  const allPoints = [...outline, ...holes.flat()];
  const us = uniqueSorted(allPoints.map((point) => point[0]));
  const vs = uniqueSorted(allPoints.map((point) => point[1]));
  const columns = us.length - 1;
  const rows = vs.length - 1;
  if (columns < 1 || rows < 1 || us.length > MAX_GRID || vs.length > MAX_GRID) return undefined;
  const inside = new Uint8Array(columns * rows);
  let insideCount = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const center: Vec2 = [
        ((us[i] as number) + (us[i + 1] as number)) / 2,
        ((vs[j] as number) + (vs[j + 1] as number)) / 2,
      ];
      if (pointInPolygon(center, outline, holes)) {
        inside[j * columns + i] = 1;
        insideCount++;
      }
    }
  }
  if (insideCount === 0) return undefined;
  // Prefix sums give O(1) "all cells inside" checks.
  const stride = columns + 1;
  const prefix = new Int32Array(stride * (rows + 1));
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      prefix[(j + 1) * stride + (i + 1)] =
        (inside[j * columns + i] as number) +
        (prefix[j * stride + (i + 1)] as number) +
        (prefix[(j + 1) * stride + i] as number) -
        (prefix[j * stride + i] as number);
    }
  }
  const full = (i0: number, j0: number, i1: number, j1: number): boolean => {
    const sum =
      (prefix[(j1 + 1) * stride + (i1 + 1)] as number) -
      (prefix[j0 * stride + (i1 + 1)] as number) -
      (prefix[(j1 + 1) * stride + i0] as number) +
      (prefix[j0 * stride + i0] as number);
    return sum === (i1 - i0 + 1) * (j1 - j0 + 1);
  };
  const candidates: Candidate[] = [];
  for (let i0 = 0; i0 < columns; i0++) {
    for (let j0 = 0; j0 < rows; j0++) {
      for (let i1 = i0; i1 < columns; i1++) {
        for (let j1 = j0; j1 < rows; j1++) {
          if (!full(i0, j0, i1, j1)) continue;
          const maximal =
            !(i0 > 0 && full(i0 - 1, j0, i1, j1)) &&
            !(i1 < columns - 1 && full(i0, j0, i1 + 1, j1)) &&
            !(j0 > 0 && full(i0, j0 - 1, i1, j1)) &&
            !(j1 < rows - 1 && full(i0, j0, i1, j1 + 1));
          if (!maximal) continue;
          const cells = new Uint8Array(columns * rows);
          for (let j = j0; j <= j1; j++) {
            for (let i = i0; i <= i1; i++) cells[j * columns + i] = 1;
          }
          const area =
            ((us[i1 + 1] as number) - (us[i0] as number)) *
            ((vs[j1 + 1] as number) - (vs[j0] as number));
          candidates.push({ i0, j0, i1, j1, area, cells });
        }
      }
    }
  }
  candidates.sort(
    (a, b) => b.area - a.area || a.i0 - b.i0 || a.j0 - b.j0 || a.i1 - b.i1 || a.j1 - b.j1,
  );
  const pool = candidates.slice(0, MAX_CANDIDATES);
  const covered = new Uint8Array(columns * rows);
  const covers = (chosen: Candidate[]): boolean => {
    covered.fill(0);
    for (const candidate of chosen) {
      for (let cell = 0; cell < covered.length; cell++) {
        if (candidate.cells[cell] === 1) covered[cell] = 1;
      }
    }
    for (let cell = 0; cell < covered.length; cell++) {
      if (inside[cell] === 1 && covered[cell] !== 1) return false;
    }
    return true;
  };
  let solution: Candidate[] | undefined;
  const chosen: Candidate[] = [];
  const search = (start: number, remaining: number): boolean => {
    if (remaining === 0) return covers(chosen);
    for (let index = start; index <= pool.length - remaining; index++) {
      chosen.push(pool[index] as Candidate);
      if (search(index + 1, remaining - 1)) return true;
      chosen.pop();
    }
    return false;
  };
  for (let count = 1; count <= Math.min(maxWings, pool.length); count++) {
    chosen.length = 0;
    if (search(0, count)) {
      solution = [...chosen];
      break;
    }
  }
  if (solution === undefined) return undefined;
  const wings: Wing[] = solution.map((candidate) => {
    const u0 = us[candidate.i0] as number;
    const u1 = us[candidate.i1 + 1] as number;
    const v0 = vs[candidate.j0] as number;
    const v1 = vs[candidate.j1 + 1] as number;
    return {
      u0,
      v0,
      u1,
      v1,
      longAxis: u1 - u0 >= v1 - v0 ? 'u' : 'v',
      priority: 0,
      endOnOutline: [true, true],
    };
  });
  return finishWings(wings, outline, holes);
}

/** Order, trim, and dedupe wings. Exported for tests; `decomposeRectilinear` calls it. */
export function finishWings(
  input: Wing[],
  outline: readonly Vec2[],
  holes: readonly (readonly Vec2[])[],
): Wing[] {
  const wings = input
    .map((wing): Wing => ({ ...wing, endOnOutline: [true, true] }))
    .sort(
      (a, b) =>
        Math.min(wingWidth(b), wingDepth(b)) - Math.min(wingWidth(a), wingDepth(a)) ||
        wingArea(b) - wingArea(a) ||
        a.u0 - b.u0 ||
        a.v0 - b.v0,
    );
  wings.forEach((wing, index) => {
    wing.priority = index;
  });
  // Trim: a lower-priority wing whose end runs into a perpendicular dominant wing stops at that
  // wing's centreline, so its gable disappears under the dominant ridge.
  for (let w = 1; w < wings.length; w++) {
    const wing = wings[w] as Wing;
    for (let p = 0; p < w; p++) {
      const dominant = wings[p] as Wing;
      if (dominant.longAxis === wing.longAxis) continue;
      const overlap = intersectBounds(wingBounds(wing), wingBounds(dominant));
      if (overlap === undefined) continue;
      const overlapMin = wing.longAxis === 'u' ? overlap[0] : overlap[1];
      const overlapMax = wing.longAxis === 'u' ? overlap[2] : overlap[3];
      const start = wing.longAxis === 'u' ? wing.u0 : wing.v0;
      const end = wing.longAxis === 'u' ? wing.u1 : wing.v1;
      const dominantMin = wing.longAxis === 'u' ? dominant.u0 : dominant.v0;
      const dominantMax = wing.longAxis === 'u' ? dominant.u1 : dominant.v1;
      const centre = (dominantMin + dominantMax) / 2;
      const minLength = 0.5;
      if (overlapMax >= end - EPSILON && centre > start + minLength && centre < end) {
        if (wing.longAxis === 'u') wing.u1 = centre;
        else wing.v1 = centre;
        wing.endOnOutline[1] = false;
      } else if (overlapMin <= start + EPSILON && centre < end - minLength && centre > start) {
        if (wing.longAxis === 'u') wing.u0 = centre;
        else wing.v0 = centre;
        wing.endOnOutline[0] = false;
      }
    }
  }
  const kept = wings.filter(
    (wing, index) =>
      !wings.some((other, otherIndex) => otherIndex < index && contains(other, wing)),
  );
  for (const wing of kept) {
    const probe = 0.02;
    const [startProbe, endProbe]: [Vec2, Vec2] =
      wing.longAxis === 'u'
        ? [
            [wing.u0 - probe, (wing.v0 + wing.v1) / 2],
            [wing.u1 + probe, (wing.v0 + wing.v1) / 2],
          ]
        : [
            [(wing.u0 + wing.u1) / 2, wing.v0 - probe],
            [(wing.u0 + wing.u1) / 2, wing.v1 + probe],
          ];
    wing.endOnOutline = [
      wing.endOnOutline[0] && !pointInPolygon(startProbe, outline, holes),
      wing.endOnOutline[1] && !pointInPolygon(endProbe, outline, holes),
    ];
  }
  kept.forEach((wing, index) => {
    wing.priority = index;
  });
  return kept;
}
