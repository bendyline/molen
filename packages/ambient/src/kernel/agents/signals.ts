/**
 * Signal phases as a pure function of (junction, tick): nothing is stored or hashed, and a client
 * can light signal heads by calling the same function with the same graph.
 */

import type { TransportJunction } from '../graph/types';
import { fnv1a, unit01 } from '../ids';

export type SignalColor = 'green' | 'amber' | 'red';

const AMBER_SECONDS = 3;
const ALL_RED_SECONDS = 2;

export interface SignalTiming {
  cycleTicks: number;
  offsetTicks: number;
  greenTicks: number[];
}

/** Timing for a signalised junction: 18–30 s green per phase group, seeded by the junction id. */
export function signalTiming(junction: TransportJunction, tickRate: number): SignalTiming {
  const seed = fnv1a(junction.id);
  const greenTicks: number[] = [];
  for (let g = 0; g < junction.groups; g++)
    greenTicks.push(Math.round((18 + 12 * unit01(seed, g + 1)) * tickRate));
  const phase = Math.round((AMBER_SECONDS + ALL_RED_SECONDS) * tickRate);
  let cycleTicks = 0;
  for (const green of greenTicks) cycleTicks += green + phase;
  return { cycleTicks, offsetTicks: Math.floor(unit01(seed, 0) * cycleTicks), greenTicks };
}

/** The colour shown to arms of phase group `group` at `tick`. */
export function signalColor(
  junction: TransportJunction,
  group: number,
  tick: number,
  tickRate: number,
  timing: SignalTiming = signalTiming(junction, tickRate),
): SignalColor {
  if (junction.control !== 'signal' || timing.cycleTicks <= 0) return 'green';
  const amber = Math.round(AMBER_SECONDS * tickRate);
  const allRed = Math.round(ALL_RED_SECONDS * tickRate);
  let t = (tick + timing.offsetTicks) % timing.cycleTicks;
  for (let g = 0; g < timing.greenTicks.length; g++) {
    const green = timing.greenTicks[g] as number;
    if (t < green) return g === group ? 'green' : 'red';
    t -= green;
    if (t < amber) return g === group ? 'amber' : 'red';
    t -= amber;
    if (t < allRed) return 'red';
    t -= allRed;
  }
  return 'red';
}

/** Whether every group is red at `tick` (the all-red clearance interval). */
export function allRed(
  junction: TransportJunction,
  tick: number,
  tickRate: number,
  timing: SignalTiming = signalTiming(junction, tickRate),
): boolean {
  for (let g = 0; g < junction.groups; g++)
    if (signalColor(junction, g, tick, tickRate, timing) !== 'red') return false;
  return true;
}
