import type { ActuatorInputs, ActuatorPositions, ActuatorSpecs } from '@bendyline/molen-schema';
import { dmath as m } from './dmath';
import { approach } from './math3d';

/** Pure snapshot-owned mechanics: no wall clock, renderer state or queued animation clips. */
export function stepActuators(
  specs: ActuatorSpecs,
  positions: ActuatorPositions | undefined,
  inputs: ActuatorInputs | undefined,
  dt: number,
): ActuatorPositions {
  const next: ActuatorPositions = {};
  for (const [name, spec] of Object.entries(specs)) {
    const from = positions?.[name] ?? spec.initial ?? 0;
    const input = Number(inputs?.[name] ?? spec.initial ?? 0);
    const target = Number.isFinite(input) ? m.clamp(input, 0, 1) : from;
    if (!Number.isFinite(dt) || dt <= 0) {
      next[name] = from;
    } else if (spec.mode === 'cycle') {
      const phase = from + dt / spec.seconds;
      next[name] = target > 0 ? phase % 1 : from === 0 || phase >= 1 ? 0 : phase;
    } else {
      const goal = spec.mode === 'latch' && (from > 0 || target > 0) ? 1 : target;
      next[name] = spec.seconds === 0 ? goal : approach(from, goal, dt / spec.seconds);
    }
  }
  return next;
}

export function actuatorsSettled(
  specs: ActuatorSpecs | undefined,
  positions: ActuatorPositions | undefined,
  inputs: ActuatorInputs | undefined,
): boolean {
  if (!specs) return true;
  for (const name in specs) {
    const spec = specs[name];
    if (!spec) continue;
    const from = positions?.[name];
    // Initialize missing state even when the default position is already at its target.
    if (from === undefined) return false;
    const input = Number(inputs?.[name] ?? spec.initial ?? 0);
    const target = Number.isFinite(input) ? m.clamp(input, 0, 1) : from;
    if (spec.mode === 'cycle') {
      if (target > 0 || from !== 0) return false;
    } else {
      const goal = spec.mode === 'latch' && (from > 0 || target > 0) ? 1 : target;
      if (from !== goal) return false;
    }
  }
  return true;
}
