import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createDioramaVisual } from '../src/client/visual';
import type { DioramaDefinition } from '../src/types';

it('places independent instances in the host root and releases their objects', async () => {
  const root = new THREE.Group();
  const definition: DioramaDefinition = {
    scene: {
      format: 'molen/scene@3',
      name: 'prop',
      entities: [
        {
          id: 'box',
          components: {
            transform: { pos: [1, 0, 0], rot: [0, 0, 0, 1] },
            renderable: { kind: 'primitive', ref: 'box' },
          },
        },
      ],
    },
    bounds: { min: [-2, -2, -2], max: [2, 2, 2] },
  };
  const a = await createDioramaVisual(
    definition,
    { id: 'a', position: [10, 0, 0], yaw: Math.PI / 2, load: async () => definition },
    { root },
  );
  const b = await createDioramaVisual(
    definition,
    { id: 'b', position: [20, 0, 0], load: async () => definition },
    { root },
  );
  expect(root.children.map((child) => child.name)).toEqual(['diorama:a', 'diorama:b']);
  expect(root.children[0]?.localToWorld(new THREE.Vector3(1, 0, 0)).toArray()).toEqual([10, 0, -1]);
  a.update(1 / 30);
  a.setPosition?.([10, 7, 0]);
  expect(root.children[0]?.localToWorld(new THREE.Vector3(1, 0, 0)).toArray()).toEqual([10, 7, -1]);
  a.dispose();
  expect(root.children.map((child) => child.name)).toEqual(['diorama:b']);
  b.dispose();
  expect(root.children).toHaveLength(0);
});
