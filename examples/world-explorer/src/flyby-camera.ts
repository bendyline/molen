import type { AircraftCameraPose } from '@bendyline/molen-client/aircraft';
import type { AircraftSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';

/** Seconds of flight ahead of the aircraft at which the camera waits for it. */
const LEAD_SECONDS = 3.5;
/** Farthest (m) ahead the camera waits, so a fast jet is still more than a speck. */
const MAX_LEAD = 600;
/** Height (m) of the camera above the ground: a spectator's eye beside a runway. */
const GROUND_CLEARANCE = 1.7;
/** Least height (m) of the line of sight above the ground between camera and aircraft. */
const SIGHT_CLEARANCE = 0.5;
const UP = new THREE.Vector3(0, 1, 0);

type Pose = { pos: [number, number, number]; rot: [number, number, number, number] };

/**
 * The flight-sim flyby view: a camera fixed in the world beside the flight path ahead, turning
 * to follow the aircraft as it approaches and goes by. Once the aircraft is farther away than
 * when the camera was placed (it has passed, or turned off), the camera moves ahead again, on
 * the other side of the path. Positions are absolute, like the aircraft's.
 */
export class FlybyCamera {
  private anchor: THREE.Vector3 | undefined;
  private reach = 0;
  private side = 1;
  reset(): void {
    this.anchor = undefined;
  }
  pose(
    transform: Pose,
    velocity: readonly [number, number, number],
    spec: Pick<AircraftSpec, 'length' | 'span' | 'height'>,
    groundHeight: (x: number, z: number) => number | undefined,
  ): AircraftCameraPose {
    const q = new THREE.Quaternion().fromArray(transform.rot);
    const target = new THREE.Vector3(0, spec.height / 2, 0)
      .applyQuaternion(q)
      .add(new THREE.Vector3().fromArray(transform.pos));
    if (this.anchor === undefined || this.anchor.distanceTo(target) > this.reach)
      this.anchor = this.place(target, q, velocity, spec, groundHeight);
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
    target: THREE.Vector3,
    q: THREE.Quaternion,
    velocity: readonly [number, number, number],
    spec: Pick<AircraftSpec, 'length' | 'span'>,
    groundHeight: (x: number, z: number) => number | undefined,
  ): THREE.Vector3 {
    const v = new THREE.Vector3().fromArray(velocity);
    const speed = v.length();
    // Parked or hovering, the camera waits off the nose.
    const path = speed > 2 ? v.divideScalar(speed) : new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const lead = THREE.MathUtils.clamp(speed * LEAD_SECONDS, spec.length * 4, MAX_LEAD);
    let side = new THREE.Vector3().crossVectors(path, UP);
    // Straight up or down, the wings say which way is beside the path.
    if (side.lengthSq() < 0.01) side = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const offset = Math.max(spec.span, lead * 0.08);
    side.normalize().multiplyScalar(offset * this.side);
    this.side = -this.side;
    // A little below the path, looking up as the aircraft goes by.
    const anchor = target
      .clone()
      .addScaledVector(path, lead)
      .add(side)
      .addScaledVector(UP, -offset * 0.25);
    const ground = groundHeight(anchor.x, anchor.z);
    if (ground !== undefined) anchor.y = Math.max(anchor.y, ground + GROUND_CLEARANCE);
    // Rise until the line of sight to the aircraft clears the ground between them. The last
    // fifth is left out: beside a taxiing aircraft the line meets the ground near its wheels.
    for (let i = 1; i <= 16; i++) {
      const f = i / 20;
      const height = groundHeight(
        anchor.x + (target.x - anchor.x) * f,
        anchor.z + (target.z - anchor.z) * f,
      );
      if (height !== undefined)
        anchor.y = Math.max(anchor.y, (height + SIGHT_CLEARANCE - target.y * f) / (1 - f));
    }
    this.reach = anchor.distanceTo(target) * 1.1 + 1;
    return anchor;
  }
}
