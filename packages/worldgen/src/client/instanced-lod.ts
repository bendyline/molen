/** Spatial batches keep instancing while giving the camera useful culling and detail bounds. */
import * as THREE from 'three';
import { PLACEMENT_STRIDE, type PlacementSet } from '../kernel/types';
import { createInstancedPlacements } from './instanced-box';
import type { PreparedModel } from './instanced-models';
import { ScreenSpaceLod, type ScreenSpaceLodPolicy } from './screen-space-lod';

export interface InstancedPlacementLodOptions {
  /** Local meters per culling cell (default 512). */
  cellSize?: number;
  /** Distance from a cell's bounds before the medium/far model takes over. */
  distances?: [number, number];
  /** Projected-detail policy; when supplied it replaces fixed distance thresholds. */
  screenSpace?: ScreenSpaceLodPolicy;
}

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
    !Number.isFinite(size) ||
    size <= 0 ||
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
    const lod = options.screenSpace
      ? new ScreenSpaceLod(options.screenSpace, radius)
      : new THREE.LOD();
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
    lod.name = `${name}:${key}`;
    lod.position.copy(center);
    lod.updateMatrix();
    lod.matrixAutoUpdate = false;
    if (lod instanceof ScreenSpaceLod) lod.addDetail(first, 0);
    else lod.addLevel(first, 0);
    for (let level = 1; level < models.length; level++) {
      const model = models[level] as PreparedModel;
      if (model.geometry === models[level - 1]?.geometry) continue;
      const mesh = new THREE.InstancedMesh(model.geometry, model.material, 0);
      mesh.count = first.count;
      mesh.instanceMatrix = first.instanceMatrix;
      mesh.instanceColor = first.instanceColor;
      mesh.name = `${name}:${key}:lod${level}`;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
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
