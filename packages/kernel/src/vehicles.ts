import {
  type ActuatorInputs,
  type ActuatorPositions,
  type AircraftStateData,
  type BoatStateData,
  boostSpeedMultiplier,
  type JsonObject,
  resolveWeather,
  type VehicleData,
  type VehicleSpec,
  type WeatherData,
} from '@bendyline/molen-schema';
import { actuatorsSettled, stepActuators } from './actuators';

export { actuatorsSettled, stepActuators } from './actuators';

import { isBoostMode } from './boost';
import { type ComponentType, defineComponent, Transform, type TransformData } from './component';
import { dmath as m } from './dmath';
import { applyGlassCrash, type GlassCrashLoad, installGlass } from './glass';
import { approach, yawOf } from './math3d';
import { groundFieldOf } from './terrain';
import { weatherOf } from './weather';
import { windField } from './wind';
import type { World } from './world';

export interface VehicleInputData extends JsonObject {
  actuators?: ActuatorInputs;
  throttle: number;
  steering: number;
  /** Service brakes on all wheels, anti-lock; holds the car at rest. */
  brake: boolean;
  /** Locks the rear wheels so they slide instead of rolling, for handbrake turns. */
  handbrake?: boolean;
}
export interface VehicleStateData extends JsonObject {
  actuators?: ActuatorPositions;
  /** Kernel-owned: horizontal speeds include the 4× travel boost. */
  boosted?: boolean;
  speed: number;
  steer: number;
  yaw: number;
  pitch: number;
  roll: number;
  vy: number;
  grounded: boolean;
  waitingForTerrain: boolean;
  wheelAngle: number;
  /** Bicycle crank angle; holds while coasting or braking. */
  pedalAngle?: number;
  /** Sideways speed in m/s, positive to the left: the slide. */
  lateralSpeed?: number;
  /** Yaw rate in rad/s, positive turning left. */
  yawRate?: number;
  /** Suspension pitch on top of the terrain, nose down positive, and its rate. */
  bodyPitch?: number;
  bodyPitchRate?: number;
  /** Suspension roll on top of the terrain, right side down positive, and its rate. */
  bodyRoll?: number;
  bodyRollRate?: number;
  /** 0–1: how far the tires are past their grip (sliding, wheelspin or locked wheels). */
  skid?: number;
}
export interface SeatData extends JsonObject {
  id: string;
  role: 'driver' | 'passenger';
  position: [number, number, number];
}
export interface MountableData extends JsonObject {
  seats: SeatData[];
  exits: [number, number, number][];
  entries?: [number, number, number][];
  reach: number;
}
export interface MountedData extends JsonObject {
  vehicle: string;
  seat: string;
}
export const Vehicle: ComponentType<VehicleData> = defineComponent<VehicleData>('vehicle');
export const VehicleInput: ComponentType<VehicleInputData> =
  defineComponent<VehicleInputData>('vehicleInput');
export const VehicleState: ComponentType<VehicleStateData> =
  defineComponent<VehicleStateData>('vehicleState');
export const Mountable: ComponentType<MountableData> = defineComponent<MountableData>('mountable');
export const Mounted: ComponentType<MountedData> = defineComponent<MountedData>('mounted');
export const IDLE_VEHICLE_INPUT: VehicleInputData = { throttle: 0, steering: 0, brake: true };

export function initialVehicleState(yaw = 0): VehicleStateData {
  return {
    speed: 0,
    steer: 0,
    yaw,
    pitch: 0,
    roll: 0,
    vy: 0,
    grounded: true,
    waitingForTerrain: false,
    wheelAngle: 0,
    lateralSpeed: 0,
    yawRate: 0,
    bodyPitch: 0,
    bodyPitchRate: 0,
    bodyRoll: 0,
    bodyRollRate: 0,
    skid: 0,
  };
}
export function vehicleMounts(spec: VehicleSpec): MountableData {
  return {
    seats: [{ id: 'driver', role: 'driver', position: [...spec.driverEye] }],
    exits: [
      [spec.width / 2 + 0.65, 0, spec.driverEye[2]],
      [-spec.width / 2 - 0.65, 0, spec.driverEye[2]],
      [0, 0, -spec.length / 2 - 0.8],
    ],
    reach: 3,
  };
}
/** Host collision adapter. All positions are absolute metric coordinates. */
export interface VehicleEnvironment {
  /** Override the world's boost mode (pure step calls default to false). */
  boostMode?: boolean;
  groundHeight(x: number, z: number): number | undefined;
  canOccupy?(
    position: [number, number, number],
    yaw: number,
    spec: VehicleSpec,
    entity: string,
  ): boolean;
  canExit?(position: [number, number, number], actor: string, vehicle: string): boolean;
  /** Weather for wet or snowy grip and wind; installVehicles reads the world's weather. */
  weather?: WeatherData;
  /** Simulation time in seconds at the start of the step; moves gusts. Default 0. */
  time?: number;
}
export function vehicleRotation(
  yaw: number,
  pitch = 0,
  roll = 0,
): [number, number, number, number] {
  const c1 = m.cos(pitch / 2),
    c2 = m.cos(yaw / 2),
    c3 = m.cos(roll / 2);
  const s1 = m.sin(pitch / 2),
    s2 = m.sin(yaw / 2),
    s3 = m.sin(roll / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ];
}
export function vehicleLocalPoint(
  t: TransformData,
  point: [number, number, number],
): [number, number, number] {
  const [x, y, z] = point,
    [qx, qy, qz, qw] = t.rot;
  const tx = 2 * (qy * z - qz * y),
    ty = 2 * (qz * x - qx * z),
    tz = 2 * (qx * y - qy * x);
  return [
    t.pos[0] + x + qw * tx + qy * tz - qz * ty,
    t.pos[1] + y + qw * ty + qz * tx - qx * tz,
    t.pos[2] + z + qw * tz + qx * ty - qy * tx,
  ];
}
/**
 * Friction left on the road in the weather, as a share of dry grip: a road is wet (or covered) as
 * soon as rain or snow falls, and heavier falls take more. Temperature never turns rain to ice.
 */
export function weatherGrip(weather: WeatherData | undefined): number {
  if (!weather) return 1;
  const { kind, intensity } = resolveWeather(weather).precipitation;
  if (kind === 'none') return 1;
  const amount = m.min(1, 0.3 + intensity);
  return kind === 'rain' ? 1 - 0.3 * amount : 1 - 0.6 * amount;
}

/** Straight-line tire grip relative to side grip. */
const LONGITUDINAL_GRIP = 1.15;
/** Tire curve shape: side force peaks, then falls to about 85% of the peak as the tire slides. */
const TIRE_SHAPE = 1.35;
const TIRE_PEAK = m.tan(m.PI / (2 * TIRE_SHAPE));
/**
 * Side force (opposing the slip) of a tire carrying `load` at `slip` radians, with `capacity`
 * newtons of friction left after braking or drive, and a 0–1 measure of how far past its peak.
 */
function tire(slip: number, capacity: number, load: number, stiffness: number) {
  const cap = m.max(capacity, 0.001 * load);
  const b = (stiffness * load) / (TIRE_SHAPE * cap);
  const peak = TIRE_PEAK / b;
  return {
    force: -cap * m.sin(TIRE_SHAPE * m.atan(b * slip)),
    over: m.clamp((m.abs(slip) / peak - 0.7) / 0.6, 0, 1),
  };
}

/**
 * Which way to push a blocked car out of an obstacle: the opposite of the short moves the host's
 * collision query refuses. Returns the count of refused moves (0 or 8 mean no usable normal).
 */
function contactNormal(
  env: VehicleEnvironment,
  pos: [number, number, number],
  yaw: number,
  spec: VehicleSpec,
  id: string,
  reach: number,
): { normal: [number, number]; blocked: number } {
  let nx = 0;
  let nz = 0;
  let blocked = 0;
  for (let i = 0; i < 8; i++) {
    const angle = (i * m.TAU) / 8;
    const dx = m.cos(angle);
    const dz = m.sin(angle);
    if (env.canOccupy?.([pos[0] + dx * reach, pos[1], pos[2] + dz * reach], yaw, spec, id) ?? true)
      continue;
    nx -= dx;
    nz -= dz;
    blocked++;
  }
  const length = m.hypot(nx, nz);
  return length > 1e-6
    ? { normal: [nx / length, nz / length], blocked }
    : { normal: [0, 0], blocked: blocked === 0 ? 0 : 8 };
}

/**
 * One car, substepped at 120 Hz or finer: a dynamic bicycle model. Each axle's tires turn slip
 * into side force up to the road's grip and then let go, sharing that grip with drive and brakes
 * (a friction circle), so a car can understeer, oversteer, spin its wheels or slide; a handbrake
 * locks the rear wheels. Braking and acceleration move weight between the axles, and a sprung body
 * rolls and pitches on top of the four-wheel terrain support. Rain and snow lower the grip; wind,
 * including gusts, pushes on the body. Collisions bounce and spin the car by an impulse at the
 * corner that hit. At walking pace the model blends into pure rolling geometry, so a car never
 * turns in place and parks exactly.
 */
export function stepVehicle(
  t: TransformData,
  state: VehicleStateData,
  input: VehicleInputData,
  spec: VehicleSpec,
  dt: number,
  env: VehicleEnvironment,
  id = '',
): {
  transform: TransformData;
  state: VehicleStateData;
  impact: number;
  impacts: GlassCrashLoad[];
} {
  let pos: [number, number, number] = [...t.pos];
  const next = { ...state, waitingForTerrain: false };
  if (spec.actuators)
    next.actuators = stepActuators(spec.actuators, state.actuators, input.actuators, dt);
  const travel = boostSpeedMultiplier(env.boostMode);
  const previousTravel = boostSpeedMultiplier(state.boosted);
  // Solve tire forces at normal handling speed, then scale travel and speed telemetry together.
  // Check boosted motion at least every half meter as well as at the usual 120 Hz.
  const steps = Math.max(
    1,
    Math.ceil(
      dt *
        Math.max(
          120,
          travel > 1
            ? (Math.hypot(state.speed, state.lateralSpeed ?? 0) / previousTravel) * travel * 2
            : 0,
        ),
    ),
  );
  const h = dt / steps;
  const g = 9.81;
  const weight = spec.mass * g;
  const wheelbase = spec.wheelbase;
  // Center of mass to the front and rear axles.
  const front = wheelbase / 2 - spec.centerOfMass[2];
  const rear = wheelbase / 2 + spec.centerOfMass[2];
  const inertia = spec.yawInertia ?? (spec.mass * (spec.length ** 2 + spec.width ** 2)) / 12;
  const friction = (spec.grip / g) * weatherGrip(env.weather);
  const stiffness = spec.corneringStiffness ?? 18;
  const frontDrive = spec.drive === 'rear' ? 0 : spec.drive === 'all' ? 0.4 : 1;
  const bias = spec.brakeBias ?? 0.65;
  const rollPerG = spec.rollStiffness ?? 0.05;
  const pitchPerG = spec.pitchStiffness ?? 0.03;
  const omega = m.TAU * (spec.suspensionFrequency ?? 1.5);
  const damping = 2 * (spec.suspensionDamping ?? 0.5) * omega;
  // Side area over frontal area: crosswind pushes the long side of the body.
  const side = (1.1 * spec.length) / spec.width;
  const field = env.weather ? windField(env.weather) : undefined;
  const throttle = m.clamp(input.throttle, -1, 1);
  let u = state.speed / previousTravel;
  let v = (state.lateralSpeed ?? 0) / previousTravel;
  let r = state.yawRate ?? 0;
  let bodyPitch = state.bodyPitch ?? 0;
  let bodyPitchRate = state.bodyPitchRate ?? 0;
  let bodyRoll = state.bodyRoll ?? 0;
  let bodyRollRate = state.bodyRollRate ?? 0;
  let skid = 0;
  let impact = 0;
  const impacts: GlassCrashLoad[] = [];
  for (let step = 0; step < steps; step++) {
    // Lock and steering speed both fade with road speed, as a driver's hands do, and full lock
    // asks for at most half again the cornering the tires can give at this speed.
    const fade = 1 + m.abs(u) / spec.steeringFadeSpeed;
    // A balanced cycle cannot ask for a tighter turn than its lean can support (a = g tan θ).
    // Tire friction may impose a lower limit, particularly in wet or snowy weather.
    const corneringLimit = spec.cycle
      ? m.min(1.5 * friction * g, g * m.tan(spec.cycle.maxLean))
      : 1.5 * friction * g;
    const lock = m.min(
      spec.maxSteer / fade,
      m.atan((corneringLimit * wheelbase) / m.max(u * u, 1)),
    );
    const steering = m.clamp(input.steering, -1, 1) * lock;
    next.steer = approach(next.steer, steering, (h * spec.steeringRate) / fade);
    const delta = next.steer;
    const opposing = throttle * u < -0.1;
    const braking = input.brake || opposing || (spec.cycle !== undefined && throttle < 0);
    // Tire and air forces in the body frame (forward, left), and the yaw moment (left positive).
    let fx = 0;
    let fy = 0;
    let moment = 0;
    skid = 0;
    if (next.grounded) {
      // Weight shifts through the springs: the body's dive or squat says how much moved forward.
      const loadAx = pitchPerG > 0 ? (-bodyPitch / pitchPerG) * g : 0;
      const transfer = (-spec.mass * loadAx * spec.centerOfMass[1]) / wheelbase;
      const loadFront = m.max(0.05 * weight, (weight * rear) / wheelbase + transfer);
      const loadRear = m.max(0.05 * weight, (weight * front) / wheelbase - transfer);
      // Side grip; tires grip about 15% harder in a straight line (a friction ellipse).
      const limitFront = friction * loadFront;
      const limitRear = friction * loadRear;
      const straightFront = LONGITUDINAL_GRIP * limitFront;
      const straightRear = LONGITUDINAL_GRIP * limitRear;
      const drive =
        braking || (throttle > 0 && u >= spec.maxSpeed) || (throttle < 0 && u <= -spec.reverseSpeed)
          ? 0
          : throttle * spec.engineForce;
      // Anti-lock brakes stop just short of the tire limit, leaving it some side grip to steer.
      const brake = braking ? spec.mass * spec.brakeDeceleration : 0;
      const brakeFront = m.min(brake * bias, 0.95 * straightFront);
      const brakeRear = m.min(brake * (1 - bias), 0.95 * straightRear);
      let pushFront = drive * frontDrive;
      let pushRear = drive * (1 - frontDrive);
      // Drive beyond the grip spins the wheels.
      if (m.abs(pushFront) > straightFront) {
        pushFront = m.sign(pushFront) * straightFront;
        skid = 1;
      }
      if (m.abs(pushRear) > straightRear) {
        pushRear = m.sign(pushRear) * straightRear;
        skid = 1;
      }
      // Steered front axle, in the tire's own frame.
      const frontLateral = v + front * r;
      const rolling = u * m.cos(delta) - frontLateral * m.sin(delta);
      const sliding = frontLateral * m.cos(delta) + u * m.sin(delta);
      const longFront = pushFront - brakeFront * m.clamp(rolling / 0.5, -1, 1);
      const frontTire = tire(
        m.atan2(sliding, m.max(m.abs(rolling), 3)),
        limitFront * m.sqrt(m.max(0, 1 - (longFront / straightFront) ** 2)),
        loadFront,
        stiffness,
      );
      skid = m.max(skid, frontTire.over);
      const rearLateral = v - rear * r;
      let longRear: number;
      let sideRear: number;
      if (input.handbrake === true && m.hypot(u, rearLateral) > 0.3) {
        // Locked wheels slide: friction opposes the contact patch's motion.
        const scale = (0.85 * limitRear) / m.max(m.hypot(u, rearLateral), 0.5);
        longRear = -u * scale;
        sideRear = -rearLateral * scale;
        skid = 1;
      } else {
        longRear = pushRear - brakeRear * m.clamp(u / 0.5, -1, 1);
        const rearTire = tire(
          m.atan2(rearLateral, m.max(m.abs(u), 3)),
          limitRear * m.sqrt(m.max(0, 1 - (longRear / straightRear) ** 2)),
          loadRear,
          stiffness,
        );
        sideRear = rearTire.force;
        skid = m.max(skid, rearTire.over);
      }
      const frontForward = longFront * m.cos(delta) + frontTire.force * m.sin(delta);
      const frontLeft = -longFront * m.sin(delta) + frontTire.force * m.cos(delta);
      fx = frontForward + longRear - spec.mass * spec.rollingResistance * m.clamp(u / 0.5, -1, 1);
      fy = frontLeft + sideRear;
      moment = front * frontLeft - rear * sideRear;
    }
    // Air drag and crosswind, relative to the moving air around the body.
    const sx = m.sin(next.yaw);
    const cz = m.cos(next.yaw);
    const wind = field
      ? field.at([pos[0], pos[1] + 1, pos[2]], (env.time ?? 0) + step * h, pos[1])
      : undefined;
    const airForward = u - (wind ? (wind[0] * sx + wind[2] * cz) / travel : 0);
    const airLeft = v - (wind ? (wind[0] * cz - wind[2] * sx) / travel : 0);
    const air = m.hypot(airForward, airLeft);
    fx -= spec.mass * spec.aerodynamicResistance * air * airForward;
    fy -= spec.mass * spec.aerodynamicResistance * side * air * airLeft;
    const feltForward = fx / spec.mass;
    const feltLeft = next.grounded ? fy / spec.mass : 0;
    // Gravity along the terrain under the wheels: downhill ahead (nose down) and to the low side.
    const slopeForward = next.grounded ? g * m.sin(next.pitch) : 0;
    const slopeLeft = next.grounded ? -g * m.sin(next.roll) : 0;
    const du = (feltForward + slopeForward + r * v) * h;
    const dv = (feltLeft + slopeLeft - r * u) * h;
    r += (moment / inertia) * h;
    u += du;
    v += dv;
    // At walking pace the tires simply roll where they point.
    const crawl = m.max(0, 1 - m.hypot(u, v) / 4);
    if (crawl > 0 && next.grounded) {
      const pull = m.min(1, crawl * 20 * h);
      r += ((-u * m.tan(delta)) / wheelbase - r) * pull;
      v -= v * pull;
    }
    if (braking && m.abs(u) < spec.brakeDeceleration * h * 2) {
      u = 0;
      if (input.brake && m.abs(v) < 0.5) v = 0;
      if (input.brake && m.abs(r) < 0.05) r = 0;
    }
    if (!braking && throttle === 0 && m.abs(u) < 0.05 && m.abs(v) < 0.05 && m.abs(r) < 0.01) {
      u = 0;
      v = 0;
      r = 0;
    }
    u = m.clamp(u, -spec.reverseSpeed, spec.maxSpeed);
    // The sprung body leans against the acceleration it feels: it dives under braking, squats
    // under power and rolls out of a turn, then settles on its springs.
    bodyPitchRate +=
      (omega * omega * ((-pitchPerG * feltForward) / g - bodyPitch) - damping * bodyPitchRate) * h;
    const rollTarget = spec.cycle
      ? m.clamp(-m.atan2(u * r, g), -spec.cycle.maxLean, spec.cycle.maxLean)
      : (rollPerG * feltLeft) / g;
    bodyRollRate += (omega * omega * (rollTarget - bodyRoll) - damping * bodyRollRate) * h;
    bodyPitch += bodyPitchRate * h;
    bodyRoll += bodyRollRate * h;
    const yaw = next.yaw + r * h;
    const fs = m.sin(yaw);
    const fc = m.cos(yaw);
    const candidate: [number, number, number] = [
      pos[0] + (fs * u + fc * v) * h * travel,
      pos[1],
      pos[2] + (fc * u - fs * v) * h * travel,
    ];
    const heights: number[] = [];
    for (const z of [spec.wheelbase / 2, -spec.wheelbase / 2]) {
      for (const x of spec.cycle ? [0] : [-spec.wheelTrack / 2, spec.wheelTrack / 2]) {
        const ground = env.groundHeight(
          candidate[0] + fc * x + fs * z,
          candidate[2] - fs * x + fc * z,
        );
        if (ground === undefined || !Number.isFinite(ground)) break;
        heights.push(ground);
      }
    }
    if (heights.length !== (spec.cycle ? 2 : 4)) {
      u = 0;
      v = 0;
      r = 0;
      next.vy = 0;
      next.waitingForTerrain = true;
      break;
    }
    const [fl, fr, rl, rr] = (
      spec.cycle ? [heights[0], heights[0], heights[1], heights[1]] : heights
    ) as [number, number, number, number];
    const support = (fl + fr + rl + rr) / 4;
    const pitch = m.atan2((rl + rr - fl - fr) / 2, spec.wheelbase);
    const roll = spec.cycle ? 0 : m.atan2((fr + rr - fl - rl) / 2, spec.wheelTrack);
    // Curbs are climbable; abrupt steps and slopes above 35 degrees are barriers.
    if (
      support - pos[1] > spec.maxStepHeight ||
      m.abs(pitch) > spec.maxSlope ||
      m.abs(roll) > spec.maxSlope
    ) {
      u = 0;
      v = 0;
      r = 0;
      break;
    }
    next.vy -= 9.81 * h;
    candidate[1] += next.vy * h;
    const wasGrounded = next.grounded;
    next.grounded = candidate[1] <= support + spec.supportTolerance;
    if (next.grounded) {
      if (!wasGrounded && next.vy < 0)
        impacts.push({
          deltaVelocity: [0, -next.vy, 0],
          deltaAngularVelocity: [0, 0, 0],
          velocity: [(fs * u + fc * v) * travel, next.vy, (fc * u - fs * v) * travel],
          angularVelocity: [0, r, 0],
          centerOfMass: spec.centerOfMass,
        });
      candidate[1] = support;
      next.vy = 0;
    }
    if (env.canOccupy && !env.canOccupy(candidate, yaw, spec, id)) {
      // Stay at the last free position and answer the hit with an impulse at the corner that
      // struck: a bounce that grows with impact speed, scraping friction, and a spin.
      const reach = m.max(0.15, m.hypot(u, v) * h * travel * 2);
      const contact = contactNormal(env, pos, next.yaw, spec, id, reach);
      const sy = m.sin(next.yaw);
      const cy = m.cos(next.yaw);
      let vx = sy * u + cy * v;
      let vz = cy * u - sy * v;
      const beforeVx = vx,
        beforeVz = vz,
        beforeR = r;
      if (contact.blocked === 0) {
        // Only the turn hit: the heading stops turning into the obstacle.
        r = 0;
      } else if (contact.blocked === 8) {
        impact = m.max(impact, m.hypot(u, v));
        u = 0;
        v = 0;
        r = 0;
      } else {
        const [nx, nz] = contact.normal;
        // Corners relative to the center of mass, in world XZ; the deepest ones touch.
        const corners: [number, number][] = [];
        for (const [cl, cf] of [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ] as const) {
          const l = (cl * spec.width) / 2 - spec.centerOfMass[0];
          const f = (cf * spec.length) / 2 - spec.centerOfMass[2];
          corners.push([l * cy + f * sy, -l * sy + f * cy]);
        }
        const depth = (c: [number, number]) => -(c[0] * nx + c[1] * nz);
        const deepest = corners.reduce((best, c) => m.max(best, depth(c)), -Infinity);
        let px = 0;
        let pz = 0;
        let touching = 0;
        for (const c of corners)
          if (depth(c) > deepest - 0.3) {
            px += c[0];
            pz += c[1];
            touching++;
          }
        px /= touching;
        pz /= touching;
        // Contact point velocity includes the spin; its arm about the vertical axis.
        const arm = pz * nx - px * nz;
        const closing = vx * nx + vz * nz + r * (pz * nx - px * nz);
        if (closing < 0) {
          const restitution = m.clamp((-closing - 1) / 10, 0, 0.3);
          const j = (-(1 + restitution) * closing) / (1 / spec.mass + (arm * arm) / inertia);
          vx += (j * nx) / spec.mass;
          vz += (j * nz) / spec.mass;
          r += (j * arm) / inertia;
          // Scraping along the obstacle.
          const tx = -nz;
          const tz = nx;
          const along = vx * tx + vz * tz;
          const scrape = m.clamp(-along * spec.mass, -0.3 * j, 0.3 * j);
          vx += (scrape * tx) / spec.mass;
          vz += (scrape * tz) / spec.mass;
          impact = m.max(impact, -closing);
        }
        // Resting contact cancels exactly; drop rounding residue so the car can go dormant.
        u = vx * sy + vz * cy;
        v = vx * cy - vz * sy;
        if (m.abs(u) < 1e-9) u = 0;
        if (m.abs(v) < 1e-9) v = 0;
      }
      const dx = (sy * u + cy * v - beforeVx) * travel;
      const dz = (cy * u - sy * v - beforeVz) * travel;
      if (dx !== 0 || dz !== 0 || r !== beforeR)
        impacts.push({
          deltaVelocity: [dx, 0, dz],
          deltaAngularVelocity: [0, r - beforeR, 0],
          velocity: [beforeVx * travel, next.vy, beforeVz * travel],
          angularVelocity: [0, beforeR, 0],
          centerOfMass: spec.centerOfMass,
        });
      continue;
    }
    next.yaw = yaw;
    next.pitch = approach(next.pitch, pitch, h * spec.terrainAlignRate);
    next.roll = approach(next.roll, roll, h * spec.terrainAlignRate);
    next.wheelAngle = (next.wheelAngle + (u * h * travel) / spec.wheelRadius) % m.TAU;
    if (spec.cycle?.pedals && throttle > 0 && !braking && next.grounded)
      next.pedalAngle =
        ((next.pedalAngle ?? 0) +
          (m.max(0, u) * h) / (spec.wheelRadius * spec.cycle.pedals.ratio)) %
        m.TAU;
    pos = candidate;
  }
  next.speed = u * travel;
  next.lateralSpeed = v * travel;
  if (env.boostMode) next.boosted = true;
  else delete next.boosted;
  next.yawRate = r;
  next.bodyPitch = bodyPitch;
  next.bodyPitchRate = bodyPitchRate;
  next.bodyRoll = bodyRoll;
  next.bodyRollRate = bodyRollRate;
  next.skid = skid;
  return {
    transform: {
      ...t,
      pos,
      rot: vehicleRotation(next.yaw, next.pitch + bodyPitch, next.roll + bodyRoll),
    },
    state: next,
    impact: impact * travel,
    impacts,
  };
}
export function mountEntity(
  world: World,
  actor: string,
  vehicle: string,
  seatId = 'driver',
): boolean {
  if (
    actor === vehicle ||
    world.has(actor, Mounted) ||
    world.has(vehicle, Mounted) ||
    !mountStopped(world, vehicle)
  )
    return false;
  const t = world.get(vehicle, Transform),
    actorT = world.get(actor, Transform),
    mount = world.get(vehicle, Mountable);
  const seat = mount?.seats.find((s) => s.id === seatId);
  if (!t || !actorT || !mount || !seat || groundSpeed(world.get(vehicle, VehicleState)) > 0.7)
    return false;
  const entry = vehicleLocalPoint(t, seat.position);
  if (
    ![seat.position, ...(mount.entries ?? [])].some((point) => {
      const at = vehicleLocalPoint(t, point);
      return (
        m.hypot(actorT.pos[0] - at[0], actorT.pos[1] - at[1], actorT.pos[2] - at[2]) <= mount.reach
      );
    })
  )
    return false;
  for (const [, mounted] of world.query(Mounted))
    if (mounted.vehicle === vehicle && mounted.seat === seatId) return false;
  stopWalking(world, actor);
  world.set(actor, Mounted, { vehicle, seat: seatId });
  world.patch(actor, Transform, { pos: entry, rot: [...t.rot] });
  // Only the driver takes the controls: a passenger climbing in leaves the driver's input alone.
  if (seat.role === 'driver') {
    if (world.has(vehicle, { name: 'boat' }))
      world.set(vehicle, { name: 'boatInput' }, { throttle: 0, steering: 0, anchor: true });
    else
      world.set(vehicle, VehicleInput, {
        ...IDLE_VEHICLE_INPUT,
        ...mechanismInput(world.get(vehicle, VehicleInput)),
      });
  }
  world.emit('vehicle-mounted', { actor, vehicle, seat: seatId });
  return true;
}
/**
 * Step `actor` out of whatever it is mounted in, at the first of the vehicle's `exits` with
 * ground beside it that `env.canExit` accepts; the vehicle must be stopped (and an aircraft shut
 * down). Any seat may leave: a passenger leaving does not touch the controls, while the driver
 * leaving idles them (and shuts an aircraft's engine). Returns false when no exit works.
 */
export function unmountEntity(world: World, actor: string, env: VehicleEnvironment): boolean {
  const mounted = world.get(actor, Mounted);
  if (!mounted) return false;
  if (!mountStopped(world, mounted.vehicle)) return false;
  const t = world.get(mounted.vehicle, Transform),
    mount = world.get(mounted.vehicle, Mountable);
  if (!t || !mount || groundSpeed(world.get(mounted.vehicle, VehicleState)) > 0.7) return false;
  const driver = mount.seats.find((s) => s.id === mounted.seat)?.role !== 'passenger';
  for (const offset of mount.exits) {
    const pos = vehicleLocalPoint(t, offset);
    const ground = env.groundHeight(pos[0], pos[2]);
    if (
      ground === undefined ||
      m.abs(ground - (world.has(mounted.vehicle, { name: 'boat' }) ? pos[1] : t.pos[1])) > 0.6
    )
      continue;
    pos[1] = ground + 0.02;
    if (env.canExit && !env.canExit(pos, actor, mounted.vehicle)) continue;
    stopWalking(world, actor);
    world.remove(actor, Mounted);
    world.patch(actor, Transform, {
      pos,
      ...(world.get(mounted.vehicle, Vehicle)?.spec.cycle !== undefined ||
      world.has(mounted.vehicle, { name: 'boat' })
        ? { rot: vehicleRotation(yawOf(t.rot)) }
        : {}),
    });
    if (driver) {
      if (world.has(mounted.vehicle, { name: 'boat' }))
        world.set(
          mounted.vehicle,
          { name: 'boatInput' },
          { throttle: 0, steering: 0, anchor: true },
        );
      else
        world.set(mounted.vehicle, VehicleInput, {
          ...IDLE_VEHICLE_INPUT,
          ...mechanismInput(world.get(mounted.vehicle, VehicleInput)),
        });
      if (world.has(mounted.vehicle, { name: 'aircraftInput' }))
        world.patch(
          mounted.vehicle,
          { name: 'aircraftInput' },
          { power: 0, engine: false, brake: true, pitch: 0, roll: 0, yaw: 0 },
        );
    }
    world.emit('vehicle-unmounted', { actor, vehicle: mounted.vehicle });
    return true;
  }
  return false;
}
export function driveVehicle(world: World, actor: string, input: VehicleInputData): boolean {
  const mounted = world.get(actor, Mounted);
  if (!mounted || !world.has(mounted.vehicle, Vehicle)) return false;
  const seat = world.get(mounted.vehicle, Mountable)?.seats.find((s) => s.id === mounted.seat);
  if (
    seat?.role !== 'driver' ||
    !Number.isFinite(input.throttle) ||
    !Number.isFinite(input.steering)
  )
    return false;
  world.set(mounted.vehicle, VehicleInput, {
    throttle: m.clamp(input.throttle, -1, 1),
    steering: m.clamp(input.steering, -1, 1),
    brake: input.brake,
    ...(input.handbrake === undefined ? {} : { handbrake: input.handbrake }),
    ...mechanismInput(
      input.actuators === undefined ? world.get(mounted.vehicle, VehicleInput) : input,
    ),
  });
  return true;
}
function mechanismInput(input?: VehicleInputData): Pick<VehicleInputData, 'actuators'> {
  return input?.actuators ? { actuators: { ...input.actuators } } : {};
}
export function installVehicles(world: World, environment?: VehicleEnvironment): void {
  installGlass(world);
  const env = environment ?? {
    groundHeight: (x: number, z: number) => groundFieldOf(world)?.sampleHeight(x, z) ?? 0,
  };
  // States found dormant, with the vehicle they were judged for. Every write clones a component,
  // so a car stays skipped only until something moves or changes it; keyed by object, the map
  // holds no entity alive.
  const dormant = new WeakMap<VehicleStateData, VehicleData>();
  world.addSystem(
    (w, ctx) => {
      const driven = new Set<string>();
      for (const [, mounted] of w.query(Mounted)) {
        if (
          w
            .get(mounted.vehicle, Mountable)
            ?.seats.some((s) => s.id === mounted.seat && s.role === 'driver')
        )
          driven.add(mounted.vehicle);
      }
      const weather = env.weather ?? weatherOf(w);
      const current = {
        ...env,
        boostMode: env.boostMode ?? isBoostMode(w),
        time: ctx.tick * ctx.dt,
        ...(weather ? { weather } : {}),
      };
      // Ids, then components by lookup: a town's parked cars are thousands of dormant vehicles,
      // and building a query row for each one every tick only to skip it cost milliseconds a frame.
      for (const id of w.query(Transform, Vehicle, VehicleState).ids()) {
        const state = w.get(id, VehicleState);
        const vehicle = w.get(id, Vehicle);
        if (state === undefined || vehicle === undefined) continue;
        if (
          dormant.get(state) === vehicle &&
          !driven.has(id) &&
          actuatorsSettled(
            vehicle.spec.actuators,
            state.actuators,
            w.get(id, VehicleInput)?.actuators,
          )
        )
          continue;
        const t = w.get(id, Transform);
        if (t === undefined) continue;
        // Dormant parked vehicles cost no physics work. Their placement already includes support.
        if (
          !driven.has(id) &&
          actuatorsSettled(
            vehicle.spec.actuators,
            state.actuators,
            w.get(id, VehicleInput)?.actuators,
          ) &&
          state.speed === 0 &&
          (state.lateralSpeed ?? 0) === 0 &&
          (state.yawRate ?? 0) === 0 &&
          (vehicle.spec.cycle === undefined ||
            m.abs(state.bodyRoll ?? 0) +
              m.abs(state.bodyRollRate ?? 0) +
              m.abs(state.bodyPitch ?? 0) +
              m.abs(state.bodyPitchRate ?? 0) <
              1e-5)
        ) {
          dormant.set(state, vehicle);
          continue;
        }
        const input = driven.has(id)
          ? (w.get(id, VehicleInput) ?? IDLE_VEHICLE_INPUT)
          : {
              ...IDLE_VEHICLE_INPUT,
              ...(w.get(id, VehicleInput)?.actuators
                ? { actuators: w.get(id, VehicleInput)?.actuators }
                : {}),
            };
        const result = stepVehicle(t, state, input, vehicle.spec, ctx.dt, current, id);
        w.set(id, Transform, result.transform);
        w.set(id, VehicleState, result.state);
        for (const crash of result.impacts) applyGlassCrash(w, id, crash);
        // Sound and effects hear about real hits, not a car resting against a wall.
        if (result.impact >= 1.5)
          w.emit(result.impact >= 5 ? 'vehicle-impact' : 'vehicle-bump', {
            entity: id,
            speed: result.impact,
          });
      }
    },
    { phase: 'physics', name: 'vehicles' },
  );
  installMountedSeats(world);
}

const mountedWorlds = new WeakSet<World>();
/** Shared seat following, installed once by either vehicle capability. */
export function installMountedSeats(world: World): void {
  if (mountedWorlds.has(world)) return;
  mountedWorlds.add(world);
  world.addSystem(
    (w) => {
      for (const [actor, mounted] of w.query(Mounted)) {
        const t = w.get(mounted.vehicle, Transform);
        const seat = w.get(mounted.vehicle, Mountable)?.seats.find((s) => s.id === mounted.seat);
        if (!t || !seat) {
          w.remove(actor, Mounted);
          continue;
        }
        w.patch(actor, Transform, { pos: vehicleLocalPoint(t, seat.position), rot: [...t.rot] });
      }
    },
    { phase: 'late', name: 'mounted-seats', priority: 100 },
  );
}

/** A car's speed over the ground, including any slide. */
function groundSpeed(state: VehicleStateData | undefined): number {
  return state ? m.hypot(state.speed, state.lateralSpeed ?? 0) : 0;
}

function mountStopped(world: World, vehicle: string): boolean {
  const boat = world.get<BoatStateData>(vehicle, { name: 'boatState' });
  if (
    boat &&
    (m.hypot(...boat.velocity) > 0.7 || m.abs(boat.yawRate) > 0.1 || boat.waitingForWater)
  )
    return false;
  const state = world.get<AircraftStateData>(vehicle, { name: 'aircraftState' });
  return (
    !state ||
    (state.grounded &&
      m.hypot(...state.velocity) <= 0.7 &&
      state.rpm < 0.12 &&
      Object.values(state.engines ?? {}).every((engine) => engine.rpm < 0.12))
  );
}

function stopWalking(world: World, actor: string): void {
  const body = { name: 'kinematicBody' },
    character = { name: 'character' };
  if (world.has(actor, body)) world.patch(actor, body, { vel: [0, 0, 0] });
  if (world.has(actor, character)) world.patch(actor, character, { vy: 0, grounded: true });
}
