/** Shared axial forearm rotation for animated and rigid human hands. */
import {
  dmath,
  type Quat,
  quatFromAxisAngle,
  type Vec3,
} from '@bendyline/molen-kernel/determinism';

export const REST_FOREARM_ROLL: number = (55 * dmath.PI) / 180;

/** Rotate along elbow-to-wrist, preserving the wrist position even with arm splay. */
export function forearmRoll(axis: Vec3, angle: number = REST_FOREARM_ROLL, side: number = 1): Quat {
  const length = dmath.hypot(...axis);
  return quatFromAxisAngle([axis[0] / length, axis[1] / length, axis[2] / length], side * angle);
}
