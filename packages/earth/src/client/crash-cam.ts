/**
 * The crash camera: when a part breaks off the car the viewer drives or the aircraft they fly,
 * the view cuts to a camera standing beside the vehicle's path, a little ahead of it, the way a
 * broadcast or a replay frames a crash. It holds while the wreck tumbles and slides, follows it
 * with a slow push in, and gives the view back once it has come to rest (at least `seconds`,
 * longer while further parts break, never more than twice that past the last break). A wreck that
 * runs on past the camera is followed, the camera dollying after it so it stays large in the frame;
 * one gone in a jump (a recovery, a re-anchor) gets a new camera set up ahead of it.
 *
 * The earth view owns one (`mountEarthView({ crashCam })`, `EarthView.setCrashCam`) and feeds it
 * the driven or flown vehicle every frame: where its middle is, its heading, its size and how
 * many of its parts have broken off. Everything else (when to cut, where to stand, when to cut
 * back) is decided here, so it runs without a renderer in tests. The view only asks the ground
 * height and the line of sight from a vehicle to a camera place, and only when a camera is set up.
 *
 * Gotchas: velocity is measured from the vehicle's own positions over the frames, not read from
 * its state (a wreck caught in something can report speed it does not have), and a jump of more
 * than 400 m/s is a teleport (a recovery, a re-anchor) and is not counted. A vehicle that changes
 * (another one boarded) starts again from what it has broken, so boarding a wreck does not cut.
 *
 * Related: earth-view.ts (the glue and the `crash`/`crashcam` events), vehicles.ts and
 * aircraft.ts (the subjects), kernel vehicle-damage.ts and aircraft-collision.ts (what breaks).
 */

/** What `mountEarthView({ crashCam })` and `EarthView.setCrashCam` take. */
export interface EarthCrashCamOptions {
  /** Whether a crash cuts to the crash camera (default true when options are given). */
  enabled?: boolean;
  /**
   * The shortest shot, seconds (default 4; an aircraft's is half as long again). The camera stays
   * until the wreck has come to rest, and at most this long again after the last part broke off.
   */
  seconds?: number;
}

/** The vehicle the crash camera watches, as the view sees it this frame. */
export interface CrashCamSubject {
  id: string;
  kind: 'vehicle' | 'aircraft';
  /** The middle of the vehicle, in the view's metric frame. */
  center: [number, number, number];
  /** Compass heading, radians (0 north, PI/2 east): the way it faces when it is not moving. */
  heading: number;
  /** Radius of a sphere round the whole vehicle, meters. */
  radius: number;
  /** Parts broken off so far (an aircraft that has crashed counts one more). */
  broken: number;
}

/** What the crash camera asks of the world when it sets a camera up. */
export interface CrashCamWorld {
  /** Ground height under X/Z, or undefined where it has not loaded. */
  groundHeight(x: number, z: number): number | undefined;
  /**
   * How far from `from` toward `to` the first solid thing is, or undefined when the way is clear.
   */
  blocked(from: [number, number, number], to: [number, number, number]): number | undefined;
}

/** The camera this frame while a shot runs. */
export interface CrashCamPose {
  position: [number, number, number];
  lookAt: [number, number, number];
}

/** What {@link CrashCam.update} reports for a frame. */
export interface CrashCamFrame {
  /** The camera to draw from, while a shot runs. */
  pose?: CrashCamPose;
  /** Parts that broke off the subject this frame (0 most frames). */
  broke: number;
  /** A shot began this frame. */
  started: boolean;
  /** A shot ended this frame (it ran out, was cancelled, or the subject went). */
  ended: boolean;
}

const DEFAULT_SECONDS = 4;
/** Below this speed (m/s), held for {@link REST_SECONDS}, a wreck has come to rest. */
const REST_SPEED = 1.5;
const REST_SECONDS = 0.6;
/** A move faster than this (m/s) between frames is a teleport, not travel. */
const TELEPORT_SPEED = 400;
/** How much nearer the camera creeps over a shot, as a share of its distance. */
const PUSH_IN = 0.22;
/**
 * A wreck that runs on is followed: the camera dollies after it once it is this many times the
 * distance the camera was set up at, so it stays large in the frame.
 */
const FOLLOW = 1.4;
/** Further than this many times that distance in one frame (a teleport, a re-anchor): a new camera. */
const RESET = 3;

interface Shot {
  /** Where the camera was set up. */
  anchor: [number, number, number];
  /** Its distance from the subject when set up. */
  reach: number;
  /** Seconds since the shot began, and the time it may end from. */
  elapsed: number;
  until: number;
  /** Seconds the subject has been at rest. */
  resting: number;
  lookAt: [number, number, number];
}

/** A shared resolver for the option forms: `true`, `false`, or settings. */
export function crashCamSettings(
  value: boolean | EarthCrashCamOptions | undefined,
  previous: { enabled: boolean; seconds: number } = { enabled: false, seconds: DEFAULT_SECONDS },
): { enabled: boolean; seconds: number } {
  if (value === undefined) return previous;
  if (typeof value === 'boolean') return { ...previous, enabled: value };
  const seconds =
    value.seconds !== undefined && Number.isFinite(value.seconds) && value.seconds > 0
      ? value.seconds
      : previous.seconds;
  return { enabled: value.enabled ?? true, seconds };
}

export class CrashCam {
  enabled: boolean;
  seconds: number;
  private subject: string | undefined;
  private broken = 0;
  private last: [number, number, number] | undefined;
  /** Velocity, m/s, smoothed over a few frames: what the vehicle was doing as it broke. */
  private velocity: [number, number, number] = [0, 0, 0];
  private speed = 0;
  private shot: Shot | undefined;

  constructor(settings: { enabled: boolean; seconds: number }) {
    this.enabled = settings.enabled;
    this.seconds = settings.seconds;
  }

  /** Whether a shot is running. */
  get active(): boolean {
    return this.shot !== undefined;
  }

  /** End the shot now (the viewer asked for their own view back); true when one was running. */
  cancel(): boolean {
    const running = this.shot !== undefined;
    this.shot = undefined;
    return running;
  }

  /** One frame: the watched vehicle (undefined on foot or in orbit) and the frame's seconds. */
  update(dt: number, subject: CrashCamSubject | undefined, world: CrashCamWorld): CrashCamFrame {
    const frame: CrashCamFrame = { broke: 0, started: false, ended: false };
    if (subject === undefined || subject.id !== this.subject) {
      // On foot, or in another vehicle: whatever that one has broken is not news.
      frame.ended = this.cancel();
      this.subject = subject?.id;
      this.broken = subject?.broken ?? 0;
      this.last = subject?.center;
      this.velocity = [0, 0, 0];
      this.speed = 0;
      return frame;
    }
    this.measure(dt, subject.center);
    if (subject.broken < this.broken) this.broken = subject.broken; // Repaired.
    if (subject.broken > this.broken) {
      frame.broke = subject.broken - this.broken;
      this.broken = subject.broken;
      if (this.enabled) {
        const minimum = this.minimum(subject);
        if (this.shot === undefined) {
          this.shot = this.setUp(subject, world, minimum);
          frame.started = true;
        } else {
          this.shot.until = Math.max(this.shot.until, this.shot.elapsed + minimum * 0.75);
        }
      }
    }
    const shot = this.shot;
    if (shot === undefined) return frame;
    if (!this.enabled) {
      frame.ended = this.cancel();
      return frame;
    }
    shot.elapsed += Math.max(0, dt);
    shot.resting = this.speed < REST_SPEED ? shot.resting + Math.max(0, dt) : 0;
    const minimum = this.minimum(subject);
    if (
      (shot.elapsed >= shot.until && shot.resting >= REST_SECONDS) ||
      shot.elapsed >= shot.until + minimum
    ) {
      frame.ended = this.cancel();
      return frame;
    }
    const away = distance(shot.anchor, subject.center);
    if (away > shot.reach * RESET) {
      // Gone in a jump: set up again ahead of it.
      const next = this.setUp(subject, world, shot.until);
      shot.anchor = next.anchor;
      shot.reach = next.reach;
      shot.lookAt = [...subject.center];
    } else if (away > shot.reach * FOLLOW) {
      // Running on: dolly after it, staying clear of the ground.
      const pull = (away - shot.reach * FOLLOW) / away;
      const anchor = shot.anchor;
      for (let i = 0; i < 3; i++)
        anchor[i] = (anchor[i] ?? 0) + ((subject.center[i] ?? 0) - (anchor[i] ?? 0)) * pull;
      const ground = world.groundHeight(anchor[0], anchor[2]);
      if (ground !== undefined)
        anchor[1] = Math.max(anchor[1], ground + (subject.kind === 'aircraft' ? 4 : 1.4));
    }
    const follow = 1 - Math.exp(-Math.max(0, dt) / 0.08);
    for (let i = 0; i < 3; i++)
      shot.lookAt[i] =
        (shot.lookAt[i] ?? 0) + ((subject.center[i] ?? 0) - (shot.lookAt[i] ?? 0)) * follow;
    // A slow push in on the wreck over the shot.
    const t = Math.min(1, shot.elapsed / Math.max(shot.until, 1e-3));
    const push = PUSH_IN * t * t * (3 - 2 * t);
    const position: [number, number, number] = [
      shot.anchor[0] + (shot.lookAt[0] - shot.anchor[0]) * push,
      shot.anchor[1] + (shot.lookAt[1] - shot.anchor[1]) * push,
      shot.anchor[2] + (shot.lookAt[2] - shot.anchor[2]) * push,
    ];
    frame.pose = { position, lookAt: [...shot.lookAt] };
    return frame;
  }

  private minimum(subject: CrashCamSubject): number {
    return subject.kind === 'aircraft' ? this.seconds * 1.5 : this.seconds;
  }

  private measure(dt: number, center: [number, number, number]): void {
    const last = this.last;
    this.last = [...center];
    if (last === undefined || !(dt > 0)) return;
    const step: [number, number, number] = [
      (center[0] - last[0]) / dt,
      (center[1] - last[1]) / dt,
      (center[2] - last[2]) / dt,
    ];
    if (Math.hypot(...step) > TELEPORT_SPEED) return;
    const blend = 1 - Math.exp(-dt / 0.15);
    for (let i = 0; i < 3; i++)
      this.velocity[i] =
        (this.velocity[i] ?? 0) + ((step[i] ?? 0) - (this.velocity[i] ?? 0)) * blend;
    this.speed = Math.hypot(...this.velocity);
  }

  /**
   * A camera beside the vehicle's path and ahead of it, at a distance that frames it and the
   * ground it is about to cover, on whichever side it can see the vehicle from; nearer in when
   * neither side can.
   */
  private setUp(subject: CrashCamSubject, world: CrashCamWorld, until: number): Shot {
    const air = subject.kind === 'aircraft';
    const [vx, , vz] = this.velocity;
    const level = Math.hypot(vx, vz);
    // The way it is going, or facing when it is barely moving (compass: north is -z).
    const ahead: [number, number] =
      level > 1
        ? [vx / level, vz / level]
        : [Math.sin(subject.heading), -Math.cos(subject.heading)];
    const side: [number, number] = [-ahead[1], ahead[0]];
    // Close enough that the vehicle fills a good part of the frame, further for a faster one so
    // it does not cross the frame in an instant.
    const reach = air
      ? clamp(subject.radius * 2.5 + level * 0.2, 18, 80)
      : clamp(subject.radius * 2.8 + level * 0.3, 7, 28);
    const lead = clamp(level * (air ? 0.45 : 0.6), 0, reach);
    const rise = air ? Math.max(6, subject.radius * 0.6) : 1.2 + subject.radius * 0.5;
    const place = (sign: number, scale: number): [number, number, number] => {
      const x = subject.center[0] + ahead[0] * lead * scale + side[0] * sign * reach * scale;
      const z = subject.center[2] + ahead[1] * lead * scale + side[1] * sign * reach * scale;
      const ground = world.groundHeight(x, z);
      let y = subject.center[1] + rise * Math.max(scale, 0.6);
      if (ground !== undefined) y = Math.max(y, ground + (air ? 4 : 1.4));
      return [x, y, z];
    };
    let chosen: [number, number, number] | undefined;
    let fallback: [number, number, number] | undefined;
    search: for (const scale of [1, 0.7, 0.45])
      for (const sign of [1, -1]) {
        const candidate = place(sign, scale);
        const hit = world.blocked(subject.center, candidate);
        if (hit === undefined) {
          chosen = candidate;
          break search;
        }
        if (fallback === undefined) {
          // Pulled in to just short of what is in the way.
          const span = distance(subject.center, candidate) || 1;
          const keep = Math.max(subject.radius + 1, hit - 0.5) / span;
          fallback = [
            subject.center[0] + (candidate[0] - subject.center[0]) * keep,
            subject.center[1] + (candidate[1] - subject.center[1]) * keep,
            subject.center[2] + (candidate[2] - subject.center[2]) * keep,
          ];
        }
      }
    const anchor = chosen ?? fallback ?? place(1, 1);
    return {
      anchor,
      reach: Math.max(distance(anchor, subject.center), subject.radius + 1),
      elapsed: 0,
      until,
      resting: 0,
      lookAt: [...subject.center],
    };
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(
    (a[0] ?? 0) - (b[0] ?? 0),
    (a[1] ?? 0) - (b[1] ?? 0),
    (a[2] ?? 0) - (b[2] ?? 0),
  );
}
