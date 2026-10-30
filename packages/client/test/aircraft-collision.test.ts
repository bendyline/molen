import type { VehicleSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { expect, it } from 'vitest';
import { aircraftObstacleContacts } from '../src/aircraft-collision';
import { discTriangleContact } from '../src/aircraft-disc';

const discProbe = {
  part: 'rotor',
  center: [0, 3, 0] as [number, number, number],
  radius: 4,
  disc: { normal: [0, 1, 0] as [number, number, number], halfThickness: 0.06, angularSpeed: 50 },
};

it('hits a narrow post between the old tip probes, but clears geometry above/below/outside the disc', () => {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 5, 0.04), new THREE.MeshBasicMaterial());
  const scene = { origin: new THREE.Vector3(), octree: new Octree(), cars: [], aircraft: [] };
  for (const [x, y, z, expected] of [
    [2.5, 3, 2.5, true],
    [3, 3, 3, false],
    [2.5, 6, 2.5, false],
    [2.5, 0, 2.5, false],
  ] as const) {
    post.position.set(x, y, z);
    post.updateMatrixWorld(true);
    scene.octree = new Octree().fromGraphNode(post);
    const hits = aircraftObstacleContacts([discProbe], scene);
    expect(hits.length > 0).toBe(expected);
    if (expected) expect(hits[0]?.point[0]).toBeCloseTo(2.48);
  }
  post.geometry.dispose();
  (post.material as THREE.Material).dispose();
});

it('covers disc interiors and oblique triangles without inflating the rotor to a sphere', () => {
  const triangle = (y: number) =>
    new THREE.Triangle(
      new THREE.Vector3(-20, y, -20),
      new THREE.Vector3(20, y, -20),
      new THREE.Vector3(0, y, 20),
    );
  expect(discTriangleContact(discProbe, triangle(3.03))).toBeDefined();
  expect(discTriangleContact(discProbe, triangle(3.2))).toBeUndefined();
  const vertical = {
    ...discProbe,
    disc: { ...discProbe.disc, normal: [1, 0, 0] as [number, number, number] },
  };
  expect(discTriangleContact(vertical, triangle(0))).toBeDefined();
  expect(discTriangleContact(vertical, triangle(-2))).toBeUndefined();
});

it('tests finite discs against parked cars and aircraft, including floating origins', () => {
  const origin = new THREE.Vector3(1000, 20, -3000);
  const moved = {
    ...discProbe,
    center: new THREE.Vector3().fromArray(discProbe.center).add(origin).toArray(),
  };
  const obstacle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5, 0.1));
  obstacle.position.set(2.5, 3, 2.5);
  obstacle.updateMatrixWorld(true);
  const [hit] = aircraftObstacleContacts([moved], {
    origin,
    octree: new Octree().fromGraphNode(obstacle),
    cars: [],
    aircraft: [],
  });
  expect(hit?.point[0]).toBeCloseTo(1002.45);
  const scene = {
    origin: new THREE.Vector3(),
    octree: { sphereIntersect: () => false as const },
    cars: [
      {
        transform: {
          pos: [2, 0, 2] as [number, number, number],
          rot: [0, 0, 0, 1] as [number, number, number, number],
        },
        spec: { width: 0.5, length: 0.5, height: 2 } as VehicleSpec,
      },
    ],
    aircraft: [],
  };
  expect(aircraftObstacleContacts([discProbe], scene)).toHaveLength(0);
  scene.cars[0]!.spec.height = 4;
  expect(aircraftObstacleContacts([discProbe], scene)).toHaveLength(1);
  expect(
    aircraftObstacleContacts([discProbe], { ...scene, cars: [], aircraft: [[2, 1, 2]] }),
  ).toHaveLength(0);
  expect(
    aircraftObstacleContacts([discProbe], { ...scene, cars: [], aircraft: [[2, 3, 2]] }),
  ).toHaveLength(1);
});

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

it('retains axial contacts when a tilted disc is thicker than its radial extent', () => {
  const probe = {
    ...discProbe,
    radius: 0.2,
    disc: { ...discProbe.disc, normal: [1, 0, 0] as [number, number, number], halfThickness: 2 },
  };
  expect(
    aircraftObstacleContacts([probe], {
      origin: new THREE.Vector3(),
      octree: { sphereIntersect: () => false },
      cars: [],
      aircraft: [[2.8, 3, 0]],
    }),
  ).toHaveLength(1);
});
