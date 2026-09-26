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
import type { AircraftData, AircraftInputData, AircraftSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';

const PLAYER = 'world-player';
type AircraftChoice = 'p51d' | 'oh6';
const KINDS: AircraftChoice[] = ['p51d', 'oh6'];
const ENTITY_IDS: Record<AircraftChoice, string> = {
  p51d: 'molen.entities.aircraft.p51d',
  oh6: 'molen.entities.aircraft.oh6',
};
const choiceForId = (id: string): AircraftChoice | undefined =>
  KINDS.find((choice) => ENTITY_IDS[choice] === id);
export const AIRCRAFT_HELP: string =
  'I engine · Shift/Ctrl power · W/S pitch · A/D bank · Q/Z pedals · Space brakes · G gear · F flaps · V view · E exit · R recover after impact';

/** Two persistent ECS aircraft on a session-local practice airfield, under the floating origin. */
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
  private collision = new WalkCollision(true);
  private inputs: AircraftInputData = { ...IDLE_AIRCRAFT_INPUT };
  constructor(
    readonly world: World,
    private readonly root: THREE.Object3D,
    private readonly terrainHeight: (x: number, z: number) => number | undefined,
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
      groundHeight: (x, z) => this.groundHeight(x, z),
      canOccupy: (t, spec, id) => this.canOccupy(t, spec, id),
    });
  }
  private aircraftData(id: string): AircraftData {
    return this.types.component<AircraftData>(id, 'aircraft');
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
  groundHeight(x: number, z: number): number | undefined {
    if (
      this.elevation !== undefined &&
      Math.abs(x - this.center[0]) < 48 &&
      Math.abs(z - this.center[1]) < 450
    )
      return this.elevation;
    return this.terrainHeight(x, z);
  }
  spawnPosition(kind: AircraftChoice): [number, number, number] {
    return [this.center[0] + (kind === 'p51d' ? 0 : 23), this.elevation ?? 0, this.center[1] - 330];
  }
  visitPosition(kind: AircraftChoice): [number, number, number] {
    const p = this.world.get(`aircraft-${kind}`, Transform)?.pos ?? this.spawnPosition(kind);
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
      for (const z of [-450, -225, 0, 225, 450]) {
        const h = this.terrainHeight(this.center[0] + x, this.center[1] + z);
        if (h === undefined) return;
        heights.push(h);
      }
    this.elevation = Math.max(...heights) + 35;
    this.buildApron(Math.min(...heights));
    this.loading = true;
    void Promise.all(
      KINDS.map(async (kind) => {
        const model = await this.loadModel(ENTITY_IDS[kind]);
        const aircraft = this.aircraftData(ENTITY_IDS[kind]);
        const visual = createAircraftVisual(model, aircraft.spec);
        if (this.disposed) {
          visual.dispose();
          return;
        }
        this.visuals.set(kind, visual);
        this.object.add(visual.object);
        const components = this.types.components(ENTITY_IDS[kind]);
        components.transform = { pos: this.spawnPosition(kind), rot: [0, 0, 0, 1] };
        this.world.spawnRaw(components, `aircraft-${kind}`);
      }),
    )
      .then(() => {
        if (!this.disposed) {
          this.ready = true;
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
    add('practice-airfield', [96, y - low + 1, 900], [0, (y + low - 1) / 2, 0], pavement);
    for (const x of [-14, 14]) add('runway-edge', [0.18, 0.012, 880], [x, y + 0.008, 0], paint);
    for (let z = -400; z <= 400; z += 36)
      add('runway-centerline', [0.35, 0.012, 15], [0, y + 0.008, z], paint);
    for (const z of [-414, 414])
      for (let x = -10; x <= 10; x += 4)
        add('threshold-marking', [1.5, 0.012, 12], [x, y + 0.008, z], paint);
    for (const x of [20.5, 25.5]) add('helipad-H', [0.4, 0.012, 6], [x, y + 0.008, -330], paint);
    add('helipad-H-crossbar', [5.4, 0.012, 0.4], [23, y + 0.008, -330], paint);
  }
  nearest(position: [number, number, number]): AircraftChoice | undefined {
    for (const kind of KINDS) {
      const t = this.world.get(`aircraft-${kind}`, Transform);
      if (!t) continue;
      const components = this.types.components(ENTITY_IDS[kind]);
      const aircraft = this.aircraftData(ENTITY_IDS[kind]);
      const mountable = components.mountable as { reach: number };
      const eye = vehicleLocalPoint(t, aircraft.spec.pilotEye);
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
    this.collision.update(this.root, position[0], position[2]);
    const a = new THREE.Vector3().fromArray(position).sub(this.collision.origin);
    const b = new THREE.Vector3()
      .fromArray(vehicleLocalPoint(t, this.aircraftData(ENTITY_IDS[kind]).spec.pilotEye))
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
    if (code === 'KeyR' && this.state?.crashed) {
      const kind = this.mountedKind;
      this.world.set(`aircraft-${kind}`, Transform, {
        pos: this.spawnPosition(kind),
        rot: [0, 0, 0, 1],
      });
      this.world.set(`aircraft-${kind}`, AircraftState, initialAircraftState());
      this.inputs = { ...IDLE_AIRCRAFT_INPUT };
      this.message = '';
    }
  }
  input(dt: number, keys: ReadonlySet<string>, focused = true): void {
    const kind = this.mountedKind;
    if (!kind) return;
    const t = this.world.get(`aircraft-${kind}`, Transform);
    if (t) this.collision.update(this.root, t.pos[0], t.pos[2]);
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
      visual.update(
        s,
        input,
        t.pos[1],
        readModelSignals(
          this.world.get(`aircraft-${kind}`, Aircraft)?.spec.visual.interior?.sources,
          (name) => this.world.get(`aircraft-${kind}`, { name }),
        ),
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
    return aircraftCameraPose(t, this.aircraftData(ENTITY_IDS[kind]).spec, {
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
    const alert = s.crashed
      ? 'Impact — R recover'
      : s.waitingForTerrain
        ? 'Waiting for terrain'
        : s.stalled
          ? 'STALL — nose down, power up, wings level'
          : this.message ||
            (s.grounded
              ? kind === 'p51d' && s.airspeed >= 42
                ? 'Rotate gently — S'
                : 'On ground'
              : 'Airborne');
    const spec = this.aircraftData(ENTITY_IDS[kind]).spec;
    const airplane = spec.model === 'airplane';
    return `${spec.label} · ${(s.airspeed * 1.94384).toFixed(0)} kt · ${(s.altitudeAGL * 3.28084).toFixed(0)} ft AGL · ${(s.verticalSpeed * 196.85).toFixed(0)} ft/min · ${airplane ? 'Throttle' : 'Collective'} ${(this.inputs.power * 100).toFixed(0)}% · RPM ${(s.rpm * 100).toFixed(0)}% · ${this.inputs.engine ? 'Engine on' : 'Engine off'} · ${airplane ? `Gear ${this.inputs.gear ? 'down' : 'up'} · Flaps ${this.inputs.flaps ? 'down' : 'up'} · ` : ''}${alert}`;
  }
  exitHint(): void {
    this.message =
      'Land, stop, press I to shut down, and wait for the rotor to stop before exiting';
  }
  private canOccupy(t: TransformData, spec: AircraftSpec, id: string): boolean {
    for (const offset of spec.collisionProbes) {
      const point = vehicleLocalPoint(t, offset);
      const sphere = new THREE.Sphere(
        new THREE.Vector3().fromArray(point).sub(this.collision.origin),
        0.3,
      );
      if (this.collision.octree.sphereIntersect(sphere)) {
        return false;
      }
      for (const [, carT, car] of this.world.query(Transform, Vehicle)) {
        if (Math.hypot(carT.pos[0] - point[0], carT.pos[2] - point[2]) > 5) continue;
        const carSpec = car.spec;
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
      for (const [other, otherT] of this.world.query(Transform, Aircraft)) {
        if (
          id !== other &&
          new THREE.Vector3()
            .fromArray(point)
            .distanceTo(new THREE.Vector3(otherT.pos[0], otherT.pos[1] + 1.2, otherT.pos[2])) < 1.5
        )
          return false;
      }
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
    for (const kind of KINDS)
      if (this.world.exists(`aircraft-${kind}`)) this.world.destroy(`aircraft-${kind}`);
    this.object.removeFromParent();
    this.collision.clear();
  }
}
