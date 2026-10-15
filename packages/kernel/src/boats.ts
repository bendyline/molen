import type {
  BoatData,
  BoatInputData,
  BoatSpec,
  BoatStateData,
  WaterSettings,
} from '@bendyline/molen-schema';
import { type ComponentType, defineComponent, Transform, type TransformData } from './component';
import { dmath as m } from './dmath';
import { approach } from './math3d';
import { installMountedSeats, Mountable, Mounted, vehicleRotation } from './vehicles';
import type { World } from './world';

export const Boat: ComponentType<BoatData> = defineComponent<BoatData>('boat');
export const BoatInput: ComponentType<BoatInputData> = defineComponent<BoatInputData>('boatInput');
export const BoatState: ComponentType<BoatStateData> = defineComponent<BoatStateData>('boatState');
export const Water: ComponentType<WaterSettings> = defineComponent<WaterSettings>('water');
export const IDLE_BOAT_INPUT: BoatInputData = { throttle: 0, steering: 0, anchor: true };

/** Mean surface height and optional measured depth/current. Omit depth for DEMs without bathymetry. */
export interface WaterSample {
  height: number;
  depth?: number;
  current?: [number, number];
}
export interface BoatEnvironment {
  /** undefined = unloaded; null = dry land; never infer water merely from low terrain. */
  waterAt(x: number, z: number): WaterSample | null | undefined;
  conditions?: WaterSettings;
  time?: number;
  canOccupy?(position: [number, number, number], yaw: number, spec: BoatSpec, id: string): boolean;
}
export function initialBoatState(yaw = 0): BoatStateData {
  return {
    speed: 0,
    lateralSpeed: 0,
    velocity: [0, 0],
    yaw,
    yawRate: 0,
    steer: 0,
    pitch: 0,
    roll: 0,
    vy: 0,
    anchored: true,
    grounded: false,
    waitingForWater: false,
  };
}
/** Analytic swell displacement and slopes; deterministic, stateless and replayable. */
export function sampleWaves(
  settings: WaterSettings,
  x: number,
  z: number,
  seconds: number,
): {
  height: number;
  slopeX: number;
  slopeZ: number;
} {
  let height = 0,
    slopeX = 0,
    slopeZ = 0;
  for (const wave of settings.waves ?? []) {
    const dx = m.sin(wave.direction),
      dz = m.cos(wave.direction);
    const k = m.TAU / wave.wavelength;
    const phase = k * (x * dx + z * dz - wave.speed * seconds);
    height += wave.amplitude * m.sin(phase);
    const slope = wave.amplitude * k * m.cos(phase);
    slopeX += slope * dx;
    slopeZ += slope * dz;
  }
  return { height, slopeX, slopeZ };
}

/** Check the hull footprint, not just its center, against coastlines and known shallow water. */
export function boatSupport(
  env: BoatEnvironment,
  x: number,
  z: number,
  yaw: number,
  spec: BoatSpec,
): {
  sample?: WaterSample;
  grounded: boolean;
  waiting: boolean;
} {
  const s = m.sin(yaw),
    c = m.cos(yaw);
  let center: WaterSample | undefined;
  for (const [side, forward] of [
    [0, 0],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
  ]) {
    const lx = (side ?? 0) * spec.width * 0.45,
      lz = (forward ?? 0) * spec.length * 0.45;
    const sample = env.waterAt(x + lx * c + lz * s, z - lx * s + lz * c);
    if (sample === undefined) return { grounded: false, waiting: true };
    if (sample === null || (sample.depth !== undefined && sample.depth < spec.draft))
      return { grounded: true, waiting: false };
    center ??= sample;
  }
  return { ...(center ? { sample: center } : {}), grounded: false, waiting: false };
}

/** Powered displacement/planing approximation; no road brakes or tire physics. */
export function stepBoat(
  t: TransformData,
  state: BoatStateData,
  input: BoatInputData,
  spec: BoatSpec,
  dt: number,
  env: BoatEnvironment,
  id = '',
): { transform: TransformData; state: BoatStateData } {
  if (!Number.isFinite(dt) || dt <= 0) return { transform: t, state };
  const pos: [number, number, number] = [...t.pos];
  const next = {
    ...state,
    velocity: [...state.velocity] as [number, number],
    grounded: false,
    waitingForWater: false,
  };
  const steps = m.max(1, m.ceil(dt * 120)),
    h = dt / steps;
  const conditions = env.conditions ?? {};
  const throttle = m.clamp(input.throttle, -1, 1);
  for (let i = 0; i < steps; i++) {
    const support = boatSupport(env, pos[0], pos[2], next.yaw, spec);
    if (!support.sample) {
      next.waitingForWater = support.waiting;
      next.grounded = support.grounded;
      next.velocity = [0, 0];
      next.speed = 0;
      next.lateralSpeed = 0;
      next.yawRate = 0;
      break;
    }
    const current = support.sample.current ?? conditions.current ?? [0, 0];
    const s = m.sin(next.yaw),
      c = m.cos(next.yaw);
    const u = (next.velocity[0] - current[0]) * s + (next.velocity[1] - current[1]) * c;
    const v = (next.velocity[0] - current[0]) * c - (next.velocity[1] - current[1]) * s;
    next.anchored = input.anchor && (next.anchored || m.hypot(...next.velocity) <= 0.7);
    next.steer = approach(next.steer, m.clamp(input.steering, -1, 1), h * 1.5);
    if (next.anchored) {
      next.velocity = [0, 0];
      next.yawRate = 0;
    } else {
      const thrust = throttle * spec.thrust * (throttle < 0 ? 0.45 : 1);
      const limit = u < 0 ? spec.reverseSpeed : spec.maxSpeed;
      const drag = ((u < 0 ? 0.45 : 1) * spec.thrust) / (limit * limit);
      const acceleration = (thrust - drag * u * m.abs(u)) / spec.mass;
      // Propeller wash gives a little low-speed authority, but the rudder cannot spin a stopped hull.
      const authority = m.clamp(u / m.max(2, spec.maxSpeed * 0.35) + throttle * 0.12, -1, 1);
      const targetTurn = -next.steer * spec.turnRate * authority;
      next.yawRate += (targetTurn - next.yawRate) * m.min(1, h / spec.turnResponse);
      next.velocity[0] += (acceleration * s - v * spec.lateralDrag * c) * h;
      next.velocity[1] += (acceleration * c + v * spec.lateralDrag * s) * h;
    }
    const yaw = next.yaw + next.yawRate * h;
    const candidate: [number, number, number] = [
      pos[0] + next.velocity[0] * h,
      pos[1],
      pos[2] + next.velocity[1] * h,
    ];
    const ahead = boatSupport(env, candidate[0], candidate[2], yaw, spec);
    if (!ahead.sample || env.canOccupy?.(candidate, yaw, spec, id) === false) {
      next.waitingForWater = ahead.waiting;
      next.grounded = ahead.grounded;
      next.velocity = [0, 0];
      next.yawRate = 0;
    } else {
      pos[0] = candidate[0];
      pos[2] = candidate[2];
      next.yaw = yaw;
    }
    const time = (env.time ?? 0) + (i + 1) * h;
    const swell = sampleWaves(conditions, pos[0], pos[2], time);
    const targetY = support.sample.height + swell.height;
    const omega = m.TAU * spec.buoyancyFrequency;
    next.vy += ((targetY - pos[1]) * omega * omega - 1.7 * omega * next.vy) * h;
    pos[1] += next.vy * h;
    // A finite hull averages swells across its length and beam, avoiding cork-like large ships.
    const sy = m.sin(next.yaw),
      cy = m.cos(next.yaw);
    const heightAt = (side: number, forward: number): number =>
      sampleWaves(
        conditions,
        pos[0] + side * cy + forward * sy,
        pos[2] - side * sy + forward * cy,
        time,
      ).height;
    const pitch = -m.atan2(
      heightAt(0, spec.length / 2) - heightAt(0, -spec.length / 2),
      spec.length,
    );
    const roll = m.atan2(heightAt(spec.width / 2, 0) - heightAt(-spec.width / 2, 0), spec.width);
    next.pitch += (pitch - next.pitch) * m.min(1, h * omega);
    next.roll +=
      (roll - m.clamp(next.yawRate * u * 0.012, -0.18, 0.18) - next.roll) * m.min(1, h * omega);
    next.speed = (next.velocity[0] - current[0]) * sy + (next.velocity[1] - current[1]) * cy;
    next.lateralSpeed = (next.velocity[0] - current[0]) * cy - (next.velocity[1] - current[1]) * sy;
    if (next.anchored) {
      next.speed = 0;
      next.lateralSpeed = 0;
    }
  }
  return {
    transform: { ...t, pos, rot: vehicleRotation(next.yaw, next.pitch, next.roll) },
    state: next,
  };
}
export function driveBoat(world: World, actor: string, input: BoatInputData): boolean {
  const mounted = world.get(actor, Mounted);
  if (
    !mounted ||
    !world.has(mounted.vehicle, Boat) ||
    !Number.isFinite(input.throttle) ||
    !Number.isFinite(input.steering)
  )
    return false;
  if (
    world.get(mounted.vehicle, Mountable)?.seats.find((s) => s.id === mounted.seat)?.role !==
    'driver'
  )
    return false;
  world.set(mounted.vehicle, BoatInput, {
    throttle: m.clamp(input.throttle, -1, 1),
    steering: m.clamp(input.steering, -1, 1),
    anchor: input.anchor,
  });
  return true;
}
export function installBoats(world: World, env: BoatEnvironment): void {
  world.addSystem(
    (w, ctx) => {
      const conditions = env.conditions ?? w.query(Water).first()?.[1];
      const current = { ...env, time: ctx.tick * ctx.dt, ...(conditions ? { conditions } : {}) };
      const driven = new Set<string>();
      for (const [, mounted] of w.query(Mounted))
        if (
          w.get(mounted.vehicle, Mountable)?.seats.find((s) => s.id === mounted.seat)?.role ===
          'driver'
        )
          driven.add(mounted.vehicle);
      for (const [id, t, boat] of w.query(Transform, Boat).without({ name: 'ambientAgent' })) {
        const [qx, qy, qz, qw] = t.rot;
        const state =
          w.get(id, BoatState) ??
          initialBoatState(m.atan2(2 * (qx * qz + qw * qy), 1 - 2 * (qx * qx + qy * qy)));
        const input = driven.has(id) ? (w.get(id, BoatInput) ?? IDLE_BOAT_INPUT) : IDLE_BOAT_INPUT;
        const result = stepBoat(t, state, input, boat.spec, ctx.dt, current, id);
        w.set(id, Transform, result.transform);
        w.set(id, BoatState, result.state);
      }
    },
    { phase: 'physics', name: 'boats' },
  );
  installMountedSeats(world);
}
