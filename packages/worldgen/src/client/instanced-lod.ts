/** Spatial batches keep instancing while giving the camera useful culling and detail bounds. */
import * as THREE from 'three';
import { PLACEMENT_STRIDE, type PlacementSet } from '../kernel/types';
import { createInstancedPlacements } from './instanced-box';
import type { PreparedModel } from './instanced-models';
import { ScreenSpaceLod, type ScreenSpaceLodPolicy } from './screen-space-lod';

export interface InstancedPlacementLodOptions {
  /** Local meters per culling cell (default 512); `Infinity` keeps the whole set in one cell. */
  cellSize?: number;
  /** Distance from a cell's bounds before the medium/far model takes over. */
  distances?: [number, number];
  /** Projected-detail policy; when supplied it replaces fixed distance thresholds. */
  screenSpace?: ScreenSpaceLodPolicy;
}

/**
 * One instanced mesh whose shared geometry follows a projected-error LOD choice. WebGPU builds a
 * node program per InstancedMesh (Three keys instanced render objects by object), so a set drawn
 * as three level meshes paid three builds, about 10 ms of main thread each, for one visible draw.
 * Levels here share the material and attribute layout, so swapping the geometry keeps the
 * program; a level without geometry hides the mesh. The distant level never casts shadows.
 */
class InstancedDetailSwitch extends THREE.LOD {
  private selected = 0;
  private perspectiveAt = Number.NEGATIVE_INFINITY;
  private castsShadow: boolean | undefined;
  constructor(
    readonly policy: ScreenSpaceLodPolicy,
    readonly radius: number,
    readonly mesh: THREE.InstancedMesh,
    private readonly geometries: readonly (THREE.BufferGeometry | undefined)[],
    private readonly errors: readonly number[],
  ) {
    super();
    this.add(mesh);
  }

  override getCurrentLevel(): number {
    return this.selected;
  }

  override update(camera: THREE.Camera): void {
    const perspective = camera as THREE.PerspectiveCamera;
    // WebGPU renders sun shadows by projecting the scene again from the light's orthographic
    // camera, mid-frame. Selecting for it would swap the geometry the main pass then draws, so
    // only the view camera chooses: an orthographic camera counts only when it is the view.
    const now = performance.now();
    if (perspective.isPerspectiveCamera) this.perspectiveAt = now;
    else if (now - this.perspectiveAt < 250) return;
    const scale = this.matrixWorld.getMaxScaleOnAxis();
    const height = Math.max(1, this.policy.viewportHeight);
    const error = Math.max(0.1, this.policy.maxPixelError);
    let level = 0;
    if (perspective.isPerspectiveCamera) {
      const focal = height / (2 * Math.tan((perspective.fov * Math.PI) / 360));
      const distance =
        camera.getWorldPosition(cameraPosition).distanceTo(this.getWorldPosition(lodPosition)) /
        perspective.zoom;
      for (let i = 1; i < this.geometries.length; i++) {
        const threshold =
          scale * (this.radius / perspective.zoom + ((this.errors[i] ?? 0) * focal) / error);
        // 15% hysteresis toward the level already shown, as THREE.LOD does.
        if (distance >= (this.selected >= i ? threshold * 0.85 : threshold)) level = i;
        else break;
      }
    } else {
      const ortho = camera as THREE.OrthographicCamera;
      const pixelsPerMeter =
        (height * ortho.zoom) / Math.max(0.001, (ortho.top ?? 1) - (ortho.bottom ?? -1));
      for (let i = 1; i < this.geometries.length; i++) {
        const threshold = this.selected >= i ? error * 1.15 : error;
        if ((this.errors[i] ?? 0) * scale * pixelsPerMeter <= threshold) level = i;
      }
    }
    this.selected = level;
    // Decided once the host has marked this object for shadows, from the near geometry.
    this.castsShadow ??= this.mesh.castShadow;
    const geometry = this.geometries[level];
    this.mesh.visible = geometry !== undefined;
    if (geometry !== undefined && this.mesh.geometry !== geometry) this.mesh.geometry = geometry;
    this.mesh.castShadow = level < this.geometries.length - 1 && this.castsShadow;
  }
}
const cameraPosition = new THREE.Vector3();
const lodPosition = new THREE.Vector3();

/** No per-frame instance uploads: LOD switches shared models, with 15% transition hysteresis. */
export function createInstancedPlacementLod(
  set: PlacementSet,
  models: readonly [PreparedModel, PreparedModel, PreparedModel],
  options: InstancedPlacementLodOptions = {},
  name = `worldgen:${set.setId}`,
): THREE.Group {
  const size = options.cellSize ?? 512;
  const distances = options.distances ?? [180, 650];
  if (
    !(size > 0) ||
    !distances.every(Number.isFinite) ||
    distances[0] < 0 ||
    distances[1] <= distances[0]
  ) {
    throw new Error('instance LOD needs a positive cell size and increasing nonnegative distances');
  }
  const cells = new Map<string, number[]>();
  for (let i = 0; i < set.count; i++) {
    const offset = i * PLACEMENT_STRIDE;
    const key = `${Math.floor((set.data[offset] as number) / size)}/${Math.floor((set.data[offset + 2] as number) / size)}`;
    const cell = cells.get(key) ?? [];
    cell.push(i);
    cells.set(key, cell);
  }
  const group = new THREE.Group();
  group.name = name;
  // A model that is near detail only (ground cover) draws nothing at its later levels.
  const drawn = (model: PreparedModel): boolean =>
    model.geometry.getAttribute('position').count > 0;
  if (!drawn(models[0])) return group;
  for (const [key, indices] of cells) {
    const data = new Float32Array(indices.length * PLACEMENT_STRIDE);
    indices.forEach((index, i) => {
      data.set(
        set.data.subarray(index * PLACEMENT_STRIDE, (index + 1) * PLACEMENT_STRIDE),
        i * PLACEMENT_STRIDE,
      );
    });
    const subset = { ...set, count: indices.length, data };
    const first = createInstancedPlacements(
      subset,
      models[0].geometry,
      models[0].material,
      `${name}:${key}:near`,
    );
    first.computeBoundingBox();
    const center = (first.boundingBox as THREE.Box3).getCenter(new THREE.Vector3());
    // Localize the instances around the LOD origin so floating-origin rebasing is automatic.
    for (let i = 0; i < indices.length; i++) {
      const offset = i * 16;
      first.instanceMatrix.array[offset + 12] =
        (first.instanceMatrix.array[offset + 12] as number) - center.x;
      first.instanceMatrix.array[offset + 13] =
        (first.instanceMatrix.array[offset + 13] as number) - center.y;
      first.instanceMatrix.array[offset + 14] =
        (first.instanceMatrix.array[offset + 14] as number) - center.z;
    }
    first.computeBoundingBox();
    first.computeBoundingSphere();
    const radius = first.boundingSphere?.radius ?? 0;
    let largestScale = 0;
    for (let i = 0; i < indices.length; i++) {
      const offset = i * PLACEMENT_STRIDE;
      largestScale = Math.max(
        largestScale,
        Math.abs(data[offset + 4] as number),
        Math.abs(data[offset + 5] as number),
        Math.abs(data[offset + 6] as number),
      );
    }
    if (options.screenSpace) {
      const geometries: (THREE.BufferGeometry | undefined)[] = [models[0].geometry];
      const errors = [0];
      for (let level = 1; level < models.length; level++) {
        const model = models[level] as PreparedModel;
        if (model.geometry === models[level - 1]?.geometry) continue;
        geometries.push(drawn(model) ? model.geometry : undefined);
        errors.push(([0.45, 2][level - 1] as number) * largestScale);
        if (!drawn(model)) break;
      }
      const lod = new InstancedDetailSwitch(options.screenSpace, radius, first, geometries, errors);
      lod.name = `${name}:${key}`;
      lod.position.copy(center);
      group.add(lod);
      lod.traverse((object) => {
        object.updateMatrix();
        object.matrixAutoUpdate = false;
      });
      continue;
    }
    const lod = options.screenSpace
      ? new ScreenSpaceLod(options.screenSpace, radius)
      : new THREE.LOD();
    lod.name = `${name}:${key}`;
    lod.position.copy(center);
    lod.updateMatrix();
    lod.matrixAutoUpdate = false;
    if (lod instanceof ScreenSpaceLod) lod.addDetail(first, 0);
    else lod.addLevel(first, 0);
    for (let level = 1; level < models.length; level++) {
      const model = models[level] as PreparedModel;
      if (model.geometry === models[level - 1]?.geometry) continue;
      if (!drawn(model)) {
        const nothing = new THREE.Group();
        nothing.name = `${name}:${key}:lod${level}`;
        nothing.visible = false;
        if (lod instanceof ScreenSpaceLod)
          lod.addDetail(nothing, ([0.45, 2][level - 1] as number) * largestScale);
        else lod.addLevel(nothing, (distances[level - 1] as number) + radius, 0.15);
        break;
      }
      const mesh = new THREE.InstancedMesh(model.geometry, model.material, 0);
      mesh.count = first.count;
      mesh.instanceMatrix = first.instanceMatrix;
      mesh.instanceColor = first.instanceColor;
      mesh.name = `${name}:${key}:lod${level}`;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      // The distant level stands kilometers out, past the camera-following shadow map, yet a
      // batch kilometers across still overlaps the shadow frustum; keep it out of the shadow pass.
      if (level === models.length - 1) mesh.userData.shadowCaster = false;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      if (lod instanceof ScreenSpaceLod) {
        lod.addDetail(mesh, ([0.45, 2][level - 1] as number) * largestScale);
      } else lod.addLevel(mesh, (distances[level - 1] as number) + radius, 0.15);
      mesh.visible = false;
    }
    group.add(lod);
    lod.traverse((object) => {
      object.updateMatrix();
      object.matrixAutoUpdate = false;
    });
  }
  return group;
}
