// Orbit navigation around a ground target, the "map" camera: drag to rotate and tilt, wheel or
// pinch to zoom, secondary-drag / two fingers / keys to pan across the ground, and animated
// fly-to. The camera eases toward a goal state, which gives inertia-like smoothing and lets
// fly-to and direct manipulation share one path. Works in any metric world frame, including one
// whose origin a renderer rebases (poses are absolute world coordinates).

import type { NavigationVector } from './camera-math';
import type { NavigationInput } from './input-source';

/** The orbit camera's framing. */
export interface OrbitState {
  /** Ground point the camera looks at (world meters). */
  target: NavigationVector;
  /** Camera distance from the target in meters. */
  range: number;
  /** Compass bearing of the view in radians: 0 looks north, PI/2 east. */
  heading: number;
  /** Downward tilt from the horizon in radians: small is oblique, PI/2 looks straight down. */
  pitch: number;
}

/** A camera placement: position, the point it looks at, and its unit view direction. */
export interface NavigationPose {
  position: NavigationVector;
  lookAt: NavigationVector;
  direction: NavigationVector;
}

/** World facts a controller may query. */
export interface NavigationEnvironment {
  /** Ground height at world X/Z, or undefined while that terrain is not loaded. */
  groundHeight(x: number, z: number): number | undefined;
}

export interface OrbitControllerOptions {
  minRange?: number;
  maxRange?: number;
  minPitch?: number;
  maxPitch?: number;
  /** Radians per CSS pixel of drag (default 0.005). */
  rotateSensitivity?: number;
  /** Seconds to close ~63% of the gap to the goal (default 0.12; 0 disables smoothing). */
  smoothing?: number;
  /** Minimum camera height above the ground under it, meters (default 3). */
  minClearance?: number;
}

export interface OrbitFlyToOptions {
  /** Animation length (default scales with distance, 0.6-3 s). */
  durationMs?: number;
}

const TAU = Math.PI * 2;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function wrapAngle(angle: number): number {
  return angle - TAU * Math.floor((angle + Math.PI) / TAU);
}

function copyState(state: OrbitState): OrbitState {
  return { ...state, target: [...state.target] };
}

interface Flight {
  from: OrbitState;
  to: OrbitState;
  startMs: number;
  durationMs: number;
  /** Extra range at mid-flight so long hops rise above the scenery. */
  lift: number;
}

export class OrbitController {
  private goal: OrbitState;
  private current: OrbitState;
  private flight: Flight | undefined;
  private clock = 0;
  private readonly minRange: number;
  private readonly maxRange: number;
  private readonly minPitch: number;
  private readonly maxPitch: number;
  private readonly rotateSensitivity: number;
  private readonly smoothing: number;
  private readonly minClearance: number;

  constructor(initial: OrbitState, options: OrbitControllerOptions = {}) {
    this.minRange = options.minRange ?? 20;
    this.maxRange = options.maxRange ?? 400_000;
    this.minPitch = options.minPitch ?? 0.08;
    this.maxPitch = options.maxPitch ?? Math.PI / 2 - 0.01;
    this.rotateSensitivity = options.rotateSensitivity ?? 0.005;
    this.smoothing = options.smoothing ?? 0.12;
    this.minClearance = options.minClearance ?? 3;
    this.goal = this.clamp(copyState(initial));
    this.current = copyState(this.goal);
  }

  /** The state the camera is currently showing. */
  get state(): OrbitState {
    return copyState(this.current);
  }

  /** Whether a fly-to animation is running. */
  get flying(): boolean {
    return this.flight !== undefined;
  }

  /** Jump to a framing immediately (fields omitted keep their values). */
  set(state: Partial<OrbitState>): void {
    this.flight = undefined;
    this.goal = this.clamp({ ...copyState(this.goal), ...state });
    this.current = copyState(this.goal);
  }

  /** Animate to a framing; direct input during the flight cancels it. */
  flyTo(state: Partial<OrbitState>, options: OrbitFlyToOptions = {}): void {
    const from = copyState(this.current);
    const to = this.clamp({ ...copyState(this.goal), ...state });
    const distance = Math.hypot(to.target[0] - from.target[0], to.target[2] - from.target[2]);
    const durationMs =
      options.durationMs ??
      Math.min(3000, Math.max(600, 600 + Math.log2(1 + distance / 500) * 400));
    const lift = Math.max(
      0,
      Math.min(this.maxRange, distance * 0.6) - Math.max(from.range, to.range),
    );
    this.flight = { from, to, startMs: this.clock, durationMs: Math.max(1, durationMs), lift };
    this.goal = copyState(to);
  }

  /**
   * Advance by `dt` seconds under `input` and return the pose to render. The target settles onto
   * the ground as terrain streams in, and the camera never dips below `minClearance`.
   */
  update(dt: number, input: NavigationInput, environment: NavigationEnvironment): NavigationPose {
    const step = Math.max(0, Math.min(0.25, dt));
    this.clock += step * 1000;
    if (this.flight !== undefined && this.hasManipulation(input)) {
      this.goal = copyState(this.current);
      this.flight = undefined;
    }
    if (this.flight !== undefined) {
      this.advanceFlight();
    } else {
      this.applyInput(step, input);
      const blend = this.smoothing <= 0 ? 1 : 1 - Math.exp(-step / this.smoothing);
      this.current = this.interpolate(this.current, this.goal, blend, 0);
    }
    const ground = environment.groundHeight(this.current.target[0], this.current.target[2]);
    if (ground !== undefined) {
      // Ease onto newly streamed ground rather than snapping as finer tiles refine.
      const settle = 1 - Math.exp(-step / 0.15);
      this.current.target[1] += (ground - this.current.target[1]) * settle;
      this.goal.target[1] = this.current.target[1];
    }
    return this.pose(environment);
  }

  private hasManipulation(input: NavigationInput): boolean {
    const { move } = input;
    return (
      input.look[0] !== 0 ||
      input.look[1] !== 0 ||
      input.pan[0] !== 0 ||
      input.pan[1] !== 0 ||
      input.zoom !== 0 ||
      input.twist !== 0 ||
      move.forward !== 0 ||
      move.right !== 0 ||
      move.up !== 0
    );
  }

  private applyInput(dt: number, input: NavigationInput): void {
    const goal = this.goal;
    // The scene follows the pointer: dragging or twisting clockwise turns the view counter-
    // clockwise, and dragging down tips the camera toward looking straight down.
    goal.heading = wrapAngle(goal.heading - input.look[0] * this.rotateSensitivity - input.twist);
    goal.pitch += input.look[1] * this.rotateSensitivity;
    const zoom = input.zoom - input.move.up * dt * 1.5;
    goal.range *= Math.exp(-zoom);
    // Pan: screen drags move the ground under the pointer; keys move along the view heading.
    const metersPerPixel = (goal.range * 0.0012) / Math.max(0.3, Math.sin(goal.pitch));
    const keySpeed = goal.range * (input.sprint ? 2.4 : 0.8);
    const alongRight = -input.pan[0] * metersPerPixel + input.move.right * keySpeed * dt;
    const alongForward = input.pan[1] * metersPerPixel + input.move.forward * keySpeed * dt;
    const sin = Math.sin(goal.heading);
    const cos = Math.cos(goal.heading);
    // Heading 0 faces north (-Z); its right-hand direction is east (+X).
    goal.target[0] += sin * alongForward + cos * alongRight;
    goal.target[2] += -cos * alongForward + sin * alongRight;
    this.goal = this.clamp(goal);
  }

  private advanceFlight(): void {
    const flight = this.flight as Flight;
    const t = Math.min(1, (this.clock - flight.startMs) / flight.durationMs);
    const eased = smoothstep(t);
    this.current = this.interpolate(
      flight.from,
      flight.to,
      eased,
      flight.lift * Math.sin(Math.PI * t),
    );
    if (t >= 1) {
      this.current = copyState(flight.to);
      this.flight = undefined;
    }
  }

  private interpolate(from: OrbitState, to: OrbitState, t: number, lift: number): OrbitState {
    const heading = from.heading + wrapAngle(to.heading - from.heading) * t;
    return {
      target: [
        from.target[0] + (to.target[0] - from.target[0]) * t,
        from.target[1] + (to.target[1] - from.target[1]) * t,
        from.target[2] + (to.target[2] - from.target[2]) * t,
      ],
      // Interpolate range geometrically so zooming feels uniform across scales.
      range:
        Math.exp(Math.log(from.range) + (Math.log(to.range) - Math.log(from.range)) * t) + lift,
      heading: wrapAngle(heading),
      pitch: from.pitch + (to.pitch - from.pitch) * t,
    };
  }

  private clamp(state: OrbitState): OrbitState {
    state.range = Math.min(this.maxRange, Math.max(this.minRange, state.range));
    state.pitch = Math.min(this.maxPitch, Math.max(this.minPitch, state.pitch));
    state.heading = wrapAngle(state.heading);
    return state;
  }

  private pose(environment: NavigationEnvironment): NavigationPose {
    const { target, range, heading, pitch } = this.current;
    // View direction: heading on the ground plane, tilted `pitch` below the horizon.
    const direction: NavigationVector = [
      Math.sin(heading) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(heading) * Math.cos(pitch),
    ];
    const position: NavigationVector = [
      target[0] - direction[0] * range,
      target[1] - direction[1] * range,
      target[2] - direction[2] * range,
    ];
    const ground = environment.groundHeight(position[0], position[2]);
    if (ground !== undefined && position[1] < ground + this.minClearance) {
      position[1] = ground + this.minClearance;
      const dx = target[0] - position[0];
      const dy = target[1] - position[1];
      const dz = target[2] - position[2];
      const length = Math.hypot(dx, dy, dz) || 1;
      direction[0] = dx / length;
      direction[1] = dy / length;
      direction[2] = dz / length;
    }
    return { position, lookAt: [...target], direction };
  }
}
