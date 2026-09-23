import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import type { WalkCollision } from './walk-collision.js';

export const WALK_EYE_HEIGHT: number = 1.7;
export const WALK_SPEED: number = 1.5;
export const RUN_SPEED: number = 4;
const BODY_HEIGHT = 1.8;
const BODY_RADIUS = 0.3;
const STEP = 1 / 120;
const GRAVITY = 9.81;
const FLOOR_NORMAL = Math.cos(Math.PI / 3.6); // 50 degrees.

export interface WalkInput {
  forward: number;
  right: number;
  yaw: number;
  sprint: boolean;
  jump: boolean;
}

/** Viewer-local physics; world position is feet, and the camera follows at adult eye height. */
export class WalkController {
  readonly feet: THREE.Vector3 = new THREE.Vector3();
  readonly velocity: THREE.Vector3 = new THREE.Vector3();
  grounded = false;
  ready = false;
  waitingForTerrain = false;
  private accumulator = 0;
  private jumpHeld = false;
  private readonly capsule = new Capsule();

  reset(x: number, z: number): void {
    this.feet.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.ready = false;
    this.waitingForTerrain = true;
    this.accumulator = 0;
    this.jumpHeld = false;
  }

  /** Find open ground near the fly camera, rather than dropping through a building's roof. */
  place(
    collision: WalkCollision,
    sampleHeight: (x: number, z: number) => number | undefined,
  ): boolean {
    const centerX = this.feet.x;
    const centerZ = this.feet.z;
    for (let ring = 0; ring <= 8; ring++) {
      const count = ring === 0 ? 1 : ring * 8;
      for (let i = 0; i < count; i++) {
        const x = centerX + Math.cos((i / count) * Math.PI * 2) * ring * 2;
        const z = centerZ + Math.sin((i / count) * Math.PI * 2) * ring * 2;
        const ground = sampleHeight(x, z);
        if (ground === undefined) continue;
        const ray = new THREE.Ray(
          new THREE.Vector3(x - collision.origin.x, ground + 10_000, z - collision.origin.z),
          new THREE.Vector3(0, -1, 0),
        );
        const hit = collision.octree.rayIntersect(ray);
        // Small offsets cover terrain-draped roads. Roofs require another landing position.
        if (!hit || hit.position.y > ground + 3) continue;
        this.feet.set(x, hit.position.y + 0.02, z);
        this.setCapsule(collision);
        const overlap = collision.octree.capsuleIntersect(this.capsule);
        if (overlap && (overlap.normal.y < FLOOR_NORMAL || overlap.depth > 0.15)) continue;
        this.ready = true;
        this.waitingForTerrain = false;
        this.grounded = true;
        return true;
      }
    }
    this.feet.set(centerX, 0, centerZ);
    return false;
  }

  update(
    dt: number,
    input: WalkInput,
    collision: WalkCollision,
    sampleHeight: (x: number, z: number) => number | undefined,
  ): void {
    if (!this.ready) return;
    const ground = sampleHeight(this.feet.x, this.feet.z);
    // A finer streamed surface can arrive above the old one. Recover from below it instead
    // of falling through its back face. Downward refinements still settle under gravity.
    if (ground !== undefined && ground > this.feet.y + BODY_RADIUS) {
      const support = collision.octree.rayIntersect(
        new THREE.Ray(
          new THREE.Vector3(
            this.feet.x - collision.origin.x,
            ground + 3,
            this.feet.z - collision.origin.z,
          ),
          new THREE.Vector3(0, -1, 0),
        ),
      );
      if (support && support.position.y > this.feet.y) {
        this.feet.y = support.position.y + 0.02;
        this.velocity.y = Math.max(0, this.velocity.y);
      }
    }
    const jump = input.jump && !this.jumpHeld;
    this.jumpHeld = input.jump;
    if (jump && this.grounded) {
      this.velocity.y = 4.5;
      this.grounded = false;
    }
    const length = Math.max(1, Math.hypot(input.forward, input.right));
    const speed = input.sprint ? RUN_SPEED : WALK_SPEED;
    const vx =
      ((Math.cos(input.yaw) * input.forward - Math.sin(input.yaw) * input.right) / length) * speed;
    const vz =
      ((Math.sin(input.yaw) * input.forward + Math.cos(input.yaw) * input.right) / length) * speed;
    this.accumulator += Math.min(0.1, Math.max(0, dt));
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      const nextX = this.feet.x + vx * STEP;
      const nextZ = this.feet.z + vz * STEP;
      // A missing tile is not a bottomless pit. Resume as soon as coverage is resident.
      this.waitingForTerrain = sampleHeight(nextX, nextZ) === undefined;
      if (this.waitingForTerrain) {
        this.velocity.set(0, 0, 0);
        this.accumulator = 0;
        break;
      }
      this.velocity.x = vx;
      this.velocity.z = vz;
      this.velocity.y = Math.max(-35, this.velocity.y - GRAVITY * STEP);
      this.feet.addScaledVector(this.velocity, STEP);
      this.setCapsule(collision);
      this.grounded = false;
      for (let pass = 0; pass < 4; pass++) {
        const hit = collision.octree.capsuleIntersect(this.capsule);
        if (!hit) break;
        if (hit.normal.y >= FLOOR_NORMAL) this.grounded = true;
        if (hit.normal.y > 0 && hit.normal.y < FLOOR_NORMAL) {
          // Treat an unwalkable incline as a wall: separate sideways, not upward. Otherwise
          // reapplying forward input every step would let the capsule climb almost vertical hills.
          const horizontal = Math.hypot(hit.normal.x, hit.normal.z);
          hit.normal.y = 0;
          hit.normal.divideScalar(horizontal);
          const intoWall = this.velocity.dot(hit.normal);
          if (intoWall < 0) this.velocity.addScaledVector(hit.normal, -intoWall);
          this.capsule.translate(hit.normal.multiplyScalar((hit.depth + 0.00001) / horizontal));
        } else {
          const intoSurface = this.velocity.dot(hit.normal);
          if (intoSurface < 0) this.velocity.addScaledVector(hit.normal, -intoSurface);
          this.capsule.translate(hit.normal.multiplyScalar(hit.depth + 0.00001));
        }
      }
      this.feet.copy(this.capsule.start).add(collision.origin);
      this.feet.y -= BODY_RADIUS;
    }
  }

  private setCapsule(collision: WalkCollision): void {
    this.capsule.start.copy(this.feet).sub(collision.origin);
    this.capsule.start.y += BODY_RADIUS;
    this.capsule.end.copy(this.feet).sub(collision.origin);
    this.capsule.end.y += BODY_HEIGHT - BODY_RADIUS;
    this.capsule.radius = BODY_RADIUS;
  }
}
