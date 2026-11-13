import {
  type ActuatorInputs,
  type ActuatorPositions,
  type AircraftCollisionProbe,
  type AircraftContact,
  type AircraftStateData,
  type BoatStateData,
  boostSpeedMultiplier,
  type JsonObject,
  resolveWeather,
  snowCoverAt,
  type VehicleDamageState,
  type VehicleData,
  type VehicleSpec,
  type WeatherData,
} from '@bendyline/molen-schema';
import { actuatorsSettled, stepActuators } from './actuators';

export { actuatorsSettled, stepActuators } from './actuators';

import { stepPartDebris } from './aircraft-collision';
import { isBoostMode } from './boost';
import {
  resolveVehiclePartContacts,
  vehiclePartAuthority,
  vehiclePartProbes,
} from './vehicle-damage';

export { vehiclePartProbes } from './vehicle-damage';

import { type ComponentType, defineComponent, Transform, type TransformData } from './component';
import { dmath as m } from './dmath';
import { applyGlassCrash, type GlassCrashLoad, installGlass } from './glass';
import { approach, yawOf } from './math3d';
import {
  type ConsistCar,
  Coupled,
  consistsOf,
  railTrackState,
  refreshTrailHeights,
  stepRailVehicle,
  type TrackGuide,
  type VehicleTrackState,
} from './rail-vehicles';

export {
  type ConsistCar,
  Coupled,
  type CoupledData,
  carOnTrail,
  consistOffsets,
  consistTrailLength,
  railTrackState,
  stepRailVehicle,
  TRAIL_STEP,
  type TrackAdvance,
  type TrackGuide,
  type TrackPose,
  type TrackRoute,
  trailAt,
  trailLength,
  type VehicleTrackState,
} from './rail-vehicles';
export { type TrackLineInput, TrackNetwork, type TrackNetworkPose } from './track-network';

import { groundFieldOf } from './terrain';
import { type PowertrainState, stepPowertrain } from './vehicle-powertrain';

export {
  engineTorqueCurve,
  type PowertrainState,
  powertrainWheelForce,
  stepPowertrain,
} from './vehicle-powertrain';

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
export interface VehicleStateData extends VehicleDamageState {
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
  /**
   * Bicycle crank angle; holds while coasting or braking. On a push-powered cycle, the phase of
   * the current push.
   */
  pedalAngle?: number;
  /** Push-powered cycles: 0 riding sideways to 1 turned forward to push off. */
  kick?: number;
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
  /** With a powertrain: the selected gear, -1 reverse and 1 upward the forward gears. */
  gear?: number;
  /** With a powertrain: engine speed in rev/min. */
  rpm?: number;
  /** With a powertrain: 0–1 share of the engine's torque being delivered. */
  engineLoad?: number;
  /** With a powertrain: seconds until the gearbox may change gear again. */
  shift?: number;
  /** 0–1: how hard traction or stability control is intervening. */
  assist?: number;
  /** Grip of the surface under the wheels relative to dry pavement, when the host reports one. */
  surfaceGrip?: number;
  /** Meters of lying snow under the vehicle; absent on bare ground. */
  snowDepth?: number;
  /** Deep snow is holding the vehicle against its own drive. */
  stuck?: boolean;
  /** Track-guided vehicles: the rails under it and the route chosen at the next switch. */
  track?: VehicleTrackState;
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
/** Repair a stopped road vehicle in place, restoring part geometry and clearing its debris. */
export function repairVehicle(world: World, id: string): boolean {
  const state = world.get(id, VehicleState);
  if (!state?.damage || !state.grounded || m.hypot(state.speed, state.lateralSpeed ?? 0) > 0.5)
    return false;
  const repaired = { ...state };
  delete repaired.damage;
  delete repaired.debris;
  world.set(id, VehicleState, repaired);
  return true;
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
/** Share of lying snow left on a paved road: ploughed, then packed down by traffic. */
const PLOUGHED = 0.3;
/** What the wheels roll on, relative to dry pavement. */
export interface VehicleSurface {
  /** Tire friction as a share of the grip on dry pavement. */
  grip: number;
  /** Extra rolling resistance in m/s²: soft ground drags at the wheels. */
  drag: number;
  /** 0–1 unevenness: shakes the body on its springs as the car moves. */
  roughness: number;
  /**
   * Share of the weather's lying snow left on this surface: 1 on open ground (the default), less
   * on a road that is ploughed and packed down by traffic.
   */
  snow?: number;
}
/**
 * Stock surfaces by the names map data uses for roads and land cover. Pavement is the baseline;
 * loose and soft ground grips less, drags more and is rougher.
 */
export const VEHICLE_SURFACES: Readonly<Record<string, VehicleSurface>> = {
  asphalt: { grip: 1, drag: 0, roughness: 0, snow: PLOUGHED },
  concrete: { grip: 1, drag: 0, roughness: 0, snow: PLOUGHED },
  paved: { grip: 1, drag: 0, roughness: 0, snow: PLOUGHED },
  metal: { grip: 0.75, drag: 0, roughness: 0.1, snow: PLOUGHED },
  wood: { grip: 0.85, drag: 0.05, roughness: 0.2, snow: PLOUGHED },
  stone: { grip: 0.9, drag: 0.05, roughness: 0.35, snow: PLOUGHED },
  gravel: { grip: 0.62, drag: 0.35, roughness: 0.45 },
  dirt: { grip: 0.68, drag: 0.3, roughness: 0.5 },
  grass: { grip: 0.55, drag: 0.6, roughness: 0.6 },
  leaves: { grip: 0.5, drag: 0.7, roughness: 0.75 },
  sand: { grip: 0.5, drag: 1.6, roughness: 0.4 },
  mud: { grip: 0.42, drag: 1.4, roughness: 0.55 },
  snow: { grip: 0.35, drag: 0.6, roughness: 0.3 },
};
/** The stock surface for a map surface name; undefined (pavement) for names it does not know. */
export function vehicleSurface(kind: string | undefined): VehicleSurface | undefined {
  return kind !== undefined && Object.hasOwn(VEHICLE_SURFACES, kind)
    ? VEHICLE_SURFACES[kind]
    : undefined;
}
/** Host collision adapter. All positions are absolute metric coordinates. */
export interface VehicleEnvironment {
  /**
   * The surface under X/Z (at the vehicle's height `y`): grip, drag and roughness relative to
   * dry pavement. Undefined, or no callback, is pavement. Asked once per step for a moving car.
   */
  surface?(x: number, z: number, y?: number): VehicleSurface | undefined;
  /** Optional detailed contacts for independent wheels and panels, in world coordinates. */
  contacts?(probes: readonly AircraftCollisionProbe[], entity: string): readonly AircraftContact[];
  /** Override the world's boost mode (pure step calls default to false). */
  boostMode?: boolean;
  /** Surface under X/Z. `y` is the vehicle's height: stacked decks are told apart by it. */
  groundHeight(x: number, z: number, y?: number): number | undefined;
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
  /**
   * Track network for vehicles with `spec.rail`: they follow it (and their coupled cars follow
   * them). Without one a rail vehicle drives straight with locked steering.
   */
  track?: TrackGuide;
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
/** Depth in meters by which lying snow drags at a wheel as much as packed snow ever does. */
const SNOW_PACKED_DEPTH = 0.05;
/**
 * Rolling resistance of wheels of `wheelRadius` through lying snow `depth` meters deep, in m/s².
 * `packed` is the drag of a firm snow surface, reached within a few centimeters. `deep` is the
 * wheels ploughing and the floor dragging: it grows with the square of the depth against the
 * wheel's size, about 3 m/s² where the snow reaches 60% of the wheel's radius, which is past
 * what most cars can push through. `tread` (a spec's `looseSurfaceGrip`) wins back 40%.
 */
export function snowDrag(
  depth: number,
  wheelRadius: number,
  tread = 0,
): { packed: number; deep: number } {
  if (!(depth > 0)) return { packed: 0, deep: 0 };
  const sink = depth / (0.6 * wheelRadius);
  const relief = 1 - 0.4 * tread;
  return {
    packed:
      (VEHICLE_SURFACES.snow as VehicleSurface).drag * m.min(1, depth / SNOW_PACKED_DEPTH) * relief,
    deep: 3 * sink * sink * relief,
  };
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
 * Drop a wheel's contacts with anything it can roll onto: a touch low on the tire, under
 * `maxStepHeight` above its bottom, is ground that wheel support and the step limit already
 * resolve. A wheel sphere clears its support by a few centimeters, so lane paint, a draped
 * overlay's edge, a gentle crease in the road, or the springs' squat met it at every turn of the
 * wheel, and each horizontal impulse took the car's whole closing speed: cars stalled on open
 * road. No tire mounts a step near its axle, so the band ends at 0.6 of the wheel's radius
 * whatever the step limit: a wall, a tall step or another car still meets the wheel higher up.
 */
function withoutClimbableWheelContacts(
  contacts: readonly AircraftContact[],
  probes: readonly AircraftCollisionProbe[],
  spec: VehicleSpec,
): readonly AircraftContact[] {
  const ceilings = new Map<string, number>();
  for (const part of spec.collisionParts ?? []) {
    if (part.role !== 'frontWheel' && part.role !== 'rearWheel') continue;
    for (const probe of probes)
      if (probe.part === part.id) {
        const climbable =
          probe.center[1] - probe.radius + m.min(spec.maxStepHeight, probe.radius * 0.6);
        ceilings.set(part.id, m.min(ceilings.get(part.id) ?? Infinity, climbable));
      }
  }
  if (ceilings.size === 0) return contacts;
  return contacts.filter((contact) => {
    const ceiling = ceilings.get(contact.part);
    return ceiling === undefined || contact.point[1] > ceiling;
  });
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
          env.contacts
            ? ((Math.hypot(state.speed, state.lateralSpeed ?? 0) / previousTravel) * travel) /
                (spec.collisionParts ?? []).reduce(
                  (radius, part) => m.min(radius, part.radius),
                  0.3,
                )
            : 0,
        ),
    ),
  );
  const h = dt / steps;
  const g = 9.81;
  const baseMass = spec.mass;
  const wheelbase = spec.wheelbase;
  // Center of mass to the front and rear axles.
  const front = wheelbase / 2 - spec.centerOfMass[2];
  const rear = wheelbase / 2 + spec.centerOfMass[2];
  const baseInertia = spec.yawInertia ?? (baseMass * (spec.length ** 2 + spec.width ** 2)) / 12;
  // The ground under the car: loose or soft surfaces grip less and drag at the wheels, and
  // off-road tires win back half of what they take.
  const surface = env.surface?.(pos[0], pos[2], pos[1]);
  const tread = spec.looseSurfaceGrip ?? 0;
  let surfaceGrip = surface ? surface.grip + m.max(0, 1 - surface.grip) * 0.5 * tread : 1;
  let surfaceDrag = surface ? surface.drag * (1 - 0.4 * tread) : 0;
  let roughness = surface?.roughness ?? 0;
  let weather = weatherGrip(env.weather);
  // The weather's lying snow at this height. Tires grip it poorly and sink into it: within a
  // few centimeters it drags like any soft ground, and deeper it ploughs up against the wheels
  // and the floor until the car cannot pull away. Runners are made for it.
  const lying = snowCoverAt(env.weather?.snowCover, pos[1]);
  const runners = spec.runners;
  let snowDepth = 0;
  if (runners) {
    // Edges and paddles bite snow as tires bite pavement, falling snow or not, and float over
    // any depth; off the snow they scrape.
    const cover = lying.coverage;
    surfaceGrip += (1 - surfaceGrip) * cover;
    weather += (1 - weather) * cover;
    surfaceDrag =
      (surfaceDrag + (runners.bareDrag ?? 3)) * (1 - cover) + runners.friction * g * cover;
    roughness *= 1 - cover;
    snowDepth = lying.depth;
  } else if (lying.coverage > 0) {
    const cover = lying.coverage;
    const snow = VEHICLE_SURFACES.snow as VehicleSurface;
    snowDepth = lying.depth * (surface?.snow ?? 1);
    const snowGrip = snow.grip + (1 - snow.grip) * 0.5 * tread;
    surfaceGrip += (m.min(surfaceGrip, snowGrip) - surfaceGrip) * cover;
    const drag = snowDrag(snowDepth, spec.wheelRadius, tread);
    surfaceDrag = surfaceDrag * (1 - cover) + drag.packed + drag.deep;
    roughness += (snow.roughness - roughness) * cover;
    // Snow falling onto snow costs little more: the cover already set the grip.
    weather += (m.max(weather, 0.85) - weather) * cover;
  }
  // Runners meet Coulomb friction: it holds them on a slope too gentle to beat it and lets go
  // on a steeper one. Tires roll, so their resistance fades toward a stand.
  const stiction = runners ? 0.05 : 0.5;
  let stuck = false;
  // A cycle balances on its tire line, so only the slope along it counts. Runners lie on the
  // snow: skis and a board also take the slope across them, measured over their own width.
  const tireLine = spec.cycle !== undefined && runners === undefined;
  const span = spec.cycle ? spec.width : spec.wheelTrack;
  // A pair of skis stays flat on the snow through a turn; the lean is the rider's alone.
  const banks = runners?.flat === true ? 0 : 1;
  const road = weather * surfaceGrip;
  const friction = (spec.grip / g) * road;
  const frictionRear = ((spec.rearGrip ?? spec.grip) / g) * road;
  const stiffness = spec.corneringStiffness ?? 18;
  // Slip angle at which a tire's side force peaks.
  const peakFront = (TIRE_PEAK * TIRE_SHAPE * friction) / stiffness;
  const peakRear = (TIRE_PEAK * TIRE_SHAPE * frictionRear) / stiffness;
  const car = spec.cycle === undefined;
  const sensitivity = car ? (spec.tireLoadSensitivity ?? 0.25) : 0;
  const rollBalance = spec.rollBalance ?? 0.6;
  const tractionControl = spec.tractionControl ?? car;
  const stabilityControl = (spec.stabilityControl ?? true) && car;
  // Traction control also brakes a spinning wheel, which works like a limited-slip differential.
  const lockedShare = m.max(spec.limitedSlip ?? 0, tractionControl && car ? 0.5 : 0);
  const powertrain = spec.powertrain;
  let engine: PowertrainState | undefined = powertrain
    ? {
        gear: state.gear ?? 1,
        rpm: state.rpm ?? powertrain.idle ?? (powertrain.curve === 'electric' ? 0 : 800),
        engineLoad: state.engineLoad ?? 0,
        shift: state.shift ?? 0,
      }
    : undefined;
  let assist = 0;
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
    const remainingMass = m.max(
      0.2,
      1 -
        (spec.collisionParts ?? []).reduce(
          (sum, part) => sum + (next.damage?.[part.id]?.detached ? part.massFraction : 0),
          0,
        ),
    );
    const mass = baseMass * remainingMass;
    const weight = mass * g;
    const inertia = baseInertia * remainingMass;
    const frontHealth = vehiclePartAuthority(spec, next, 'frontWheel');
    const rearHealth = vehiclePartAuthority(spec, next, 'rearWheel');
    // Lock and steering speed both fade with road speed, as a driver's hands do, and full lock
    // asks for at most half again the cornering the tires can give at this speed.
    const fade = 1 + m.abs(u) / spec.steeringFadeSpeed;
    // A balanced cycle cannot ask for a tighter turn than its lean can support (a = g tan θ).
    // Tire friction may impose a lower limit, particularly in wet or snowy weather. A car's
    // lock is the angle that turns it as hard as its tires can corner.
    const corneringLimit = spec.cycle
      ? m.min(1.5 * friction * g, g * m.tan(spec.cycle.maxLean))
      : friction * g;
    const lock = m.min(
      spec.maxSteer / fade,
      m.atan((corneringLimit * wheelbase) / m.max(u * u, 1)),
    );
    const speedNow = m.hypot(u, v);
    if (car && spec.maxSteer > 0) {
      // The driver's hands follow the front tires. A car that runs wide needs more lock than
      // the turn alone: up to the slip angle where its front tires have all but their last
      // percent of grip, and no more (extra lock only slides them, and a tire at its very peak
      // no longer damps the car's yaw). When the car slides, the tires pull the wheel toward
      // the way it is traveling: let go and it countersteers by itself, as caster does.
      // Holding the wheel straight, the tires still grip up to a third of their peak.
      const want = m.clamp(input.steering, -1, 1);
      const most = 0.75 * peakFront;
      const full = m.min(spec.maxSteer / fade, lock + most);
      const steering = want * full * frontHealth;
      const rest = 0.35 * peakFront;
      // Below a jogging pace the wheels simply point where they are turned.
      const slack = (1 - m.clamp((speedNow - 4) / 6, 0, 1)) * 2 * spec.maxSteer;
      // Wheel angle at which the front tires roll without slipping.
      const align = -m.atan2((v + front * r) * (u < 0 ? -1 : 1), m.max(m.abs(u), 3));
      const right = rest + (want > 0 ? (most - rest) * want : 0) + slack;
      const left = rest + (want < 0 ? (most - rest) * -want : 0) + slack;
      const held = m.clamp(
        m.clamp(steering, align - left, align + right),
        -spec.maxSteer,
        spec.maxSteer,
      );
      // Turning in takes the same time at any speed, half as long again on a highway as
      // parking, and the wheel centers twice as fast. Past the lock the turn needs, the driver winds
      // on the rest slowly, feeling for grip. A sliding tire snaps the wheel round by itself.
      const lockTime = (spec.maxSteer / spec.steeringRate) * (1 + 0.5 * m.min(1, m.abs(u) / 20));
      const away = held - next.steer;
      const rate =
        held !== steering && m.abs(align) > peakFront
          ? spec.steeringRate
          : m.abs(held) < m.abs(next.steer) || held * next.steer < 0
            ? m.max((2 * lock) / lockTime, m.abs(away) / 0.3)
            : m.abs(next.steer) < lock
              ? lock / lockTime
              : most / 1.2;
      next.steer = approach(next.steer, held, h * rate);
    } else
      next.steer = approach(
        next.steer,
        m.clamp(input.steering, -1, 1) * lock * frontHealth,
        (h * spec.steeringRate) / fade,
      );
    const delta = next.steer;
    const opposing = throttle * u < -0.1;
    const braking = input.brake || opposing || (spec.cycle !== undefined && throttle < 0);
    // The moving air around the body: drag, lift and crosswind are relative to it.
    const sx = m.sin(next.yaw);
    const cz = m.cos(next.yaw);
    const wind = field
      ? field.at([pos[0], pos[1] + 1, pos[2]], (env.time ?? 0) + step * h, pos[1])
      : undefined;
    const airForward = u - (wind ? (wind[0] * sx + wind[2] * cz) / travel : 0);
    const airLeft = v - (wind ? (wind[0] * cz - wind[2] * sx) / travel : 0);
    const air = m.hypot(airForward, airLeft);
    // Tire and air forces in the body frame (forward, left), and the yaw moment (left positive).
    let fx = 0;
    let fy = 0;
    let moment = 0;
    skid = 0;
    let spinning = false;
    // The engine turns with the wheels in flight too, so the gearbox steps either way.
    let drive = 0;
    if (engine && powertrain) {
      const direction =
        throttle > 0 ? (u < -0.1 ? -1 : 1) : throttle < 0 ? (u > 0.1 ? 1 : -1) : engine.gear;
      const governed =
        (direction > 0 && u >= spec.maxSpeed) || (direction < 0 && u <= -spec.reverseSpeed);
      const result = stepPowertrain(
        powertrain,
        spec.wheelRadius,
        engine,
        u,
        braking || governed ? 0 : m.abs(throttle),
        direction,
        h,
        mass,
      );
      engine = result.state;
      drive = result.force * vehiclePartAuthority(spec, next, 'engine');
    } else if (
      !braking &&
      !(throttle > 0 && u >= (runners?.pushSpeed ?? spec.maxSpeed)) &&
      !(throttle < 0 && u <= -spec.reverseSpeed)
    )
      drive = throttle * spec.engineForce * vehiclePartAuthority(spec, next, 'engine');
    // What the tires or runners push with along the vehicle, before any resistance.
    let propel = 0;
    if (next.grounded) {
      // Weight shifts through the springs: the body's dive or squat says how much moved forward
      // and its roll how much moved to the outside wheels. Lift at speed takes some off both.
      const height = spec.centerOfMass[1];
      const lift = mass * (spec.aerodynamicLift ?? 0) * airForward * airForward;
      const loadAx = pitchPerG > 0 ? (-bodyPitch / pitchPerG) * g : 0;
      const transfer = (-mass * loadAx * height) / wheelbase;
      const loadFront = m.max(0.05 * weight, (weight * rear) / wheelbase + transfer - lift / 2);
      const loadRear = m.max(0.05 * weight, (weight * front) / wheelbase - transfer - lift / 2);
      let shiftFront = 0;
      let shiftRear = 0;
      if (car && rollPerG > 0 && spec.wheelTrack > 0) {
        // Each axle takes the share its roll stiffness gives it; a lifted inside wheel hands
        // the rest to the other axle.
        const total = m.abs((mass * (bodyRoll / rollPerG) * g * height) / spec.wheelTrack);
        shiftFront = m.min(total * rollBalance, loadFront / 2);
        shiftRear = m.min(total - shiftFront, loadRear / 2);
        shiftFront = m.min(total - shiftRear, loadFront / 2);
      }
      // A tire's friction falls as its load rises, so two unevenly loaded tires grip less
      // than two evenly loaded ones: the heavier and the stiffer-sprung axle slides first.
      const quarter = weight / 4;
      const gripLoad = (wheel: number): number =>
        wheel * m.clamp(1 - sensitivity * (wheel / quarter - 1), 0.55, 1.25);
      const frontInner = gripLoad(loadFront / 2 - shiftFront);
      const gripFront = gripLoad(loadFront / 2 + shiftFront) + frontInner;
      const rearInner = gripLoad(loadRear / 2 - shiftRear);
      const gripRear = gripLoad(loadRear / 2 + shiftRear) + rearInner;
      // Slip angles, from how each axle moves over the road; the front in its steered frame.
      const frontLateral = v + front * r;
      const rolling = u * m.cos(delta) - frontLateral * m.sin(delta);
      const sliding = frontLateral * m.cos(delta) + u * m.sin(delta);
      const slipFront = m.atan2(sliding, m.max(m.abs(rolling), 3));
      const rearLateral = v - rear * r;
      const slipRear = m.atan2(rearLateral, m.max(m.abs(u), 3));
      const useFront = m.min(1, m.abs(slipFront) / peakFront);
      const useRear = m.min(1, m.abs(slipRear) / peakRear);
      // Stability control: when the rear tires slide past their peak it brakes the outside
      // front wheel, which turns the car back into line, slows it and backs off the engine.
      let stability = 0;
      let stabilityBrake = 0;
      const catching =
        stabilityControl && input.handbrake !== true && u > 5
          ? m.smoothstep((m.abs(slipRear) / peakRear - 0.7) / 0.6)
          : 0;
      if (catching > 0) {
        stabilityBrake = catching * 0.9 * friction * (loadFront / 2 + shiftFront);
        stability = (m.sign(slipRear) * stabilityBrake * spec.wheelTrack) / 2;
        if (drive > 0) drive *= 1 - catching;
        assist = m.max(assist, catching);
      }
      // Side grip; tires grip about 15% harder in a straight line (a friction ellipse). The
      // wheel stability control is braking has less left for cornering.
      const limitFront = friction * gripFront * m.max(0.03, frontHealth) * (1 - 0.35 * catching);
      const limitRear = frictionRear * gripRear * m.max(0.03, rearHealth);
      const straightFront = LONGITUDINAL_GRIP * limitFront;
      const straightRear = LONGITUDINAL_GRIP * limitRear;
      // Drive reaches the road through a differential: an open one pushes no harder than its
      // unloaded inside wheel can, a locked one as hard as both together.
      const share = (inner: number, both: number): number =>
        lockedShare + ((1 - lockedShare) * 2 * inner) / m.max(both, 1e-6);
      // Drive beyond the grip spins the wheels, which then hardly hold the car sideways.
      // Traction control backs the engine off to keep the tire at its limit instead.
      const push = (force: number, traction: number, use: number): number => {
        const hold = tractionControl
          ? 0.97 * traction * m.sqrt(m.max(0.05, 1 - (0.9 * use) ** 2))
          : traction;
        if (m.abs(force) <= hold) return force;
        if (tractionControl) {
          assist = m.max(assist, m.min(1, (m.abs(force) - hold) / m.max(hold, 1)));
          return m.sign(force) * hold;
        }
        skid = 1;
        spinning = true;
        return m.sign(force) * 0.97 * traction;
      };
      const pushFront = push(
        drive * frontDrive * frontHealth,
        straightFront * share(frontInner, gripFront),
        useFront,
      );
      const pushRear = push(
        drive * (1 - frontDrive) * rearHealth,
        straightRear * share(rearInner, gripRear),
        useRear,
      );
      // Anti-lock brakes stop just short of the tire limit, leaving the front some side grip
      // to steer with. The rear brakes ease off a cornering tire (brake-force distribution), so
      // the lightly loaded tail keeps its side grip and the car stays in line while stopping.
      const brake = braking ? mass * spec.brakeDeceleration : 0;
      const brakeFront = m.min(brake * bias, 0.95 * straightFront);
      const brakeRear = m.min(
        brake * (1 - bias),
        0.95 * straightRear * m.sqrt(1 - (0.9 * useRear) ** 2),
      );
      const longFront = pushFront - brakeFront * m.clamp(rolling / stiction, -1, 1);
      const frontTire = tire(
        slipFront,
        limitFront * m.sqrt(m.max(0, 1 - (longFront / straightFront) ** 2)),
        gripFront,
        stiffness,
      );
      skid = m.max(skid, frontTire.over);
      let longRear: number;
      let sideRear: number;
      if (input.handbrake === true && m.hypot(u, rearLateral) > 0.3) {
        // Locked wheels slide: friction opposes the contact patch's motion.
        const scale = (0.85 * limitRear) / m.max(m.hypot(u, rearLateral), 0.5);
        longRear = -u * scale;
        sideRear = -rearLateral * scale;
        skid = 1;
      } else {
        longRear = pushRear - brakeRear * m.clamp(u / stiction, -1, 1);
        const rearTire = tire(
          slipRear,
          limitRear * m.sqrt(m.max(0, 1 - (longRear / straightRear) ** 2)),
          gripRear,
          stiffness,
        );
        sideRear = rearTire.force;
        skid = m.max(skid, rearTire.over);
      }
      const frontForward = longFront * m.cos(delta) + frontTire.force * m.sin(delta);
      const frontLeft = -longFront * m.sin(delta) + frontTire.force * m.cos(delta);
      propel = frontForward + longRear;
      fx =
        propel -
        (mass * (spec.rollingResistance + surfaceDrag + (2 - frontHealth - rearHealth) * 1.5) +
          stabilityBrake) *
          m.clamp(u / stiction, -1, 1);
      fy = frontLeft + sideRear;
      moment = front * frontLeft - rear * sideRear + stability;
    }
    // Wheels spinning free of the road run the engine up to its limiter.
    if (engine && powertrain && spinning)
      engine.rpm = approach(
        engine.rpm,
        0.96 * (powertrain.redline ?? powertrain.peakPowerRpm * 1.1),
        h * 9000,
      );
    // Air drag and crosswind. The side force acts ahead of the center of mass, so a gust
    // also turns the nose downwind.
    const sideForce = mass * spec.aerodynamicResistance * side * air * airLeft;
    fx -= mass * spec.aerodynamicResistance * air * airForward;
    fy -= sideForce;
    if (car) moment -= sideForce * 0.1 * wheelbase;
    const feltForward = fx / mass;
    const feltLeft = next.grounded ? fy / mass : 0;
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
      const pull = m.min(1, crawl * 20 * h) * m.min(frontHealth, rearHealth);
      r += ((-u * m.tan(delta)) / wheelbase - r) * pull;
      v -= v * pull;
    }
    if (braking && m.abs(u) < spec.brakeDeceleration * h * 2) {
      u = 0;
      if (input.brake && m.abs(v) < 0.5) v = 0;
      if (input.brake && m.abs(r) < 0.05) r = 0;
    }
    // A car at rest with no throttle holds itself. Runners hold only where friction beats the
    // slope (static friction a little above sliding): otherwise gravity starts them.
    const resistance = spec.rollingResistance + surfaceDrag;
    const slides = runners !== undefined && m.abs(slopeForward) > 1.2 * resistance;
    if (
      !braking &&
      throttle === 0 &&
      !slides &&
      m.abs(u) < 0.05 &&
      m.abs(v) < 0.05 &&
      m.abs(r) < 0.01
    ) {
      u = 0;
      v = 0;
      r = 0;
    }
    // Deep snow holds a car that cannot push through it: at a crawl, what the tires and the
    // slope give has to beat the whole of the snow's drag, or the car stays where it is.
    if (
      snowDepth > 0 &&
      runners === undefined &&
      next.grounded &&
      m.abs(u) < 0.6 &&
      m.abs(propel / mass + slopeForward) <= resistance
    ) {
      u = 0;
      v = 0;
      r = 0;
      stuck = !braking && throttle !== 0;
    }
    u = m.clamp(u, -spec.reverseSpeed, spec.maxSpeed);
    // The sprung body leans against the acceleration it feels: it dives under braking, squats
    // under power and rolls out of a turn, then settles on its springs.
    // Rough ground works the springs: undulations five to fifteen meters long, which a car
    // at a town pace meets about as fast as its body bounces.
    const bump = next.grounded ? roughness * m.min(1, speedNow / 8) : 0;
    const ripple = pos[0] * 1.9 + pos[2] * 2.3;
    const pitchTarget =
      (-pitchPerG * feltForward) / g +
      (bump > 0 ? 0.008 * bump * (m.sin(ripple * 0.22) + m.sin(ripple * 0.47 + 1.7)) : 0);
    bodyPitchRate += (omega * omega * (pitchTarget - bodyPitch) - damping * bodyPitchRate) * h;
    const rollTarget = spec.cycle
      ? m.clamp(-m.atan2(u * r, g), -spec.cycle.maxLean, spec.cycle.maxLean)
      : (rollPerG * feltLeft) / g +
        (bump > 0 ? 0.01 * bump * (m.sin(ripple * 0.17 + 0.6) + m.sin(ripple * 0.39 + 4.1)) : 0);
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
      for (const x of tireLine ? [0] : [-span / 2, span / 2]) {
        const ground = env.groundHeight(
          candidate[0] + fc * x + fs * z,
          candidate[2] - fs * x + fc * z,
          pos[1],
        );
        if (ground === undefined || !Number.isFinite(ground)) break;
        heights.push(ground);
      }
    }
    if (heights.length !== (tireLine ? 2 : 4)) {
      u = 0;
      v = 0;
      r = 0;
      next.vy = 0;
      next.waitingForTerrain = true;
      break;
    }
    const [fl, fr, rl, rr] = (
      tireLine ? [heights[0], heights[0], heights[1], heights[1]] : heights
    ) as [number, number, number, number];
    const support = (fl + fr + rl + rr) / 4;
    const pitch = m.atan2((rl + rr - fl - fr) / 2, spec.wheelbase);
    const roll = tireLine ? 0 : m.atan2((fr + rr - fl - rl) / 2, span);
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
      if (!wasGrounded && next.vy < -2 && spec.collisionParts) {
        const landingPose: TransformData = {
          pos: candidate,
          rot: vehicleRotation(yaw, pitch, roll),
        };
        const probes = vehiclePartProbes(landingPose, spec, next);
        resolveVehiclePartContacts(
          landingPose,
          next,
          spec,
          probes
            .filter((probe) =>
              spec.collisionParts?.some(
                (part) =>
                  part.id === probe.part &&
                  (part.role === 'frontWheel' || part.role === 'rearWheel'),
              ),
            )
            .map((probe) => ({
              part: probe.part,
              point: probe.center,
              normal: [0, 1, 0],
              depth: 0,
            })),
          { velocity: [fs * u + fc * v, next.vy, fc * u - fs * v], yawRate: r },
          travel,
        );
      }
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
    if (spec.collisionParts) {
      stepPartDebris(next, spec.collisionParts, env, id, h);
      if (env.contacts) {
        const partPose: TransformData = {
          pos: candidate,
          rot: vehicleRotation(yaw, pitch + bodyPitch, roll + bodyRoll * banks),
        };
        const motion = {
          velocity: [fs * u + fc * v, next.vy, fc * u - fs * v] as [number, number, number],
          yawRate: r,
        };
        const probes = vehiclePartProbes(partPose, spec, next);
        const contacts = withoutClimbableWheelContacts(env.contacts(probes, id), probes, spec);
        const partImpact = resolveVehiclePartContacts(
          partPose,
          next,
          spec,
          contacts,
          motion,
          travel,
        );
        impact = m.max(impact, partImpact);
        u = motion.velocity[0] * fs + motion.velocity[2] * fc;
        v = motion.velocity[0] * fc - motion.velocity[2] * fs;
        r = motion.yawRate;
        // Overlapping panel probes can leave tiny tangential residuals while a car
        // presses against a wall. Static friction holds the resting chassis still.
        if (partImpact > 0 && m.hypot(u, v) < 0.01 && m.abs(r) < 0.01) u = v = r = 0;
      }
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
          const j = (-(1 + restitution) * closing) / (1 / mass + (arm * arm) / inertia);
          vx += (j * nx) / mass;
          vz += (j * nz) / mass;
          r += (j * arm) / inertia;
          // Scraping along the obstacle.
          const tx = -nz;
          const tz = nx;
          const along = vx * tx + vz * tz;
          const scrape = m.clamp(-along * mass, -0.3 * j, 0.3 * j);
          vx += (scrape * tx) / mass;
          vz += (scrape * tz) / mass;
          impact = m.max(impact, -closing);
          // A chassis hit also loads the joints immediately beside the contact patch.
          // The hull already supplied its impulse; do not apply it a second time.
          if (spec.collisionParts) {
            const partPose: TransformData = {
              pos: candidate,
              rot: vehicleRotation(next.yaw, next.pitch + bodyPitch, next.roll + bodyRoll * banks),
            };
            const point: [number, number, number] = [
              candidate[0] + spec.centerOfMass[0] * cy + spec.centerOfMass[2] * sy + px,
              candidate[1] + spec.centerOfMass[1],
              candidate[2] - spec.centerOfMass[0] * sy + spec.centerOfMass[2] * cy + pz,
            ];
            const nearby = vehiclePartProbes(partPose, spec, next).filter(
              (probe) =>
                m.hypot(
                  probe.center[0] - point[0],
                  probe.center[1] - point[1],
                  probe.center[2] - point[2],
                ) <=
                probe.radius + 0.5,
            );
            resolveVehiclePartContacts(
              partPose,
              next,
              spec,
              nearby.map((probe) => ({ part: probe.part, point, normal: [nx, 0, nz], depth: 0 })),
              { velocity: [beforeVx, next.vy, beforeVz], yawRate: beforeR },
              travel,
              false,
            );
          }
        }
        // Static friction cancels the small settling motion from overlapping contact patches.
        u = vx * sy + vz * cy;
        v = vx * cy - vz * sy;
        if (m.abs(u) < 0.01) u = 0;
        if (m.abs(v) < 0.01) v = 0;
        if (u === 0 && v === 0 && m.abs(r) < 0.01) r = 0;
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
    const kick = spec.cycle?.kick;
    if (kick) {
      // A push-powered rider pushes once per stride under power, no slower than a push from
      // rest takes; a push under way when the power stops finishes, then holds at zero.
      const pushing = throttle > 0 && !braking && next.grounded;
      const phase = next.pedalAngle ?? 0;
      if (pushing || phase !== 0) {
        const advanced = phase + m.max(m.max(0, u) / kick.stride, 0.9) * m.TAU * h;
        next.pedalAngle = !pushing && advanced >= m.TAU ? 0 : advanced % m.TAU;
      }
      next.kick = approach(next.kick ?? 0, pushing || next.pedalAngle !== 0 ? 1 : 0, h * 4);
    }
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
  if (engine) {
    next.gear = engine.gear;
    next.rpm = engine.rpm;
    next.engineLoad = engine.engineLoad;
    next.shift = engine.shift;
  }
  if (assist > 0 || state.assist !== undefined) next.assist = assist;
  if (surface || lying.coverage > 0) next.surfaceGrip = surfaceGrip;
  else delete next.surfaceGrip;
  if (snowDepth > 0) next.snowDepth = snowDepth;
  else delete next.snowDepth;
  if (stuck) next.stuck = true;
  else delete next.stuck;
  return {
    transform: {
      ...t,
      pos,
      rot: vehicleRotation(next.yaw, next.pitch + bodyPitch, next.roll + bodyRoll * banks),
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
    const ground = env.groundHeight(pos[0], pos[2], t.pos[1]);
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
      // Coupled rail cars ride their leader's trail; the leader's step places them.
      const consists = consistsOf(w, (id) => w.get(id, Vehicle)?.spec);
      // Ids, then components by lookup: a town's parked cars are thousands of dormant vehicles,
      // and building a query row for each one every tick only to skip it cost milliseconds a frame.
      for (const id of w.query(Transform, Vehicle, VehicleState).ids()) {
        const state = w.get(id, VehicleState);
        const vehicle = w.get(id, Vehicle);
        if (state === undefined || vehicle === undefined) continue;
        if (current.track !== undefined && w.has(id, Coupled)) continue;
        if (
          dormant.get(state) === vehicle &&
          !driven.has(id) &&
          !state.debris?.length &&
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
          !state.debris?.length &&
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
        // On the rails: already following a track, or standing on one now. A rail vehicle
        // away from every track (a practice car on an apron) drives with locked steering.
        if (
          vehicle.spec.rail !== undefined &&
          current.track !== undefined &&
          (state.track !== undefined ||
            current.track.snap(
              { x: t.pos[0], z: t.pos[2], yaw: state.yaw },
              m.max(4, vehicle.spec.width),
            ) !== undefined)
        ) {
          const track = current.track;
          stepRail(
            w,
            id,
            t,
            state,
            input,
            vehicle.spec,
            ctx.dt,
            { ...current, track },
            consists.get(id) ?? [],
          );
          continue;
        }
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

/** One rail step for a consist's leader: writes the leader and every coupled car. */
function stepRail(
  w: World,
  id: string,
  t: TransformData,
  state: VehicleStateData,
  input: VehicleInputData,
  spec: VehicleSpec,
  dt: number,
  env: VehicleEnvironment & { track: TrackGuide },
  cars: readonly ConsistCar[],
): void {
  const result = stepRailVehicle(
    t,
    state,
    input,
    spec,
    dt,
    { ...env, adhesion: 0.75 + 0.25 * weatherGrip(env.weather) },
    cars,
  );
  w.set(id, Transform, result.transform);
  w.set(id, VehicleState, {
    ...result.state,
    steer: 0,
    roll: 0,
    vy: 0,
    grounded: true,
    waitingForTerrain: result.state.waitingForTerrain,
  });
  // The leader's wheel turn this step, unwrapped across the revolution.
  let turned = result.state.wheelAngle - state.wheelAngle;
  if (turned > m.PI) turned -= m.TAU;
  else if (turned < -m.PI) turned += m.TAU;
  for (const car of result.cars) {
    const carState = w.get(car.id, VehicleState);
    const carSpec = w.get(car.id, Vehicle)?.spec;
    w.set(car.id, Transform, car.transform);
    if (carState && carSpec)
      w.set(car.id, VehicleState, {
        ...carState,
        speed: result.state.speed,
        boosted: result.state.boosted ?? false,
        yaw: car.yaw,
        pitch: car.pitch,
        roll: 0,
        grounded: true,
        waitingForTerrain: result.state.waitingForTerrain,
        wheelAngle:
          (carState.wheelAngle + turned * (spec.wheelRadius / carSpec.wheelRadius)) % m.TAU,
      });
  }
  if (result.impact >= 1.5)
    w.emit(result.impact >= 5 ? 'vehicle-impact' : 'vehicle-bump', {
      entity: id,
      speed: result.impact,
    });
}

/**
 * Put a track-guided leader and its coupled cars on the rails: snap the leader to the track
 * under it, lay its trail and stand each car at its offset. Call after spawning a consist (or
 * moving one); returns false when the environment has no track guide or no track is there.
 */
export function settleRailConsist(world: World, leader: string, env: VehicleEnvironment): boolean {
  const track = env.track;
  const t = world.get(leader, Transform);
  const state = world.get(leader, VehicleState);
  const spec = world.get(leader, Vehicle)?.spec;
  if (!track || !t || !state || !spec?.rail) return false;
  const cars = consistsOf(world, (id) => world.get(id, Vehicle)?.spec).get(leader) ?? [];
  const env2 = { track, groundHeight: env.groundHeight.bind(env) };
  const laid = railTrackState(t.pos, state.yaw, spec, cars, env2, state.track?.prefer ?? 0);
  if (!laid) return false;
  // Settle with a zero step so the leader's trucks and every car take their places.
  const settled = { ...state, speed: 0, track: laid };
  stepRail(world, leader, t, settled, IDLE_VEHICLE_INPUT, spec, 0, { ...env, track }, cars);
  return true;
}

/**
 * Read the rail heights under a consist again and stand its cars on them: map heights refine as
 * finer terrain streams in, and a trail laid on coarse heights leaves cars floating or sunk.
 * Returns whether anything moved.
 */
export function refreshRailHeights(world: World, leader: string, env: VehicleEnvironment): boolean {
  const track = env.track;
  const t = world.get(leader, Transform);
  const state = world.get(leader, VehicleState);
  const spec = world.get(leader, Vehicle)?.spec;
  if (!track || !t || !state?.track || !spec?.rail) return false;
  const trail = refreshTrailHeights(state.track.trail, {
    track,
    groundHeight: env.groundHeight.bind(env),
  });
  if (!trail) return false;
  const cars = consistsOf(world, (id) => world.get(id, Vehicle)?.spec).get(leader) ?? [];
  const refreshed = { ...state, track: { ...state.track, trail } };
  stepRail(world, leader, t, refreshed, IDLE_VEHICLE_INPUT, spec, 0, { ...env, track }, cars);
  return true;
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
