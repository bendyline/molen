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
import { approach } from './math3d';
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
  groundHeight(x: number, z: number): number | undefined;
  wind?: [number, number, number];
  /** Optional shared atmospheric conditions. Otherwise retain the stock altitude-density model. */
  weather?: WeatherData;
  /** Called at <= 1/120s and <= 1m intervals; positions and rotations are absolute. */
  canOccupy?(transform: TransformData, spec: AircraftSpec, entity: string): boolean;
}
function dot(a: number[], b: number[]): number {
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
function flightAxes(yaw: number, pitch: number, roll: number) {
  const axes = {
    pos: [0, 0, 0] as [number, number, number],
    rot: vehicleRotation(yaw, -pitch, roll),
  };
  return {
    forward: vehicleLocalPoint(axes, [0, 0, 1]),
    up: vehicleLocalPoint(axes, [0, 1, 0]),
    left: vehicleLocalPoint(axes, [1, 0, 0]),
  };
}
function wingForces(
  air: number[],
  axes: ReturnType<typeof flightAxes>,
  airplane: AirplanePhysicsSpec,
  flaps: boolean,
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
  const flapLift = flaps ? airplane.flapLift : 0;
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
/** Force-based, assisted flight, substepped independently of rendering. No second physics body. */
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
  for (let n = 0; n < steps; n++) {
    const ground = env.groundHeight(t.pos[0], t.pos[2]);
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
    const atmosphere = env.weather ? sampleAtmosphere(env.weather, t.pos[1]) : undefined;
    const wind = env.wind ?? atmosphere?.windVelocity ?? [0, 0, 0];
    const air = s.velocity.map((v, i) => v - (wind[i] ?? 0));
    s.airspeed = m.hypot(air[0] ?? 0, air[1] ?? 0, air[2] ?? 0);
    const horizontal = m.hypot(s.velocity[0], s.velocity[2]);
    const density = atmosphere?.densityKgM3 ?? 1.225 * m.exp(-m.max(0, t.pos[1]) / 8500);
    const wing = airplane
      ? wingForces(air, flightAxes(s.yaw, s.pitch, s.roll), airplane, input.flaps, density)
      : undefined;
    const authority = airplane
      ? m.clamp(
          ((wing?.speed ?? 0) * m.sqrt(density / 1.225)) / airplane.controlAuthoritySpeed,
          0,
          airplane.maxControlAuthority,
        )
      : s.rpm * s.rpm;
    if (airplane && wing) {
      // Elevator/rudder retain a little propwash authority; separated wings lose aileron bite.
      const tailAuthority = m.max(authority * (1 - 0.35 * wing.separation), propwash * 0.25);
      s.pitchRate = approach(
        s.pitchRate,
        input.pitch * airplane.pitchAuthority * tailAuthority -
          (s.grounded ? 0 : airplane.stallPitchRate * wing.separation * m.sign(wing.alpha)),
        h * airplane.pitchResponse,
      );
      s.rollRate = approach(
        s.rollRate,
        input.roll * airplane.rollAuthority * authority * (1 - 0.65 * wing.separation),
        h * airplane.rollResponse,
      );
      const nextPitch = s.pitch + s.pitchRate * h;
      s.pitch = m.clamp(
        nextPitch,
        s.grounded ? -0.03 : -airplane.maxPitch,
        s.grounded ? airplane.maxGroundPitch : airplane.maxPitch,
      );
      // Do not store angular momentum against an attitude stop. In particular the ground
      // pitch limit must not release a hidden nose-up rate the moment the wheels lift off.
      if (s.pitch !== nextPitch) s.pitchRate = 0;
      const nextRoll = s.roll + s.rollRate * h;
      s.roll = m.clamp(nextRoll, -airplane.maxRoll, airplane.maxRoll);
      if (s.roll !== nextRoll) s.rollRate = 0;
      s.yaw -=
        input.yaw *
        (s.grounded
          ? m.min(horizontal / airplane.groundSteerSpeed, 0.65)
          : airplane.rudderAuthority * tailAuthority) *
        h;
      if (!s.grounded) {
        // Follow the turn the lift actually produces. g*tan(bank)/speed assumes level,
        // unstalled flight and otherwise turns the nose away from the flight path.
        const horizontalAirSquared = (air[0] ?? 0) ** 2 + (air[2] ?? 0) ** 2;
        const turn =
          (((air[2] ?? 0) * (wing.liftAxis[0] ?? 0) - (air[0] ?? 0) * (wing.liftAxis[2] ?? 0)) *
            wing.lift) /
          (spec.mass * m.max(horizontalAirSquared, airplane.coordinatedTurnMinSpeed ** 2));
        const sideslip = m.atan2(wing.lateral, m.max(1, wing.speed));
        s.yaw += (turn + sideslip * (airplane.yawStability ?? 1) * authority * m.cos(s.roll)) * h;
      }
      if (s.grounded) s.roll = approach(s.roll, 0, h * airplane.groundLevelRate);
    } else if (helicopter) {
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
      s.pitch = m.clamp(s.pitch + s.pitchRate * h, -helicopter.maxTilt, helicopter.maxTilt);
      s.roll = m.clamp(s.roll + s.rollRate * h, -helicopter.maxTilt, helicopter.maxTilt);
      s.yaw -= input.yaw * authority * h * helicopter.yawRate;
      if (s.grounded) {
        s.pitch = approach(s.pitch, 0, h * helicopter.groundLevelRate);
        s.roll = approach(s.roll, 0, h * helicopter.groundLevelRate);
      }
    }
    let rot = vehicleRotation(s.yaw, -s.pitch, s.roll);
    const axes = flightAxes(s.yaw, s.pitch, s.roll);
    const { up, left } = axes;
    const force = [0, -9.81 * spec.mass, 0];
    if (airplane) {
      const {
        lateral,
        speed: wingSpeed,
        angleOfAttack,
        alpha,
        separation,
        cl,
        lift,
        liftAxis,
      } = wingForces(air, axes, airplane, input.flaps, density);
      s.angleOfAttack = angleOfAttack;
      // A stall is an incidence limit, not an arbitrary true-airspeed switch.
      s.stalled = !s.grounded && wingSpeed > 1 && m.abs(alpha) > airplane.stallAngle;
      const drag =
        0.5 *
        density *
        s.airspeed ** 2 *
        airplane.wingArea *
        (airplane.profileDrag +
          cl * cl * airplane.inducedDrag +
          (input.gear ? airplane.gearDrag : 0) +
          (input.flaps ? airplane.flapDrag : 0) +
          separation * airplane.stallDrag * m.sin(alpha) ** 2);
      for (let i = 0; i < 3; i++)
        force[i] =
          (force[i] ?? 0) +
          (liftAxis[i] ?? 0) * lift -
          ((air[i] ?? 0) / m.max(1, s.airspeed)) * drag -
          (left[i] ?? 0) * lateral * spec.mass * airplane.lateralDamping * m.min(1, authority);
      let yawMoment = 0;
      for (const [index, engine] of engines.entries()) {
        const e = bank[engine.id];
        const control = controls[index];
        if (!e || !control) continue;
        const commandedRpm = engine.idleRpm + control.power * (1 - engine.idleRpm);
        const thrustAxis = vehicleLocalPoint({ pos: [0, 0, 0], rot }, engine.thrustAxis);
        const axisLength = m.max(0.0001, m.hypot(...engine.thrustAxis));
        const propellerSpeed = dot(air, thrustAxis) / axisLength;
        // Engine failures remove powered thrust immediately; the rotor continues to spool down.
        e.thrust =
          control.enabled && !e.failed
            ? m.min(
                engine.maxThrust ?? airplane.maxThrust,
                (engine.power * (engine.propellerEfficiency ?? airplane.propellerEfficiency)) /
                  m.max(engine.minPropellerSpeed ?? airplane.minPropellerSpeed, propellerSpeed),
              ) *
              control.power *
              m.clamp(e.rpm / m.max(0.01, commandedRpm), 0, 1)
            : 0;
        for (let i = 0; i < 3; i++)
          force[i] = (force[i] ?? 0) + ((thrustAxis[i] ?? 0) / axisLength) * e.thrust;
        // (r × F).y in body coordinates. +X is left when looking forward along +Z.
        yawMoment +=
          (((engine.position[2] - spec.centerOfMass[2]) * engine.thrustAxis[0] -
            (engine.position[0] - spec.centerOfMass[0]) * engine.thrustAxis[2]) *
            e.thrust) /
          axisLength;
      }
      const inertia = airplane.yawInertia ?? (spec.mass * (spec.span ** 2 + spec.length ** 2)) / 12;
      const damping =
        (airplane.thrustYawDamping ?? 1.2) * m.max(0.2, authority) +
        (s.grounded ? airplane.groundTrackRate : 0);
      s.thrustYawRate = ((s.thrustYawRate ?? 0) + (yawMoment / inertia) * h) / (1 + damping * h);
      s.yaw += s.thrustYawRate * h;
      rot = vehicleRotation(s.yaw, -s.pitch, s.roll);
    } else if (helicopter) {
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
      for (let i = 0; i < 3; i++)
        force[i] =
          (force[i] ?? 0) +
          (up[i] ?? 0) * lift -
          (air[i] ?? 0) *
            (i === 1
              ? helicopter.verticalDrag
              : helicopter.horizontalDrag + s.airspeed * helicopter.quadraticDrag);
    }
    for (let i = 0; i < 3; i++)
      s.velocity[i] = (s.velocity[i] ?? 0) + ((force[i] ?? 0) / spec.mass) * h;
    const pos = t.pos.map((v, i) => v + (s.velocity[i] ?? 0) * h) as [number, number, number];
    const support = env.groundHeight(pos[0], pos[2]);
    if (support === undefined || !Number.isFinite(support)) {
      Object.assign(s, previous, { waitingForTerrain: true });
      if (previous.engines === undefined) delete s.engines;
      if (previous.thrustYawRate === undefined) delete s.thrustYawRate;
      break;
    }
    s.grounded = pos[1] <= support;
    if (s.grounded) {
      const hard =
        (!previous.grounded &&
          (s.velocity[1] < -spec.hardLandingSpeed ||
            m.abs(s.roll) > spec.hardLandingRoll ||
            m.abs(s.pitch) > spec.hardLandingPitch)) ||
        (spec.model === 'airplane' && !input.gear) ||
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
        const along = s.velocity[0] * m.sin(s.yaw) + s.velocity[2] * m.cos(s.yaw);
        s.velocity[0] = approach(s.velocity[0], along * m.sin(s.yaw), h * airplane.groundTrackRate);
        s.velocity[2] = approach(s.velocity[2], along * m.cos(s.yaw), h * airplane.groundTrackRate);
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
      s.thrustYawRate = 0;
      for (const engine of Object.values(bank)) engine.thrust = 0;
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
      const currentEnvironment = weather ? { ...env, weather } : env;
      for (const [id, t, aircraft, state] of w.query(Transform, Aircraft, AircraftState)) {
        const input = w.get(id, AircraftInput) ?? IDLE_AIRCRAFT_INPUT;
        if (
          state.grounded &&
          !input.engine &&
          state.rpm === 0 &&
          Object.values(state.engines ?? {}).every((engine) => engine.rpm === 0) &&
          m.hypot(...state.velocity) === 0
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
