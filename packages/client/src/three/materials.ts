import {
  type BakedMaterial,
  bakeMatGraph,
  bakePixelGrid,
  type MaterialBaker,
  type MatGraphDoc,
  type PixelGridDoc,
  type RGBAImage,
  registerMaterialSchemas,
} from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { AssetProvider } from '../assets';

// The bake→render bridge: materialRef strings resolve to three.js materials at load time.
//   palette:#rrggbb            — flat color (sync; the historical rung 1)
//   matgraph:<ref>             — procedural graph doc, CPU-baked, textures uploaded
//   pixelgrid:<ref>            — pixel-art doc, nearest-filtered
// Doc refs load through the AssetProvider (project asset ids or URL-ish paths).

registerMaterialSchemas();

function textureFrom(
  image: RGBAImage,
  filter: 'nearest' | 'linear',
  srgb: boolean,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    new Uint8Array(image.data.buffer.slice(0)),
    image.width,
    image.height,
    THREE.RGBAFormat,
  );
  tex.flipY = false;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
  tex.minFilter = filter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Upload a BakedMaterial's slots onto a MeshStandardMaterial. */
export function materialFromBaked(baked: BakedMaterial): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 1 });
  const filter = baked.meta.filter;
  if (baked.slots.baseColor !== undefined) {
    material.map = textureFrom(baked.slots.baseColor, filter, true);
  } else {
    material.roughness = 0.6;
    material.metalness = 0;
  }
  if (baked.slots.roughness !== undefined) {
    material.roughnessMap = textureFrom(baked.slots.roughness, filter, false);
  }
  if (baked.slots.metalness !== undefined) {
    material.metalnessMap = textureFrom(baked.slots.metalness, filter, false);
  } else if (baked.slots.baseColor !== undefined) {
    material.metalness = 0;
  }
  if (baked.slots.normal !== undefined) {
    material.normalMap = textureFrom(baked.slots.normal, filter, false);
  }
  if (baked.slots.emissive !== undefined) {
    material.emissiveMap = textureFrom(baked.slots.emissive, filter, true);
    material.emissive = new THREE.Color('#ffffff');
  }
  if (baked.slots.ao !== undefined) {
    material.aoMap = textureFrom(baked.slots.ao, filter, false);
  }
  if (baked.meta.alphaTest !== undefined) {
    material.alphaTest = baked.meta.alphaTest;
    material.transparent = false;
  }
  return material;
}

const GREY = '#cccccc';
/** Cache key of the shared grey fallback (unknown/absent refs and async placeholders). */
const GREY_KEY = '__grey';

function flatMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6 });
}

/**
 * Resolves materialRef strings to three.js materials. Sync for `palette:`; doc-backed refs
 * (`matgraph:`/`pixelgrid:`) load + bake asynchronously. Every ref string maps to ONE cached
 * material shared by all entities using it; `acquire*`/`release` refcount those so a material
 * (and its textures) is disposed exactly when its last user lets go.
 */
export class MaterialResolver {
  private readonly cache = new Map<string, THREE.Material | Promise<THREE.Material>>();
  /** Reverse map: cached material -> its cache key (for release). */
  private readonly keyOf = new Map<THREE.Material, string>();
  private readonly refs = new Map<THREE.Material, number>();
  private disposed = false;
  private readonly disposedMaterials = new WeakSet<THREE.Material>();

  /** An optional caller-owned worker baker keeps procedural rasterization off the UI thread. */
  constructor(
    private readonly provider: AssetProvider | undefined = undefined,
    private readonly baker: MaterialBaker | undefined = undefined,
  ) {}

  /** Sync resolution: palette refs (and the shared grey fallback for unknown/absent refs). */
  resolveSync(materialRef: string | undefined): THREE.Material {
    const key = materialRef?.startsWith('palette:') === true ? materialRef : GREY_KEY;
    const cached = this.cache.get(key);
    if (cached instanceof THREE.Material) return cached;
    const material = flatMaterial(key === GREY_KEY ? GREY : key.slice('palette:'.length));
    if (!this.disposed) this.remember(key, material);
    return material;
  }

  /** Is this a doc-backed ref that resolves asynchronously? */
  isAsync(materialRef: string | undefined): boolean {
    return (
      materialRef !== undefined &&
      (materialRef.startsWith('matgraph:') || materialRef.startsWith('pixelgrid:'))
    );
  }

  /**
   * Async resolution for doc-backed refs; falls back to grey (with one warning) when the doc
   * is missing/invalid so a bad ref never blanks the scene.
   */
  async resolve(materialRef: string): Promise<THREE.Material> {
    if (this.disposed) throw new Error('material resolver is disposed');
    const cached = this.cache.get(materialRef);
    if (cached !== undefined) return cached;
    const promise = this.bake(materialRef)
      .catch((e: unknown) => {
        console.warn(`[molen] materialRef "${materialRef}": ${(e as Error).message}`);
        // A private grey (not the shared fallback) so this ref owns exactly one cache entry.
        return flatMaterial(GREY);
      })
      .then((material) => {
        if (this.disposed || this.cache.get(materialRef) !== promise) {
          this.disposeMaterial(material);
        } else {
          this.remember(materialRef, material);
        }
        return material;
      });
    this.cache.set(materialRef, promise);
    return promise;
  }

  /** `resolveSync` plus one reference; pair with `release`. */
  acquireSync(materialRef: string | undefined): THREE.Material {
    return this.retain(this.resolveSync(materialRef));
  }

  /** `resolve` plus one reference; pair with `release`. */
  async acquire(materialRef: string): Promise<THREE.Material> {
    return this.retain(await this.resolve(materialRef));
  }

  /**
   * Drop one reference; at zero the material (and its textures) is disposed and evicted from
   * the cache. Materials not handed out by `acquire*` are ignored.
   */
  release(material: THREE.Material): void {
    const count = this.refs.get(material);
    if (count === undefined) return;
    if (count > 1) {
      this.refs.set(material, count - 1);
      return;
    }
    this.refs.delete(material);
    const key = this.keyOf.get(material);
    if (key !== undefined) {
      this.keyOf.delete(material);
      if (this.cache.get(key) === material) this.cache.delete(key);
    }
    this.disposeMaterial(material);
  }

  private retain(material: THREE.Material): THREE.Material {
    if (!this.disposed) this.refs.set(material, (this.refs.get(material) ?? 0) + 1);
    return material;
  }

  private remember(key: string, material: THREE.Material): void {
    this.cache.set(key, material);
    this.keyOf.set(material, key);
  }

  private async bake(materialRef: string): Promise<THREE.Material> {
    if (this.provider === undefined) {
      throw new Error('no asset provider configured (ClientOptions.assets)');
    }
    const sep = materialRef.indexOf(':');
    const kind = materialRef.slice(0, sep);
    const ref = materialRef.slice(sep + 1);
    const doc = JSON.parse(await this.provider.loadText(ref)) as unknown;
    if (kind === 'matgraph') {
      const parsed = validateByKind('matgraph', doc);
      if (!parsed.ok) throw new Error(parsed.formatted);
      return materialFromBaked(
        this.baker
          ? await this.baker.bake('matgraph', parsed.value as MatGraphDoc)
          : bakeMatGraph(parsed.value as MatGraphDoc),
      );
    }
    const parsed = validateByKind('pixelgrid', doc);
    if (!parsed.ok) throw new Error(parsed.formatted);
    return materialFromBaked(
      this.baker
        ? await this.baker.bake('pixelgrid', parsed.value as PixelGridDoc)
        : bakePixelGrid(parsed.value as PixelGridDoc),
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.cache.values()) {
      if (entry instanceof THREE.Material) this.disposeMaterial(entry);
      else void entry.then((material) => this.disposeMaterial(material));
    }
    this.cache.clear();
    this.keyOf.clear();
    this.refs.clear();
  }

  private disposeMaterial(material: THREE.Material): void {
    if (this.disposedMaterials.has(material)) return;
    this.disposedMaterials.add(material);
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) value.dispose();
    }
    material.dispose();
  }
}
