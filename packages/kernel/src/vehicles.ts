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
import { approach, quatNormalize, quatRotateVec3, yawOf } from './math3d';
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
import {
  type CarBody,
  type CarBodyContact,
  carBodyGroundContacts,
  carBodyInertia,
  carBodyOutline,
  resolveCarBodyContacts,
  stepCarBody,
} from './vehicle-body';
import { type PowertrainState, stepPowertrain } from './vehicle-powertrain';
import { initialWheelsState, stepWheels, type WheelsState, wheelsGeometry } from './vehicle-wheels';

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
  /** How hard the brake pedal is pressed while `brake` is true, 0..1; default 1. */
  brakePedal?: number;
  /**
   * `assisted` (the default): the steering is held to what the tires can use and countersteers
   * a slide, and the car has its traction, stability and anti-lock controls. `direct`: the
   * steering is the wheel angle and none of those act: the bare car.
   */
  controlMode?: 'assisted' | 'direct';
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
  /** With wheels on struts: the body above its ride height in meters, and its rate. */
  bodyHeave?: number;
  bodyHeaveRate?: number;
  /** With wheels on struts: wheel speeds in rad/s, front left, front right, rear left, rear right. */
  wheelSpin?: [number, number, number, number];
  /** With wheels on struts: the load on each wheel in newtons, in the same order. */
  wheelLoad?: [number, number, number, number];
  /**
   * Present while a car on four wheels is off the plane of its road: in the air, tipping over,
   * tumbling, or lying on its side or roof. Its transform is then its true pose and it moves as
   * a free rigid body until it stands on its wheels again; `pitch` and `roll` are its own
   * attitude, not the terrain's.
   */
  freeBody?: {
    /** Velocity of the center of mass in world axes, m/s (horizontal parts include a boost). */
    velocity: [number, number, number];
    /** Angular velocity about the body's left, up and forward axes, rad/s. */
    omega: [number, number, number];
    /** Seconds it has lain still off its wheels; after half a second it rests. */
    still?: number;
  };
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
/**
 * Set a stopped car that has come to rest off its wheels (on its side, its roof, or wedged)
 * back on them where it lies, facing the way it faced. Returns false for a car that is moving,
 * is on its wheels already, or has no ground under it.
 */
export function rightVehicle(world: World, id: string, env: VehicleEnvironment): boolean {
  const state = world.get(id, VehicleState);
  const t = world.get(id, Transform);
  const spec = world.get(id, Vehicle)?.spec;
  if (!state?.freeBody || !t || !spec) return false;
  if (m.hypot(...state.freeBody.velocity) > 0.7 || m.hypot(...state.freeBody.omega) > 0.5)
    return false;
  // Where its center of mass is, not where its floor has ended up.
  const center = vehicleLocalPoint(t, spec.centerOfMass);
  const yaw = state.yaw;
  const offset = vehicleLocalPoint(
    { pos: [0, 0, 0], rot: vehicleRotation(yaw) },
    spec.centerOfMass,
  );
  const x = center[0] - offset[0];
  const z = center[2] - offset[2];
  const ground = env.groundHeight(x, z, center[1]);
  if (ground === undefined || !Number.isFinite(ground)) return false;
  const righted = { ...state, ...initialVehicleState(yaw) };
  delete righted.freeBody;
  delete righted.wheelSpin;
  delete righted.wheelLoad;
  delete righted.bodyHeave;
  delete righted.bodyHeaveRate;
  world.set(id, VehicleState, righted);
  world.patch(id, Transform, { pos: [x, ground, z], rot: vehicleRotation(yaw) });
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
 * Roll or pitch on the struts, rad, past which a car with one whole side (or end) of its wheels
 * off the road is no longer a car in the road's plane: it is balancing on the other pair.
 */
const TIP_ANGLE = 0.08;

/** Transform origin of a free car body: the point under its middle at ride height. */
function bodyOrigin(body: CarBody, spec: VehicleSpec): [number, number, number] {
  const offset = quatRotateVec3(body.rot, spec.centerOfMass);
  return [body.center[0] - offset[0], body.center[1] - offset[1], body.center[2] - offset[2]];
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
 *
 * A cycle is ridden: the rider leans it by steering (out of the turn first, then into it) and
 * holds it up by steering under the lean, and the lean is a real balance between gravity and
 * the tires' side force. Leaned tires push sideways by themselves (camber thrust). Runners
 * with a sidecut carve the turn their edge angle gives.
 *
 * A car whose spec has `wheels` stands on four of them instead of two axles: see
 * vehicle-wheels.ts. Everything around the tires (steering, powertrain, air, terrain, snow,
 * collisions) is the same. Such a car is solved in the plane of its road only while it is on
 * it. Off a ledge or a crest it leaves faster than gravity follows, onto two wheels in a
 * rollover, or wherever the ground falls away too steeply to be a road, it becomes a free
 * rigid body (vehicle-body.ts, `state.freeBody`) on the same wheels, and comes back to the
 * road's plane when it stands on them again.
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
  const car = spec.cycle === undefined;
  // A cycle's rear tire is the wider and stiffer of its two, which is what keeps the tail
  // behind the front at speed.
  const stiffnessRear = car ? stiffness : 1.35 * stiffness;
  const peakRear = (TIRE_PEAK * TIRE_SHAPE * frictionRear) / stiffnessRear;
  const sensitivity = car ? (spec.tireLoadSensitivity ?? 0.25) : 0;
  const rollBalance = spec.rollBalance ?? 0.6;
  // Direct control: the bare car, with the steering wheel on the wheels and no controllers.
  const direct = input.controlMode === 'direct';
  // A rider feathers the throttle as traction control would.
  const tractionControl = (spec.tractionControl ?? true) && !direct;
  const stabilityControl = (spec.stabilityControl ?? true) && car && !direct;
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
  // The rider's balance: how high the mass sits over the tire line, and how briskly the rider
  // moves the lean (a tall, slow pendulum is leaned slowly).
  const leanHeight = m.max(0.3, spec.centerOfMass[1]);
  const leanRate = 1.6 * m.sqrt(g / leanHeight);
  // Lean the rider is asking for, radians, right side down positive, and the side grip in
  // m/s² the steering is asking of the tires to get it.
  let riderLean = 0;
  let riderGrip = 0;
  // Sideways acceleration (to the left, m/s²) the rider is steering the tire line for.
  let riderSide = 0;
  // 0–1: how far the tail has stepped out. Sliding, the rider stands the machine up by moving
  // over it; there is no balance to steer for.
  let riderSlide = 0;
  // Drag in m/s² of a ski or board turned harder than it can carve: it skids, and scrubs speed.
  let edgeDrag = 0;
  // Camber thrust as the slip angle that would make the same side force.
  const camber = spec.cycle && !runners ? (spec.cycle.camber ?? 0.9) / stiffness : 0;
  // Four wheels on struts, where the spec has them.
  const geometry =
    car && !runners && spec.wheels && spec.wheelTrack > 0
      ? wheelsGeometry(spec, baseMass)
      : undefined;
  let wheels: WheelsState | undefined;
  if (geometry) {
    wheels = initialWheelsState(geometry, u / spec.wheelRadius);
    if (state.wheelSpin) wheels.spin = [...state.wheelSpin];
    if (state.wheelLoad) wheels.load = [...state.wheelLoad];
    wheels.heave = state.bodyHeave ?? 0;
    wheels.heaveRate = state.bodyHeaveRate ?? 0;
    wheels.pitch = bodyPitch;
    wheels.pitchRate = bodyPitchRate;
    wheels.roll = bodyRoll;
    wheels.rollRate = bodyRollRate;
  }
  // Off the plane of its road the car is a free rigid body; on it, the transform carries the
  // body's heave on the struts and the solver follows the road beneath.
  const outline = geometry ? carBodyOutline(spec, geometry) : undefined;
  let body: CarBody | undefined;
  let still = state.freeBody?.still ?? 0;
  if (wheels && state.freeBody) {
    const rot = quatNormalize(t.rot);
    const offset = quatRotateVec3(rot, spec.centerOfMass);
    body = {
      center: [pos[0] + offset[0], pos[1] + offset[1], pos[2] + offset[2]],
      rot,
      velocity: [
        state.freeBody.velocity[0] / previousTravel,
        state.freeBody.velocity[1],
        state.freeBody.velocity[2] / previousTravel,
      ],
      omega: [...state.freeBody.omega],
      spin: wheels.spin,
      load: wheels.load,
    };
  } else if (wheels) pos[1] -= wheels.heave;
  /** The car as it is in the road's plane, let go as a free body with origin at `at`. */
  const release = (at: [number, number, number], vertical: number): CarBody | undefined => {
    if (!wheels) return undefined;
    const rot = vehicleRotation(next.yaw, next.pitch + bodyPitch, next.roll + bodyRoll * banks);
    const offset = quatRotateVec3(rot, spec.centerOfMass);
    const sy = m.sin(next.yaw);
    const cy = m.cos(next.yaw);
    return {
      center: [at[0] + offset[0], at[1] + wheels.heave + offset[1], at[2] + offset[2]],
      rot,
      velocity: [sy * u + cy * v, vertical + wheels.heaveRate, cy * u - sy * v],
      omega: [bodyPitchRate, r, bodyRollRate],
      spin: wheels.spin,
      load: wheels.load,
    };
  };
  // The road under each wheel against the road under the middle of the car: split grip.
  const patch: [number, number, number, number] = [1, 1, 1, 1];
  if (geometry && env.surface && surface) {
    const sy = m.sin(state.yaw);
    const cy = m.cos(state.yaw);
    const middle = surface.grip + m.max(0, 1 - surface.grip) * 0.5 * tread;
    for (let i = 0; i < 4; i++) {
      const x = geometry.x[i] ?? 0;
      const z = geometry.z[i] ?? 0;
      const under = env.surface(pos[0] + sy * z + cy * x, pos[2] + cy * z - sy * x, pos[1]);
      if (under && middle > 0)
        patch[i] = (under.grip + m.max(0, 1 - under.grip) * 0.5 * tread) / middle;
    }
  }
  let drivenSpeed = u;
  if (wheels) {
    const share = spec.drive === 'rear' ? 0 : spec.drive === 'all' ? 0.4 : 1;
    const [fl, fr, rl, rr] = wheels.spin;
    drivenSpeed = (share * (fl + fr) + (1 - share) * (rl + rr)) * 0.5 * spec.wheelRadius;
  }
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
    if (body) {
      // The steering and the driveline see the body's own motion.
      const ahead = quatRotateVec3(body.rot, [0, 0, 1]);
      const aside = quatRotateVec3(body.rot, [1, 0, 0]);
      u = body.velocity[0] * ahead[0] + body.velocity[1] * ahead[1] + body.velocity[2] * ahead[2];
      v = body.velocity[0] * aside[0] + body.velocity[1] * aside[1] + body.velocity[2] * aside[2];
      r = body.omega[1];
    }
    // Lock and steering speed both fade with road speed, as a driver's hands do, and full lock
    // asks for at most half again the cornering the tires can give at this speed.
    const fade = 1 + m.abs(u) / spec.steeringFadeSpeed;
    // A balanced cycle cannot ask for a tighter turn than its lean can support (a = g tan θ).
    // Tire friction may impose a lower limit, particularly in wet or snowy weather. A car's
    // lock is the angle that turns it as hard as its tires can corner.
    const corneringLimit = spec.cycle
      ? m.min(0.8 * friction * g, g * m.tan(spec.cycle.maxLean))
      : friction * g;
    const lock = m.min(
      spec.maxSteer / fade,
      m.atan((corneringLimit * wheelbase) / m.max(u * u, 1)),
    );
    const speedNow = m.hypot(u, v);
    if (direct)
      next.steer = approach(
        next.steer,
        m.clamp(input.steering, -1, 1) * spec.maxSteer * frontHealth,
        h * spec.steeringRate,
      );
    else if (car && spec.maxSteer > 0) {
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
    } else if (spec.cycle) {
      // The rider. The steering input asks for a lean, as far as the tires and the machine
      // allow. Above a walking pace the rider gets it by steering: the handlebar goes where it
      // puts the tire line under the lean the rider wants, which means out of the turn first
      // (countersteering) and then into it. Below that pace the feet are down and the bar
      // simply points the wheel.
      const upright = m.clamp((speedNow - 1) / 1.5, 0, 1);
      // The rider asks for a little less lean than the tires could hold, and keeps the rest to
      // steer with. If the tail steps out anyway, the rider stands the machine up until it
      // grips again.
      const tail = m.abs(m.atan2(v - rear * r, m.max(m.abs(u), 3)));
      riderSlide = m.clamp(tail / m.max(peakRear, 1e-3) - 0.5, 0, 1);
      riderLean =
        m.clamp(input.steering, -1, 1) *
        m.atan((0.85 * corneringLimit) / g) *
        frontHealth *
        (1 - riderSlide);
      let balanced: number;
      if (runners?.sidecut) {
        // On edge a ski or board carves the arc its sidecut and edge angle give, no tighter
        // than the snow can hold at this speed.
        const carve =
          m.smoothstep(m.abs(bodyRoll) / 0.12) / (runners.sidecut * m.max(m.cos(bodyRoll), 0.3));
        const held = corneringLimit / m.max(u * u, 1);
        balanced = m.sign(bodyRoll) * m.atan(wheelbase * m.min(carve, held));
        // Faster than the edge can hold its arc, the runner is across its path and skidding:
        // half the side force of the turn comes back as drag, which is how a skier slows down.
        edgeDrag = carve > held ? 0.5 * (1 - held / carve) * u * u * held * upright : 0;
      } else {
        // The lean is brought round at a rate the tires can still stop: what is left of their
        // grip beyond holding the lean asked for is all there is to catch it with, so the rider
        // slows the lean as it arrives.
        const error = riderLean - bodyRoll;
        const reach = 0.8 * friction * g;
        const spare = m.max(0.05, (0.6 * (reach - g * m.tan(m.abs(riderLean)))) / leanHeight);
        const turning = m.sign(error) * m.min(0.3 * leanRate, m.sqrt(2 * spare * m.abs(error)));
        const asked = 1.25 * leanRate * (turning - bodyRollRate);
        // Sideways acceleration (to the left) of the tire line that tips the lean that way.
        const needed = m.clamp(
          (leanHeight * asked - g * m.sin(bodyRoll)) / m.max(m.cos(bodyRoll), 0.3),
          -reach,
          reach,
        );
        // The front tire is never asked to slip past its peak: in a slide the wheel follows the
        // way the machine is going, which is the countersteer that catches it.
        const along = -m.atan2((v + front * r) * (u < 0 ? -1 : 1), m.max(m.abs(u), 3));
        // The bar is worked until the machine is turning as hard as that: unevenly loaded
        // tires, drive and slip all change how much bar a turn takes, and the rider feels for
        // it rather than computing it.
        balanced = m.clamp(
          next.steer - ((h * 10 * (needed - u * r) * wheelbase) / m.max(u * u, 9)) * upright,
          along - 0.8 * peakFront,
          along + 0.8 * peakFront,
        );
        riderGrip = m.abs(needed) * upright;
        riderSide = needed;
      }
      const pointed = m.clamp(input.steering, -1, 1) * lock * frontHealth;
      next.steer = approach(
        next.steer,
        m.clamp(upright * balanced + (1 - upright) * pointed, -spec.maxSteer, spec.maxSteer),
        h * spec.steeringRate * (1 + 2 * upright),
      );
      if (runners?.sidecut) riderSide = 0;
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
    let drivelineInertia = 0;
    if (engine && powertrain) {
      const direction =
        throttle > 0 ? (u < -0.1 ? -1 : 1) : throttle < 0 ? (u > 0.1 ? 1 : -1) : engine.gear;
      const governed =
        (direction > 0 && u >= spec.maxSpeed) || (direction < 0 && u <= -spec.reverseSpeed);
      const result = stepPowertrain(
        powertrain,
        spec.wheelRadius,
        engine,
        // On four wheels the engine is geared to the driven wheels, which may be spinning, and
        // its inertia is theirs to spin up.
        wheels ? drivenSpeed : u,
        braking || governed ? 0 : m.abs(throttle),
        direction,
        h,
        wheels ? 0 : mass,
      );
      engine = result.state;
      drive = result.force * vehiclePartAuthority(spec, next, 'engine');
      // Under braking the converter or clutch lets the engine go: the brakes stop the car,
      // not the flywheel.
      drivelineInertia =
        (braking ? 0 : 1) *
        (powertrain.inertia ??
          (powertrain.curve === 'electric' ? 0.06 : 0.1 + powertrain.power / 1_000_000)) *
        result.ratio *
        result.ratio *
        (powertrain.efficiency ?? 0.9);
    } else if (
      !braking &&
      !(throttle > 0 && u >= (runners?.pushSpeed ?? spec.maxSpeed)) &&
      !(throttle < 0 && u <= -spec.reverseSpeed)
    )
      drive = throttle * spec.engineForce * vehiclePartAuthority(spec, next, 'engine');
    if (body && wheels && geometry && outline) {
      const before: CarBody = { ...body };
      const groundAt = (x: number, z: number, y?: number): number | undefined =>
        env.groundHeight(x, z, y);
      const out = stepCarBody(body, {
        controls: {
          spec,
          geometry,
          mass,
          friction: [
            friction * m.max(0.03, frontHealth) * patch[0],
            friction * m.max(0.03, frontHealth) * patch[1],
            frictionRear * m.max(0.03, rearHealth) * patch[2],
            frictionRear * m.max(0.03, rearHealth) * patch[3],
          ],
          drive,
          frontDrive,
          health: [frontHealth, rearHealth],
          drivelineInertia,
          brake: braking ? (input.brake ? m.clamp(input.brakePedal ?? 1, 0, 1) : 1) : 0,
          handbrake: input.handbrake === true,
          antiLock: (spec.wheels?.antiLock ?? true) && !direct,
          traction: tractionControl,
          stability: stabilityControl,
          h,
        },
        steer: delta,
        yawInertia: inertia,
        drag: spec.aerodynamicResistance,
        side,
        ...(wind ? { wind: [wind[0], wind[1], wind[2]] as [number, number, number] } : {}),
        resistance: spec.rollingResistance + surfaceDrag + (2 - frontHealth - rearHealth) * 1.5,
        travel,
        groundHeight: groundAt,
      });
      const hull = out.ok
        ? carBodyGroundContacts(body, outline, groundAt, spec.maxStepHeight, h * travel)
        : undefined;
      if (!hull) {
        body = before;
        next.waitingForTerrain = true;
        break;
      }
      // The body's own corners on the ground come first; what the host reports follows.
      const grounded = hull.length;
      const contacts: CarBodyContact[] = hull;
      if (spec.collisionParts) {
        const pose: TransformData = { pos: bodyOrigin(body, spec), rot: body.rot };
        // A wheel that comes down hard loads its joint.
        for (const landing of out.landed) {
          if (landing.speed <= 2) continue;
          const role = landing.wheel < 2 ? 'frontWheel' : 'rearWheel';
          const leftSide = landing.wheel % 2 === 0;
          const part = spec.collisionParts.find(
            (candidate) => candidate.role === role && candidate.center[0] > 0 === leftSide,
          );
          if (part)
            resolveVehiclePartContacts(
              pose,
              next,
              spec,
              [
                {
                  part: part.id,
                  point: vehicleLocalPoint(pose, part.center),
                  normal: [0, 1, 0],
                  depth: 0,
                },
              ],
              { velocity: [0, -landing.speed, 0], yawRate: 0 },
              travel,
              false,
            );
        }
        stepPartDebris(next, spec.collisionParts, env, id, h);
        if (env.contacts) {
          const probes = vehiclePartProbes(pose, spec, next);
          const reported = env.contacts(probes, id);
          const touching =
            out.wheelsDown >= 3 && out.upright > 0.9
              ? withoutClimbableWheelContacts(reported, probes, spec)
              : reported;
          const gone = new Set(
            spec.collisionParts
              .filter((part) => next.damage?.[part.id]?.detached)
              .map((part) => part.id),
          );
          impact = m.max(
            impact,
            resolveVehiclePartContacts(
              pose,
              next,
              spec,
              touching,
              { velocity: [...body.velocity], yawRate: body.omega[1] },
              travel,
              false,
            ),
          );
          for (const contact of touching) {
            const part = spec.collisionParts.find((candidate) => candidate.id === contact.part);
            const length = m.hypot(...contact.normal);
            if (!part || gone.has(part.id) || !(length > 1e-9) || !(contact.depth >= 0)) continue;
            contacts.push({
              point: contact.point,
              normal: [
                contact.normal[0] / length,
                contact.normal[1] / length,
                contact.normal[2] / length,
              ],
              depth: contact.depth,
              // A part that has just broken off passes on only what its joint could carry.
              ...(next.damage?.[part.id]?.detached
                ? {
                    joint: {
                      breakSpeed: part.breakSpeed,
                      share: m.min(0.25, part.massFraction * 3),
                    },
                  }
                : {}),
            });
          }
        }
      }
      const struck = { velocity: body.velocity, omega: body.omega };
      const closing: number[] = [];
      const hit = resolveCarBodyContacts(
        body,
        mass,
        carBodyInertia(geometry, inertia),
        contacts,
        closing,
      );
      if (spec.collisionParts && closing.some((speed, i) => i < grounded && speed > 2)) {
        // The body's own corners coming down hard load the joints beside them.
        const pose: TransformData = { pos: bodyOrigin(body, spec), rot: body.rot };
        const probes = vehiclePartProbes(pose, spec, next);
        for (let i = 0; i < grounded; i++) {
          const speed = closing[i] ?? 0;
          const contact = contacts[i];
          if (!contact || speed <= 2) continue;
          resolveVehiclePartContacts(
            pose,
            next,
            spec,
            probes
              .filter(
                (probe) =>
                  m.hypot(
                    probe.center[0] - contact.point[0],
                    probe.center[1] - contact.point[1],
                    probe.center[2] - contact.point[2],
                  ) <=
                  probe.radius + 0.6,
              )
              .map((probe) => ({
                part: probe.part,
                point: contact.point,
                normal: contact.normal,
                depth: 0,
              })),
            {
              velocity: [
                -contact.normal[0] * speed,
                -contact.normal[1] * speed,
                -contact.normal[2] * speed,
              ],
              yawRate: 0,
            },
            travel,
            false,
          );
        }
      }
      if (env.canOccupy) {
        const ahead = quatRotateVec3(body.rot, [0, 0, 1]);
        if (!env.canOccupy(bodyOrigin(body, spec), m.atan2(ahead[0], ahead[2]), spec, id)) {
          // A host that can only say "blocked": stay at the last free pose and come off it.
          impact = m.max(impact, m.hypot(body.velocity[0], body.velocity[2]));
          body.center = before.center;
          body.rot = before.rot;
          body.velocity = [-0.2 * body.velocity[0], body.velocity[1], -0.2 * body.velocity[2]];
          body.omega = [0.5 * body.omega[0], 0.5 * body.omega[1], 0.5 * body.omega[2]];
        }
      }
      if (hit > 1) {
        impact = m.max(impact, hit);
        impacts.push({
          deltaVelocity: [
            (body.velocity[0] - struck.velocity[0]) * travel,
            body.velocity[1] - struck.velocity[1],
            (body.velocity[2] - struck.velocity[2]) * travel,
          ],
          deltaAngularVelocity: quatRotateVec3(body.rot, [
            body.omega[0] - struck.omega[0],
            body.omega[1] - struck.omega[1],
            body.omega[2] - struck.omega[2],
          ]),
          velocity: [struck.velocity[0] * travel, struck.velocity[1], struck.velocity[2] * travel],
          angularVelocity: quatRotateVec3(body.rot, struck.omega),
          centerOfMass: spec.centerOfMass,
        });
      }
      // Lying still off its wheels it rests; standing on them with the brakes on it holds.
      const moving = m.hypot(...body.velocity);
      const turning = m.hypot(...body.omega);
      still =
        out.wheelsDown === 0 && contacts.length > 0 && moving < 0.3 && turning < 0.3
          ? still + h
          : 0;
      const settling =
        m.hypot(
          body.velocity[0] - before.velocity[0],
          body.velocity[1] - before.velocity[1],
          body.velocity[2] - before.velocity[2],
        ) +
        m.hypot(
          body.omega[0] - before.omega[0],
          body.omega[1] - before.omega[1],
          body.omega[2] - before.omega[2],
        );
      if (
        still > 0.5 ||
        (out.wheelsDown >= 3 &&
          braking &&
          contacts.length === 0 &&
          moving < 0.05 &&
          turning < 0.03 &&
          settling < 0.5 * h)
      ) {
        body.velocity = [0, 0, 0];
        body.omega = [0, 0, 0];
      }
      pos = bodyOrigin(body, spec);
      wheels.spin = body.spin;
      wheels.load = body.load;
      next.grounded = out.wheelsDown > 0;
      skid = out.skid;
      assist = m.max(assist, out.assist);
      drivenSpeed = out.drivenSpeed;
      next.wheelAngle =
        (next.wheelAngle +
          ((body.spin[0] + body.spin[1] + body.spin[2] + body.spin[3]) / 4) * h * travel) %
        m.TAU;
      // Back on its wheels, and near enough level on ground it can drive: the road's plane
      // takes it again.
      if (
        out.wheelsDown >= 3 &&
        out.upright > 0.97 &&
        contacts.length === 0 &&
        m.abs(body.omega[0]) < 2 &&
        m.abs(body.omega[2]) < 2
      ) {
        const ahead = quatRotateVec3(body.rot, [0, 0, 1]);
        const aside = quatRotateVec3(body.rot, [1, 0, 0]);
        const top = quatRotateVec3(body.rot, [0, 1, 0]);
        const heading = m.atan2(ahead[0], ahead[2]);
        const hs = m.sin(heading);
        const hc = m.cos(heading);
        const under: number[] = [];
        for (const z of [spec.wheelbase / 2, -spec.wheelbase / 2])
          for (const x of [-span / 2, span / 2]) {
            const ground = env.groundHeight(
              pos[0] + hc * x + hs * z,
              pos[2] - hs * x + hc * z,
              pos[1],
            );
            if (ground !== undefined && Number.isFinite(ground)) under.push(ground);
          }
        if (under.length === 4) {
          const [fl, fr, rl, rr] = under as [number, number, number, number];
          const support = (fl + fr + rl + rr) / 4;
          const pitch = m.atan2((rl + rr - fl - fr) / 2, spec.wheelbase);
          const roll = m.atan2((fr + rr - fl - rl) / 2, span);
          const lean = -m.asin(m.clamp(ahead[1], -1, 1)) - pitch;
          const bank = m.atan2(aside[1], top[1]) - roll;
          const heave = pos[1] - support;
          const along = body.velocity[0] * hs + body.velocity[2] * hc;
          const across = body.velocity[0] * hc - body.velocity[2] * hs;
          const climb = 0 + (-along * m.tan(pitch) + across * m.tan(roll));
          if (
            m.abs(pitch) <= spec.maxSlope &&
            m.abs(roll) <= spec.maxSlope &&
            m.abs(lean) < 0.18 &&
            m.abs(bank) < 0.18 &&
            m.abs(heave) < 1.6 * geometry.travel &&
            m.abs(body.velocity[1] - climb) < 2.5
          ) {
            next.yaw = heading;
            next.pitch = pitch;
            next.roll = roll;
            next.vy = climb;
            next.grounded = true;
            u = along;
            v = across;
            r = body.omega[1];
            bodyPitch = lean;
            bodyPitchRate = body.omega[0];
            bodyRoll = bank;
            bodyRollRate = body.omega[2];
            wheels.heave = heave;
            wheels.heaveRate = body.velocity[1] - climb;
            wheels.pitch = lean;
            wheels.pitchRate = bodyPitchRate;
            wheels.roll = bank;
            wheels.rollRate = bodyRollRate;
            pos = [pos[0], support, pos[2]];
            body = undefined;
            still = 0;
          }
        }
      }
      continue;
    }
    // What the tires or runners push with along the vehicle, before any resistance.
    let propel = 0;
    if (wheels && geometry) {
      const bump = next.grounded ? roughness * m.min(1, speedNow / 8) : 0;
      let offsets: [number, number, number, number] | undefined;
      if (bump > 0) {
        offsets = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
          const x = geometry.x[i] ?? 0;
          const z = geometry.z[i] ?? 0;
          const ripple = (pos[0] + sx * z + cz * x) * 1.9 + (pos[2] + cz * z - sx * x) * 2.3;
          offsets[i] = 0.02 * bump * (m.sin(ripple * 0.22) + m.sin(ripple * 0.47 + 1.7));
        }
      }
      const out = stepWheels(wheels, {
        spec,
        geometry,
        mass,
        u,
        v,
        r,
        steer: delta,
        friction: [
          friction * m.max(0.03, frontHealth) * patch[0],
          friction * m.max(0.03, frontHealth) * patch[1],
          frictionRear * m.max(0.03, rearHealth) * patch[2],
          frictionRear * m.max(0.03, rearHealth) * patch[3],
        ],
        drive,
        frontDrive,
        health: [frontHealth, rearHealth],
        drivelineInertia,
        brake: braking ? (input.brake ? m.clamp(input.brakePedal ?? 1, 0, 1) : 1) : 0,
        handbrake: input.handbrake === true,
        antiLock: (spec.wheels?.antiLock ?? true) && !direct,
        traction: tractionControl,
        stability: stabilityControl,
        lift: mass * (spec.aerodynamicLift ?? 0) * airForward * airForward,
        ...(offsets ? { bump: offsets } : {}),
        grounded: next.grounded,
        h,
      });
      drivenSpeed = out.drivenSpeed;
      bodyPitch = wheels.pitch;
      bodyPitchRate = wheels.pitchRate;
      bodyRoll = wheels.roll;
      bodyRollRate = wheels.rollRate;
      if (next.grounded) {
        propel = out.forward;
        fx =
          propel -
          mass *
            (spec.rollingResistance + surfaceDrag + (2 - frontHealth - rearHealth) * 1.5) *
            m.clamp(u / stiction, -1, 1);
        fy = out.left;
        moment = out.moment;
        skid = out.skid;
        assist = m.max(assist, out.assist);
      }
    } else if (next.grounded) {
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
      // A leaned tire pushes toward the lean before it slips at all.
      const slipFront = m.atan2(sliding, m.max(m.abs(rolling), 3)) + camber * bodyRoll;
      const rearLateral = v - rear * r;
      const slipRear =
        m.atan2(rearLateral, m.max(m.abs(u), 3)) +
        ((camber * stiffness) / stiffnessRear) * bodyRoll;
      // A leaned cycle needs the side grip its lean stands on, slipping or not: the rider rolls
      // the throttle on and squeezes the brakes only as far as leaves it.
      const leaning = spec.cycle
        ? m.min(
            0.98,
            (1.1 * m.max(g * m.tan(m.abs(bodyRoll)), riderGrip)) / (m.max(friction, 0.05) * g),
          )
        : 0;
      const useFront = m.max(leaning, m.min(1, m.abs(slipFront) / peakFront));
      const useRear = m.max(leaning, m.min(1, m.abs(slipRear) / peakRear));
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
          ? spec.cycle
            ? 0.95 * traction * m.sqrt(m.max(0.02, 1 - use * use))
            : 0.97 * traction * m.sqrt(m.max(0.05, 1 - (0.9 * use) ** 2))
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
      const brakeFront = m.min(
        brake * bias,
        0.95 * straightFront * (spec.cycle ? m.sqrt(m.max(0.02, 1 - useFront * useFront)) : 1),
      );
      const brakeRear = m.min(
        brake * (1 - bias),
        0.95 * straightRear * m.sqrt(m.max(0.02, 1 - (spec.cycle ? useRear : 0.9 * useRear) ** 2)),
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
          stiffnessRear,
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
    if (engine && powertrain && spinning && !wheels)
      engine.rpm = approach(
        engine.rpm,
        0.96 * (powertrain.redline ?? powertrain.peakPowerRpm * 1.1),
        h * 9000,
      );
    // Air drag and crosswind. The side force acts ahead of the center of mass, so a gust
    // also turns the nose downwind.
    const sideForce = mass * spec.aerodynamicResistance * side * air * airLeft;
    // What the tires push along the road with: only that shifts weight between a cycle's two
    // wheels. The air's drag acts about as high as the mass sits and tips nothing.
    if (next.grounded && edgeDrag > 0) fx -= mass * edgeDrag * m.clamp(u / stiction, -1, 1);
    const tireForward = fx / mass;
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
    if (!wheels) {
      const bump = next.grounded ? roughness * m.min(1, speedNow / 8) : 0;
      const ripple = pos[0] * 1.9 + pos[2] * 2.3;
      const pitchTarget =
        (-pitchPerG * (spec.cycle ? tireForward : feltForward)) / g +
        (bump > 0 ? 0.008 * bump * (m.sin(ripple * 0.22) + m.sin(ripple * 0.47 + 1.7)) : 0);
      bodyPitchRate += (omega * omega * (pitchTarget - bodyPitch) - damping * bodyPitchRate) * h;
      if (spec.cycle) {
        const upright = m.clamp((speedNow - 1) / 1.5, 0, 1);
        // No further than the machine leans, or than the road could hold it at.
        const most = m.min(spec.cycle.maxLean, m.atan(friction)) + 0.04;
        if (runners?.sidecut)
          // A skier or boarder sets the edge by moving over it.
          bodyRollRate +=
            (leanRate * leanRate * (riderLean * upright - bodyRoll) - 2 * leanRate * bodyRollRate) *
            h;
        else if (!next.grounded)
          // In the air nothing tips it.
          bodyRollRate -= 2 * leanRate * bodyRollRate * h;
        // Balance: gravity tips the lean further, and the tire line moving out from under it
        // stands it up. The lean follows the turn the rider is steering for; the rider is
        // taken to keep that balance where the tires are slow to deliver it or slide instead:
        // nobody falls off.
        // At a walking pace the rider's feet hold it.
        else
          bodyRollRate +=
            (upright *
              ((1 - riderSlide) *
                ((g * m.sin(bodyRoll) + riderSide * m.cos(bodyRoll)) / leanHeight) +
                riderSlide *
                  (leanRate * leanRate * (riderLean - bodyRoll) - 2 * leanRate * bodyRollRate)) +
              (1 - upright) * (-omega * omega * bodyRoll - damping * bodyRollRate)) *
            h;
        bodyRoll += bodyRollRate * h;
        // Past what the machine can lean, the rider catches it.
        if (m.abs(bodyRoll) > most) {
          bodyRoll = m.sign(bodyRoll) * most;
          bodyRollRate = 0;
        }
      } else {
        const rollTarget =
          (rollPerG * feltLeft) / g +
          (bump > 0 ? 0.01 * bump * (m.sin(ripple * 0.17 + 0.6) + m.sin(ripple * 0.39 + 4.1)) : 0);
        bodyRollRate += (omega * omega * (rollTarget - bodyRoll) - damping * bodyRollRate) * h;
        bodyRoll += bodyRollRate * h;
      }
      bodyPitch += bodyPitchRate * h;
    }
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
      // Ground that falls away under a car on four wheels is no barrier: it drives off it,
      // as a free body. Ground that rises like that still stops it.
      if (
        wheels &&
        support - pos[1] <= spec.maxStepHeight &&
        -u * m.sin(pitch) + v * m.sin(roll) < 0
      ) {
        body = release(pos, next.vy);
        continue;
      }
      u = 0;
      v = 0;
      r = 0;
      break;
    }
    next.vy -= 9.81 * h;
    candidate[1] += next.vy * h;
    const wasGrounded = next.grounded;
    // A car on four wheels is carried by the road only where the road is under it: over a
    // crest that falls away faster than gravity follows, it flies. Its wheels reach the road
    // for the first few centimeters.
    const landing = wheels ? candidate[1] <= support : false;
    next.grounded = candidate[1] <= support + spec.supportTolerance;
    if (wheels ? landing : next.grounded) {
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
      // The wheels are down; the body goes on sinking onto its springs.
      if (!wasGrounded && wheels) wheels.heaveRate += m.max(next.vy, -6);
      candidate[1] = support;
      // On the road the car rises and falls with it, which is what it leaves a crest with.
      next.vy = wheels ? 0 + (-u * m.tan(next.pitch) + v * m.tan(next.roll)) : 0;
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
    // On four wheels the drawn wheels turn as the real ones do on average: a locked wheel
    // stops and a spinning one blurs.
    next.wheelAngle =
      (next.wheelAngle +
        (wheels
          ? ((wheels.spin[0] + wheels.spin[1] + wheels.spin[2] + wheels.spin[3]) / 4) * h * travel
          : (u * h * travel) / spec.wheelRadius)) %
      m.TAU;
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
    if (wheels) {
      // In the air, or over onto one pair of wheels: no longer a car in the plane of its road.
      const rolled =
        m.abs(wheels.roll) > TIP_ANGLE &&
        (wheels.roll > 0 ? wheels.load[0] + wheels.load[2] : wheels.load[1] + wheels.load[3]) <= 0;
      const pitched =
        m.abs(wheels.pitch) > TIP_ANGLE &&
        (wheels.pitch > 0 ? wheels.load[2] + wheels.load[3] : wheels.load[0] + wheels.load[1]) <= 0;
      if (!next.grounded || rolled || pitched) body = release(pos, next.vy);
    }
  }
  let pose: TransformData;
  if (body) {
    // Off the road's plane the pose is the body's own, and the angles its attitude.
    const ahead = quatRotateVec3(body.rot, [0, 0, 1]);
    const aside = quatRotateVec3(body.rot, [1, 0, 0]);
    const top = quatRotateVec3(body.rot, [0, 1, 0]);
    u = body.velocity[0] * ahead[0] + body.velocity[1] * ahead[1] + body.velocity[2] * ahead[2];
    v = body.velocity[0] * aside[0] + body.velocity[1] * aside[1] + body.velocity[2] * aside[2];
    r = body.omega[1];
    // At rest it is at rest: no signed zeros from the projections.
    if (u === 0) u = 0;
    if (v === 0) v = 0;
    if (m.hypot(ahead[0], ahead[2]) > 1e-3) next.yaw = m.atan2(ahead[0], ahead[2]);
    next.pitch = -m.asin(m.clamp(ahead[1], -1, 1));
    next.roll = m.atan2(aside[1], top[1]);
    next.vy = body.velocity[1];
    bodyPitch = 0;
    bodyPitchRate = 0;
    bodyRoll = 0;
    bodyRollRate = 0;
    if (wheels) {
      wheels.heave = 0;
      wheels.heaveRate = 0;
    }
    next.freeBody = {
      velocity: [body.velocity[0] * travel, body.velocity[1], body.velocity[2] * travel],
      omega: body.omega,
      ...(still > 0 ? { still } : {}),
    };
    pose = { ...t, pos: bodyOrigin(body, spec), rot: body.rot };
  } else {
    delete next.freeBody;
    pose = {
      ...t,
      pos: wheels ? [pos[0], pos[1] + wheels.heave, pos[2]] : pos,
      rot: vehicleRotation(next.yaw, next.pitch + bodyPitch, next.roll + bodyRoll * banks),
    };
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
  if (wheels) {
    next.bodyHeave = wheels.heave;
    next.bodyHeaveRate = wheels.heaveRate;
    next.wheelSpin = wheels.spin;
    next.wheelLoad = wheels.load;
  }
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
  return { transform: pose, state: next, impact: impact * travel, impacts };
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
  // A car lying on its side or roof is left beside where it lies, not through its floor.
  const overturned = world.get(mounted.vehicle, VehicleState)?.freeBody !== undefined;
  const beside: TransformData = overturned ? { ...t, rot: vehicleRotation(yawOf(t.rot)) } : t;
  for (const offset of mount.exits) {
    const pos = vehicleLocalPoint(beside, offset);
    const ground = env.groundHeight(pos[0], pos[2], t.pos[1]);
    if (
      ground === undefined ||
      (!overturned &&
        m.abs(ground - (world.has(mounted.vehicle, { name: 'boat' }) ? pos[1] : t.pos[1])) > 0.6)
    )
      continue;
    pos[1] = ground + 0.02;
    if (env.canExit && !env.canExit(pos, actor, mounted.vehicle)) continue;
    stopWalking(world, actor);
    world.remove(actor, Mounted);
    world.patch(actor, Transform, {
      pos,
      ...(overturned ||
      world.get(mounted.vehicle, Vehicle)?.spec.cycle !== undefined ||
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
