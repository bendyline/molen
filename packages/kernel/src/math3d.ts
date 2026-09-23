import type { Quat, Vec3 } from '@bendyline/molen-schema';
import { dmath } from './dmath';

// Pure quaternion/vector math for the hierarchy, tween, and figure systems, routed through
// dmath so the determinism swap point covers it. Conventions: Y-up, right-handed, quaternions
// [x, y, z, w], "forward" is +Z (a yaw of θ about +Y turns +Z toward +X: forward =
// [sin θ, 0, cos θ], matching the vehicle and aircraft solvers).

// Re-exported, not redeclared: `@bendyline/molen-schema` owns the wire types, and a second
// declaration here is what made the kernel's root entry rename them to dodge a clash it did
// not actually have.
export type { Quat, Vec3 };

export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatNormalize(q: Quat): Quat {
  const len = dmath.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (len === 0) return [0, 0, 0, 1];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

export function quatRotateVec3(q: Quat, v: Vec3): Vec3 {
  // v' = q * (v,0) * q⁻¹, expanded.
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}

/** A fresh identity quaternion [0, 0, 0, 1]. */
export function identityQuat(): Quat {
  return [0, 0, 0, 1];
}

/** The inverse of a unit quaternion. */
export function quatConjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function quatDot(a: Quat, b: Quat): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

/** Rotation of `angle` radians about a unit `axis`. */
export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle / 2;
  const s = dmath.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, dmath.cos(half)];
}

/** Rotation of `yaw` radians about +Y (forward +Z turns toward +X for positive yaw). */
export function quatFromYaw(yaw: number): Quat {
  const half = yaw / 2;
  return [0, dmath.sin(half), 0, dmath.cos(half)];
}

/**
 * Intrinsic Y·X·Z Euler angles (yaw about +Y, then pitch about the rotated +X, then roll
 * about the rotated +Z) — the natural order for characters and cameras.
 */
export function quatFromEuler(pitch: number, yaw: number, roll: number): Quat {
  const qy = quatFromYaw(yaw);
  const qx = quatFromAxisAngle([1, 0, 0], pitch);
  const qz = quatFromAxisAngle([0, 0, 1], roll);
  return quatMul(quatMul(qy, qx), qz);
}

/** Yaw (radians, about +Y) of the +Z forward direction of `q`. Zero when forward is +Z. */
export function yawOf(q: Quat): number {
  const f = quatRotateVec3(q, [0, 0, 1]);
  return dmath.atan2(f[0], f[2]);
}

/**
 * Spherical linear interpolation along the shortest arc; t is clamped to [0, 1]. Falls back
 * to normalized linear interpolation when the inputs are nearly parallel.
 */
export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  const u = dmath.clamp(t, 0, 1);
  let cosHalf = quatDot(a, b);
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  if (cosHalf < 0) {
    cosHalf = -cosHalf;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let wa: number;
  let wb: number;
  if (cosHalf > 0.9995) {
    wa = 1 - u;
    wb = u;
  } else {
    const half = dmath.acos(dmath.min(cosHalf, 1));
    const sinHalf = dmath.sin(half);
    wa = dmath.sin((1 - u) * half) / sinHalf;
    wb = dmath.sin(u * half) / sinHalf;
  }
  return quatNormalize([
    wa * a[0] + wb * bx,
    wa * a[1] + wb * by,
    wa * a[2] + wb * bz,
    wa * a[3] + wb * bw,
  ]);
}

/**
 * The rotation whose +Z axis points along `forward` with +Y as close to `up` as possible.
 * Returns identity for a zero-length forward or a forward parallel to up.
 */
export function lookRotation(forward: Vec3, up: Vec3 = [0, 1, 0]): Quat {
  const fl = dmath.hypot(forward[0], forward[1], forward[2]);
  if (fl === 0) return [0, 0, 0, 1];
  const zx = forward[0] / fl;
  const zy = forward[1] / fl;
  const zz = forward[2] / fl;
  // x = up × z
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  const xl = dmath.hypot(xx, xy, xz);
  if (xl === 0) return [0, 0, 0, 1];
  xx /= xl;
  xy /= xl;
  xz /= xl;
  // y = z × x
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  // Rotation matrix with columns (x, y, z) → quaternion (Shepperd's method).
  const trace = xx + yy + zz;
  if (trace > 0) {
    const s = dmath.sqrt(trace + 1) * 2;
    return quatNormalize([(yz - zy) / s, (zx - xz) / s, (xy - yx) / s, 0.25 * s]);
  }
  if (xx > yy && xx > zz) {
    const s = dmath.sqrt(1 + xx - yy - zz) * 2;
    return quatNormalize([0.25 * s, (yx + xy) / s, (zx + xz) / s, (yz - zy) / s]);
  }
  if (yy > zz) {
    const s = dmath.sqrt(1 + yy - xx - zz) * 2;
    return quatNormalize([(yx + xy) / s, 0.25 * s, (zy + yz) / s, (zx - xz) / s]);
  }
  const s = dmath.sqrt(1 + zz - xx - yy) * 2;
  return quatNormalize([(zx + xz) / s, (zy + yz) / s, 0.25 * s, (xy - yx) / s]);
}

/**
 * The shortest-arc rotation taking direction `a` to direction `b` (inputs need not be unit
 * length). Identity for zero-length inputs; a half-turn about a perpendicular axis for
 * opposite inputs.
 */
export function quatFromTo(a: Vec3, b: Vec3): Quat {
  const la = dmath.hypot(a[0], a[1], a[2]);
  const lb = dmath.hypot(b[0], b[1], b[2]);
  if (la === 0 || lb === 0) return [0, 0, 0, 1];
  const ax = a[0] / la;
  const ay = a[1] / la;
  const az = a[2] / la;
  const bx = b[0] / lb;
  const by = b[1] / lb;
  const bz = b[2] / lb;
  const d = ax * bx + ay * by + az * bz;
  if (d < -0.999999) {
    // Opposite: rotate 180° about any axis perpendicular to a.
    let px = -ay;
    let py = ax;
    let pz = 0;
    if (dmath.abs(ax) < 1e-6 && dmath.abs(ay) < 1e-6) {
      px = 0;
      py = -az;
      pz = ay;
    }
    return quatNormalize([px, py, pz, 0]);
  }
  return quatNormalize([ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx, 1 + d]);
}

/** Move `value` toward `target` by at most `amount` (amount ≥ 0). */
export function approach(value: number, target: number, amount: number): number {
  return value + dmath.clamp(target - value, -amount, amount);
}

export interface TransformLike {
  pos: Vec3;
  rot?: Quat;
  scale?: Vec3;
}

/** A local point through a transform: scale, rotate, then translate. */
export function transformPoint(t: TransformLike, p: Vec3): Vec3 {
  const s: Vec3 = t.scale ?? [1, 1, 1];
  const r = quatRotateVec3(t.rot ?? [0, 0, 0, 1], [p[0] * s[0], p[1] * s[1], p[2] * s[2]]);
  return [t.pos[0] + r[0], t.pos[1] + r[1], t.pos[2] + r[2]];
}

/** A world point into the local frame of a transform (the inverse of transformPoint). */
export function inverseTransformPoint(t: TransformLike, p: Vec3): Vec3 {
  const s: Vec3 = t.scale ?? [1, 1, 1];
  const d: Vec3 = [p[0] - t.pos[0], p[1] - t.pos[1], p[2] - t.pos[2]];
  const r = quatRotateVec3(quatConjugate(t.rot ?? [0, 0, 0, 1]), d);
  return [r[0] / s[0], r[1] / s[1], r[2] / s[2]];
}

/** world = parent ∘ local (scale is component-wise; no shear). */
export function composeTransforms(parent: TransformLike, local: TransformLike): TransformLike {
  const parentRot: Quat = parent.rot ?? [0, 0, 0, 1];
  const parentScale: Vec3 = parent.scale ?? [1, 1, 1];
  const localPos: Vec3 = [
    local.pos[0] * parentScale[0],
    local.pos[1] * parentScale[1],
    local.pos[2] * parentScale[2],
  ];
  const rotated = quatRotateVec3(parentRot, localPos);
  const out: TransformLike = {
    pos: [parent.pos[0] + rotated[0], parent.pos[1] + rotated[1], parent.pos[2] + rotated[2]],
    rot: quatNormalize(quatMul(parentRot, local.rot ?? [0, 0, 0, 1])),
  };
  const localScale = local.scale;
  if (localScale !== undefined || parent.scale !== undefined) {
    const ls: Vec3 = localScale ?? [1, 1, 1];
    out.scale = [parentScale[0] * ls[0], parentScale[1] * ls[1], parentScale[2] * ls[2]];
  }
  return out;
}
