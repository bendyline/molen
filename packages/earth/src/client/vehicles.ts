import { readModelSignals } from '@bendyline/molen-client';
import { WalkCollision } from '@bendyline/molen-client/navigation';
import {
  createVehicleVisual,
  setParkedVehicleHidden,
  type VehicleCameraPose,
  type VehicleVisual,
  vehicleCameraPose,
  vehicleObstacleContacts,
} from '@bendyline/molen-client/vehicles';
import { Aircraft } from '@bendyline/molen-kernel/aircraft';
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
import { Glass, GlassState } from '@bendyline/molen-kernel/glass';
import {
  driveVehicle,
  IDLE_VEHICLE_INPUT,
  initialVehicleState,
  installVehicles,
  Mountable,
  type MountableData,
  Mounted,
  mountEntity,
  repairVehicle,
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
  ComponentMap,
  VehicleData,
  VehiclePlacement,
  VehicleSpec,
  WaterSettings,
} from '@bendyline/molen-schema';
import { taggedTerrainObjects } from '@bendyline/molen-terrain/client';
import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { OBB } from 'three/addons/math/OBB.js';
import { Livery, selectLivery, tintLivery } from './liveries';
import { EARTH_WATER_CONDITIONS, EarthWater, shownUnder } from './water';

const PLAYER = 'world-player';
/**
 * Ground distance (m) from the observer within which a tile's parked cars are simulation
 * entities, to approach, board and collide with; farther ones are only their tile's merged mesh.
 */
const PARKED_ENTITY_RADIUS = 300;
/** Match ambient traffic's street-distance detail, with hysteresis to prevent boundary churn. */
const PARKED_MODEL_NEAR = 45;
const PARKED_MODEL_FAR = 65;
/** Ambient NPCs share this world; they are never parked cars to cull. */
const AmbientAgent = componentHandle('ambientAgent');
const Renderable = componentHandle('renderable');
/**
 * Traffic slower than this (m/s) has stopped, or is creeping in a queue: a walker can open its
 * door and take it over. Moving traffic is never boardable.
 */
const TRAFFIC_BOARDING_SPEED = 0.5;

/** The part of an ambient agent a stopped car is judged by. */
interface TrafficCar {
  kind?: string;
  type?: string;
  color?: string;
  speed?: number;
  hidden?: boolean;
}

/**
 * A traffic car a walker took over: the agent it was (removed once the drivable car's model
 * shows) and where it stood, to return it to traffic if nobody drove it away.
 */
interface Promotion {
  agent: string;
  components: ComponentMap;
  at: readonly number[];
  shown: boolean;
}

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
  loadModel: (kind: string, signal?: AbortSignal) => Promise<THREE.Object3D>;
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
 * instances. Driven cars keep their small simulation state after tile eviction; their models
 * unload outside the near set. The mounted car and explicitly host-owned cars stay resident.
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
  livery?: string;
  /** @internal The traffic car this one takes over, which is no obstacle to it. */
  replaces?: string;
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
  private loading = new Map<string, AbortController>();
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
  private lastSettle = -Infinity;
  private sequence = 0;
  private readonly spawned = new Set<string>();
  /** Spawned cars a host owns: they survive `release` and forced exits until removed. */
  private readonly owned = new Set<string>();
  /** Doors {@link openDoor} opened, by car: shut on boarding or once nobody is within reach. */
  private readonly openedDoors = new Map<string, string>();
  /** Drivable cars that stand in for traffic cars, by car id (see {@link promote}). */
  private readonly promotions = new Map<string, Promotion>();
  /** Entity library lookups for traffic types: their vehicle and mounts, or null when undrivable. */
  private readonly trafficTypes = new Map<
    string,
    { vehicle: VehicleData; mount: MountableData } | null
  >();
  private readonly ownsWorld: boolean;

  private readonly root: THREE.Object3D;
  private readonly sampleHeight: (x: number, z: number) => number | undefined;
  private readonly loadModel: (kind: string, signal?: AbortSignal) => Promise<THREE.Object3D>;
  private readonly types: TypeLibrary;
  private readonly obstacles: ((box: OBB, except?: string) => boolean) | undefined;

  constructor(options: EarthVehiclesOptions) {
    this.ownsWorld = options.world === undefined;
    // A main-thread render-side world: the dev freeze and finiteness walk on every write cost
    // more than the whole traffic simulation at city scale.
    this.world =
      options.world ?? new World({ tickRate: 60, seed: 'earth-vehicles', devFreeze: false });
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
      contacts: (probes, id) =>
        vehicleObstacleContacts(probes, {
          origin: this.collision.origin,
          octree: this.collision.octree,
          cars: [...this.bodies()]
            .filter(([other]) => other !== id)
            .map(([, transform, vehicle]) => ({ transform, spec: vehicle.spec })),
          aircraft: [...this.world.query(Transform, Aircraft)]
            .filter(([other]) => other !== id)
            .map(([, transform, aircraft]) =>
              vehicleLocalPoint(transform, aircraft.spec.centerOfMass),
            ),
        }),
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
    // The surface groups the terrain tagged as holding parked cars, shown under this root, and
    // their visible batches: walking the whole visible scene for them, five times a second, was
    // up to 28 ms of a frame over a town at High detail.
    for (const group of taggedTerrainObjects('parked-vehicles')) {
      if (!shownUnder(group, this.root)) continue;
      for (const p of (group.userData.vehicles ?? []) as VehiclePlacement[])
        if (!resident.has(p.id)) resident.set(p.id, p);
      group.traverseVisible((object) => {
        if ((object as THREE.Mesh).isMesh && object.userData.vehicleIds)
          batches.push(object as THREE.Mesh);
      });
    }
    // Only cars near the observer become entities: a town's parked cars were thousands of
    // dormant vehicles, spawned as each tile streamed in under an aircraft and stepped every tick.
    const near = (position: readonly number[], radius: number): boolean =>
      observer === undefined ||
      Math.hypot((position[0] ?? 0) - observer[0], (position[2] ?? 0) - observer[2]) <= radius;
    for (const [id, p] of resident)
      if (!this.world.exists(id) && near(p.position, PARKED_ENTITY_RADIUS)) {
        const components = this.types.components(p.kind);
        const vehicle = components.vehicle as unknown as VehicleData;
        vehicle.color = p.color;
        if (components.livery)
          components.livery = tintLivery(
            components.livery as import('@bendyline/molen-schema').LiveryData,
            p.color,
          );
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
            (resident.has(id) || this.retained.has(id)) &&
            id !== this.mountedId &&
            !this.owned.has(id) &&
            distance < (this.active.has(id) ? PARKED_MODEL_FAR : PARKED_MODEL_NEAR),
        )
        .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
        .slice(0, 8);
      this.nearby = new Set(candidates.map(({ id }) => id));
      for (const id of this.openedDoors.keys())
        if (this.entryDistance(id, observer) > this.reach(id) + 1) this.closeOpenedDoor(id);
      for (const [id, controller] of this.loading)
        if (id !== this.mountedId && !this.owned.has(id) && !this.nearby.has(id))
          controller.abort();
      for (const { id, vehicle } of candidates) void this.activate(id, vehicle);
    }
    for (const [id, visual] of this.active) {
      if (
        observer !== undefined &&
        id !== this.mountedId &&
        !this.owned.has(id) &&
        !this.nearby.has(id)
      ) {
        visual.dispose();
        this.active.delete(id);
        // Out of model range, a taken traffic car left where it stopped goes back to traffic.
        if (this.standsInTraffic(id)?.shown) this.remove(id);
      }
    }
    for (const [id] of this.world.query(Vehicle).without(AmbientAgent)) {
      if (this.retained.has(id) || this.loading.has(id)) continue;
      const far =
        resident.has(id) &&
        id !== this.mountedId &&
        !this.owned.has(id) &&
        !near(this.world.get(id, Transform)?.pos ?? [], PARKED_ENTITY_RADIUS * 1.2);
      if (!resident.has(id) || far) this.world.destroy(id);
    }
    // Parent/child LOD overlap and regenerated tiles must never resurrect the car at its bay.
    const visible = new Set<string>();
    for (const mesh of batches) {
      const ids = mesh.userData.vehicleIds as string[];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i] as string;
        const hide = this.active.has(id) || this.retained.has(id) || visible.has(id);
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
    except: string = id,
  ): boolean {
    const box = this.vehicleBox(pos, yaw, spec);
    if (this.intersectsObstacle(box, except)) return false;
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
  /** A traffic car's drivable type: its vehicle and mounts, when the entity library has them. */
  private trafficParts(id: string): { vehicle: VehicleData; mount: MountableData } | undefined {
    const type = (this.world.get(id, AmbientAgent) as TrafficCar | undefined)?.type;
    if (type === undefined) return undefined;
    let parts = this.trafficTypes.get(type);
    if (parts === undefined) {
      const components = this.types.has(type) ? this.types.components(type) : {};
      const vehicle = components.vehicle as unknown as VehicleData | undefined;
      const mount = components.mountable as unknown as MountableData | undefined;
      parts =
        vehicle !== undefined && mount?.seats.some((seat) => seat.role === 'driver')
          ? { vehicle, mount }
          : null;
      this.trafficTypes.set(type, parts);
    }
    return parts ?? undefined;
  }
  /** A stopped traffic car a walker can take over (see {@link promote}), with its drivable type. */
  private boardableTraffic(id: string): { vehicle: VehicleData; mount: MountableData } | undefined {
    const agent = this.world.get(id, AmbientAgent) as TrafficCar | undefined;
    if (
      agent?.kind !== 'car' ||
      agent.hidden === true ||
      !((agent.speed ?? 0) < TRAFFIC_BOARDING_SPEED)
    )
      return undefined;
    for (const promotion of this.promotions.values()) if (promotion.agent === id) return undefined;
    return this.trafficParts(id);
  }
  /** How far `position` is from the closer of a body's driver eye and entry points. */
  private entryDistance(id: string, position: readonly number[]): number {
    const t = this.world.get(id, Transform),
      v = this.data(id) ?? this.trafficParts(id)?.vehicle;
    if (!t || !v) return Infinity;
    const entries = (this.world.get(id, Mountable) ?? this.trafficParts(id)?.mount)?.entries;
    return Math.min(
      ...[v.spec.driverEye, ...(entries ?? [])].map((point) => {
        const entry = vehicleLocalPoint(t, point);
        return Math.hypot(
          entry[0] - (position[0] ?? 0),
          entry[1] - (position[1] ?? 0),
          entry[2] - (position[2] ?? 0),
        );
      }),
    );
  }
  private reach(id: string): number {
    return (this.world.get(id, Mountable) ?? this.trafficParts(id)?.mount)?.reach ?? 3;
  }
  /**
   * The car or boat whose seat or door is nearest a walker at `position`, within its reach. A
   * stopped traffic car counts too: {@link openDoor} and {@link enter} take it over.
   */
  nearest(position: [number, number, number]): string | undefined {
    let best: string | undefined,
      distance = Infinity;
    const consider = (id: string): void => {
      const d = this.entryDistance(id, position);
      if (d < distance && d <= this.reach(id)) {
        best = id;
        distance = d;
      }
    };
    for (const [id] of this.bodies()) consider(id);
    for (const [id, , t] of this.world.query(AmbientAgent, Transform))
      if (
        Math.hypot(t.pos[0] - position[0], t.pos[2] - position[2]) < 10 &&
        this.boardableTraffic(id)
      )
        consider(id);
    return best;
  }
  /**
   * The front door beside a walker at `position` on car `id` while it is shut: the door
   * {@link openDoor} opens. Undefined for boats, a car without that door, or one already open.
   */
  closedDoor(id: string, position: readonly number[]): string | undefined {
    const t = this.world.get(id, Transform),
      actuators = (this.world.get(id, Vehicle) ?? this.trafficParts(id)?.vehicle)?.spec.actuators;
    if (!t || !actuators) return undefined;
    // Models face +z, so their +x is the left: the walker's side of the car names the door.
    const side = new THREE.Vector3(
      (position[0] ?? 0) - t.pos[0],
      (position[1] ?? 0) - t.pos[1],
      (position[2] ?? 0) - t.pos[2],
    ).applyQuaternion(new THREE.Quaternion().fromArray(t.rot).invert()).x;
    const door = side >= 0 ? 'doorFrontLeft' : 'doorFrontRight';
    if (!actuators[door] || this.world.get(id, VehicleInput)?.actuators?.[door]) return undefined;
    return door;
  }
  /**
   * Open the shut front door beside a walker at `position`, on car `id` (default: the nearest in
   * reach), for a host that boards in two steps: open, then {@link enter}. It shuts again behind
   * the driver, or once nobody is within reach. False when there is no shut door to open.
   */
  openDoor(
    position: [number, number, number],
    id: string | undefined = this.nearest(position),
  ): boolean {
    this.message = '';
    if (id === undefined || !this.closedDoor(id, position) || !this.reachable(id, position))
      return false;
    const car = this.boardableTraffic(id) ? this.promote(id) : id;
    const door = car === undefined ? undefined : this.closedDoor(car, position);
    if (car === undefined || door === undefined) return false;
    this.setActuator(car, door, true);
    this.openedDoors.set(car, door);
    return true;
  }
  /**
   * Take a stopped traffic car out of traffic: a drivable car of its type and paint stands at its
   * pose. The agent stays, held by that car's {@link trafficSolids}, until the car's model shows
   * (see `activate`): the street never shows both or neither.
   */
  private promote(agentId: string): string | undefined {
    const agent = this.world.get(agentId, AmbientAgent);
    const t = this.world.get(agentId, Transform);
    const { type, color } = (agent ?? {}) as TrafficCar;
    if (agent === undefined || t === undefined || type === undefined) return undefined;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      new THREE.Quaternion().fromArray(t.rot),
    );
    const id = this.spawn(type, [t.pos[0], t.pos[1], t.pos[2]], Math.atan2(forward.x, forward.z), {
      ...(color !== undefined ? { color } : {}),
      replaces: agentId,
    });
    if (id === undefined) return undefined;
    const renderable = this.world.get(agentId, Renderable);
    this.promotions.set(id, {
      agent: agentId,
      components: {
        ambientAgent: agent,
        transform: t,
        ...(renderable !== undefined ? { renderable } : {}),
      },
      at: [t.pos[0], t.pos[2]],
      shown: false,
    });
    return id;
  }
  /** The drivable car's model shows: the traffic car it stands in for leaves in the same frame. */
  private showPromoted(id: string): void {
    const promotion = this.promotions.get(id);
    if (promotion === undefined || promotion.shown) return;
    promotion.shown = true;
    if (this.world.exists(promotion.agent)) this.world.destroy(promotion.agent);
  }
  /** A promoted car still standing where it was taken (nobody drove it away). */
  private standsInTraffic(id: string): Promotion | undefined {
    const promotion = this.promotions.get(id);
    const t = this.world.get(id, Transform);
    return promotion !== undefined &&
      t !== undefined &&
      Math.hypot(t.pos[0] - (promotion.at[0] ?? 0), t.pos[2] - (promotion.at[1] ?? 0)) < 0.5
      ? promotion
      : undefined;
  }
  /**
   * Circles ambient traffic yields to around the cars a driver has used and left standing (taken
   * traffic, parked cars driven elsewhere): pass them to `EarthAmbient.sync` with the walker, so
   * the cars queued behind a car taken out of traffic keep their gap. The mounted car is already
   * yielded to.
   */
  trafficSolids(): { x: number; z: number; radius: number }[] {
    const solids: { x: number; z: number; radius: number }[] = [];
    for (const id of this.retained) {
      const t = this.world.get(id, Transform),
        spec = this.world.get(id, Vehicle)?.spec;
      if (id === this.mountedId || t === undefined || spec === undefined) continue;
      // A row of circles the car's width, nose to tail: one round the whole car would also stop
      // traffic in the next lane.
      const radius = spec.width / 2;
      const count = Math.max(1, Math.ceil(spec.length / spec.width));
      const along = spec.length / 2 - radius;
      for (let i = 0; i < count; i++) {
        const [x, , z] = vehicleLocalPoint(t, [
          0,
          0,
          count === 1 ? 0 : -along + (2 * along * i) / (count - 1),
        ]);
        solids.push({ x, z, radius });
      }
    }
    return solids;
  }
  private closeOpenedDoor(id: string): void {
    const door = this.openedDoors.get(id);
    if (door === undefined) return;
    this.openedDoors.delete(id);
    if (this.world.exists(id)) this.setActuator(id, door, false);
  }
  private setActuator(id: string, name: string, on: boolean): void {
    const input = this.world.get(id, VehicleInput) ?? IDLE_VEHICLE_INPUT;
    this.world.set(id, VehicleInput, { ...input, actuators: { ...input.actuators, [name]: on } });
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
    if (options.livery !== undefined)
      components.livery = selectLivery(
        components.livery as import('@bendyline/molen-schema').LiveryData | undefined,
        options.livery,
      );
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
    if (!this.canOccupy(position, yaw, vehicle.spec, id, options.replaces)) {
      this.message = 'No room for a car here';
      return undefined;
    }
    if (options.color !== undefined) vehicle.color = options.color;
    if (options.color !== undefined && components.livery)
      components.livery = tintLivery(
        components.livery as import('@bendyline/molen-schema').LiveryData,
        options.color,
      );
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
      ...(options.livery !== undefined ? { livery: options.livery } : {}),
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
    this.closeOpenedDoor(id);
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
    const unmoved = this.standsInTraffic(id);
    const promotion = this.promotions.get(id);
    this.promotions.delete(id);
    this.loading.get(id)?.abort();
    if (this.world.get(PLAYER, Mounted)?.vehicle === id) this.world.remove(PLAYER, Mounted);
    this.active.get(id)?.dispose();
    this.active.delete(id);
    this.retained.delete(id);
    this.spawned.delete(id);
    this.owned.delete(id);
    if (this.world.exists(id)) this.world.destroy(id);
    // A taken traffic car nobody drove away rejoins traffic where it stopped, as the agent it was.
    if (promotion?.shown && unmoved !== undefined && !this.world.exists(promotion.agent)) {
      const { ambientAgent, transform } = promotion.components;
      this.world.spawnRaw(
        {
          ...promotion.components,
          ambientAgent: { ...ambientAgent, speed: 0, state: 'wait', since: this.world.tick },
          transform: { ...transform, teleport: true },
        },
        promotion.agent,
      );
    }
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
    const nearest = this.nearest(position);
    if (!nearest || !this.reachable(nearest, position)) return false;
    const id = this.boardableTraffic(nearest) ? this.promote(nearest) : nearest;
    if (!id) return false;
    this.world.patch(PLAYER, Transform, { pos: [...position] });
    if (!mountEntity(this.world, PLAYER, id)) return false;
    const v = this.data(id);
    if (!v) return false;
    this.closeOpenedDoor(id);
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
  /** Reject interaction through a wall, even when a seat is within reach. */
  private reachable(id: string, position: [number, number, number]): boolean {
    this.collision.update(this.root, position[0], position[2], position[1]);
    const t = this.world.get(id, Transform);
    if (!t) return false;
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
  toggleActuators(presses: Readonly<Record<string, number>>): void {
    const id = this.mountedId;
    const spec = id ? this.world.get(id, Vehicle)?.spec : undefined;
    if (!id || !spec) return;
    const input = this.world.get(id, VehicleInput) ?? IDLE_VEHICLE_INPUT;
    const actuators = { ...input.actuators };
    for (const [name, count] of Object.entries(presses)) {
      if (spec.actuators?.[name] && count % 2 === 1) actuators[name] = !actuators[name];
    }
    this.world.set(id, VehicleInput, { ...input, actuators });
  }
  /** Restore broken parts on the mounted road vehicle once it has stopped. */
  recover(): boolean {
    return this.mountedId !== undefined && repairVehicle(this.world, this.mountedId);
  }
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
      else
        driveVehicle(this.world, PLAYER, {
          ...input,
          actuators: { ...this.world.get(id, VehicleInput)?.actuators, ...input.actuators },
        });
    }
    if (this.ownsWorld) this.step(dt);
    this.render();
  }
  /** Advance the world by `dt` seconds in fixed ticks (the shared world's owner calls this). */
  step(dt: number): void {
    // At most three ticks per frame: below 20 FPS the world runs slow instead of spending each
    // slow frame catching up, which made the next frame slower still.
    this.accumulator = Math.min(
      this.accumulator + Math.min(0.1, Math.max(0, dt)),
      this.world.dt * 3,
    );
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
  /** Restore a named type recipe, clearing any custom instance color. */
  setLivery(id: string, selected: string): void {
    const vehicle = this.data(id);
    const source = vehicle && this.types.components(vehicle.kind).livery;
    // A named preset resets instance tinting, including when reselecting the same preset.
    const data = selectLivery(
      (source as import('@bendyline/molen-schema').LiveryData | undefined) ??
        this.world.get(id, Livery),
      selected,
    );
    this.world.set(id, Livery, data);
    this.active.get(id)?.setLivery(data);
  }

  /** Repaint a car's `paintMaterial` (its `vehicle.color`): the loaded model now, later loads too. */
  setColor(id: string, color: string): void {
    const v = this.data(id);
    if (!v) return;
    if (this.isBoat(id)) this.world.set(id, Boat, { ...v, color } as BoatData);
    else this.world.set(id, Vehicle, { ...v, color } as VehicleData);
    const visual = this.active.get(id);
    const livery = this.world.get(id, Livery);
    if (livery) {
      const tinted = tintLivery(livery, color);
      this.world.set(id, Livery, tinted);
      visual?.setLivery(tinted);
      return;
    }
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
    const now = performance.now();
    if (now - this.lastSettle < 200) return;
    this.lastSettle = now;
    for (const id of this.spawned) {
      if (this.isBoat(id)) continue;
      const t = this.world.get(id, Transform);
      const state = this.world.get(id, VehicleState);
      const spec = this.world.get(id, Vehicle)?.spec;
      if (!t || !state || !spec || Math.abs(state.speed) > 0.2 || !state.grounded) continue;
      // Walking around a parked car must refresh its collision neighborhood too. Otherwise a
      // stale road mesh can keep it floating after terrain refinement until it is driven again.
      this.collision.update(this.root, t.pos[0], t.pos[2], t.pos[1]);
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      const heights = [spec.wheelbase / 2, -spec.wheelbase / 2].flatMap((z) =>
        (spec.cycle ? [0, 0] : [-spec.wheelTrack / 2, spec.wheelTrack / 2]).map((x) =>
          this.support(t.pos[0] + cos * x + sin * z, t.pos[2] - sin * x + cos * z),
        ),
      );
      if (heights.some((height) => height === undefined)) continue;
      const [fl, fr, rl, rr] = heights as [number, number, number, number];
      const support = (fl + fr + rl + rr) / 4;
      const pitch = Math.atan2((rl + rr - fl - fr) / 2, spec.wheelbase);
      const roll = spec.cycle ? 0 : Math.atan2((fr + rr - fl - rl) / 2, spec.wheelTrack);
      if (
        Math.abs(support - t.pos[1]) < 0.001 &&
        Math.abs(pitch - state.pitch) < 0.001 &&
        Math.abs(roll - state.roll) < 0.001
      )
        continue;
      this.world.patch(id, Transform, {
        pos: [t.pos[0], support, t.pos[2]],
        rot: vehicleRotation(
          state.yaw,
          pitch + (state.bodyPitch ?? 0),
          roll + (state.bodyRoll ?? 0),
        ),
      });
      this.world.patch(id, VehicleState, { pitch, roll, vy: 0 });
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
      visual.update(
        state.steer,
        typeof state.wheelAngle === 'number' ? state.wheelAngle : 0,
        {
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
        },
        this.world.tick / this.world.tickRate,
        this.world.get(id, GlassState),
        this.world.get(id, VehicleState),
      );
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
    const v = this.data(id) ?? this.trafficParts(id)?.vehicle;
    return v ? v.spec.label : 'Vehicle';
  }
  /** The spec's name-free label and body style, present only where the type declares them. */
  genericIdentity(id: string): { genericLabel?: string; bodyStyle?: string } {
    const spec = this.data(id)?.spec as { genericLabel?: string; bodyStyle?: string } | undefined;
    return {
      ...(spec?.genericLabel !== undefined ? { genericLabel: spec.genericLabel } : {}),
      ...(spec?.bodyStyle !== undefined ? { bodyStyle: spec.bodyStyle } : {}),
    };
  }
  private async activate(id: string, vehicle: VehicleData | BoatData): Promise<void> {
    if (this.loading.has(id) || this.active.has(id)) return;
    // Explicit boarding/spawning takes priority; background parking never floods the network.
    if (id !== this.mountedId && !this.owned.has(id) && this.loading.size >= 2) return;
    const controller = new AbortController();
    this.loading.set(id, controller);
    try {
      const model = await this.loadModel(vehicle.kind, controller.signal);
      const visual = createVehicleVisual(
        model,
        this.data(id) ?? vehicle,
        this.world.get(id, Livery),
        this.world.get(id, Glass),
      );
      if (
        this.disposed ||
        controller.signal.aborted ||
        !this.world.exists(id) ||
        (!this.retained.has(id) && !this.nearby.has(id))
      ) {
        visual.dispose();
        return;
      }
      this.object.add(visual.object);
      this.active.set(id, visual);
      this.showPromoted(id);
      this.lastSync = -Infinity;
      this.sync(performance.now());
      this.render();
    } catch (error) {
      if (controller.signal.aborted) return;
      this.message = `Vehicle model could not load: ${String(error)}`;
      console.error(this.message);
      // A taken traffic car stays traffic rather than become an invisible double.
      if (this.promotions.get(id)?.shown === false && id !== this.mountedId) this.remove(id);
    } finally {
      this.loading.delete(id);
    }
  }
  dispose(): void {
    this.disposed = true;
    for (const controller of this.loading.values()) controller.abort();
    for (const v of this.active.values()) v.dispose();
    this.active.clear();
    this.object.removeFromParent();
    this.collision.clear();
  }
}
