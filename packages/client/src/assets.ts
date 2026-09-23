import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/**
 * Resolves asset refs to bytes. Refs are project asset ids ("crate"); refs containing "/" or
 * starting with "./" / "http(s):" pass through as URLs, so manifest-less demos stay trivial.
 */
export interface AssetProvider {
  load(ref: string): Promise<ArrayBuffer>;
  loadText(ref: string): Promise<string>;
}

function isUrlish(ref: string): boolean {
  return ref.includes('/') || ref.startsWith('./') || /^https?:/.test(ref);
}

export interface UrlAssetProviderOptions {
  /**
   * Packed runtime variant to prefer for convention-resolved ids (e.g. "ktx2" from
   * `molen asset pack`): assets/<id>/model.<variant>.glb is tried first and model.glb is the
   * fallback when the variant is not served. Index-mapped and URL-ish refs are used as given.
   */
  variant?: string;
}

/**
 * URL-backed provider: asset ids resolve through an id -> URL index (from the project manifest's
 * assets record, mapped to served model URLs); URL-ish refs resolve against baseUrl.
 */
export function createUrlAssetProvider(
  baseUrl: string,
  index?: Record<string, string>,
  options: UrlAssetProviderOptions = {},
): AssetProvider {
  const candidates = (ref: string): string[] => {
    const mapped = index?.[ref];
    if (mapped !== undefined) return [new URL(mapped, baseUrl).href];
    if (isUrlish(ref)) return [new URL(ref, baseUrl).href];
    // Convention: assets/<id with dots as slashes>/model[.<variant>].glb under the base.
    const dir = `assets/${ref.replaceAll('.', '/')}`;
    const urls = [new URL(`${dir}/model.glb`, baseUrl).href];
    if (options.variant !== undefined) {
      urls.unshift(new URL(`${dir}/model.${options.variant}.glb`, baseUrl).href);
    }
    return urls;
  };
  const fetchFirst = async (ref: string): Promise<Response> => {
    const urls = candidates(ref);
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i] as string;
      const res = await fetch(url);
      if (res.ok) return res;
      // Only a missing variant falls through; any other failure is the asset's error.
      if (res.status !== 404 || i === urls.length - 1) {
        throw new Error(`asset "${ref}": HTTP ${res.status} for ${url}`);
      }
    }
    throw new Error(`asset "${ref}": no candidate URL`);
  };
  return {
    async load(ref: string): Promise<ArrayBuffer> {
      return (await fetchFirst(ref)).arrayBuffer();
    },
    async loadText(ref: string): Promise<string> {
      return (await fetchFirst(ref)).text();
    },
  };
}

export interface LoadedGltf {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

/**
 * Parse each glTF ref once; hand out per-entity instances (SkeletonUtils.clone so skinned
 * meshes work while geometry/textures stay shared). `whenIdle()` resolves when no loads are
 * pending — the capture path awaits it before its single deterministic frame.
 */
export class AssetCache {
  private readonly loads = new Map<string, Promise<LoadedGltf>>();
  private readonly bases = new Set<LoadedGltf>();
  private readonly disposedGeometries = new Set<THREE.BufferGeometry>();
  private readonly disposedMaterials = new Set<THREE.Material>();
  private pending = 0;
  private idleResolvers: (() => void)[] = [];
  private disposed = false;

  constructor(
    private readonly provider: AssetProvider,
    /** Owned by the cache: `dispose()` tears down its Draco/KTX2 decoder worker pools. */
    private readonly loader: GLTFLoader,
  ) {}

  /** Register an external async task (e.g. a material bake) so whenIdle() waits for it. */
  track<T>(p: Promise<T>): Promise<T> {
    this.pending++;
    const done = (): void => {
      this.pending--;
      if (this.pending === 0) {
        for (const resolve of this.idleResolvers.splice(0)) resolve();
      }
    };
    p.then(done, done);
    return p;
  }

  private base(ref: string): Promise<LoadedGltf> {
    let load = this.loads.get(ref);
    if (load === undefined) {
      load = this.track(
        this.provider
          .load(ref)
          .then(
            (bytes) =>
              new Promise<LoadedGltf>((resolve, reject) => {
                this.loader.parse(
                  bytes,
                  '',
                  (gltf: GLTF) => resolve({ scene: gltf.scene, clips: gltf.animations }),
                  (e) => reject(e instanceof Error ? e : new Error(String(e))),
                );
              }),
          )
          .then((loaded) => {
            if (this.disposed) this.disposeLoaded(loaded);
            else this.bases.add(loaded);
            return loaded;
          }),
      );
      this.loads.set(ref, load);
    }
    return load;
  }

  /** A fresh instance of the (sub-)scene for one entity. */
  async instance(ref: string, node?: string): Promise<LoadedGltf> {
    if (this.disposed) throw new Error('asset cache is disposed');
    const { scene, clips } = await this.base(ref);
    if (this.disposed) throw new Error('asset cache is disposed');
    const source = node !== undefined ? (scene.getObjectByName(node) ?? scene) : scene;
    return { scene: SkeletonUtils.clone(source) as THREE.Group, clips };
  }

  /** Resolves once every load kicked off so far has settled. */
  whenIdle(): Promise<void> {
    if (this.pending === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  clear(): void {
    for (const loaded of this.bases) this.disposeLoaded(loaded);
    this.bases.clear();
    this.loads.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    // Draco and KTX2 each spawn a worker pool on first decode and own it until disposed; without
    // this a Vite HMR remount loop leaks up to 8 Workers per edit. The cache owns the loader.
    this.loader.dracoLoader?.dispose();
    this.loader.ktx2Loader?.dispose();
  }

  private disposeLoaded(loaded: LoadedGltf): void {
    loaded.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!this.disposedGeometries.has(mesh.geometry)) {
        this.disposedGeometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (this.disposedMaterials.has(material)) continue;
        this.disposedMaterials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    });
  }
}
