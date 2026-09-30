/**
 * Instanced proxies: one `InstancedMesh` per proxy shape and size, refilled every frame from the
 * live agents. Matrices are relative to an anchor near the camera (float32 instance matrices lose
 * precision at Web Mercator magnitudes); the anchor group sits at the anchor in absolute
 * coordinates, so the renderer's floating origin never needs a re-upload.
 */

import { vehicleProxyMaterial } from '@bendyline/molen-client/vehicles';
import * as THREE from 'three';
import { type ProxyDimensions, type ProxyShape, proxyGeometry, proxyKey } from './proxies';

interface Batch {
  mesh: THREE.InstancedMesh;
  count: number;
}

const ANCHOR_STEP = 250;

export interface ProxyInstance {
  shape: ProxyShape;
  dims: ProxyDimensions;
  pos: readonly [number, number, number];
  rot: readonly [number, number, number, number];
  scale: number;
  color: THREE.Color;
}

export class ProxyBatches {
  readonly group: THREE.Group = new THREE.Group();
  private readonly batches = new Map<string, Batch>();
  private readonly anchor = new THREE.Vector3(Number.NaN, 0, Number.NaN);
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();

  constructor(
    private readonly prepare?: (object: THREE.Object3D) => void,
    private readonly initialCapacity = 64,
  ) {
    this.group.name = 'ambient:proxies';
  }

  /** Start a frame: keep the anchor within a few hundred metres of the camera. */
  begin(camera: readonly [number, number, number]): void {
    if (
      !Number.isFinite(this.anchor.x) ||
      Math.abs(camera[0] - this.anchor.x) > ANCHOR_STEP ||
      Math.abs(camera[2] - this.anchor.z) > ANCHOR_STEP
    ) {
      this.anchor.set(
        Math.round(camera[0] / ANCHOR_STEP) * ANCHOR_STEP,
        0,
        Math.round(camera[2] / ANCHOR_STEP) * ANCHOR_STEP,
      );
      this.group.position.copy(this.anchor);
    }
    for (const batch of this.batches.values()) batch.count = 0;
  }

  add(instance: ProxyInstance): void {
    const key = proxyKey(instance.shape, instance.dims);
    let batch = this.batches.get(key);
    if (batch === undefined || batch.count >= batch.mesh.instanceMatrix.count) {
      batch = this.grow(key, instance, batch);
    }
    this.position.set(
      instance.pos[0] - this.anchor.x,
      instance.pos[1] - this.anchor.y,
      instance.pos[2] - this.anchor.z,
    );
    this.quaternion.set(instance.rot[0], instance.rot[1], instance.rot[2], instance.rot[3]);
    this.scale.setScalar(instance.scale);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    batch.mesh.setMatrixAt(batch.count, this.matrix);
    batch.mesh.setColorAt(batch.count, instance.color);
    batch.count++;
  }

  /** Finish a frame: upload what changed and cull empty batches from drawing. */
  end(): number {
    let total = 0;
    for (const batch of this.batches.values()) {
      const mesh = batch.mesh;
      mesh.count = batch.count;
      mesh.visible = batch.count > 0;
      total += batch.count;
      if (batch.count === 0) continue;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, batch.count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor !== null) {
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, batch.count * 3);
        mesh.instanceColor.needsUpdate = true;
      }
      mesh.computeBoundingSphere();
    }
    return total;
  }

  private grow(key: string, instance: ProxyInstance, previous: Batch | undefined): Batch {
    const capacity =
      previous === undefined ? this.initialCapacity : previous.mesh.instanceMatrix.count * 2;
    const geometry = proxyGeometry(instance.shape, instance.dims);
    const mesh = new THREE.InstancedMesh(geometry, vehicleProxyMaterial, capacity);
    mesh.name = `ambient:${key}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.walkIgnore = true;
    mesh.count = 0;
    const batch: Batch = { mesh, count: previous?.count ?? 0 };
    if (previous !== undefined) {
      for (let i = 0; i < previous.count; i++) {
        previous.mesh.getMatrixAt(i, this.matrix);
        mesh.setMatrixAt(i, this.matrix);
        const color = new THREE.Color();
        previous.mesh.getColorAt(i, color);
        mesh.setColorAt(i, color);
      }
      previous.mesh.removeFromParent();
      previous.mesh.dispose();
    }
    this.group.add(mesh);
    this.batches.set(key, batch);
    this.prepare?.(mesh);
    return batch;
  }

  /** Number of instanced meshes (draw calls when all are populated). */
  get meshCount(): number {
    return this.batches.size;
  }

  dispose(): void {
    for (const batch of this.batches.values()) {
      batch.mesh.removeFromParent();
      batch.mesh.dispose();
    }
    this.batches.clear();
    this.group.removeFromParent();
  }
}
