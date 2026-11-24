import type { WalkCollision } from '@bendyline/molen-client/navigation';
import * as THREE from 'three';

type Vec3 = [number, number, number];

/** How far behind the walker the camera stands, and how far above their eye (m). */
const DISTANCE = 4.5;
const LIFT = 0.35;
/** Space kept between the camera and whatever stands between it and the walker (m). */
const PADDING = 0.25;
/** How fast the camera draws back once nothing is in the way (m/s); it closes in at once. */
const DRAW_BACK = 5;
/** Closer than this (m) there is no room behind the walker: the view is their own. */
const NEAREST = 1;
/** Surfaces looked through on the way back from the camera, and the step past each (m). */
const MAX_BACK_HOPS = 8;
const BACK_STEP = 1e-3;

/**
 * The third-person walk camera: behind the walker along the look direction and a little above
 * their eye, pulled in front of walls, ground and ceilings. It looks where the walker looks, so
 * switching views keeps the heading.
 */
export class WalkCamera {
  private reach = DISTANCE;

  /**
   * Where the camera stands this frame, and how far that is from the walker's eye: 0 where there
   * is no room behind them and the view is first person. `lowest` keeps it above water.
   */
  update(
    dt: number,
    eye: readonly [number, number, number],
    forward: readonly [number, number, number],
    obstruction: (from: Vec3, to: Vec3) => number | undefined,
    lowest?: number,
  ): { position: Vec3; distance: number } {
    const full = new THREE.Vector3(
      -forward[0] * DISTANCE,
      LIFT - forward[1] * DISTANCE,
      -forward[2] * DISTANCE,
    );
    const length = full.length();
    const direction = full.clone().divideScalar(length);
    const at = (reach: number): Vec3 => [
      eye[0] + direction.x * reach,
      eye[1] + direction.y * reach,
      eye[2] + direction.z * reach,
    ];
    const hit = obstruction([eye[0], eye[1], eye[2]], at(length));
    let room = hit === undefined || hit >= length ? length : Math.max(0, hit - PADDING);
    if (lowest !== undefined && direction.y < 0)
      room = Math.min(room, Math.max(0, (eye[1] - lowest) / -direction.y));
    this.reach = Math.min(room, this.reach + DRAW_BACK * Math.max(0, dt));
    return this.reach < NEAREST
      ? { position: [eye[0], eye[1], eye[2]], distance: 0 }
      : { position: at(this.reach), distance: this.reach };
  }
}

/**
 * The distance from one world point to the first surface between it and another. Collision rays
 * pass through the back of a surface and building shells have only one side, so the line is also
 * walked back from its far end.
 */
export function collisionObstruction(
  collision: WalkCollision,
): (from: Vec3, to: Vec3) => number | undefined {
  return (from, to) => {
    const start = new THREE.Vector3().fromArray(from).sub(collision.origin);
    const direction = new THREE.Vector3().fromArray(to).sub(collision.origin).sub(start);
    const length = direction.length();
    if (length < 1e-6) return undefined;
    direction.divideScalar(length);
    const first = collision.octree.rayIntersect(new THREE.Ray(start, direction));
    let nearest = first && first.distance < length ? first.distance : length;
    const back = direction.clone().negate();
    for (let at = nearest, hops = 0; hops < MAX_BACK_HOPS; hops++) {
      const point = start.clone().addScaledVector(direction, at);
      const hit = collision.octree.rayIntersect(new THREE.Ray(point, back));
      if (!hit || hit.distance >= at) break;
      nearest = at - hit.distance;
      at = nearest - BACK_STEP;
      if (at <= 0) break;
    }
    return nearest < length ? nearest : undefined;
  };
}
