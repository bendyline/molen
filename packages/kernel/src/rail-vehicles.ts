/**
 * Track-guided vehicles: locomotives, rail cars and trams that follow a host's track network
 * instead of steering. The host supplies a {@link TrackGuide} (where the rails run, and which
 * route a switch sends a train down); the kernel owns the longitudinal physics and the consist.
 *
 * The lead vehicle of a consist keeps a short trail of the track centreline it has run over
 * (`vehicleState.track.trail`). Coupled cars ({@link Coupled}) ride that trail at fixed distances
 * behind it, so a train that left a siding keeps its tail on the siding until the tail passes the
 * switch, whatever route the head took.
 */
import { boostSpeedMultiplier, type JsonObject, type VehicleSpec } from '@bendyline/molen-schema';
import { type ComponentType, defineComponent, type TransformData } from './component';
import { dmath as m } from './dmath';
import type { World } from './world';

/** A point on a track and a direction along it, as a kernel yaw (0 faces +Z). */
export interface TrackPose extends JsonObject {
  x: number;
  z: number;
  yaw: number;
  /** The guide's own reference to the track piece under the pose, handed back on the next call. */
  ref?: string;
}

/** Route at the next facing switch: -1 the left-hand route, 0 the straightest, 1 the right. */
export type TrackRoute = -1 | 0 | 1;

/** Where {@link TrackGuide.advance} ended up. */
export interface TrackAdvance {
  pose: TrackPose;
  /** Distance actually travelled: less than asked at the end of the track. */
  moved: number;
  /** A facing switch with a choice of routes was passed on the way. */
  junction: boolean;
  /** The route taken there was not the straightest. */
  diverged: boolean;
}

/**
 * Host track network for track-guided vehicles. Positions are absolute metric X/Z; height comes
 * from {@link VehicleEnvironment.groundHeight} as for any vehicle.
 */
export interface TrackGuide {
  /**
   * Height of the rail heads above the surface `groundHeight` reports on the track centreline
   * (ballast between the rails, say), meters. Rail vehicle models stand on the rail heads.
   * Default 0.
   */
  readonly railTop?: number;
  /**
   * The nearest point on a track within `radius` meters (default 4), keeping the travel sense of
   * `pose.yaw` (the returned yaw is the track direction closest to it). Undefined off the rails.
   */
  snap(pose: TrackPose, radius?: number): TrackPose | undefined;
  /**
   * Walk `distance` meters (≥ 0) along the track from `pose` in the direction of its yaw, taking
   * route `prefer` at facing switches. Undefined when `pose` is not on a track.
   */
  advance(pose: TrackPose, distance: number, prefer: TrackRoute): TrackAdvance | undefined;
}

/** `vehicleState.track`: the rails under a track-guided vehicle. */
export interface VehicleTrackState extends JsonObject {
  /** Track centreline newest first, flat x, y, z triples about {@link TRAIL_STEP} apart. */
  trail: number[];
  prefer: TrackRoute;
  ended?: boolean;
  /** The guide's reference for the track under the head (see {@link TrackPose.ref}). */
  ref?: string;
}

/** A car in a consist, {@link CoupledData.offset} meters behind its leader along the track. */
export interface CoupledData extends JsonObject {
  leader: string;
  offset: number;
}
export const Coupled: ComponentType<CoupledData> = defineComponent<CoupledData>('coupled');

/** Steepest grade the train feels: a main line rarely passes 2.2%; map heights are noisier. */
const MAX_GRADE = 0.03;
/** Steepest body pitch drawn, radians: a car never tips more than its track's grade allows. */
const MAX_PITCH = 0.06;

/**
 * Grade under a consist, rise toward its rear over its length (positive is downhill ahead): the
 * average a whole train feels, not the noise of the map heights under one truck.
 */
function consistGrade(trail: readonly number[], needed: number): number {
  const span = m.max(40, needed - TRAIL_MARGIN);
  const head = trailAt(trail, 0);
  const tail = trailAt(trail, span);
  return m.clamp((tail.y - head.y) / span, -MAX_GRADE, MAX_GRADE);
}

/** Spacing of trail samples, meters. */
export const TRAIL_STEP = 2;
/** Trail kept beyond the rear of the consist, meters. */
const TRAIL_MARGIN = 24;
/** Most trail samples a state keeps (the schema allows 1024 triples). */
const TRAIL_MAX_POINTS = 1000;
const G = 9.81;

/** The parts of a vehicle's state and environment the rail step reads. */
export interface RailStepState extends JsonObject {
  speed: number;
  yaw: number;
  pitch: number;
  wheelAngle: number;
  boosted?: boolean;
  track?: VehicleTrackState;
}
export interface RailStepInput {
  throttle: number;
  steering: number;
  brake: boolean;
}
/** A coupled car as the lead's step sees it. */
export interface ConsistCar {
  id: string;
  offset: number;
  spec: VehicleSpec;
}
export interface RailStepEnv {
  track: TrackGuide;
  groundHeight(x: number, z: number, y?: number): number | undefined;
  boostMode?: boolean;
  /** Share of dry rail adhesion left (wet or icy rail), default 1. */
  adhesion?: number;
}

export interface RailStepResult<S extends RailStepState> {
  transform: TransformData;
  state: S;
  /** Speed of a stop against the end of the track, m/s (0 otherwise). */
  impact: number;
  /** Where each coupled car now stands. */
  cars: { id: string; transform: TransformData; yaw: number; pitch: number }[];
}

function forward(yaw: number): [number, number] {
  return [m.sin(yaw), m.cos(yaw)];
}

/**
 * Rail-head height at X/Z near `y` (the head of the last sample): the host's surface plus its
 * rail height, holding `y` where nothing has streamed in.
 */
function railHeight(env: RailStepEnv): (x: number, z: number, y: number) => number {
  const top = env.track.railTop ?? 0;
  return (x, z, y) => {
    const ground = env.groundHeight(x, z, y - top + 1);
    return ground === undefined ? y : ground + top;
  };
}

/** Total length of a trail, meters. */
export function trailLength(trail: readonly number[]): number {
  let length = 0;
  for (let i = 3; i + 2 < trail.length; i += 3)
    length += m.hypot(
      (trail[i] as number) - (trail[i - 3] as number),
      (trail[i + 2] as number) - (trail[i - 1] as number),
    );
  return length;
}

/**
 * The trail point `s` meters back from its head, and the forward (toward the head) direction
 * there. Past the tail it continues straight along the last segment.
 */
export function trailAt(
  trail: readonly number[],
  s: number,
): { x: number; y: number; z: number; yaw: number } {
  const n = trail.length / 3;
  if (n === 0) return { x: 0, y: 0, z: 0, yaw: 0 };
  if (n === 1)
    return { x: trail[0] as number, y: trail[1] as number, z: trail[2] as number, yaw: 0 };
  let walked = 0;
  for (let i = 1; i < n; i++) {
    const ax = trail[(i - 1) * 3] as number,
      ay = trail[(i - 1) * 3 + 1] as number,
      az = trail[(i - 1) * 3 + 2] as number;
    const bx = trail[i * 3] as number,
      by = trail[i * 3 + 1] as number,
      bz = trail[i * 3 + 2] as number;
    const length = m.hypot(bx - ax, bz - az);
    // Toward the head: from b (older) to a (newer).
    const yaw = m.atan2(ax - bx, az - bz);
    if (s <= walked + length || i === n - 1) {
      const f = length > 1e-9 ? (s - walked) / length : 0;
      // Before the head (s < 0) and past the tail the segment's line continues.
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, z: az + (bz - az) * f, yaw };
    }
    walked += length;
  }
  return { x: trail[0] as number, y: trail[1] as number, z: trail[2] as number, yaw: 0 };
}

/** Drop the first `s` meters of a trail, starting it at the point `s` meters back. */
function cutTrail(trail: readonly number[], s: number): number[] {
  const head = trailAt(trail, s);
  let walked = 0;
  const n = trail.length / 3;
  for (let i = 1; i < n; i++) {
    walked += m.hypot(
      (trail[i * 3] as number) - (trail[(i - 1) * 3] as number),
      (trail[i * 3 + 2] as number) - (trail[(i - 1) * 3 + 2] as number),
    );
    if (walked > s + 1e-6) return [head.x, head.y, head.z, ...trail.slice(i * 3)];
  }
  return [head.x, head.y, head.z];
}

/** Keep the trail to `length` meters (plus one sample), and to the sample cap. */
function trimTrail(trail: number[], length: number): number[] {
  let walked = 0;
  const n = trail.length / 3;
  for (let i = 1; i < n; i++) {
    walked += m.hypot(
      (trail[i * 3] as number) - (trail[(i - 1) * 3] as number),
      (trail[i * 3 + 2] as number) - (trail[(i - 1) * 3 + 2] as number),
    );
    if (walked >= length || i + 1 >= TRAIL_MAX_POINTS) return trail.slice(0, (i + 1) * 3);
  }
  return trail;
}

/**
 * Extend a trail at its tail along the track until it is `length` meters long, walking away
 * from the head. Returns false (leaving what it could add) at the end of the track.
 */
function extendTrail(
  trail: number[],
  length: number,
  guide: TrackGuide,
  heightAt: (x: number, z: number, y: number) => number,
  prefer: TrackRoute,
  /** Forward yaw at the head, for a trail of one point (no direction of its own yet). */
  headYaw = 0,
): boolean {
  let have = trailLength(trail);
  let guard = 0;
  while (have < length && guard++ < TRAIL_MAX_POINTS) {
    const n = trail.length / 3;
    const tx = trail[(n - 1) * 3] as number,
      ty = trail[(n - 1) * 3 + 1] as number,
      tz = trail[(n - 1) * 3 + 2] as number;
    // Away from the head: the reverse of the forward direction at the tail.
    const yaw = (n > 1 ? trailAt(trail, have).yaw : headYaw) + m.PI;
    const step = guide.advance({ x: tx, z: tz, yaw }, TRAIL_STEP, prefer);
    if (!step || step.moved < 0.05) return false;
    trail.push(step.pose.x, heightAt(step.pose.x, step.pose.z, ty), step.pose.z);
    have += step.moved;
    if (step.moved < TRAIL_STEP - 1e-6) return false;
  }
  return have >= length;
}

/** Track a consist needs behind the lead's centre: to its last car's rear truck, plus margin. */
export function consistTrailLength(spec: VehicleSpec, cars: readonly ConsistCar[]): number {
  let length = (spec.rail?.truckCenters ?? spec.wheelbase) / 2;
  for (const car of cars)
    length = m.max(length, car.offset + (car.spec.rail?.couplerLength ?? car.spec.length) / 2);
  return length + TRAIL_MARGIN;
}

/**
 * Pose of a car whose centre is `offset` meters back along the trail: its trucks ride the
 * trail, and the body is the chord between them.
 */
export function carOnTrail(
  trail: readonly number[],
  offset: number,
  spec: VehicleSpec,
): { pos: [number, number, number]; yaw: number; pitch: number } {
  const half = (spec.rail?.truckCenters ?? spec.wheelbase) / 2;
  const front = trailAt(trail, offset - half);
  const rear = trailAt(trail, offset + half);
  const dx = front.x - rear.x,
    dz = front.z - rear.z;
  const span = m.hypot(dx, dz);
  const yaw = span > 1e-6 ? m.atan2(dx, dz) : trailAt(trail, offset).yaw;
  return {
    pos: [(front.x + rear.x) / 2, (front.y + rear.y) / 2, (front.z + rear.z) / 2],
    yaw,
    pitch: m.clamp(m.atan2(rear.y - front.y, m.max(span, 0.5)), -MAX_PITCH, MAX_PITCH),
  };
}

/**
 * Snap a vehicle to the track and lay a trail behind it long enough for its consist, so its
 * coupled cars can be placed. Returns undefined when there is no track under it.
 */
export function railTrackState(
  pos: readonly [number, number, number],
  yaw: number,
  spec: VehicleSpec,
  cars: readonly ConsistCar[],
  env: RailStepEnv,
  prefer: TrackRoute = 0,
): VehicleTrackState | undefined {
  const pose = env.track.snap({ x: pos[0], z: pos[2], yaw }, m.max(4, spec.width));
  if (!pose) return undefined;
  const heightAt = railHeight(env);
  const trail = [pose.x, heightAt(pose.x, pose.z, pos[1]), pose.z];
  const ended = !extendTrail(
    trail,
    consistTrailLength(spec, cars),
    env.track,
    heightAt,
    0,
    pose.yaw,
  );
  return {
    trail,
    prefer,
    ...(ended ? { ended: true } : {}),
    ...(pose.ref !== undefined ? { ref: pose.ref } : {}),
  };
}

/**
 * Read the heights of a trail again (map heights refine as finer terrain streams in). Returns the
 * new trail, or undefined when no point moved more than `tolerance` meters.
 */
export function refreshTrailHeights(
  trail: readonly number[],
  env: Pick<RailStepEnv, 'track' | 'groundHeight'>,
  tolerance = 0.05,
): number[] | undefined {
  const heightAt = railHeight(env as RailStepEnv);
  const next = [...trail];
  let moved = 0;
  for (let i = 0; i + 2 < next.length; i += 3) {
    const y = heightAt(next[i] as number, next[i + 2] as number, next[i + 1] as number);
    moved = m.max(moved, m.abs(y - (next[i + 1] as number)));
    next[i + 1] = y;
  }
  return moved > tolerance ? next : undefined;
}

/** Physics totals for a consist: masses, traction and resistances summed over its cars. */
function consistTotals(spec: VehicleSpec, cars: readonly ConsistCar[]) {
  const all = [spec, ...cars.map((car) => car.spec)];
  let mass = 0,
    effort = 0,
    power = 0,
    brake = 0,
    rolling = 0,
    air = 0;
  for (const s of all) {
    mass += s.mass;
    brake += s.mass * s.brakeDeceleration;
    rolling += s.mass * s.rollingResistance;
    air += s.mass * s.aerodynamicResistance;
    const watts = s.rail?.power ?? 0;
    if (watts > 0) {
      power += watts;
      effort += s.engineForce;
    }
  }
  return { mass, effort, power, brake, rolling, air };
}

/**
 * One step of a track-guided vehicle and its consist. Throttle drives forward from a stop or
 * while rolling forward and brakes while rolling backward, and the reverse for negative
 * throttle, so S brakes a moving train to a stand and then backs it. Steering picks the route
 * at the next facing switch (held until the train passes one). The track's end stops the train.
 */
export function stepRailVehicle<S extends RailStepState>(
  t: TransformData,
  state: S,
  input: RailStepInput,
  spec: VehicleSpec,
  dt: number,
  env: RailStepEnv,
  cars: readonly ConsistCar[] = [],
): RailStepResult<S> {
  const travel = boostSpeedMultiplier(env.boostMode);
  const previousTravel = boostSpeedMultiplier(state.boosted);
  const heightAt = railHeight(env);
  const needed = consistTrailLength(spec, cars);
  const track =
    state.track ?? railTrackState(t.pos as [number, number, number], state.yaw, spec, cars, env);
  if (!track) {
    // Off the rails (or the track has not streamed in yet): hold still.
    return {
      transform: t,
      state: { ...state, speed: 0, waitingForTerrain: true },
      impact: 0,
      cars: [],
    };
  }
  let prefer: TrackRoute = track.prefer;
  if (input.steering > 0.5) prefer = 1;
  else if (input.steering < -0.5) prefer = -1;

  const totals = consistTotals(spec, cars);
  let u = state.speed / previousTravel;
  const throttle = m.clamp(input.throttle, -1, 1);
  const moving = m.abs(u) > 0.05 ? m.sign(u) : 0;
  // Throttle against the motion brakes; from a stand (or with it) it drives.
  const opposing = moving !== 0 && throttle !== 0 && m.sign(throttle) !== moving;
  const drive = opposing ? 0 : throttle;
  // A standing train with the throttle shut is held by its brakes (an engineer's independent
  // brake); one rolling with it shut coasts.
  const holding = m.abs(u) < 0.05 && throttle === 0;
  const brakeLevel = input.brake || holding ? 1 : opposing ? m.abs(throttle) : 0;
  const adhesion = m.clamp(env.adhesion ?? 1, 0.2, 1);
  let traction = 0;
  if (drive !== 0 && totals.power > 0) {
    const limit = drive > 0 ? spec.maxSpeed : spec.reverseSpeed;
    if (drive * u < limit)
      traction = drive * m.min(totals.effort * adhesion, totals.power / m.max(m.abs(u), 0.5));
  }
  // Nose-down pitch is downhill ahead: gravity pulls forward.
  const push = (traction + totals.mass * G * consistGrade(track.trail, needed)) / totals.mass;
  // Rolling resistance, air and brakes act against the motion. They only ever stop it: from a
  // stand the train moves once the push beats them, and they never drive it backwards.
  const resist = (totals.rolling + totals.air * u * u + brakeLevel * totals.brake) / totals.mass;
  if (m.abs(u) < 1e-3) {
    u = m.abs(push) > resist ? m.sign(push) * (m.abs(push) - resist) * dt : 0;
  } else {
    const sense = m.sign(u);
    const next = u + (push - sense * resist) * dt;
    u = m.sign(next) !== sense && traction * sense <= 0 ? 0 : next;
  }
  const overspeed = m.max(spec.maxSpeed, spec.reverseSpeed) * 1.15;
  u = m.clamp(u, -overspeed, overspeed);

  let distance = u * dt * travel;
  let trail = track.trail;
  const head = trailAt(trail, 0);
  let yaw = state.yaw;
  let ref = track.ref;
  let ended = false;
  let impact = 0;
  if (distance > 0) {
    // In pieces no longer than a trail step, so a fast step still lays the curve it ran.
    let pose: TrackPose = {
      x: head.x,
      z: head.z,
      yaw: state.yaw,
      ...(track.ref !== undefined ? { ref: track.ref } : {}),
    };
    let y = head.y;
    let moved = 0;
    while (moved < distance - 1e-9) {
      const piece = m.min(TRAIL_STEP, distance - moved);
      const step = env.track.advance(pose, piece, prefer);
      if (!step) {
        if (moved > 0) break;
        return {
          transform: t,
          state: { ...state, speed: 0, waitingForTerrain: true },
          impact: 0,
          cars: [],
        };
      }
      moved += step.moved;
      if (step.junction) prefer = 0;
      pose = step.pose;
      y = heightAt(pose.x, pose.z, y);
      // A new sample once the head is a step past the last kept one; otherwise move the head.
      const rest =
        trail.length >= 6 &&
        m.hypot(pose.x - (trail[3] as number), pose.z - (trail[5] as number)) < TRAIL_STEP
          ? trail.slice(3)
          : trail;
      trail = [pose.x, y, pose.z, ...rest];
      if (step.moved < piece - 1e-6) {
        ended = true;
        break;
      }
    }
    if (ended) {
      impact = m.abs(u) * travel;
      u = 0;
    }
    distance = moved;
    yaw = pose.yaw;
    ref = pose.ref;
    trail = trimTrail(trail, needed + TRAIL_STEP);
  } else if (distance < 0) {
    // Backing up: the head retreats along the trail; the tail extends down the track behind.
    const back = -distance;
    const grown = [...trail];
    const complete = extendTrail(grown, needed + back, env.track, heightAt, prefer);
    const room = trailLength(grown) - (needed - TRAIL_MARGIN);
    let moved = back;
    if (!complete && room < back) {
      moved = m.max(0, room);
      ended = true;
      impact = m.abs(u) * travel;
      u = 0;
    }
    trail = cutTrail(grown, moved);
    trail = trimTrail(trail, needed + TRAIL_STEP);
    distance = -moved;
    yaw = trailAt(trail, 0).yaw;
  }
  if (trail.length < 6) {
    extendTrail(trail, needed, env.track, heightAt, 0, yaw);
  }
  // The lead's own trucks: rear on the trail, front a half truck-spacing ahead.
  const half = (spec.rail?.truckCenters ?? spec.wheelbase) / 2;
  const centre = trailAt(trail, 0);
  const ahead = env.track.advance(
    { x: centre.x, z: centre.z, yaw, ...(ref !== undefined ? { ref } : {}) },
    half,
    prefer,
  );
  const rearTruck = trailAt(trail, half);
  const frontX = ahead?.pose.x ?? centre.x + forward(yaw)[0] * half,
    frontZ = ahead?.pose.z ?? centre.z + forward(yaw)[1] * half;
  const frontY = heightAt(frontX, frontZ, centre.y);
  const pitch = m.clamp(m.atan2(rearTruck.y - frontY, m.max(half * 2, 0.5)), -MAX_PITCH, MAX_PITCH);
  const y = (frontY + rearTruck.y) / 2;
  const nextState: S = {
    ...state,
    speed: u * travel,
    boosted: travel > 1,
    yaw,
    pitch,
    wheelAngle: (state.wheelAngle + distance / m.max(spec.wheelRadius, 0.05)) % m.TAU,
    track: {
      trail,
      prefer,
      ...(ended ? { ended: true } : {}),
      ...(ref !== undefined ? { ref } : {}),
    },
  };
  const transform: TransformData = {
    ...t,
    pos: [centre.x, y, centre.z],
    rot: railRotation(yaw, pitch),
  };
  return {
    transform,
    state: nextState,
    impact,
    cars: cars.map((car) => {
      const pose = carOnTrail(trail, car.offset, car.spec);
      return {
        id: car.id,
        transform: { ...t, pos: pose.pos, rot: railRotation(pose.yaw, pose.pitch) },
        yaw: pose.yaw,
        pitch: pose.pitch,
      };
    }),
  };
}

/** Same rotation order as `vehicleRotation`, without roll. */
function railRotation(yaw: number, pitch: number): [number, number, number, number] {
  const c1 = m.cos(pitch / 2),
    c2 = m.cos(yaw / 2);
  const s1 = m.sin(pitch / 2),
    s2 = m.sin(yaw / 2);
  return [s1 * c2, c1 * s2, -s1 * s2, c1 * c2];
}

/** The coupled cars of every leader in a world, nearest first. */
export function consistsOf(
  world: World,
  specOf: (id: string) => VehicleSpec | undefined,
): Map<string, ConsistCar[]> {
  const consists = new Map<string, ConsistCar[]>();
  for (const [id, coupled] of world.query(Coupled)) {
    const spec = specOf(id);
    if (!spec) continue;
    const list = consists.get(coupled.leader) ?? [];
    list.push({ id, offset: coupled.offset, spec });
    consists.set(coupled.leader, list);
  }
  for (const list of consists.values())
    list.sort((a, b) => a.offset - b.offset || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return consists;
}

/**
 * Offsets for a train made up front to back: each car's centre behind the first car's, from
 * their coupled lengths.
 */
export function consistOffsets(specs: readonly VehicleSpec[]): number[] {
  const offsets: number[] = [];
  let at = 0;
  for (let i = 0; i < specs.length; i++) {
    const length = specs[i]?.rail?.couplerLength ?? specs[i]?.length ?? 0;
    if (i > 0) {
      const previous = specs[i - 1]?.rail?.couplerLength ?? specs[i - 1]?.length ?? 0;
      at += previous / 2 + length / 2;
    }
    offsets.push(at);
  }
  return offsets;
}
