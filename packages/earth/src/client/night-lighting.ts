/** Street lamp and car beam light through the renderer's lamp field, plus batched car lenses. */
import type { AmbientAgentData } from '@bendyline/molen-ambient/kernel';
import type { LampField, LampFieldBeam } from '@bendyline/molen-client';
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
/** A street lamp's light, candela at full night (a point light's intensity before the field). */
const STREET_LAMP_CANDELA = 180;
/** A headlight beam's, candela on its axis. */
const BEAM_CANDELA = 35;
/** Lamps the field holds, nearest first (LAMP_FIELD_MAX_LAMPS). */
const MAX_LAMPS = 1024;
/**
 * Lamps are handed over this far past where the field fades them out, m, so a lamp that joins
 * between two choices (the camera moves STREET_LIGHT_MOVE at most) joins dark.
 */
const STREET_LIGHT_MARGIN = 16;
/**
 * From the air the lit lamps reach farther: the field's fade distance plus the camera's height
 * above the ground, up to this many times the fade distance. From 300 m, a field reaching 300 m
 * lit the streets below and left a ring of unlit pavement pools around them.
 */
const STREET_LIGHT_AIR_REACH = 3;
/**
 * The lamps are chosen again after this long, ms (scenery streams in and out), or as soon as the
 * camera or the point it looks at has moved STREET_LIGHT_MOVE meters: four times a second for a
 * view held still, and no later than 8 m on for one that travels or turns. Chosen every frame,
 * the walk over a city's lamps took 50 ms of each second of a night flight over Osaka (12,900
 * lamps on show, a key string made for each).
 */
const STREET_LIGHT_MS = 250;
const STREET_LIGHT_MOVE = 8;

/** What the night lighting needs of the renderer's lamp field (`Renderer.lampField`). */
export type EarthLampField = Pick<
  LampField,
  'setLamps' | 'setView' | 'setBeams' | 'clear' | 'fadeTo' | 'focusWeight'
>;

export interface EarthNightLightingOptions {
  /** Parent in absolute simulation coordinates, normally the terrain stream object. */
  root: THREE.Object3D;
  world: World;
  surface: Pick<TerrainSurfaceRenderer, 'visitStreetLights'>;
  /**
   * The renderer's lamp field (`Renderer.lampField`), through which street lamps and car beams
   * light every lit surface near the camera. Without it they show only their own glow, pavement
   * pools and lenses.
   */
  lampField?: EarthLampField;
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
 * Every street lamp near the camera, and four pairs of car beams, light the world through the
 * renderer's lamp field: no three light, so they cost a few lookups in each lit fragment rather
 * than a full light each, and nightfall compiles nothing. The field fades lamps out with
 * distance, so none switches on as the camera nears it.
 */
export class EarthNightLighting {
  readonly object: THREE.Group = new THREE.Group();
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
  private readonly aim = new THREE.Vector3();
  private disposed = false;
  private readonly tailTint = new THREE.Color();
  private readonly sourceMatrix = new THREE.Matrix4();
  /** Lamps handed to the field by the last choice. */
  private streetCount = 0;
  /** Whether the field was left dark (by day, with no switched beams). */
  private fieldDark = true;
  private streetsChosenAt = Number.NEGATIVE_INFINITY;
  /** Camera x, z and focus x, z of the last choice. */
  private streetsChosenFrom: [number, number, number, number] = [
    Number.POSITIVE_INFINITY,
    0,
    Number.POSITIVE_INFINITY,
    0,
  ];
  /** The point (root frame) the chosen lamps are measured from: the camera when chosen. */
  private readonly anchor: [number, number, number] = [0, 0, 0];
  /** Candidates of a choice, root frame: x, y, z each, and their distance. */
  private candidates: number[] = [];
  private candidateDistances: number[] = [];
  private order: number[] = [];
  private readonly lampData = new Float32Array(MAX_LAMPS * 4);
  /** Where each tile's lamps are, in the tile's own frame: worked out once per tile. */
  private readonly lampBounds = new WeakMap<
    readonly TerrainStreetLight[],
    { center: THREE.Vector3; radius: number }
  >();

  constructor(private readonly options: EarthNightLightingOptions) {
    this.object.name = 'earth:night-lighting';
    this.object.userData.walkIgnore = true;
    options.root.add(this.object);
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

  /** Street lamps lighting the world: handed to the lamp field by the last choice. */
  get streetLamps(): number {
    return this.streetCount;
  }

  update(frame: EarthNightLightingFrame): void {
    if (this.disposed) return;
    if (!Number.isFinite(frame.factor)) throw new Error('Night factor must be finite');
    const night = Math.max(0, Math.min(1, frame.factor));
    const field = this.options.lampField;
    this.front.count = this.rear.count = 0;
    // By day the street lamps stay dark, and the next dusk chooses its lamps afresh.
    if (night === 0) {
      this.streetCount = 0;
      this.streetsChosenAt = Number.NEGATIVE_INFINITY;
    }
    // A driven vehicle with a headlight switch lights its beams whenever the switch is on, by
    // day too; everything else waits for dusk.
    const switched =
      frame.drivenVehicleId !== undefined ? this.headlightSwitch(frame.drivenVehicleId) : undefined;
    this.object.visible = night > 0 || switched === true;
    if (!this.object.visible) {
      if (!this.fieldDark) field?.clear();
      this.fieldDark = true;
      return;
    }
    this.fieldDark = false;
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
    const focusWeight = field?.focusWeight ?? 1.2;
    const distance = (x: number, z: number): number =>
      Math.min(
        Math.hypot(x - camera[0], z - camera[2]),
        Math.hypot(x - focusX, z - focusZ) * focusWeight,
      );
    // By day (a driven vehicle's headlights on) the walk over the lamps is skipped.
    if (field !== undefined) {
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
          this.chooseStreetLights(field, camera, camera[1] - ground, distance);
        }
      } else if (this.streetCount === 0) {
        // No lamps to keep the anchor for: the beams are measured from the camera.
        this.anchor[0] = camera[0];
        this.anchor[1] = camera[1];
        this.anchor[2] = camera[2];
      }
      field.setView({
        frame: this.options.root,
        anchor: this.anchor,
        eye: camera,
        focus: [focusX, ground, focusZ],
        intensity: STREET_LAMP_CANDELA * night,
      });
    }

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
      rears = 0;
    const beams: LampFieldBeam[] = [];
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
      const strength =
        BEAM_CANDELA * (car.switched === true ? Math.max(night, SWITCHED_BEAM_FLOOR) : night);
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
        if (car.distance < 400 && i < MAX_BEAM_CARS) {
          // The lens and beam share an origin, including chassis pitch and floating origins.
          // A broad, feathered low beam lights the near road without a detached white hotspot.
          this.aim.set(0, -6, 18).applyQuaternion(this.rotation).normalize();
          beams.push({
            position: [
              this.point.x + this.lensOrigin.x,
              this.point.y + this.lensOrigin.y,
              this.point.z + this.lensOrigin.z,
            ],
            direction: [this.aim.x, this.aim.y, this.aim.z],
            intensity: strength,
          });
        }
      }
    }
    field?.setBeams(beams);
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
   * Hand the field the lamps near the camera and where it looks, nearest first. A city view holds
   * over ten thousand lamps: tiles none of whose lamps can be near are passed over whole.
   */
  private chooseStreetLights(
    field: EarthLampField,
    camera: readonly [number, number, number],
    /** The camera's height above the ground, m. */
    above: number,
    distance: (x: number, z: number) => number,
  ): void {
    const root = this.options.root;
    root.updateWorldMatrix(true, false);
    this.toRoot.copy(root.matrixWorld).invert();
    let fadeTo = Math.min(field.fadeTo * STREET_LIGHT_AIR_REACH, field.fadeTo + Math.max(0, above));
    const limit = fadeTo + STREET_LIGHT_MARGIN;
    const candidates = this.candidates;
    const distances = this.candidateDistances;
    candidates.length = 0;
    distances.length = 0;
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
        if (d >= limit) return;
        candidates.push(this.point.x, this.point.y, this.point.z);
        distances.push(d);
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
        // by up to 1.2, so the radius counts for as much.
        const reach = bounds.radius * this.sourceMatrix.getMaxScaleOnAxis() * 1.2;
        return distance(this.point.x, this.point.z) - reach < limit;
      },
    );
    const total = distances.length;
    const order = this.order;
    order.length = total;
    for (let i = 0; i < total; i++) order[i] = i;
    // Nearest first only when there are more than the field holds; lamps equally far stay in the
    // order visited.
    if (total > MAX_LAMPS) {
      order.sort((a, b) => (distances[a] as number) - (distances[b] as number) || a - b);
      // The farthest kept fade out by where the field stops, rather than end there.
      fadeTo = Math.min(fadeTo, distances[order[MAX_LAMPS] as number] as number);
    }
    const count = Math.min(total, MAX_LAMPS);
    // Measured from the camera, so each offset is small enough for float32.
    this.anchor[0] = camera[0];
    this.anchor[1] = camera[1];
    this.anchor[2] = camera[2];
    const data = this.lampData;
    for (let i = 0; i < count; i++) {
      const at = (order[i] as number) * 3;
      data[i * 4] = (candidates[at] as number) - camera[0];
      data[i * 4 + 1] = (candidates[at + 1] as number) - camera[1];
      data[i * 4 + 2] = (candidates[at + 2] as number) - camera[2];
      data[i * 4 + 3] = 1;
    }
    field.setLamps(data, count, fadeTo);
    this.streetCount = count;
  }

  private readonly position = new THREE.Vector3();
  private carPosition(position: readonly number[]): THREE.Vector3 {
    return this.position.fromArray(position);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    this.options.lampField?.clear();
    this.front.dispose();
    this.rear.dispose();
    this.geometry.dispose();
    this.frontMaterial.dispose();
    this.rearMaterial.dispose();
  }
}
