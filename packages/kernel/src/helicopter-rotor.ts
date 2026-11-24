import type {
  AircraftInputData,
  AircraftSpec,
  AircraftStateData,
  HelicopterPhysicsSpec,
  HelicopterRotorSpec,
  HelicopterTailRotorSpec,
} from '@bendyline/molen-schema';
import {
  aircraftGear,
  type GearState,
  type GearStep,
  initialGearState,
  stepGear,
} from './aircraft-gear';
import type { TransformData } from './component';
import { dmath as m } from './dmath';
import {
  angularAcceleration,
  type Inertia,
  originFromCenterOfMass,
  turnBody,
} from './dynamics/rigid-body';
import {
  discTilt,
  inducedVelocityRatio,
  inflowTime,
  type RotorBlades,
  rotorLoads,
  rotorPitchFor,
} from './dynamics/rotor';
import { type Quat, quatConjugate, quatNormalize, quatRotateVec3, type Vec3 } from './math3d';

/**
 * A helicopter flying on its rotors: a free rigid body under a main rotor at its hub, the
 * torque that turning the rotor puts on the fuselage, a tail rotor on its boom, a fin and a
 * stabilizer, the fuselage's own drag, and skids. What a pilot knows a helicopter by follows
 * from where those act: the nose that swings when the collective moves, the drift a tail rotor
 * pushes it into and the low skid that answers it, the disc that blows back as speed builds,
 * the pendulum under the hub, a rotor that slows when asked for more than the engine has.
 *
 * Body axes are the engine's: +X left, +Y up, +Z forward; rates are about them (nose down,
 * nose left, right side down).
 */

const G = 9.81;
/** Swashplate tilt the assist has per radian per second² it wants, floor on the control power. */
const MIN_CONTROL_POWER = 1e-6;

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** The main rotor's blades as the rotor element takes them. */
export function mainRotorBlades(
  helicopter: HelicopterPhysicsSpec,
  rotor: HelicopterRotorSpec,
): RotorBlades {
  return {
    radius: helicopter.rotorRadius,
    solidity: (rotor.blades * rotor.chord) / (m.PI * helicopter.rotorRadius),
    tipSpeed: rotor.tipSpeed,
    liftSlope: 5.7,
    drag: rotor.profileDrag ?? 0.008,
    inducedFactor: rotor.inducedFactor ?? 1.15,
    maxLift: rotor.maxLift ?? 1.2,
  };
}

/** A tail rotor's blades: short, fast and working in the main rotor's wake. */
export function tailRotorBlades(tail: HelicopterTailRotorSpec): RotorBlades {
  return {
    radius: tail.radius,
    solidity: (tail.blades * tail.chord) / (m.PI * tail.radius),
    tipSpeed: tail.tipSpeed,
    liftSlope: 5.7,
    drag: 0.011,
    // A fan in a duct (eight blades or more) moves its air without the wake closing in behind
    // it, and the duct's lip carries part of the thrust: about 0.7 of an open rotor's induced
    // power.
    inducedFactor: tail.blades >= 8 ? 0.9 : 1.25,
    maxLift: 1.1,
  };
}

/** Tail rotor blade pitch at full right and full left pedal, rad. */
const tailPitch = (tail: HelicopterTailRotorSpec): [number, number] => tail.pitch ?? [-0.14, 0.42];

/** +1 for a main rotor turning counterclockwise seen from above, -1 clockwise. */
const turning = (rotor: HelicopterRotorSpec): number => (rotor.rotation === 'clockwise' ? -1 : 1);

/** Principal inertia about the left, up and forward axes (pitch, yaw, roll), kg m². */
export function rotorcraftInertia(spec: AircraftSpec): Inertia {
  const helicopter = spec.helicopter;
  const given = helicopter?.rotor?.inertia;
  if (given) return [given.pitch, given.yaw, given.roll];
  // By the rotor's radius, from the helicopters whose inertias are published.
  const radius = helicopter?.rotorRadius ?? spec.span / 2;
  return [
    spec.mass * (0.29 * radius) ** 2,
    spec.mass * (0.27 * radius) ** 2,
    spec.mass * (0.14 * radius) ** 2,
  ];
}

/** Energy in the turning rotor at full speed, J. */
export function rotorEnergy(spec: AircraftSpec): number {
  const helicopter = spec.helicopter;
  if (!helicopter) return 1;
  const weight = spec.mass * G;
  const disc = m.PI * helicopter.rotorRadius ** 2;
  return (
    (helicopter.rotorInertiaTime ?? 2) *
    ((weight * m.sqrt(weight / (2 * 1.225 * disc))) / (helicopter.rotorEfficiency ?? 0.75))
  );
}

/**
 * Shaft power a helicopter's engines can deliver in air of `density`, W: the gearbox's limit,
 * held as the air thins until the engines have no more.
 */
export function rotorShaftPower(spec: AircraftSpec, density: number): number {
  const engines = spec.engines ?? (spec.engine ? [spec.engine] : []);
  return engines.reduce(
    (sum, engine) =>
      sum +
      engine.power *
        m.pow(
          m.min(1, density / 1.225 / (engine.ratedDensityRatio ?? 1)),
          engine.densityExponent ?? 1,
        ),
    0,
  );
}

/** How much less air a rotor has to move close to the ground: 1 in free air. */
function groundCushion(helicopter: HelicopterPhysicsSpec, height: number): number {
  return (
    1 +
    (helicopter.rotor?.groundEffect ?? helicopter.groundEffect) *
      m.clamp(1 - height / helicopter.rotorRadius, 0, 1)
  );
}

/** Where the hub and the tail rotor are from the center of mass, body axes, and the shaft's axis. */
function layout(spec: AircraftSpec, helicopter: HelicopterPhysicsSpec, rotor: HelicopterRotorSpec) {
  const com = spec.centerOfMass;
  const at = helicopter.rotorPosition;
  const tilt = rotor.shaftTilt ?? 0.05;
  const hub: Vec3 = [at[0] - com[0], at[1] - com[1], at[2] - com[2]];
  const tail: Vec3 | undefined = rotor.tail
    ? [hub[0], hub[1] + rotor.tail.height, hub[2] - rotor.tail.arm]
    : undefined;
  return {
    hub,
    tail,
    shaft: [0, m.cos(tilt), m.sin(tilt)] as Vec3,
    ahead: [0, -m.sin(tilt), m.cos(tilt)] as Vec3,
  };
}

/** A tail rotor's thrust and power at a blade pitch, with the air it pulls settled. */
function tailRotorAt(
  blades: RotorBlades,
  density: number,
  speed: number,
  pitch: number,
  axial: number,
  edgewise: number,
) {
  let inflow = 0.05 * blades.tipSpeed * speed;
  let loads = rotorLoads(blades, { density, speed, pitch, axial, edgewise, inflow });
  for (let i = 0; i < 8; i++) {
    inflow = 0.5 * (inflow + loads.inflowTarget);
    loads = rotorLoads(blades, { density, speed, pitch, axial, edgewise, inflow });
  }
  return { loads, inflow };
}

export interface RotorTrim {
  /** Shaft power the engines must deliver, W. */
  power: number;
  /** Main rotor thrust, N, and blade pitch at three quarters radius, rad. */
  thrust: number;
  pitch: number;
  /** Where that puts the collective lever, 0..1 (beyond 1: more than it has). */
  lever: number;
  /** The blades cannot carry it: they are stalled. */
  stalled: boolean;
  /** Tail rotor blade pitch, rad, and whether the pedals have that much. */
  tailPitch: number;
  pedals: boolean;
  /** Induced velocity through the main rotor, m/s, and the forward tilt of its thrust, rad. */
  inflow: number;
  tilt: number;
}

/**
 * Steady flight worked out from the same rotor element the helicopter flies on: the thrust that
 * carries the weight and balances the drag at a forward `speed` and rate of `climb` (m/s), the
 * blade pitch that makes it, and the power the main and tail rotors take. `clearance` is the
 * height of the skids over the ground; omitted, the air is free.
 */
export function rotorTrim(
  spec: AircraftSpec,
  flight: { density: number; speed?: number; climb?: number; clearance?: number; mass?: number },
): RotorTrim | undefined {
  const helicopter = spec.helicopter;
  const rotor = helicopter?.rotor;
  if (!helicopter || !rotor) return undefined;
  const { density, speed = 0, climb = 0 } = flight;
  const blades = mainRotorBlades(helicopter, rotor);
  const weight = (flight.mass ?? spec.mass) * G;
  const area = m.PI * blades.radius ** 2;
  const air = m.hypot(speed, climb);
  // The fuselage's drag: three and four times the flat plate broadside and from below.
  const dragAhead = 0.5 * density * rotor.dragArea * air * speed;
  const dragUp = 0.5 * density * 4 * rotor.dragArea * air * climb;
  let thrust = m.hypot(weight + dragUp, dragAhead);
  const tilt = m.atan2(dragAhead, weight + dragUp);
  const axial = climb * m.cos(tilt) + speed * m.sin(tilt);
  const edgewise = m.abs(speed * m.cos(tilt) - climb * m.sin(tilt));
  const cushion = flight.clearance === undefined ? 1 : groundCushion(helicopter, flight.clearance);
  let inflow = 0;
  for (let i = 0; i < 3; i++) {
    const hover = m.sqrt(thrust / (2 * density * area));
    inflow = (hover * inducedVelocityRatio(axial / hover, edgewise / hover)) / cushion;
    // The wash on the fuselage is thrust that carries nothing; it is swept clear with speed.
    const wash = (rotor.download ?? 0.04) * (1 - m.smoothstep(edgewise / (2 * hover)));
    thrust = m.hypot(weight + dragUp, dragAhead) / (1 - wash);
  }
  const flow = { density, speed: 1, axial, edgewise, inflow };
  const pitch = rotorPitchFor(blades, flow, thrust);
  const main = rotorLoads(blades, { ...flow, pitch });
  const [low, high] = rotor.collective;
  let power = main.power;
  let tailAngle = 0;
  let pedals = true;
  if (rotor.tail) {
    // The tail rotor holds the torque the engine puts into the main rotor.
    const torque = (m.max(0, main.power) * blades.radius) / blades.tipSpeed;
    const push = torque / rotor.tail.arm;
    const tail = tailRotorBlades(rotor.tail);
    let wash = 0.05 * tail.tipSpeed;
    for (let i = 0; i < 8; i++) {
      const hover = m.sqrt(m.abs(push) / (2 * density * m.PI * tail.radius ** 2));
      wash = 0.5 * (wash + hover * inducedVelocityRatio(0, speed / m.max(hover, 1e-6)));
    }
    const tailFlow = { density, speed: 1, axial: 0, edgewise: speed, inflow: wash };
    tailAngle = rotorPitchFor(tail, tailFlow, push);
    const [right, left] = tailPitch(rotor.tail);
    pedals = tailAngle <= left && tailAngle >= right;
    power += rotorLoads(tail, { ...tailFlow, pitch: tailAngle }).power;
  }
  return {
    power: power / (rotor.transmission ?? 0.97),
    thrust,
    pitch,
    lever: (pitch - low) / (high - low),
    stalled: main.thrust < 0.985 * thrust,
    tailPitch: tailAngle,
    pedals,
    inflow,
    tilt,
  };
}

export interface RotorcraftInput {
  spec: AircraftSpec;
  helicopter: HelicopterPhysicsSpec;
  rotor: HelicopterRotorSpec;
  transform: TransformData;
  /** Mutated: velocity, rates, rotor telemetry, landing gear. */
  state: AircraftStateData;
  input: AircraftInputData;
  /** The aircraft's mass now, kg, and the air's density, kg/m³. */
  mass: number;
  density: number;
  /** Wind in world axes at a point, m/s. */
  windAt(point: Vec3): Vec3;
  /** Ground height under the origin, and the query for anywhere else. */
  ground: number;
  groundHeight(x: number, z: number, y?: number): number | undefined;
  /** Grip of the surface relative to dry. */
  grip: number;
  /** Shaft power the engines can give now, W: 0 with none running. */
  available: number;
  /** The gearbox's limit, W: what a torque gauge reads against. */
  rated: number;
  /** What is left of the main rotor, and of the tail and tail rotor, 0..1. */
  rotorAuthority: number;
  tailAuthority: number;
  /** The crew has gone: the collective is on the floor. */
  ejected: boolean;
  /** Running up or stopping on the ground: the rotor's speed is the starter's and the brake's. */
  spooling: boolean;
  h: number;
  /** Multiplier on travel: the world's travel boost. */
  travel: number;
}

/**
 * Tilt the assist's hands add per m/s of drift over the ground near the hover, rad, and the
 * most they add: enough to stop a creep and to stand against a fresh wind, not to brake from
 * speed.
 */
const HOVER_HOLD = 0.03;
const HOVER_HOLD_TILT = 0.08;

export interface RotorcraftStep {
  /** False where the ground under the skids is not there to ask: the state is untouched. */
  ok: boolean;
  rot: Quat;
  pos: Vec3;
  /** Rotor speed one substep on, as a share of full speed. */
  rpm: number;
  /** Shaft power the engines are delivering, W. */
  shaftPower: number;
  /** What the skids did this substep. */
  gear: GearStep | undefined;
}

/** One substep of a helicopter on its rotors. */
export function stepRotorcraft(c: RotorcraftInput): RotorcraftStep {
  const { spec, helicopter, rotor, input, density, h, mass } = c;
  const s = c.state;
  const rot = quatNormalize(c.transform.rot as Quat);
  const inverse = quatConjugate(rot);
  const toBody = (v: Vec3): Vec3 => quatRotateVec3(inverse, v);
  const toWorld = (v: Vec3): Vec3 => quatRotateVec3(rot, v);
  const offset = toWorld(spec.centerOfMass);
  const com: Vec3 = [
    c.transform.pos[0] + offset[0],
    c.transform.pos[1] + offset[1],
    c.transform.pos[2] + offset[2],
  ];
  const omega: Vec3 = [-s.pitchRate, s.yawRate ?? 0, s.rollRate];
  const velocity = s.velocity as Vec3;
  const sense = turning(rotor);
  const { hub, tail: tailAt, shaft, ahead } = layout(spec, helicopter, rotor);
  const blades = mainRotorBlades(helicopter, rotor);
  const speed = m.max(0, s.rpm);
  const tip = blades.tipSpeed * speed;
  const weight = mass * G;
  const direct = input.cyclicMode === 'direct';
  const footwork = (input.pedalMode ?? input.cyclicMode ?? 'assisted') === 'direct';
  // Air a point of the airframe meets, in body axes.
  const airAt = (arm: Vec3): Vec3 => {
    const spin = cross(omega, arm);
    const reach = toWorld(arm);
    const wind = c.windAt([com[0] + reach[0], com[1] + reach[1], com[2] + reach[2]]);
    const body = toBody([velocity[0] - wind[0], velocity[1] - wind[1], velocity[2] - wind[2]]);
    return [body[0] + spin[0], body[1] + spin[1], body[2] + spin[2]];
  };

  // The main rotor: what the air is doing at the hub, along the shaft and across the disc.
  const hubAir = airAt(hub);
  const axial = dot(hubAir, shaft);
  const across: Vec3 = [
    hubAir[0] - shaft[0] * axial,
    hubAir[1] - shaft[1] * axial,
    hubAir[2] - shaft[2] * axial,
  ];
  const edgewise = m.hypot(across[0], across[1], across[2]);
  // Collective: the lever is the blades' pitch. Asked for more than the engines have, a rotor
  // slows; under power the assist's hand eases the lever down to keep it turning. With the
  // engines out the lever is the pilot's alone: down to keep the rotor, up to spend it.
  const lever = c.ejected ? 0 : m.clamp(input.power, 0, 1);
  const eased =
    direct || !(c.available > 0)
      ? lever
      : m.max(0, lever - 16 * m.max(0, 0.97 - speed) * Number(speed > 0.5));
  const pitch = rotor.collective[0] + eased * (rotor.collective[1] - rotor.collective[0]);
  const height = m.max(0, c.transform.pos[1] - c.ground);
  const cushion = groundCushion(helicopter, height);
  const hoverInflow = m.sqrt(weight / (2 * density * m.PI * blades.radius ** 2));
  const inflow = s.rotor?.inflow ?? (speed > 0.5 ? hoverInflow / cushion : 0);
  const main = rotorLoads(blades, { density, speed, pitch, axial, edgewise, inflow });
  // Descending into its own wake a rotor loses lift it cannot get back with the lever.
  const descent = -axial / m.max(1, hoverInflow);
  const ring =
    helicopter.vortexRing && height > 0.5
      ? m.smoothstep((descent - 0.4) / 0.8) *
        (1 - m.smoothstep((descent - 1.8) / 0.8)) *
        (1 - m.smoothstep(edgewise / m.max(1, 2 * hoverInflow))) *
        m.clamp(eased * speed, 0, 1)
      : 0;
  s.vortexRing = ring;
  const thrust = main.thrust * (1 - 0.55 * ring) * c.rotorAuthority;
  s.overspeed = main.stall > 0.5 && edgewise > 0.2 * tip;

  // Where the disc points. The swashplate tilts it; it flaps back from the air it flies into
  // and toward its advancing side, and it follows a turning shaft late.
  const angular = tip / blades.radius;
  const lock = rotor.lock ?? 7;
  const flap = discTilt(blades, main, pitch, m.abs(inflow) / m.max(tip, 1), lock, angular);
  const windAhead = edgewise > 1e-6 ? dot(across, ahead) / edgewise : 0;
  const windLeft = edgewise > 1e-6 ? across[0] / edgewise : 0;
  // Forward and leftward tilt of the disc from the shaft with the swashplate level.
  const free: [number, number] = [
    -flap.back * windAhead + sense * flap.aside * windLeft - flap.lag * omega[0],
    -flap.back * windLeft - sense * flap.aside * windAhead + flap.lag * omega[2],
  ];
  // A hinge away from the shaft (or a blade root that bends) lets the tilted disc turn the hub
  // directly, thrust or no thrust.
  const stiffness =
    (0.75 *
      rotor.blades *
      (rotor.hingeOffset ?? 0.04) *
      1.225 *
      blades.liftSlope *
      rotor.chord *
      blades.radius ** 2 *
      tip ** 2) /
    lock;
  const drag = main.drag * c.rotorAuthority;
  const rotorOn = (tilt: readonly [number, number]): { force: Vec3; moment: Vec3 } => {
    const axis: Vec3 = [
      shaft[0] + tilt[1],
      shaft[1] + tilt[0] * ahead[1],
      shaft[2] + tilt[0] * ahead[2],
    ];
    const length = m.hypot(axis[0], axis[1], axis[2]);
    const force: Vec3 = [
      (axis[0] / length) * thrust - (edgewise > 1e-6 ? (across[0] / edgewise) * drag : 0),
      (axis[1] / length) * thrust - (edgewise > 1e-6 ? (across[1] / edgewise) * drag : 0),
      (axis[2] / length) * thrust - (edgewise > 1e-6 ? (across[2] / edgewise) * drag : 0),
    ];
    const moment = cross(hub, force);
    moment[0] += stiffness * tilt[0];
    moment[2] -= stiffness * tilt[1];
    return { force, moment };
  };

  // Everything else on the airframe, in body axes about the center of mass.
  const force: Vec3 = toBody([0, -weight, 0]);
  const moment: Vec3 = [0, 0, 0];
  const push = (at: Vec3, load: Vec3): void => {
    force[0] += load[0];
    force[1] += load[1];
    force[2] += load[2];
    const turn = cross(at, load);
    moment[0] += turn[0];
    moment[1] += turn[1];
    moment[2] += turn[2];
  };
  // The fuselage: its drag, more of it broadside and from below, and the rotor's wash on it.
  const bodyAir = airAt([0, 0, 0]);
  const airspeed = m.hypot(bodyAir[0], bodyAir[1], bodyAir[2]);
  const plate = 0.5 * density * rotor.dragArea * airspeed;
  push([0, 0, 0], [-3 * plate * bodyAir[0], -4 * plate * bodyAir[1], -plate * bodyAir[2]]);
  const wash =
    (rotor.download ?? 0.04) * (1 - m.smoothstep(edgewise / m.max(1, 2 * hoverInflow))) * thrust;
  push([0, 0, 0], [-shaft[0] * wash, -shaft[1] * wash, -shaft[2] * wash]);
  // Fin and stabilizer, where there is a boom to carry them: small plates that keep the nose
  // into the wind once the helicopter is moving.
  let finYaw = 0;
  const boom = tailAt ?? ([hub[0], hub[1] - 1, hub[2] - 1.15 * blades.radius] as Vec3);
  const disc = m.PI * blades.radius ** 2;
  if (c.tailAuthority > 0) {
    const tailAir = airAt(boom);
    const along = m.hypot(tailAir[2], tailAir[0]);
    const pressure = 0.5 * density * (tailAir[0] ** 2 + tailAir[1] ** 2 + tailAir[2] ** 2);
    const fin = rotor.finArea ?? 0.012 * disc;
    const side =
      -pressure *
      fin *
      c.tailAuthority *
      m.clamp(3 * m.atan2(tailAir[0], m.max(m.abs(tailAir[2]), 1)), -1, 1) *
      m.smoothstep(along / 8);
    finYaw = boom[2] * side;
    push(boom, [side, 0, 0]);
    const stabilizer = rotor.stabilizerArea ?? 0.015 * disc;
    const lift =
      -pressure *
      stabilizer *
      c.tailAuthority *
      m.clamp(3.5 * m.atan2(tailAir[1], m.max(m.abs(tailAir[2]), 1)), -1, 1) *
      m.smoothstep(along / 8);
    push([boom[0], 0, 0.85 * boom[2]], [0, lift, 0]);
  }

  const transmission = rotor.transmission ?? 0.97;
  const energy = rotorEnergy(spec);
  const governed = c.available > 0;
  const inertia = rotorcraftInertia(spec);
  const share = m.max(0.2, mass / spec.mass);
  const moments: Inertia = [inertia[0] * share, inertia[1] * share, inertia[2] * share];

  // Tail rotor: its thrust is to the right for a main rotor turning counterclockwise.
  let tailPower = 0;
  let pedal = 0;
  let pedalTrim = footwork ? s.rotor?.pedalTrim : undefined;
  const tailSpec = rotor.tail;
  const tailBlades = tailSpec ? tailRotorBlades(tailSpec) : undefined;
  const tailAxis: Vec3 = [-sense, 0, 0];

  // Shaft power and the tail rotor go together: the governor gives the rotors what they take,
  // the mast twists the fuselage by what it gives, and the tail rotor has to hold that. Three
  // rounds settle it.
  const mainPower = main.power * c.rotorAuthority;
  const governor = 2 * energy * speed * 4 * (1 - speed);
  const supply = (tailTakes: number): { demand: number; delivered: number } => {
    const demand = (mainPower + tailTakes) / transmission;
    return {
      demand,
      delivered: c.spooling
        ? m.max(0, demand)
        : governed
          ? m.clamp(demand + governor, 0, c.available)
          : 0,
    };
  };
  let drive = supply(0);
  // Thrust the tail rotor is making, N: it pushes the whole helicopter sideways too.
  let tailThrust = 0;
  // What the disc does to the yaw, with the swashplate where it was a moment ago.
  const lastCyclic = s.rotor?.cyclic ?? [0, 0];
  const discYaw = rotorOn([free[0] + lastCyclic[0], free[1] + lastCyclic[1]]).moment[1];
  if (tailSpec && tailBlades && tailAt) {
    const [right, left] = tailPitch(tailSpec);
    const air = airAt(tailAt);
    const flow = { axial: dot(air, tailAxis), edgewise: m.hypot(air[1], air[2]) };
    const lever = -sense * tailAt[2];
    let turned = tailRotorAt(
      tailBlades,
      density,
      speed,
      s.rotor?.pedal ?? 0.1,
      flow.axial,
      flow.edgewise,
    );
    if (footwork) {
      // Feet find the pedals where the assist had them, and a pedal that is held becomes
      // where they rest, as a held stick does.
      const last = s.rotor?.pedal;
      const found =
        pedalTrim ??
        (last === undefined || left === right
          ? 0
          : m.clamp(sense * (1 - (2 * (last - right)) / (left - right)), -1, 1));
      pedalTrim = m.clamp(found + h * 0.25 * m.clamp(input.yaw, -1, 1), -1, 1);
    }
    for (let round = 0; round < 3; round++) {
      if (footwork) {
        // Left pedal (for a rotor turning counterclockwise) is more tail rotor.
        const feet = (1 - sense * m.clamp((pedalTrim ?? 0) + m.clamp(input.yaw, -1, 1), -1, 1)) / 2;
        pedal = right + feet * (left - right);
      } else {
        // The pedals ask for a rate of turn. The tail rotor is set to what gives it, holding
        // the main rotor's torque on the way; the fin is left to weathervane the nose.
        const want = 10 * (-m.clamp(input.yaw, -1, 1) * helicopter.yawRate - omega[1]);
        // What goes up the mast: the tail rotor's share leaves the gearbox by its own shaft.
        const torque = angular > 1 ? (drive.delivered * transmission - tailPower) / angular : 0;
        const other = moment[1] + discYaw - sense * torque - finYaw;
        pedal = m.clamp(
          rotorPitchFor(
            tailBlades,
            { density, speed, axial: flow.axial, edgewise: flow.edgewise, inflow: turned.inflow },
            (moments[1] * want - other) / lever / m.max(c.tailAuthority, 0.05),
          ),
          right,
          left,
        );
      }
      turned = tailRotorAt(tailBlades, density, speed, pedal, flow.axial, flow.edgewise);
      tailPower = turned.loads.power * c.tailAuthority;
      drive = supply(tailPower);
    }
    tailThrust = turned.loads.thrust * c.tailAuthority;
    push(tailAt, [tailAxis[0] * tailThrust, 0, 0]);
  }
  const { demand, delivered } = drive;
  // The engines turn the main rotor against the fuselage: it is twisted the other way.
  if (angular > 1) moment[1] -= (sense * (delivered * transmission - tailPower)) / angular;
  const rpm = c.spooling
    ? speed
    : m.clamp(speed + (h * (delivered - demand)) / (2 * energy * m.max(speed, 0.2)), 0, 1.3);

  // Cyclic. Direct, the stick is the swashplate, about a trim that follows a held stick: it
  // starts where the assist had the swashplate, so taking the controls moves nothing.
  // Assisted, the stick asks for an attitude and the swashplate is put where the rotor turns
  // the helicopter toward it, as far as the swashplate goes and the rotor has thrust to do it.
  const travel = rotor.cyclic ?? 0.2;
  let command: [number, number];
  let trim = s.rotor?.trim;
  const base = rotorOn(free);
  if (direct) {
    const stick: [number, number] = [m.clamp(input.pitch, -1, 1), m.clamp(input.roll, -1, 1)];
    const held: [number, number] = trim ?? [
      m.clamp(-lastCyclic[0] / travel, -1, 1),
      m.clamp(-lastCyclic[1] / travel, -1, 1),
    ];
    trim = [
      m.clamp(held[0] + h * 0.25 * stick[0], -1, 1),
      m.clamp(held[1] + h * 0.25 * stick[1], -1, 1),
    ];
    // Stick back tilts the disc back; stick right tilts it right.
    command = [
      -travel * m.clamp(trim[0] + stick[0], -1, 1),
      -travel * m.clamp(trim[1] + stick[1], -1, 1),
    ];
  } else {
    trim = undefined;
    const nose = m.asin(m.clamp(toWorld([0, 0, 1])[1], -1, 1));
    const left = toWorld([1, 0, 0]);
    const up = toWorld([0, 1, 0]);
    const bank = m.atan2(left[1], up[1]);
    const authority = m.clamp(speed * speed, 0, 1);
    // The stick asks for a tilt of the disc, as it always has: centered, the thrust stands
    // upright but for the lean that answers the tail rotor's push (to the left, for a rotor
    // turning counterclockwise). The fuselage hangs under it where its balance puts it: nose up
    // by about the tilt of the shaft, low on the side the tail rotor pushes from.
    const hang = m.atan2(sense * tailThrust, m.max(weight, 1));
    const rest = rotor.shaftTilt ?? 0.05;
    const stiffen = authority * helicopter.cyclicResponse;
    // Near the hover with the stick left alone, the hands hold it over the ground: a little
    // tilt against whatever it is drifting at, as a pilot holds a hover by eye. Under way
    // (from 4 m/s, gone by 10) a helicopter keeps its speed, and a stick that is moved has its
    // way.
    const nosePoint = toWorld([0, 0, 1]);
    const flat = m.max(m.hypot(nosePoint[0], nosePoint[2]), 1e-6);
    const along = (velocity[0] * nosePoint[0] + velocity[2] * nosePoint[2]) / flat;
    const aside = (velocity[0] * nosePoint[2] - velocity[2] * nosePoint[0]) / flat;
    const holding = HOVER_HOLD * (1 - m.smoothstep((m.hypot(along, aside) - 4) / 6));
    const stickPitch = m.clamp(input.pitch, -1, 1);
    const stickRoll = m.clamp(input.roll, -1, 1);
    const holdPitch =
      m.clamp(holding * along, -HOVER_HOLD_TILT, HOVER_HOLD_TILT) * (1 - m.abs(stickPitch));
    const holdRoll =
      m.clamp(holding * aside, -HOVER_HOLD_TILT, HOVER_HOLD_TILT) * (1 - m.abs(stickRoll));
    // How far the disc is from where the stick wants it, with the swashplate level.
    const shortPitch = stickPitch * helicopter.cyclicTilt + holdPitch - (nose - rest - free[0]);
    const shortRoll = stickRoll * helicopter.cyclicTilt + holdRoll - hang - (bank - free[1]);
    // What a radian of swashplate does: the thrust swung about the center of mass, and the hub.
    const power = m.max(MIN_CONTROL_POWER, thrust * dot(hub, shaft) + stiffness);
    // The response the assisted helicopter has always had (a stiffness toward that tilt and a
    // damping), solved for the swashplate: tilting it moves the disc at once and turns the
    // fuselage after.
    command = [
      m.clamp(
        (-moments[0] * (stiffen * shortPitch - helicopter.cyclicDamping * s.pitchRate) -
          (moment[0] + base.moment[0])) /
          (power + moments[0] * stiffen),
        -travel,
        travel,
      ),
      m.clamp(
        (-moments[2] * (stiffen * shortRoll - helicopter.cyclicDamping * s.rollRate) +
          (moment[2] + base.moment[2])) /
          (power + moments[2] * stiffen),
        -travel,
        travel,
      ),
    ];
  }
  const flown = rotorOn([free[0] + command[0], free[1] + command[1]]);
  for (let i = 0; i < 3; i++) {
    force[i] = (force[i] ?? 0) + (flown.force[i] ?? 0);
    moment[i] = (moment[i] ?? 0) + (flown.moment[i] ?? 0);
  }

  // Skids: struts and friction at their four ends.
  const legs = aircraftGear(spec);
  const aloft = toWorld(force);
  let gear: GearStep | undefined;
  let held = false;
  const reach = c.transform.pos[1] - c.ground;
  if ((s.gearPosition ?? 1) >= 1 && reach < 1.5 + m.abs(velocity[1]) * h * c.travel) {
    const standing: GearState = s.wheels
      ? { spin: [...s.wheels.spin], load: [...s.wheels.load] }
      : initialGearState(legs);
    const carried = standing.load.reduce((total, load) => total + load, 0);
    const grip = legs.friction * c.grip * carried;
    const flat = m.hypot(aloft[0], aloft[2]);
    held =
      carried > 0 &&
      m.hypot(velocity[0], velocity[2]) < 0.1 &&
      m.abs(omega[1]) < 0.03 &&
      flat <= 0.9 * grip;
    gear = stepGear(standing, {
      geometry: legs,
      center: com,
      rot,
      velocity,
      omega,
      brake: 1,
      pedal: 0,
      steerAngle: 0,
      grip: c.grip,
      brakeDeceleration: helicopter.groundDeceleration,
      rollingDeceleration: 0,
      mass,
      ...(held ? { holding: aloft } : {}),
      groundHeight: c.groundHeight,
      h,
    });
    if (!gear.ok)
      return { ok: false, rot, pos: c.transform.pos as Vec3, rpm: speed, shaftPower: 0, gear };
    s.wheels = standing;
    const lift = toBody(gear.force);
    force[0] += lift[0];
    force[1] += lift[1];
    force[2] += lift[2];
    moment[0] += gear.moment[0];
    moment[1] += gear.moment[1];
    moment[2] += gear.moment[2];
  } else if (s.wheels) s.wheels = { spin: s.wheels.spin, load: s.wheels.load.map(() => 0) };

  // The rigid body.
  const turn = angularAcceleration(omega, moment, moments, h);
  const next: Vec3 = [omega[0] + turn[0] * h, omega[1] + turn[1] * h, omega[2] + turn[2] * h];
  const pushWorld = toWorld(force);
  const accel: Vec3 = [pushWorld[0] / mass, pushWorld[1] / mass, pushWorld[2] / mass];
  s.loadFactor = flown.force[1] / weight;
  s.velocity = [velocity[0] + accel[0] * h, velocity[1] + accel[1] * h, velocity[2] + accel[2] * h];
  if (held) {
    // Standing on its skids it goes nowhere; it can still settle on them.
    s.velocity[0] = 0;
    s.velocity[2] = 0;
    next[1] = 0;
    if (
      m.abs(s.velocity[1]) < 0.003 &&
      m.hypot(next[0], next[2]) < 0.003 &&
      m.abs(accel[1]) < 0.02 &&
      m.hypot(turn[0], turn[2]) < 0.02
    ) {
      s.velocity[1] = 0;
      next[0] = 0;
      next[2] = 0;
    }
  }
  s.pitchRate = -next[0];
  s.yawRate = next[1];
  s.rollRate = next[2];
  const turned = turnBody(rot, next, h);
  const pos = originFromCenterOfMass(
    [
      com[0] + s.velocity[0] * h * c.travel,
      com[1] + s.velocity[1] * h * c.travel,
      com[2] + s.velocity[2] * h * c.travel,
    ],
    turned,
    spec.centerOfMass,
  );
  // The air the rotor pulls follows its thrust late: the column above the disc has mass.
  const settle = m.min(1, h / inflowTime(blades, m.max(speed, 0.1), inflow));
  s.rotor = {
    inflow: speed > 0.05 ? inflow + (main.inflowTarget / cushion - inflow) * settle : 0,
    collective: pitch,
    cyclic: command,
    pedal,
    ...(trim ? { trim } : {}),
    ...(pedalTrim === undefined ? {} : { pedalTrim }),
    torque: c.rated > 0 ? (delivered * transmission) / c.rated : 0,
  };
  return { ok: true, rot: turned, pos, rpm, shaftPower: delivered, gear };
}
