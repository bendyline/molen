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
import { type ComponentType, defineComponent, Transform, type TransformData } from './component';
import { dmath as m } from './dmath';
import { approach, quatFromAxisAngle, quatMul, quatNormalize, quatRotateVec3 } from './math3d';
import { groundFieldOf } from './terrain';
import {
  installMountedSeats,
  Mountable,
  type MountableData,
  Mounted,
  vehicleLocalPoint,
  vehicleRotation,
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
export interface AircraftEnvironment {
  groundHeight(x: number, z: number, y?: number): number | undefined;
  /** Uniform wind override in m/s; replaces the weather's wind field, turbulence included. */
  wind?: [number, number, number];
  /** Optional shared atmospheric conditions. Otherwise retain the stock altitude-density model. */
  weather?: WeatherData;
  /** Simulation time in seconds at the start of the step; moves gusts and turbulence. Default 0. */
  time?: number;
  /** Called at <= 1/120s and <= 1m intervals; positions and rotations are absolute. */
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
  const engines = engineStates(state, bank);
  const current = engines[engine];
  if (!current) return false;
  engines[engine] = { ...current, failed, thrust: failed ? 0 : current.thrust };
  world.patch(aircraft, AircraftState, { engines });
  return true;
}
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
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
function flightAxes(yaw: number, pitch: number, roll: number): Axes {
  return bodyAxes(vehicleRotation(yaw, -pitch, roll));
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
  const excess = m.max(0, m.abs(alpha) - airplane.stallAngle);
  const blend = m.clamp(excess / (airplane.stallTransitionAngle ?? 0.12), 0, 1);
  const separation = blend * blend * (3 - 2 * blend);
  const flapLift = flaps * airplane.flapLift;
  const attached =
    m.clamp(alpha, -airplane.stallAngle, airplane.stallAngle) * airplane.liftSlope + flapLift;
  // Separated flow loses lift progressively and has no broadside lifting force.
  const separated =
    m.sign(alpha) *
      m.max(
        airplane.postStallLift,
        airplane.stallAngle * airplane.liftSlope - excess * airplane.postStallDecay,
      ) *
      m.cos(alpha) +
    flapLift * airplane.postStallFlapEffect * m.cos(alpha);
  const cl = attached + (separated - attached) * separation;
  const lift = 0.5 * density * speed * speed * airplane.wingArea * cl;
  // Perpendicular to wing-plane airflow, including in a descent or backwards flow.
  const liftAxis = axes.up.map(
    (v, i) => v * m.cos(angleOfAttack) + (axes.forward[i] ?? 0) * m.sin(angleOfAttack),
  );
  return { axial, lateral, speed, angleOfAttack, alpha, separation, cl, lift, liftAxis };
}
/** Move a hydraulic surface toward its selection over `time` seconds for full travel; 0 is instant. */
function travel(position: number, selected: boolean, time: number | undefined, h: number): number {
  const target = selected ? 1 : 0;
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
 * wheels, a steerable tailwheel and tire side grip that fades as the wing takes the weight
 * resist weathervaning and propeller swing. Wind comes from the weather's wind field, sampled at
 * the center of mass and both wingtips so turbulence also rolls the airplane.
 *
 * Helicopters keep the assisted model: cyclic commands a bounded disc tilt.
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
  const speed = m.hypot(...s.velocity);
  const steps = m.max(1, m.ceil(dt * m.max(120, speed)));
  const h = dt / steps;
  const power = m.clamp(input.power, 0, 1);
  const controls = engines.map((engine) => {
    const override =
      input.engines && Object.hasOwn(input.engines, engine.id)
        ? input.engines[engine.id]
        : undefined;
    return {
      power: m.clamp(override?.power ?? power, 0, 1),
      enabled: input.engine && (override?.enabled ?? true),
    };
  });
  const field = env.wind === undefined && env.weather ? windField(env.weather) : undefined;
  const surface = (x: number, z: number): number | undefined => env.groundHeight(x, z);
  const start = env.time ?? 0;
  const weight = 9.81 * spec.mass;
  for (let n = 0; n < steps; n++) {
    const ground = env.groundHeight(t.pos[0], t.pos[2], t.pos[1]);
    if (ground === undefined || !Number.isFinite(ground)) {
      s.waitingForTerrain = true;
      break;
    }
    const previous = { ...s, velocity: [...s.velocity] as [number, number, number] };
    // Replace the bank on every substep: rollback at a terrain gap must include every engine.
    const bank = engineStates(s, engines);
    let propwash = 0;
    let ratedPower = 0;
    for (const [index, engine] of engines.entries()) {
      const e = bank[engine.id];
      const control = controls[index];
      if (!e || !control) continue;
      const running = control.enabled && !e.failed && !s.crashed;
      e.rpm = approach(
        e.rpm,
        running ? engine.idleRpm + control.power * (1 - engine.idleRpm) : 0,
        h * engine.spoolRate,
      );
      e.rotorAngle = (e.rotorAngle + e.rpm * engine.rotorAngularSpeed * h) % m.TAU;
      e.thrust = 0;
      propwash += running ? engine.power * control.power * e.rpm : 0;
      ratedPower += engine.power;
    }
    s.engines = bank;
    s.rpm = engines.reduce((rpm, engine) => m.max(rpm, bank[engine.id]?.rpm ?? 0), 0);
    s.rotorAngle = bank[engines[0]?.id ?? 'main']?.rotorAngle ?? 0;
    propwash /= m.max(1, ratedPower);
    if (s.crashed) continue;
    const time = start + n * h;
    const atmosphere = env.weather ? sampleAtmosphere(env.weather, t.pos[1]) : undefined;
    const density = atmosphere?.densityKgM3 ?? 1.225 * m.exp(-m.max(0, t.pos[1]) / 8500);
    const slope = field?.terrain ? terrainSlope(surface, t.pos[0], t.pos[2]) : undefined;
    const windAt = (point: Vec3): Vec3 =>
      env.wind
        ? [env.wind[0], env.wind[1], env.wind[2]]
        : field
          ? field.at(point, time, ground, slope)
          : [0, 0, 0];
    let rot: Quat;
    let pos: Vec3;
    // Share of the weight still on the wheels once the wing and thrust carry the rest.
    let wheelLoad = 1;
    let liftoffTrim: number | undefined;
    if (airplane) {
      // A state without positions starts at the selection, as the instant gear and flaps did.
      // The gear's weight-on-wheels lock holds it still on the ground; flaps move anywhere.
      const gearFrom = s.gearPosition ?? (input.gear ? 1 : 0);
      s.gearPosition = s.grounded
        ? gearFrom
        : travel(gearFrom, input.gear, airplane.gearTransitTime, h);
      s.flapPosition = travel(
        s.flapPosition ?? (input.flaps ? 1 : 0),
        input.flaps,
        airplane.flapTransitTime,
        h,
      );
      const gearOut = s.gearPosition;
      const flapsOut = s.flapPosition;
      rot = quatNormalize(t.rot);
      const axes = bodyAxes(rot);
      const { forward, up, left } = axes;
      const com = vehicleLocalPoint({ pos: t.pos, rot }, spec.centerOfMass);
      const wind = windAt(com);
      const air = s.velocity.map((v, i) => v - (wind[i] ?? 0));
      s.airspeed = m.hypot(air[0] ?? 0, air[1] ?? 0, air[2] ?? 0);
      const wing = wingForces(air, axes, airplane, flapsOut, density);
      const { lateral, angleOfAttack, alpha, separation, cl, lift, liftAxis } = wing;
      // Equivalent airspeed relative to the reference speed: control power grows with it up to
      // maxControlAuthority, stability and damping without limit.
      const ratio = (s.airspeed * m.sqrt(density / 1.225)) / airplane.controlAuthoritySpeed;
      const authority = m.min(ratio, airplane.maxControlAuthority);
      const dynamic = ratio * ratio;
      s.angleOfAttack = angleOfAttack;
      // A stall is an incidence limit, not an arbitrary true-airspeed switch.
      s.stalled = !s.grounded && wing.speed > 1 && m.abs(alpha) > airplane.stallAngle;
      const sideslip = m.atan2(lateral, m.max(1, s.airspeed));
      s.sideslip = sideslip;
      const drag =
        0.5 *
        density *
        s.airspeed ** 2 *
        airplane.wingArea *
        (airplane.profileDrag +
          cl * cl * airplane.inducedDrag +
          gearOut * airplane.gearDrag +
          flapsOut * airplane.flapDrag +
          separation * airplane.stallDrag * m.sin(alpha) ** 2);
      const force: Vec3 = [0, -weight, 0];
      for (let i = 0; i < 3; i++)
        force[i] =
          (force[i] ?? 0) +
          (liftAxis[i] ?? 0) * lift -
          ((air[i] ?? 0) / m.max(1, s.airspeed)) * drag -
          (left[i] ?? 0) * lateral * spec.mass * airplane.lateralDamping * m.min(1, authority);
      // Body-axis moments in N m: +X left (nose down), +Y up (nose left), +Z forward (right bank).
      const moment: Vec3 = [0, 0, 0];
      const omega: Vec3 = [-s.pitchRate, s.yawRate ?? 0, s.rollRate];
      const effects = airplane.propellerEffects ?? 0;
      for (const [index, engine] of engines.entries()) {
        const e = bank[engine.id];
        const control = controls[index];
        if (!e || !control) continue;
        const commandedRpm = engine.idleRpm + control.power * (1 - engine.idleRpm);
        const axisLength = m.max(0.0001, m.hypot(...engine.thrustAxis));
        const thrustAxis = vehicleLocalPoint({ pos: [0, 0, 0], rot }, engine.thrustAxis);
        const propellerSpeed = dot(air, thrustAxis) / axisLength;
        const running = control.enabled && !e.failed;
        const spooled = m.clamp(e.rpm / m.max(0.01, commandedRpm), 0, 1);
        // Engine failures remove powered thrust immediately; the rotor continues to spool down.
        e.thrust = running
          ? m.min(
              engine.maxThrust ?? airplane.maxThrust,
              (engine.power * (engine.propellerEfficiency ?? airplane.propellerEfficiency)) /
                m.max(engine.minPropellerSpeed ?? airplane.minPropellerSpeed, propellerSpeed),
            ) *
            control.power *
            spooled
          : 0;
        for (let i = 0; i < 3; i++)
          force[i] = (force[i] ?? 0) + ((thrustAxis[i] ?? 0) / axisLength) * e.thrust;
        // (r × F).y in body coordinates.
        moment[1] +=
          (((engine.position[2] - spec.centerOfMass[2]) * engine.thrustAxis[0] -
            (engine.position[0] - spec.centerOfMass[0]) * engine.thrustAxis[2]) *
            e.thrust) /
          axisLength;
        if (effects > 0) {
          // A clockwise propeller (seen from the cockpit) rolls the airframe left against its
          // torque, and its slipstream, P-factor and precession yaw the nose left.
          const spin = engine.propellerRotation === 'counterclockwise' ? -1 : 1;
          const axis = engine.thrustAxis.map((v) => v / axisLength);
          const torque = running
            ? (engine.power * control.power * spooled) / engine.rotorAngularSpeed
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
      const accel = force.map((f) => f / spec.mass);
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
      s.loadFactor = dot([force[0], force[1] + weight, force[2]], up) / weight;
      const supported = m.clamp((force[1] + weight) / weight, 0, 1);
      wheelLoad = 1 - supported;

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
      liftoffTrim = m.clamp(incidence, safeMin, safeMax);
      const trimTarget = s.grounded ? 0 : m.clamp(incidenceFor(liftAxis[1] ?? 1), safeMin, safeMax);
      trim += (trimTarget - trim) * m.min(1, h * (s.grounded ? 4 : (airplane.autoTrim ?? 1)));
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
      const target = m.clamp(
        trim + elevator * airplane.pitchAuthority * m.min(1, dynamic),
        lowest,
        highest,
      );
      s.elevator = elevator;
      s.pitchTrim = trim;
      const frequency =
        (airplane.pitchFrequency ?? 3.5) * (s.grounded ? ratio : m.max(ratio, propwash * 0.6));
      const pitchDamping = 2 * (airplane.pitchDamping ?? 0.7) * frequency;
      const stallBreak = airplane.stallPitchRate * separation * m.sign(alpha) * m.max(frequency, 1);
      // Weight on the wheels holds the nose at its resting attitude until the elevator lifts it.
      const gear = s.grounded ? 8 * wheelLoad : 0;

      const rollInertia = airplane.rollInertia ?? spec.mass * (0.14 * spec.span) ** 2;
      const pitchInertia = airplane.pitchInertia ?? spec.mass * (0.18 * spec.length) ** 2;
      const yawInertia =
        airplane.yawInertia ?? (spec.mass * (spec.span ** 2 + spec.length ** 2)) / 12;
      // Euler's equations for the body axes: ω̇ = (M - ω × Iω) / I.
      const spinning: Vec3 = [
        (moment[0] - (rollInertia - yawInertia) * omega[1] * omega[2]) / pitchInertia,
        (moment[1] - (pitchInertia - rollInertia) * omega[2] * omega[0]) / yawInertia,
        (moment[2] - (yawInertia - pitchInertia) * omega[0] * omega[1]) / rollInertia,
      ];
      s.pitchRate =
        (s.pitchRate +
          h *
            (frequency ** 2 * (target - incidence) +
              pitchDamping * pathPitch -
              stallBreak -
              gear * pose.pitch -
              spinning[0])) /
        (1 + h * (pitchDamping + gear / 2));

      // Roll: ailerons command a rate against roll damping, which fades as the wing separates.
      const rollDamping = airplane.rollResponse * m.max(ratio, 0.05);
      const aileron =
        m.clamp(input.roll, -1, 1) * airplane.rollAuthority * authority * (1 - 0.65 * separation);
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
        -(rollDamping * 0.12 * m.clamp(cl, -1.5, 1.5) + 2 * separation) * (s.yawRate ?? 0);
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
      const directional = (airplane.directionalStability ?? 4) * dynamic;
      const yawDamping = (airplane.yawDamping ?? 1.2) * m.max(ratio, 0.05);
      const tail = m.max(m.min(dynamic, airplane.maxControlAuthority ** 2), propwash * 0.35);
      const rudder = -m.clamp(input.yaw, -1, 1) * airplane.rudderAuthority * tail;
      let grip = 0;
      let steer = 0;
      if (s.grounded) {
        const rolling = dot(s.velocity, forward);
        grip = airplane.groundTrackRate * m.max(0.1, wheelLoad);
        steer =
          -m.clamp(input.yaw, -1, 1) *
          m.min(m.abs(rolling) / airplane.groundSteerSpeed, 0.65) *
          m.sign(rolling);
      }
      s.yawRate =
        ((s.yawRate ?? 0) +
          h *
            (directional * sideslip +
              yawDamping * 0.5 * pathYaw +
              rudder +
              spinning[1] +
              grip * steer)) /
        (1 + h * (yawDamping + grip));

      const turn: Vec3 = [-s.pitchRate, s.yawRate, s.rollRate];
      const angle = m.hypot(...turn) * h;
      if (angle > 0)
        rot = quatNormalize(
          quatMul(rot, quatFromAxisAngle(turn.map((v) => (v * h) / angle) as Vec3, angle)),
        );
      for (let i = 0; i < 3; i++) s.velocity[i] = (s.velocity[i] ?? 0) + (accel[i] ?? 0) * h;
      if (s.grounded) {
        // On the wheels the airframe pivots about its landing contact: raising the nose must
        // not lift the wheels off the runway.
        pos = t.pos.map((v, i) => v + (s.velocity[i] ?? 0) * h) as Vec3;
      } else {
        // In flight it turns about the center of mass; place the contact origin around it.
        const offset = quatRotateVec3(rot, spec.centerOfMass);
        pos = [
          com[0] + s.velocity[0] * h - offset[0],
          com[1] + s.velocity[1] * h - offset[1],
          com[2] + s.velocity[2] * h - offset[2],
        ];
      }
    } else if (helicopter) {
      const wind = windAt(t.pos);
      const air = s.velocity.map((v, i) => v - (wind[i] ?? 0));
      s.airspeed = m.hypot(air[0] ?? 0, air[1] ?? 0, air[2] ?? 0);
      const authority = s.rpm * s.rpm;
      // Rotor disc response with light attitude damping: cyclic commands a tilt, not velocity.
      s.pitchRate +=
        (input.pitch * helicopter.cyclicTilt - s.pitch) *
          authority *
          h *
          helicopter.cyclicResponse -
        s.pitchRate * h * helicopter.cyclicDamping;
      s.rollRate +=
        (input.roll * helicopter.cyclicTilt - s.roll) * authority * h * helicopter.cyclicResponse -
        s.rollRate * h * helicopter.cyclicDamping;
      if (field?.structured && !s.grounded) {
        // Uneven gusts across the disc tilt it: an updraft ahead lifts the nose, one on the
        // left rolls right.
        const axes = flightAxes(s.yaw, s.pitch, s.roll);
        const hub = vehicleLocalPoint(t, helicopter.rotorPosition);
        const reach = 0.7 * helicopter.rotorRadius;
        const lift = (direction: Vec3, sign: number): number =>
          dot(windAt(hub.map((v, i) => v + sign * (direction[i] ?? 0) * reach) as Vec3), axes.up);
        const k = (helicopter.cyclicDamping * authority * h) / (2 * reach);
        s.pitchRate += k * (lift(axes.forward, 1) - lift(axes.forward, -1));
        s.rollRate += k * (lift(axes.left, 1) - lift(axes.left, -1));
      }
      s.pitch = m.clamp(s.pitch + s.pitchRate * h, -helicopter.maxTilt, helicopter.maxTilt);
      s.roll = m.clamp(s.roll + s.rollRate * h, -helicopter.maxTilt, helicopter.maxTilt);
      s.yaw -= input.yaw * authority * h * helicopter.yawRate;
      if (s.grounded) {
        s.pitch = approach(s.pitch, 0, h * helicopter.groundLevelRate);
        s.roll = approach(s.roll, 0, h * helicopter.groundLevelRate);
      }
      rot = vehicleRotation(s.yaw, -s.pitch, s.roll);
      const { up } = flightAxes(s.yaw, s.pitch, s.roll);
      s.angleOfAttack = 0;
      s.stalled = false;
      const agl = m.max(0, t.pos[1] - ground);
      const groundEffect =
        1 + helicopter.groundEffect * m.clamp(1 - agl / helicopter.rotorRadius, 0, 1);
      const translational =
        1 +
        helicopter.translationalLift *
          m.clamp(m.hypot(air[0] ?? 0, air[2] ?? 0) / helicopter.translationalLiftSpeed, 0, 1);
      const lift =
        spec.mass *
        9.81 *
        helicopter.liftMultiplier *
        power *
        s.rpm ** 2 *
        groundEffect *
        translational *
        (density / 1.225);
      const force = [0, -weight, 0];
      for (let i = 0; i < 3; i++)
        force[i] =
          (force[i] ?? 0) +
          (up[i] ?? 0) * lift -
          (air[i] ?? 0) *
            (i === 1
              ? helicopter.verticalDrag
              : helicopter.horizontalDrag + s.airspeed * helicopter.quadraticDrag);
      for (let i = 0; i < 3; i++)
        s.velocity[i] = (s.velocity[i] ?? 0) + ((force[i] ?? 0) / spec.mass) * h;
      pos = t.pos.map((v, i) => v + (s.velocity[i] ?? 0) * h) as Vec3;
    } else continue;
    const support = env.groundHeight(pos[0], pos[2], pos[1]);
    if (support === undefined || !Number.isFinite(support)) {
      rollBack(s, previous);
      break;
    }
    s.grounded = pos[1] <= support;
    if (previous.grounded && !s.grounded && liftoffTrim !== undefined) s.pitchTrim = liftoffTrim;
    if (s.grounded) {
      const touchdown = airplane
        ? attitude(bodyAxes(rot))
        : { yaw: s.yaw, pitch: s.pitch, roll: s.roll };
      const hard =
        (!previous.grounded &&
          (s.velocity[1] < -spec.hardLandingSpeed ||
            m.abs(touchdown.roll) > spec.hardLandingRoll ||
            m.abs(touchdown.pitch) > spec.hardLandingPitch)) ||
        // Only a locked-down gear carries the airplane: anything less is a belly landing.
        (airplane !== undefined && (s.gearPosition ?? 1) < 1) ||
        support - t.pos[1] > spec.maxSupportStep;
      s.crashed = hard;
      pos[1] = support;
      s.velocity[1] = 0;
      const deceleration = airplane
        ? input.brake
          ? airplane.brakeDeceleration
          : airplane.rollingDeceleration
        : (helicopter?.groundDeceleration ?? 0);
      const groundSpeed = m.hypot(s.velocity[0], s.velocity[2]);
      const scale = m.max(0, groundSpeed - deceleration * h) / m.max(0.0001, groundSpeed);
      s.velocity[0] *= scale;
      s.velocity[2] *= scale;
      if (airplane) {
        // Tires hold the rolling direction to the nose, with grip shared with the wing's lift.
        const sin = m.sin(touchdown.yaw);
        const cos = m.cos(touchdown.yaw);
        const along = s.velocity[0] * sin + s.velocity[2] * cos;
        const grip = h * airplane.groundTrackRate * m.max(0.1, wheelLoad);
        s.velocity[0] = approach(s.velocity[0], along * sin, grip);
        s.velocity[2] = approach(s.velocity[2], along * cos, grip);
        // The gear holds the wings level and bounds the nose between its wheels and tail.
        const pitch = m.clamp(touchdown.pitch, -0.03, airplane.maxGroundPitch);
        if (pitch !== touchdown.pitch && (pitch - touchdown.pitch) * s.pitchRate < 0)
          s.pitchRate = 0;
        s.rollRate = 0;
        rot = vehicleRotation(
          touchdown.yaw,
          -pitch,
          approach(touchdown.roll, 0, h * airplane.groundLevelRate),
        );
      }
    }
    const candidate = { ...t, pos, rot };
    if (env.canOccupy && !env.canOccupy(candidate, spec, id)) {
      s.crashed = true;
      // Keep the last unobstructed position; recovery remains an explicit action.
    } else t = candidate;
    if (s.crashed) {
      s.velocity = [0, 0, 0];
      s.airspeed = 0;
      s.pitchRate = 0;
      s.rollRate = 0;
      if (s.yawRate !== undefined) s.yawRate = 0;
      for (const engine of Object.values(bank)) engine.thrust = 0;
    }
    if (airplane) {
      const pose = attitude(bodyAxes(t.rot));
      s.yaw = pose.yaw;
      s.pitch = pose.pitch;
      s.roll = pose.roll;
    }
    s.altitudeAGL = m.max(0, t.pos[1] - support);
    s.verticalSpeed = s.velocity[1];
  }
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
    ![input.power, input.pitch, input.roll, input.yaw].every(Number.isFinite)
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
    ...(input.engines
      ? {
          engines: Object.fromEntries(
            overrides.map(([id, control]) => [
              id,
              {
                ...(control.power === undefined ? {} : { power: m.clamp(control.power, 0, 1) }),
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
      const currentEnvironment = weather ? { ...env, weather, time } : { ...env, time };
      for (const [id, t, aircraft, state] of w.query(Transform, Aircraft, AircraftState)) {
        const input = w.get(id, AircraftInput) ?? IDLE_AIRCRAFT_INPUT;
        // A parked airplane still steps until its flaps reach the selection; the gear cannot
        // move on the ground, but its position is initialized by the first step.
        const surfacesSettled =
          aircraft.spec.model !== 'airplane' ||
          state.crashed ||
          (state.gearPosition !== undefined && state.flapPosition === (input.flaps ? 1 : 0));
        if (
          state.grounded &&
          !input.engine &&
          state.rpm === 0 &&
          Object.values(state.engines ?? {}).every((engine) => engine.rpm === 0) &&
          m.hypot(...state.velocity) === 0 &&
          surfacesSettled
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
