import { boostSpeedMultiplier } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import type { WalkCollision } from './walk-collision';

export const WALK_EYE_HEIGHT: number = 1.7;
export const WALK_SPEED: number = 1.5;
export const RUN_SPEED: number = 4;
export const SWIM_SPEED: number = 1.2;
// Keep the eyes 45 cm above the water datum, clear of the default small swells.
const SWIM_DEPTH = WALK_EYE_HEIGHT - 0.45;
const BODY_HEIGHT = 1.8;
const BODY_RADIUS = 0.3;
/** `place` tries rings of landing spots this far apart, out to this many rings. */
const PLACEMENT_RING_SPACING = 2;
const PLACEMENT_RINGS = 8;
/**
 * How far from the requested spot `place` may land the body, including its radius: the ground a
 * host should have loaded (terrain and anything built on it) before calling `place`.
 */
export const WALK_PLACEMENT_RADIUS: number = PLACEMENT_RINGS * PLACEMENT_RING_SPACING + BODY_RADIUS;
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

/**
 * First-person walking over streamed geometry: a 1.8 m capsule with gravity, jumping, wall
 * sliding and a 50° walkable-slope limit, integrated at a fixed 120 Hz so results agree across
 * frame rates. `feet` is the world position; put the camera `WALK_EYE_HEIGHT` above it. Missing
 * terrain pauses movement (it is never a bottomless pit) until coverage arrives. Set
 * `sampleWaterHeight` to float in deep water and automatically walk again in the shallows.
 */
export class WalkController {
  /** Four times walking/running/swimming speed; jump height and look response stay normal. */
  boostMode: boolean = false;
  readonly feet: THREE.Vector3 = new THREE.Vector3();
  readonly velocity: THREE.Vector3 = new THREE.Vector3();
  grounded: boolean = false;
  swimming: boolean = false;
  /** Water surface in world meters; null means dry, undefined means coverage is loading. */
  sampleWaterHeight?: (x: number, z: number) => number | null | undefined;
  ready: boolean = false;
  waitingForTerrain: boolean = false;
  private accumulator = 0;
  private jumpHeld = false;
  private readonly capsule = new Capsule();

  reset(x: number, z: number): void {
    this.feet.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.swimming = false;
    this.ready = false;
    this.waitingForTerrain = true;
    this.accumulator = 0;
    this.jumpHeld = false;
  }

  /**
   * Find supported open ground. A separate `groundCollision` can exclude vehicles from the
   * landing ray while `collision` still rejects body overlaps, placing people beside cars.
   * Deep water supports placement even when no solid lake bed is rendered.
   */
  place(
    collision: WalkCollision,
    sampleHeight: (x: number, z: number) => number | undefined,
    groundCollision: WalkCollision = collision,
  ): boolean {
    const centerX = this.feet.x;
    const centerZ = this.feet.z;
    for (let ring = 0; ring <= PLACEMENT_RINGS; ring++) {
      const count = ring === 0 ? 1 : ring * 8;
      for (let i = 0; i < count; i++) {
        const x = centerX + Math.cos((i / count) * Math.PI * 2) * ring * PLACEMENT_RING_SPACING;
        const z = centerZ + Math.sin((i / count) * Math.PI * 2) * ring * PLACEMENT_RING_SPACING;
        const ground = sampleHeight(x, z);
        const water = this.sampleWaterHeight?.(x, z);
        if (ground === undefined && water == null) continue;
        const ray = new THREE.Ray(
          new THREE.Vector3(
            x - groundCollision.origin.x,
            Math.max(ground ?? -Infinity, water ?? -Infinity) + 10_000,
            z - groundCollision.origin.z,
          ),
          new THREE.Vector3(0, -1, 0),
        );
        const hit = groundCollision.octree.rayIntersect(ray);
        // Small offsets cover terrain-draped roads. Roofs require another landing position.
        const afloat = water != null && (!hit || hit.position.y < water - SWIM_DEPTH);
        if (!afloat && (!hit || hit.position.y > (ground ?? water ?? 0) + 3)) continue;
        this.feet.set(x, afloat ? water - SWIM_DEPTH : hit ? hit.position.y + 0.02 : 0, z);
        this.setCapsule(collision);
        const overlap = collision.octree.capsuleIntersect(this.capsule);
        if (overlap && (overlap.normal.y < FLOOR_NORMAL || overlap.depth > 0.15)) continue;
        this.ready = true;
        this.waitingForTerrain = false;
        this.grounded = !afloat;
        this.swimming = afloat;
        this.velocity.set(0, 0, 0);
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
    const forwardX =
      (Math.cos(input.yaw) * input.forward - Math.sin(input.yaw) * input.right) / length;
    const forwardZ =
      (Math.sin(input.yaw) * input.forward + Math.cos(input.yaw) * input.right) / length;
    this.accumulator += Math.min(0.1, Math.max(0, dt));
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      const speed =
        (this.swimming
          ? SWIM_SPEED * (input.sprint ? 1.5 : 1)
          : input.sprint
            ? RUN_SPEED
            : WALK_SPEED) * boostSpeedMultiplier(this.boostMode);
      const vx = forwardX * speed;
      const vz = forwardZ * speed;
      const nextX = this.feet.x + vx * STEP;
      const nextZ = this.feet.z + vz * STEP;
      const water = this.sampleWaterHeight?.(nextX, nextZ);
      // A missing tile is not a bottomless pit. Resume as soon as coverage is resident.
      this.waitingForTerrain =
        (sampleHeight(nextX, nextZ) === undefined && water == null) ||
        (this.swimming && this.sampleWaterHeight !== undefined && water === undefined);
      if (this.waitingForTerrain) {
        this.velocity.set(0, 0, 0);
        this.accumulator = 0;
        break;
      }
      this.velocity.x = vx;
      this.velocity.z = vz;
      this.velocity.y = Math.max(-35, this.velocity.y - GRAVITY * STEP);
      this.feet.addScaledVector(this.velocity, STEP);
      const floatingFeet = water == null ? -Infinity : water - SWIM_DEPTH;
      if (this.feet.y <= floatingFeet) {
        this.feet.y = floatingFeet;
        this.velocity.y = 0;
      }
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
      this.swimming = !this.grounded && this.feet.y <= floatingFeet + 0.05;
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
