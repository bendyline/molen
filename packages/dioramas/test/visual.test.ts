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

it("keeps a diorama's own lights out of a host scene that asks", async () => {
  const definition: DioramaDefinition = {
    scene: {
      format: 'molen/scene@3',
      name: 'glow',
      entities: [
        {
          id: 'lamp',
          components: {
            transform: { pos: [0, 2, 0], rot: [0, 0, 0, 1] },
            light: { type: 'point', color: '#ffd16c', intensity: 30, range: 18 },
          },
        },
      ],
    },
    bounds: { min: [-2, -2, -2], max: [2, 2, 2] },
  };
  const lights = (root: THREE.Object3D): THREE.Light[] => {
    const found: THREE.Light[] = [];
    root.traverse((object) => {
      if ((object as THREE.Light).isLight) found.push(object as THREE.Light);
    });
    return found;
  };
  const placement = {
    id: 'a',
    position: [0, 0, 0] as [number, number, number],
    load: async () => definition,
  };
  const lit = new THREE.Group();
  const shown = await createDioramaVisual(definition, placement, { root: lit });
  expect(lights(lit).length).toBeGreaterThan(0);
  expect(lights(lit).every((light) => light.visible)).toBe(true);
  shown.dispose();
  const host = new THREE.Group();
  // With a camera, as Earth hosts mount them: the backend shows each light that reaches the view.
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 2, 10);
  camera.updateMatrixWorld();
  const hidden = await createDioramaVisual(definition, placement, {
    root: host,
    camera,
    localLights: false,
  });
  hidden.update(1 / 30);
  expect(lights(host).length).toBeGreaterThan(0);
  expect(lights(host).some((light) => light.visible)).toBe(false);
  hidden.dispose();
});
