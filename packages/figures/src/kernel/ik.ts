/**
 * Analytic two-bone inverse kinematics in figure space: given a chain root, a target, the two
 * segment lengths and a pole direction (the plane the middle joint bends toward), return the
 * unit directions of both segments. Pure dmath; used for hands and feet.
 */

import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';

export interface TwoBoneSolution {
  /** Unit direction of the upper segment (root to middle joint). */
  upperDir: Vec3;
  /** Unit direction of the lower segment (middle joint to effector). */
  lowerDir: Vec3;
  /** Middle joint position. */
  mid: Vec3;
  /** False when the target was clamped to the reachable annulus. */
  reached: boolean;
}

function normalize(v: Vec3): Vec3 {
  const l = dmath.hypot(v[0], v[1], v[2]);
  return l === 0 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function solveTwoBoneIk(
  root: Vec3,
  target: Vec3,
  pole: Vec3,
  upperLen: number,
  lowerLen: number,
): TwoBoneSolution {
  const eps = 1e-4;
  const d: Vec3 = [target[0] - root[0], target[1] - root[1], target[2] - root[2]];
  let dist = dmath.hypot(d[0], d[1], d[2]);
  const minDist = dmath.abs(upperLen - lowerLen) + eps;
  const maxDist = upperLen + lowerLen - eps;
  let reached = true;
  let dir: Vec3;
  if (dist < eps) {
    // Degenerate: aim the chain away from the pole so it folds predictably.
    dir = normalize([-pole[0], -pole[1], -pole[2]]);
    if (dir[0] === 0 && dir[1] === 0 && dir[2] === 0) dir = [0, -1, 0];
    dist = minDist;
    reached = false;
  } else {
    dir = [d[0] / dist, d[1] / dist, d[2] / dist];
    if (dist < minDist) {
      dist = minDist;
      reached = false;
    } else if (dist > maxDist) {
      dist = maxDist;
      reached = false;
    }
  }
  const cosA = dmath.clamp(
    (upperLen * upperLen + dist * dist - lowerLen * lowerLen) / (2 * upperLen * dist),
    -1,
    1,
  );
  const angleA = dmath.acos(cosA);
  // Pole component perpendicular to the root-to-target line.
  const along = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2];
  let perp: Vec3 = [pole[0] - along * dir[0], pole[1] - along * dir[1], pole[2] - along * dir[2]];
  if (dmath.hypot(perp[0], perp[1], perp[2]) < eps) {
    // Pole parallel to the chain: any perpendicular will do.
    const helper: Vec3 = dmath.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    perp = cross(cross(dir, helper), dir);
  }
  perp = normalize(perp);
  const ca = dmath.cos(angleA);
  const sa = dmath.sin(angleA);
  const upperDir: Vec3 = [
    dir[0] * ca + perp[0] * sa,
    dir[1] * ca + perp[1] * sa,
    dir[2] * ca + perp[2] * sa,
  ];
  const mid: Vec3 = [
    root[0] + upperDir[0] * upperLen,
    root[1] + upperDir[1] * upperLen,
    root[2] + upperDir[2] * upperLen,
  ];
  const end: Vec3 = [root[0] + dir[0] * dist, root[1] + dir[1] * dist, root[2] + dir[2] * dist];
  const lowerDir = normalize([end[0] - mid[0], end[1] - mid[1], end[2] - mid[2]]);
  return { upperDir, lowerDir, mid, reached };
}
