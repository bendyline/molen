/** Bounded real street/vehicle lights plus batched traffic lenses for Earth hosts. */
import type { AmbientAgentData } from '@bendyline/molen-ambient/kernel';
import { Vehicle, VehicleInput, VehicleState } from '@bendyline/molen-kernel/vehicles';
import { componentHandle, Transform, type World } from '@bendyline/molen-kernel/world';
import type { TerrainStreetLight, TerrainSurfaceRenderer } from '@bendyline/molen-terrain/client';
import * as THREE from 'three';

const Agent = componentHandle('ambientAgent');
const MAX_CARS = 512;
const MAX_BEAM_CARS = 4;
/**
 * A driven vehicle's switched-on beams never drop below this share of their night strength,
 * so headlights the driver turns on at dusk or by day still visibly light the road ahead.
 */
const SWITCHED_BEAM_FLOOR = 0.35;
/** Street lamps farther than this from the camera and from where it looks are left dark, m. */
const STREET_LIGHT_REACH = 600;
/** A lamp lit at the last choice counts as this much nearer at the next. */
const STREET_LIGHT_HOLD = 0.85;
/**
 * The lamps to light are chosen again after this long, ms (scenery streams in and out), or as
 * soon as the camera or the point it looks at has moved STREET_LIGHT_MOVE meters: four times a
 * second for a view held still, and no later than 8 m on for one that travels or turns. Chosen
 * every frame, the walk over a city's lamps took 50 ms of each second of a night flight over
 * Osaka (12,900 lamps on show, a key string made for each).
 */
const STREET_LIGHT_MS = 250;
const STREET_LIGHT_MOVE = 8;

interface LampSlot {
  key: string;
  distance: number;
  /** In the root's frame. */
  position: THREE.Vector3;
}

export interface EarthNightLightingOptions {
  /** Parent in absolute simulation coordinates, normally the terrain stream object. */
  root: THREE.Object3D;
  world: World;
  surface: Pick<TerrainSurfaceRenderer, 'visitStreetLights'>;
  /** Resolved body heights for ambient proxies and full models of the same type. */
  vehicleHeights?: Readonly<Record<string, number>>;
  sampleHeight: (x: number, z: number) => number | undefined;
}

export interface EarthNightLightingFrame {
  camera: readonly [number, number, number];
  direction: readonly [number, number, number];
  factor: number;
  /** Keep the driven car's beams even when looking away from it. */
  drivenVehicleId?: string | undefined;
}

interface Car {
  id: string;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  width: number;
  length: number;
  height: number;
  braking: boolean;
  distance: number;
  /** Model-space lens centres from `spec.headlamps`; absent, a pair from the body size. */
  headlamps?: readonly (readonly [number, number, number])[];
  /** The driven vehicle's headlight switch, when it has one; its model draws its own lens. */
  switched?: boolean;
}

/**
 * Sixteen street lights and four pairs of car beams bound lighting cost as tiles stream.
 * Unused slots have zero intensity; none casts an extra shadow map. Daylight hides the whole rig,
 * since zero-intensity lights still cost every lit fragment; the first dusk compiles its variant.
 */
export class EarthNightLighting {
  readonly object: THREE.Group = new THREE.Group();
  private readonly streets: THREE.PointLight[] = [];
  private readonly beams: THREE.SpotLight[] = [];
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly frontMaterial = new THREE.MeshBasicMaterial({ color: '#fff1ce' });
  private readonly rearMaterial = new THREE.MeshBasicMaterial({ color: '#ed2415' });
  private readonly front = new THREE.InstancedMesh(this.geometry, this.frontMaterial, MAX_CARS * 2);
  private readonly rear = new THREE.InstancedMesh(this.geometry, this.rearMaterial, MAX_CARS * 2);
  private readonly point = new THREE.Vector3();
  private readonly lensOrigin = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly toRoot = new THREE.Matrix4();
  private disposed = false;
  private readonly tailTint = new THREE.Color();
  private readonly sourceMatrix = new THREE.Matrix4();
  private streetKeys: string[] = [];
  /** Street lights lit by the last choice, the first of `streets`. */
  private streetCount = 0;
  private streetsChosenAt = Number.NEGATIVE_INFINITY;
  /** Camera x, z and focus x, z of the last choice. */
  private streetsChosenFrom: [number, number, number, number] = [
    Number.POSITIVE_INFINITY,
    0,
    Number.POSITIVE_INFINITY,
    0,
  ];
  private readonly lampSlots: LampSlot[] = [];
  /** Where each tile's lamps are, in the tile's own frame: worked out once per tile. */
  private readonly lampBounds = new WeakMap<
    readonly TerrainStreetLight[],
    { center: THREE.Vector3; radius: number }
  >();

  constructor(private readonly options: EarthNightLightingOptions) {
    this.object.name = 'earth:night-lighting';
    this.object.userData.walkIgnore = true;
    options.root.add(this.object);
    for (let i = 0; i < 16; i++) {
      const light = new THREE.PointLight('#ffe1a1', 0, 42, 2);
      light.name = 'earth:street-light';
      this.streets.push(light);
      this.object.add(light);
      this.lampSlots.push({ key: '', distance: 0, position: new THREE.Vector3() });
    }
    for (let i = 0; i < MAX_BEAM_CARS * 2; i++) {
      const light = new THREE.SpotLight('#fff1dc', 0, 55, Math.PI / 3, 1, 2);
      light.name = 'earth:headlight-beam';
      this.beams.push(light);
      this.object.add(light, light.target);
    }
    for (const [mesh, name] of [
      [this.front, 'headlights'],
      [this.rear, 'tail-lights'],
    ] as const) {
      mesh.name = `earth:${name}`;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.walkIgnore = true;
      mesh.userData.shadowCaster = false;
      this.object.add(mesh);
    }
  }

  update(frame: EarthNightLightingFrame): void {
    if (this.disposed) return;
    if (!Number.isFinite(frame.factor)) throw new Error('Night factor must be finite');
    const night = Math.max(0, Math.min(1, frame.factor));
    for (const light of this.streets) light.intensity = 0;
    for (const light of this.beams) light.intensity = 0;
    this.front.count = this.rear.count = 0;
    // By day the street lamps stay dark, and the next dusk chooses its lamps afresh.
    if (night === 0) {
      this.streetCount = 0;
      this.streetKeys = [];
      this.streetsChosenAt = Number.NEGATIVE_INFINITY;
    }
    // A driven vehicle with a headlight switch lights its beams whenever the switch is on, by
    // day too; everything else waits for dusk.
    const switched =
      frame.drivenVehicleId !== undefined ? this.headlightSwitch(frame.drivenVehicleId) : undefined;
    this.object.visible = night > 0 || switched === true;
    if (!this.object.visible) return;
    const { camera, direction } = frame;
    // Instance matrices are float32. Keep lenses near a local anchor so Earth coordinates
    // millions of metres from zero do not round a headlight into its bumper or the next lane.
    this.lensOrigin.set(
      ...(camera.map((value) => Math.floor(value / 256) * 256) as [number, number, number]),
    );
    this.front.position.copy(this.lensOrigin);
    this.rear.position.copy(this.lensOrigin);
    const ground = this.options.sampleHeight(camera[0], camera[2]) ?? camera[1];
    const reach =
      direction[1] < -0.05 ? Math.min(500, Math.max(0, camera[1] - ground) / -direction[1]) : 60;
    const focusX = camera[0] + direction[0] * reach;
    const focusZ = camera[2] + direction[2] * reach;
    const distance = (x: number, z: number): number =>
      Math.min(Math.hypot(x - camera[0], z - camera[2]), Math.hypot(x - focusX, z - focusZ) * 1.2);
    // By day (a driven vehicle's headlights on) the walk over the lamps is skipped.
    if (night > 0) {
      const now = performance.now();
      if (
        now - this.streetsChosenAt >= STREET_LIGHT_MS ||
        Math.hypot(camera[0] - this.streetsChosenFrom[0], camera[2] - this.streetsChosenFrom[1]) >
          STREET_LIGHT_MOVE ||
        Math.hypot(focusX - this.streetsChosenFrom[2], focusZ - this.streetsChosenFrom[3]) >
          STREET_LIGHT_MOVE
      ) {
        this.streetsChosenAt = now;
        this.streetsChosenFrom = [camera[0], camera[2], focusX, focusZ];
        this.chooseStreetLights(distance);
      }
    }
    for (let i = 0; i < this.streetCount; i++)
      (this.streets[i] as THREE.PointLight).intensity = 180 * night;

    const cars: Car[] = [];
    const { world } = this.options;
    for (const [id, transform] of world.query(Transform)) {
      // By day only a driven vehicle with its headlights on draws anything.
      if (night === 0 && id !== frame.drivenVehicleId) continue;
      const agent = world.get(id, Agent) as AmbientAgentData | undefined;
      const vehicle = world.get(id, Vehicle);
      if ((agent?.hidden && id !== frame.drivenVehicleId) || (agent && agent.kind !== 'car'))
        continue;
      const state = world.get(id, VehicleState);
      if (
        !agent &&
        (!vehicle || (id !== frame.drivenVehicleId && Math.abs(state?.speed ?? 0) < 0.1))
      )
        continue;
      const width = vehicle?.spec.width ?? agent?.width ?? 0;
      const length = vehicle?.spec.length ?? agent?.length ?? 0;
      if (!(width > 0 && length > 0)) continue;
      const d = distance(transform.pos[0], transform.pos[2]);
      if (d > 1500 && id !== frame.drivenVehicleId) continue;
      cars.push({
        id,
        position: transform.pos,
        rotation: transform.rot,
        width,
        length,
        height:
          vehicle?.spec.height ??
          this.options.vehicleHeights?.[agent?.type ?? ''] ??
          (length > 7 ? 3 : 1.5),
        braking:
          world.get(id, VehicleInput)?.brake === true || (agent !== undefined && agent.speed < 0.5),
        distance: id === frame.drivenVehicleId ? -1 : d,
        ...(vehicle?.spec.headlamps !== undefined ? { headlamps: vehicle.spec.headlamps } : {}),
        ...(id === frame.drivenVehicleId && switched !== undefined ? { switched } : {}),
      });
    }
    cars.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    const selected = cars.slice(0, MAX_CARS);
    this.frontMaterial.color.set('#fff1ce').multiplyScalar(night);
    this.rearMaterial.color.set('#ed2415').multiplyScalar(night);
    let fronts = 0,
      rears = 0,
      beams = 0;
    const place = (car: Car, x: number, y: number, z: number): void => {
      this.point
        .set(x, y, z)
        .applyQuaternion(this.rotation)
        .add(this.carPosition(car.position))
        .sub(this.lensOrigin);
    };
    for (const [i, car] of selected.entries()) {
      this.rotation.fromArray(car.rotation);
      const height = Math.min(1.25, car.height * 0.44);
      const width = Math.min(0.48, car.width * 0.23);
      // Tail lamps: a pair at the back, lit from dusk.
      if (night > 0)
        for (const side of [-1, 1]) {
          this.scale.set(width, 0.16, 0.06);
          this.rear.setColorAt(rears, this.tailTint.setScalar(car.braking ? 2 : 1));
          place(car, side * car.width * 0.31, height, -(car.length / 2 + 0.055));
          this.rear.setMatrixAt(
            rears++,
            this.matrix.compose(this.point, this.rotation, this.scale),
          );
        }
      // Headlamps: where the type says, else a pair guessed from the body. A switch, when the
      // driven vehicle has one, decides; otherwise they light at dusk.
      const lit = car.switched ?? night > 0;
      if (!lit) continue;
      const lamps: readonly (readonly [number, number, number])[] = car.headlamps ?? [
        [-car.width * 0.31, height, car.length / 2 + 0.055],
        [car.width * 0.31, height, car.length / 2 + 0.055],
      ];
      const strength = 35 * (car.switched === true ? Math.max(night, SWITCHED_BEAM_FLOOR) : night);
      for (const [x, y, z] of lamps.slice(0, 2)) {
        place(car, x, y, z);
        // The switched vehicle's own model shows its lit lenses.
        if (car.switched === undefined) {
          if (car.headlamps) this.scale.set(0.15, 0.12, 0.06);
          else this.scale.set(width, 0.16, 0.06);
          this.front.setMatrixAt(
            fronts++,
            this.matrix.compose(this.point, this.rotation, this.scale),
          );
        }
        const beam = this.beams[beams];
        if (beam && car.distance < 400 && i < MAX_BEAM_CARS) {
          // The lens and beam share an origin, including chassis pitch and floating origins.
          // A broad, feathered low beam lights the near road without a detached white hotspot.
          beam.position.copy(this.point).add(this.lensOrigin);
          beam.target.position.set(0, -6, 18).applyQuaternion(this.rotation).add(beam.position);
          beam.intensity = strength;
          beams++;
        }
      }
    }
    for (const [mesh, count] of [
      [this.front, fronts],
      [this.rear, rears],
    ] as const) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  /**
   * The driven vehicle's headlight switch: on, off, or undefined when its type has no
   * `headlights` actuator (its lamps then follow the dusk like traffic).
   */
  private headlightSwitch(id: string): boolean | undefined {
    const { world } = this.options;
    if (world.get(id, Vehicle)?.spec.actuators?.headlights === undefined) return undefined;
    const position = world.get(id, VehicleState)?.actuators?.headlights;
    return position !== undefined
      ? position > 0.5
      : world.get(id, VehicleInput)?.actuators?.headlights === true;
  }

  /**
   * Put the street lights on the lamps nearest the camera and where it looks. A city view holds
   * over ten thousand lamps: tiles none of whose lamps can be near are passed over whole, and a
   * lamp's key is made only once it is near enough to be chosen.
   */
  private chooseStreetLights(distance: (x: number, z: number) => number): void {
    const root = this.options.root;
    root.updateWorldMatrix(true, false);
    this.toRoot.copy(root.matrixWorld).invert();
    const previous = new Set(this.streetKeys);
    const slots = this.lampSlots;
    const limit = this.streets.length;
    let count = 0;
    let lastSource: THREE.Object3D | undefined;
    const enter = (source: THREE.Object3D): void => {
      if (source === lastSource) return;
      source.updateWorldMatrix(true, false);
      this.sourceMatrix.multiplyMatrices(this.toRoot, source.matrixWorld);
      lastSource = source;
    };
    this.options.surface.visitStreetLights(
      (lamp, source) => {
        enter(source);
        this.point.set(lamp.x, lamp.y - 0.2, lamp.z).applyMatrix4(this.sourceMatrix);
        const d = distance(this.point.x, this.point.z);
        if (d >= STREET_LIGHT_REACH) return;
        // The farthest lamp kept so far, once every light has one.
        const worst = count === limit ? (slots[limit - 1] as LampSlot).distance : Infinity;
        if (d * STREET_LIGHT_HOLD >= worst) return;
        // A lamp lit last time counts as nearer, so two lamps at about the same distance do not
        // trade a light back and forth.
        const key = `${source.uuid}:${lamp.x},${lamp.z}`;
        const effective = previous.has(key) ? d * STREET_LIGHT_HOLD : d;
        if (effective >= worst) return;
        let slot: LampSlot;
        if (count < limit) slot = slots[count++] as LampSlot;
        else slot = slots[limit - 1] as LampSlot;
        // Kept in order of distance; lamps equally far stay in the order visited.
        let index = count - 1;
        while (index > 0 && (slots[index - 1] as LampSlot).distance > effective) {
          slots[index] = slots[index - 1] as LampSlot;
          index--;
        }
        slots[index] = slot;
        slot.key = key;
        slot.distance = effective;
        slot.position.copy(this.point);
      },
      (lights, source) => {
        let bounds = this.lampBounds.get(lights);
        if (bounds === undefined) {
          let minX = Infinity,
            minZ = Infinity,
            maxX = -Infinity,
            maxZ = -Infinity,
            y = 0;
          for (const lamp of lights) {
            minX = Math.min(minX, lamp.x);
            maxX = Math.max(maxX, lamp.x);
            minZ = Math.min(minZ, lamp.z);
            maxZ = Math.max(maxZ, lamp.z);
            y += lamp.y / lights.length;
          }
          bounds = {
            center: new THREE.Vector3((minX + maxX) / 2, y, (minZ + maxZ) / 2),
            radius: Math.hypot(maxX - minX, maxZ - minZ) / 2,
          };
          this.lampBounds.set(lights, bounds);
        }
        enter(source);
        this.point.copy(bounds.center).applyMatrix4(this.sourceMatrix);
        // No lamp is farther than the radius from the middle; `distance` weighs the view's focus
        // by 1.2, so the radius counts for as much.
        const reach = bounds.radius * this.sourceMatrix.getMaxScaleOnAxis() * 1.2;
        return distance(this.point.x, this.point.z) - reach < STREET_LIGHT_REACH;
      },
    );
    this.streetCount = count;
    this.streetKeys = [];
    for (let i = 0; i < count; i++) {
      const slot = slots[i] as LampSlot;
      this.streetKeys.push(slot.key);
      (this.streets[i] as THREE.PointLight).position.copy(slot.position);
    }
  }

  private readonly position = new THREE.Vector3();
  private carPosition(position: readonly number[]): THREE.Vector3 {
    return this.position.fromArray(position);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    this.front.dispose();
    this.rear.dispose();
    this.geometry.dispose();
    this.frontMaterial.dispose();
    this.rearMaterial.dispose();
    for (const light of [...this.streets, ...this.beams]) light.dispose();
  }
}
