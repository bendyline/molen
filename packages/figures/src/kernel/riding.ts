/** Shared by the kernel, mirrored figure kind and Earth avatar renderer. No host state. */
import { dmath as m, type Vec3 } from '@bendyline/molen-kernel/determinism';
import type { SeatData, VehicleStateData } from '@bendyline/molen-kernel/vehicles';
import type { VehicleData } from '@bendyline/molen-schema';
import type { PoseEvalOptions } from './pose';

/**
 * The pushing foot's path beside the board, in model space, at push phase `phase` (0–1): planted
 * ahead, driven back along the ground for half the cycle, then lifted and swung forward again.
 */
function pushFoot(phase: number, side: number, front: number, back: number): Vec3 {
  const x = side * 0.23;
  if (phase < 0.5) {
    const t = m.smoothstep(phase / 0.5);
    return [x, 0.085, front + (back - front) * t];
  }
  const t = (phase - 0.5) / 0.5;
  return [x, 0.085 + 0.13 * m.sin(m.PI * t), back + (front - back) * m.smoothstep(t)];
}

/**
 * The rider's posture and hand/foot targets for the driver of a handlebar-steered vehicle: a
 * cycle (seated, standing or sideways, see `CycleSpec.stance`) or a non-leaning vehicle with
 * `spec.handlebar`. Undefined for every other vehicle and seat.
 */
export function cycleRiderPose(
  vehicle: VehicleData | undefined,
  state: VehicleStateData | undefined,
  seat: SeatData | undefined,
): PoseEvalOptions['riding'] {
  const spec = vehicle?.spec;
  const cycle = spec?.cycle;
  const contacts = cycle ?? spec?.handlebar;
  if (contacts === undefined || seat?.role !== 'driver') return undefined;
  const stance = cycle?.stance ?? 'seated';
  const relative = (p: Vec3): Vec3 => [
    p[0] - seat.position[0],
    p[1] - seat.position[1],
    p[2] - seat.position[2],
  ];
  const pivot = contacts.handlebarPivot;
  // A sideways rider has no bars to turn: the hands stay where the board carries them.
  const steer = stance === 'sideways' ? 0 : -(state?.steer ?? 0);
  const hands = contacts.grips.map((p): Vec3 => {
    const x = p[0] - pivot[0],
      z = p[2] - pivot[2];
    return relative([
      pivot[0] + x * m.cos(steer) + z * m.sin(steer),
      p[1],
      pivot[2] - x * m.sin(steer) + z * m.cos(steer),
    ]);
  });
  const feet = contacts.footrests.map(relative);
  const pedals = cycle?.pedals;
  if (pedals !== undefined) {
    const angle = state?.pedalAngle ?? 0;
    for (const [i, side] of [
      [0, 1],
      [1, -1],
    ] as const)
      feet[i] = relative([
        pedals.center[0] + side * pedals.halfWidth,
        pedals.center[1] + side * pedals.radius * m.cos(angle) + 0.08,
        pedals.center[2] + side * pedals.radius * m.sin(angle) - 0.06,
      ]);
  }
  // Pushing off: the rear foot leaves the deck for the ground beside it. The board's toe side
  // (where a left-foot-forward rider faces) is its right, -x.
  const push = cycle?.kick !== undefined && stance === 'sideways' ? (state?.kick ?? 0) : 0;
  if (push > 0) {
    const [left, right] = contacts.footrests;
    const rear = left[2] >= right[2] ? 1 : 0;
    const [lead, deck] = rear === 1 ? [left, right] : [right, left];
    const ground = pushFoot((state?.pedalAngle ?? 0) / m.TAU, -1, lead[2] - 0.05, lead[2] - 0.75);
    const lift = 0.5 * push * (1 - push);
    feet[rear] = relative([
      deck[0] + (ground[0] - deck[0]) * push,
      deck[1] + (ground[1] - deck[1]) * push + lift,
      deck[2] + (ground[2] - deck[2]) * push,
    ]);
  }
  return {
    lean: contacts.riderLean + m.abs(steer) * 0.2,
    turn: steer,
    ik: { 'hand.l': hands[0], 'hand.r': hands[1], 'foot.l': feet[0], 'foot.r': feet[1] },
    ...(stance !== 'seated' ? { stance } : {}),
    ...(push > 0 ? { push } : {}),
  };
}
