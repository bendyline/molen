import { readModelSignals } from '@bendyline/molen-client';
import { WalkCollision } from '@bendyline/molen-client/navigation';
import {
  createVehicleVisual,
  type VehicleCameraPose,
  type VehicleVisual,
  vehicleCameraPose,
} from '@bendyline/molen-client/vehicles';
import type { TypeLibrary } from '@bendyline/molen-kernel/content';
import {
  driveVehicle,
  initialVehicleState,
  installVehicles,
  Mounted,
  mountEntity,
  unmountEntity,
  Vehicle,
  type VehicleEnvironment,
  VehicleInput,
  type VehicleInputData,
  VehicleState,
  vehicleLocalPoint,
  vehicleRotation,
} from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
import type { VehicleData, VehiclePlacement, VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { OBB } from 'three/addons/math/OBB.js';

const PLAYER = 'world-player';

export interface EarthVehiclesOptions {
  /** Streamed scene whose visible tiles carry parked-car placements (`userData.vehicles`). */
  root: THREE.Object3D;
  /** Ground height at world X/Z, or undefined while unloaded. */
  sampleHeight: (x: number, z: number) => number | undefined;
  /** Load a vehicle model by entity type id, e.g. from the entities content pack. */
  loadModel: (kind: string) => Promise<THREE.Object3D>;
  /** Entity types: the vehicle components a parked car becomes when it is driven. */
  types: TypeLibrary;
  /**
   * Extra solid things vehicles and exiting drivers must not overlap (e.g. parked aircraft).
   * Return true when `box` intersects one; `except` is the entity being tested against itself.
   */
  obstacles?: (box: OBB, except?: string) => boolean;
}

/**
 * Drivable parked cars for an Earth view. The ECS world (on the main thread, from the SES-free
 * `@bendyline/molen-kernel/world`) is the source of truth; terrain tiles only draw dormant cars as
 * instances. Nearby cars load their full model, and a car someone has driven stays resident for
 * the session even after its source tile is evicted.
 */
export class EarthVehicles {
  readonly world: World = new World({ tickRate: 60, seed: 'earth-vehicles' });
  readonly object: THREE.Group = new THREE.Group();
  readonly environment: VehicleEnvironment;
  view: 'cockpit' | 'chase' = 'cockpit';
  lookYaw: number = 0;
  lookPitch: number = 0;
  /** A short explanation when entering or leaving a vehicle did not work. */
  message: string = '';
  private accumulator = 0;
  private active = new Map<string, VehicleVisual>();
  private loading = new Set<string>();
  private retained = new Set<string>();
  private nearby = new Set<string>();
  private disposed = false;
  private readonly collision = new WalkCollision(true);
  private readonly matrix = new THREE.Matrix4();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private lastSync = -Infinity;

  private readonly root: THREE.Object3D;
  private readonly sampleHeight: (x: number, z: number) => number | undefined;
  private readonly loadModel: (kind: string) => Promise<THREE.Object3D>;
  private readonly types: TypeLibrary;
  private readonly obstacles: ((box: OBB, except?: string) => boolean) | undefined;

  constructor(options: EarthVehiclesOptions) {
    this.root = options.root;
    this.sampleHeight = options.sampleHeight;
    this.loadModel = options.loadModel;
    this.types = options.types;
    this.obstacles = options.obstacles;
    const root = this.root;
    this.object.name = 'earth:vehicles';
    root.add(this.object);
    this.world.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, PLAYER);
    this.environment = {
      groundHeight: (x, z) => this.support(x, z),
      canOccupy: (position, yaw, spec, id) => this.canOccupy(position, yaw, spec, id),
      canExit: (position, _actor, vehicle) => this.canExit(position, vehicle),
    };
    installVehicles(this.world, this.environment);
  }
  get mountedId(): string | undefined {
    return this.world.get(PLAYER, Mounted)?.vehicle;
  }
  get speed(): number {
    return this.mountedId ? (this.world.get(this.mountedId, VehicleState)?.speed ?? 0) : 0;
  }
  get waiting(): boolean {
    return this.mountedId
      ? (this.world.get(this.mountedId, VehicleState)?.waitingForTerrain ?? false)
      : false;
  }

  sync(now: number, observer?: [number, number, number]): void {
    if (this.disposed) return;
    if (now - this.lastSync < 200) return;
    this.lastSync = now;
    const resident = new Map<string, VehiclePlacement>();
    const batches: THREE.InstancedMesh[] = [];
    this.root.traverseVisible((object) => {
      for (const p of (object.userData.vehicles ?? []) as VehiclePlacement[])
        if (!resident.has(p.id)) resident.set(p.id, p);
      if (object instanceof THREE.InstancedMesh && object.userData.vehicleIds) batches.push(object);
    });
    for (const [id, p] of resident)
      if (!this.world.exists(id)) {
        const components = this.types.components(p.kind);
        const vehicle = components.vehicle as unknown as VehicleData;
        vehicle.color = p.color;
        vehicle.spec = p.spec;
        components.transform = {
          pos: [...p.position],
          rot: vehicleRotation(p.yaw, p.pitch ?? 0, p.roll ?? 0),
        };
        components.vehicleState = {
          ...initialVehicleState(p.yaw),
          pitch: p.pitch ?? 0,
          roll: p.roll ?? 0,
        };
        this.world.spawnRaw(components, id);
      }
    // Near parked cars use the same authored GLB before and after boarding. Bound the
    // detail work and retain interacted cars independently of this disposable near LOD.
    if (observer !== undefined) {
      const candidates = [...this.world.query(Transform, Vehicle)]
        .map(([id, t, v]) => ({
          id,
          vehicle: v,
          distance: Math.hypot(...t.pos.map((value, axis) => value - (observer[axis] ?? 0))),
        }))
        .filter(
          ({ id, distance }) =>
            resident.has(id) &&
            !this.retained.has(id) &&
            distance < (this.active.has(id) ? 20 : 14),
        )
        .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
        .slice(0, 8);
      this.nearby = new Set(candidates.map(({ id }) => id));
      for (const { id, vehicle } of candidates) void this.activate(id, vehicle);
    }
    for (const [id, visual] of this.active) {
      if (!this.retained.has(id) && (!resident.has(id) || !this.nearby.has(id))) {
        visual.dispose();
        this.active.delete(id);
      }
    }
    for (const [id] of this.world.query(Vehicle))
      if (!resident.has(id) && !this.retained.has(id) && !this.loading.has(id))
        this.world.destroy(id);
    // Parent/child LOD overlap and regenerated tiles must never resurrect the car at its bay.
    const visible = new Set<string>();
    for (const mesh of batches) {
      const ids = mesh.userData.vehicleIds as string[];
      let changed = false;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i] as string;
        const hide =
          this.active.has(id) || (this.retained.has(id) && this.loading.has(id)) || visible.has(id);
        mesh.getMatrixAt(i, this.matrix);
        const wasHidden =
          this.matrix.elements[0] === 0 &&
          this.matrix.elements[5] === 0 &&
          this.matrix.elements[10] === 0;
        if (hide && !wasHidden) {
          mesh.userData.vehicleMatrices ??= new Map<number, THREE.Matrix4>();
          const saved = mesh.userData.vehicleMatrices as Map<number, THREE.Matrix4>;
          saved.set(i, this.matrix.clone());
          mesh.setMatrixAt(i, this.hidden);
          changed = true;
        } else if (!hide && wasHidden) {
          const saved = (
            mesh.userData.vehicleMatrices as Map<number, THREE.Matrix4> | undefined
          )?.get(i);
          if (saved) {
            mesh.setMatrixAt(i, saved);
            changed = true;
          }
        }
        if (!hide) visible.add(id);
      }
      if (changed) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.computeBoundingBox();
      }
    }
  }
  private support(x: number, z: number): number | undefined {
    const ground = this.sampleHeight(x, z);
    if (ground === undefined) return undefined;
    const ray = new THREE.Ray(
      new THREE.Vector3(x - this.collision.origin.x, ground + 0.65, z - this.collision.origin.z),
      new THREE.Vector3(0, -1, 0),
    );
    const hit = this.collision.octree.rayIntersect(ray);
    return hit && hit.position.y >= ground - 0.2 ? hit.position.y : ground;
  }
  private vehicleBox(pos: [number, number, number], yaw: number, spec: VehicleSpec): OBB {
    return new OBB(
      new THREE.Vector3(pos[0], pos[1] + spec.height / 2, pos[2]),
      new THREE.Vector3(spec.width / 2, spec.height / 2, spec.length / 2),
      new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(yaw)),
    );
  }
  private canOccupy(
    pos: [number, number, number],
    yaw: number,
    spec: VehicleSpec,
    id: string,
  ): boolean {
    const box = this.vehicleBox(pos, yaw, spec);
    if (this.intersectsObstacle(box)) return false;
    for (const [other, t, v, state] of this.world.query(Transform, Vehicle, VehicleState)) {
      if (other === id || Math.hypot(t.pos[0] - pos[0], t.pos[2] - pos[2]) > 7) continue;
      if (box.intersectsOBB(this.vehicleBox(t.pos, state.yaw, v.spec), 0.001)) return false;
    }
    const local = new THREE.Vector3(
      pos[0] - this.collision.origin.x,
      pos[1],
      pos[2] - this.collision.origin.z,
    );
    const sphere = new THREE.Sphere(
      local.clone().add(new THREE.Vector3(0, spec.height / 2, 0)),
      Math.hypot(spec.width, spec.length, spec.height) / 2,
    );
    const triangles: THREE.Triangle[] = [];
    this.collision.octree.getSphereTriangles(sphere, triangles);
    const inverse = new THREE.Matrix4()
      .makeRotationY(-yaw)
      .multiply(new THREE.Matrix4().makeTranslation(-local.x, -local.y, -local.z));
    const bounds = new THREE.Box3(
      new THREE.Vector3(-spec.width / 2, 0.32, -spec.length / 2),
      new THREE.Vector3(spec.width / 2, spec.height, spec.length / 2),
    );
    const normal = new THREE.Vector3();
    for (const t of triangles) {
      // Road/ground support is handled at all four wheels; walls and undersides block the body.
      if (t.getNormal(normal).y > 0.7) continue;
      const triangle = new THREE.Triangle(
        t.a.clone().applyMatrix4(inverse),
        t.b.clone().applyMatrix4(inverse),
        t.c.clone().applyMatrix4(inverse),
      );
      if (bounds.intersectsTriangle(triangle)) return false;
    }
    return true;
  }
  private canExit(pos: [number, number, number], vehicle: string): boolean {
    const start = new THREE.Vector3(
      pos[0] - this.collision.origin.x,
      pos[1] + 0.3,
      pos[2] - this.collision.origin.z,
    );
    const capsule = new Capsule(start, start.clone().add(new THREE.Vector3(0, 1.2, 0)), 0.3);
    const hit = this.collision.octree.capsuleIntersect(capsule);
    if (hit && (hit.normal.y < 0.7 || hit.depth > 0.08)) return false;
    const person = new OBB(
      new THREE.Vector3(pos[0], pos[1] + 0.9, pos[2]),
      new THREE.Vector3(0.32, 0.9, 0.32),
    );
    if (this.intersectsObstacle(person, vehicle)) return false;
    for (const [id, t, v, state] of this.world.query(Transform, Vehicle, VehicleState)) {
      if (id === vehicle) continue;
      if (person.intersectsOBB(this.vehicleBox(t.pos, state.yaw, v.spec))) return false;
    }
    // Exit paths cannot pass through a wall to the other side of it.
    const t = this.world.get(vehicle, Transform);
    if (t) {
      const from = new THREE.Vector3(
        t.pos[0] - this.collision.origin.x,
        t.pos[1] + 0.8,
        t.pos[2] - this.collision.origin.z,
      );
      const to = start.clone();
      to.y = from.y;
      const distance = from.distanceTo(to);
      const wall = this.collision.octree.rayIntersect(
        new THREE.Ray(from, to.sub(from).normalize()),
      );
      if (wall && wall.distance < distance) return false;
    }
    return true;
  }
  private intersectsObstacle(box: OBB, except?: string): boolean {
    return this.obstacles?.(box, except) ?? false;
  }
  nearest(position: [number, number, number]): string | undefined {
    let best: string | undefined,
      distance = 3;
    for (const [id, t, v] of this.world.query(Transform, Vehicle)) {
      const entry = vehicleLocalPoint(t, v.spec.driverEye);
      const d = Math.hypot(entry[0] - position[0], entry[1] - position[1], entry[2] - position[2]);
      if (d < distance) {
        best = id;
        distance = d;
      }
    }
    return best;
  }
  enter(position: [number, number, number]): boolean {
    this.message = '';
    const id = this.nearest(position);
    if (!id) return false;
    this.collision.update(this.root, position[0], position[2]);
    this.world.patch(PLAYER, Transform, { pos: [...position] });
    const t = this.world.get(id, Transform);
    if (!t) return false;
    // Reject interaction through a wall, even when a seat is within reach.
    const a = new THREE.Vector3(
      position[0] - this.collision.origin.x,
      position[1],
      position[2] - this.collision.origin.z,
    );
    const target = new THREE.Vector3(
      t.pos[0] - this.collision.origin.x,
      t.pos[1] + 1,
      t.pos[2] - this.collision.origin.z,
    );
    const distance = a.distanceTo(target);
    const wall = this.collision.octree.rayIntersect(new THREE.Ray(a, target.sub(a).normalize()));
    if (wall && wall.distance < distance - 0.15) {
      this.message = 'Move closer to the door';
      return false;
    }
    if (!mountEntity(this.world, PLAYER, id)) return false;
    const v = this.world.get(id, Vehicle);
    if (!v) return false;
    this.retained.add(id);
    if (!this.active.has(id)) {
      void this.activate(id, v);
    }
    this.view = 'cockpit';
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.lastSync = -Infinity;
    this.sync(performance.now());
    this.render();
    return true;
  }
  exit(): [number, number, number] | undefined {
    this.message = '';
    const id = this.mountedId;
    const transform = id ? this.world.get(id, Transform) : undefined;
    if (transform) this.collision.update(this.root, transform.pos[0], transform.pos[2]);
    if (!unmountEntity(this.world, PLAYER, this.environment)) {
      this.message =
        Math.abs(this.speed) > 0.7
          ? 'Brake to a stop before exiting'
          : 'Exit blocked — move to an open space';
      return undefined;
    }
    return this.world.get(PLAYER, Transform)?.pos;
  }
  update(dt: number, input: VehicleInputData): void {
    const id = this.mountedId;
    if (id && this.world.has(id, Vehicle)) {
      const t = this.world.get(id, Transform);
      if (t) this.collision.update(this.root, t.pos[0], t.pos[2]);
      driveVehicle(this.world, PLAYER, input);
    }
    this.accumulator += Math.min(0.1, Math.max(0, dt));
    while (this.accumulator >= this.world.dt) {
      this.world.step();
      this.accumulator -= this.world.dt;
    }
    this.render();
  }
  private render(): void {
    for (const [id, visual] of this.active) {
      const t = this.world.get(id, Transform),
        state = this.world.get(id, VehicleState);
      if (!t || !state) continue;
      visual.object.position.fromArray(t.pos);
      visual.object.quaternion.fromArray(t.rot);
      const input = this.world.get(id, VehicleInput);
      visual.update(state.steer, state.wheelAngle, {
        speed: state.speed,
        heading: state.yaw,
        pitch: state.pitch,
        roll: state.roll,
        throttle: input?.throttle,
        brake: Number(input?.brake ?? false),
        ...readModelSignals(this.world.get(id, Vehicle)?.visual.interior?.sources, (name) =>
          this.world.get(id, { name }),
        ),
      });
    }
  }
  cameraPose(): VehicleCameraPose | undefined {
    const id = this.mountedId;
    if (!id) return undefined;
    const transform = this.world.get(id, Transform),
      vehicle = this.world.get(id, Vehicle);
    if (!transform || !vehicle) return undefined;
    return vehicleCameraPose(transform, vehicle.spec, {
      view: this.view,
      lookYaw: this.lookYaw,
      lookPitch: this.lookPitch,
      obstructionDistance: (from, to) => {
        const start = new THREE.Vector3().fromArray(from).sub(this.collision.origin);
        const direction = new THREE.Vector3()
          .fromArray(to)
          .sub(new THREE.Vector3().fromArray(from))
          .normalize();
        const hit = this.collision.octree.rayIntersect(new THREE.Ray(start, direction));
        return hit ? hit.distance : undefined;
      },
    });
  }
  label(id: string): string {
    const v = this.world.get(id, Vehicle);
    return v ? v.spec.label : 'Vehicle';
  }
  private async activate(id: string, vehicle: VehicleData): Promise<void> {
    if (this.loading.has(id) || this.active.has(id)) return;
    this.loading.add(id);
    try {
      const model = await this.loadModel(vehicle.kind);
      const visual = createVehicleVisual(model, vehicle);
      if (
        this.disposed ||
        !this.world.exists(id) ||
        (!this.retained.has(id) && !this.nearby.has(id))
      ) {
        visual.dispose();
        return;
      }
      this.object.add(visual.object);
      this.active.set(id, visual);
      this.lastSync = -Infinity;
      this.sync(performance.now());
      this.render();
    } catch (error) {
      this.message = `Vehicle model could not load: ${String(error)}`;
      console.error(this.message);
    } finally {
      this.loading.delete(id);
    }
  }
  dispose(): void {
    this.disposed = true;
    for (const v of this.active.values()) v.dispose();
    this.active.clear();
    this.object.removeFromParent();
    this.collision.clear();
  }
}
