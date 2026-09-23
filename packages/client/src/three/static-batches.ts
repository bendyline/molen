import type { EntityId } from '@bendyline/molen-schema';
import * as THREE from 'three';

export interface StaticBatchOptions {
  cellSize?: number;
  minInstances?: number;
}
interface Member {
  id: EntityId;
  mesh: THREE.Mesh;
  matrix: THREE.Matrix4;
  visible: boolean;
  key: string;
}
interface Batch {
  revision?: number;
  members: Set<Member>;
  object?: THREE.InstancedMesh;
}

/** Only renderer-owned, opaque, nonanimated meshes are admitted. Originals retain entity identity. */
export class StaticMeshBatches {
  private readonly pending = new Set<Promise<void>>();
  private readonly entities = new Map<EntityId, Member[]>();
  private readonly batches = new Map<string, Batch>();
  private readonly dirty = new Set<string>();
  private readonly cellSize: number;
  private readonly minimum: number;
  constructor(
    private readonly root: THREE.Object3D,
    options: StaticBatchOptions = {},
    private readonly prepare?: (object: THREE.Object3D) => Promise<void>,
  ) {
    this.cellSize = options.cellSize ?? 32;
    this.minimum = options.minInstances ?? 2;
    if (
      !Number.isFinite(this.cellSize) ||
      this.cellSize <= 0 ||
      !Number.isInteger(this.minimum) ||
      this.minimum < 2
    )
      throw new RangeError(
        'Static batching requires a positive cell size and at least two instances',
      );
  }
  add(id: EntityId, object: THREE.Object3D): void {
    this.remove(id);
    if (!object.visible) return;
    this.root.updateWorldMatrix(true, false);
    object.updateWorldMatrix(true, true);
    const inverse = this.root.matrixWorld.clone().invert();
    const entries: Member[] = [];
    object.traverseVisible((child) => {
      const mesh = child as THREE.Mesh;
      if (
        !mesh.isMesh ||
        (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
        (mesh as THREE.InstancedMesh).isInstancedMesh ||
        mesh.morphTargetInfluences ||
        mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender ||
        mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender
      )
        return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (
        materials.some(
          (m) =>
            m.transparent ||
            !m.depthWrite ||
            !m.depthTest ||
            (m as THREE.MeshPhysicalMaterial).transmission > 0 ||
            (m as THREE.ShaderMaterial).isShaderMaterial ||
            (m as THREE.Material & { isNodeMaterial?: boolean }).isNodeMaterial ||
            m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile,
        )
      )
        return;
      const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
      if (matrix.determinant() <= 0) return;
      const e = matrix.elements;
      const cell = [
        Math.floor((e[12] as number) / this.cellSize),
        Math.floor((e[13] as number) / this.cellSize),
        Math.floor((e[14] as number) / this.cellSize),
      ].join('/');
      const key = `${cell}|${mesh.geometry.uuid}|${materials.map((m) => m.uuid).join(',')}|${mesh.castShadow}/${mesh.receiveShadow}/${mesh.layers.mask}/${mesh.renderOrder}`;
      const entry = { id, mesh, matrix, visible: mesh.visible, key };
      let batch = this.batches.get(key);
      if (!batch) {
        batch = { members: new Set() };
        this.batches.set(key, batch);
      }
      batch.members.add(entry);
      entries.push(entry);
      this.dirty.add(key);
    });
    this.entities.set(id, entries);
  }
  remove(id: EntityId): void {
    for (const entry of this.entities.get(id) ?? []) {
      entry.mesh.visible = entry.visible;
      this.batches.get(entry.key)?.members.delete(entry);
      this.dirty.add(entry.key);
    }
    this.entities.delete(id);
  }
  flush(): void {
    for (const key of this.dirty) {
      const batch = this.batches.get(key);
      if (!batch) continue;
      const revision = (batch.revision ?? 0) + 1;
      batch.revision = revision;
      batch.object?.removeFromParent();
      batch.object?.dispose();
      delete batch.object;
      const entries = [...batch.members];
      for (const entry of entries) entry.mesh.visible = entry.visible;
      if (entries.length === 0) {
        this.batches.delete(key);
        continue;
      }
      if (entries.length < this.minimum) {
        for (const e of entries) e.mesh.visible = e.visible;
        continue;
      }
      const first = entries[0] as Member;
      const object = new THREE.InstancedMesh(
        first.mesh.geometry,
        first.mesh.material,
        entries.length,
      );
      object.name = `molen:static:${key}`;
      object.castShadow = first.mesh.castShadow;
      object.receiveShadow = first.mesh.receiveShadow;
      object.layers.mask = first.mesh.layers.mask;
      object.renderOrder = first.mesh.renderOrder;
      const cell = key.split('|')[0]?.split('/').map(Number) as number[];
      object.position.set(
        (cell[0] as number) * this.cellSize,
        (cell[1] as number) * this.cellSize,
        (cell[2] as number) * this.cellSize,
      );
      const offset = new THREE.Matrix4().makeTranslation(
        -object.position.x,
        -object.position.y,
        -object.position.z,
      );
      const matrix = new THREE.Matrix4();
      const ids: EntityId[] = [];
      entries.forEach((entry, i) => {
        object.setMatrixAt(i, matrix.multiplyMatrices(offset, entry.matrix));
        ids.push(entry.id);
      });
      object.userData.molenEntityIds = ids;
      object.updateMatrix();
      object.matrixAutoUpdate = false;
      object.instanceMatrix.needsUpdate = true;
      object.computeBoundingBox();
      object.computeBoundingSphere();
      const publish = (): void => {
        if (this.batches.get(key) !== batch || batch.revision !== revision) {
          object.dispose();
          return;
        }
        for (const entry of entries) entry.mesh.visible = false;
        batch.object = object;
        this.root.add(object);
      };
      if (this.prepare) {
        const pending = this.prepare(object)
          .then(publish)
          .catch((error) => {
            object.dispose();
            if (this.batches.get(key) === batch && batch.revision === revision)
              console.warn(
                '[molen] static batch preparation failed; retaining ordinary meshes:',
                error,
              );
          })
          .finally(() => this.pending.delete(pending));
        this.pending.add(pending);
      } else publish();
    }
    this.dirty.clear();
  }
  async whenIdle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all(this.pending);
  }
  dispose(): void {
    for (const id of this.entities.keys()) this.remove(id);
    this.flush();
  }
}
