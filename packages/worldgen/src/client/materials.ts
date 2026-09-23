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
   * rendered earlier keeps the flat slot material for refs that were not prepared.
   */
  prepare(refs: readonly string[]): Promise<void>;
  /** References that failed to bake (rendered with the flat slot material), with the reason. */
  readonly failures: ReadonlyMap<string, string>;
  dispose(): void;
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
export function createResolvedMaterialSet(resolver: MaterialResolver): ResolvedMaterialSet {
  const flat = createVertexColorMaterialSet();
  const prepared = new Map<string, THREE.Material>();
  const sources = new Map<string, THREE.Material>();
  const pending = new Map<string, Promise<void>>();
  const failures = new Map<string, string>();

  async function prepareOne(ref: string): Promise<void> {
    try {
      const source = await resolver.acquire(ref);
      const material = source.clone() as THREE.MeshStandardMaterial;
      material.vertexColors = true;
      material.name = `worldgen:${ref}`;
      for (const key of TEXTURE_KEYS) {
        const texture = material[key];
        if (texture === null || texture === undefined) continue;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        if (texture.magFilter !== THREE.NearestFilter) {
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.anisotropy = 4;
        }
        texture.needsUpdate = true;
      }
      material.needsUpdate = true;
      sources.set(ref, source);
      prepared.set(ref, material);
    } catch (error) {
      failures.set(ref, (error as Error).message);
    }
  }

  return {
    failures,
    async prepare(refs: readonly string[]): Promise<void> {
      const waits: Promise<void>[] = [];
      for (const ref of refs) {
        if (ref.startsWith('palette:') || prepared.has(ref) || failures.has(ref)) continue;
        let wait = pending.get(ref);
        if (wait === undefined) {
          wait = prepareOne(ref).finally(() => pending.delete(ref));
          pending.set(ref, wait);
        }
        waits.push(wait);
      }
      await Promise.all(waits);
    },
    materialFor(slot: MaterialSlot, ref: string): THREE.Material {
      return prepared.get(ref) ?? flat.materialFor(slot, ref);
    },
    dispose(): void {
      for (const material of prepared.values()) material.dispose();
      prepared.clear();
      for (const source of sources.values()) resolver.release(source);
      sources.clear();
      flat.dispose?.();
    },
  };
}
