// Flyable aircraft for an Earth view: entity types with an `aircraft` component (the entities pack
// ships a P-51D and an OH-6) spawned into the vehicles' ECS world, flown by the kernel's assisted
// flight model against streamed terrain, resident buildings, cars and each other, and drawn from
// their authored GLBs. Hosts spawn one where they like — on the ground, or already flying at a
// chosen speed — board it, and read a status for their HUD.

import { readModelSignals } from '@bendyline/molen-client';
import {
  type AircraftCameraPose,
  type AircraftVisual,
  aircraftCameraPose,
  createAircraftVisual,
} from '@bendyline/molen-client/aircraft';
import { WalkCollision } from '@bendyline/molen-client/navigation';
import {
  Aircraft,
  AircraftInput,
  AircraftState,
  flyAircraft,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  installAircraft,
} from '@bendyline/molen-kernel/aircraft';
import type { TypeLibrary } from '@bendyline/molen-kernel/content';
import {
  Mounted,
  mountEntity,
  unmountEntity,
  Vehicle,
  type VehicleEnvironment,
  vehicleLocalPoint,
  vehicleRotation,
} from '@bendyline/molen-kernel/vehicles';
import { Transform, type TransformData, type World } from '@bendyline/molen-kernel/world';
import type {
  AircraftData,
  AircraftInputData,
  AircraftSpec,
  AircraftStateData,
  VehicleSpec,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';

/** The actor that boards vehicles; shared with {@link EarthVehicles}. */
const PLAYER = 'world-player';
/** Throttle/collective travel per second at full lever input. */
const POWER_RATE = 0.22;

export interface EarthAircraftOptions {
  /** The vehicles' ECS world, so cars and aircraft share one pilot, seat follower and tick. */
  world: World;
  /** Scene parent for aircraft models (the streamed terrain root). */
  root: THREE.Object3D;
  /** Terrain height at world X/Z, or undefined while it is still streaming. */
  sampleHeight: (x: number, z: number) => number | undefined;
  /** Load an aircraft model by entity type id, e.g. from the entities content pack. */
  loadModel: (id: string) => Promise<THREE.Object3D>;
  /** Entity types: aircraft specs, cockpit, seats and sounds. */
  types: TypeLibrary;
  /** Unmounting and exits: the vehicles' environment (support height and exit checks). */
  vehicleEnvironment: VehicleEnvironment;
}

/** Where and how a new aircraft appears. */
export interface EarthAircraftPlacement {
  /** World position of the landing-contact origin. */
  position: [number, number, number];
  /** Compass heading of the nose, radians (0 north, PI/2 east). */
  heading: number;
  /**
   * Start flying: engine running, gear up, at `speed` m/s (default 70 for airplanes, 12 for
   * helicopters) with `power` 0..1 set (default 0.72 airplane, 0.56 helicopter). Omit to start
   * parked with the engine off.
   */
  airborne?: { speed?: number; power?: number };
}

/** A mounted aircraft as a HUD sees it. SI units; angles in radians. */
export interface EarthFlightStatus {
  id: string;
  type: string;
  label: string;
  model: 'airplane' | 'helicopter';
  /** Air-relative speed, m/s. */
  airspeed: number;
  /** Height of the landing contact above sea level, meters. */
  altitude: number;
  altitudeAGL: number;
  /** m/s, climbing positive. */
  verticalSpeed: number;
  /** Compass heading of the nose (0 north, PI/2 east). */
  heading: number;
  pitch: number;
  roll: number;
  /** Throttle (airplane) or collective (helicopter), 0..1. */
  power: number;
  engine: boolean;
  /** Maximum engine RPM, 0..1. */
  rpm: number;
  gearDown: boolean;
  flaps: boolean;
  stalled: boolean;
  grounded: boolean;
  crashed: boolean;
  waitingForTerrain: boolean;
  view: 'cockpit' | 'chase';
}

/** One frame of pilot intent. Axes are -1..1; switches are presses since the last frame. */
export interface EarthPilotControls {
  /** Nose up positive. */
  pitch: number;
  /** Right bank positive. */
  roll: number;
  /** Right rudder/pedal positive. */
  yaw: number;
  /** Throttle or collective lever movement (more power positive). */
  throttle: number;
  brake: boolean;
  engine?: number;
  gear?: number;
  flaps?: number;
}

/** A compass heading as the kernel's vehicle yaw (+Z south is yaw 0 in the Earth frame). */
function headingToYaw(heading: number): number {
  return Math.PI - heading;
}

/**
 * Flyable aircraft in an Earth view. Share the {@link EarthVehicles} world so the pilot can move
 * between cars and aircraft, and step that world once per frame after {@link input}.
 */
export class EarthAircraft {
  readonly object: THREE.Group = new THREE.Group();
  /** Cockpit or chase camera for the mounted aircraft. */
  view: 'cockpit' | 'chase' = 'chase';
  lookYaw: number = 0;
  lookPitch: number = 0;
  /** A short explanation when boarding or leaving did not work. */
  message: string = '';
  private readonly world: World;
  private readonly root: THREE.Object3D;
  private readonly sampleHeight: (x: number, z: number) => number | undefined;
  private readonly loadModel: (id: string) => Promise<THREE.Object3D>;
  private readonly types: TypeLibrary;
  private readonly vehicleEnvironment: VehicleEnvironment;
  private readonly visuals = new Map<string, AircraftVisual>();
  private readonly spawned = new Set<string>();
  private controls: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT };
  private sequence = 0;
  private disposed = false;
  // An airframe moves tens of meters a second: a wide neighborhood rebuilt every 24 m, bounded
  // vertically so the ground far below never enters the tree, rescanned at 5 Hz.
  private readonly collision = new WalkCollision({
    ignoreVehicles: true,
    radius: 48,
    rebuildDistance: 24,
    verticalRadius: 40,
    rescanIntervalMs: 200,
  });

  /** Entity type ids with an `aircraft` component, e.g. `molen.entities.aircraft.p51d`. */
  static typeIds(types: TypeLibrary): string[] {
    return types.idsWith('aircraft').filter((id) => types.components(id).mountable !== undefined);
  }

  constructor(options: EarthAircraftOptions) {
    this.world = options.world;
    this.root = options.root;
    this.sampleHeight = options.sampleHeight;
    this.loadModel = options.loadModel;
    this.types = options.types;
    this.vehicleEnvironment = options.vehicleEnvironment;
    this.object.name = 'earth:aircraft';
    this.root.add(this.object);
    installAircraft(this.world, {
      groundHeight: (x, z) => this.sampleHeight(x, z),
      canOccupy: (t, spec, id) => this.canOccupy(t, spec, id),
    });
  }

  /** The aircraft the pilot is in, if any. */
  get mountedId(): string | undefined {
    const id = this.world.get(PLAYER, Mounted)?.vehicle;
    return id !== undefined && this.world.has(id, Aircraft) ? id : undefined;
  }

  /** World position of the mounted aircraft's landing-contact origin. */
  get position(): [number, number, number] | undefined {
    const id = this.mountedId;
    const pos = id !== undefined ? this.world.get(id, Transform)?.pos : undefined;
    return pos === undefined ? undefined : [...pos];
  }

  /** Whether any aircraft overlaps `box` (other than `except`): an obstacle for cars. */
  blocks(box: OBB, except?: string): boolean {
    for (const [id, t, aircraft] of this.world.query(Transform, Aircraft)) {
      if (id === except) continue;
      const spec = aircraft.spec;
      const q = new THREE.Quaternion().fromArray(t.rot);
      const center = new THREE.Vector3(0, spec.height / 2, 0)
        .applyQuaternion(q)
        .add(new THREE.Vector3().fromArray(t.pos));
      const bounds = new OBB(
        center,
        new THREE.Vector3(spec.span / 2, spec.height / 2, spec.length / 2),
        new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)),
      );
      if (box.intersectsOBB(bounds)) return true;
    }
    return false;
  }

  /** Add an aircraft of `typeId`; its model loads in the background. Returns its entity id. */
  spawn(typeId: string, placement: EarthAircraftPlacement): string {
    const data = this.types.component<AircraftData>(typeId, 'aircraft');
    const id = `earth-aircraft-${++this.sequence}`;
    const yaw = headingToYaw(placement.heading);
    const components = this.types.components(typeId);
    components.transform = {
      pos: [...placement.position],
      rot: vehicleRotation(yaw, 0, 0),
    };
    components.aircraftState = initialAircraftState(yaw);
    components.aircraftInput = { ...IDLE_AIRCRAFT_INPUT };
    this.world.spawnRaw(components, id);
    this.spawned.add(id);
    if (placement.airborne !== undefined) this.launch(id, data.spec, yaw, placement.airborne);
    void this.loadModel(typeId)
      .then((model) => {
        if (this.disposed || !this.world.exists(id)) return;
        const visual = createAircraftVisual(model, data.spec);
        this.visuals.set(id, visual);
        this.object.add(visual.object);
        this.render();
      })
      .catch((error: unknown) => {
        // The flight model runs regardless; only the picture is missing.
        this.message = `Aircraft model could not load: ${String(error)}`;
      });
    return id;
  }

  /** Put the pilot in `id`'s seat, wherever the pilot is. False when it is occupied. */
  board(id: string): boolean {
    const t = this.world.get(id, Transform);
    const aircraft = this.world.get(id, Aircraft);
    if (!t || !aircraft) return false;
    // Seat first (mounting needs a stopped aircraft within reach), then restore its motion.
    const state = this.world.get(id, AircraftState);
    const input = this.world.get(id, AircraftInput);
    if (state !== undefined) this.world.set(id, AircraftState, initialAircraftState(state.yaw));
    this.world.patch(PLAYER, Transform, { pos: vehicleLocalPoint(t, aircraft.spec.pilotEye) });
    const mounted = mountEntity(this.world, PLAYER, id);
    if (state !== undefined) this.world.set(id, AircraftState, state);
    if (!mounted) {
      this.message = 'That aircraft is taken';
      return false;
    }
    if (input !== undefined) this.world.set(id, AircraftInput, input);
    this.controls = { ...(input ?? IDLE_AIRCRAFT_INPUT) };
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.message = '';
    return true;
  }

  /** Leave the mounted aircraft by the normal rules: landed, stopped and shut down. */
  exit(): [number, number, number] | undefined {
    const id = this.mountedId;
    if (id === undefined) return undefined;
    const t = this.world.get(id, Transform);
    if (t) this.collision.update(this.root, t.pos[0], t.pos[2], t.pos[1]);
    if (!unmountEntity(this.world, PLAYER, this.vehicleEnvironment)) {
      this.message = 'Land, stop, and shut down (I) before leaving';
      return undefined;
    }
    this.controls = { ...IDLE_AIRCRAFT_INPUT };
    return this.world.get(PLAYER, Transform)?.pos;
  }

  /**
   * Leave at once, wherever the aircraft is, and remove it if it was spawned here. Returns the
   * point on the ground beneath it (undefined while that ground is unknown).
   */
  release(): [number, number, number] | undefined {
    const id = this.mountedId;
    if (id === undefined) return undefined;
    const t = this.world.get(id, Transform);
    this.world.remove(PLAYER, Mounted);
    this.world.emit('vehicle-unmounted', { actor: PLAYER, vehicle: id });
    this.controls = { ...IDLE_AIRCRAFT_INPUT };
    if (this.spawned.has(id)) this.remove(id);
    if (!t) return undefined;
    const ground = this.sampleHeight(t.pos[0], t.pos[2]);
    return ground === undefined ? undefined : [t.pos[0], ground, t.pos[2]];
  }

  /** Remove an aircraft and its model. */
  remove(id: string): void {
    if (this.world.get(PLAYER, Mounted)?.vehicle === id) this.world.remove(PLAYER, Mounted);
    this.visuals.get(id)?.dispose();
    this.visuals.delete(id);
    this.spawned.delete(id);
    if (this.world.exists(id)) this.world.destroy(id);
  }

  /**
   * After an impact, put the mounted aircraft back in the air above where it came down (or on the
   * ground, when it was parked) with the engine running. False when there is nothing to recover.
   */
  recover(): boolean {
    const id = this.mountedId;
    const t = id !== undefined ? this.world.get(id, Transform) : undefined;
    const aircraft = id !== undefined ? this.world.get(id, Aircraft) : undefined;
    const state = id !== undefined ? this.world.get(id, AircraftState) : undefined;
    if (id === undefined || !t || !aircraft || !state?.crashed) return false;
    const ground = this.sampleHeight(t.pos[0], t.pos[2]) ?? t.pos[1];
    this.world.set(id, Transform, {
      pos: [t.pos[0], ground + 300, t.pos[2]],
      rot: vehicleRotation(state.yaw, 0, 0),
    });
    this.launch(id, aircraft.spec, state.yaw, {});
    this.controls = { ...(this.world.get(id, AircraftInput) ?? IDLE_AIRCRAFT_INPUT) };
    this.message = '';
    return true;
  }

  /** Apply one frame of pilot intent to the mounted aircraft (before the world steps). */
  input(dt: number, controls: EarthPilotControls): void {
    const id = this.mountedId;
    if (id === undefined) return;
    const t = this.world.get(id, Transform);
    if (t) this.collision.update(this.root, t.pos[0], t.pos[2], t.pos[1]);
    const state = this.world.get(id, AircraftState);
    const next = { ...this.controls };
    if ((controls.engine ?? 0) % 2 === 1) next.engine = !next.engine;
    // Gear only moves in the air; flaps anywhere.
    if ((controls.gear ?? 0) % 2 === 1 && state !== undefined && !state.grounded)
      next.gear = !next.gear;
    if ((controls.flaps ?? 0) % 2 === 1) next.flaps = !next.flaps;
    next.power = Math.max(
      0,
      Math.min(1, next.power + Math.min(dt, 0.1) * POWER_RATE * controls.throttle),
    );
    next.pitch = controls.pitch;
    next.roll = controls.roll;
    next.yaw = controls.yaw;
    next.brake = controls.brake;
    this.controls = next;
    flyAircraft(this.world, PLAYER, next);
  }

  /** Set the throttle/collective directly, 0..1 (e.g. from an on-screen lever). */
  setPower(power: number): void {
    this.controls = { ...this.controls, power: Math.max(0, Math.min(1, power)) };
  }

  /** Move models to their simulated poses and animate controls, gear and propellers. */
  render(): void {
    for (const [id, visual] of this.visuals) {
      const t = this.world.get(id, Transform);
      const state = this.world.get(id, AircraftState);
      const input = this.world.get(id, AircraftInput);
      if (!t || !state || !input) continue;
      visual.object.position.fromArray(t.pos);
      visual.object.quaternion.fromArray(t.rot);
      visual.update(
        state,
        input,
        t.pos[1],
        readModelSignals(this.world.get(id, Aircraft)?.spec.visual.interior?.sources, (name) =>
          this.world.get(id, { name }),
        ),
      );
    }
  }

  /** The cockpit or chase camera for the mounted aircraft, pulled in front of walls. */
  cameraPose(): AircraftCameraPose | undefined {
    const id = this.mountedId;
    const t = id !== undefined ? this.world.get(id, Transform) : undefined;
    const aircraft = id !== undefined ? this.world.get(id, Aircraft) : undefined;
    if (!t || !aircraft) return undefined;
    return aircraftCameraPose(t, aircraft.spec, {
      view: this.view,
      lookYaw: this.lookYaw,
      lookPitch: this.lookPitch,
      obstructionDistance: (from, to) => {
        const a = new THREE.Vector3().fromArray(from).sub(this.collision.origin);
        const b = new THREE.Vector3().fromArray(to).sub(this.collision.origin);
        const hit = this.collision.octree.rayIntersect(new THREE.Ray(a, b.sub(a).normalize()));
        return hit ? hit.distance : undefined;
      },
    });
  }

  /** The mounted aircraft's state for a HUD, or undefined when not flying. */
  status(): EarthFlightStatus | undefined {
    const id = this.mountedId;
    if (id === undefined) return undefined;
    const t = this.world.get(id, Transform);
    const aircraft = this.world.get(id, Aircraft);
    const state = this.world.get(id, AircraftState);
    if (!t || !aircraft || !state) return undefined;
    return {
      id,
      type: aircraft.kind,
      label: aircraft.spec.label,
      model: aircraft.spec.model,
      airspeed: state.airspeed,
      altitude: t.pos[1],
      altitudeAGL: state.altitudeAGL,
      verticalSpeed: state.verticalSpeed,
      heading: (((Math.PI - state.yaw) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
      pitch: state.pitch,
      roll: state.roll,
      power: this.controls.power,
      engine: this.controls.engine,
      rpm: state.rpm,
      gearDown: this.controls.gear,
      flaps: this.controls.flaps,
      stalled: state.stalled,
      grounded: state.grounded,
      crashed: state.crashed,
      waitingForTerrain: state.waitingForTerrain,
      view: this.view,
    };
  }

  /** Give a (stopped, seated) aircraft flight speed with the engine running and gear up. */
  private launch(
    id: string,
    spec: AircraftSpec,
    yaw: number,
    airborne: NonNullable<EarthAircraftPlacement['airborne']>,
  ): void {
    const airplane = spec.model === 'airplane';
    const speed = airborne.speed ?? (airplane ? 70 : 12);
    const t = this.world.get(id, Transform);
    const ground = t ? this.sampleHeight(t.pos[0], t.pos[2]) : undefined;
    const state: AircraftStateData = {
      ...initialAircraftState(yaw),
      velocity: [Math.sin(yaw) * speed, 0, Math.cos(yaw) * speed],
      airspeed: speed,
      // A few degrees of nose-up trim holds level flight at cruise; helicopters hover level.
      pitch: airplane ? 0.04 : 0,
      rpm: 1,
      grounded: false,
      altitudeAGL: t !== undefined && ground !== undefined ? t.pos[1] - ground : 0,
    };
    if (t) this.world.set(id, Transform, { ...t, rot: vehicleRotation(yaw, -state.pitch, 0) });
    this.world.set(id, AircraftState, state);
    this.world.set(id, AircraftInput, {
      ...IDLE_AIRCRAFT_INPUT,
      power: airborne.power ?? (airplane ? 0.72 : 0.56),
      engine: true,
      gear: !airplane,
      brake: false,
    });
  }

  private canOccupy(t: TransformData, spec: AircraftSpec, id: string): boolean {
    let probeReach = 0;
    for (const offset of spec.collisionProbes)
      probeReach = Math.max(probeReach, Math.hypot(offset[0], offset[1], offset[2]));
    // Cars near enough to touch this airframe this step, gathered once instead of per probe.
    const nearbyCars: Array<{ transform: TransformData; spec: VehicleSpec }> = [];
    for (const [, carT, car] of this.world.query(Transform, Vehicle)) {
      if (Math.hypot(carT.pos[0] - t.pos[0], carT.pos[2] - t.pos[2]) > probeReach + 5) continue;
      nearbyCars.push({ transform: carT, spec: car.spec });
    }
    const others: Array<[number, number, number]> = [];
    for (const [other, otherT] of this.world.query(Transform, Aircraft))
      if (other !== id) others.push([otherT.pos[0], otherT.pos[1] + 1.2, otherT.pos[2]]);
    for (const offset of spec.collisionProbes) {
      const point = vehicleLocalPoint(t, offset);
      const sphere = new THREE.Sphere(
        new THREE.Vector3().fromArray(point).sub(this.collision.origin),
        0.3,
      );
      if (this.collision.octree.sphereIntersect(sphere)) return false;
      for (const { transform: carT, spec: carSpec } of nearbyCars) {
        if (Math.hypot(carT.pos[0] - point[0], carT.pos[2] - point[2]) > 5) continue;
        const localPoint = new THREE.Vector3()
          .fromArray(point)
          .sub(new THREE.Vector3().fromArray(carT.pos))
          .applyQuaternion(new THREE.Quaternion().fromArray(carT.rot).invert());
        const bounds = new THREE.Box3(
          new THREE.Vector3(-carSpec.width / 2, 0, -carSpec.length / 2),
          new THREE.Vector3(carSpec.width / 2, carSpec.height, carSpec.length / 2),
        );
        if (bounds.intersectsSphere(new THREE.Sphere(localPoint, 0.3))) return false;
      }
      for (const other of others)
        if (Math.hypot(point[0] - other[0], point[1] - other[1], point[2] - other[2]) < 1.5)
          return false;
    }
    return true;
  }

  dispose(): void {
    this.disposed = true;
    for (const id of [...this.spawned]) this.remove(id);
    for (const visual of this.visuals.values()) visual.dispose();
    this.visuals.clear();
    this.object.removeFromParent();
    this.collision.clear();
  }
}
