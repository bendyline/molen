/** Bounded real street/vehicle lights plus batched traffic lenses for Earth hosts. */
import type { AmbientAgentData } from '@bendyline/molen-ambient/kernel';
import { Vehicle, VehicleInput, VehicleState } from '@bendyline/molen-kernel/vehicles';
import { componentHandle, Transform, type World } from '@bendyline/molen-kernel/world';
import type { TerrainSurfaceRenderer } from '@bendyline/molen-terrain/client';
import * as THREE from 'three';

const Agent = componentHandle('ambientAgent');
const MAX_CARS = 512;
const MAX_BEAM_CARS = 4;

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

  constructor(private readonly options: EarthNightLightingOptions) {
    this.object.name = 'earth:night-lighting';
    this.object.userData.walkIgnore = true;
    options.root.add(this.object);
    for (let i = 0; i < 16; i++) {
      const light = new THREE.PointLight('#ffe1a1', 0, 42, 2);
      light.name = 'earth:street-light';
      this.streets.push(light);
      this.object.add(light);
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
    for (const light of [...this.streets, ...this.beams]) light.intensity = 0;
    this.front.count = this.rear.count = 0;
    this.object.visible = night > 0;
    if (night === 0) return;
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
    this.options.root.updateWorldMatrix(true, false);
    this.toRoot.copy(this.options.root.matrixWorld).invert();
    const lamps: { key: string; position: THREE.Vector3; distance: number }[] = [];
    const previous = new Set(this.streetKeys);
    let lastSource: THREE.Object3D | undefined;
    this.options.surface.visitStreetLights((lamp, source) => {
      if (source !== lastSource) {
        source.updateWorldMatrix(true, false);
        this.sourceMatrix.multiplyMatrices(this.toRoot, source.matrixWorld);
        lastSource = source;
      }
      this.point.set(lamp.x, lamp.y - 0.2, lamp.z).applyMatrix4(this.sourceMatrix);
      const d = distance(this.point.x, this.point.z);
      const key = `${source.uuid}:${lamp.x},${lamp.z}`;
      if (d < 600)
        lamps.push({
          key,
          position: this.point.clone(),
          distance: d * (previous.has(key) ? 0.85 : 1),
        });
    });
    lamps.sort((a, b) => a.distance - b.distance);
    this.streetKeys = lamps.slice(0, this.streets.length).map((lamp) => lamp.key);
    for (const [i, light] of this.streets.entries()) {
      const lamp = lamps[i];
      if (!lamp) break;
      light.position.copy(lamp.position);
      light.intensity = 180 * night;
    }

    const cars: Car[] = [];
    const { world } = this.options;
    for (const [id, transform] of world.query(Transform)) {
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
      });
    }
    cars.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    const selected = cars.slice(0, MAX_CARS);
    this.frontMaterial.color.set('#fff1ce').multiplyScalar(night);
    this.rearMaterial.color.set('#ed2415').multiplyScalar(night);
    for (const [i, car] of selected.entries()) {
      this.rotation.fromArray(car.rotation);
      const height = Math.min(1.25, car.height * 0.44);
      const width = Math.min(0.48, car.width * 0.23);
      for (const [sideIndex, side] of [-1, 1].entries()) {
        this.scale.set(width, 0.16, 0.06);
        this.rear.setColorAt(i * 2 + sideIndex, this.tailTint.setScalar(car.braking ? 2 : 1));
        for (const [mesh, end] of [
          [this.front, 1],
          [this.rear, -1],
        ] as const) {
          this.point.set(side * car.width * 0.31, height, end * (car.length / 2 + 0.055));
          this.point
            .applyQuaternion(this.rotation)
            .add(this.carPosition(car.position))
            .sub(this.lensOrigin);
          mesh.setMatrixAt(
            i * 2 + sideIndex,
            this.matrix.compose(this.point, this.rotation, this.scale),
          );
          const beam = this.beams[i * 2 + sideIndex];
          if (mesh === this.front && beam && car.distance < 400) {
            // The lens and beam share an origin, including chassis pitch and floating origins.
            // A broad, feathered low beam lights the near road without a detached white hotspot.
            beam.position.copy(this.point).add(this.lensOrigin);
            beam.target.position.set(0, -6, 18).applyQuaternion(this.rotation).add(beam.position);
            beam.intensity = 35 * night;
          }
        }
      }
    }
    for (const mesh of [this.front, this.rear]) {
      mesh.count = selected.length * 2;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
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
