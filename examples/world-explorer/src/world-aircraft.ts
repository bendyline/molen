import { readModelSignals } from '@bendyline/molen-client';
import {
  type AircraftCameraPose,
  type AircraftCockpitSession,
  AircraftPointerAxes,
  type AircraftVisual,
  aircraftCameraPose,
  aircraftObstacleContacts,
  applyAircraftControl,
  createAircraftVisual,
} from '@bendyline/molen-client/aircraft';
import { type NavigationInput, WalkCollision } from '@bendyline/molen-client/navigation';
import {
  Aircraft,
  type AircraftCollisionProbe,
  type AircraftContact,
  AircraftInput,
  AircraftState,
  flyAircraft,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  installAircraft,
} from '@bendyline/molen-kernel/aircraft';
import type { TypeLibrary } from '@bendyline/molen-kernel/content';
import { Mounted, mountEntity, Vehicle, vehicleLocalPoint } from '@bendyline/molen-kernel/vehicles';
import { Transform, type TransformData, type World } from '@bendyline/molen-kernel/world';
import type {
  AircraftData,
  AircraftInputData,
  AircraftStateData,
  ComponentMap,
  VehicleSpec,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AircraftInstrumentSource } from './aircraft-instrument-views';
import type { AirportStart } from './airport-start.js';
import { FlybyCamera } from './flyby-camera.js';
import type { EjectionSeat } from './world-parachute.js';

const PLAYER = 'world-player';
/** Speed (m/s), about a jog, above which a wreck is ejected from rather than climbed out of. */
const WRECK_EXIT_SPEED = 5;
/** Speed (m/s) of the pilot's own aircraft above which parked aircraft keep their cockpits hidden. */
const CABIN_PASS_SPEED = 15;
const FAR_AWAY = [Infinity, Infinity, Infinity] as const;
/** Height (m) above the ground beyond which no car can touch an airframe's collision probes. */
const CAR_CLEARANCE = 8;
type AircraftChoice = string;
const KINDS: AircraftChoice[] = ['p51d', 'oh6', 'airliner'];
const entityId = (kind: AircraftChoice): string => `molen.entities.aircraft.${kind}`;
const choiceForId = (id: string): AircraftChoice | undefined =>
  id.startsWith('molen.entities.aircraft.')
    ? id.slice('molen.entities.aircraft.'.length)
    : undefined;
/**
 * Smallest part (bounding radius, meters) that still casts a shadow. Cockpit digits, louvers and
 * fittings cast a few shadow texels at most, yet each was a draw in every shadow pass: at the
 * airfield the aircraft's shadow draws outnumbered everything else in view, about 400 a frame.
 */
const MIN_SHADOW_CASTER_RADIUS = 0.15;
function dropTinyShadowCasters(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.castShadow) return;
    if (mesh.geometry.boundingSphere === null) mesh.geometry.computeBoundingSphere();
    const radius =
      (mesh.geometry.boundingSphere?.radius ?? 0) * mesh.matrixWorld.getMaxScaleOnAxis();
    if (radius < MIN_SHADOW_CASTER_RADIUS) mesh.castShadow = false;
  });
}
/**
 * Leave a hidden part out of the scene's per-frame world-matrix walk: three walks hidden objects
 * too, and a parked aircraft's hidden cockpit was hundreds of parts recomposed every frame. A
 * move while hidden is applied when the part shows again.
 */
function skipWhenHidden(object: THREE.Object3D): void {
  object.updateMatrixWorld = function (this: THREE.Object3D, force?: boolean): void {
    if (!this.visible) {
      if (force === true) this.matrixWorldNeedsUpdate = true;
      return;
    }
    THREE.Object3D.prototype.updateMatrixWorld.call(this, force);
  };
}
export const AIRCRAFT_HELP: string =
  'I engine · =/− power · W/S pitch · A/D bank · Z/C pedals · Space brakes · G gear · F flaps · B speed brake · H hook · O canopy · J nozzle/nacelles · V view · F5 flyby · E exit (in flight, eject) · R recover after impact';

/** Whether `box` overlaps any parked or flying aircraft other than `except`: an obstacle for cars. */
export function aircraftBlocks(world: World, box: OBB, except?: string): boolean {
  for (const [id, t, aircraft] of world.query(Transform, Aircraft)) {
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

/** Persistent aircraft on real airport pavement, or the explicit synthetic practice field. */
export class WorldAircraft {
  readonly object: THREE.Group = new THREE.Group();
  readonly center: [number, number];
  ready = false;
  message = '';
  private elevation: number | undefined;
  private visuals = new Map<AircraftChoice, AircraftVisual>();
  private loading = false;
  private disposed = false;
  private requested: AircraftChoice | undefined;
  private readonly requests = new Map<AircraftChoice, Promise<void>>();
  private readonly apron = new Map<
    string,
    { type: string; position: [number, number, number]; yaw: number }
  >();
  private extraLoading: Promise<void> | undefined;
  // An airframe moves tens of meters a second: a wider neighborhood rebuilt every 24 m, bounded
  // vertically so the ground far below never enters the tree, and rescanned at 5 Hz while hovering.
  // Plants collide as their instances' boxes: a forest's leaves made each rebuild a long frame.
  private collision = new WalkCollision({
    ignoreVehicles: true,
    radius: 48,
    rebuildDistance: 24,
    verticalRadius: 40,
    rescanIntervalMs: 200,
    instanceBounds: true,
  });
  private inputs: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT };
  private readonly aircraftTypes = new Map<string, AircraftData>();
  private readonly componentTypes = new Map<string, ComponentMap>();
  private carsTick = -1;
  private carCache: Array<{ transform: TransformData; spec: VehicleSpec }> = [];
  private readonly pointerAxes = new AircraftPointerAxes();
  private readonly flyby = new FlybyCamera();
  private cockpitBrake = false;
  /** The aircraft last ejected from, flying on without a pilot until it comes to rest. */
  private abandoned: AircraftChoice | undefined;
  instrumentSource(): AircraftInstrumentSource | undefined {
    const kind = this.mountedKind;
    const visual = kind ? this.visuals.get(kind) : undefined;
    return kind && visual
      ? { model: visual.object, spec: this.aircraftData(this.typeId(kind)).spec }
      : undefined;
  }
  cockpitSession(): AircraftCockpitSession | undefined {
    const kind = this.mountedKind;
    const visual = kind ? this.visuals.get(kind) : undefined;
    if (!kind || !visual) return undefined;
    const spec = this.aircraftData(this.typeId(kind)).spec;
    return {
      id: kind,
      cockpit: visual.cockpit,
      spec,
      input: this.inputs,
      state: this.state,
      change: (change) => {
        if (this.mountedKind !== kind) return;
        const next = applyAircraftControl(this.inputs, change, spec, this.state);
        if (next === this.inputs) return;
        this.pointerAxes.set(change);
        if (change.control.action === 'brake') this.cockpitBrake = next.brake;
        this.inputs = next;
        flyAircraft(this.world, PLAYER, next);
      },
      release: () => {
        this.pointerAxes.clear();
      },
    };
  }
  constructor(
    readonly world: World,
    private readonly root: THREE.Object3D,
    private readonly terrainHeight: (x: number, z: number, y?: number) => number | undefined,
    initial: [number, number, number],
    /** Load an aircraft's model by entity type id, e.g. from the entities content pack. */
    private readonly loadModel: (id: string) => Promise<THREE.Object3D>,
    /** Entity types: aircraft specs, cockpit and spawn components. */
    private readonly types: TypeLibrary,
    /** Shader warm-up (`renderer.prepareObject`): a model joins the scene once it resolves. */
    private readonly prepare?: (object: THREE.Object3D) => Promise<void>,
    private readonly airfield?: AirportStart | 'practice',
    private readonly canPlace?: () => boolean,
  ) {
    this.center =
      airfield && airfield !== 'practice' ? [...airfield.position] : [initial[0] + 500, initial[2]];
    this.object.name = 'world:airfield';
    root.add(this.object);
    installAircraft(world, {
      groundHeight: (x, z, y) => this.groundHeight(x, z, y),
      contacts: (probes, id) => this.contacts(probes, id),
    });
  }
  /** Read-only: callers that change a component map take a fresh one from the library. */
  private typeComponents(id: string): ComponentMap {
    const cached = this.componentTypes.get(id);
    if (cached !== undefined) return cached;
    const components = this.types.components(id);
    this.componentTypes.set(id, components);
    return components;
  }
  private aircraftData(id: string): AircraftData {
    // The library clones a component on every read; specs are asked for several times a frame.
    let data = this.aircraftTypes.get(id);
    if (data === undefined) {
      data = this.types.component<AircraftData>(id, 'aircraft');
      this.aircraftTypes.set(id, data);
    }
    return data;
  }
  private typeId(kind: string): string {
    return this.apron.get(kind)?.type ?? entityId(kind);
  }
  label(kind: string): string {
    return this.aircraftData(this.typeId(kind)).spec.label;
  }
  get apronCount(): number {
    return [...this.apron.keys()].filter((id) => this.visuals.has(id)).length;
  }
  get apronPending(): number {
    return this.apron.size - this.apronCount;
  }
  /** An individual, boardable aircraft on real airport pavement; no practice runway is created. */
  async spawnApron(
    kind: string,
    type: string,
    x: number,
    z: number,
    heading: number,
  ): Promise<boolean> {
    const height = this.terrainHeight(x, z);
    if (height === undefined || this.disposed) return false;
    if (this.apron.has(kind)) return true;
    const yaw = Math.PI - heading;
    const placement = { type, position: [x, height, z] as [number, number, number], yaw };
    this.apron.set(kind, placement);
    let visual: AircraftVisual | undefined;
    try {
      const model = await this.loadModel(type);
      visual = createAircraftVisual(model, this.aircraftData(type).spec);
      dropTinyShadowCasters(visual.object);
      visual.object.traverse(skipWhenHidden);
      visual.updateView(FAR_AWAY);
      // A visitor may be waiting beside this stand. Background-only admission can starve
      // indefinitely while terrain streams on a slow renderer; population already loads one
      // aircraft at a time, so use the normal lane like an explicitly selected aircraft.
      await this.prepare?.(visual.object);
      if (this.disposed || this.apron.get(kind) !== placement) {
        visual.dispose();
        return false;
      }
      const components = this.types.components(type);
      placement.position[1] = this.terrainHeight(x, z) ?? placement.position[1];
      components.transform = {
        pos: [...placement.position],
        rot: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      };
      components.aircraftState = initialAircraftState(yaw);
      components.aircraftInput = { ...IDLE_AIRCRAFT_INPUT };
      this.world.spawnRaw(components, `aircraft-${kind}`);
      this.visuals.set(kind, visual);
      this.object.add(visual.object);
      this.render();
      return true;
    } catch (error) {
      visual?.dispose();
      this.apron.delete(kind);
      throw error;
    }
  }
  removeApron(kind: string): void {
    if (kind === this.mountedKind) return;
    this.apron.delete(kind);
    this.visuals.get(kind)?.dispose();
    this.visuals.delete(kind);
    if (this.world.exists(`aircraft-${kind}`)) this.world.destroy(`aircraft-${kind}`);
  }
  apronPose(
    kind: string,
  ): { position: [number, number, number]; occupied: boolean; speed: number } | undefined {
    const id = `aircraft-${kind}`;
    const transform = this.world.get(id, Transform);
    if (!transform) return undefined;
    return {
      position: [...transform.pos],
      occupied: this.mountedKind === kind,
      speed: Math.hypot(...(this.world.get(id, AircraftState)?.velocity ?? [0, 0, 0])),
    };
  }
  get choices(): { kind: string; label: string }[] {
    return this.types
      .idsWith('aircraft')
      .filter((id) => choiceForId(id) !== undefined)
      .map((id) => ({ kind: choiceForId(id) as string, label: this.aircraftData(id).spec.label }));
  }
  has(kind: AircraftChoice): boolean {
    return this.visuals.has(kind);
  }
  private isPracticeAircraft(kind: string): boolean {
    return this.airfield === 'practice' && KINDS.includes(kind);
  }
  private spawnYaw(kind: string): number {
    return (
      this.apron.get(kind)?.yaw ??
      (this.airfield && this.airfield !== 'practice' ? this.airfield.yaw : 0)
    );
  }
  /** Real airports load one selected aircraft; the synthetic demo keeps its original lineup. */
  async request(kind: AircraftChoice): Promise<void> {
    if (!this.choices.some((choice) => choice.kind === kind))
      throw new Error(`Unknown aircraft ${kind}`);
    if (!this.airfield) throw new Error('This terrain package has no starting airport');
    this.requested = kind;
    this.ready = this.ready && (this.canPlace?.() ?? true);
    if (this.ready) await this.loadChoice(kind);
  }
  private loadChoice(kind: AircraftChoice): Promise<void> {
    if (this.visuals.has(kind)) return Promise.resolve();
    const existing = this.requests.get(kind);
    if (existing) return existing;
    if (!this.isPracticeAircraft(kind) && this.extraLoading) {
      return this.extraLoading
        .catch(() => {})
        .then(() => {
          if (!this.disposed && this.requested === kind) return this.loadChoice(kind);
        });
    }
    const request = (async () => {
      const model = await this.loadModel(this.typeId(kind));
      const visual = createAircraftVisual(model, this.aircraftData(this.typeId(kind)).spec);
      dropTinyShadowCasters(visual.object);
      visual.object.traverse(skipWhenHidden);
      // Drawn before its shaders were built, each aircraft at the airfield built them in a frame.
      // The practice aircraft load with the world and nobody waits on them: in the normal lane
      // their ~200 shader, texture and buffer jobs held terrain and buildings back, by most of a
      // minute on a software renderer's few frames a second. One the pilot picks stays normal.
      if (this.isPracticeAircraft(kind)) visual.object.userData.admissionPriority = 'background';
      try {
        await this.prepare?.(visual.object);
      } finally {
        delete visual.object.userData.admissionPriority;
      }
      if (this.disposed || (!this.isPracticeAircraft(kind) && this.requested !== kind)) {
        visual.dispose();
        return;
      }
      for (const [previous, oldVisual] of this.visuals) {
        if (
          this.apron.has(previous) ||
          this.isPracticeAircraft(previous) ||
          previous === this.mountedKind ||
          this.isPracticeAircraft(kind)
        )
          continue;
        oldVisual.dispose();
        this.visuals.delete(previous);
        if (this.world.exists(`aircraft-${previous}`)) this.world.destroy(`aircraft-${previous}`);
      }
      this.visuals.set(kind, visual);
      this.object.add(visual.object);
      const components = this.types.components(this.typeId(kind));
      const yaw = this.spawnYaw(kind);
      components.transform = {
        pos: this.spawnPosition(kind),
        rot: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      };
      components.aircraftState = {
        ...initialAircraftState(yaw),
        ...(components.aircraftState as AircraftStateData),
        yaw,
      };
      this.world.spawnRaw(components, `aircraft-${kind}`);
      this.render();
    })().finally(() => {
      this.requests.delete(kind);
      if (this.extraLoading === request) this.extraLoading = undefined;
    });
    this.requests.set(kind, request);
    if (!this.isPracticeAircraft(kind)) this.extraLoading = request;
    return request;
  }
  get mountedKind(): AircraftChoice | undefined {
    const id = this.world.get(PLAYER, Mounted)?.vehicle;
    return id?.startsWith('aircraft-') && this.world.has(id, Aircraft)
      ? id.slice('aircraft-'.length)
      : undefined;
  }
  get state(): import('@bendyline/molen-schema').AircraftStateData | undefined {
    const kind = this.mountedKind;
    return kind ? this.world.get(`aircraft-${kind}`, AircraftState) : undefined;
  }
  get power(): number {
    return this.inputs.power;
  }
  groundHeight(x: number, z: number, y?: number): number | undefined {
    if (
      this.elevation !== undefined &&
      Math.abs(x - this.center[0]) < 48 &&
      z - this.center[1] > -900 &&
      z - this.center[1] < 3600
    )
      return this.elevation;
    return this.terrainHeight(x, z, y);
  }
  spawnPosition(kind: AircraftChoice): [number, number, number] {
    const apron = this.apron.get(kind);
    if (apron) return [...apron.position];
    if (this.airfield !== 'practice')
      return [this.center[0], this.terrainHeight(...this.center) ?? 0, this.center[1]];
    if (!KINDS.includes(kind)) return [this.center[0], this.elevation ?? 0, this.center[1] - 600];
    return [
      this.center[0] + (kind === 'p51d' ? -25 : kind === 'oh6' ? 23 : 0),
      this.elevation ?? 0,
      this.center[1] - (kind === 'airliner' ? 800 : 330),
    ];
  }
  visitPosition(kind: AircraftChoice): [number, number, number] {
    const transform = this.world.get(`aircraft-${kind}`, Transform);
    const p = transform?.pos ?? this.spawnPosition(kind);
    if (this.airfield !== 'practice' && transform) {
      const mounts = this.typeComponents(this.typeId(kind)).mountable as {
        entries?: [number, number, number][];
      };
      const fallback: [number, number, number] = kind === 'p51d' ? [1.8, 0, -1.1] : [-1.7, 0, 0.8];
      const entry = vehicleLocalPoint(transform, mounts.entries?.[0] ?? fallback);
      return [entry[0], p[1] + 1.7, entry[2]];
    }
    if (!KINDS.includes(kind)) {
      const mounts = this.typeComponents(this.typeId(kind)).mountable as {
        entries: [number, number, number][];
      };
      const entry = mounts.entries[0] ?? [0, 0, 0];
      return [p[0] + entry[0], p[1] + 1.7, p[2] + entry[2]];
    }
    if (kind === 'airliner') return [p[0] + 2.8, p[1] + 1.7, p[2] + 11.5];
    return [
      p[0] + (kind === 'p51d' ? 1.8 : -1.7),
      p[1] + 1.7,
      p[2] - (kind === 'p51d' ? 1.1 : -0.8),
    ];
  }
  sync(): void {
    if (this.loading || this.ready || this.disposed || !this.airfield) return;
    if (this.airfield !== 'practice') {
      if (this.canPlace && !this.canPlace()) return;
      if (this.terrainHeight(...this.center) === undefined) return;
      this.ready = true;
      if (this.requested)
        void this.loadChoice(this.requested).catch((error) => {
          this.message = String(error);
        });
      return;
    }
    const heights: number[] = [];
    for (const x of [-48, 0, 48])
      for (const z of [-900, -450, 0, 450, 900]) {
        const h = this.terrainHeight(this.center[0] + x, this.center[1] + z);
        if (h === undefined) return;
        heights.push(h);
      }
    this.elevation = Math.max(...heights) + 35;
    this.buildApron(Math.min(...heights));
    this.loading = true;
    void Promise.all(KINDS.map((kind) => this.loadChoice(kind)))
      .then(() => {
        if (!this.disposed) {
          this.ready = true;
          if (this.requested)
            void this.loadChoice(this.requested).catch((error) => {
              this.message = String(error);
            });
          this.render();
        }
      })
      .catch((error) => {
        this.message = `Aircraft could not load: ${String(error)}`;
        console.error(this.message);
      });
  }
  private buildApron(low: number): void {
    const y = this.elevation ?? 0;
    const pavement = new THREE.MeshStandardMaterial({ color: '#485054', roughness: 0.95 });
    const paint = new THREE.MeshStandardMaterial({ color: '#e1e1cc', roughness: 0.85 });
    // The runway paint alone is 140 boxes: one mesh per material, so one draw each, not one per
    // dash, and nothing recomposed every frame.
    const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const add = (
      _name: string,
      size: [number, number, number],
      pos: [number, number, number],
      material: THREE.Material,
    ): void => {
      const box = new THREE.BoxGeometry(...size).translate(pos[0], pos[1], pos[2]);
      parts.set(material, [...(parts.get(material) ?? []), box]);
    };
    add('practice-airfield', [96, y - low + 1, 4500], [0, (y + low - 1) / 2, 1350], pavement);
    for (const x of [-20, 20]) add('runway-edge', [0.18, 0.012, 4480], [x, y + 0.008, 1350], paint);
    for (let z = -850; z <= 3550; z += 36)
      add('runway-centerline', [0.35, 0.012, 15], [0, y + 0.008, z], paint);
    for (const z of [-864, 3564])
      for (let x = -10; x <= 10; x += 4)
        add('threshold-marking', [1.5, 0.012, 12], [x, y + 0.008, z], paint);
    for (const x of [20.5, 25.5]) add('helipad-H', [0.4, 0.012, 6], [x, y + 0.008, -330], paint);
    add('helipad-H-crossbar', [5.4, 0.012, 0.4], [23, y + 0.008, -330], paint);
    const steel = new THREE.MeshStandardMaterial({
      color: '#889296',
      metalness: 0.6,
      roughness: 0.45,
    });
    for (const x of [-38 - 0.72, -38 + 0.72])
      add('practice-rail', [0.065, 0.06, 760], [x, y + 0.015, 0], steel);
    for (const z of [-382, 382])
      add('rail-buffer-stop', [2.4, 0.8, 0.25], [-38, y + 0.4, z], paint);
    for (const [material, boxes] of parts) {
      const geometry = mergeGeometries(boxes);
      for (const box of boxes) box.dispose();
      const mesh = new THREE.Mesh(geometry ?? new THREE.BufferGeometry(), material);
      mesh.name =
        material === pavement
          ? 'practice-airfield'
          : material === paint
            ? 'practice-airfield-markings'
            : 'practice-rail';
      mesh.position.set(this.center[0], 0, this.center[1]);
      mesh.receiveShadow = true;
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      this.object.add(mesh);
    }
  }
  nearest(position: [number, number, number]): AircraftChoice | undefined {
    for (const kind of this.visuals.keys()) {
      const t = this.world.get(`aircraft-${kind}`, Transform);
      if (!t) continue;
      const components = this.typeComponents(this.typeId(kind));
      const aircraft = this.aircraftData(this.typeId(kind));
      const mountable = components.mountable as {
        reach: number;
        entries?: [number, number, number][];
      };
      const eye = vehicleLocalPoint(t, mountable.entries?.[0] ?? aircraft.spec.pilotEye);
      if (Math.hypot(...eye.map((v, i) => v - (position[i] ?? 0))) < mountable.reach) return kind;
    }
    return undefined;
  }
  enter(position: [number, number, number]): boolean {
    const kind = this.nearest(position);
    if (!kind) return false;
    const id = `aircraft-${kind}`,
      t = this.world.get(id, Transform);
    if (!t) return false;
    this.collision.update(this.root, position[0], position[2], position[1]);
    const a = new THREE.Vector3().fromArray(position).sub(this.collision.origin);
    const mountable = this.typeComponents(this.typeId(kind)).mountable as {
      entries?: [number, number, number][];
    };
    const b = new THREE.Vector3()
      .fromArray(
        vehicleLocalPoint(
          t,
          mountable.entries?.[0] ?? this.aircraftData(this.typeId(kind)).spec.pilotEye,
        ),
      )
      .sub(this.collision.origin);
    // Entry markers are on the ground. Sight the doorway above the pavement, otherwise
    // draped apron surfaces a few centimetres above terrain can block boarding from eye height.
    b.y = Math.max(b.y, t.pos[1] + 1.2 - this.collision.origin.y);
    const hit = this.collision.octree.rayIntersect(new THREE.Ray(a, b.clone().sub(a).normalize()));
    if (hit && hit.distance < a.distanceTo(b) - 0.1) return false;
    this.world.patch(PLAYER, Transform, { pos: [...position] });
    if (!mountEntity(this.world, PLAYER, id)) {
      this.message = 'Stop and shut down the engine before boarding';
      return false;
    }
    this.inputs = { ...(this.world.get(id, AircraftInput) ?? IDLE_AIRCRAFT_INPUT) };
    this.pointerAxes.clear();
    this.cockpitBrake = false;
    this.message = '';
    return true;
  }
  key(code: string): void {
    if (!this.mountedKind) return;
    if (code === 'KeyI') this.inputs.engine = !this.inputs.engine;
    if (code === 'KeyG' && !this.state?.grounded) this.inputs.gear = !this.inputs.gear;
    if (code === 'KeyF') this.inputs.flaps = !this.inputs.flaps;
    if (code === 'KeyJ' && this.aircraftData(this.typeId(this.mountedKind)).spec.poweredLift)
      this.inputs.thrustVector = ((Math.round((this.inputs.thrustVector ?? 0) * 4) + 1) % 5) / 4;
    if (code === 'KeyR' && this.state?.crashed) {
      const kind = this.mountedKind;
      const yaw = this.spawnYaw(kind);
      this.world.set(`aircraft-${kind}`, Transform, {
        pos: this.spawnPosition(kind),
        rot: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      });
      this.inputs = {
        ...this.types.component<AircraftInputData>(this.typeId(kind), 'aircraftInput'),
      };
      this.world.set(`aircraft-${kind}`, AircraftState, {
        ...initialAircraftState(yaw),
        ...(this.inputs.thrustVector === undefined
          ? {}
          : { thrustVectorPosition: this.inputs.thrustVector }),
      });
      this.message = '';
    }
  }
  input(dt: number, controls: NavigationInput): void {
    const kind = this.mountedKind;
    if (!kind) {
      // Obstacles follow an aircraft left in flight, so it still hits what it flies into.
      const id = `aircraft-${this.abandoned}`;
      const t = this.abandoned ? this.world.get(id, Transform) : undefined;
      const s = this.abandoned ? this.world.get(id, AircraftState) : undefined;
      if (!t || !s || (s.grounded && Math.hypot(...s.velocity) < 0.5)) this.abandoned = undefined;
      else this.collision.update(this.root, t.pos[0], t.pos[2], t.pos[1]);
      return;
    }
    const t = this.world.get(`aircraft-${kind}`, Transform);
    if (t) this.collision.update(this.root, t.pos[0], t.pos[2], t.pos[1]);
    const pilot = controls.pilot;
    const mechanisms = this.aircraftData(this.typeId(kind)).spec.actuators;
    for (const [name, count] of Object.entries(controls.actuators ?? {}))
      if (mechanisms?.[name] && count % 2 === 1)
        this.inputs.actuators = {
          ...this.inputs.actuators,
          [name]: !this.inputs.actuators?.[name],
        };
    for (const [action, code] of [
      ['engine', 'KeyI'],
      ['gear', 'KeyG'],
      ['flaps', 'KeyF'],
      ['vector', 'KeyJ'],
      ['recover', 'KeyR'],
    ] as const) {
      for (let i = 0; i < (pilot?.[action] ?? 0); i++) this.key(code);
    }
    if (pilot?.power !== undefined || pilot?.throttle) {
      this.inputs = applyAircraftControl(
        this.inputs,
        {
          control: { id: 'common', label: 'Power', action: 'power', nodes: [] },
          value: pilot.power ?? this.inputs.power + Math.min(dt, 0.1) * 0.22 * pilot.throttle,
        },
        this.aircraftData(this.typeId(kind)).spec,
      );
    }
    this.inputs = {
      ...this.inputs,
      pitch: -controls.move.forward || this.pointerAxes.pitch,
      roll: controls.move.right || this.pointerAxes.roll,
      yaw: pilot?.yaw || this.pointerAxes.yaw,
      brake: controls.jump || this.cockpitBrake,
    };
    flyAircraft(this.world, PLAYER, this.inputs);
  }
  /** `camera` (absolute, like the aircraft) keeps distant cockpits out of the frame. */
  render(camera?: readonly [number, number, number]): void {
    // A cockpit shows within tens of meters of the camera. A pilot rolling or flying past the
    // parked aircraft never looks into theirs, and each is a hundred more draws switched on for
    // the seconds it takes to pass: on a takeoff roll, enough to push adaptive quality down.
    const pilot = this.mountedKind;
    const own =
      pilot === undefined ? undefined : this.world.get(`aircraft-${pilot}`, AircraftState);
    const passing = own !== undefined && Math.hypot(...own.velocity) > CABIN_PASS_SPEED;
    for (const [kind, visual] of this.visuals) {
      let t = this.world.get(`aircraft-${kind}`, Transform);
      const s = this.world.get(`aircraft-${kind}`, AircraftState),
        input = this.world.get(`aircraft-${kind}`, AircraftInput);
      if (!t || !s || !input) continue;
      if (
        (this.airfield !== 'practice' || this.apron.has(kind)) &&
        s.grounded &&
        !input.engine &&
        Math.hypot(...s.velocity) < 0.01
      ) {
        const height = this.terrainHeight(t.pos[0], t.pos[2]);
        if (height !== undefined && Math.abs(height - t.pos[1]) > 0.01) {
          t = { ...t, pos: [t.pos[0], height, t.pos[2]] };
          this.world.set(`aircraft-${kind}`, Transform, t);
        }
      }
      visual.object.position.fromArray(t.pos);
      visual.object.quaternion.fromArray(t.rot);
      if (camera !== undefined) {
        const distantApron =
          this.apron.has(kind) &&
          Math.hypot(t.pos[0] - camera[0], t.pos[1] - camera[1], t.pos[2] - camera[2]) > 12;
        visual.updateView(kind !== pilot && (passing || distantApron) ? FAR_AWAY : camera);
      }
      const channels = this.world.get(`aircraft-${kind}`, Aircraft)?.spec.visual;
      visual.update(
        s,
        input,
        t.pos[1],
        {
          ...readModelSignals(channels?.interior?.sources, (name) =>
            this.world.get(`aircraft-${kind}`, { name }),
          ),
          ...readModelSignals(channels?.animation?.sources, (name) =>
            this.world.get(`aircraft-${kind}`, { name }),
          ),
        },
        this.world.tick / this.world.tickRate,
      );
    }
  }
  cameraPose(
    view: 'cockpit' | 'chase' | 'flyby',
    lookYaw: number,
    lookPitch: number,
  ): AircraftCameraPose | undefined {
    // Each return to the flyby view places its camera afresh.
    if (view !== 'flyby') this.flyby.reset();
    const kind = this.mountedKind;
    if (!kind) return;
    const t = this.world.get(`aircraft-${kind}`, Transform);
    if (!t) return;
    const spec = this.aircraftData(this.typeId(kind)).spec;
    if (view === 'flyby')
      return this.flyby.pose(
        t,
        this.world.get(`aircraft-${kind}`, AircraftState)?.velocity ?? [0, 0, 0],
        spec,
        (x, z) => this.groundHeight(x, z),
      );
    return aircraftCameraPose(t, spec, {
      view,
      lookYaw,
      lookPitch,
      obstructionDistance: (from, to) => {
        const a = new THREE.Vector3().fromArray(from).sub(this.collision.origin);
        const b = new THREE.Vector3().fromArray(to).sub(this.collision.origin);
        const hit = this.collision.octree.rayIntersect(new THREE.Ray(a, b.sub(a).normalize()));
        return hit ? hit.distance : undefined;
      },
    });
  }
  status(): string {
    const s = this.state,
      kind = this.mountedKind;
    if (!s || !kind) return this.message;
    const spec = this.aircraftData(this.typeId(kind)).spec;
    const airplane = spec.model === 'airplane';
    const missing = Object.entries(s.damage ?? {})
      .filter(([, part]) => part.detached)
      .map(([id]) => id.replaceAll('-', ' '));
    const bailOut = this.bailOutMode(s);
    const alert = s.crashed
      ? `${missing.length ? `Lost ${missing.join(', ')}` : 'Airframe damaged'} — R recover · ${bailOut === 'eject' ? 'E eject' : 'E climb out'}`
      : s.waitingForTerrain
        ? 'Waiting for terrain'
        : (s.departure ?? 0) > 0.8 && Math.abs(s.yawRate ?? 0) > 0.8
          ? 'DEPARTURE / SPIN'
          : s.overspeed
            ? 'OVERSPEED — reduce speed / check gear and flaps'
            : s.stalled
              ? 'STALL — nose down, power up, wings level'
              : this.message ||
                (s.grounded
                  ? airplane && s.airspeed >= (kind === 'airliner' ? 65 : 42)
                    ? 'Rotate gently — S'
                    : 'On ground'
                  : 'Airborne');
    const load = airplane && !s.grounded ? `${(s.loadFactor ?? 1).toFixed(1)} g · ` : '';
    const reheat = Math.max(
      0,
      ...Object.values(s.engines ?? {}).map((engine) => engine.afterburner ?? 0),
    );
    const airData = `${s.mach === undefined ? '' : `M ${s.mach.toFixed(2)} · `}${s.equivalentAirspeed === undefined ? '' : `${(s.equivalentAirspeed * 1.94384).toFixed(0)} KEAS · `}${reheat > 0 ? `AB ${Math.round(reheat * 100)}% · ` : ''}`;
    // The selection, until the gear and flaps actually get there.
    const gearPosition = s.gearPosition ?? Number(this.inputs.gear);
    const flapPosition = s.flapPosition ?? Number(this.inputs.flaps);
    const gear =
      gearPosition === 1
        ? 'down'
        : gearPosition === 0
          ? 'up'
          : this.inputs.gear
            ? 'lowering'
            : 'raising';
    const flaps =
      flapPosition === 1
        ? 'down'
        : flapPosition === 0
          ? 'up'
          : `${Math.round(flapPosition * 100)}%`;
    return `${spec.label} · ${(s.airspeed * 1.94384).toFixed(0)} KTAS · ${airData}${(s.altitudeAGL * 3.28084).toFixed(0)} ft AGL · ${(s.verticalSpeed * 196.85).toFixed(0)} ft/min · ${load}${airplane ? 'Throttle' : 'Collective'} ${(this.inputs.power * 100).toFixed(0)}% · RPM ${(s.rpm * 100).toFixed(0)}% · ${this.inputs.engine ? 'Engine on' : 'Engine off'} · ${airplane ? `Gear ${gear} · Flaps ${flaps} · ` : ''}${spec.poweredLift ? `Vector ${Math.round((s.thrustVectorPosition ?? 0) * 90)}° · ` : ''}${alert}`;
  }
  exitHint(): void {
    this.message =
      'Land, stop, press I to shut down, and wait for the rotor to stop before exiting';
  }
  /**
   * How the pilot leaves when the kernel's exit (stopped, shut down, open level ground at an
   * exit) cannot apply: in flight, or in a wreck still moving (falling, or sliding on with its
   * engine running), they eject. A wreck at rest is climbed out of wherever it lies, the raised
   * practice runway or a roof as much as the ground. Undefined when intact on the ground.
   */
  private bailOutMode(s: AircraftStateData): 'eject' | 'climb' | undefined {
    if (s.crashed) return Math.hypot(...s.velocity) > WRECK_EXIT_SPEED ? 'eject' : 'climb';
    return s.grounded ? undefined : 'eject';
  }
  /**
   * Leave without the kernel's exit. Ejecting returns where the seat fires from and leaves the
   * aircraft flying on hands-off (power, gear and flaps as they were) until it lands or crashes.
   * Climbing out of a wreck cuts its engines and returns the cockpit's x/z at the height the
   * airframe rests, for the host to stand the pilot on open ground beside it at that level.
   * Undefined while neither applies (intact on the ground), or when ejecting is called for but
   * not `eject`.
   */
  bailOut(
    eject = true,
  ): { ejection: EjectionSeat } | { wreck: [number, number, number] } | undefined {
    const kind = this.mountedKind;
    const id = `aircraft-${kind}`;
    const t = kind ? this.world.get(id, Transform) : undefined;
    const s = this.state;
    if (!kind || !t || !s) return undefined;
    const mode = this.bailOutMode(s);
    if (mode === undefined || (mode === 'eject' && !eject)) return undefined;
    const seat = vehicleLocalPoint(t, this.aircraftData(this.typeId(kind)).spec.pilotEye);
    this.world.set(id, AircraftInput, {
      ...this.inputs,
      pitch: 0,
      roll: 0,
      yaw: 0,
      ...(mode === 'eject'
        ? { brake: false, actuators: { ...this.inputs.actuators, eject: true } }
        : { power: 0, engine: false, brake: true }),
    });
    this.world.remove(PLAYER, Mounted);
    this.world.emit('vehicle-unmounted', { actor: PLAYER, vehicle: id });
    this.pointerAxes.clear();
    this.cockpitBrake = false;
    this.message = '';
    if (mode === 'climb') return { wreck: [seat[0], t.pos[1], seat[2]] };
    this.abandoned = kind;
    return { ejection: { position: seat, velocity: [...s.velocity], rotation: [...t.rot] } };
  }
  private contacts(probes: readonly AircraftCollisionProbe[], id: string): AircraftContact[] {
    if (probes.length === 0) return [];
    const center = new THREE.Vector3();
    for (const probe of probes) center.add(new THREE.Vector3().fromArray(probe.center));
    center.multiplyScalar(1 / probes.length);
    const reach = Math.max(
      ...probes.map(
        (probe) => center.distanceTo(new THREE.Vector3().fromArray(probe.center)) + probe.radius,
      ),
    );
    const ground = this.groundHeight(center.x, center.z, center.y);
    const cars =
      ground === undefined || center.y - reach - ground < CAR_CLEARANCE ? this.cars() : [];
    const others: Array<[number, number, number]> = [];
    for (const [other, t] of this.world.query(Transform, Aircraft))
      if (other !== id) others.push([t.pos[0], t.pos[1] + 1.2, t.pos[2]]);
    return aircraftObstacleContacts(probes, {
      origin: this.collision.origin,
      octree: this.collision.octree,
      cars,
      aircraft: others,
    });
  }
  /** Every vehicle's pose, gathered once per world tick for all aircraft. */
  private cars(): ReadonlyArray<{ transform: TransformData; spec: VehicleSpec }> {
    if (this.carsTick !== this.world.tick) {
      this.carsTick = this.world.tick;
      this.carCache = [];
      for (const [, transform, car] of this.world.query(Transform, Vehicle))
        this.carCache.push({ transform, spec: car.spec });
    }
    return this.carCache;
  }
  dispose(): void {
    this.disposed = true;
    for (const v of this.visuals.values()) v.dispose();
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
    for (const kind of this.visuals.keys())
      if (this.world.exists(`aircraft-${kind}`)) this.world.destroy(`aircraft-${kind}`);
    this.object.removeFromParent();
    this.collision.clear();
  }
}
