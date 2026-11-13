/**
 * Where a camera is going, from the track of its own recent positions.
 *
 * Building a tile takes about a second, so a fast camera has passed whatever it starts building
 * for its current position. The stream uses this track to build for where the camera will be. It
 * models a constant speed and turn rate rather than a straight line: an aircraft in a steady turn
 * flies an arc, and a straight extrapolation from it points away from the ground it is about to
 * cross. Times are milliseconds, and only differences between them matter.
 */

type Vec3 = [number, number, number];

/** How quickly velocity follows the samples, seconds. */
const VELOCITY_SMOOTHING = 0.5;
/** How quickly the turn rate follows the heading, seconds. */
const TURN_SMOOTHING = 1;
/** Samples closer together than this wait for the next one: their step is mostly noise. */
const MIN_SAMPLE_SECONDS = 0.04;
/** A longer gap (a hidden tab, a long frame) says nothing about travel. */
const MAX_SAMPLE_SECONDS = 1;
/** A track reports nothing until it has run this long, so isolated moves are not travel. */
const SETTLE_SECONDS = 0.75;
/** Turn rates past this are a camera being swung around, not a path, radians per second. */
const MAX_TURN_RATE = 1;
/** One prediction never sweeps past a half circle. */
const MAX_SWEEP = Math.PI;

export interface TerrainTrackPrediction {
  position: Vec3;
  /** Heading change along the way, radians from +x toward +z. */
  turn: number;
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export class TerrainCameraTrack {
  private last: { time: number; position: Vec3 } | undefined;
  private velocity: Vec3 | undefined;
  private heading: number | undefined;
  private turnRate = 0;
  private tracked = 0;

  /** `maxStep` is the longest step, world units, that is travel rather than a teleport. */
  constructor(private readonly maxStep: number) {}

  sample(timeMs: number, position: readonly number[]): void {
    const point: Vec3 = [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0];
    if (this.last === undefined) {
      this.last = { time: timeMs, position: point };
      return;
    }
    const dt = (timeMs - this.last.time) / 1000;
    const from = this.last.position;
    const dx = point[0] - from[0];
    const dy = point[1] - from[1];
    const dz = point[2] - from[2];
    // Before the spacing check: a teleport one frame after a fast sample must not leave its speed.
    if (dt > MAX_SAMPLE_SECONDS || Math.hypot(dx, dy, dz) > this.maxStep) {
      this.reset();
      this.last = { time: timeMs, position: point };
      return;
    }
    if (dt < MIN_SAMPLE_SECONDS) return;
    this.last = { time: timeMs, position: point };
    this.tracked += dt;
    const raw: Vec3 = [dx / dt, dy / dt, dz / dt];
    const blend = 1 - Math.exp(-dt / VELOCITY_SMOOTHING);
    const previous = this.velocity;
    const velocity: Vec3 =
      previous === undefined
        ? raw
        : [
            previous[0] + blend * (raw[0] - previous[0]),
            previous[1] + blend * (raw[1] - previous[1]),
            previous[2] + blend * (raw[2] - previous[2]),
          ];
    this.velocity = velocity;
    if (Math.hypot(velocity[0], velocity[2]) < 1e-6) return;
    const heading = Math.atan2(velocity[2], velocity[0]);
    if (this.heading !== undefined) {
      const rate = wrapAngle(heading - this.heading) / dt;
      const limited = Math.max(-MAX_TURN_RATE, Math.min(MAX_TURN_RATE, rate));
      this.turnRate += (1 - Math.exp(-dt / TURN_SMOOTHING)) * (limited - this.turnRate);
    }
    this.heading = heading;
  }

  /** Horizontal speed, world units per second; zero until the track has settled. */
  get speed(): number {
    if (this.velocity === undefined || this.tracked < SETTLE_SECONDS) return 0;
    return Math.hypot(this.velocity[0], this.velocity[2]);
  }

  /** Where the camera will be after `seconds` at its current speed and turn rate. */
  predict(seconds: number): TerrainTrackPrediction | undefined {
    const position = this.last?.position;
    const velocity = this.velocity;
    if (position === undefined || velocity === undefined) return undefined;
    const [vx, vy, vz] = velocity;
    const sweep = Math.max(-MAX_SWEEP, Math.min(MAX_SWEEP, this.turnRate * seconds));
    let dx = vx * seconds;
    let dz = vz * seconds;
    if (Math.abs(sweep) > 1e-3) {
      const radius = (Math.hypot(vx, vz) * seconds) / sweep;
      const heading = Math.atan2(vz, vx);
      dx = radius * (Math.sin(heading + sweep) - Math.sin(heading));
      dz = radius * (Math.cos(heading) - Math.cos(heading + sweep));
    }
    return {
      position: [position[0] + dx, position[1] + vy * seconds, position[2] + dz],
      turn: sweep,
    };
  }

  reset(): void {
    this.last = undefined;
    this.velocity = undefined;
    this.heading = undefined;
    this.turnRate = 0;
    this.tracked = 0;
  }
}
