import type { AircraftCameraPose } from '@bendyline/molen-client/aircraft';
import * as THREE from 'three';

/** Height (m) of the camera above the ground: a spectator's eye beside a runway. */
const GROUND_CLEARANCE = 1.7;
/** Least height (m) of the line of sight above the ground between camera and subject. */
const SIGHT_CLEARANCE = 0.5;
/** Space (m) kept between the camera and a surface it was pulled in front of. */
const PADDING = 0.4;
/** Space (m) kept short of a wall across the path ahead. */
const WALL_PADDING = 1.5;
const UP = new THREE.Vector3(0, 1, 0);

type Vec3 = [number, number, number];
type Pose = { pos: Vec3; rot: [number, number, number, number] };

/** Where and how far from the path a flyby camera waits for its subject. */
export interface FlybyTuning {
  /** Seconds of travel ahead of the subject at which the camera waits. */
  leadSeconds: number;
  /** Nearest and farthest distance (m) ahead it waits; four lengths, if longer, within those. */
  minLead: number;
  maxLead: number;
  /** Least distance (m) from the path past the subject's span, and the most. */
  sideClearance: number;
  maxSide: number;
  /** Slower than this (m/s), the subject counts as standing and the camera waits off its nose. */
  stillSpeed: number;
  /**
   * Height (m) of the camera above the ground the subject travels on where it waits: a
   * bystander's eye beside a road or path. Unset, it waits a little below the path ahead and looks
   * up as an aircraft goes by.
   */
  eyeHeight?: number;
}

/** An aircraft: 3.5 s of flight ahead, up to 600 m so a fast jet is still more than a speck. */
export const AIRCRAFT_FLYBY: FlybyTuning = {
  leadSeconds: 3.5,
  minLead: 0,
  maxLead: 600,
  sideClearance: 0,
  maxSide: Number.POSITIVE_INFINITY,
  stillSpeed: 2,
};
/** A car, bike, boat or train: at the roadside a few seconds ahead, off the lane it drives in. */
export const VEHICLE_FLYBY: FlybyTuning = {
  leadSeconds: 3,
  minLead: 12,
  maxLead: 45,
  sideClearance: 2.5,
  maxSide: 7,
  stillSpeed: 1,
  eyeHeight: 1.7,
};
/**
 * A walker: a few steps ahead and to one side, a passer-by's eye. Within 16 m ahead and 4 m
 * aside, inside the walker's own collision neighbourhood, which reaches 18 m.
 */
export const WALKER_FLYBY: FlybyTuning = {
  leadSeconds: 4,
  minLead: 8,
  maxLead: 16,
  sideClearance: 2,
  maxSide: 4,
  stillSpeed: 0.5,
  eyeHeight: 1.65,
};

/**
 * What stands beside a ground subject's path (walls, facades, cut slopes, trees), for a camera
 * that must not wait inside or behind one. `prepare` readies the queries around a point halfway
 * to where the subject will pass; a placement then asks within half the lead and the side offset
 * of it (under 24 m for `VEHICLE_FLYBY`), the subject included.
 */
export interface FlybySight {
  prepare(x: number, y: number, z: number): void;
  /** Distance from `from` to the first surface toward `to`, or undefined when the line is clear. */
  obstruction(from: Vec3, to: Vec3): number | undefined;
}

/**
 * The flyby view: a camera fixed in the world beside the path ahead, turning to follow the
 * subject (an aircraft, a vehicle, a walker) as it approaches and goes by. Once the subject is
 * farther away than when the camera was placed (it has passed, or turned off), the camera moves
 * ahead again, on the other side of the path. Positions are absolute, like the subject's.
 */
export class FlybyCamera {
  private anchor: THREE.Vector3 | undefined;
  private reach = 0;
  private side = 1;
  constructor(private readonly tuning: FlybyTuning = AIRCRAFT_FLYBY) {}
  reset(): void {
    this.anchor = undefined;
  }
  /**
   * This frame's pose. `transform` is the subject's base (wheels, keel, feet) and heading, local
   * +Z forward; `spec` its size, `span` across. With `sight`, the camera keeps clear of what
   * stands beside the path.
   */
  pose(
    transform: Pose,
    velocity: readonly [number, number, number],
    spec: { length: number; span: number; height: number },
    groundHeight: (x: number, z: number) => number | undefined,
    sight?: FlybySight,
  ): AircraftCameraPose {
    const q = new THREE.Quaternion().fromArray(transform.rot);
    const target = new THREE.Vector3(0, spec.height / 2, 0)
      .applyQuaternion(q)
      .add(new THREE.Vector3().fromArray(transform.pos));
    if (this.anchor === undefined || this.anchor.distanceTo(target) > this.reach)
      this.anchor = this.place(transform, target, q, velocity, spec, groundHeight, sight);
    const position = this.anchor.clone();
    const forward = target.clone().sub(position).normalize();
    const rotation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(position, target, UP),
    );
    return {
      position: position.toArray(),
      lookAt: target.toArray(),
      rotation: rotation.toArray(),
      yaw: Math.atan2(forward.z, forward.x),
      pitch: Math.asin(forward.y),
    };
  }
  private place(
    transform: Pose,
    target: THREE.Vector3,
    q: THREE.Quaternion,
    velocity: readonly [number, number, number],
    spec: { length: number; span: number },
    groundHeight: (x: number, z: number) => number | undefined,
    sight: FlybySight | undefined,
  ): THREE.Vector3 {
    const tuning = this.tuning;
    const v = new THREE.Vector3().fromArray(velocity);
    const speed = v.length();
    // Parked, hovering or standing, the camera waits off the nose.
    const path =
      speed > tuning.stillSpeed
        ? v.divideScalar(speed)
        : new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const nearest = Math.min(tuning.maxLead, Math.max(tuning.minLead, spec.length * 4));
    let lead = THREE.MathUtils.clamp(speed * tuning.leadSeconds, nearest, tuning.maxLead);
    if (sight) {
      // Ready the queries for everything below: the subject, where it will pass and beside that.
      const halfway = target.clone().addScaledVector(path, lead / 2);
      sight.prepare(halfway.x, target.y, halfway.z);
    }
    // Where the subject passes: on its path for an aircraft; on the ground for the others, which
    // a hill street can lift above (or drop below) a straight line from where it is now.
    const middle = target.y - transform.pos[1];
    const passAt = (lead: number): { pass: THREE.Vector3; base: number } => {
      const pass = target.clone().addScaledVector(path, lead);
      const projected = transform.pos[1] + path.y * lead;
      if (tuning.eyeHeight === undefined) return { pass, base: projected };
      // The surface there nearest the path's grade: the terrain, or what a ray down meets (a
      // bridge deck, an upper floor). Not the valley under the deck, nor a tree crown overhead.
      const grade = lead * 0.25 + 0.5;
      const surfaces: number[] = [];
      const ground = groundHeight(pass.x, pass.z);
      if (ground !== undefined) surfaces.push(ground);
      if (sight) {
        const top = projected + grade + middle;
        const hit = sight.obstruction([pass.x, top, pass.z], [pass.x, projected - grade, pass.z]);
        if (hit !== undefined) surfaces.push(top - hit);
      }
      let base = projected;
      let nearest = grade;
      for (const surface of surfaces) {
        const off = Math.abs(surface - projected);
        if (off <= nearest) {
          nearest = off;
          base = surface;
        }
      }
      pass.y = base + middle;
      return { pass, base };
    };
    if (sight) {
      // Short of a wall across the path: the camera waits on this side of it.
      const wall = sight.obstruction(target.toArray(), passAt(lead).pass.toArray());
      if (wall !== undefined) lead = Math.max(0, wall - WALL_PADDING);
    }
    let across = new THREE.Vector3().crossVectors(path, UP);
    // Straight up or down, the wings say which way is beside the path.
    if (across.lengthSq() < 0.01) across = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    across.normalize();
    const offset = Math.min(
      tuning.maxSide,
      Math.max(spec.span + tuning.sideClearance, lead * 0.08),
    );
    const { pass, base } = passAt(lead);
    // Without a sight, the other side of the path each time; with one, the side that sees more.
    let best: { anchor: THREE.Vector3; score: number; side: number } | undefined;
    for (const side of sight ? [this.side, -this.side] : [this.side]) {
      const placed = this.stand(
        target,
        pass,
        base,
        across,
        side * offset,
        spec,
        groundHeight,
        sight,
      );
      const score = sight
        ? placed.score + this.approach(placed.anchor, pass, path, lead, sight)
        : 0;
      if (best === undefined || score > best.score) best = { anchor: placed.anchor, score, side };
    }
    const chosen = best as { anchor: THREE.Vector3; side: number };
    this.side = -chosen.side;
    this.reach = chosen.anchor.distanceTo(target) * 1.1 + 1;
    return chosen.anchor;
  }
  /** The camera beside `pass`, `offset` across the path, and how clear that side was. */
  private stand(
    target: THREE.Vector3,
    pass: THREE.Vector3,
    base: number,
    across: THREE.Vector3,
    offset: number,
    spec: { span: number },
    groundHeight: (x: number, z: number) => number | undefined,
    sight: FlybySight | undefined,
  ): { anchor: THREE.Vector3; score: number } {
    const eye = this.tuning.eyeHeight;
    const anchor = pass.clone().addScaledVector(across, offset);
    // An aircraft's camera waits a little below the path, looking up as it goes by.
    anchor.y = eye !== undefined ? base + eye : pass.y - Math.abs(offset) * 0.25;
    let score = 10;
    if (sight) {
      // In front of whatever stands beside the path: a facade, a wall, a hedge, a cut slope.
      const hit = sight.obstruction(pass.toArray(), anchor.toArray());
      if (hit !== undefined) {
        const least = spec.span / 2 + 0.5;
        const room = hit - PADDING;
        score = room >= least ? 5 : 0;
        const height = anchor.y;
        const toward = anchor.clone().sub(pass).normalize();
        anchor.copy(pass).addScaledVector(toward, Math.max(least, room));
        // Still at eye height, not partway down the line to the subject's middle.
        if (eye !== undefined) anchor.y = height;
      }
    }
    this.clearGround(anchor, target, groundHeight);
    return { anchor, score };
  }
  /** Above the ground, and high enough to see over it toward the subject. */
  private clearGround(
    anchor: THREE.Vector3,
    target: THREE.Vector3,
    groundHeight: (x: number, z: number) => number | undefined,
  ): void {
    const ground = groundHeight(anchor.x, anchor.z);
    if (ground !== undefined) anchor.y = Math.max(anchor.y, ground + GROUND_CLEARANCE);
    // The last fifth is left out: beside a taxiing aircraft the line meets the ground near its
    // wheels.
    for (let i = 1; i <= 16; i++) {
      const f = i / 20;
      const height = groundHeight(
        anchor.x + (target.x - anchor.x) * f,
        anchor.z + (target.z - anchor.z) * f,
      );
      if (height !== undefined)
        anchor.y = Math.max(anchor.y, (height + SIGHT_CLEARANCE - target.y * f) / (1 - f));
    }
  }
  /** How many points of the approach the camera sees, up to 30 m back from where it passes. */
  private approach(
    anchor: THREE.Vector3,
    pass: THREE.Vector3,
    path: THREE.Vector3,
    lead: number,
    sight: FlybySight,
  ): number {
    let seen = 0;
    const back = Math.min(lead, 30);
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const point = pass.clone().addScaledVector(path, -back * f);
      if (sight.obstruction(anchor.toArray(), point.toArray()) === undefined) seen++;
    }
    return seen;
  }
}
