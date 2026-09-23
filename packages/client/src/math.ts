import type { Quat, Vec3 } from '@bendyline/molen-schema';

// Pure interpolation math (no three.js) so it is unit-testable in Node and identical to what
// the renderer applies. The client converts to three.js types only at the scene-graph edge.

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Normalized linear quaternion interpolation along the shorter arc. Not a slerp: the angular
 * rate is not constant across `t`, which is the right trade for interpolating between two
 * consecutive simulation ticks (cheap, always returns a unit quaternion, no trig). A rotation
 * large enough for the difference to read would have to turn most of the way around inside one
 * tick.
 */
export function nlerp4(a: Quat, b: Quat, t: number): Quat {
  // Choose the shorter arc.
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }
  const x = a[0] + (bx - a[0]) * t;
  const y = a[1] + (by - a[1]) * t;
  const z = a[2] + (bz - a[2]) * t;
  const w = a[3] + (bw - a[3]) * t;
  const len = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
  return [x / len, y / len, z / len, w / len];
}
