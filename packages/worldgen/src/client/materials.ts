/** Material sets: shared three.js materials keyed by generated mesh groups. */

import type { MaterialResolver } from '@bendyline/molen-client';
import * as THREE from 'three';
import type { MaterialSlot } from '../kernel/types';
import type { WorldgenMaterialSet } from './upload';

const SLOT_ROUGHNESS: Readonly<Record<MaterialSlot, number>> = {
  wall: 0.86,
  roof: 0.92,
  trim: 0.7,
  foundation: 0.95,
  window: 0.25,
  door: 0.75,
};

/**
 * Four-ish shared vertex-colored materials (one per slot). Every material reference collapses
 * onto the slot material, so a batch costs at most one draw call per slot.
 */
export function createVertexColorMaterialSet(): WorldgenMaterialSet {
  const materials = new Map<MaterialSlot, THREE.MeshStandardMaterial>();
  return {
    materialFor(slot: MaterialSlot): THREE.Material {
      let material = materials.get(slot);
      if (material === undefined) {
        material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: SLOT_ROUGHNESS[slot],
          metalness: slot === 'window' ? 0.1 : 0,
        });
        material.name = `worldgen:${slot}`;
        materials.set(slot, material);
      }
      return material;
    },
    dispose(): void {
      for (const material of materials.values()) material.dispose();
      materials.clear();
    },
  };
}

export interface ResolvedMaterialSet extends WorldgenMaterialSet {
  /**
   * Bake and cache doc-backed references (`matgraph:`/`pixelgrid:`) before rendering; a batch
   * rendered earlier keeps the flat slot material unless progressive materials are enabled.
   */
  prepare(refs: readonly string[]): Promise<void>;
  /** References that failed to bake (rendered with the flat slot material), with the reason. */
  readonly failures: ReadonlyMap<string, string>;
  /** Conservative RGBA residency including mipmaps; shared textures counted once. */
  readonly textureBytes?: number;
  dispose(): void;
}

export interface ResolvedMaterialSetOptions {
  /** Render colors immediately and upgrade the same material objects as textures finish baking. */
  progressive?: boolean;
  /** Bake a shared surface when a visible model first requests it. */
  prepareOnUse?: boolean;
  /** Keep flat placeholders when adding a texture would exceed this shared library budget. */
  maxTextureBytes?: number;
  concurrency?: number;
}

const TEXTURE_KEYS = [
  'map',
  'roughnessMap',
  'metalnessMap',
  'normalMap',
  'emissiveMap',
  'aoMap',
] as const;

/**
 * Textured materials through the app's `MaterialResolver`: every prepared reference becomes one
 * shared material with vertex colors on (palette tints multiply the texture) and repeat
 * wrapping (generated UVs are in texture repeats). Palette references and unprepared refs fall
 * back to the flat per-slot materials.
 */
export function createResolvedMaterialSet(
  resolver: MaterialResolver,
  options: ResolvedMaterialSetOptions = {},
): ResolvedMaterialSet {
  const flat = createVertexColorMaterialSet();
  const prepared = new Map<string, THREE.Material>();
  const sources = new Map<string, THREE.Material>();
  const pending = new Map<string, Promise<void>>();
  const failures = new Map<string, string>();
  const placeholders = new Map<string, THREE.MeshStandardMaterial>();
  // Textured glass draws its texture untinted: the vertex color of a window carries the glass
  // tone for flat levels instead (see the recipe), so the window slot gets its own variant.
  const glass = new Map<string, THREE.MeshStandardMaterial>();
  const rejected = new Set<string>();
  const textures = new Set<THREE.Texture>();
  let textureBytes = 0;
  let baking = 0;
  const waiters: Array<() => void> = [];
  const limit = options.concurrency ?? Infinity;
  if (!(limit > 0) || (limit !== Infinity && !Number.isInteger(limit)))
    throw new Error('Material concurrency must be positive');
  if (options.maxTextureBytes !== undefined && !(options.maxTextureBytes > 0))
    throw new Error('Material texture budget must be positive');
  let disposed = false;
  const untinted = (target: THREE.MeshStandardMaterial, from: THREE.Material): void => {
    target.copy(from as THREE.MeshStandardMaterial);
    target.vertexColors = false;
    target.needsUpdate = true;
  };

  async function prepareOne(ref: string): Promise<void> {
    if (baking >= limit) await new Promise<void>((resolve) => waiters.push(resolve));
    else baking++;
    try {
      if (disposed) return;
      const source = await resolver.acquire(ref);
      if (disposed) {
        resolver.release(source);
        return;
      }
      const added = [
        ...new Set(
          Object.values(source).filter(
            (value): value is THREE.Texture =>
              value instanceof THREE.Texture && !textures.has(value),
          ),
        ),
      ];
      const bytes = added.reduce((sum, texture) => {
        const image = texture.image as
          | { width?: number; height?: number; data?: ArrayBufferView }
          | undefined;
        return (
          sum +
          Math.ceil(
            (Math.max(
              image?.data?.byteLength ?? 0,
              (image?.width ?? 0) * (image?.height ?? 0) * 4,
            ) *
              4) /
              3,
          )
        );
      }, 0);
      if (textureBytes + bytes > (options.maxTextureBytes ?? Infinity)) {
        rejected.add(ref);
        resolver.release(source);
        return;
      }
      textureBytes += bytes;
      for (const texture of added) textures.add(texture);
      const material = placeholders.get(ref) ?? new THREE.MeshStandardMaterial();
      material.copy(source as THREE.MeshStandardMaterial);
      material.vertexColors = true;
      material.name = `worldgen:${ref}`;
      for (const key of TEXTURE_KEYS) {
        const texture = material[key];
        if (texture === null || texture === undefined) continue;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        if (texture.magFilter !== THREE.NearestFilter) {
          // Hard cutouts retain their authored threshold. Fractional coverage materials
          // use mipmapped blending so subpixel openings retain their average open area.
          texture.generateMipmaps = !(material.alphaTest > 0);
          texture.minFilter =
            material.alphaTest > 0 ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
          texture.anisotropy = 4;
        }
        texture.needsUpdate = true;
      }
      material.needsUpdate = true;
      sources.set(ref, source);
      prepared.set(ref, material);
      const window = glass.get(ref);
      if (window !== undefined) {
        untinted(window, material);
        window.name = `worldgen:${ref}:glass`;
      }
    } catch (error) {
      if (!disposed) failures.set(ref, (error as Error).message);
    } finally {
      const next = waiters.shift();
      if (next) next();
      else baking--;
    }
  }

  function prepare(refs: readonly string[]): Promise<void> {
    if (disposed) return Promise.resolve();
    const waits: Promise<void>[] = refs.length ? [] : [...pending.values()];
    for (const ref of refs) {
      if (ref.startsWith('palette:') || prepared.has(ref) || failures.has(ref) || rejected.has(ref))
        continue;
      let wait = pending.get(ref);
      if (wait === undefined) {
        wait = prepareOne(ref).finally(() => pending.delete(ref));
        pending.set(ref, wait);
      }
      waits.push(wait);
    }
    return Promise.all(waits).then(() => undefined);
  }

  return {
    failures,
    get textureBytes() {
      return textureBytes;
    },
    prepare,
    materialFor(slot: MaterialSlot, ref: string): THREE.Material {
      if (options.prepareOnUse) void prepare([ref]);
      const material = prepared.get(ref);
      if (slot === 'window' && !ref.startsWith('palette:') && !disposed) {
        let window = glass.get(ref);
        if (window === undefined) {
          if (material === undefined && !options.progressive) return flat.materialFor(slot, ref);
          // Until the texture bakes, the flat glass tone (vertex color) stands in.
          window =
            material !== undefined
              ? new THREE.MeshStandardMaterial()
              : (flat.materialFor(slot, ref).clone() as THREE.MeshStandardMaterial);
          if (material !== undefined) untinted(window, material);
          window.name = `worldgen:${ref}:glass`;
          glass.set(ref, window);
        }
        return window;
      }
      if (material) return material;
      if (!options.progressive || ref.startsWith('palette:') || disposed)
        return flat.materialFor(slot, ref);
      let placeholder = placeholders.get(ref);
      if (!placeholder) {
        placeholder = flat.materialFor(slot, ref).clone() as THREE.MeshStandardMaterial;
        placeholder.name = `worldgen:${ref}`;
        placeholders.set(ref, placeholder);
      }
      return placeholder;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const material of new Set([
        ...prepared.values(),
        ...placeholders.values(),
        ...glass.values(),
      ]))
        material.dispose();
      prepared.clear();
      placeholders.clear();
      glass.clear();
      for (const source of sources.values()) resolver.release(source);
      sources.clear();
      textures.clear();
      textureBytes = 0;
      flat.dispose?.();
    },
  };
}
