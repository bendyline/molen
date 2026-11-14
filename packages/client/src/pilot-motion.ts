// The seated pilot's body under load: what g does to someone strapped into a moving seat. The
// eye point sinks in a pull and floats in a pushover, is pressed back by thrust and thrown
// forward by braking, sways in a skid, and the head lags a quick roll or pitch and leans toward
// the horizon in a turn. A render-only cue for a cockpit camera: it reads the simulation and
// never feeds back into it.

import { boostSpeedMultiplier } from '@bendyline/molen-schema';

type Vec3 = [number, number, number];
type Quat = readonly [number, number, number, number];

/** One direction the seated body moves in, as a damped spring driven by the load along it. */
export interface PilotMotionAxisTuning {
  /** Eye travel per g of load along the axis, meters. The body moves against the load. */
  travel: number;
  /**
   * Furthest travel in the negative and positive direction, meters, approached softly: the seat
   * pan, seat back and harness. Axes are +X left, +Y up, +Z forward.
   */
  limit: readonly [negative: number, positive: number];
  /** Natural frequency of the body on this axis, Hz: higher is tighter. */
  frequency: number;
  /** Damping ratio: 1 settles without overshoot, lower rebounds past rest first. */
  damping: number;
  /**
   * Share of a sustained load the pilot braces against, 0..1. The body gives way at the onset,
   * then recovers this much of the travel over `braceTime`, and is left leaning the other way
   * for a moment when the load comes off.
   */
  brace: number;
}

/** The head on its neck: small rotations, each a damped spring. */
export interface PilotMotionHeadTuning {
  /** Chin drop per g above 1, radians: the head is heavy in a pull and light in a pushover. */
  nod: number;
  /**
   * Chin drop per g of deceleration, radians: thrown forward, the head goes with the body.
   * Pressed back under thrust it meets the headrest and does not tip.
   */
  surgeNod: number;
  /** Head roll per g of sideways load, radians: toward the side the body is thrown. */
  swayTilt: number;
  /**
   * How far the head is left behind when the airframe starts to turn, seconds squared: radians
   * of lag per rad/s² of roll, pitch or yaw acceleration.
   */
  lag: number;
  /**
   * The head leveling toward the horizon in a bank, radians of tilt per radian of bank at small
   * angles. It peaks at 45° of bank (half this value) and is gone at knife-edge and inverted.
   */
  horizonLean: number;
  /** Largest rotation about any one axis, radians, approached softly. */
  limit: number;
  /** Height of the eyes above the neck's pivot, meters: a tilted head also moves the eye. */
  neck: number;
  /** Natural frequency of the head, Hz. */
  frequency: number;
  /** Damping ratio of the head. */
  damping: number;
}

/** Every knob of {@link PilotMotion}. Defaults are {@link DEFAULT_PILOT_MOTION}. */
export interface PilotMotionTuning {
  /** The global switch: off, the eye stays at the authored eye point. */
  enabled: boolean;
  /** Scales every displacement and rotation before its limit. 1 is the tuned amount. */
  intensity: number;
  /** Loads beyond this many g on an axis are clipped: an impact jolts, it does not launch. */
  maxLoad: number;
  /** Seconds the pilot takes to brace against a sustained load (see the axes' `brace`). */
  braceTime: number;
  /** Vertical: sinking into the seat under positive g, rising against the straps unloaded. */
  heave: PilotMotionAxisTuning;
  /** Fore-aft: pressed into the seat back under thrust, thrown onto the straps by braking. */
  surge: PilotMotionAxisTuning;
  /** Sideways: thrown to the outside of a skid or a turn on the ground. */
  sway: PilotMotionAxisTuning;
  head: PilotMotionHeadTuning;
}

/** A partial {@link PilotMotionTuning}: unset fields keep their current value. */
export type PilotMotionOverrides = {
  [K in keyof PilotMotionTuning]?: PilotMotionTuning[K] extends object
    ? Partial<PilotMotionTuning[K]>
    : PilotMotionTuning[K];
};

/**
 * The tuned defaults, sized to be felt more than seen. Flown through the kernel's flight model:
 * a 6 g pull in the P-51 lowers the eye 3 cm, presses it over 1 cm back and drops the chin 1.5°,
 * and on release the pilot comes up nearly 1 cm past rest before settling; 8.5 g in an F-16
 * sinks 3.8 cm. Full brakes at 0.75 g throw the pilot nearly 3 cm forward, half of which they
 * recover as they brace; full power presses them 1 cm back. A 60° bank tilts the head 3° toward
 * the horizon.
 */
export const DEFAULT_PILOT_MOTION: Readonly<PilotMotionTuning> = {
  enabled: true,
  intensity: 1,
  maxLoad: 12,
  braceTime: 1.2,
  heave: { travel: 0.008, limit: [0.045, 0.025], frequency: 2.6, damping: 0.5, brace: 0.3 },
  surge: { travel: 0.025, limit: [0.015, 0.06], frequency: 1.8, damping: 0.55, brace: 0.5 },
  sway: { travel: 0.03, limit: [0.05, 0.05], frequency: 1.6, damping: 0.55, brace: 0.6 },
  head: {
    nod: 0.006,
    surgeNod: 0.04,
    swayTilt: 0.05,
    lag: 0.004,
    horizonLean: 0.12,
    limit: 0.1,
    neck: 0.12,
    frequency: 2.4,
    damping: 0.6,
  },
};

/** One reading of the seat the pilot is strapped to. */
export interface PilotMotionSample {
  /**
   * Simulation time, seconds (`world.tick * world.dt`). The body moves in this time, so a paused
   * simulation holds it still and asking twice in one tick gives the same pose.
   */
  time: number;
  /** World position of the vehicle, to tell a teleport or a respawn from an acceleration. */
  position: readonly [number, number, number];
  /** Orientation of the vehicle: +X left, +Y up, +Z forward. */
  rotation: Quat;
  /** World velocity, m/s. */
  velocity: readonly [number, number, number];
  /** Factor by which `velocity` and travel are scaled up from the flown speed (boost mode). */
  travelScale?: number;
}

/** Where the pilot's eyes are, relative to the authored eye point and the airframe. */
export interface PilotMotionPose {
  /** Eye displacement in the seat frame, meters: +X left, +Y up, +Z forward. */
  offset: [number, number, number];
  /** Head pitch, radians, chin up positive. */
  pitch: number;
  /** Head yaw, radians, to the left positive. */
  yaw: number;
  /** Head roll, radians, right ear down positive. */
  roll: number;
}

/** A {@link PilotMotionSample} from a vehicle's transform and state. */
export function pilotMotionSample(
  time: number,
  transform: {
    pos: readonly [number, number, number];
    rot: readonly [number, number, number, number];
  },
  state: { velocity: readonly [number, number, number]; boosted?: boolean },
): PilotMotionSample {
  return {
    time,
    position: transform.pos,
    rotation: transform.rot,
    velocity: state.velocity,
    travelScale: boostSpeedMultiplier(state.boosted),
  };
}

const G = 9.81;
/** Longest integration step, seconds: several per cycle of the stiffest spring. */
const MAX_STEP = 1 / 120;
/** A gap this long between samples (a pause, a tab in the background) starts afresh. */
const MAX_GAP = 0.5;
/** Turn rates beyond this, rad/s, are a respawn or a reset rather than a maneuver. */
const MAX_TURN_RATE = 25;
/** Angular acceleration, rad/s², beyond which the head's lag is clipped. */
const MAX_TURN_ACCELERATION = 40;

/** `value` held within `-negative..positive`, easing into either end. */
function soften(value: number, negative: number, positive: number): number {
  const limit = value < 0 ? negative : positive;
  return limit > 0 ? limit * Math.tanh(value / limit) : 0;
}
const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));

/** A damped spring's next `[value, rate]` after `h` seconds of pulling toward `target`. */
function spring(
  value: number,
  rate: number,
  target: number,
  frequency: number,
  damping: number,
  h: number,
): [number, number] {
  const stiffness = 2 * Math.PI * frequency;
  // Semi-implicit Euler: the rate first, then the value with the new rate.
  const next =
    rate + h * (stiffness * stiffness * (target - value) - 2 * damping * stiffness * rate);
  return [value + h * next, next];
}

/** World vector `v` as the frame with orientation `q` sees it: `v` rotated by `q`'s inverse. */
function intoFrame(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  // With u = (x, y, z): v - 2w(u × v) + 2u × (u × v).
  const cx = y * v[2] - z * v[1],
    cy = z * v[0] - x * v[2],
    cz = x * v[1] - y * v[0];
  return [
    v[0] - 2 * (w * cx - (y * cz - z * cy)),
    v[1] - 2 * (w * cy - (z * cx - x * cz)),
    v[2] - 2 * (w * cz - (x * cy - y * cx)),
  ];
}

/** The rotation from `a` to `b` as a rotation vector in `a`'s own frame (radians). */
function turnBetween(a: Quat, b: Quat): Vec3 {
  // conj(a) ⊗ b
  let x = a[3] * b[0] - a[0] * b[3] - a[1] * b[2] + a[2] * b[1];
  let y = a[3] * b[1] + a[0] * b[2] - a[1] * b[3] - a[2] * b[0];
  let z = a[3] * b[2] - a[0] * b[1] + a[1] * b[0] - a[2] * b[3];
  let w = a[3] * b[3] + a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (w < 0) {
    x = -x;
    y = -y;
    z = -z;
    w = -w;
  }
  const sine = Math.hypot(x, y, z);
  if (sine < 1e-9) return [2 * x, 2 * y, 2 * z];
  const scale = (2 * Math.atan2(sine, w)) / sine;
  return [x * scale, y * scale, z * scale];
}

/**
 * A complete tuning: `base` (the defaults when omitted) with `settings` over it. `true` and
 * `false` only switch the effect; an object changes the fields it names.
 */
export function pilotMotionTuning(
  settings: boolean | PilotMotionOverrides = {},
  base: PilotMotionTuning = DEFAULT_PILOT_MOTION,
): PilotMotionTuning {
  const overrides = typeof settings === 'boolean' ? { enabled: settings } : settings;
  return {
    enabled: overrides.enabled ?? base.enabled,
    intensity: overrides.intensity ?? base.intensity,
    maxLoad: overrides.maxLoad ?? base.maxLoad,
    braceTime: overrides.braceTime ?? base.braceTime,
    heave: { ...base.heave, ...overrides.heave },
    surge: { ...base.surge, ...overrides.surge },
    sway: { ...base.sway, ...overrides.sway },
    head: { ...base.head, ...overrides.head },
  };
}

/** The body's axes in seat order: X (left), Y (up), Z (forward). */
const AXES = ['sway', 'heave', 'surge'] as const;
const XYZ = [0, 1, 2] as const;

/**
 * The pilot's body in the seat. Feed it the vehicle's motion once a frame with {@link update}
 * and pass the pose it returns to `aircraftCameraPose` as `motion`.
 *
 * What the pilot feels is the specific force in the seat frame: the vehicle's acceleration less
 * gravity, 1 g straight up through the seat when parked or in level flight. The body is three
 * damped springs driven by how far that is from 1 g up, and the head three more.
 */
export class PilotMotion {
  /** Live tuning: change a field and the next {@link update} uses it. */
  tuning: PilotMotionTuning;
  /**
   * The load last felt, in g, in the seat frame (+X left, +Y up, +Z forward): [0, 1, 0] parked
   * or in level flight, [0, 4, 0] in a 4 g pull. For a HUD or for tuning.
   */
  readonly load: [number, number, number] = [0, 1, 0];
  private readonly current: PilotMotionPose = { offset: [0, 0, 0], pitch: 0, yaw: 0, roll: 0 };
  private previous:
    | { time: number; position: Vec3; rotation: Quat; velocity: Vec3; turn: Vec3 | undefined }
    | undefined;
  // Body travel and its rate per axis (x, y, z), and the load the pilot has braced against.
  private readonly travel: Vec3 = [0, 0, 0];
  private readonly travelRate: Vec3 = [0, 0, 0];
  private readonly braced: Vec3 = [0, 0, 0];
  // Head rotation vector in the seat frame (about left, up and forward) and its rate.
  private readonly head: Vec3 = [0, 0, 0];
  private readonly headRate: Vec3 = [0, 0, 0];

  constructor(settings: boolean | PilotMotionOverrides = {}) {
    this.tuning = pilotMotionTuning(settings);
  }

  /** Change some of the tuning; `true` and `false` switch the whole effect. */
  configure(settings: boolean | PilotMotionOverrides): void {
    this.tuning = pilotMotionTuning(settings, this.tuning);
  }

  /** The pose as of the last {@link update}. */
  get pose(): PilotMotionPose {
    return this.current;
  }

  /** Forget the motion so far: for a new seat. The next sample starts settled in it. */
  reset(): void {
    this.previous = undefined;
    for (const values of [this.travel, this.travelRate, this.braced, this.head, this.headRate])
      values.fill(0);
    this.load[0] = 0;
    this.load[1] = 1;
    this.load[2] = 0;
    this.write();
  }

  /** Advance to `sample.time` and return where the pilot's eyes now are. */
  update(sample: PilotMotionSample): PilotMotionPose {
    if (!this.tuning.enabled) {
      if (this.previous !== undefined) this.reset();
      return this.current;
    }
    const scale = sample.travelScale && sample.travelScale > 0 ? sample.travelScale : 1;
    const velocity: Vec3 = [
      sample.velocity[0] / scale,
      sample.velocity[1] / scale,
      sample.velocity[2] / scale,
    ];
    const position: Vec3 = [...sample.position];
    const rotation: Quat = [...sample.rotation];
    // World up as the seat sees it: the load when nothing accelerates, and the bank for the lean.
    const upward = intoFrame(rotation, [0, 1, 0]);
    const last = this.previous;
    const dt = last === undefined ? 0 : sample.time - last.time;
    if (last !== undefined && dt === 0) return this.current;
    let turn: Vec3 | undefined;
    let fresh = last === undefined || dt < 0 || dt > MAX_GAP;
    if (last !== undefined && !fresh) {
      // Farther than its speed carries it is a teleport: a respawn, a recovery, a new place.
      const moved = Math.hypot(
        position[0] - last.position[0],
        position[1] - last.position[1],
        position[2] - last.position[2],
      );
      const reach = Math.max(Math.hypot(...velocity), Math.hypot(...last.velocity)) * scale * dt;
      turn = turnBetween(last.rotation, rotation).map((v) => v / dt) as Vec3;
      if (moved > 2 * reach + 3 || Math.hypot(...turn) > MAX_TURN_RATE) fresh = true;
    }
    if (last === undefined || fresh) {
      // Settled in the seat as it stands, braced against its tilt: nothing moves on boarding.
      this.reset();
      this.previous = { time: sample.time, position, rotation, velocity, turn: undefined };
      const deviation: Vec3 = [upward[0], upward[1] - 1, upward[2]];
      this.load[0] = upward[0];
      this.load[1] = upward[1];
      this.load[2] = upward[2];
      const targets = this.targets(deviation, deviation, upward, [0, 0, 0]);
      for (const i of XYZ) {
        this.braced[i] = deviation[i];
        this.travel[i] = targets.travel[i];
        this.head[i] = targets.head[i];
      }
      this.write();
      return this.current;
    }
    const felt = intoFrame(rotation, [
      (velocity[0] - last.velocity[0]) / dt / G,
      (velocity[1] - last.velocity[1]) / dt / G + 1,
      (velocity[2] - last.velocity[2]) / dt / G,
    ]);
    this.load[0] = felt[0];
    this.load[1] = felt[1];
    this.load[2] = felt[2];
    const limit = Math.max(0, this.tuning.maxLoad);
    const deviation: Vec3 = [
      clamp(felt[0], limit),
      clamp(felt[1] - 1, limit),
      clamp(felt[2], limit),
    ];
    const turning: Vec3 = turn ?? [0, 0, 0];
    // The airframe's angular acceleration, which the head is slow to follow.
    const before = last.turn;
    const spin: Vec3 =
      before === undefined
        ? [0, 0, 0]
        : [
            clamp((turning[0] - before[0]) / dt, MAX_TURN_ACCELERATION),
            clamp((turning[1] - before[1]) / dt, MAX_TURN_ACCELERATION),
            clamp((turning[2] - before[2]) / dt, MAX_TURN_ACCELERATION),
          ];
    this.previous = { time: sample.time, position, rotation, velocity, turn: turning };

    const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    const h = dt / steps;
    const { head } = this.tuning;
    const bracing = 1 - Math.exp(-h / Math.max(1e-3, this.tuning.braceTime));
    for (let n = 0; n < steps; n++) {
      const targets = this.targets(deviation, this.braced, upward, spin);
      for (const i of XYZ) {
        const axis = this.tuning[AXES[i]];
        [this.travel[i], this.travelRate[i]] = spring(
          this.travel[i],
          this.travelRate[i],
          targets.travel[i],
          axis.frequency,
          axis.damping,
          h,
        );
        [this.head[i], this.headRate[i]] = spring(
          this.head[i],
          this.headRate[i],
          targets.head[i],
          head.frequency,
          head.damping,
          h,
        );
        this.braced[i] += bracing * (deviation[i] - this.braced[i]);
      }
    }
    this.write();
    return this.current;
  }

  /**
   * Where the springs are heading: body travel per axis and the head's rotation vector, for a
   * load `deviation` from 1 g up of which the pilot has `braced` against a share.
   */
  private targets(
    deviation: Vec3,
    braced: Vec3,
    upward: Vec3,
    spin: Vec3,
  ): { travel: Vec3; head: Vec3 } {
    const { head, sway, heave, surge } = this.tuning;
    // The load left to move the body once the pilot has braced against the sustained part.
    const held: Vec3 = [
      deviation[0] - sway.brace * braced[0],
      deviation[1] - heave.brace * braced[1],
      deviation[2] - surge.brace * braced[2],
    ];
    return {
      // The body goes where the load is not: down in a pull, back under thrust.
      travel: [-sway.travel * held[0], -heave.travel * held[1], -surge.travel * held[2]],
      head: [
        // About the left axis, chin down positive. Thrown forward the head goes with the body;
        // pressed back it has the headrest behind it.
        head.nod * held[1] - head.surgeNod * Math.min(0, held[2]) - head.lag * spin[0],
        -head.lag * spin[1],
        // About the forward axis, right ear down positive: with the body, and toward the horizon.
        head.swayTilt * held[0] -
          head.horizonLean * upward[0] * Math.max(0, upward[1]) -
          head.lag * spin[2],
      ],
    };
  }

  private write(): void {
    const { intensity, head } = this.tuning;
    const turn = this.head.map((v) => soften(v * intensity, head.limit, head.limit)) as Vec3;
    const pose = this.current;
    for (const i of XYZ) {
      const axis = this.tuning[AXES[i]];
      pose.offset[i] = soften(this.travel[i] * intensity, axis.limit[0], axis.limit[1]);
    }
    // The eyes ride above the neck's pivot: a nod carries them forward, a tilt to the side.
    pose.offset[0] -= head.neck * Math.sin(turn[2]);
    pose.offset[2] += head.neck * Math.sin(turn[0]);
    pose.pitch = -turn[0];
    pose.yaw = turn[1];
    pose.roll = turn[2];
  }
}
