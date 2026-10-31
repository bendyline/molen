import { WalkCollision } from '@bendyline/molen-client/navigation';
import type { VehicleCameraPose } from '@bendyline/molen-client/vehicles';
import * as THREE from 'three';

export const PARACHUTE_HELP: string =
  'A/D steer · W full glide · S brakes · Space flare · V view · drag to look';

const GRAVITY = 9.81;
/** The seat's rocket: a quarter second at about 13 g, some 32 m/s up its rails. */
const ROCKET_TIME = 0.25;
const ROCKET_ACCELERATION = 128;
/** Seat and pilot in the airstream: `a = -k·|v|·v`, a terminal speed near 47 m/s. */
const BODY_DRAG = 0.0045;
/** Seconds from firing until the seat lets go and the canopy deploys. */
const SEPARATION = 1.4;
/** Seconds the canopy takes to inflate. */
const INFLATION = 1.6;
/** Opening shock limit (m/s²), about 6 g: a fast ejection still opens, just later. */
const OPENING_LIMIT = 60;
/** How quickly an inflated canopy settles to the glide it is trimmed for (1/s). */
const CANOPY_RESPONSE = 1.4;
/** Ram-air glide, forward speed and sink (m/s): full glide (W), hands up, brakes (S), flare. */
const GLIDE = { full: 11, neutral: 8.5, brakes: 4, flare: 3 };
const SINK = { full: 5.2, neutral: 4.5, brakes: 3.6, flare: 1.2 };
/** A flare holds for this long (s) and recovers at half that rate once released. */
const FLARE_TIME = 2.5;
/** Toggle turn rate (rad/s) at full input, and the extra sink (m/s) a full turn costs. */
const TURN_RATE = 0.9;
const TURN_SINK = 2.5;
/** Bank (rad) of the pilot swung out under the canopy at full turn. */
const TURN_BANK = 0.45;
/** Collide with buildings below this height (m) above the terrain, once slower than this (m/s). */
const COLLISION_HEIGHT = 350;
const COLLISION_SPEED = 40;
/** Seconds a landed canopy stays on the ground. */
const LANDED_TIME = 45;
const STEP = 1 / 120;
/** Harness risers above the pilot's feet, and the line length from them to the canopy (m). */
const RISER_HEIGHT = 1.95;
const LINE_LENGTH = 6.2;
const PIVOT = RISER_HEIGHT + LINE_LENGTH;
const CELLS = 7;
const SPAN = 8.4;
const CHORD = 3;
const THICKNESS = 0.42;
/** Arc (rad) each cell turns through: the canopy's anhedral. */
const CELL_ARC = 0.16;
const ARC_RADIUS = SPAN / (CELLS * CELL_ARC);
const UP = new THREE.Vector3(0, 1, 0);

export type ParachutePhase = 'seat' | 'canopy' | 'landed';

/** Where an ejection seat leaves its aircraft. Positions are absolute, like the aircraft's. */
export interface EjectionSeat {
  /** The pilot's eye at the moment the seat fires. */
  position: [number, number, number];
  /** The airframe's velocity (m/s), which the seat leaves with. */
  velocity: [number, number, number];
  /** The airframe's attitude: the seat fires up its rails. */
  rotation: [number, number, number, number];
}

export interface ParachuteControls {
  /** +1 full glide (W), -1 brakes (S). */
  forward: number;
  /** -1 left toggle (A), +1 right toggle (D). */
  right: number;
  /** Flare (Space). */
  flare: boolean;
}

export interface ParachuteEnvironment {
  /** Terrain height at (x, z), or undefined while it streams. */
  groundHeight: (x: number, z: number) => number | undefined;
  /** Open water's surface at (x, z), if there is any: a splashdown lands on it. */
  waterHeight?: (x: number, z: number) => number | undefined;
}

const approach = (value: number, target: number, step: number): number =>
  value < target ? Math.min(target, value + step) : Math.max(target, value - step);

/**
 * The ride down after an ejection: a seat rocket clears the aircraft, the seat falls away, and a
 * steerable ram-air canopy opens and glides to a landing on terrain, a roof or water. A
 * session-local controller like the walker (no ECS), stepped at a fixed 120 Hz. `position` is the
 * pilot's feet, absolute like the aircraft's; the model hangs under the streamed root.
 */
export class WorldParachute {
  readonly object: THREE.Group = new THREE.Group();
  phase: ParachutePhase | undefined;
  readonly position: THREE.Vector3 = new THREE.Vector3();
  readonly velocity: THREE.Vector3 = new THREE.Vector3();
  /** Kernel yaw convention: 0 faces +Z, and turning right decreases it. */
  heading = 0;
  /** Height (m) above whatever the pilot would land on, as last measured. */
  altitude = 0;
  /** Sink rate (m/s) at touchdown. */
  landingSpeed = 0;
  waitingForTerrain = false;
  private time = 0;
  private landedTime = 0;
  private accumulator = 0;
  private turnRate = 0;
  private flareEnergy = 1;
  private cameraHeading = 0;
  private firstPerson = false;
  private readonly rails = new THREE.Vector3();
  private readonly seatRotation = new THREE.Quaternion();
  private readonly seatPosition = new THREE.Vector3();
  private readonly seatVelocity = new THREE.Vector3();
  private seatFalling = false;
  private readonly acceleration = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly canopyPull = new THREE.Vector3();
  // Roofs and walls near the pilot, in a band around their height: the descent is slow, so 5 Hz
  // rescans keep up, and nothing is scanned while the seat is still fast or high.
  private readonly collision = new WalkCollision({
    radius: 32,
    rebuildDistance: 8,
    verticalRadius: 40,
    rescanIntervalMs: 200,
  });
  private colliding = false;
  private readonly rig = new THREE.Group();
  private readonly swing = new THREE.Group();
  private readonly pilot = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly chute = new THREE.Group();
  private readonly canopy = new THREE.Group();
  private readonly seat = new THREE.Group();

  constructor(
    private readonly root: THREE.Object3D,
    private readonly env: ParachuteEnvironment,
    /** Shader warm-up (`renderer.prepareObject`), so the first ejection does not hitch. */
    prepare?: (object: THREE.Object3D) => Promise<void>,
  ) {
    this.object.name = 'world:parachute';
    this.object.visible = false;
    this.build();
    root.add(this.object);
    void prepare?.(this.object).catch(() => {});
  }

  /** In the air: the host follows the pilot here, not the walker. */
  get active(): boolean {
    return this.phase === 'seat' || this.phase === 'canopy';
  }

  /** Fire the seat. */
  eject(seat: EjectionSeat): void {
    const rotation = new THREE.Quaternion().fromArray(seat.rotation);
    this.rails.copy(UP).applyQuaternion(rotation);
    // Like a seat that corrects its attitude, one fired inverted near the ground still climbs.
    if (this.rails.y < 0.3) this.rails.lerp(UP, 0.7).normalize();
    this.position.fromArray(seat.position).addScaledVector(this.rails, -1.2);
    this.velocity.fromArray(seat.velocity);
    const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
    this.heading = Math.abs(nose.x) + Math.abs(nose.z) > 1e-3 ? Math.atan2(nose.x, nose.z) : 0;
    this.cameraHeading = this.heading;
    this.seatRotation.copy(rotation);
    this.phase = 'seat';
    this.time = 0;
    this.accumulator = 0;
    this.turnRate = 0;
    this.flareEnergy = 1;
    this.landingSpeed = 0;
    this.seatFalling = false;
    this.colliding = false;
    this.collision.clear();
    this.render();
  }

  /** Leave the sky at once (the host switched modes): the model goes too. */
  stop(): void {
    this.phase = undefined;
    this.collision.clear();
    this.render();
  }

  /**
   * One frame. Returns where the pilot stands (absolute feet) on the frame they touch down, for
   * the host to hand over to walking; undefined otherwise.
   */
  update(dt: number, controls: ParachuteControls): [number, number, number] | undefined {
    const frame = Math.min(0.1, Math.max(0, dt));
    if (this.phase === 'landed') {
      this.landedTime += frame;
      if (this.landedTime > LANDED_TIME) this.phase = undefined;
    }
    this.fallSeat(frame);
    if (!this.active) {
      this.render();
      return undefined;
    }
    const ground = this.env.groundHeight(this.position.x, this.position.z);
    // Missing terrain is never a bottomless pit: hold still until it streams in.
    this.waitingForTerrain = ground === undefined;
    if (ground === undefined) {
      this.render();
      return undefined;
    }
    let surface = Math.max(
      ground,
      this.env.waterHeight?.(this.position.x, this.position.z) ?? Number.NEGATIVE_INFINITY,
    );
    this.colliding =
      this.position.y - ground < COLLISION_HEIGHT && this.velocity.length() < COLLISION_SPEED;
    if (this.colliding) {
      this.collision.update(this.root, this.position.x, this.position.z, this.position.y);
      const roof = this.ray(
        this.position.clone().addScaledVector(UP, 2),
        new THREE.Vector3(0, -1, 0),
      );
      if (roof && roof.position.y <= this.position.y + 0.5)
        surface = Math.max(surface, roof.position.y);
      this.blockWalls(frame);
    }
    this.altitude = Math.max(0, this.position.y - surface);
    this.accumulator += frame;
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      this.step(STEP, controls);
      // The rocket fires through anything above the cockpit; after it, the first surface below
      // the falling pilot is the landing.
      if (this.velocity.y <= 0 && this.position.y <= surface) {
        this.position.y = surface;
        this.landingSpeed = -this.velocity.y;
        this.velocity.set(0, 0, 0);
        this.phase = 'landed';
        this.landedTime = 0;
        this.accumulator = 0;
        this.collision.clear();
        this.render();
        return [this.position.x, surface + 0.02, this.position.z];
      }
    }
    this.altitude = Math.max(0, this.position.y - surface);
    // The chase view swings round after a turn rather than snapping to the heading.
    const lag =
      THREE.MathUtils.euclideanModulo(this.heading - this.cameraHeading + Math.PI, Math.PI * 2) -
      Math.PI;
    this.cameraHeading += lag * Math.min(1, frame * 2.5);
    this.render();
    return undefined;
  }

  /**
   * Chase (behind and above, looking past the pilot to the canopy) or the pilot's own eyes;
   * `lookYaw`/`lookPitch` turn the view from straight ahead.
   */
  cameraPose(
    view: 'cockpit' | 'chase',
    lookYaw: number,
    lookPitch: number,
  ): VehicleCameraPose | undefined {
    if (!this.active) return undefined;
    this.firstPerson = view === 'cockpit';
    this.pilot.visible = !this.firstPerson;
    // A positive look yaw turns right, as in the aircraft: right of the heading is less.
    const heading = this.cameraHeading - lookYaw;
    const pitch = THREE.MathUtils.clamp((this.firstPerson ? -0.3 : -0.2) + lookPitch, -1.4, 1.2);
    const forward = new THREE.Vector3(
      Math.sin(heading) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(heading) * Math.cos(pitch),
    );
    let position: THREE.Vector3;
    let lookAt: THREE.Vector3;
    if (this.firstPerson) {
      position = this.position.clone().add(new THREE.Vector3(0, 1.65, 0));
      lookAt = position.clone().add(forward);
    } else {
      // Halfway up the lines: the pilot and the whole canopy above stay in the frame.
      lookAt = this.position.clone().add(new THREE.Vector3(0, this.phase === 'seat' ? 1 : 3.5, 0));
      position = lookAt.clone().addScaledVector(forward, -14);
      const ground = this.env.groundHeight(position.x, position.z);
      if (ground !== undefined) position.y = Math.max(position.y, ground + 1.5);
    }
    const direction = lookAt.clone().sub(position).normalize();
    return {
      position: position.toArray(),
      lookAt: lookAt.toArray(),
      yaw: Math.atan2(direction.z, direction.x),
      pitch: Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)),
    };
  }

  status(): string {
    if (this.phase === 'landed' && this.landedTime < 4)
      return `Landed at ${(this.landingSpeed * 3.28084).toFixed(0)} ft/s${this.landingSpeed > 7 ? ' — hard landing' : ''}`;
    if (!this.active) return '';
    if (this.waitingForTerrain) return 'Parachute · Waiting for terrain';
    const height = `${(this.altitude * 3.28084).toFixed(0)} ft AGL`;
    if (this.phase === 'seat') return `Ejected · ${height} · Seat separating…`;
    const ground = Math.hypot(this.velocity.x, this.velocity.z) * 1.94384;
    const sink = -this.velocity.y * 196.85;
    const opening = this.inflation() < 1 ? ' · Canopy opening…' : '';
    return `Parachute · ${height} · ${ground.toFixed(0)} kt · ${sink.toFixed(0)} ft/min${opening}`;
  }

  dispose(): void {
    this.object.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        for (const m of Array.isArray(object.material) ? object.material : [object.material])
          m.dispose();
      }
    });
    this.object.removeFromParent();
    this.collision.clear();
  }

  /** 0 until the seat separates, then the canopy's inflation, eased. */
  private inflation(): number {
    if (this.phase === 'landed') return 1;
    const t = THREE.MathUtils.clamp((this.time - SEPARATION) / INFLATION, 0, 1);
    return t * t * (3 - 2 * t);
  }

  private step(h: number, controls: ParachuteControls): void {
    this.time += h;
    if (this.phase === 'seat' && this.time >= SEPARATION) {
      this.phase = 'canopy';
      // The seat falls away on its own from here.
      this.seatPosition.copy(this.position);
      this.seatVelocity.copy(this.velocity).addScaledVector(UP, -2);
      this.seatFalling = true;
    }
    const open = this.inflation();
    const v = this.velocity;
    const a = this.acceleration
      .set(0, -GRAVITY, 0)
      .addScaledVector(v, -BODY_DRAG * v.length())
      .multiplyScalar(1 - open);
    if (this.time < ROCKET_TIME) a.addScaledVector(this.rails, ROCKET_ACCELERATION);
    if (open > 0) {
      const turn = THREE.MathUtils.clamp(controls.right, -1, 1);
      this.turnRate = approach(this.turnRate, turn * TURN_RATE * open, h * 2.5);
      this.heading -= this.turnRate * h;
      const trim = THREE.MathUtils.clamp(controls.forward, -1, 1);
      let glide =
        trim >= 0
          ? THREE.MathUtils.lerp(GLIDE.neutral, GLIDE.full, trim)
          : THREE.MathUtils.lerp(GLIDE.neutral, GLIDE.brakes, -trim);
      let sink =
        trim >= 0
          ? THREE.MathUtils.lerp(SINK.neutral, SINK.full, trim)
          : THREE.MathUtils.lerp(SINK.neutral, SINK.brakes, -trim);
      if (controls.flare && this.flareEnergy > 0) {
        // Full lift for the first half of the flare, fading through the second.
        const lift = Math.min(1, this.flareEnergy * 2);
        glide = THREE.MathUtils.lerp(glide, GLIDE.flare, lift);
        sink = THREE.MathUtils.lerp(sink, SINK.flare, lift);
        this.flareEnergy = Math.max(0, this.flareEnergy - h / FLARE_TIME);
      } else if (!controls.flare) {
        this.flareEnergy = Math.min(1, this.flareEnergy + h / (FLARE_TIME * 2));
      }
      sink += (Math.abs(this.turnRate) / TURN_RATE) * TURN_SINK;
      this.target.set(Math.sin(this.heading) * glide, -sink, Math.cos(this.heading) * glide);
      const pull = this.canopyPull
        .copy(this.target)
        .sub(v)
        .multiplyScalar(CANOPY_RESPONSE * open);
      if (pull.length() > OPENING_LIMIT) pull.setLength(OPENING_LIMIT);
      a.add(pull);
    }
    v.addScaledVector(a, h);
    this.position.addScaledVector(v, h);
  }

  /** Slide along a wall rather than through it. */
  private blockWalls(dt: number): void {
    const horizontal = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    const speed = horizontal.length();
    if (speed < 0.01) return;
    const hit = this.ray(
      this.position.clone().addScaledVector(UP, 1),
      horizontal.divideScalar(speed),
    );
    if (!hit || hit.distance > speed * dt + 0.6) return;
    const normal = new THREE.Vector3(hit.normal.x, 0, hit.normal.z);
    if (normal.lengthSq() < 0.25) return;
    normal.normalize();
    const into = this.velocity.dot(normal);
    if (into < 0) this.velocity.addScaledVector(normal, -into);
  }

  private ray(
    from: THREE.Vector3,
    direction: THREE.Vector3,
  ): { position: THREE.Vector3; distance: number; normal: THREE.Vector3 } | undefined {
    if (!this.colliding) return undefined;
    const origin = this.collision.origin;
    const hit = this.collision.octree.rayIntersect(
      new THREE.Ray(new THREE.Vector3(from.x - origin.x, from.y, from.z - origin.z), direction),
    );
    if (!hit) return undefined;
    return {
      position: new THREE.Vector3(
        hit.position.x + origin.x,
        hit.position.y,
        hit.position.z + origin.z,
      ),
      distance: hit.distance,
      normal: hit.triangle.getNormal(new THREE.Vector3()),
    };
  }

  /** The separated seat tumbles down on its own and disappears on the ground. */
  private fallSeat(dt: number): void {
    if (!this.seatFalling || dt <= 0) return;
    const v = this.seatVelocity;
    v.addScaledVector(v, -BODY_DRAG * v.length() * dt).addScaledVector(UP, -GRAVITY * dt);
    this.seatPosition.addScaledVector(v, dt);
    this.seatRotation.multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0.4).normalize(), dt * 3),
    );
    const ground = this.env.groundHeight(this.seatPosition.x, this.seatPosition.z);
    if ((ground !== undefined && this.seatPosition.y <= ground) || this.time > 30)
      this.seatFalling = false;
  }

  private render(): void {
    this.object.visible = this.phase !== undefined;
    if (this.phase === undefined) return;
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, this.heading);
    this.rig.position.copy(this.position);
    const open = this.inflation();
    if (this.phase === 'seat') {
      // Strapped in: upright and level by the time the seat lets go.
      this.rig.quaternion.copy(this.seatRotation).slerp(yaw, Math.min(1, this.time / SEPARATION));
      this.seat.position.copy(this.position);
      this.seat.quaternion.copy(this.rig.quaternion);
    } else {
      this.rig.quaternion.copy(yaw);
      this.seat.position.copy(this.seatPosition);
      this.seat.quaternion.copy(this.seatRotation);
    }
    this.seat.visible = this.phase === 'seat' || this.seatFalling;
    this.hips.rotation.x = this.phase === 'seat' ? -1.35 : 0.12;
    this.pilot.visible = this.phase !== 'landed' && !this.firstPerson;
    this.chute.visible = this.phase !== 'seat';
    if (this.phase === 'landed') {
      // Unclipped, the canopy settles forward onto the ground beyond the pilot.
      const settle = Math.min(1, this.landedTime / 2.5);
      const fall = settle * settle * (Math.PI / 2);
      this.swing.rotation.z = 0;
      this.chute.position.y = THREE.MathUtils.lerp(RISER_HEIGHT, 0.25, settle) - PIVOT;
      this.chute.rotation.x = fall;
      this.chute.scale.set(1, 1, 1);
      this.canopy.rotation.x = -fall;
      this.canopy.scale.set(1, THREE.MathUtils.lerp(1, 0.25, settle), 1);
    } else {
      this.swing.rotation.z = (this.turnRate / TURN_RATE) * TURN_BANK;
      this.chute.position.y = RISER_HEIGHT - PIVOT;
      this.chute.rotation.x = 0;
      // A streaming bag above the pilot that spreads into the full wing.
      this.chute.scale.set(
        THREE.MathUtils.lerp(0.08, 1, open),
        THREE.MathUtils.lerp(0.3, 1, open),
        THREE.MathUtils.lerp(0.2, 1, open),
      );
      this.canopy.rotation.x = 0;
      this.canopy.scale.set(1, 1, 1);
    }
  }

  private build(): void {
    const material = (color: string): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
    const suit = material('#59603f');
    const dark = material('#2a2c2e');
    const helmet = material('#d8d5cb');
    const seatMetal = material('#454b52');
    const cloth = [material('#e05a2b'), material('#ece6d8')];
    const add = (
      parent: THREE.Object3D,
      geometry: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      // Never an obstacle: not for the walker, the aircraft just left, or this canopy's own rays.
      mesh.userData.walkIgnore = true;
      parent.add(mesh);
      return mesh;
    };
    this.object.add(this.rig, this.seat);
    this.rig.add(this.swing);
    this.swing.position.y = PIVOT;
    this.swing.add(this.pilot, this.chute);
    this.pilot.position.y = -PIVOT;

    // The pilot, feet at the origin, facing +Z, hands up on the risers.
    this.hips.position.y = 0.88;
    this.pilot.add(this.hips);
    for (const side of [-1, 1]) {
      add(this.hips, new THREE.BoxGeometry(0.15, 0.84, 0.17), suit, side * 0.1, -0.44, 0);
      add(this.hips, new THREE.BoxGeometry(0.14, 0.1, 0.27), dark, side * 0.1, -0.84, 0.05);
      const arm = add(
        this.pilot,
        new THREE.BoxGeometry(0.1, 0.62, 0.1),
        suit,
        side * 0.27,
        1.62,
        0,
      );
      arm.rotation.z = -side * 0.12;
    }
    add(this.pilot, new THREE.BoxGeometry(0.42, 0.62, 0.26), suit, 0, 1.18, 0);
    add(this.pilot, new THREE.BoxGeometry(0.44, 0.1, 0.28), dark, 0, 0.92, 0);
    add(this.pilot, new THREE.BoxGeometry(0.38, 0.46, 0.14), dark, 0, 1.2, -0.2);
    add(this.pilot, new THREE.IcosahedronGeometry(0.14, 1), helmet, 0, 1.62, 0);
    add(this.pilot, new THREE.BoxGeometry(0.2, 0.07, 0.06), dark, 0, 1.63, 0.12);

    // A seven-cell ram-air canopy on an arc, its lines gathered to the two risers.
    this.chute.add(this.canopy);
    this.canopy.position.y = LINE_LENGTH;
    const cellWidth = (SPAN / CELLS) * 1.02;
    for (let i = 0; i < CELLS; i++) {
      const angle = (i - (CELLS - 1) / 2) * CELL_ARC;
      const cell = add(
        this.canopy,
        new THREE.BoxGeometry(cellWidth, THICKNESS, CHORD),
        cloth[i % 2] as THREE.Material,
        ARC_RADIUS * Math.sin(angle),
        ARC_RADIUS * (Math.cos(angle) - 1),
        0,
      );
      cell.rotation.z = -angle;
    }
    const points: number[] = [];
    for (let i = 0; i <= CELLS; i++) {
      const angle = (i - CELLS / 2) * CELL_ARC;
      const x = (ARC_RADIUS - THICKNESS / 2) * Math.sin(angle);
      const y = LINE_LENGTH + (ARC_RADIUS - THICKNESS / 2) * Math.cos(angle) - ARC_RADIUS;
      const riser = Math.sign(x) * 0.22;
      for (const z of [CHORD * 0.4, -CHORD * 0.4]) points.push(riser, 0, 0, x, y, z);
    }
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(points, 3),
      ),
      new THREE.LineBasicMaterial({ color: '#34363a' }),
    );
    lines.userData.walkIgnore = true;
    this.chute.add(lines);

    // The seat: pan, back and headbox, strapped under the pilot until it separates.
    add(this.seat, new THREE.BoxGeometry(0.62, 0.14, 0.6), seatMetal, 0, 0.74, 0.1);
    add(this.seat, new THREE.BoxGeometry(0.62, 1.1, 0.16), seatMetal, 0, 1.25, -0.36);
    add(this.seat, new THREE.BoxGeometry(0.5, 0.36, 0.26), dark, 0, 1.95, -0.36);
  }
}
