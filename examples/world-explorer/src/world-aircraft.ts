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
import { Mounted, mountEntity, Vehicle, vehicleLocalPoint } from '@bendyline/molen-kernel/vehicles';
import { Transform, type TransformData, type World } from '@bendyline/molen-kernel/world';
import type {
  AircraftData,
  AircraftInputData,
  AircraftSpec,
  VehicleSpec,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';

const PLAYER = 'world-player';
type AircraftChoice = string;
const KINDS: AircraftChoice[] = ['p51d', 'oh6', 'airliner'];
const entityId = (kind: AircraftChoice): string => `molen.entities.aircraft.${kind}`;
const choiceForId = (id: string): AircraftChoice | undefined =>
  id.startsWith('molen.entities.aircraft.')
    ? id.slice('molen.entities.aircraft.'.length)
    : undefined;
export const AIRCRAFT_HELP: string =
  'I engine · Shift/Ctrl power · W/S pitch · A/D bank · Q/Z pedals · Space brakes · G gear · F flaps · J nozzle/nacelles · V view · E exit · R recover after impact';

/** Persistent ECS aircraft on a session-local practice airfield, under the floating origin. */
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
  constructor(
    readonly world: World,
    private readonly root: THREE.Object3D,
    private readonly terrainHeight: (x: number, z: number, y?: number) => number | undefined,
    initial: [number, number, number],
    /** Load an aircraft's model by entity type id, e.g. from the entities content pack. */
    private readonly loadModel: (id: string) => Promise<THREE.Object3D>,
    /** Entity types: aircraft specs, cockpit and spawn components. */
    private readonly types: TypeLibrary,
  ) {
    this.center = [initial[0] + 500, initial[2]];
    this.object.name = 'world:airfield';
    root.add(this.object);
    installAircraft(world, {
      groundHeight: (x, z, y) => this.groundHeight(x, z, y),
      canOccupy: (t, spec, id) => this.canOccupy(t, spec, id),
    });
  }
  private aircraftData(id: string): AircraftData {
    return this.types.component<AircraftData>(id, 'aircraft');
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
  /** Only the selected addition is resident beside the original three practice aircraft. */
  async request(kind: AircraftChoice): Promise<void> {
    if (!this.choices.some((choice) => choice.kind === kind))
      throw new Error(`Unknown aircraft ${kind}`);
    this.requested = kind;
    if (this.ready) await this.loadChoice(kind);
  }
  private loadChoice(kind: AircraftChoice): Promise<void> {
    if (this.visuals.has(kind)) return Promise.resolve();
    const existing = this.requests.get(kind);
    if (existing) return existing;
    if (!KINDS.includes(kind) && this.extraLoading) {
      return this.extraLoading
        .catch(() => {})
        .then(() => {
          if (!this.disposed && this.requested === kind) return this.loadChoice(kind);
        });
    }
    const request = (async () => {
      const model = await this.loadModel(entityId(kind));
      const visual = createAircraftVisual(model, this.aircraftData(entityId(kind)).spec);
      if (this.disposed || (!KINDS.includes(kind) && this.requested !== kind)) {
        visual.dispose();
        return;
      }
      for (const [previous, oldVisual] of this.visuals) {
        if (KINDS.includes(previous) || previous === this.mountedKind || KINDS.includes(kind))
          continue;
        oldVisual.dispose();
        this.visuals.delete(previous);
        if (this.world.exists(`aircraft-${previous}`)) this.world.destroy(`aircraft-${previous}`);
      }
      this.visuals.set(kind, visual);
      this.object.add(visual.object);
      const components = this.types.components(entityId(kind));
      components.transform = { pos: this.spawnPosition(kind), rot: [0, 0, 0, 1] };
      this.world.spawnRaw(components, `aircraft-${kind}`);
      this.render();
    })().finally(() => {
      this.requests.delete(kind);
      if (this.extraLoading === request) this.extraLoading = undefined;
    });
    this.requests.set(kind, request);
    if (!KINDS.includes(kind)) this.extraLoading = request;
    return request;
  }
  get mountedKind(): AircraftChoice | undefined {
    const id = this.world.get(PLAYER, Mounted)?.vehicle;
    const kind = id ? this.world.get(id, Aircraft)?.kind : undefined;
    return kind === undefined ? undefined : choiceForId(kind);
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
    if (!KINDS.includes(kind)) return [this.center[0], this.elevation ?? 0, this.center[1] - 600];
    return [
      this.center[0] + (kind === 'p51d' ? -25 : kind === 'oh6' ? 23 : 0),
      this.elevation ?? 0,
      this.center[1] - (kind === 'airliner' ? 800 : 330),
    ];
  }
  visitPosition(kind: AircraftChoice): [number, number, number] {
    const p = this.world.get(`aircraft-${kind}`, Transform)?.pos ?? this.spawnPosition(kind);
    if (!KINDS.includes(kind)) {
      const mounts = this.types.components(entityId(kind)).mountable as {
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
    if (this.loading || this.ready || this.disposed) return;
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
    const add = (
      name: string,
      size: [number, number, number],
      pos: [number, number, number],
      material: THREE.Material,
    ): void => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.name = name;
      mesh.position.set(this.center[0] + pos[0], pos[1], this.center[1] + pos[2]);
      mesh.receiveShadow = true;
      this.object.add(mesh);
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
  }
  nearest(position: [number, number, number]): AircraftChoice | undefined {
    for (const kind of this.visuals.keys()) {
      const t = this.world.get(`aircraft-${kind}`, Transform);
      if (!t) continue;
      const components = this.types.components(entityId(kind));
      const aircraft = this.aircraftData(entityId(kind));
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
    const mountable = this.types.components(entityId(kind)).mountable as {
      entries?: [number, number, number][];
    };
    const b = new THREE.Vector3()
      .fromArray(
        vehicleLocalPoint(
          t,
          mountable.entries?.[0] ?? this.aircraftData(entityId(kind)).spec.pilotEye,
        ),
      )
      .sub(this.collision.origin);
    const hit = this.collision.octree.rayIntersect(new THREE.Ray(a, b.clone().sub(a).normalize()));
    if (hit && hit.distance < a.distanceTo(b) - 0.1) return false;
    this.world.patch(PLAYER, Transform, { pos: [...position] });
    if (!mountEntity(this.world, PLAYER, id)) {
      this.message = 'Stop and shut down the engine before boarding';
      return false;
    }
    this.inputs = { ...(this.world.get(id, AircraftInput) ?? IDLE_AIRCRAFT_INPUT) };
    this.message = '';
    return true;
  }
  key(code: string): void {
    if (!this.mountedKind) return;
    if (code === 'KeyI') this.inputs.engine = !this.inputs.engine;
    if (code === 'KeyG' && !this.state?.grounded) this.inputs.gear = !this.inputs.gear;
    if (code === 'KeyF') this.inputs.flaps = !this.inputs.flaps;
    if (code === 'KeyJ' && this.aircraftData(entityId(this.mountedKind)).spec.poweredLift)
      this.inputs.thrustVector = ((Math.round((this.inputs.thrustVector ?? 0) * 4) + 1) % 5) / 4;
    if (code === 'KeyR' && this.state?.crashed) {
      const kind = this.mountedKind;
      this.world.set(`aircraft-${kind}`, Transform, {
        pos: this.spawnPosition(kind),
        rot: [0, 0, 0, 1],
      });
      this.inputs = { ...this.types.component<AircraftInputData>(entityId(kind), 'aircraftInput') };
      this.world.set(`aircraft-${kind}`, AircraftState, {
        ...initialAircraftState(),
        ...(this.inputs.thrustVector === undefined
          ? {}
          : { thrustVectorPosition: this.inputs.thrustVector }),
      });
      this.message = '';
    }
  }
  input(dt: number, keys: ReadonlySet<string>, focused = true): void {
    const kind = this.mountedKind;
    if (!kind) return;
    const t = this.world.get(`aircraft-${kind}`, Transform);
    if (t) this.collision.update(this.root, t.pos[0], t.pos[2], t.pos[1]);
    const held = (key: string): number => Number(focused && keys.has(key));
    this.inputs = {
      ...this.inputs,
      power: Math.max(
        0,
        Math.min(
          1,
          this.inputs.power +
            Math.min(dt, 0.1) *
              0.22 *
              (held('ShiftLeft') + held('ShiftRight') - held('ControlLeft') - held('ControlRight')),
        ),
      ),
      pitch: held('KeyS') - held('KeyW'),
      roll: held('KeyD') - held('KeyA'),
      yaw: held('KeyZ') - held('KeyQ'),
      brake: held('Space') > 0,
    };
    flyAircraft(this.world, PLAYER, this.inputs);
  }
  render(): void {
    for (const [kind, visual] of this.visuals) {
      const t = this.world.get(`aircraft-${kind}`, Transform),
        s = this.world.get(`aircraft-${kind}`, AircraftState),
        input = this.world.get(`aircraft-${kind}`, AircraftInput);
      if (!t || !s || !input) continue;
      visual.object.position.fromArray(t.pos);
      visual.object.quaternion.fromArray(t.rot);
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
    view: 'cockpit' | 'chase',
    lookYaw: number,
    lookPitch: number,
  ): AircraftCameraPose | undefined {
    const kind = this.mountedKind;
    if (!kind) return;
    const t = this.world.get(`aircraft-${kind}`, Transform);
    if (!t) return;
    return aircraftCameraPose(t, this.aircraftData(entityId(kind)).spec, {
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
    const spec = this.aircraftData(entityId(kind)).spec;
    const airplane = spec.model === 'airplane';
    const alert = s.crashed
      ? 'Impact — R recover'
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
  private canOccupy(t: TransformData, spec: AircraftSpec, id: string): boolean {
    // Every resident parked car is an entity. Gather the few that could touch this airframe
    // once per step, instead of scanning all of them again for each probe.
    let probeReach = 0;
    for (const offset of spec.collisionProbes)
      probeReach = Math.max(probeReach, Math.hypot(offset[0], offset[1], offset[2]));
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
      if (this.collision.octree.sphereIntersect(sphere)) {
        return false;
      }
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
