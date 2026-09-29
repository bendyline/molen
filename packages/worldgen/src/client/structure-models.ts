import * as THREE from 'three';
import type { GlbSharedSurface } from '../kernel/glb';
import type { ModelLoader } from './instanced-models';

export interface StructureModelLibraryOptions {
  /** Borrow a shared material owned by the caller. Undefined preserves the GLB's fallback.
   * The returned material must outlive acquired models and may upgrade progressively. */
  resolveSurface?: (surface: GlbSharedSurface) => THREE.Material | undefined;
  /** The loader transfers its decoded ImageBitmaps too (default false). A predicate can opt in
   * individual freshly parsed scenes after inspecting their image sources. Return false for URI
   * images shared with a host cache; never infer ownership from a cache-enabled snapshot.
   * Borrowed surface images stay external regardless of this option. */
  ownsImageBitmaps?: boolean | ((scene: THREE.Object3D) => boolean);
}

export interface StructureModel {
  ref: string;
  /** Immutable source hierarchy. Instances share its geometry, textures and PBR materials. */
  scene: THREE.Object3D;
  bounds: THREE.Box3;
}

function imagesOf(materials: Set<THREE.Material>): Set<ImageBitmap> {
  const images = new Set<ImageBitmap>();
  if (typeof ImageBitmap === 'undefined') return images;
  for (const material of materials)
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) {
        const data = value.image;
        for (const image of Array.isArray(data) ? data : [data])
          if (image instanceof ImageBitmap) images.add(image);
      }
  return images;
}

function disposeMaterials(
  materials: Set<THREE.Material>,
  retained: Set<THREE.Material>,
): Set<ImageBitmap> {
  const retainedImages = imagesOf(retained);
  const disposedImages = imagesOf(
    new Set([...materials].filter((material) => !retained.has(material))),
  );
  for (const image of retainedImages) disposedImages.delete(image);
  const keptTextures = new Set<THREE.Texture>();
  for (const material of retained)
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) keptTextures.add(value);
  const textures = new Set<THREE.Texture>();
  for (const material of materials) {
    if (retained.has(material)) continue;
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture && !keptTextures.has(value)) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  return disposedImages;
}

function disposeScene(scene: THREE.Object3D, borrowed = new Set<THREE.Material>()): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const skeletons = new Set<THREE.Skeleton>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) (mesh as THREE.InstancedMesh).dispose();
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
    }
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh)
      skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
  });
  for (const geometry of geometries) geometry.dispose();
  disposeMaterials(materials, borrowed);
  for (const skeleton of skeletons) skeleton.dispose();
}

/** On-demand static landmark assets. The loader transfers ownership of each returned scene to this
 * library; unlike prop instancing, this path retains UVs, textures and individual materials. */
export class StructureModelLibrary {
  private disposed = false;
  private readonly ready = new Map<string, StructureModel>();
  private readonly pending = new Map<string, Promise<StructureModel>>();
  private readonly references = new Map<string, number>();
  private readonly borrowed = new WeakMap<THREE.Object3D, Set<THREE.Material>>();
  private readonly sceneImages = new WeakMap<THREE.Object3D, Set<ImageBitmap>>();
  private readonly imageOwners = new Map<ImageBitmap, Set<THREE.Object3D>>();
  private readonly externalImages = new WeakSet<ImageBitmap>();
  private readonly closedImages = new WeakSet<ImageBitmap>();

  constructor(
    private readonly loadModel: ModelLoader,
    private readonly options: StructureModelLibraryOptions = {},
  ) {}

  private trackImages(scene: THREE.Object3D): void {
    const owns = this.options.ownsImageBitmaps;
    if (!(typeof owns === 'function' ? owns(scene) : owns)) return;
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh)
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          materials.add(material);
    });
    const images = imagesOf(materials);
    this.sceneImages.set(scene, images);
    for (const image of images) {
      const owners = this.imageOwners.get(image) ?? new Set<THREE.Object3D>();
      owners.add(scene);
      this.imageOwners.set(image, owners);
    }
  }

  private releaseImages(scene: THREE.Object3D, images: Iterable<ImageBitmap>): void {
    for (const image of images) {
      this.sceneImages.get(scene)?.delete(image);
      const owners = this.imageOwners.get(image);
      if (!owners?.delete(scene) || owners.size > 0) continue;
      this.imageOwners.delete(image);
      if (!this.externalImages.has(image) && !this.closedImages.has(image)) {
        this.closedImages.add(image);
        image.close();
      }
    }
  }

  private disposeOwnedScene(scene: THREE.Object3D): void {
    disposeScene(scene, this.borrowed.get(scene));
    this.releaseImages(scene, this.sceneImages.get(scene) ?? []);
  }

  private bindSurfaces(scene: THREE.Object3D): void {
    if (!this.options.resolveSurface) return;
    const original = new Set<THREE.Material>();
    const retained = new Set<THREE.Material>();
    const borrowed = new Set<THREE.Material>();
    // Also preserve borrowed aliases if a later surface resolver fails before assignment.
    this.borrowed.set(scene, borrowed);
    const resolved = new Map<THREE.Material, THREE.Material>();
    const assignments: Array<{ mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }> =
      [];
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const bind = (material: THREE.Material): THREE.Material => {
        original.add(material);
        const surface = material.userData.molenSurface as GlbSharedSurface | undefined;
        let replacement = mesh.geometry.hasAttribute('uv') ? resolved.get(material) : undefined;
        if (
          !replacement &&
          surface?.uv === 'repeats' &&
          typeof surface.ref === 'string' &&
          ['wall', 'roof', 'trim', 'foundation', 'window', 'door'].includes(surface.slot) &&
          mesh.geometry.hasAttribute('uv')
        ) {
          replacement = this.options.resolveSurface?.(surface);
          if (replacement) {
            resolved.set(material, replacement);
            borrowed.add(replacement);
            for (const image of imagesOf(new Set([replacement]))) this.externalImages.add(image);
          }
        }
        const result = replacement ?? material;
        retained.add(result);
        return result;
      };
      assignments.push({
        mesh,
        material: Array.isArray(mesh.material) ? mesh.material.map(bind) : bind(mesh.material),
      });
    });
    for (const { mesh, material } of assignments) {
      const materials = Array.isArray(material) ? material : [material];
      if (
        !mesh.geometry.hasAttribute('color') &&
        materials.some((value) => borrowed.has(value) && value.vertexColors)
      ) {
        // Shared surfaces use vertex tinting. Models without COLOR_0 need an explicit
        // neutral tint; an absent WebGL vertex attribute otherwise defaults to black.
        const count = mesh.geometry.getAttribute('position').count;
        mesh.geometry.setAttribute(
          'color',
          new THREE.Uint8BufferAttribute(new Uint8Array(count * 3).fill(255), 3, true),
        );
      }
      mesh.material = material;
    }
    this.releaseImages(scene, disposeMaterials(original, retained));
  }

  async acquire(ref: string): Promise<StructureModel> {
    if (this.disposed) throw new Error('Structure model library is disposed');
    this.references.set(ref, (this.references.get(ref) ?? 0) + 1);
    try {
      const ready = this.ready.get(ref);
      if (ready) return ready;
      let pending = this.pending.get(ref);
      if (!pending) {
        pending = this.loadModel(ref)
          .then((scene) => {
            try {
              this.trackImages(scene);
            } catch (error) {
              // An ownership callback failure does not transfer image ownership.
              disposeScene(scene);
              throw error;
            }
            if (this.disposed) {
              this.disposeOwnedScene(scene);
              throw new Error('Structure model library is disposed');
            }
            scene.updateMatrixWorld(true);
            let skinned = false;
            scene.traverse((object) => {
              if ((object as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
            });
            if (skinned) {
              this.disposeOwnedScene(scene);
              throw new Error(`Structure model "${ref}" must use static meshes`);
            }
            const bounds = new THREE.Box3().setFromObject(scene);
            if (bounds.isEmpty()) {
              this.disposeOwnedScene(scene);
              throw new Error(`Structure model "${ref}" has no geometry`);
            }
            try {
              this.bindSurfaces(scene);
            } catch (error) {
              this.disposeOwnedScene(scene);
              throw error;
            }
            const model = { ref, scene, bounds };
            this.ready.set(ref, model);
            return model;
          })
          .finally(() => this.pending.delete(ref));
        this.pending.set(ref, pending);
      }
      return await pending;
    } catch (error) {
      this.release(ref);
      throw error;
    }
  }

  /** Clone transforms, retaining the shared immutable geometry and materials. */
  instantiate(model: StructureModel): THREE.Object3D {
    if (this.disposed || this.ready.get(model.ref) !== model)
      throw new Error(`Structure model "${model.ref}" is no longer acquired`);
    return model.scene.clone(true);
  }

  /** Pair with each successful acquire, after removing that instance from the scene. */
  release(ref: string): void {
    const count = this.references.get(ref);
    if (count === undefined) return;
    if (count > 1) {
      this.references.set(ref, count - 1);
      return;
    }
    this.references.delete(ref);
    const evict = (): void => {
      if (this.references.has(ref)) return;
      const model = this.ready.get(ref);
      if (model) this.disposeOwnedScene(model.scene);
      this.ready.delete(ref);
    };
    evict();
    void this.pending.get(ref)?.then(evict, () => {});
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.references.clear();
    for (const model of this.ready.values()) this.disposeOwnedScene(model.scene);
    this.ready.clear();
  }
}
