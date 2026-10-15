/** Shared by the kernel, mirrored figure kind and Earth avatar renderer. No host state. */
import { dmath as m, type Vec3 } from '@bendyline/molen-kernel/determinism';
import type { SeatData, VehicleStateData } from '@bendyline/molen-kernel/vehicles';
import type { VehicleData } from '@bendyline/molen-schema';
import type { PoseEvalOptions } from './pose';

export function cycleRiderPose(
  vehicle: VehicleData | undefined,
  state: VehicleStateData | undefined,
  seat: SeatData | undefined,
): PoseEvalOptions['riding'] {
  const cycle = vehicle?.spec.cycle;
  if (cycle === undefined || seat?.role !== 'driver') return undefined;
  const relative = (p: Vec3): Vec3 => [
    p[0] - seat.position[0],
    p[1] - seat.position[1],
    p[2] - seat.position[2],
  ];
  const pivot = cycle.handlebarPivot;
  const steer = -(state?.steer ?? 0);
  const hands = cycle.grips.map((p): Vec3 => {
    const x = p[0] - pivot[0],
      z = p[2] - pivot[2];
    return relative([
      pivot[0] + x * m.cos(steer) + z * m.sin(steer),
      p[1],
      pivot[2] - x * m.sin(steer) + z * m.cos(steer),
    ]);
  });
  const feet = cycle.footrests.map(relative);
  const pedals = cycle.pedals;
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
  return {
    lean: cycle.riderLean + m.abs(steer) * 0.2,
    turn: steer,
    ik: { 'hand.l': hands[0], 'hand.r': hands[1], 'foot.l': feet[0], 'foot.r': feet[1] },
  };
}
