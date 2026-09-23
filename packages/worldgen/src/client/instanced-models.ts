/**
 * Prepared models for instancing. A glTF scene (several primitives, several materials) becomes
 * one merged vertex-colored geometry so a placement set renders as one `InstancedMesh`. Builtin
 * primitives cover packs without assets.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDMARK_DEFINITIONS } from '../kernel/landmark-catalog';
import { generateLandmarkModel } from '../kernel/landmark-models';
import type { LandmarkDefinitions } from '../kernel/landmark-types';
import { packedColorAttribute } from './color-attribute';
import { createVegetationGeometry } from './vegetation';

export interface PreparedModel {
  ref: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Model-space bounds (meters, base at y = 0 for authored models). */
  bounds: THREE.Box3;
  builtin: boolean;
}

export type ModelLoader = (ref: string) => Promise<THREE.Object3D>;

function bakeColor(geometry: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const existing = geometry.getAttribute('color');
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const r = existing !== undefined ? existing.getX(index) : 1;
    const g = existing !== undefined ? existing.getY(index) : 1;
    const b = existing !== undefined ? existing.getZ(index) : 1;
    colors[index * 3] = r * color.r;
    colors[index * 3 + 1] = g * color.g;
    colors[index * 3 + 2] = b * color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Flatten every mesh of a scene into one geometry with baked material colors. */
export function mergeSceneGeometry(root: THREE.Object3D): THREE.BufferGeometry | undefined {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const tint = new THREE.Color(1, 1, 1);
    const first = materials[0] as THREE.Material & { color?: THREE.Color };
    if (first?.color !== undefined) tint.copy(first.color);
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color')
        geometry.deleteAttribute(name);
    }
    if (geometry.getAttribute('normal') === undefined) geometry.computeVertexNormals();
    if (geometry.index !== null) {
      parts.push(bakeColor(geometry.toNonIndexed(), tint));
      geometry.dispose();
    } else {
      parts.push(bakeColor(geometry, tint));
    }
  });
  if (parts.length === 0) return undefined;
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (parts.length > 1) for (const part of parts) part.dispose();
  if (merged === null || merged === undefined) return undefined;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function builtinGeometry(
  name: string,
  coarse: boolean | 'distant',
  definitions: LandmarkDefinitions,
): THREE.BufferGeometry | undefined {
  const landmark = generateLandmarkModel(
    name,
    coarse === 'distant' ? 2 : coarse ? 1 : 0,
    definitions,
  );
  if (landmark !== undefined) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(landmark.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(landmark.normals, 3));
    geometry.setAttribute('color', packedColorAttribute(landmark.colors));
    geometry.setIndex(new THREE.BufferAttribute(landmark.indices, 1));
    return geometry;
  }
  if (name.startsWith('tree.mapped.')) {
    const tree = createVegetationGeometry(
      name.endsWith('needleleaf') ? 'tree.conifer' : 'tree.deciduous',
      coarse,
    );
    if (tree) {
      tree.computeBoundingBox();
      const bounds = tree.boundingBox as THREE.Box3;
      const size = bounds.getSize(new THREE.Vector3()),
        center = bounds.getCenter(new THREE.Vector3());
      tree.translate(-center.x, -bounds.min.y, -center.z);
      tree.scale(1 / size.x, 1 / size.y, 1 / size.z);
      return tree;
    }
  }
  const vegetation = createVegetationGeometry(name, coarse);
  if (vegetation !== undefined) return vegetation;
  const tinted = (geometry: THREE.BufferGeometry, hex: string): THREE.BufferGeometry =>
    bakeColor(geometry.toNonIndexed(), new THREE.Color(hex));
  switch (name) {
    case 'box': {
      const box = new THREE.BoxGeometry(1, 1, 1);
      box.translate(0, 0.5, 0);
      return tinted(box, '#ffffff');
    }
    default:
      return undefined;
  }
}

/** Caches prepared models by reference; loads glTF scenes through the host's asset loader. */
export class ModelLibrary {
  private disposed = false;
  private readonly prepared = new Map<string, PreparedModel>();
  private readonly pending = new Map<string, Promise<PreparedModel>>();
  private readonly material: THREE.MeshStandardMaterial;

  constructor(
    private readonly loadModel: ModelLoader | undefined = undefined,
    private readonly landmarks: LandmarkDefinitions = LANDMARK_DEFINITIONS,
  ) {
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    this.material.name = 'worldgen:models';
  }

  private key(ref: string, coarse: boolean | 'distant'): string {
    return coarse && ref.startsWith('builtin:')
      ? `${ref}:${coarse === 'distant' ? 'distant' : 'coarse'}`
      : ref;
  }

  /** The prepared model, if prepare has completed for the requested detail. */
  get(ref: string, coarse: boolean | 'distant' = false): PreparedModel | undefined {
    return this.prepared.get(this.key(ref, coarse));
  }

  async prepare(ref: string, coarse: boolean | 'distant' = false): Promise<PreparedModel> {
    if (this.disposed) throw new Error('Model library is disposed');
    const key = this.key(ref, coarse);
    const ready = this.prepared.get(key);
    if (ready !== undefined) return ready;
    let pending = this.pending.get(key);
    if (pending === undefined) {
      pending = this.load(ref, coarse)
        .then((model) => {
          if (this.disposed) {
            model.geometry.dispose();
            throw new Error('Model library is disposed');
          }
          this.prepared.set(key, model);
          return model;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, pending);
    }
    return pending;
  }

  private async load(ref: string, coarse: boolean | 'distant'): Promise<PreparedModel> {
    if (ref.startsWith('builtin:')) {
      const geometry = builtinGeometry(ref.slice('builtin:'.length), coarse, this.landmarks);
      if (geometry === undefined) throw new Error(`unknown builtin model "${ref}"`);
      geometry.computeBoundingBox();
      return {
        ref,
        geometry,
        material: this.material,
        bounds: geometry.boundingBox ?? new THREE.Box3(),
        builtin: true,
      };
    }
    if (this.loadModel === undefined) {
      throw new Error(`model "${ref}" needs a model loader (ModelLibrary constructor)`);
    }
    const scene = await this.loadModel(ref);
    const geometry = mergeSceneGeometry(scene);
    if (geometry === undefined) throw new Error(`model "${ref}" has no mesh geometry`);
    return {
      ref,
      geometry,
      material: this.material,
      bounds: geometry.boundingBox ?? new THREE.Box3(),
      builtin: false,
    };
  }

  dispose(): void {
    this.disposed = true;
    for (const model of this.prepared.values()) model.geometry.dispose();
    this.prepared.clear();
    this.material.dispose();
  }
}
