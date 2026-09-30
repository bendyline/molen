/**
 * Spawn and behaviour policy: rings around the observer, densities, caps and driver/walker
 * parameters per class. Hosts override any part; the `ambient.policy` command records overrides
 * in world state so replays reproduce them.
 */

import type { JsonObject } from '@bendyline/molen-kernel/world';
import type { AmbientKind } from '../components';

export interface AmbientClassPolicy {
  enabled: boolean;
  /** Never spawn closer than this (metres). */
  near: number;
  /** Spawn out to this distance (metres). */
  far: number;
  /** Remove beyond this distance (metres). */
  keep: number;
  /** Target agents per kilometre of lane within `far`. */
  perLaneKm: number;
  /** Hard cap on live agents of the class (consists for trains). */
  max: number;
}

export interface DriverParams {
  /** Maximum acceleration (m/s²). */
  accel: number;
  /** Comfortable braking (m/s²). */
  brake: number;
  /** Minimum standstill gap (m). */
  gap: number;
  /** Time headway (s). */
  headway: number;
}

export interface AmbientPolicy {
  /** Run the spawner every N ticks. */
  spawnEveryTicks: number;
  /** Spawns per spawner run, across classes. */
  spawnBudget: number;
  /** Cosine of the half-angle of the view cone spawns avoid near the observer. */
  forwardConeCos: number;
  /** How far ahead (m) the view cone stays free of spawns; beyond it agents fade in. */
  forwardConeReach: number;
  /** Seconds a stuck agent waits before it is removed (out of sight only). */
  stuckSeconds: number;
  /** Seconds after which a junction deadlock is broken. */
  deadlockSeconds: number;
  car: AmbientClassPolicy;
  pedestrian: AmbientClassPolicy;
  train: AmbientClassPolicy;
  aircraft: AmbientClassPolicy;
  driver: DriverParams;
  rail: DriverParams;
}

export const DEFAULT_POLICY: AmbientPolicy = {
  spawnEveryTicks: 6,
  spawnBudget: 4,
  forwardConeCos: 0.82,
  forwardConeReach: 150,
  stuckSeconds: 90,
  deadlockSeconds: 20,
  car: { enabled: true, near: 60, far: 350, keep: 450, perLaneKm: 12, max: 200 },
  pedestrian: { enabled: false, near: 25, far: 140, keep: 180, perLaneKm: 25, max: 60 },
  train: { enabled: false, near: 150, far: 1200, keep: 1500, perLaneKm: 0.4, max: 2 },
  aircraft: { enabled: false, near: 800, far: 5000, keep: 6000, perLaneKm: 0, max: 4 },
  driver: { accel: 1.6, brake: 2.8, gap: 2, headway: 1.3 },
  rail: { accel: 0.5, brake: 0.9, gap: 8, headway: 6 },
};

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Merge overrides into a policy (plain objects merge; other values replace). */
export function mergePolicy(
  base: AmbientPolicy,
  ...overrides: (DeepPartial<AmbientPolicy> | JsonObject | undefined)[]
): AmbientPolicy {
  let out = base as unknown as Record<string, unknown>;
  for (const override of overrides) {
    if (override === undefined) continue;
    out = mergeObject(out, override as Record<string, unknown>);
  }
  return out as unknown as AmbientPolicy;
}

function mergeObject(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current)
    )
      out[key] = mergeObject(current as Record<string, unknown>, value as Record<string, unknown>);
    else out[key] = value;
  }
  return out;
}

/** Scale the rings and caps for a density factor and caps from a host budget. */
export interface AmbientBudget {
  cars?: number;
  pedestrians?: number;
  trains?: number;
  aircraft?: number;
  /** Outer spawn radius for cars; trains keep their ratio to it. */
  radius?: number;
  /** Outer spawn radius for pedestrians. */
  pedestrianRadius?: number;
}

/** A policy with a host budget's caps and ring sizes applied. */
export function policyForBudget(policy: AmbientPolicy, budget: AmbientBudget): AmbientPolicy {
  const scale = budget.radius !== undefined ? budget.radius / policy.car.far : 1;
  const walkScale =
    budget.pedestrianRadius !== undefined ? budget.pedestrianRadius / policy.pedestrian.far : 1;
  const ring = (
    c: AmbientClassPolicy,
    cap: number | undefined,
    factor: number,
  ): AmbientClassPolicy => ({
    ...c,
    ...(cap !== undefined ? { max: cap, enabled: c.enabled && cap > 0 } : {}),
    // Rings grow and shrink with the budget; the near radius only ever shrinks with them.
    ...(factor !== 1
      ? { near: Math.min(c.near, c.near * factor), far: c.far * factor, keep: c.keep * factor }
      : {}),
  });
  return {
    ...policy,
    car: ring(policy.car, budget.cars, scale),
    pedestrian: ring(policy.pedestrian, budget.pedestrians, walkScale),
    train: ring(policy.train, budget.trains, scale),
    aircraft: ring(policy.aircraft, budget.aircraft, 1),
  };
}

/** Which classes are on, from a class list (`['car']` when absent). */
export function classesPolicy(
  classes: readonly AmbientKind[] | undefined,
): DeepPartial<AmbientPolicy> {
  const on = new Set<AmbientKind>(classes ?? ['car']);
  return {
    car: { enabled: on.has('car') },
    pedestrian: { enabled: on.has('pedestrian') },
    train: { enabled: on.has('train') },
    aircraft: { enabled: on.has('aircraft') },
  };
}
