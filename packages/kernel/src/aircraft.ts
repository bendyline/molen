import type {
  AircraftData,
  AircraftEngineStateData,
  AircraftInputData,
  AircraftNamedEngineSpec,
  AircraftSpec,
  AircraftStateData,
  AirplanePhysicsSpec,
  WeatherData,
} from '@bendyline/molen-schema';
import { boostSpeedMultiplier } from '@bendyline/molen-schema';
import {
  type AircraftContactEnvironment,
  aircraftInertia,
  aircraftSectionAuthority,
  aircraftTailStrike,
  aircraftWrecked,
  damageAircraftBody,
  resolveAircraftContacts,
  stepAircraftDebris,
  stepAircraftWreck,
} from './aircraft-collision';

export type { AircraftCollisionProbe, AircraftContact } from './aircraft-collision';
export {
  aircraftCollisionParts,
  aircraftCollisionProbes,
  aircraftTailStrike,
} from './aircraft-collision';

import { actuatorsSettled, stepActuators } from './actuators';
import {
  aircraftGear,
  type GearState,
  type GearStep,
  hangingGear,
  initialGearState,
  stepGear,
} from './aircraft-gear';

export { aircraftGear, type GearGeometry, type GearLeg } from './aircraft-gear';

import { isBoostMode } from './boost';
import { type ComponentType, defineComponent, Transform, type TransformData } from './component';
import { dmath as m } from './dmath';
import {
  angularAcceleration,
  originFromCenterOfMass,
  substepCount,
  turnBody,
} from './dynamics/rigid-body';
import {
  aircraftDeparture,
  aircraftDragCoefficient,
  aircraftEngineRpm,
  aircraftEngineShaftPower,
  aircraftEngineThrust,
  aircraftFuelFlow,
  aircraftMixtureEfficiency,
  engineThrottle,
  wingLiftCoefficient,
} from './flight-aerodynamics';
import {
  bodyYawMoment,
  elevatorForMoment,
  finMoment,
  tailMoment,
  tailState,
  type WingPanelLoads,
  wingPanelLoads,
} from './flight-surfaces';

export {
  aircraftDeparture,
  aircraftDragCoefficient,
  aircraftEngineRpm,
  aircraftEngineShaftPower,
  aircraftEngineThrust,
  aircraftFuelFlow,
  aircraftMixtureEfficiency,
  bestPowerMixture,
  engineThrottle,
  propellerThrust,
  turbofanLapse,
  waveDragCoefficient,
} from './flight-aerodynamics';
export { sampleAtmosphere } from './weather';

import { stepRotorcraft } from './helicopter-rotor';

export {
  mainRotorBlades,
  type RotorTrim,
  rotorcraftInertia,
  rotorShaftPower,
  rotorTrim,
  tailRotorBlades,
} from './helicopter-rotor';

import { approach, quatNormalize, quatRotateVec3 } from './math3d';
import { groundFieldOf } from './terrain';
import {
  installMountedSeats,
  Mountable,
  type MountableData,
  Mounted,
  vehicleLocalPoint,
  vehicleRotation,
  weatherGrip,
} from './vehicles';
import { sampleAtmosphere, weatherOf } from './weather';
import { terrainSlope, windField } from './wind';
import type { World } from './world';

export const Aircraft: ComponentType<AircraftData> = defineComponent<AircraftData>('aircraft');
export const AircraftInput: ComponentType<AircraftInputData> =
  defineComponent<AircraftInputData>('aircraftInput');
export const AircraftState: ComponentType<AircraftStateData> =
  defineComponent<AircraftStateData>('aircraftState');
export const IDLE_AIRCRAFT_INPUT: AircraftInputData = {
  power: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  brake: true,
  engine: false,
  gear: true,
  flaps: false,
};
export function initialAircraftState(yaw = 0): AircraftStateData {
  return {
    velocity: [0, 0, 0],
    yaw,
    pitch: 0,
    roll: 0,
    pitchRate: 0,
    rollRate: 0,
    yawRate: 0,
    rpm: 0,
    rotorAngle: 0,
    airspeed: 0,
    altitudeAGL: 0,
    verticalSpeed: 0,
    angleOfAttack: 0,
    stalled: false,
    grounded: true,
    crashed: false,
    waitingForTerrain: false,
  };
}
export function aircraftMounts(spec: AircraftSpec): MountableData {
  return {
    seats: [{ id: 'driver', role: 'driver', position: [...spec.pilotEye] }],
    exits:
      spec.model === 'airplane'
        ? [
            [1.6, 0, -1.5],
            [-1.6, 0, -1.5],
          ]
        : [
            [-1.6, 0, 0.8],
            [1.6, 0, 0.8],
          ],
    reach: spec.model === 'airplane' ? 4 : 3,
  };
}
export interface AircraftEnvironment extends AircraftContactEnvironment {
  /** Override the world's 4× travel assist. Aerodynamics retain normal handling speeds. */
  boostMode?: boolean;
  groundHeight(x: number, z: number, y?: number): number | undefined;
  /** Uniform wind override in m/s; replaces the weather's wind field, turbulence included. */
  wind?: [number, number, number];
  /** Optional shared atmospheric conditions. Otherwise retain the stock altitude-density model. */
  weather?: WeatherData;
  /** Simulation time in seconds at the start of the step; moves gusts and turbulence. Default 0. */
  time?: number;
  /** Legacy boolean obstruction test. Prefer contacts for impact normals and breakable parts. */
  canOccupy?(transform: TransformData, spec: AircraftSpec, entity: string): boolean;
}
function dot(a: readonly number[], b: readonly number[]): number {
  return (a[0] ?? 0) * (b[0] ?? 0) + (a[1] ?? 0) * (b[1] ?? 0) + (a[2] ?? 0) * (b[2] ?? 0);
}
/** Resolve the single-engine form as "main", or return an airplane's named engine bank. */
export function aircraftEngines(spec: AircraftSpec): readonly AircraftNamedEngineSpec[] {
  if ((spec.engine === undefined) === (spec.engines === undefined))
    throw new Error(`aircraft "${spec.label}" must supply exactly one of engine or engines`);
  if (spec.engine) return [{ ...spec.engine, id: 'main' }];
  const engines = spec.engines ?? [];
  if (
    spec.model !== 'airplane' ||
    engines.length === 0 ||
    new Set(engines.map((engine) => engine.id)).size !== engines.length
  )
    throw new Error(
      `aircraft "${spec.label}" needs a nonempty airplane engine bank with unique ids`,
    );
  return engines;
}
/**
 * The angle of attack in radians at which an airplane's wing carries its weight at `airspeed`
 * (m/s) in air of `density` (kg/m³), kept short of the stall. Launch an airplane already
 * flying with this as its pitch and `pitchTrim` and it holds level flight hands-off. `flaps` is
 * down or up, or a flap position 0..1.
 */
export function levelFlightAngleOfAttack(
  spec: AircraftSpec,
  airspeed: number,
  density = 1.225,
  flaps: boolean | number = false,
): number {
  const airplane = spec.airplane;
  if (spec.model !== 'airplane' || !airplane) return 0;
  const lift = m.max(1, 0.5 * density * airspeed * airspeed * airplane.wingArea);
  const alpha =
    ((9.81 * spec.mass) / lift - airplane.flapLift * Number(flaps)) / airplane.liftSlope -
    airplane.camberAngle;
  return m.clamp(alpha, -airplane.stallAngle, airplane.stallAngle - airplane.camberAngle - 0.02);
}
function engineStates(
  state: AircraftStateData,
  engines: readonly AircraftNamedEngineSpec[],
): Record<string, AircraftEngineStateData> {
  return Object.fromEntries(
    engines.map((engine) => {
      const current =
        state.engines && Object.hasOwn(state.engines, engine.id)
          ? state.engines[engine.id]
          : undefined;
      return [
        engine.id,
        current
          ? { ...current }
          : { rpm: state.rpm, rotorAngle: state.rotorAngle, failed: false, thrust: 0 },
      ];
    }),
  );
}
/** Latch or explicitly repair an engine failure. Pilot input cannot clear a failure. */
export function setAircraftEngineFailed(
  world: World,
  aircraft: string,
  engine: string,
  failed = true,
): boolean {
  const spec = world.get(aircraft, Aircraft)?.spec;
  const state = world.get(aircraft, AircraftState);
  if (!spec || !state) return false;
  const bank = aircraftEngines(spec);
  if (!bank.some((candidate) => candidate.id === engine)) return false;
  if (
    !failed &&
    spec.collisionParts?.some(
      (part) => part.engines?.includes(engine) && state.damage?.[part.id]?.detached,
    )
  )
    return false;
  const engines = engineStates(state, bank);
  const current = engines[engine];
  if (!current) return false;
  engines[engine] = { ...current, failed, thrust: failed ? 0 : current.thrust };
  world.patch(aircraft, AircraftState, { engines });
  return true;
}
/**
 * Fuel the aircraft is burning, kg/s, summed over its burning engines exactly as the flight step
 * burns it: by thrust for a jet (several times more per newton with the afterburner lit), by shaft
 * power for propeller and rotor engines. `power` is the throttle or collective, 0..1; a governed
 * helicopter rotor burns by it. For a host's fuel-flow readout; 0 for an aircraft with no engines
 * running.
 */
export function aircraftTotalFuelFlow(
  spec: AircraftSpec,
  state: AircraftStateData,
  power: number,
): number {
  const load = spec.model === 'helicopter' ? 0.3 + 0.7 * m.clamp(power, 0, 1) : 1;
  let flow = 0;
  for (const engine of aircraftEngines(spec)) {
    const e = state.engines?.[engine.id];
    if (e && (e.combustion ?? 0) > 0) flow += aircraftFuelFlow(engine, e, load);
  }
  return flow;
}
/**
 * Fill the tanks of an aircraft standing on the ground with every engine stopped, as a ground
 * crew would before the next flight. Returns false, changing nothing, in flight, with an engine
 * turning, or for an aircraft that declares no `fuel`.
 */
export function refuelAircraft(world: World, aircraft: string): boolean {
  const capacity = world.get(aircraft, Aircraft)?.spec.fuel?.capacity;
  const state = world.get(aircraft, AircraftState);
  if (
    capacity === undefined ||
    !state?.grounded ||
    state.rpm > 0.12 ||
    m.hypot(...state.velocity) > 0.7
  )
    return false;
  if ((state.fuel ?? capacity) < capacity) world.patch(aircraft, AircraftState, { fuel: capacity });
  return true;
}
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
/** Rudder the assist adds per radian of sideslip, as a share of full travel. */
const TURN_COORDINATION = 3;
/** Rudder the assist adds per rad/s of yaw rate beyond the turn's own. */
const YAW_DAMPER = 0.5;
/** Elevator trim travel per second at full trim input, as a share of full travel. */
const ELEVATOR_TRIM_RATE = 0.25;
/**
 * Pedal the assist adds on the wheels per rad/s of yaw, as a share of full travel: the feet
 * that keep an airplane, and above all a taildragger, running straight.
 */
const GROUND_YAW_DAMPER = 6;
/**
 * Aileron the assist adds on the wheels per radian of bank and per rad/s of roll, as shares of
 * full travel: the hands that hold the wings level through a crosswind landing.
 */
const GROUND_ROLL_HOLD = 8;
const GROUND_ROLL_DAMPER = 2;
/** Fastest turn full pedal asks of the steered wheel, rad/s. */
const GROUND_STEER_RATE = 0.65;
/** Pedal those feet add per radian the airplane is sliding across its own heading. */
const GROUND_TRACK_HOLD = 3;
/**
 * Elevator the assist winds on per second on the wheels, per radian the nose stays short of the
 * attitude asked for, as a share of full travel: the pull that lifts a nose wheel the gear is
 * still holding down, or presses a tail down onto its wheel.
 */
const GROUND_PITCH_WIND = 5;
type Axes = { forward: Vec3; up: Vec3; left: Vec3 };

function cross(a: readonly number[], b: readonly number[]): Vec3 {
  const [ax = 0, ay = 0, az = 0] = a;
  const [bx = 0, by = 0, bz = 0] = b;
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}
function bodyAxes(rot: Quat): Axes {
  return {
    forward: quatRotateVec3(rot, [0, 0, 1]),
    up: quatRotateVec3(rot, [0, 1, 0]),
    left: quatRotateVec3(rot, [1, 0, 0]),
  };
}
/** Heading (+left), nose-up pitch and right bank of an orientation: inverts vehicleRotation. */
function attitude(axes: Axes): { yaw: number; pitch: number; roll: number } {
  return {
    yaw: m.atan2(axes.forward[0], axes.forward[2]),
    pitch: m.asin(m.clamp(axes.forward[1], -1, 1)),
    roll: m.atan2(axes.left[1], axes.up[1]),
  };
}
function wingForces(
  air: number[],
  axes: Axes,
  airplane: AirplanePhysicsSpec,
  flaps: number,
  density: number,
) {
  const axial = dot(air, axes.forward);
  const vertical = dot(air, axes.up);
  const lateral = dot(air, axes.left);
  const speed = m.hypot(axial, vertical);
  const angleOfAttack = speed > 0.01 ? m.atan2(-vertical, axial) : 0;
  const alpha = angleOfAttack + airplane.camberAngle;
  const { cl, separation } = wingLiftCoefficient(airplane, alpha, flaps);
  const lift = 0.5 * density * speed * speed * airplane.wingArea * cl;
  // Perpendicular to wing-plane airflow, including in a descent or backwards flow.
  const liftAxis = axes.up.map(
    (v, i) => v * m.cos(angleOfAttack) + (axes.forward[i] ?? 0) * m.sin(angleOfAttack),
  );
  return { axial, lateral, speed, angleOfAttack, alpha, separation, cl, lift, liftAxis };
}
/** Move a hydraulic surface toward its selection over `time` seconds for full travel; 0 is instant. */
function travel(
  position: number,
  selected: boolean | number,
  time: number | undefined,
  h: number,
): number {
  const target = m.clamp(Number(selected), 0, 1);
  return time !== undefined && time > 0 ? approach(position, target, h / time) : target;
}
/** Restore a substep's starting state, dropping fields the substep introduced. */
function rollBack(s: AircraftStateData, previous: AircraftStateData): void {
  for (const key of Object.keys(s)) if (!Object.hasOwn(previous, key)) delete s[key];
  Object.assign(s, previous, { waitingForTerrain: true });
}
/**
 * Deterministic flight, substepped independently of rendering. No second physics body.
 *
 * Airplanes are a six-degree-of-freedom rigid body: the transform's quaternion is the attitude,
 * with no pitch or bank limits, so loops, rolls and inverted flight follow from the forces. Wing
 * lift and drag, side force and propeller thrust act at the center of mass; weathercock and
 * angle-of-attack stability, rate damping, dihedral effect, inertia coupling, propeller torque,
 * P-factor and gyroscopic precession and asymmetric thrust produce the moments. The pilot's
 * stick moves the elevator, which sets the angle of attack the airframe flies toward around a
 * slowly self-adjusting trim; ailerons command roll rate and the rudder a yaw moment. On the
 * ground an airplane stands on its landing gear (aircraft-gear.ts): struts that carry what the
 * wing does not, tires that grip sideways and brake through their slip, a steered nose or tail
 * wheel. It rotates about its main wheels when its tailplane can lift the nose, crabs and
 * weathervanes in a crosswind as far as its tires let it, and bounces on its struts. Wind comes
 * from the weather's wind field, sampled at the center of mass and both wingtips so turbulence
 * also rolls the airplane.
 *
 * A helicopter whose spec carries `helicopter.rotor` flies on its rotors (helicopter-rotor.ts):
 * the same free rigid body, under a main rotor at its hub, the torque of turning it, a tail
 * rotor, and skids. Without it a helicopter keeps the assisted model: cyclic commands a bounded
 * disc tilt.
 */
export function stepAircraft(
  transform: TransformData,
  state: AircraftStateData,
  input: AircraftInputData,
  spec: AircraftSpec,
  dt: number,
  env: AircraftEnvironment,
  id = '',
): { transform: TransformData; state: AircraftStateData } {
  const airplane = spec.model === 'airplane' ? spec.airplane : undefined;
  const helicopter = spec.model === 'helicopter' ? spec.helicopter : undefined;
  if (spec.model === 'airplane' && airplane === undefined)
    throw new Error(`aircraft "${spec.label}" is missing airplane physics`);
  if (spec.model === 'helicopter' && helicopter === undefined)
    throw new Error(`aircraft "${spec.label}" is missing helicopter physics`);
  const engines = aircraftEngines(spec);
  for (const engine of Object.keys(input.engines ?? {}))
    if (!engines.some((candidate) => candidate.id === engine))
      throw new Error(`aircraft "${spec.label}" has no engine "${engine}"`);
  let t: TransformData = { ...transform, pos: [...transform.pos], rot: [...transform.rot] };
  const s: AircraftStateData = {
    ...state,
    velocity: [...state.velocity],
    ...(state.engines ? { engines: engineStates(state, engines) } : {}),
    waitingForTerrain: false,
  };
  if (!Number.isFinite(dt) || dt <= 0) return { transform: t, state: s };
  const travelScale = boostSpeedMultiplier(env.boostMode);
  const previousTravel = boostSpeedMultiplier(state.boosted);
  // Keep forces and angular response in the aircraft's ordinary flight envelope. Only linear
  // travel and public speed telemetry scale; the stored flag makes live toggles reversible.
  s.velocity = s.velocity.map((v) => v / previousTravel) as Vec3;
  s.airspeed /= previousTravel;
  s.verticalSpeed /= previousTravel;
  if (s.mach !== undefined) s.mach /= previousTravel;
  if (s.equivalentAirspeed !== undefined) s.equivalentAirspeed /= previousTravel;
  const speed = (s.debris ?? []).reduce(
    (speed, piece) => m.max(speed, m.hypot(...piece.velocity)),
    m.hypot(...s.velocity) * travelScale,
  );
  const radius = (spec.collisionParts ?? []).reduce(
    (size, part) => m.min(size, part.disc?.halfThickness ?? part.radius),
    0.3,
  );
  const angularTravel =
    (m.hypot(s.pitchRate, s.rollRate, s.yawRate ?? 0) * m.max(spec.span, spec.length)) / 2;
  const collisionRate = env.contacts || s.debris?.length ? (speed + angularTravel) / radius : speed;
  const steps = substepCount(dt, m.max(120, collisionRate));
  const h = dt / steps;
  const power = m.clamp(input.power, 0, 1);
  const controls = engines.map((engine) => {
    const override =
      input.engines && Object.hasOwn(input.engines, engine.id)
        ? input.engines[engine.id]
        : undefined;
    return {
      power: m.clamp(override?.power ?? power, 0, 1),
      mixture: m.clamp(override?.mixture ?? input.mixture ?? 1, 0, 1),
      propeller: m.clamp(override?.propeller ?? input.propeller ?? 1, 0, 1),
      enabled: input.engine && (override?.enabled ?? true),
    };
  });
  const field = env.wind === undefined && env.weather ? windField(env.weather) : undefined;
  const surface = (x: number, z: number): number | undefined => env.groundHeight(x, z);
  const start = env.time ?? 0;
  for (let n = 0; n < steps; n++) {
    const massFraction = m.max(
      0.2,
      (spec.collisionParts ?? []).reduce(
        (mass, part) => mass - (s.damage?.[part.id]?.detached ? part.massFraction : 0),
        1,
      ),
    );
    // `mass` is the aircraft with full tanks: it flies lighter as the fuel burns.
    const tank = spec.fuel?.capacity;
    const fuel = tank === undefined ? undefined : m.clamp(s.fuel ?? tank, 0, tank);
    const mass = m.max(
      0.1 * spec.mass,
      spec.mass * massFraction - (tank === undefined || fuel === undefined ? 0 : tank - fuel),
    );
    const weight = 9.81 * mass;
    const ground = env.groundHeight(t.pos[0], t.pos[2], t.pos[1]);
    if (ground === undefined || !Number.isFinite(ground)) {
      s.waitingForTerrain = true;
      break;
    }
    const previous = { ...s, velocity: [...s.velocity] as [number, number, number] };
    if (spec.actuators)
      s.actuators = stepActuators(spec.actuators, s.actuators, input.actuators, h);
    if (helicopter) {
      const from = s.gearPosition ?? Number(input.gear);
      s.gearPosition =
        helicopter.fixedGear !== false
          ? 1
          : s.grounded
            ? from
            : travel(from, input.gear, helicopter.gearTransitTime, h);
    }
    // Replace the bank on every substep: rollback at a terrain gap must include every engine.
    const bank = engineStates(s, engines);
    const atmosphere = sampleAtmosphere(env.weather ?? {}, t.pos[1]);
    const density = atmosphere.densityKgM3;
    let propwash = 0;
    let ratedPower = 0;
    // With its engine out in flight a rotor freewheels: the air it descends through and its
    // own momentum keep it turning (autorotation), and the helicopter branch balances that.
    let autorotating = false;
    // On its rotors a helicopter's rotor speed is its own (the engines' torque against what
    // the blades take), except running up or stopping on the ground.
    let spooling = false;
    for (const [index, engine] of engines.entries()) {
      const e = bank[engine.id];
      const control = controls[index];
      if (!e || !control) continue;
      if (
        spec.collisionParts?.some(
          (part) => part.engines?.includes(engine.id) && s.damage?.[part.id]?.detached,
        )
      )
        e.failed = true;
      const combustion = aircraftMixtureEfficiency(engine, atmosphere, control.mixture);
      const running =
        control.enabled &&
        !e.failed &&
        !aircraftWrecked(spec, s) &&
        combustion > 0 &&
        !(helicopter && (s.actuators?.eject ?? 0) > 0) &&
        // Dry tanks stop every engine.
        fuel !== 0;
      const targetRpm = helicopter?.powerLimitedRotor
        ? 1
        : aircraftEngineRpm(engine, control.power, combustion, control.propeller);
      e.combustion = running ? combustion : 0;
      if (!running && e.afterburner !== undefined) e.afterburner = 0;
      if (helicopter?.rotor && !aircraftWrecked(spec, s)) {
        spooling = s.grounded && (!running || e.rpm < 0.92);
        if (spooling) e.rpm = approach(e.rpm, running ? targetRpm : 0, h * engine.spoolRate);
      } else if (
        helicopter?.powerLimitedRotor &&
        !running &&
        !s.grounded &&
        !aircraftWrecked(spec, s) &&
        (s.actuators?.eject ?? 0) <= 0
      )
        autorotating = true;
      else e.rpm = approach(e.rpm, running ? targetRpm : 0, h * engine.spoolRate);
      e.rotorAngle = (e.rotorAngle + e.rpm * engine.rotorAngularSpeed * h) % m.TAU;
      e.thrust = 0;
      e.shaftPower = running
        ? aircraftEngineShaftPower(
            engine,
            atmosphere,
            helicopter?.powerLimitedRotor ? 1 : control.power,
            control.mixture,
            control.propeller,
          ) * m.clamp(e.rpm / m.max(0.01, targetRpm), 0, 1)
        : 0;
      propwash += e.shaftPower;
      ratedPower += engine.power;
    }
    s.engines = bank;
    s.rpm = engines.reduce((rpm, engine) => m.max(rpm, bank[engine.id]?.rpm ?? 0), 0);
    s.rotorAngle = bank[engines[0]?.id ?? 'main']?.rotorAngle ?? 0;
    propwash /= m.max(1, ratedPower);
    if (aircraftWrecked(spec, s)) {
      const candidate = stepAircraftWreck(t, s, spec, h, travelScale);
      if (!resolveAircraftContacts(candidate, s, spec, env, id, travelScale)) {
        rollBack(s, previous);
        break;
      }
      if (!env.contacts && env.canOccupy && !env.canOccupy(candidate, spec, id)) {
        s.velocity = s.velocity.map((v) => -v * 0.08) as Vec3;
      } else t = candidate;
      const pose = attitude(bodyAxes(t.rot));
      Object.assign(s, pose);
      const support = env.groundHeight(t.pos[0], t.pos[2], t.pos[1]) ?? ground;
      s.altitudeAGL = m.max(0, t.pos[1] - support);
      s.grounded = s.altitudeAGL < 0.3 && m.abs(s.velocity[1]) < 1;
      s.airspeed = m.hypot(...s.velocity);
      s.verticalSpeed = s.velocity[1];
      s.loadFactor = 0;
      stepAircraftDebris(s, spec, env, id, h);
      continue;
    }
    const time = start + n * h;
    const slope = field?.terrain ? terrainSlope(surface, t.pos[0], t.pos[2]) : undefined;
    const windAt = (point: Vec3): Vec3 => {
      const wind = env.wind
        ? [env.wind[0], env.wind[1], env.wind[2]]
        : field
          ? field.at(point, time, ground, slope)
          : [0, 0, 0];
      return wind.map((v) => v / travelScale) as Vec3;
    };
    let rot: Quat;
    let pos: Vec3;
    // Whether this substep integrated the attitude as a quaternion (airplanes, and helicopters
    // on direct cyclic) rather than from the stored Euler angles.
    let quaternionAttitude = airplane !== undefined;
    let liftoffTrim: number | undefined;
    let groundPitch = 0;
    // What the landing gear did this substep, where it is down and within reach of the ground.
    let gear: GearStep | undefined;
    if (airplane) {
      const poweredLift = spec.poweredLift;
      if (poweredLift)
        s.thrustVectorPosition = approach(
          s.thrustVectorPosition ?? 0,
          m.clamp(input.thrustVector ?? 0, 0, 1),
          h / poweredLift.transitTime,
        );
      // A state without positions starts at the selection, as the instant gear and flaps did.
      // The gear's weight-on-wheels lock holds it still on the ground; flaps move anywhere.
      const gearFrom = s.gearPosition ?? (input.gear ? 1 : 0);
      s.gearPosition = airplane.fixedGear
        ? 1
        : s.grounded
          ? gearFrom
          : travel(gearFrom, input.gear, airplane.gearTransitTime, h);
      s.flapPosition = travel(
        s.flapPosition ?? m.clamp(Number(input.flaps), 0, 1),
        input.flaps,
        airplane.flapTransitTime,
        h,
      );
      const gearOut = s.gearPosition;
      const flapsOut = s.flapPosition;
      // The steepest attitude on the wheels: the authored limit, or sooner where this
      // airframe's own tail would meet the runway.
      groundPitch = m.min(airplane.maxGroundPitch, aircraftTailStrike(spec).angle - 0.015);
      rot = quatNormalize(t.rot);
      const axes = bodyAxes(rot);
      const { forward, up, left } = axes;
      const com = vehicleLocalPoint({ pos: t.pos, rot }, spec.centerOfMass);
      const wind = windAt(com);
      const air = s.velocity.map((v, i) => v - (wind[i] ?? 0));
      s.airspeed = m.hypot(air[0] ?? 0, air[1] ?? 0, air[2] ?? 0);
      s.mach = s.airspeed / atmosphere.speedOfSound;
      s.equivalentAirspeed = s.airspeed * m.sqrt(density / 1.225);
      s.overspeed =
        s.mach > (airplane.maxMach ?? Infinity) ||
        s.equivalentAirspeed > (airplane.maxEquivalentAirspeed ?? Infinity) ||
        (gearOut > 0.01 && s.equivalentAirspeed > (airplane.gearLimitSpeed ?? Infinity)) ||
        (flapsOut > 0.01 && s.equivalentAirspeed > (airplane.flapLimitSpeed ?? Infinity));
      const wing = wingForces(air, axes, airplane, flapsOut, density);
      const { lateral, angleOfAttack, alpha, separation, cl, lift: wingLift, liftAxis } = wing;
      const departure = aircraftDeparture(airplane, alpha, s.grounded);
      s.departure = departure;
      const hoverDirection = poweredLift
        ? m.sin(((s.thrustVectorPosition ?? 0) * m.PI) / 2) *
          m.clamp(1 - m.abs(wing.axial) / poweredLift.controlFadeSpeed, 0, 1)
        : 0;
      // The wing polar is not a vertical rotor-wash model. Blend it out in the powered-lift
      // regime; profile/separated-flow drag remains, while engine thrust carries the weight.
      const leftWing = aircraftSectionAuthority(spec, s, 'leftWing');
      const rightWing = aircraftSectionAuthority(spec, s, 'rightWing');
      const tailAuthority = aircraftSectionAuthority(spec, s, 'tail');
      const wingAuthority = (leftWing + rightWing) / 2;
      const lift = wingLift * (1 - hoverDirection) * wingAuthority;
      // Equivalent airspeed relative to the reference speed: control power grows with it up to
      // maxControlAuthority, stability and damping without limit.
      const ratio = (s.airspeed * m.sqrt(density / 1.225)) / airplane.controlAuthoritySpeed;
      const authority = m.min(ratio, airplane.maxControlAuthority);
      const dynamic = ratio * ratio;
      s.angleOfAttack = angleOfAttack;
      // A stall is an incidence limit, not an arbitrary true-airspeed switch.
      s.stalled = !s.grounded && wing.speed > 1 && m.abs(alpha) > airplane.stallAngle;
      const sideslip = m.asin(m.clamp(lateral / m.max(0.01, s.airspeed), -1, 1));
      s.sideslip = sideslip;
      // An airplane with surfaces flies on them once it is off the wheels: its wing as four
      // panels, each in its own airflow, in place of one force at the center of mass.
      const surfaces = poweredLift ? undefined : airplane.surfaces;
      let panels: WingPanelLoads | undefined;
      let airBody: Vec3 = [0, 0, 0];
      // On the wheels the assist's hands keep the wings level, as its feet keep the nose
      // straight: aileron against a wing that the wind, or a touchdown with drift on, is lifting.
      const rollStick =
        s.grounded && !(input.controlMode === 'direct' && surfaces?.flyByWire !== true)
          ? m.clamp(
              m.clamp(input.roll, -1, 1) -
                GROUND_ROLL_HOLD * s.roll -
                GROUND_ROLL_DAMPER * s.rollRate,
              -1,
              1,
            )
          : m.clamp(input.roll, -1, 1);
      // Aileron travel is held back at high speed, as stick force or a limiter would.
      const aileronPosition =
        rollStick * m.min(1, airplane.maxControlAuthority / m.max(ratio, 0.01));
      if (surfaces) {
        airBody = [dot(air, left), dot(air, up), dot(air, forward)];
        const height = m.max(0, com[1] - ground) / spec.span;
        let gustLeft: Vec3 | undefined;
        let gustRight: Vec3 | undefined;
        if (field?.structured) {
          const reach = 0.35 * spec.span;
          const inBody = (tip: Vec3): Vec3 => {
            const d = tip.map((v, i) => v - (wind[i] ?? 0));
            return [dot(d, left), dot(d, up), dot(d, forward)];
          };
          gustLeft = inBody(windAt(com.map((v, i) => v + (left[i] ?? 0) * reach) as Vec3));
          gustRight = inBody(windAt(com.map((v, i) => v - (left[i] ?? 0) * reach) as Vec3));
        }
        panels = wingPanelLoads({
          airplane,
          surfaces,
          span: spec.span,
          air: airBody,
          omega: [-s.pitchRate, s.yawRate ?? 0, s.rollRate],
          density,
          flaps: flapsOut,
          aileron: aileronPosition,
          induced:
            aircraftDragCoefficient(airplane, 1, s.mach, 0, 0, 0, 0, height) -
            aircraftDragCoefficient(airplane, 0, s.mach, 0, 0, 0, 0, height),
          left: leftWing,
          right: rightWing,
          ...(gustLeft && gustRight ? { gustLeft, gustRight } : {}),
        });
      }
      const drag =
        0.5 *
        density *
        s.airspeed ** 2 *
        airplane.wingArea *
        (aircraftDragCoefficient(
          airplane,
          // The panels carry their own induced drag.
          panels ? 0 : cl,
          s.mach,
          gearOut,
          flapsOut,
          separation,
          alpha,
          m.max(0, com[1] - ground) / spec.span,
        ) +
          (airplane.speedBrakeDrag ?? 0) * (s.actuators?.speedBrake ?? 0));
      const force: Vec3 = [0, -weight, 0];
      // Side force per m/s of sideways airspeed: the fuselage's and fin's in a slip where the
      // airplane flies on its surfaces, else a damping rate that stands in for it.
      const sideForce =
        panels && surfaces?.sideForce !== undefined
          ? 0.5 * density * s.airspeed * airplane.wingArea * surfaces.sideForce
          : mass * airplane.lateralDamping * m.min(1, authority);
      for (let i = 0; i < 3; i++)
        force[i] =
          (force[i] ?? 0) +
          (panels
            ? (left[i] ?? 0) * panels.force[0] +
              (up[i] ?? 0) * panels.force[1] +
              (forward[i] ?? 0) * panels.force[2]
            : (liftAxis[i] ?? 0) * lift) -
          ((air[i] ?? 0) / m.max(1, s.airspeed)) * drag -
          (left[i] ?? 0) * lateral * sideForce;
      // Body-axis moments in N m: +X left (nose down), +Y up (nose left), +Z forward (right bank).
      // The remaining wing carries lift off-center, rolling toward the missing wing.
      const moment: Vec3 = panels
        ? [...panels.moment]
        : [0, 0, (leftWing - rightWing) * wingLift * (1 - hoverDirection) * spec.span * 0.125];
      const omega: Vec3 = [-s.pitchRate, s.yawRate ?? 0, s.rollRate];
      const effects = airplane.propellerEffects ?? 0;
      for (const [index, engine] of engines.entries()) {
        const e = bank[engine.id];
        const control = controls[index];
        if (!e || !control) continue;
        const commandedRpm = aircraftEngineRpm(
          engine,
          control.power,
          e.combustion,
          control.propeller,
        );
        const vectorAngle = engine.vectored ? ((s.thrustVectorPosition ?? 0) * m.PI) / 2 : 0;
        const localAxis: Vec3 = engine.vectored
          ? [0, m.sin(vectorAngle), m.cos(vectorAngle)]
          : engine.thrustAxis;
        const axisLength = m.max(0.0001, m.hypot(...localAxis));
        const thrustAxis = vehicleLocalPoint({ pos: [0, 0, 0], rot }, localAxis);
        const propellerSpeed = dot(air, thrustAxis) / axisLength;
        const running = control.enabled && !e.failed && (e.combustion ?? 1) > 0;
        const spooled = m.clamp(e.rpm / m.max(0.01, commandedRpm), 0, 1);
        e.shaftPower = running
          ? aircraftEngineShaftPower(
              engine,
              atmosphere,
              control.power,
              control.mixture,
              control.propeller,
            ) * spooled
          : 0;
        // Engine failures remove powered thrust immediately; the rotor continues to spool down.
        if (engine.afterburnerThrust !== undefined) {
          const reheat =
            running && e.rpm > 0.8 ? engineThrottle(engine, control.power).afterburner : 0;
          e.afterburner = running ? approach(e.afterburner ?? 0, reheat, h / 0.6) : 0;
        }
        e.thrust = running
          ? aircraftEngineThrust(
              engine,
              airplane,
              atmosphere,
              propellerSpeed,
              control.power,
              e.afterburner ?? 0,
              control.mixture,
              control.propeller,
            ) * spooled
          : 0;
        for (let i = 0; i < 3; i++)
          force[i] = (force[i] ?? 0) + ((thrustAxis[i] ?? 0) / axisLength) * e.thrust;
        // (r × F).y in body coordinates.
        moment[1] +=
          (((engine.position[2] - spec.centerOfMass[2]) * localAxis[0] -
            (engine.position[0] - spec.centerOfMass[0]) * localAxis[2]) *
            e.thrust) /
          axisLength;
        if (engine.vectored) {
          // Off-center vertical thrust matters too: an Osprey engine failure rolls the airframe.
          const arm = engine.position.map((v, i) => v - (spec.centerOfMass[i] ?? 0));
          const torque = cross(arm, localAxis);
          moment[0] += (torque[0] * e.thrust) / axisLength;
          moment[2] += (torque[2] * e.thrust) / axisLength;
        }
        if (effects > 0 && engine.propulsion !== 'jet') {
          // A clockwise propeller (seen from the cockpit) rolls the airframe left against its
          // torque, and its slipstream, P-factor and precession yaw the nose left.
          const spin = engine.propellerRotation === 'counterclockwise' ? -1 : 1;
          const axis = engine.thrustAxis.map((v) => v / axisLength);
          const torque = running
            ? (e.shaftPower ?? 0) /
              (engine.rotorAngularSpeed * m.max(engine.idleRpm, m.max(e.rpm, 0.01)))
            : 0;
          const momentum = spin * (engine.propellerInertia ?? 0) * engine.rotorAngularSpeed * e.rpm;
          const precession = cross(omega, axis);
          for (let i = 0; i < 3; i++)
            moment[i] =
              (moment[i] ?? 0) -
              effects * spin * torque * (axis[i] ?? 0) -
              effects * momentum * (precession[i] ?? 0);
          moment[1] += effects * spin * e.thrust * (0.25 + 1.2 * m.max(0, angleOfAttack));
        }
      }
      // Landing gear, locked down and within reach of the ground.
      const legs = aircraftGear(spec);
      const direct = input.controlMode === 'direct' && surfaces?.flyByWire !== true;
      // On the wheels the assist's feet damp the swing and keep the nose where the airplane
      // is going; the pedals steer and work the rudder.
      const pedal = m.clamp(input.yaw, -1, 1);
      const rolling = dot(s.velocity, forward);
      const sliding = dot(s.velocity, left);
      // The turn the pedals themselves ask of the steered wheel (right pedal, nose right): the
      // feet damp what is left over, the swing nobody asked for.
      const asked = -pedal * m.min(m.abs(rolling) / airplane.groundSteerSpeed, GROUND_STEER_RATE);
      const feet =
        s.grounded && !direct
          ? m.clamp(
              pedal +
                GROUND_YAW_DAMPER * ((s.yawRate ?? 0) - asked) -
                (m.abs(rolling) > 3 ? GROUND_TRACK_HOLD * m.atan2(sliding, m.abs(rolling)) : 0),
              -1,
              1,
            )
          : pedal;
      const aloft: Vec3 = [force[0], force[1], force[2]];
      // Standing still with the brakes holding (or with nothing pushing harder than the tires
      // roll), it stands: a tire's grip is friction, not a drag that lets it creep.
      let held = false;
      if (gearOut >= 1 && aircraftSectionAuthority(spec, s, 'gear') > 0) {
        const standing: GearState = s.wheels
          ? {
              spin: [...s.wheels.spin],
              load: [...s.wheels.load],
              travel: s.wheels.travel ? [...s.wheels.travel] : legs.legs.map(() => 0),
            }
          : initialGearState(legs);
        if (t.pos[1] - ground > 1.5 + m.abs(s.velocity[1]) * h * travelScale) {
          // Well clear of the ground: nothing to ask it, and every strut hangs at its reach.
          standing.load = standing.load.map(() => 0);
          standing.travel = hangingGear(legs);
        } else {
          const carried = standing.load.reduce((total, load) => total + load, 0);
          const grip = legs.friction * weatherGrip(env.weather) * carried;
          held =
            carried > 0 &&
            m.hypot(rolling, sliding) < 0.1 &&
            m.abs(s.yawRate ?? 0) < 0.03 &&
            m.abs(dot(aloft, left)) <= 0.9 * grip &&
            m.abs(dot(aloft, forward)) <=
              (input.brake
                ? m.min(mass * airplane.brakeDeceleration, 0.9 * grip)
                : (carried / 9.81) * airplane.rollingDeceleration);
          gear = stepGear(standing, {
            geometry: legs,
            center: com,
            rot,
            velocity: s.velocity as Vec3,
            omega,
            brake: input.brake ? 1 : 0,
            pedal: feet,
            // The steered wheel turns far at a taxi and only a little at speed.
            steerAngle: m.min(
              1,
              m.atan(
                legs.wheelbase *
                  m.min(
                    1 / airplane.groundSteerSpeed,
                    GROUND_STEER_RATE / m.max(m.abs(rolling), 0.1),
                  ),
              ),
            ),
            grip: weatherGrip(env.weather),
            brakeDeceleration: airplane.brakeDeceleration,
            rollingDeceleration: airplane.rollingDeceleration,
            mass,
            ...(held ? { holding: aloft } : {}),
            groundHeight: (x, z, y) => env.groundHeight(x, z, y),
            h,
          });
          if (!gear.ok) {
            rollBack(s, previous);
            break;
          }
          for (let i = 0; i < 3; i++) {
            force[i] = (force[i] ?? 0) + (gear.force[i] ?? 0);
            moment[i] = (moment[i] ?? 0) + (gear.moment[i] ?? 0);
          }
        }
        s.wheels = standing;
      } else delete s.wheels;
      const accel = force.map((f) => f / mass);
      // The wing's lift and gravity carry the airflow through the turn; the airframe's
      // stability turns the nose after it, so pitch damping acts on rotation relative to that
      // path. Yaw damping resists half the turn rate too, leaving the slight slip into a turn
      // that lets dihedral hold a hands-off bank instead of spiraling.
      let pathPitch = 0;
      let pathYaw = 0;
      if (!s.grounded) {
        const path = cross(air, accel).map((v) => v / m.max(25, s.airspeed ** 2));
        pathPitch = m.clamp(-dot(path, left), -3, 3);
        pathYaw = m.clamp(dot(path, up), -3, 3);
      }
      s.loadFactor = dot([aloft[0], aloft[1] + weight, aloft[2]], up) / weight;
      // Airflow starts to break away a few degrees before the stall and shakes the airframe:
      // the warning a pilot feels through the seat. Hosts shake the view by it; the flight
      // path is left alone.
      s.buffet = s.grounded
        ? 0
        : m.smoothstep((m.abs(alpha) - airplane.stallAngle + 0.07) / 0.07) *
          m.min(1, dynamic) *
          (1 - hoverDirection);
      // The pilot: sustained g drains blood from the head (vision dims, then goes), negative
      // g forces it there. Both build above a tolerance and recover below it.
      const tolerance =
        airplane.pilotGTolerance ?? ((airplane.maxLoadFactor ?? 6) >= 7.5 ? 6.5 : 4.5);
      s.greyout = m.clamp(
        (s.greyout ?? 0) +
          h *
            (s.loadFactor > tolerance
              ? (s.loadFactor - tolerance) / 20
              : s.loadFactor < tolerance - 1
                ? -0.25
                : 0),
        0,
        1,
      );
      s.redout = m.clamp(
        (s.redout ?? 0) + h * (s.loadFactor < -1.5 ? (-1.5 - s.loadFactor) / 6 : -0.5),
        0,
        1,
      );

      // Pitch: the elevator sets the angle of attack the airframe's stability flies toward.
      const pose = attitude(axes);
      // Below walking pace, or with the air from behind, the attitude stands in for incidence.
      const blend = m.clamp(wing.axial / 5, 0, 1);
      const incidence = blend * angleOfAttack + (1 - blend) * pose.pitch;
      const camber = airplane.camberAngle;
      const safeMax = airplane.stallAngle - camber - 0.02;
      const safeMin = -airplane.stallAngle - camber + 0.02;
      const qS = m.max(1, 0.5 * density * s.airspeed ** 2 * airplane.wingArea);
      const flapLift = flapsOut * airplane.flapLift;
      const incidenceFor = (load: number): number =>
        ((load * weight) / qS - flapLift) / airplane.liftSlope - camber;
      // The stick deflects at pitchResponse and springs back to center four times faster.
      const stick = m.clamp(input.pitch, -1, 1);
      const current = s.elevator ?? 0;
      const centering = m.abs(stick) < m.abs(current) || stick * current < 0;
      const elevator = approach(current, stick, h * airplane.pitchResponse * (centering ? 4 : 1));
      // Trim holds a straight flight path in the lift plane (the vertical component of the lift
      // axis is the load that does that). On the wheels it rests at the ground attitude, so the
      // stick alone sets the rotation; the airplane takes the attitude it lifts off at as trim.
      let trim = m.clamp(s.pitchTrim ?? incidence, safeMin, safeMax);
      // No more than carries the weight with a little to spare: the last wheel to leave may do
      // so with the nose still coming up.
      liftoffTrim = m.clamp(m.min(incidence, incidenceFor(1.1)), safeMin, safeMax);
      const trimTarget = s.grounded ? 0 : m.clamp(incidenceFor(liftAxis[1] ?? 1), safeMin, safeMax);
      trim +=
        (trimTarget - trim) *
        m.min(1, h * (s.grounded ? 4 : (airplane.autoTrim ?? 1))) *
        (1 - departure);
      trim = m.clamp(trim, safeMin, safeMax);
      const deep = 1.5 * (airplane.stallTransitionAngle ?? 0.12);
      const highest = m.max(
        trim,
        m.min(airplane.stallAngle - camber + deep, incidenceFor(airplane.maxLoadFactor ?? 6)),
      );
      const lowest = m.min(
        trim,
        m.max(-airplane.stallAngle - camber - deep, incidenceFor(airplane.minLoadFactor ?? -3)),
      );
      // Below the reference speed the elevator has less air to work with.
      const flying = trim + elevator * airplane.pitchAuthority * m.min(1, dynamic);
      // On the runway it works about the main wheels with the whole tail arm for leverage:
      // from about four fifths of the stall speed, full back stick lifts the nosewheel and
      // rotates the airplane to its liftoff attitude: the angle of attack that carries the
      // weight with a little to spare at the speed it has, short of the stall.
      const stallSpeed = m.sqrt(
        (2 * weight) /
          (1.225 *
            airplane.wingArea *
            m.max(0.05, airplane.stallAngle * airplane.liftSlope + flapLift)),
      );
      const rotation = s.grounded
        ? m.clamp(elevator, 0, 1) *
          m.min(1, ((s.equivalentAirspeed ?? 0) / (0.8 * stallSpeed)) ** 2) *
          (1 - hoverDirection)
        : 0;
      // Never past the attitude at which the tail meets the runway.
      const liftoff = m.min(m.min(safeMax, groundPitch - 0.02), incidenceFor(1.1));
      // Just off the runway the tail is still within reach of it: the nose stays below the
      // attitude that would put it there, and is freed as the airplane climbs away.
      const clear = groundPitch + (0.8 * s.altitudeAGL) / aircraftTailStrike(spec).arm;
      const target = m.min(
        m.clamp(flying + rotation * m.max(0, liftoff - flying), lowest, highest),
        s.grounded || clear > 0.7 ? Infinity : clear - 0.02 - (pose.pitch - incidence),
      );
      s.elevator = elevator;
      s.pitchTrim = trim;
      const frequency =
        (airplane.pitchFrequency ?? 3.5) *
        (s.grounded ? ratio : m.max(ratio, propwash * 0.6)) *
        m.sqrt(1 - hoverDirection) *
        (1 - departure * (airplane.departure?.pitchBlanking ?? 0)) *
        tailAuthority;
      const pitchDamping = 2 * (airplane.pitchDamping ?? 0.7) * frequency;
      const stallBreak =
        airplane.stallPitchRate *
        separation *
        m.sign(alpha) *
        m.max(frequency, 1) *
        (1 - hoverDirection) *
        (1 - departure * (airplane.departure?.pitchBlanking ?? 0));
      // Euler's equations for the body axes: dω/dt = (M - ω × Iω) / I.
      const full = aircraftInertia(spec);
      const inertia: Vec3 = [
        full[0] * massFraction,
        full[1] * massFraction,
        full[2] * massFraction,
      ];
      // The wing's own pitching moment is the tailplane's to carry, not a disturbance the
      // path-holding response gives way to.
      const spinning = angularAcceleration(
        omega,
        panels ? [moment[0] - panels.moment[0], moment[1], moment[2]] : moment,
        inertia,
        h,
      );
      // The pitch rate the path-holding response flies: what the airplane does on the wheels
      // and without surfaces, and what the assist asks the elevator for with them.
      const assistedPitchRate =
        (s.pitchRate +
          h *
            (frequency ** 2 * (target - incidence) +
              pitchDamping * pathPitch -
              stallBreak -
              spinning[0])) /
        (1 + h * pitchDamping);
      if (surfaces && panels) {
        // Slipstream: a propeller ahead of the tail keeps the elevator and rudder working when
        // the airplane is slow.
        let slipstream = 0;
        if (surfaces.slipstream)
          for (const engine of engines) {
            const thrust = bank[engine.id]?.thrust ?? 0;
            if (engine.propellerDiameter && thrust > 0)
              slipstream +=
                (surfaces.slipstream * thrust) /
                ((m.PI * engine.propellerDiameter ** 2) / 4) /
                engines.length;
          }
        // Rudder travel is held back at high speed too. In the air the assist adds a turn
        // coordinator (rudder against the slip) and a yaw damper (against yawing the turn does
        // not need); on the wheels a slip is the crosswind, and the feet hold the runway.
        const held = m.min(1, airplane.maxControlAuthority ** 2 / m.max(dynamic, 0.0001));
        const rudderPosition = direct
          ? pedal * held
          : s.grounded
            ? feet * held
            : m.clamp(
                pedal * held -
                  TURN_COORDINATION * sideslip +
                  YAW_DAMPER * ((s.yawRate ?? 0) - pathYaw),
                -1,
                1,
              );
        const fin = finMoment(
          surfaces,
          airBody,
          omega,
          density,
          rudderPosition,
          slipstream,
          tailAuthority,
        );
        const tail = tailState(
          surfaces,
          airBody,
          omega,
          density,
          airplane.liftSlope > 0 ? cl / airplane.liftSlope : 0,
          slipstream,
          tailAuthority,
          // The nose turning faster than the flight path is the angle of attack growing.
          s.pitchRate - pathPitch,
        );
        // Everything but the tailplane: wing panels, fin, engines and the gyroscopic terms.
        const turning = angularAcceleration(
          omega,
          [
            moment[0] + fin[0],
            moment[1] + fin[1] + bodyYawMoment(airplane, surfaces, spec.span, airBody, density),
            moment[2] + fin[2],
          ],
          inertia,
          h,
        );
        let elevatorPosition: number;
        if (direct) {
          // The stick is the elevator, about a trim the pilot sets (or, with no trim input,
          // one that slowly follows a held stick). Released, the airplane holds a speed.
          const held = s.elevatorTrim ?? (s.surfaces?.elevator ?? 0) - elevator;
          s.elevatorTrim = m.clamp(
            held + h * ELEVATOR_TRIM_RATE * (input.pitchTrim ?? elevator),
            -1,
            1,
          );
          elevatorPosition = m.clamp(s.elevatorTrim + elevator, -1, 1);
        } else {
          // The assist works the elevator so the nose follows the path-holding response. Where
          // the tailplane cannot give that much, the airplane does what its tail can.
          const wanted = (assistedPitchRate - s.pitchRate) / h;
          elevatorPosition = elevatorForMoment(tail, inertia[0] * (-wanted - turning[0]));
          if (s.grounded) {
            // On the wheels that response gives way to the landing gear, which holds the nose
            // wheel down (or the tail wheel up) with the weight on it. Kept short of the
            // attitude the stick asks for, the pilot winds on more elevator until it comes.
            // Standing or taxiing there is no air for the tailplane to work with: the
            // elevator is simply where the stick puts it.
            const working = m.smoothstep((dynamic - 0.02) / 0.1);
            const short = target - incidence;
            const wound = s.elevatorTrim ?? 0;
            // What was wound on the wrong way for where the nose now is comes off quickly.
            s.elevatorTrim = m.clamp(
              (wound * short < 0 ? wound * m.max(0, 1 - 4 * h) : wound) * working +
                h * GROUND_PITCH_WIND * short * working,
              -1,
              1,
            );
            elevatorPosition =
              working * m.clamp(elevatorPosition + s.elevatorTrim, -1, 1) +
              (1 - working) * elevator;
          } else {
            delete s.elevatorTrim;
            elevatorPosition = m.clamp(elevatorPosition, -1, 1);
          }
          // Rotating, and until it has climbed clear, the tail is within reach of the runway:
          // the assist checks the nose before it gets there, as a pilot watching the attitude
          // does, where the gear's own stop used to.
          if (s.grounded || clear <= 0.7) {
            const over =
              pose.pitch + 0.3 * s.pitchRate - ((s.grounded ? groundPitch : clear) - 0.02);
            if (over > 0) elevatorPosition = m.max(-1, elevatorPosition - 12 * over);
          }
          // And the other way: a nose wheel is not to be run along on by itself, nor a
          // propeller put into the runway with the tail too high.
          if (s.grounded) {
            const under = (airplane.tailwheel ? -0.07 : -0.03) - (pose.pitch + 0.3 * s.pitchRate);
            if (under > 0) elevatorPosition = m.min(1, elevatorPosition + 12 * under);
          }
        }
        s.pitchRate -= h * (turning[0] + tailMoment(tail, elevatorPosition) / inertia[0]);
        s.rollRate += h * turning[2];
        s.yawRate = (s.yawRate ?? 0) + h * turning[1];
        s.surfaces = {
          elevator: elevatorPosition,
          aileron: aileronPosition,
          rudder: rudderPosition,
        };
      } else {
        delete s.surfaces;
        delete s.elevatorTrim;
        s.pitchRate = assistedPitchRate;

        // Roll: ailerons command a rate against roll damping, which fades as the wing separates.
        const rollDamping = airplane.rollResponse * m.max(ratio, 0.05);
        const aileron =
          rollStick *
          wingAuthority *
          airplane.rollAuthority *
          authority *
          (1 - 0.65 * separation) *
          (1 - 2 * departure * (airplane.departure?.aileronReversal ?? 0));
        let gust = 0;
        if (field?.structured) {
          // A vertical gust across the span rolls the airplane like a roll rate would damp it.
          const reach = 0.35 * spec.span;
          const leftTip = windAt(com.map((v, i) => v + (left[i] ?? 0) * reach) as Vec3);
          const rightTip = windAt(com.map((v, i) => v - (left[i] ?? 0) * reach) as Vec3);
          gust = (rollDamping * (dot(leftTip, up) - dot(rightTip, up))) / (2 * reach);
        }
        // Yawing speeds up the outer wing, which lifts more (overbanking in a turn); in a stall
        // the retreating wing stalls deeper instead, rolling toward the inside of the yaw.
        const yawRoll =
          -(rollDamping * 0.12 * m.clamp(cl, -1.5, 1.5) + 2 * separation) *
          (s.yawRate ?? 0) *
          (1 - departure * m.sin(alpha) ** 2);
        s.rollRate =
          (s.rollRate +
            h *
              (rollDamping * aileron +
                (airplane.dihedralEffect ?? 3) * dynamic * sideslip +
                gust +
                yawRoll +
                spinning[2])) /
          (1 + h * rollDamping * (1 - 0.7 * separation));

        // Yaw: weathercock stability, damping and rudder, plus tailwheel steering and tire grip.
        const directional =
          (airplane.directionalStability ?? 4) * dynamic * (1 - departure) * tailAuthority;
        const yawDamping =
          (airplane.yawDamping ?? 1.2) * m.max(ratio, 0.05) * (1 - 0.9 * departure);
        const tail = m.max(m.min(dynamic, airplane.maxControlAuthority ** 2), propwash * 0.35);
        const rudder =
          -m.clamp(input.yaw, -1, 1) *
          airplane.rudderAuthority *
          tailAuthority *
          tail *
          (1 - departure * (airplane.departure?.rudderBlanking ?? 0));
        // Negative yaw damping from separated flow produces autorotation. Cubic aerodynamic
        // damping bounds the rate; no direction is injected into a perfectly symmetric stall.
        const yawRate = s.yawRate ?? 0;
        const spinGain = departure * (airplane.departure?.yawInstability ?? 0) * m.min(dynamic, 1);
        const spinMoment = spinGain * yawRate;
        const spinDamping =
          spinGain * (yawRate / (airplane.departure?.yawSaturationRate ?? 1)) ** 2;
        s.yawRate =
          ((s.yawRate ?? 0) +
            h *
              (directional * sideslip +
                yawDamping * 0.5 * pathYaw +
                rudder +
                spinMoment +
                spinning[1])) /
          (1 + h * (yawDamping + spinDamping));
      }

      if (poweredLift) {
        // Hover moments represent differential rotor pitch or reaction jets. They require
        // powered thrust and vertical vectoring and fade continuously as wing controls take over.
        const thrust = Object.values(bank).reduce((sum, engine) => sum + engine.thrust, 0);
        const hover =
          m.sin(((s.thrustVectorPosition ?? 0) * m.PI) / 2) *
          m.clamp(1 - m.abs(wing.axial) / poweredLift.controlFadeSpeed, 0, 1) *
          m.clamp(thrust / weight, 0, 1);
        const damping = 1 + h * hover * poweredLift.damping;
        s.pitchRate =
          (s.pitchRate + h * hover * input.pitch * poweredLift.pitchAuthority) / damping;
        s.rollRate = (s.rollRate + h * hover * input.roll * poweredLift.rollAuthority) / damping;
        s.yawRate = (s.yawRate - h * hover * input.yaw * poweredLift.yawAuthority) / damping;
        if (hover > 0.5 && s.airspeed < 5) s.stalled = false;
      }

      for (let i = 0; i < 3; i++) s.velocity[i] = (s.velocity[i] ?? 0) + (accel[i] ?? 0) * h;
      if (held) {
        // Held by its tires it goes nowhere and turns nowhere; it can still settle on its
        // struts, and once it has, it is at rest.
        s.velocity[0] = 0;
        s.velocity[2] = 0;
        s.yawRate = 0;
        if (
          m.abs(s.velocity[1]) < 0.003 &&
          m.hypot(s.pitchRate, s.rollRate) < 0.003 &&
          // In balance, not at the top of a bounce.
          m.abs(accel[1] ?? 0) < 0.02 &&
          m.hypot(s.pitchRate - previous.pitchRate, s.rollRate - previous.rollRate) < 0.02 * h
        ) {
          s.velocity[1] = 0;
          s.pitchRate = 0;
          s.rollRate = 0;
        }
      }
      rot = turnBody(rot, [-s.pitchRate, s.yawRate ?? 0, s.rollRate], h);
      // It turns about the center of mass, on the wheels as in flight: the gear's own forces
      // are what pivot it about its main wheels.
      pos = originFromCenterOfMass(
        [
          com[0] + s.velocity[0] * h * travelScale,
          com[1] + s.velocity[1] * h * travelScale,
          com[2] + s.velocity[2] * h * travelScale,
        ],
        rot,
        spec.centerOfMass,
      );
    } else if (helicopter) {
      const wind = windAt(t.pos);
      const air = s.velocity.map((v, i) => v - (wind[i] ?? 0));
      s.airspeed = m.hypot(air[0] ?? 0, air[1] ?? 0, air[2] ?? 0);
      s.mach = s.airspeed / atmosphere.speedOfSound;
      s.equivalentAirspeed = s.airspeed * m.sqrt(density / 1.225);
      const rotorAuthority = aircraftSectionAuthority(spec, s, 'rotor');
      const authority = s.rpm * s.rpm * rotorAuthority;
      const tailAuthority =
        aircraftSectionAuthority(spec, s, 'tail') * aircraftSectionAuthority(spec, s, 'tailRotor');
      if (helicopter.rotor) {
        quaternionAttitude = true;
        s.angleOfAttack = 0;
        s.stalled = false;
        // What the engines can give in this air: the gearbox's limit, until they have no more.
        const available = engines.reduce((sum, engine) => {
          const reading = bank[engine.id];
          if (!reading || reading.failed || !((reading.combustion ?? 0) > 0)) return sum;
          return (
            sum +
            engine.power *
              m.pow(
                m.min(1, density / 1.225 / (engine.ratedDensityRatio ?? 1)),
                engine.densityExponent ?? 1,
              ) *
              (reading.combustion ?? 1)
          );
        }, 0);
        const flown = stepRotorcraft({
          spec,
          helicopter,
          rotor: helicopter.rotor,
          transform: t,
          state: s,
          input,
          mass,
          density,
          windAt,
          ground,
          groundHeight: (x, z, y) => env.groundHeight(x, z, y),
          grip: weatherGrip(env.weather),
          available,
          rated: engines.reduce((sum, engine) => sum + engine.power, 0),
          rotorAuthority,
          tailAuthority,
          ejected: (s.actuators?.eject ?? 0) > 0.08,
          spooling,
          h,
          travel: travelScale,
        });
        if (!flown.ok) {
          rollBack(s, previous);
          break;
        }
        rot = flown.rot;
        pos = flown.pos;
        gear = flown.gear;
        for (const engine of engines) {
          const reading = bank[engine.id];
          if (!reading) continue;
          reading.rpm = flown.rpm;
          reading.shaftPower = flown.shaftPower / engines.length;
        }
        s.rpm = flown.rpm;
      } else {
        // Assisted cyclic commands a bounded tilt that levels itself, kept as Euler angles. Direct
        // cyclic commands body rates and integrates the attitude as a quaternion, as the airplanes
        // do, so the helicopter can loop or point straight down. On the skids both are assisted.
        const direct = input.cyclicMode === 'direct' && !s.grounded;
        quaternionAttitude = direct;
        rot = direct ? quatNormalize(t.rot) : vehicleRotation(s.yaw, -s.pitch, s.roll);
        // The rotor meets the air as a climb or descent through its disc (`axial`, which drives
        // heave damping, vortex ring and autorotation) and a flow across it (`edge`, which drives
        // translational lift, retreating-blade stall and parasite drag). With the disc level these
        // are the vertical and horizontal airspeed. Tilted far over, the disc turns its edge into
        // a climb or dive: pointed straight down, the whole descent runs across the disc.
        const disc: Vec3 = direct ? bodyAxes(rot).up : [0, 1, 0];
        const axial = (air[1] ?? 0) * disc[1];
        const edge = air.map((v, i) => v - axial * (disc[i] ?? 0));
        const horizontal = m.hypot(edge[0] ?? 0, edge[1] ?? 0, edge[2] ?? 0);
        s.angleOfAttack = 0;
        s.stalled = false;
        const agl = m.max(0, t.pos[1] - ground);
        const groundEffect =
          1 + helicopter.groundEffect * m.clamp(1 - agl / helicopter.rotorRadius, 0, 1);
        const translational =
          1 +
          helicopter.translationalLift *
            m.clamp(horizontal / helicopter.translationalLiftSpeed, 0, 1);
        const rotorDragDensity = helicopter.powerLimitedRotor ? density / 1.225 : 1;
        const induced = m.sqrt(
          weight /
            m.max(
              0.01,
              2 * density * m.PI * helicopter.rotorRadius ** 2 * (helicopter.rotorDiscs ?? 1),
            ),
        );
        const descent = -axial / m.max(1, induced);
        const ring =
          helicopter.vortexRing && !s.grounded
            ? m.smoothstep((descent - 0.4) / 0.8) *
              (1 - m.smoothstep((descent - 1.8) / 0.8)) *
              (1 - m.smoothstep(horizontal / m.max(1, 2 * induced))) *
              m.clamp(power * s.rpm, 0, 1)
            : 0;
        s.vortexRing = ring;
        const retreat = helicopter.retreatingBladeSpeed
          ? m.smoothstep(
              (horizontal /
                m.max(
                  1,
                  helicopter.retreatingBladeSpeed *
                    m.max(0.1, s.rpm) *
                    m.min(1, m.sqrt(density / 1.225)),
                ) -
                1) /
                0.35,
            )
          : 0;
        // High density altitude and low rotor RPM erode retreating-blade margin. The
        // separated blades add drag; this estimated trend is not a rotorcraft VNE placard.
        const rotorHorizontalDrag =
          (helicopter.horizontalDrag + s.airspeed * helicopter.quadraticDrag) * (1 + 3 * retreat);
        s.overspeed = retreat > 0;
        // In an engine-out descent the air rising through the disc meets the blades at a
        // steeper angle, as more collective would: about a third of the lever at 10 m/s. That
        // is why the collective goes down in autorotation, and what settles the descent rate.
        const upflow = autorotating
          ? m.min(
              0.8,
              m.max(0, -axial) /
                (0.15 *
                  m.max(
                    20,
                    (engines[0]?.rotorAngularSpeed ?? 40) *
                      helicopter.rotorRadius *
                      m.max(s.rpm, 0.3),
                  )),
            )
          : 0;
        // The collective asks; the blades give up to their limit.
        const collective =
          helicopter.liftLimit === undefined
            ? power + upflow
            : m.min(
                power + upflow,
                (helicopter.liftLimit * (helicopter.liftMass ?? mass)) /
                  (helicopter.liftMultiplier * mass),
              );
        let lift =
          mass *
          9.81 *
          helicopter.liftMultiplier *
          collective *
          s.rpm ** 2 *
          groundEffect *
          translational *
          (density / 1.225) *
          (1 - 0.55 * ring) *
          (1 - 0.35 * retreat);
        if (helicopter.powerLimitedRotor) {
          const shaft = engines.reduce((sum, e, i) => {
            const running = controls[i]?.enabled && !bank[e.id]?.failed;
            const lapse = m.pow(
              m.min(1, density / 1.225 / (e.ratedDensityRatio ?? 1)),
              e.densityExponent ?? 1,
            );
            const shaftPower = running
              ? e.power * (bank[e.id]?.rpm ?? 0) ** 3 * lapse * (bank[e.id]?.combustion ?? 1)
              : 0;
            const reading = bank[e.id];
            if (reading) reading.shaftPower = shaftPower;
            return sum + shaftPower;
          }, 0);
          const discArea = m.PI * helicopter.rotorRadius ** 2 * (helicopter.rotorDiscs ?? 1);
          const profilePower =
            engines.reduce((sum, e) => sum + e.power, 0) *
            (helicopter.profilePowerFraction ?? 0.12) *
            s.rpm ** 3 *
            (density / 1.225);
          const parasitePower = horizontal ** 2 * rotorHorizontalDrag * rotorDragDensity;
          const required = (thrust: number): number => {
            const hoverSquared = thrust / m.max(0.01, 2 * density * discArea);
            // Rationalized momentum-theory root avoids subtracting almost equal values at speed.
            const halfV2 = horizontal ** 2 / 2;
            const vi = m.sqrt(
              hoverSquared ** 2 / m.max(0.000001, m.sqrt(halfV2 ** 2 + hoverSquared ** 2) + halfV2),
            );
            return (
              (thrust * vi) / ((helicopter.rotorEfficiency ?? 0.75) * groundEffect) +
              thrust * m.max(0, axial) +
              profilePower +
              parasitePower
            );
          };
          if (autorotating) {
            // The collective still sets the lift; the rotor pays for it. Air rising through
            // the disc in a descent gives power back, so with the collective down the rotor
            // holds its speed, and a pull at the bottom spends that speed on a last cushion.
            const engine = engines[0];
            const rotor = engine ? bank[engine.id] : undefined;
            const need = required(lift) + lift * m.min(0, axial);
            const stored =
              (helicopter.rotorInertiaTime ?? 2) *
              ((weight * m.sqrt(weight / m.max(0.01, 2 * 1.225 * discArea))) /
                (helicopter.rotorEfficiency ?? 0.75));
            if (rotor)
              rotor.rpm = m.clamp(
                rotor.rpm - (need * h) / (2 * stored * m.max(rotor.rpm, 0.2)),
                0,
                1,
              );
          } else if (required(lift) > shaft) {
            let lo = 0,
              hi = lift;
            for (let iteration = 0; iteration < 18; iteration++) {
              const mid = (lo + hi) / 2;
              if (required(mid) > shaft) hi = mid;
              else lo = mid;
            }
            lift = lo;
          }
        }
        lift *= rotorAuthority;
        if ((s.actuators?.eject ?? 0) > 0.08) lift = 0;
        const axes = bodyAxes(rot);
        const gust = (): void => {
          if (!field?.structured) return;
          // Uneven gusts across the disc tilt it: an updraft ahead lifts the nose, one on the
          // left rolls right.
          const hub = vehicleLocalPoint(t, helicopter.rotorPosition);
          const reach = 0.7 * helicopter.rotorRadius;
          const gustLift = (direction: Vec3, sign: number): number =>
            dot(windAt(hub.map((v, i) => v + sign * (direction[i] ?? 0) * reach) as Vec3), axes.up);
          const k = (helicopter.cyclicDamping * authority * h) / (2 * reach);
          s.pitchRate += k * (gustLift(axes.forward, 1) - gustLift(axes.forward, -1));
          s.rollRate += k * (gustLift(axes.left, 1) - gustLift(axes.left, -1));
        };
        // The tail fin weathervanes the nose into the relative wind, so a banked helicopter's
        // nose follows its curving track instead of crabbing sideways. The fin's restoring moment
        // and its damping both grow with dynamic pressure, so the nose aligns at a rate
        // proportional to airspeed over the tail arm. Below about 7 kt the tail sits in the rotor
        // wake and only the pedals hold the heading.
        const fin = (speed: number): number =>
          ((helicopter.directionalStability ?? 1) *
            m.smoothstep((speed / helicopter.translationalLiftSpeed - 0.2) / 0.5)) /
          spec.length;
        // The nose's turn toward the relative wind, from `lateral` (leftward air speed) and the
        // `speed` of the air across the fin. It is taken from the sideslip left after the turn,
        // which keeps a fast fin stable at large steps. Past about 20° of sideslip the fin stalls
        // and pulls no harder, so the tail rotor out-pulls it in relative winds below about
        // `yawRate × length / 0.34` (34 kt for the OH-6): a pedal turn in a hover goes all the
        // way around in a breeze, as it does in a real helicopter.
        const finTurn = (lateral: number, speed: number): number => {
          const vane = tailAuthority * fin(speed);
          const settled = lateral / (1 + h * vane * speed);
          return vane * m.clamp(settled, -0.34 * speed, 0.34 * speed);
        };
        // Full-pedal yaw rate. In a hover the pedals turn the helicopter at `yawRate`. In forward
        // flight the tail rotor works clear of the main rotor's wake, and full pedal holds about
        // 17° of sideslip against the fin at any speed: a fixed rate would hold only
        // `asin(yawRate × length / airspeed)`, 6° for the OH-6 at 117 kt.
        const pedalRate = (speed: number): number =>
          authority * tailAuthority * m.max(helicopter.yawRate, 0.29 * speed * fin(speed));
        if (direct) {
          // Cyclic tilts the disc against the mast and the hub drags the fuselage after it: the
          // stick sets a pitch and roll rate, which the turning disc damps. Part of the hub moment
          // comes from the blade hinges and the rest from the thrust's lever arm, so control
          // fades as the rotor unloads in a push-over. With `hubStiffness` 0 (a teetering rotor)
          // none is left at zero g.
          const stiffness = helicopter.hubStiffness ?? 0.25;
          const control =
            authority * (stiffness + (1 - stiffness) * m.clamp(lift / weight, 0, 1.5));
          const command =
            (helicopter.cyclicRate ?? helicopter.cyclicResponse / 4) *
            (helicopter.cyclicDamping + 0.3) *
            control;
          const damping = 1 + h * (helicopter.cyclicDamping * authority + 0.3);
          s.pitchRate = (s.pitchRate + h * command * m.clamp(input.pitch, -1, 1)) / damping;
          s.rollRate = (s.rollRate + h * command * m.clamp(input.roll, -1, 1)) / damping;
          gust();
          // The fin works in the fuselage's own frame, so it weathervanes inverted or nose-down.
          const along = dot(air, axes.forward);
          const lateral = dot(air, axes.left);
          const across = m.hypot(along, lateral);
          // The tail rotor yaws the fuselage with the pedals and damps its yawing; with the tail
          // gone the main rotor's torque spins it instead.
          const pedals = 8 * tailAuthority;
          s.yawRate =
            ((s.yawRate ?? 0) +
              h *
                (-8 * m.clamp(input.yaw, -1, 1) * pedalRate(across) +
                  authority * (1 - tailAuthority) * 1.5)) /
            (1 + h * (pedals + 0.1));
          rot = turnBody(rot, [-s.pitchRate, s.yawRate + finTurn(lateral, across), s.rollRate], h);
        } else {
          // Rotor disc response with light attitude damping: cyclic commands a tilt, not velocity.
          s.pitchRate +=
            (input.pitch * helicopter.cyclicTilt - s.pitch) *
              authority *
              h *
              helicopter.cyclicResponse -
            s.pitchRate * h * helicopter.cyclicDamping;
          s.rollRate +=
            (input.roll * helicopter.cyclicTilt - s.roll) *
              authority *
              h *
              helicopter.cyclicResponse -
            s.rollRate * h * helicopter.cyclicDamping;
          if (!s.grounded) gust();
          // A tilt past the limit, left over from direct cyclic, recovers but cannot grow.
          const pitchLimit = m.max(helicopter.maxTilt, m.abs(s.pitch));
          const rollLimit = m.max(helicopter.maxTilt, m.abs(s.roll));
          s.pitch = m.clamp(s.pitch + s.pitchRate * h, -pitchLimit, pitchLimit);
          s.roll = m.clamp(s.roll + s.rollRate * h, -rollLimit, rollLimit);
          // On the skids the fin does not act, and neither does the pedals' extra authority.
          s.yaw -= input.yaw * h * pedalRate(s.grounded ? 0 : horizontal);
          if (!s.grounded) {
            // Leftward air speed (yaw is +left): horizontal speed times the sine of the sideslip.
            const lateral = (air[0] ?? 0) * m.cos(s.yaw) - (air[2] ?? 0) * m.sin(s.yaw);
            s.yaw += h * finTurn(lateral, horizontal);
          }
          if (tailAuthority < 1) {
            s.yawRate =
              ((s.yawRate ?? 0) + h * authority * (1 - tailAuthority) * 1.5) / (1 + h * 0.1);
            s.yaw += s.yawRate * h;
          } else if (s.yawRate) {
            // Pedals set the heading directly here: a direct-cyclic yaw rate does not carry over.
            s.yawRate = 0;
          }
          if (s.grounded) {
            s.pitch = approach(s.pitch, 0, h * helicopter.groundLevelRate);
            s.roll = approach(s.roll, 0, h * helicopter.groundLevelRate);
          }
          rot = vehicleRotation(s.yaw, -s.pitch, s.roll);
        }
        const { up } = bodyAxes(rot);
        const force = [0, -weight, 0];
        for (let i = 0; i < 3; i++)
          force[i] =
            (force[i] ?? 0) +
            (up[i] ?? 0) * lift -
            (direct
              ? axial * (disc[i] ?? 0) * helicopter.verticalDrag +
                (edge[i] ?? 0) * rotorHorizontalDrag
              : (air[i] ?? 0) * (i === 1 ? helicopter.verticalDrag : rotorHorizontalDrag)) *
              rotorDragDensity;
        for (let i = 0; i < 3; i++)
          s.velocity[i] = (s.velocity[i] ?? 0) + ((force[i] ?? 0) / mass) * h;
        if (s.grounded) {
          // On the skids the fuselage turns about its landing contact.
          pos = t.pos.map((v, i) => v + (s.velocity[i] ?? 0) * h * travelScale) as Vec3;
        } else {
          // In flight it turns about the center of mass, as the airplanes do; the contact origin
          // under the skids swings around it.
          const com = vehicleLocalPoint(
            { pos: t.pos, rot: quatNormalize(t.rot) },
            spec.centerOfMass,
          );
          pos = originFromCenterOfMass(
            [
              com[0] + s.velocity[0] * h * travelScale,
              com[1] + s.velocity[1] * h * travelScale,
              com[2] + s.velocity[2] * h * travelScale,
            ],
            rot,
            spec.centerOfMass,
          );
        }
      }
    } else continue;
    if (tank !== undefined && fuel !== undefined) {
      // A governed rotor engine burns by the collective; the others by what they deliver.
      const load = helicopter ? 0.3 + 0.7 * power : 1;
      let flow = 0;
      for (const engine of engines) {
        const e = bank[engine.id];
        if (e && (e.combustion ?? 0) > 0) flow += aircraftFuelFlow(engine, e, load);
      }
      s.fuel = m.max(0, fuel - flow * h);
    }
    const support = env.groundHeight(pos[0], pos[2], pos[1]);
    if (support === undefined || !Number.isFinite(support)) {
      rollBack(s, previous);
      break;
    }
    if (airplane || helicopter?.rotor) {
      // On its wheels or skids, or (with the gear not down and locked) on its belly.
      const onWheels = gear !== undefined && gear.loaded > 0;
      s.grounded = onWheels || pos[1] <= support;
      if (previous.grounded && !s.grounded && liftoffTrim !== undefined) s.pitchTrim = liftoffTrim;
      if (s.grounded) {
        const touchdown = attitude(bodyAxes(rot));
        const hard =
          (!previous.grounded &&
            (s.velocity[1] < -spec.hardLandingSpeed ||
              m.abs(touchdown.roll) > spec.hardLandingRoll ||
              m.abs(touchdown.pitch) > spec.hardLandingPitch)) ||
          // Only a locked-down gear carries the airplane: anything less is a belly landing.
          (s.gearPosition ?? 1) < 1 ||
          support - t.pos[1] > spec.maxSupportStep;
        if (hard || aircraftSectionAuthority(spec, s, 'gear') === 0) damageAircraftBody(spec, s);
        // Struts have an end: the airframe goes no further into the ground than theirs.
        const deepest = onWheels
          ? aircraftGear(spec).legs.reduce((most, leg) => m.max(most, 2 * leg.travel), 0) + 0.05
          : 0;
        if (pos[1] < support - deepest) {
          pos[1] = support - deepest;
          s.velocity[1] = m.max(0, s.velocity[1]);
        }
      }
    } else {
      // A helicopter on the assisted model stands on its skids by the ground laws it had.
      s.grounded = pos[1] <= support;
      if (s.grounded) {
        const touchdown = quaternionAttitude
          ? attitude(bodyAxes(rot))
          : { yaw: s.yaw, pitch: s.pitch, roll: s.roll };
        const hard =
          (!previous.grounded &&
            (s.velocity[1] < -spec.hardLandingSpeed ||
              m.abs(touchdown.roll) > spec.hardLandingRoll ||
              m.abs(touchdown.pitch) > spec.hardLandingPitch)) ||
          // Only a locked-down gear carries it: anything less is a belly landing.
          (helicopter?.fixedGear === false && (s.gearPosition ?? 1) < 1) ||
          support - t.pos[1] > spec.maxSupportStep;
        if (hard || aircraftSectionAuthority(spec, s, 'gear') === 0) damageAircraftBody(spec, s);
        pos[1] = support;
        const sink = -s.velocity[1];
        s.velocity[1] = hard ? m.max(0, sink * 0.08) : 0;
        const deceleration = helicopter?.groundDeceleration ?? 0;
        const groundSpeed = m.hypot(s.velocity[0], s.velocity[2]);
        const scale = m.max(0, groundSpeed - deceleration * h) / m.max(0.0001, groundSpeed);
        s.velocity[0] *= scale;
        s.velocity[2] *= scale;
      }
    }
    const candidate = { ...t, pos, rot };
    if (!resolveAircraftContacts(candidate, s, spec, env, id, travelScale)) {
      rollBack(s, previous);
      break;
    }
    if (!env.contacts && env.canOccupy && !env.canOccupy(candidate, spec, id)) {
      damageAircraftBody(spec, s);
      // A boolean legacy callback cannot supply a sliding plane; recoil at the last clear pose.
      s.velocity = s.velocity.map((v) => -v * 0.08) as Vec3;
    } else t = candidate;
    stepAircraftDebris(s, spec, env, id, h);
    if (quaternionAttitude) {
      const pose = attitude(bodyAxes(t.rot));
      s.yaw = pose.yaw;
      s.pitch = pose.pitch;
      s.roll = pose.roll;
    }
    s.altitudeAGL = m.max(0, t.pos[1] - support);
    s.verticalSpeed = s.velocity[1];
  }
  s.velocity = s.velocity.map((v) => v * travelScale) as Vec3;
  s.airspeed *= travelScale;
  s.verticalSpeed *= travelScale;
  if (s.mach !== undefined) s.mach *= travelScale;
  if (s.equivalentAirspeed !== undefined) s.equivalentAirspeed *= travelScale;
  if (env.boostMode) s.boosted = true;
  else delete s.boosted;
  return { transform: t, state: s };
}
export function flyAircraft(world: World, actor: string, input: AircraftInputData): boolean {
  const mounted = world.get(actor, Mounted);
  if (
    !mounted ||
    !world.has(mounted.vehicle, Aircraft) ||
    !world
      .get(mounted.vehicle, Mountable)
      ?.seats.some((s) => s.id === mounted.seat && s.role === 'driver') ||
    ![
      input.power,
      input.pitch,
      input.roll,
      input.yaw,
      input.thrustVector ?? 0,
      input.mixture ?? 1,
      input.propeller ?? 1,
    ].every(Number.isFinite)
  )
    return false;
  const aircraft = world.get(mounted.vehicle, Aircraft);
  if (!aircraft) return false;
  const ids = new Set(aircraftEngines(aircraft.spec).map((engine) => engine.id));
  const overrides = Object.entries(input.engines ?? {});
  if (
    overrides.some(
      ([id, control]) =>
        !ids.has(id) ||
        (control.power !== undefined && !Number.isFinite(control.power)) ||
        (control.mixture !== undefined && !Number.isFinite(control.mixture)) ||
        (control.propeller !== undefined && !Number.isFinite(control.propeller)) ||
        (control.enabled !== undefined && typeof control.enabled !== 'boolean'),
    )
  )
    return false;
  world.set(mounted.vehicle, AircraftInput, {
    ...input,
    power: m.clamp(input.power, 0, 1),
    pitch: m.clamp(input.pitch, -1, 1),
    roll: m.clamp(input.roll, -1, 1),
    yaw: m.clamp(input.yaw, -1, 1),
    ...(input.mixture === undefined ? {} : { mixture: m.clamp(input.mixture, 0, 1) }),
    ...(input.propeller === undefined ? {} : { propeller: m.clamp(input.propeller, 0, 1) }),
    ...(input.thrustVector === undefined
      ? {}
      : { thrustVector: m.clamp(input.thrustVector, 0, 1) }),
    ...(input.engines
      ? {
          engines: Object.fromEntries(
            overrides.map(([id, control]) => [
              id,
              {
                ...(control.power === undefined ? {} : { power: m.clamp(control.power, 0, 1) }),
                ...(control.mixture === undefined
                  ? {}
                  : { mixture: m.clamp(control.mixture, 0, 1) }),
                ...(control.propeller === undefined
                  ? {}
                  : { propeller: m.clamp(control.propeller, 0, 1) }),
                ...(control.enabled === undefined ? {} : { enabled: control.enabled }),
              },
            ]),
          ),
        }
      : {}),
  });
  return true;
}
export function installAircraft(world: World, environment?: AircraftEnvironment): void {
  const env = environment ?? {
    groundHeight: (x: number, z: number) => {
      const field = groundFieldOf(world);
      return field ? field.sampleHeight(x, z) : 0;
    },
  };
  world.addSystem(
    (w, ctx) => {
      const weather = env.weather ?? weatherOf(w);
      const time = ctx.tick * ctx.dt;
      const currentEnvironment = {
        ...env,
        boostMode: env.boostMode ?? isBoostMode(w),
        time,
        ...(weather ? { weather } : {}),
      };
      for (const [id, t, aircraft, state] of w.query(Transform, Aircraft, AircraftState)) {
        const input = w.get(id, AircraftInput) ?? IDLE_AIRCRAFT_INPUT;
        // A parked airplane still steps until its flaps reach the selection; the gear cannot
        // move on the ground, but its position is initialized by the first step.
        const surfacesSettled =
          (aircraft.spec.model !== 'airplane' && state.gearPosition !== undefined) ||
          state.crashed ||
          (state.gearPosition !== undefined &&
            state.flapPosition === Number(input.flaps) &&
            (!aircraft.spec.poweredLift ||
              state.thrustVectorPosition === (input.thrustVector ?? 0)));
        if (
          state.grounded &&
          !state.crashed &&
          !input.engine &&
          state.rpm === 0 &&
          Object.values(state.engines ?? {}).every((engine) => engine.rpm === 0) &&
          m.hypot(...state.velocity) === 0 &&
          !state.debris?.length &&
          surfacesSettled &&
          actuatorsSettled(aircraft.spec.actuators, state.actuators, input.actuators)
        )
          continue;
        const result = stepAircraft(t, state, input, aircraft.spec, ctx.dt, currentEnvironment, id);
        w.set(id, Transform, result.transform);
        w.set(id, AircraftState, result.state);
      }
    },
    { phase: 'physics', name: 'aircraft' },
  );
  installMountedSeats(world);
}
