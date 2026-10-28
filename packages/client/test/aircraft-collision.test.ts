import type { VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { expect, it } from 'vitest';
import { aircraftObstacleContacts } from '../src/aircraft-collision';

it('keeps the approaching face normal when a sphere overlaps both faces of a thin wall', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 0.05), new THREE.MeshBasicMaterial());
  mesh.position.set(4, 32, 5);
  mesh.updateMatrixWorld(true);
  const octree = new Octree().fromGraphNode(mesh);
  const contacts = aircraftObstacleContacts(
    [{ part: 'wing', center: [4, 31.4, 4.8], radius: 0.3 }],
    { origin: new THREE.Vector3(), octree, cars: [], aircraft: [] },
  );
  expect(contacts.length).toBeGreaterThan(0);
  expect(contacts.every((contact) => contact.normal[2] < -0.99)).toBe(true);
  expect(contacts[0]?.depth).toBeCloseTo(0.125);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});

it('preserves absolute contact points under floating origins and returns a valid normal inside a car', () => {
  const origin = new THREE.Vector3(1000, 0, -3000);
  const octree = {
    sphereIntersect: (sphere: THREE.Sphere) => {
      expect(sphere.center.toArray()).toEqual([4, 2, 5]);
      return { normal: new THREE.Vector3(0, 0, -1), depth: 0.1 };
    },
  };
  const [wall] = aircraftObstacleContacts(
    [{ part: 'body', center: [1004, 2, -2995], radius: 0.3 }],
    { origin, octree, cars: [], aircraft: [] },
  );
  expect(wall?.point).toEqual([1004, 2, -2994.7]);
  const contacts = aircraftObstacleContacts([{ part: 'wing', center: [0, 1, 0], radius: 0.3 }], {
    origin: new THREE.Vector3(),
    octree: { sphereIntersect: () => false },
    cars: [
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        spec: { width: 2, length: 4, height: 2 } as VehicleSpec,
      },
    ],
    aircraft: [],
  });
  expect(contacts).toHaveLength(1);
  expect(Math.hypot(...(contacts[0]?.normal ?? []))).toBeCloseTo(1);
  expect(contacts[0]?.depth).toBeCloseTo(1.3);
});
