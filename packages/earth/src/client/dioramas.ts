import type { AssetCache } from '@bendyline/molen-client';
import {
  createDioramaVisual,
  DioramaDirector,
  type DioramaLoader,
  type DioramaStatus,
} from '@bendyline/molen-dioramas/client';
import type { Vec3 } from '@bendyline/molen-schema';
import type * as THREE from 'three';

/** Geographic placement of a trusted, lazily loaded scene. Local axes are east/up/south. */
export interface EarthDioramaSpec {
  id: string;
  latitude: number;
  longitude: number;
  /** Absolute altitude in world meters; omitted waits for streamed ground. */
  altitude?: number;
  /** Local X/Z half-extents. Anchor above nine terrain samples; author a buried foundation. */
  groundFootprint?: [number, number];
  /** Radians about Y. Local +Z rotates toward east. */
  yaw?: number;
  load: DioramaLoader;
  enterDistance?: number;
  exitDistance?: number;
  active?: (timeMs: number) => boolean;
}

export interface EarthDioramaOptions {
  placements?: readonly EarthDioramaSpec[];
  maxActive?: number;
  /** Optional host-owned glTF cache for dioramas that reference vehicle/prop models. */
  assets?: AssetCache;
}

export interface EarthDioramas {
  add(spec: EarthDioramaSpec): void;
  remove(id: string): void;
  list(): readonly string[];
  status(id: string): DioramaStatus | undefined;
  retry(id: string): void;
}

/** Earth policy: retain geographic registrations across terrain re-anchors. */
export class EarthDioramaDirector implements EarthDioramas {
  private readonly specs = new Map<string, EarthDioramaSpec>();
  private director: DioramaDirector | undefined;
  private root: THREE.Object3D | undefined;
  private disposed = false;
  private readonly anchors = new Map<string, Vec3>();

  constructor(
    private readonly options: EarthDioramaOptions,
    private readonly onError: (error: unknown, id: string) => void,
  ) {
    if (
      options.maxActive !== undefined &&
      (!Number.isSafeInteger(options.maxActive) || options.maxActive < 0)
    )
      throw new Error('Diorama maxActive must be a nonnegative integer');
    for (const spec of options.placements ?? []) this.add(spec);
  }

  add(spec: EarthDioramaSpec): void {
    if (this.disposed) throw new Error('Earth dioramas are disposed');
    if (!spec.id || this.specs.has(spec.id))
      throw new Error(`Duplicate or empty diorama id: ${spec.id}`);
    if (
      !Number.isFinite(spec.latitude) ||
      Math.abs(spec.latitude) > 90 ||
      !Number.isFinite(spec.longitude) ||
      Math.abs(spec.longitude) > 180 ||
      !Number.isFinite(spec.altitude ?? 0) ||
      !Number.isFinite(spec.yaw ?? 0)
    )
      throw new Error('Invalid diorama geographic position');
    if (
      spec.groundFootprint &&
      (spec.groundFootprint.length !== 2 ||
        spec.groundFootprint.some((n) => !Number.isFinite(n) || n <= 0))
    )
      throw new Error('Diorama ground footprint needs positive X/Z half-extents');
    // Check distance options immediately, even if this place's terrain is not loaded yet.
    const check = new DioramaDirector({
      create: () => {
        throw new Error('validation only');
      },
    });
    check.add({ ...spec, position: [0, 0, 0] });
    check.dispose();
    this.specs.set(spec.id, { ...spec });
  }
  remove(id: string): void {
    this.specs.delete(id);
    this.anchors.delete(id);
    this.director?.remove(id);
  }
  list(): readonly string[] {
    return [...this.specs.keys()];
  }
  status(id: string): DioramaStatus | undefined {
    return this.director?.status(id) ?? (this.specs.has(id) ? 'idle' : undefined);
  }
  retry(id: string): void {
    this.director?.retry(id);
  }

  update(frame: {
    root: THREE.Object3D;
    camera: THREE.Camera;
    position: Vec3;
    dt: number;
    timeMs: number;
    toWorld: (latitude: number, longitude: number) => [number, number];
    groundHeight: (x: number, z: number) => number | undefined;
  }): void {
    if (this.disposed) return;
    if (this.root !== frame.root) {
      this.director?.dispose();
      this.root = frame.root;
      this.anchors.clear();
      this.director = new DioramaDirector({
        maxActive: this.options.maxActive,
        create: (definition, placement) =>
          createDioramaVisual(definition, placement, {
            root: frame.root,
            camera: frame.camera,
            assets: this.options.assets,
          }),
        onError: this.onError,
      });
    }
    const director = this.director as DioramaDirector;
    for (const spec of this.specs.values()) {
      const [x, z] = frame.toWorld(spec.latitude, spec.longitude);
      if (
        Math.hypot(x - frame.position[0], z - frame.position[2]) >
        (spec.exitDistance ?? (spec.enterDistance ?? 350) * 1.2) + 100
      )
        continue;
      let y = spec.altitude ?? frame.groundHeight(x, z);
      if (spec.altitude === undefined && spec.groundFootprint) {
        const heights: number[] = [];
        const [hx, hz] = spec.groundFootprint;
        const cos = Math.cos(spec.yaw ?? 0),
          sin = Math.sin(spec.yaw ?? 0);
        for (const dx of [-hx, 0, hx])
          for (const dz of [-hz, 0, hz]) {
            const height = frame.groundHeight(x + cos * dx + sin * dz, z - sin * dx + cos * dz);
            if (height !== undefined && Number.isFinite(height)) heights.push(height);
          }
        y = heights.length === 9 ? Math.max(...heights) + 0.15 : undefined;
      }
      if (y === undefined || !Number.isFinite(y)) continue;
      const previous = this.anchors.get(spec.id);
      const position: Vec3 = [x, y, z];
      if (director.status(spec.id) === undefined) {
        director.add({ ...spec, position });
        this.anchors.set(spec.id, position);
      } else if (!previous || Math.abs(y - previous[1]) > 0.05) {
        director.setPosition(spec.id, position);
        this.anchors.set(spec.id, position);
      }
    }
    director.update(frame.position, frame.dt, frame.timeMs);
  }

  dispose(): void {
    this.disposed = true;
    this.director?.dispose();
    this.specs.clear();
    this.anchors.clear();
  }
}
