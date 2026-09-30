/** Intelligent Driver Model: acceleration from speed, desired speed and the gap to a leader. */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { DriverParams } from '../spawn/policy';

/**
 * IDM acceleration. `gap` is the bumper-to-bumper distance to the leader (Infinity when free),
 * `dv` the closing speed (own speed minus the leader's).
 */
export function idmAcceleration(
  v: number,
  v0: number,
  gap: number,
  dv: number,
  p: DriverParams,
): number {
  const ratio = v0 > 0.01 ? v / v0 : 2;
  const r2 = ratio * ratio;
  const free = 1 - r2 * r2;
  if (!Number.isFinite(gap)) return p.accel * free;
  const desired =
    p.gap + dmath.max(0, v * p.headway + (v * dv) / (2 * dmath.sqrt(p.accel * p.brake)));
  const g = dmath.max(gap, 0.01);
  const interaction = (desired / g) * (desired / g);
  return p.accel * (free - interaction);
}

/** Distance needed to stop from speed `v` at deceleration `b`. */
export function stoppingDistance(v: number, b: number): number {
  return (v * v) / (2 * b);
}
