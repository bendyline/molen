import type { VehicleSpec } from '@bendyline/molen-schema';
import { dmath as m } from './dmath';
import { boxInertia } from './dynamics/rigid-body';
import {
  LONGITUDINAL_GRIP,
  SLIP_REFERENCE_SPEED,
  slipRatio,
  stepAxle,
  strutLoad,
  tirePeakAngle,
  tirePeakRatio,
} from './dynamics/wheel';

/**
 * A car on four wheels: each wheel on its own strut, with its own load, its own patch of road
 * and its own spin. The body heaves, pitches and rolls on the springs, and that is what moves
 * weight between the wheels; wheelspin and lock-up are what the wheels do, and anti-lock
 * brakes, traction control and stability control are controllers that watch them.
 *
 * Wheels are numbered front left, front right, rear left, rear right. Body axes as the driving
 * solver's: forward and left, yaw positive turning left, steering positive to the right.
 */

type Four = [number, number, number, number];

export interface WheelsState {
  /** Wheel speeds, rad/s. */
  spin: Four;
  /** Sprung body above its ride height, m, and its rate. */
  heave: number;
  heaveRate: number;
  /** Nose down positive, rad, and its rate. */
  pitch: number;
  pitchRate: number;
  /** Right side down positive, rad, and its rate. */
  roll: number;
  rollRate: number;
  /** Load on each wheel, N. */
  load: Four;
}

export interface WheelsGeometry {
  /** Each wheel's place from the center of mass: left and forward, m. */
  x: Four;
  z: Four;
  /** Load at rest, spring and damper rates at each wheel. */
  staticLoad: Four;
  spring: Four;
  damper: Four;
  /** Anti-roll bar rates of the two axles, N per m of difference between their wheels. */
  barFront: number;
  barRear: number;
  /** Pitch stiffness beyond the springs' own, N per m of difference between the axles. */
  pitchBar: number;
  /** Height of the center of mass above the road, m. */
  height: number;
  travel: number;
  pitchInertia: number;
  rollInertia: number;
  /** Rotating inertia of one wheel, kg m². */
  wheelInertia: number;
}

const G = 9.81;
/** A sprung body past this lean has left what the model describes; it is held there. */
const MAX_BODY_ANGLE = 0.3;

/** The suspension a spec describes, for a vehicle of `mass` kg. */
export function wheelsGeometry(spec: VehicleSpec, mass: number): WheelsGeometry {
  const wheels = spec.wheels ?? {};
  const front = spec.wheelbase / 2 - spec.centerOfMass[2];
  const rear = spec.wheelbase / 2 + spec.centerOfMass[2];
  const half = spec.wheelTrack / 2;
  const weight = mass * G;
  const height = m.max(0.2, spec.centerOfMass[1]);
  const frontLoad = (weight * rear) / spec.wheelbase / 2;
  const rearLoad = (weight * front) / spec.wheelbase / 2;
  // Each corner rides at the suspension's natural frequency on the mass it carries.
  const omega = m.TAU * (spec.suspensionFrequency ?? 1.5);
  const ratio = spec.suspensionDamping ?? 0.5;
  const rate = (load: number): number => (load / G) * omega * omega;
  const damp = (load: number): number => 2 * ratio * (load / G) * omega;
  const springFront = rate(frontLoad);
  const springRear = rate(rearLoad);
  // The roll the spec asks for per g, shared between the axles by its roll balance: the
  // springs give part of it and the anti-roll bars the rest.
  const rollPerG = spec.rollStiffness ?? 0.05;
  const rollStiffness = rollPerG > 0 ? (weight * height) / rollPerG : 0;
  const balance = spec.rollBalance ?? 0.6;
  const track = m.max(spec.wheelTrack, 0.1);
  const bar = (share: number, spring: number): number =>
    m.max(0, share * rollStiffness - (spring * track * track) / 2) / (track * track);
  const pitchPerG = spec.pitchStiffness ?? 0.03;
  const pitchStiffness = pitchPerG > 0 ? (weight * height) / pitchPerG : 0;
  const ownPitch = 2 * springFront * front * front + 2 * springRear * rear * rear;
  const inertia = boxInertia(mass, spec.width, spec.height, spec.length);
  return {
    x: [half, -half, half, -half],
    z: [front, front, -rear, -rear],
    staticLoad: [frontLoad, frontLoad, rearLoad, rearLoad],
    spring: [springFront, springFront, springRear, springRear],
    damper: [damp(frontLoad), damp(frontLoad), damp(rearLoad), damp(rearLoad)],
    barFront: bar(balance, springFront),
    barRear: bar(1 - balance, springRear),
    pitchBar: m.max(0, pitchStiffness - ownPitch) / (spec.wheelbase * spec.wheelbase),
    height,
    travel: wheels.travel ?? 0.09,
    pitchInertia: inertia[0],
    rollInertia: inertia[2],
    // A wheel and tire are a little under a hundredth of the car, most of it near the rim.
    wheelInertia: wheels.inertia ?? 0.008 * mass * spec.wheelRadius * spec.wheelRadius * 0.8,
  };
}

/** A car standing on its wheels: rolling at `speed`, body level. */
export function initialWheelsState(geometry: WheelsGeometry, spin: number): WheelsState {
  return {
    spin: [spin, spin, spin, spin],
    heave: 0,
    heaveRate: 0,
    pitch: 0,
    pitchRate: 0,
    roll: 0,
    rollRate: 0,
    load: [...geometry.staticLoad],
  };
}

/**
 * Load each strut carries to its wheel, N, from how far each is compressed from its static
 * ride height (m) and how fast: its own spring, damper and bump stop, and the anti-roll and
 * pitch bars by the difference between the wheels they join.
 */
export function strutLoads(
  geometry: WheelsGeometry,
  compression: Readonly<Four>,
  rate: Readonly<Four>,
): Four {
  const load: Four = [0, 0, 0, 0];
  const pitchBar =
    (geometry.pitchBar * (compression[0] + compression[1] - compression[2] - compression[3])) / 4;
  for (let i = 0; i < 4; i++) {
    const other = compression[i ^ 1] ?? 0;
    const bar = (i < 2 ? geometry.barFront : geometry.barRear) * ((compression[i] ?? 0) - other);
    load[i] = m.max(
      0,
      strutLoad({
        compression: compression[i] ?? 0,
        rate: rate[i] ?? 0,
        staticLoad: geometry.staticLoad[i] ?? 0,
        spring: geometry.spring[i] ?? 0,
        damper: geometry.damper[i] ?? 0,
        travel: geometry.travel,
      }) +
        bar +
        (i < 2 ? pitchBar : -pitchBar),
    );
  }
  return load;
}

/** What the wheels are asked to do in one substep, however the body above them is carried. */
export interface WheelControls {
  spec: VehicleSpec;
  geometry: WheelsGeometry;
  mass: number;
  /** Speed forward, m/s: what the controllers judge the car's motion by. */
  u: number;
  /** Peak side friction of the road under each wheel at a quarter of the weight. */
  friction: Readonly<Four>;
  /** Force the driveline would put down without slip, N (signed), and the front axle's share. */
  drive: number;
  frontDrive: number;
  /** How much of each axle's wheels is left to drive through, 0..1: front, rear. */
  health?: readonly [number, number];
  /** Rotating inertia of the engine and gearbox as the driven wheels feel it, kg m². */
  drivelineInertia: number;
  /** Brake pedal, 0..1. */
  brake: number;
  handbrake: boolean;
  /** Which controllers are watching the wheels. */
  antiLock: boolean;
  traction: boolean;
  stability: boolean;
  h: number;
}

/** Each contact patch as the road sees it. */
export interface WheelContacts {
  /** The hub's speed along its wheel's heading, m/s. */
  rolling: Readonly<Four>;
  /** Slip angle, rad: the patch's sideways motion against its rolling, positive moving left. */
  angle: Readonly<Four>;
  /** Load on each wheel, N. */
  load: Readonly<Four>;
}

export interface WheelForces {
  /** Wheel speeds one substep on, rad/s. */
  spin: Four;
  /** Tire force along each wheel's heading and to its left, N. */
  longitudinal: Four;
  lateral: Four;
  /** 0–1: how far each tire is past its grip. */
  over: Four;
  /** 0–1: how hard traction or stability control is intervening. */
  assist: number;
}

export interface WheelsInput extends WheelControls {
  /** Speed to the left in m/s, and yaw rate in rad/s (turning left positive). */
  v: number;
  r: number;
  /** Front wheel angle in radians, positive to the right. */
  steer: number;
  /** Aerodynamic lift on the body, N. */
  lift: number;
  /** Road height under each wheel above the plane through all four, m. */
  bump?: Readonly<Four>;
  grounded: boolean;
}

export interface WheelsOutput {
  /** Tire force on the vehicle, N, forward and to the left, and its yaw moment (left positive). */
  forward: number;
  left: number;
  moment: number;
  /** 0–1: the worst any tire is past its grip. */
  skid: number;
  /** 0–1: how hard traction or stability control is intervening. */
  assist: number;
  /** Road speed the driven wheels are turning at, m/s: what the engine is geared to. */
  drivenSpeed: number;
}

/**
 * One substep of the four wheels themselves: what each tire grips with under its load, what
 * anti-lock, traction and stability control make of the pedals, and the wheels' spin through
 * their differentials. Returns each tire's force along and across its own heading.
 */
export function wheelForces(
  spin: Readonly<Four>,
  contacts: WheelContacts,
  input: WheelControls,
): WheelForces {
  const { spec, geometry, mass, u, h } = input;
  const { rolling, angle, load } = contacts;
  const radius = spec.wheelRadius;
  const stiffness = spec.corneringStiffness ?? 18;
  const sensitivity = spec.tireLoadSensitivity ?? 0.25;
  const quarter = (mass * G) / 4;
  // A tire's friction falls as its load rises, so the heavier and the stiffer-sprung axle
  // slides first.
  const grip: Four = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++)
    grip[i] =
      (input.friction[i] ?? 0) *
      m.clamp(1 - sensitivity * ((load[i] ?? 0) / quarter - 1), 0.55, 1.25);

  // A wheel already past its peak (a patch of ice, a bump) holds only its sliding grip. The
  // controllers ease off far enough below that for the road to bring it back: from full at
  // the peak slip to under two thirds at twice it.
  const recovery = (i: number, way: number): number => {
    const peak = tirePeakRatio(m.max(grip[i] ?? 0, 0.01), stiffness);
    const slip = way * slipRatio(spin[i] ?? 0, radius, rolling[i] ?? 0);
    return m.clamp(1 - 0.37 * ((slip - peak) / peak), 0.63, 1);
  };
  let assist = 0;
  let drive = input.drive;
  const brake: Four = [0, 0, 0, 0];
  // Stability control: when the rear tires slide past their peak it brakes the outside front
  // wheel, which turns the car back into line, and backs off the engine.
  let catchWheel = -1;
  let catchTorque = 0;
  if (input.stability && !input.handbrake && u > 5) {
    const rearSlip = ((angle[2] ?? 0) + (angle[3] ?? 0)) / 2;
    const rearPeak = tirePeakAngle(((grip[2] ?? 0) + (grip[3] ?? 0)) / 2 || 1e-3, stiffness);
    const catching = m.smoothstep((m.abs(rearSlip) / rearPeak - 0.7) / 0.6);
    if (catching > 0) {
      // Tail sliding left: brake the left front, and the other way about.
      const outside = rearSlip > 0 ? 0 : 1;
      catchWheel = outside;
      catchTorque = catching * 0.9 * (grip[outside] ?? 0) * (load[outside] ?? 0) * radius;
      if (drive * u > 0) drive *= 1 - catching;
      assist = catching;
    }
  }
  // The differential gives both wheels of an axle the same torque: an open one can push no
  // harder than twice what its lighter wheel grips with, a locked one as hard as both. A
  // limited-slip differential, or traction control braking the faster wheel, sits between.
  const frontShare = input.frontDrive;
  const locked = m.max(spec.limitedSlip ?? 0, input.traction ? 0.5 : 0);
  // Traction control holds each driven axle's torque just under what its tires can put down,
  // less while they are cornering.
  const axleDrive: [number, number] = [
    drive * frontShare * (input.health?.[0] ?? 1),
    drive * (1 - frontShare) * (input.health?.[1] ?? 1),
  ];
  if (input.traction && drive !== 0) {
    for (const axle of [0, 1] as const) {
      const asked = m.abs(axleDrive[axle]);
      if (asked <= 0) continue;
      const hold = (i: number): number => {
        const friction = m.max(grip[i] ?? 0, 0.01);
        const use = m.min(1, m.abs(angle[i] ?? 0) / tirePeakAngle(friction, stiffness));
        return (
          LONGITUDINAL_GRIP * friction * (load[i] ?? 0) * m.sqrt(m.max(0.05, 1 - (0.9 * use) ** 2))
        );
      };
      const a = hold(axle * 2);
      const b = hold(axle * 2 + 1);
      // Part of the torque spins up the wheels and the engine with them as the car gathers
      // speed; the tires see the rest.
      const turning =
        2 * geometry.wheelInertia +
        input.drivelineInertia * (axle === 0 ? frontShare : 1 - frontShare);
      const way = m.sign(axleDrive[axle]);
      const traction =
        0.97 *
        (locked * (a + b) + (1 - locked) * 2 * m.min(a, b)) *
        (1 + turning / (mass * radius * radius)) *
        m.min(recovery(axle * 2, way), recovery(axle * 2 + 1, way));
      if (asked <= traction) continue;
      assist = m.max(assist, m.min(1, (asked - traction) / m.max(traction, 1)));
      axleDrive[axle] *= traction / asked;
    }
  }
  // Brakes: the pedal's torque split by the brake bias. Anti-lock holds each wheel just short
  // of what its tire can take, the rear pair less while they are cornering so the tail stays in
  // line, and eases the engine's own braking where that alone is too much. The handbrake
  // clamps the rear pair.
  const capacity = mass * spec.brakeDeceleration * radius;
  const bias = spec.brakeBias ?? 0.65;
  const eased: Four = [1, 1, 1, 1];
  // What each tire can take, short of its peak.
  const holds: Four = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const friction = m.max(grip[i] ?? 0, 0.01);
    const use = m.min(1, m.abs(angle[i] ?? 0) / tirePeakAngle(friction, stiffness));
    holds[i] =
      0.95 *
      LONGITUDINAL_GRIP *
      friction *
      (load[i] ?? 0) *
      radius *
      (i < 2 ? 1 : m.sqrt(m.max(0.05, 1 - (0.9 * use) ** 2)));
  }
  // On a road that grips one side better than the other, the rear pair brake no harder than
  // the worse-placed of them (select low): the rear keeps its side grip and the car stays
  // steerable instead of being spun by its own brakes. The front pair each do what they can.
  const rearHold = m.min(holds[2], holds[3]);
  for (let i = 0; i < 4; i++) {
    // The pedal, or what stability control asks of this wheel, whichever is more; a wheel
    // stability control is braking is watched for lock-up as anti-lock would.
    const catching = i === catchWheel;
    let torque = m.max(
      (input.brake * capacity * (i < 2 ? bias : 1 - bias)) / 2,
      catching ? catchTorque : 0,
    );
    if (torque > 0 && (input.antiLock || catching)) {
      const axle = axleDrive[i < 2 ? 0 : 1] ?? 0;
      const engine = axle * (rolling[i] ?? 0) < 0 ? (m.abs(axle) * radius) / 2 : 0;
      const hold =
        (i < 2 ? (holds[i] ?? 0) : rearHold) * recovery(i, -m.sign(rolling[i] ?? 0) || -1);
      if (engine > hold) eased[i] = hold / engine;
      torque = m.min(torque, m.max(0, hold - engine));
    }
    if (input.handbrake && i >= 2) torque = m.max(torque, capacity);
    brake[i] = torque;
  }
  const next: Four = [0, 0, 0, 0];
  const longitudinal: Four = [0, 0, 0, 0];
  const lateral: Four = [0, 0, 0, 0];
  const over: Four = [0, 0, 0, 0];
  for (const axle of [0, 1] as const) {
    const first = axle * 2;
    const share = axle === 0 ? frontShare : 1 - frontShare;
    // Anti-lock eases the engine's own braking as far as the wheel that needs it most.
    const opposing =
      (axleDrive[axle] ?? 0) * ((rolling[first] ?? 0) + (rolling[first + 1] ?? 0)) < 0;
    const torque =
      (axleDrive[axle] ?? 0) *
      radius *
      (opposing ? m.min(eased[first] ?? 1, eased[first + 1] ?? 1) : 1);
    const side = (i: number) => ({
      spin: spin[i] ?? 0,
      radius,
      inertia: geometry.wheelInertia,
      roadSpeed: rolling[i] ?? 0,
      brakeTorque: brake[i] ?? 0,
      slipAngle: angle[i] ?? 0,
      load: load[i] ?? 0,
      friction: grip[i] ?? 0,
      stiffness,
    });
    const steps = stepAxle({
      left: side(first),
      right: side(first + 1),
      driveTorque: torque,
      carrierInertia: share > 0 ? input.drivelineInertia * share : 0,
      // Traction control only brakes a spinning wheel under power; off the power the
      // differential is as open as it was built.
      locked: share > 0 ? (opposing || torque === 0 ? (spec.limitedSlip ?? 0) : locked) : 0,
      h,
    });
    for (const [offset, wheel] of steps.entries()) {
      const i = first + offset;
      next[i] = wheel.spin;
      longitudinal[i] = wheel.forces.longitudinal;
      lateral[i] = wheel.forces.lateral;
      over[i] = wheel.forces.over;
    }
  }
  return { spin: next, longitudinal, lateral, over, assist };
}

/**
 * One substep of the four wheels and the body on them. Mutates `state`; returns what the tires
 * do to the vehicle.
 */
export function stepWheels(state: WheelsState, input: WheelsInput): WheelsOutput {
  const { spec, geometry, mass, u, v, r, h } = input;
  const { x, z } = geometry;
  const radius = spec.wheelRadius;
  const weight = mass * G;

  // Loads: each strut by how far the body has settled over it, the bars by the difference
  // between the wheels they join.
  const compression: Four = [0, 0, 0, 0];
  let load: Four = [0, 0, 0, 0];
  if (input.grounded) {
    const rate: Four = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      compression[i] =
        -state.heave +
        state.pitch * (z[i] ?? 0) -
        state.roll * (x[i] ?? 0) +
        (input.bump?.[i] ?? 0);
      rate[i] = -state.heaveRate + state.pitchRate * (z[i] ?? 0) - state.rollRate * (x[i] ?? 0);
    }
    load = strutLoads(geometry, compression, rate);
  }

  // Each contact patch's motion over the road, in its wheel's own frame.
  const sin = m.sin(input.steer);
  const cos = m.cos(input.steer);
  const rolling: Four = [0, 0, 0, 0];
  const angle: Four = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const forward = u - r * (x[i] ?? 0);
    const left = v + r * (z[i] ?? 0);
    const along = i < 2 ? forward * cos - left * sin : forward;
    const across = i < 2 ? left * cos + forward * sin : left;
    rolling[i] = along;
    angle[i] = m.atan2(across, m.max(m.abs(along), SLIP_REFERENCE_SPEED));
  }
  const tires = wheelForces(state.spin, { rolling, angle, load }, input);
  let forward = 0;
  let left = 0;
  let moment = 0;
  let skid = 0;
  for (let i = 0; i < 4; i++) {
    const longitudinal = tires.longitudinal[i] ?? 0;
    const lateral = tires.lateral[i] ?? 0;
    const ahead = i < 2 ? longitudinal * cos + lateral * sin : longitudinal;
    const aside = i < 2 ? -longitudinal * sin + lateral * cos : lateral;
    forward += ahead;
    left += aside;
    moment += (z[i] ?? 0) * aside - (x[i] ?? 0) * ahead;
    if ((load[i] ?? 0) > 0) skid = m.max(skid, tires.over[i] ?? 0);
  }
  const next = tires.spin;
  const assist = tires.assist;
  state.spin = next;
  state.load = load;

  // The body on its springs. Tire forces act at the road, below the center of mass: braking
  // pitches the nose down, cornering rolls the body out of the turn.
  if (input.grounded) {
    let lift = input.lift - weight;
    let pitching = -forward * geometry.height;
    let rolling2 = left * geometry.height;
    for (let i = 0; i < 4; i++) {
      lift += load[i] ?? 0;
      pitching -= (load[i] ?? 0) * (z[i] ?? 0);
      rolling2 += (load[i] ?? 0) * (x[i] ?? 0);
    }
    state.heaveRate += (lift / mass) * h;
    state.pitchRate += (pitching / geometry.pitchInertia) * h;
    state.rollRate += (rolling2 / geometry.rollInertia) * h;
  } else {
    // Off the ground the wheels hang and the body has nothing to lean on: it comes level.
    const omega = m.TAU * (spec.suspensionFrequency ?? 1.5);
    state.heaveRate += (-omega * omega * state.heave - 2 * omega * state.heaveRate) * h;
    state.pitchRate += (-omega * omega * state.pitch - 2 * omega * state.pitchRate) * h;
    state.rollRate += (-omega * omega * state.roll - 2 * omega * state.rollRate) * h;
  }
  state.heave += state.heaveRate * h;
  state.pitch += state.pitchRate * h;
  state.roll += state.rollRate * h;
  for (const axis of ['pitch', 'roll'] as const) {
    if (m.abs(state[axis]) <= MAX_BODY_ANGLE) continue;
    state[axis] = m.sign(state[axis]) * MAX_BODY_ANGLE;
    state[`${axis}Rate`] = 0;
  }
  const travel = 2 * geometry.travel;
  if (m.abs(state.heave) > travel) {
    state.heave = m.sign(state.heave) * travel;
    state.heaveRate = 0;
  }

  const frontSpeed = ((next[0] + next[1]) / 2) * radius;
  const rearSpeed = ((next[2] + next[3]) / 2) * radius;
  return {
    forward,
    left,
    moment,
    skid,
    assist,
    drivenSpeed: input.frontDrive * frontSpeed + (1 - input.frontDrive) * rearSpeed,
  };
}
