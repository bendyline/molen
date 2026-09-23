/**
 * Renders `worldgenBuilding` components of a live client: every entity carrying one gets a
 * generated building object under the renderer's world root, placed by its `transform`, rebuilt
 * when the component changes, and disposed when the entity goes away. Polls the mirrored
 * entities when the kernel tick advances (static placement: buildings do not tween).
 */

import type { JsonObject } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { generateBuilding } from '../kernel/building';
import { WORLDGEN_BUILDING_COMPONENT, type WorldgenBuildingData } from '../kernel/components';
import { MeshBufferBuilder } from '../kernel/mesh-buffers';
import { packIdentity, type ResolvedStylePack } from '../kernel/stylepack';
import { FLAT_GROUND, type HeightSampler, type Vec2 } from '../kernel/types';
import { createInstancedPlacements } from './instanced-box';
import type { ModelLibrary } from './instanced-models';
import { createVertexColorMaterialSet } from './materials';
import { buffersToObject3D, disposeWorldgenObject, type WorldgenMaterialSet } from './upload';

/** The slice of a `MolenClient` the layer reads. */
export interface WorldgenEntityClient {
  readonly tick: number | undefined;
  entities(): string[];
  get(id: string, component: string): JsonObject | undefined;
  readonly renderer: { readonly worldRoot: THREE.Object3D };
}

export interface WorldgenEntityLayerOptions {
  pack: ResolvedStylePack;
  materials?: WorldgenMaterialSet;
  /** Prop models; without it roof props are skipped. */
  models?: ModelLibrary;
  /** Ground in entity-local meters (default flat at y = 0). */
  ground?: HeightSampler;
}

export interface WorldgenEntityLayer {
  /** Rebuild or remove objects to match the client's entities; call once per frame. */
  update(): void;
  /** Force a rescan on the next update even if the tick did not advance. */
  invalidate(): void;
  readonly objectCount: number;
  dispose(): void;
}

interface Entry {
  key: string;
  object: THREE.Object3D;
  pending?: Promise<void>;
}

interface TransformData {
  pos?: [number, number, number];
  rot?: [number, number, number, number];
}

export function createWorldgenEntityLayer(
  client: WorldgenEntityClient,
  options: WorldgenEntityLayerOptions,
): WorldgenEntityLayer {
  const materials = options.materials ?? createVertexColorMaterialSet();
  const ownsMaterials = options.materials === undefined;
  const ground = options.ground ?? FLAT_GROUND;
  const identity = packIdentity(options.pack);
  const entries = new Map<string, Entry>();
  let lastTick: number | undefined | null = null;
  let disposed = false;

  function build(id: string, data: WorldgenBuildingData): THREE.Object3D | undefined {
    const style = options.pack.archstyles[data.style];
    if (style === undefined) return undefined;
    const builder = new MeshBufferBuilder();
    const result = generateBuilding(
      {
        request: {
          identity: data.seed ?? id,
          labels: data.labels ?? ['building'],
          ...(data.appearance !== undefined ? { appearance: data.appearance } : {}),
          ...(data.storefronts !== undefined ? { storefronts: data.storefronts } : {}),
          outline: data.outline as Vec2[],
          ...(data.holes !== undefined ? { holes: data.holes as Vec2[][] } : {}),
          ...(data.height !== undefined ? { height: data.height } : {}),
          ...(data.levels !== undefined ? { levels: data.levels } : {}),
          style: data.style,
        },
        style,
        pack: identity,
        ground,
        tier: data.tier ?? 0,
      },
      builder,
    );
    if (result.skipped !== undefined) return undefined;
    const group = new THREE.Group();
    group.name = `worldgen:${id}`;
    if (!builder.isEmpty()) {
      group.add(buffersToObject3D(builder.finalize(), materials, `worldgen:${id}:mesh`));
    }
    if (result.box !== undefined) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(result.box.sx, result.box.sy, result.box.sz),
        materials.materialFor('wall', 'palette:#ffffff'),
      );
      box.position.set(result.box.x, result.box.y + result.box.sy / 2, result.box.z);
      box.rotation.y = result.box.yaw;
      box.userData.worldgenOwnedGeometry = true;
      group.add(box);
    }
    const models = options.models;
    if (models !== undefined && result.props !== undefined && result.props.length > 0) {
      const byModel = new Map<string, typeof result.props>();
      for (const prop of result.props) {
        const list = byModel.get(prop.model) ?? [];
        list.push(prop);
        byModel.set(prop.model, list);
      }
      for (const [model, props] of byModel) {
        const data = new Float32Array(props.length * 10);
        props.forEach((prop, index) => {
          data.set(
            [prop.x, prop.y, prop.z, prop.yaw, prop.scale, prop.scale, prop.scale, ...prop.color],
            index * 10,
          );
        });
        const set = { setId: `props:${model}`, modelRef: model, count: props.length, data };
        const prepared = models.get(model);
        if (prepared !== undefined) {
          group.add(createInstancedPlacements(set, prepared.geometry, prepared.material));
        } else {
          void models.prepare(model).then((ready) => {
            if (disposed || entries.get(id)?.object !== group) return;
            group.add(createInstancedPlacements(set, ready.geometry, ready.material));
          });
        }
      }
    }
    return group;
  }

  function place(object: THREE.Object3D, transform: TransformData | undefined): void {
    const pos = transform?.pos ?? [0, 0, 0];
    const rot = transform?.rot ?? [0, 0, 0, 1];
    object.position.set(pos[0], pos[1], pos[2]);
    object.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
  }

  function remove(id: string): void {
    const entry = entries.get(id);
    if (entry === undefined) return;
    entries.delete(id);
    entry.object.removeFromParent();
    disposeWorldgenObject(entry.object);
  }

  function update(): void {
    if (disposed) return;
    const tick = client.tick;
    if (lastTick !== null && tick === lastTick) return;
    lastTick = tick;
    const seen = new Set<string>();
    for (const id of client.entities()) {
      const data = client.get(id, WORLDGEN_BUILDING_COMPONENT) as WorldgenBuildingData | undefined;
      if (data === undefined) continue;
      seen.add(id);
      const transform = client.get(id, 'transform') as TransformData | undefined;
      const key = JSON.stringify(data);
      const existing = entries.get(id);
      if (existing !== undefined && existing.key === key) {
        place(existing.object, transform);
        continue;
      }
      remove(id);
      const object = build(id, data);
      if (object === undefined) continue;
      place(object, transform);
      client.renderer.worldRoot.add(object);
      entries.set(id, { key, object });
    }
    for (const id of [...entries.keys()]) if (!seen.has(id)) remove(id);
  }

  return {
    update,
    invalidate: () => {
      lastTick = null;
    },
    get objectCount() {
      return entries.size;
    },
    dispose: () => {
      disposed = true;
      for (const id of [...entries.keys()]) remove(id);
      if (ownsMaterials) materials.dispose?.();
    },
  };
}
