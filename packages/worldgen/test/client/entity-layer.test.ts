import type { JsonObject } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createWorldgenEntityLayer,
  type WorldgenEntityClient,
} from '../../src/client/entity-layer';
import '../../src/kernel';
import { createTestPack } from '../helpers/pack';
import { SHAPES } from '../helpers/shapes';

const pack = await createTestPack();

/** A stand-in for the client's mirrored entities (no kernel, no WebGL). */
function fakeClient(): WorldgenEntityClient & {
  set(id: string, components: Record<string, JsonObject>): void;
  remove(id: string): void;
  advance(): void;
} {
  const entities = new Map<string, Record<string, JsonObject>>();
  let tick = 0;
  return {
    get tick() {
      return tick;
    },
    entities: () => [...entities.keys()],
    get: (id, component) => entities.get(id)?.[component],
    renderer: { worldRoot: new THREE.Group() },
    set: (id, components) => {
      entities.set(id, components);
    },
    remove: (id) => {
      entities.delete(id);
    },
    advance: () => {
      tick++;
    },
  };
}

const HALL: JsonObject = {
  style: 'test.pack.house',
  outline: SHAPES.L as unknown as JsonObject[],
  levels: 2,
  labels: ['hall'],
};

describe('worldgen entity layer', () => {
  it('builds, places, rebuilds, and disposes buildings as entities change', () => {
    const client = fakeClient();
    const layer = createWorldgenEntityLayer(client, { pack });
    client.set('hall', {
      transform: { pos: [10, 2, -5], rot: [0, 0, 0, 1] },
      worldgenBuilding: HALL,
    });
    client.set('other', { transform: { pos: [0, 0, 0] } });
    layer.update();
    expect(layer.objectCount).toBe(1);
    const root = client.renderer.worldRoot;
    expect(root.children).toHaveLength(1);
    const object = root.children[0] as THREE.Object3D;
    expect(object.name).toBe('worldgen:hall');
    expect(object.position.toArray()).toEqual([10, 2, -5]);
    let meshes = 0;
    object.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) meshes++;
    });
    expect(meshes).toBeGreaterThan(0);

    // Same tick: nothing rescans. Next tick with the same data: same object, new transform.
    client.set('hall', { transform: { pos: [1, 2, 3] }, worldgenBuilding: HALL });
    layer.update();
    expect(object.position.toArray()).toEqual([10, 2, -5]);
    client.advance();
    layer.update();
    expect(root.children[0]).toBe(object);
    expect(object.position.toArray()).toEqual([1, 2, 3]);

    // Changed component: rebuilt as a new object.
    client.set('hall', {
      transform: { pos: [1, 2, 3] },
      worldgenBuilding: { ...HALL, levels: 3 },
    });
    client.advance();
    layer.update();
    expect(root.children).toHaveLength(1);
    expect(root.children[0]).not.toBe(object);

    // Unknown style: skipped, not thrown. Removed entity: disposed.
    client.set('ghost', { worldgenBuilding: { ...HALL, style: 'test.pack.missing' } });
    client.advance();
    layer.update();
    expect(layer.objectCount).toBe(1);
    client.remove('hall');
    client.advance();
    layer.update();
    expect(layer.objectCount).toBe(0);
    expect(root.children).toHaveLength(0);
    layer.dispose();
  });
});
