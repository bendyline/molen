import { readModelSignals } from '@bendyline/molen-client';
import { WalkCollision } from '@bendyline/molen-client/navigation';
import {
  createVehicleVisual,
  setParkedVehicleHidden,
  type VehicleCameraPose,
  type VehicleVisual,
  vehicleCameraPose,
} from '@bendyline/molen-client/vehicles';
import {
  Boat,
  type BoatEnvironment,
  BoatInput,
  BoatState,
  boatSupport,
  driveBoat,
  initialBoatState,
  installBoats,
} from '@bendyline/molen-kernel/boats';
import type { TypeLibrary } from '@bendyline/molen-kernel/content';
import {
  driveVehicle,
  initialVehicleState,
  installVehicles,
  Mountable,
  Mounted,
  mountEntity,
  unmountEntity,
  Vehicle,
  type VehicleEnvironment,
  VehicleInput,
  type VehicleInputData,
  VehicleState,
  type VehicleStateData,
  vehicleLocalPoint,
  vehicleRotation,
} from '@bendyline/molen-kernel/vehicles';
import { componentHandle, Transform, World } from '@bendyline/molen-kernel/world';
import type {
  BoatData,
  BoatSpec,
  BoatStateData,
  VehicleData,
  VehiclePlacement,
  VehicleSpec,
  WaterSettings,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { OBB } from 'three/addons/math/OBB.js';
import { EARTH_WATER_CONDITIONS, EarthWater } from './water';

const PLAYER = 'world-player';
/** Ambient NPCs share this world; they are never parked cars to cull. */
const AmbientAgent = componentHandle('ambientAgent');

export interface EarthVehiclesOptions {
  /**
   * An ECS world to share with aircraft, ambient life and actors. The host that passes it steps
   * it once per frame (see {@link EarthVehicles.step}); without one a private world is created and
   * stepped inside {@link EarthVehicles.update}.
   */
  world?: World;
  /** Streamed scene whose visible tiles carry parked-car placements (`userData.vehicles`). */
  root: THREE.Object3D;
  /** Ground height at world X/Z, or undefined while unloaded. */
  sampleHeight: (x: number, z: number) => number | undefined;
  /** Swells/current and optional host water coverage with measured depth. */
  water?: WaterSettings;
  waterAt?: BoatEnvironment['waterAt'];
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
/** How a host adds a car with {@link EarthVehicles.spawn} or {@link EarthVehicles.spawnNear}. */
export interface EarthSpawnOptions {
  /** Entity id (default `earth-car-<n>`); must be unique in the world. */
  id?: string;
  /**
   * Keep the car through `release` and forced exits, until {@link EarthVehicles.remove}: a car the
   * host owns rather than one `setMode` added for a drive.
   */
  retain?: boolean;
  /** Paint for the type's `paintMaterial` (CSS color); without it the authored paint stays. */
  color?: string;
}

export class EarthVehicles {
  /** The ECS world: the host's shared one, or a private world this instance steps itself. */
  readonly world: World;
  readonly object: THREE.Group = new THREE.Group();
  readonly environment: VehicleEnvironment;
  readonly boatEnvironment: BoatEnvironment;
  private readonly water: EarthWater;
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
  // Cars move fast and only ever meet geometry near road level: a wider neighborhood rebuilt every
  // 12 m, a vertical band around the car, and 5 Hz rescans keep the tree cheap at speed.
  private readonly collision = new WalkCollision({
    ignoreVehicles: true,
    radius: 32,
    rebuildDistance: 12,
    verticalRadius: 24,
    rescanIntervalMs: 200,
  });
  private lastSync = -Infinity;
  private sequence = 0;
  private readonly spawned = new Set<string>();
  /** Spawned cars a host owns: they survive `release` and forced exits until removed. */
  private readonly owned = new Set<string>();
  private readonly ownsWorld: boolean;

  private readonly root: THREE.Object3D;
  private readonly sampleHeight: (x: number, z: number) => number | undefined;
  private readonly loadModel: (kind: string) => Promise<THREE.Object3D>;
  private readonly types: TypeLibrary;
  private readonly obstacles: ((box: OBB, except?: string) => boolean) | undefined;

  constructor(options: EarthVehiclesOptions) {
    this.ownsWorld = options.world === undefined;
    this.world = options.world ?? new World({ tickRate: 60, seed: 'earth-vehicles' });
    this.root = options.root;
    this.sampleHeight = options.sampleHeight;
    this.loadModel = options.loadModel;
    this.types = options.types;
    this.obstacles = options.obstacles;
    const root = this.root;
    this.object.name = 'earth:vehicles';
    root.add(this.object);
    if (!this.world.exists(PLAYER))
      this.world.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, PLAYER);
    this.environment = {
      groundHeight: (x, z) => this.support(x, z),
      canOccupy: (position, yaw, spec, id) => this.canOccupy(position, yaw, spec, id),
      canExit: (position, _actor, vehicle) => this.canExit(position, vehicle),
    };
    this.water = new EarthWater(root, this.sampleHeight);
    this.water.sync();
    this.boatEnvironment = {
      waterAt: options.waterAt ?? ((x, z) => this.water.sample(x, z)),
      conditions: options.water ?? EARTH_WATER_CONDITIONS,
      canOccupy: (position, yaw, spec, id) => this.canOccupy(position, yaw, spec, id),
    };
    installVehicles(this.world, this.environment);
    installBoats(this.world, this.boatEnvironment);
  }
  get mountedId(): string | undefined {
    return this.world.get(PLAYER, Mounted)?.vehicle;
  }
  get speed(): number {
    return this.mountedId ? (this.state(this.mountedId)?.speed ?? 0) : 0;
  }
  get waiting(): boolean {
    const state = this.mountedId ? this.state(this.mountedId) : undefined;
    return Boolean(
      state &&
        (this.isBoat(this.mountedId as string) ? state.waitingForWater : state.waitingForTerrain),
    );
  }

  private data(id: string): VehicleData | BoatData | undefined {
    return this.world.get(id, Vehicle) ?? this.world.get(id, Boat);
  }
  private state(id: string): BoatStateData | VehicleStateData | undefined {
    return this.world.get(id, VehicleState) ?? this.world.get(id, BoatState);
  }
  isBoat(id: string): boolean {
    return this.world.has(id, Boat);
  }
  boatStatus(id: string): BoatStateData | undefined {
    return this.world.get(id, BoatState);
  }
  private *bodies() {
    for (const [id, t] of [
      ...this.world.query(Transform, Vehicle),
      ...this.world.query(Transform, Boat),
    ]) {
      const data = this.data(id),
        state = this.state(id);
      if (data && state) yield [id, t, data, state] as const;
    }
  }
  sync(now: number, observer?: [number, number, number]): void {
    if (this.disposed) return;
    if (now - this.lastSync < 200) return;
    this.lastSync = now;
    this.water.sync();
    const resident = new Map<string, VehiclePlacement>();
    const batches: THREE.Mesh[] = [];
    this.root.traverseVisible((object) => {
      for (const p of (object.userData.vehicles ?? []) as VehiclePlacement[])
        if (!resident.has(p.id)) resident.set(p.id, p);
      if ((object as THREE.Mesh).isMesh && object.userData.vehicleIds)
        batches.push(object as THREE.Mesh);
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
    for (const [id] of this.world.query(Vehicle).without(AmbientAgent))
      if (!resident.has(id) && !this.retained.has(id) && !this.loading.has(id))
        this.world.destroy(id);
    // Parent/child LOD overlap and regenerated tiles must never resurrect the car at its bay.
    const visible = new Set<string>();
    for (const mesh of batches) {
      const ids = mesh.userData.vehicleIds as string[];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i] as string;
        const hide =
          this.active.has(id) || (this.retained.has(id) && this.loading.has(id)) || visible.has(id);
        setParkedVehicleHidden(mesh, i, hide);
        if (!hide) visible.add(id);
      }
    }
  }
  /** Nothing but terrain within 40 m above the ground at X/Z (no roof, deck or landmark). */
  private openSky(x: number, z: number, ground: number): boolean {
    const ray = new THREE.Ray(
      new THREE.Vector3(x - this.collision.origin.x, ground + 40, z - this.collision.origin.z),
      new THREE.Vector3(0, -1, 0),
    );
    const hit = this.collision.octree.rayIntersect(ray);
    return hit === false || hit === undefined || hit.position.y <= ground + 0.4;
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
  private vehicleBox(
    pos: [number, number, number],
    yaw: number,
    spec: Pick<VehicleSpec, 'height' | 'width' | 'length'>,
  ): OBB {
    return new OBB(
      new THREE.Vector3(pos[0], pos[1] + spec.height / 2, pos[2]),
      new THREE.Vector3(spec.width / 2, spec.height / 2, spec.length / 2),
      new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(yaw)),
    );
  }
  private canOccupy(
    pos: [number, number, number],
    yaw: number,
    spec: Pick<VehicleSpec, 'height' | 'width' | 'length'>,
    id: string,
  ): boolean {
    const box = this.vehicleBox(pos, yaw, spec);
    if (this.intersectsObstacle(box, id)) return false;
    for (const [other, t, v, state] of this.bodies()) {
      if (
        other === id ||
        Math.hypot(t.pos[0] - pos[0], t.pos[2] - pos[2]) >
          (Math.hypot(spec.length, spec.width) + Math.hypot(v.spec.length, v.spec.width)) / 2
      )
        continue;
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
    if (this.isBoat(vehicle)) {
      const water = this.boatEnvironment.waterAt(pos[0], pos[2]);
      if (water === undefined || (water !== null && pos[1] < water.height + 0.12)) return false;
    }
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
    for (const [id, t, v, state] of this.bodies()) {
      if (id === vehicle) continue;
      if (person.intersectsOBB(this.vehicleBox(t.pos, state.yaw, v.spec))) return false;
    }
    // Exit paths cannot pass through a wall to the other side of it.
    const t = this.world.get(vehicle, Transform);
    if (t) {
      const from = new THREE.Vector3(
        t.pos[0] - this.collision.origin.x,
        (this.isBoat(vehicle) ? pos[1] : t.pos[1]) + 0.8,
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
      distance = Infinity;
    for (const [id, t, v] of this.bodies()) {
      const mount = this.world.get(id, Mountable);
      const d = Math.min(
        ...[v.spec.driverEye, ...(mount?.entries ?? [])].map((point) => {
          const entry = vehicleLocalPoint(t, point);
          return Math.hypot(entry[0] - position[0], entry[1] - position[1], entry[2] - position[2]);
        }),
      );
      if (d < distance && d <= (mount?.reach ?? 3)) {
        best = id;
        distance = d;
      }
    }
    return best;
  }
  /** Drivable car types in the entity library (types with a vehicle and a seat). */
  static typeIds(types: TypeLibrary): string[] {
    return types.idsWith('vehicle').filter((id) => types.components(id).mountable !== undefined);
  }
  static boatTypeIds(types: TypeLibrary): string[] {
    return types.idsWith('boat').filter((id) => types.components(id).mountable !== undefined);
  }
  /**
   * Add a drivable car of `kind` at a world position, nose along `yaw` (the kernel's vehicle yaw:
   * 0 faces +Z). It stays for the session until {@link remove}d (or until the driver leaves,
   * unless `retain`). Returns its entity id, or undefined when the spot is blocked or the id is
   * taken.
   */
  spawn(
    kind: string,
    position: [number, number, number],
    yaw: number,
    options: EarthSpawnOptions = {},
  ): string | undefined {
    const components = this.types.components(kind);
    const vehicle = (components.vehicle ?? components.boat) as unknown as
      | VehicleData
      | BoatData
      | undefined;
    if (vehicle === undefined) return undefined;
    const id = options.id ?? `earth-${components.boat ? 'boat' : 'car'}-${++this.sequence}`;
    if (this.world.exists(id)) {
      this.message = `A vehicle with id ${id} already exists`;
      return undefined;
    }
    if (components.boat) {
      this.water.sync();
      const support = boatSupport(
        this.boatEnvironment,
        position[0],
        position[2],
        yaw,
        vehicle.spec as BoatSpec,
      );
      if (!support.sample) {
        this.message = support.waiting
          ? 'Water is still loading'
          : 'The hull needs open, deep water';
        return undefined;
      }
      position = [position[0], support.sample.height, position[2]];
    }
    this.collision.update(this.root, position[0], position[2], position[1]);
    if (!this.canOccupy(position, yaw, vehicle.spec, id)) {
      this.message = 'No room for a car here';
      return undefined;
    }
    if (options.color !== undefined) vehicle.color = options.color;
    components.transform = { pos: [...position], rot: vehicleRotation(yaw, 0, 0) };
    if (components.boat) components.boatState = initialBoatState(yaw);
    else components.vehicleState = initialVehicleState(yaw);
    this.world.spawnRaw(components, id);
    this.spawned.add(id);
    this.retained.add(id);
    if (options.retain === true) this.owned.add(id);
    void this.activate(id, vehicle);
    return id;
  }
  /**
   * Add a car on open ground near world X/Z: the nearest spot within `radius` meters (default 80,
   * searched outward in 4 m rings) where the car fits under open sky on the terrain itself, not
   * on a roof, plaza deck or landmark, and that `avoid` (e.g. landmarks still streaming in) does
   * not reject. Returns its entity id, or undefined when nowhere nearby is open.
   */
  spawnNear(
    kind: string,
    x: number,
    z: number,
    yaw: number,
    options: {
      radius?: number;
      avoid?: (x: number, z: number) => boolean;
    } & EarthSpawnOptions = {},
  ): string | undefined {
    const radius = options.radius ?? 80;
    const spawnOptions: EarthSpawnOptions = {
      ...(options.id !== undefined ? { id: options.id } : {}),
      ...(options.retain !== undefined ? { retain: options.retain } : {}),
      ...(options.color !== undefined ? { color: options.color } : {}),
    };
    const components = this.types.components(kind);
    const vehicle = (components.vehicle ?? components.boat) as unknown as
      | VehicleData
      | BoatData
      | undefined;
    if (vehicle === undefined) return undefined;
    this.collision.update(this.root, x, z);
    if (components.boat) this.water.sync();
    const spacing = components.boat ? Math.max(8, vehicle.spec.width) : 4;
    let waitingForWater = false;
    for (let ring = 0; ring <= radius; ring += spacing) {
      const steps = ring === 0 ? 1 : Math.ceil((2 * Math.PI * ring) / spacing);
      for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * 2 * Math.PI;
        const cx = x + Math.cos(angle) * ring;
        const cz = z + Math.sin(angle) * ring;
        if (options.avoid?.(cx, cz) === true) continue;
        if (components.boat) {
          const support = boatSupport(this.boatEnvironment, cx, cz, yaw, vehicle.spec as BoatSpec);
          if (!support.sample) {
            waitingForWater ||= support.waiting;
            continue;
          }
          const id = this.spawn(kind, [cx, 0, cz], yaw, spawnOptions);
          if (id !== undefined) return id;
          continue;
        }
        const ground = this.sampleHeight(cx, cz);
        if (ground === undefined) continue;
        if (Math.hypot(cx - this.collision.origin.x, cz - this.collision.origin.z) > 28)
          this.collision.update(this.root, cx, cz, ground);
        if (!this.openSky(cx, cz, ground)) continue;
        if (!this.canOccupy([cx, ground, cz], yaw, vehicle.spec, '')) continue;
        return this.spawn(kind, [cx, ground, cz], yaw, spawnOptions);
      }
    }
    this.message = components.boat
      ? waitingForWater
        ? 'Water is still loading'
        : 'No open water for this hull nearby'
      : 'No open ground for a car here';
    return undefined;
  }
  /** Seat the driver in `id` wherever the driver is (no reach or wall checks). */
  board(id: string): boolean {
    this.message = '';
    const t = this.world.get(id, Transform);
    const v = this.data(id);
    if (!t || !v) return false;
    this.world.patch(PLAYER, Transform, { pos: vehicleLocalPoint(t, v.spec.driverEye) });
    if (!mountEntity(this.world, PLAYER, id)) return false;
    this.retained.add(id);
    if (!this.active.has(id)) void this.activate(id, v);
    this.view = 'chase';
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.render();
    return true;
  }
  /**
   * Leave at once, however fast the car is going, removing it when it was spawned here for a
   * drive (a car spawned with `retain` stays). Returns the car's position.
   */
  release(): [number, number, number] | undefined {
    const id = this.mountedId;
    if (id === undefined) return undefined;
    const pos = this.world.get(id, Transform)?.pos;
    this.world.remove(PLAYER, Mounted);
    this.world.emit('vehicle-unmounted', { actor: PLAYER, vehicle: id });
    if (this.spawned.has(id) && !this.owned.has(id)) this.remove(id);
    else if (this.isBoat(id))
      this.world.set(id, BoatInput, { throttle: 0, steering: 0, anchor: true });
    else this.world.set(id, VehicleInput, { throttle: 0, steering: 0, brake: true });
    return pos === undefined ? undefined : [...pos];
  }
  /** Remove a car added with {@link spawn}. */
  remove(id: string): void {
    if (this.world.get(PLAYER, Mounted)?.vehicle === id) this.world.remove(PLAYER, Mounted);
    this.active.get(id)?.dispose();
    this.active.delete(id);
    this.retained.delete(id);
    this.spawned.delete(id);
    this.owned.delete(id);
    if (this.world.exists(id)) this.world.destroy(id);
  }
  /** World position of the mounted car. */
  get position(): [number, number, number] | undefined {
    const id = this.mountedId;
    const pos = id !== undefined ? this.world.get(id, Transform)?.pos : undefined;
    return pos === undefined ? undefined : [...pos];
  }
  /** Compass heading of the mounted car (0 north, PI/2 east). */
  get heading(): number | undefined {
    const id = this.mountedId;
    const yaw = id !== undefined ? this.state(id)?.yaw : undefined;
    return yaw === undefined
      ? undefined
      : (((Math.PI - yaw) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }
  enter(position: [number, number, number]): boolean {
    this.message = '';
    const id = this.nearest(position);
    if (!id) return false;
    this.collision.update(this.root, position[0], position[2], position[1]);
    this.world.patch(PLAYER, Transform, { pos: [...position] });
    const t = this.world.get(id, Transform);
    if (!t) return false;
    // Reject interaction through a wall, even when a seat is within reach.
    const a = new THREE.Vector3(
      position[0] - this.collision.origin.x,
      position[1],
      position[2] - this.collision.origin.z,
    );
    const entries = this.isBoat(id) ? this.world.get(id, Mountable)?.entries : undefined;
    const boarding = entries
      ?.map((point) => vehicleLocalPoint(t, point))
      .sort(
        (a, b) =>
          Math.hypot(a[0] - position[0], a[1] - position[1], a[2] - position[2]) -
          Math.hypot(b[0] - position[0], b[1] - position[1], b[2] - position[2]),
      )[0];
    const target = new THREE.Vector3(
      (boarding?.[0] ?? t.pos[0]) - this.collision.origin.x,
      boarding?.[1] ?? t.pos[1] + 1,
      (boarding?.[2] ?? t.pos[2]) - this.collision.origin.z,
    );
    const distance = a.distanceTo(target);
    const wall = this.collision.octree.rayIntersect(new THREE.Ray(a, target.sub(a).normalize()));
    if (wall && wall.distance < distance - 0.15) {
      this.message = 'Move closer to the door';
      return false;
    }
    if (!mountEntity(this.world, PLAYER, id)) return false;
    const v = this.data(id);
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
  private exitEnvironment(actor: string): VehicleEnvironment {
    const id = this.world.get(actor, Mounted)?.vehicle;
    const t = id ? this.world.get(id, Transform) : undefined;
    if (!id || !t || !this.isBoat(id)) return this.environment;
    return {
      ...this.environment,
      groundHeight: (x, z) => {
        const ground = this.sampleHeight(x, z);
        if (ground === undefined) return undefined;
        const ray = new THREE.Ray(
          new THREE.Vector3(
            x - this.collision.origin.x,
            t.pos[1] + (this.data(id)?.spec.height ?? 2) + 2,
            z - this.collision.origin.z,
          ),
          new THREE.Vector3(0, -1, 0),
        );
        const hit = this.collision.octree.rayIntersect(ray);
        return hit ? Math.max(ground, hit.position.y) : ground;
      },
    };
  }
  exit(): [number, number, number] | undefined {
    this.message = '';
    const id = this.mountedId;
    const transform = id ? this.world.get(id, Transform) : undefined;
    if (transform)
      this.collision.update(this.root, transform.pos[0], transform.pos[2], transform.pos[1]);
    if (!unmountEntity(this.world, PLAYER, this.exitEnvironment(PLAYER))) {
      this.message =
        Math.abs(this.speed) > 0.7
          ? 'Brake to a stop before exiting'
          : 'Exit blocked — move to an open space';
      return undefined;
    }
    return this.world.get(PLAYER, Transform)?.pos;
  }
  /**
   * Step any mounted entity (a passenger, or a host's own character) out of its car or aircraft by
   * the kernel's rules: the vehicle stopped, an exit with open ground beside it, no wall or vehicle
   * in the way. Returns where it stands, or undefined when it cannot leave yet.
   */
  unmount(actor: string): [number, number, number] | undefined {
    const vehicle = this.world.get(actor, Mounted)?.vehicle;
    if (vehicle === undefined) return undefined;
    const transform = this.world.get(vehicle, Transform);
    if (transform)
      this.collision.update(this.root, transform.pos[0], transform.pos[2], transform.pos[1]);
    if (!unmountEntity(this.world, actor, this.exitEnvironment(actor))) return undefined;
    const pos = this.world.get(actor, Transform)?.pos;
    return pos === undefined ? undefined : [pos[0], pos[1], pos[2]];
  }
  /**
   * One frame: settle standing cars, apply the driver's input to the mounted car, step a private
   * world (a shared world is stepped once per frame by its owner, see {@link step}) and pose the
   * models.
   */
  update(dt: number, input: VehicleInputData): void {
    this.settleSpawned();
    const id = this.mountedId;
    if (id && this.data(id)) {
      const t = this.world.get(id, Transform);
      if (t) this.collision.update(this.root, t.pos[0], t.pos[2], t.pos[1]);
      if (this.isBoat(id))
        driveBoat(this.world, PLAYER, {
          throttle: input.brake
            ? Math.abs(this.speed) > 0.15
              ? -Math.sign(this.speed)
              : 0
            : input.throttle,
          steering: input.steering,
          anchor: input.handbrake === true,
        });
      else driveVehicle(this.world, PLAYER, input);
    }
    if (this.ownsWorld) this.step(dt);
    this.render();
  }
  /** Advance the world by `dt` seconds in fixed ticks (the shared world's owner calls this). */
  step(dt: number): void {
    this.accumulator += Math.min(0.1, Math.max(0, dt));
    while (this.accumulator >= this.world.dt) {
      this.world.step();
      this.accumulator -= this.world.dt;
    }
  }
  /** Whether `id` was spawned here with `retain` (it survives release and forced exits). */
  isOwned(id: string): boolean {
    return this.owned.has(id);
  }
  /** A car's world position, kernel yaw (0 faces +Z), speed (m/s) and whether the viewer drives it. */
  pose(
    id: string,
  ):
    | { position: [number, number, number]; yaw: number; speed: number; occupied: boolean }
    | undefined {
    const t = this.world.get(id, Transform);
    const state = this.state(id);
    if (!t || !state) return undefined;
    return {
      position: [t.pos[0], t.pos[1], t.pos[2]],
      yaw: state.yaw,
      speed: state.speed,
      occupied: this.mountedId === id,
    };
  }
  /** Repaint a car's `paintMaterial` (its `vehicle.color`): the loaded model now, later loads too. */
  setColor(id: string, color: string): void {
    const v = this.data(id);
    if (!v) return;
    if (this.isBoat(id)) this.world.set(id, Boat, { ...v, color } as BoatData);
    else this.world.set(id, Vehicle, { ...v, color } as VehicleData);
    const visual = this.active.get(id);
    if (visual === undefined) return;
    const tint = new THREE.Color(color);
    visual.object.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials)
        if (material.name === v.visual.paintMaterial && 'color' in material)
          (material as THREE.MeshStandardMaterial).color.copy(tint);
    });
  }
  /**
   * Keep standing spawned cars on the ground: a car added while only coarse terrain had streamed
   * would otherwise sit under (or float over) the finer surface that replaces it, since the
   * vehicle step only follows the ground while moving.
   */
  private settleSpawned(): void {
    for (const id of this.spawned) {
      if (this.isBoat(id)) continue;
      const t = this.world.get(id, Transform);
      const state = this.state(id);
      if (!t || !state || Math.abs(state.speed) > 0.2) continue;
      const support = this.support(t.pos[0], t.pos[2]);
      if (support !== undefined && Math.abs(support - t.pos[1]) > 0.05)
        this.world.patch(id, Transform, { pos: [t.pos[0], support, t.pos[2]] });
    }
  }
  /** Move loaded models to their simulated poses and animate wheels and steering. */
  render(): void {
    for (const [id, visual] of this.active) {
      const t = this.world.get(id, Transform),
        state = this.state(id);
      if (!t || !state) continue;
      visual.object.position.fromArray(t.pos);
      visual.object.quaternion.fromArray(t.rot);
      const input = this.world.get(id, BoatInput) ?? this.world.get(id, VehicleInput);
      visual.update(state.steer, typeof state.wheelAngle === 'number' ? state.wheelAngle : 0, {
        speed: state.speed,
        heading: state.yaw,
        pitch: state.pitch,
        roll: state.roll,
        throttle: input?.throttle,
        brake: Number(input?.brake ?? false),
        bodyRoll: typeof state.bodyRoll === 'number' ? state.bodyRoll : 0,
        bodyPitch: typeof state.bodyPitch === 'number' ? state.bodyPitch : 0,
        pedalAngle: typeof state.pedalAngle === 'number' ? state.pedalAngle : 0,
        ...readModelSignals(this.data(id)?.visual.interior?.sources, (name) =>
          this.world.get(id, { name }),
        ),
        ...readModelSignals(this.data(id)?.visual.animation?.sources, (name) =>
          this.world.get(id, { name }),
        ),
      });
    }
  }
  cameraPose(): VehicleCameraPose | undefined {
    const id = this.mountedId;
    if (!id) return undefined;
    const transform = this.world.get(id, Transform),
      vehicle = this.data(id);
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
    const v = this.data(id);
    return v ? v.spec.label : 'Vehicle';
  }
  private async activate(id: string, vehicle: VehicleData | BoatData): Promise<void> {
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
