import type { AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createAircraftDamageVisual } from '../src/aircraft-damage';

const parts: NonNullable<AircraftSpec['collisionParts']> = [
  {
    id: 'wing',
    role: 'leftWing',
    center: [2, 1, 0],
    probes: [[3, 1, 0]],
    massFraction: 0.1,
    radius: 0.3,
    breakSpeed: 12,
    nodes: ['wing'],
    fragments: { nodes: ['marking'], min: [1, 0, -1], max: [4, 2, 1] },
  },
];
const spec = { collisionParts: parts } as AircraftSpec;
const damaged = (): AircraftStateData =>
  ({
    damage: { wing: { integrity: 0, detached: true } },
    debris: [
      {
        part: 'wing',
        pos: [14, 4, 7],
        rot: [0, 0, 0, 1],
        velocity: [0, 0, 1],
        angularVelocity: [0, 1, 0],
        age: 1,
      },
    ],
  }) as AircraftStateData;

it('detaches the authored geometry at its simulated pose under transformed scene parents and recovers it', () => {
  const scene = new THREE.Group();
  scene.position.set(-1000, 20, 400);
  scene.rotation.y = 0.4;
  const model = new THREE.Group();
  model.position.set(10, 2, 5);
  model.rotation.y = 0.6;
  scene.add(model);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1), new THREE.MeshBasicMaterial());
  wing.name = 'wing';
  wing.position.set(2, 1, 0);
  model.add(wing);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 4), wing.material);
  model.add(body);
  const damage = createAircraftDamageVisual(model, spec);
  const state = damaged();
  damage.update(state);
  expect(wing.visible).toBe(false);
  const debris = model.getObjectByName('debris:wing');
  expect(debris?.children).toHaveLength(1);
  scene.updateMatrixWorld(true);
  const expected = scene.localToWorld(new THREE.Vector3(14, 4, 7));
  expect(
    debris?.children[0]?.getWorldPosition(new THREE.Vector3()).distanceTo(expected),
  ).toBeLessThan(1e-8);
  expect(body.visible).toBe(true);
  model.position.add(new THREE.Vector3(30, 5, -2));
  model.rotation.z = 1;
  damage.update(state);
  scene.updateMatrixWorld(true);
  expect(
    debris?.children[0]?.getWorldPosition(new THREE.Vector3()).distanceTo(expected),
  ).toBeLessThan(1e-8);
  // Gear or animation bindings can set visible every frame; separation wins afterwards.
  wing.visible = true;
  damage.update(state);
  expect(wing.visible).toBe(false);
  damage.update({} as AircraftStateData);
  expect(wing.visible).toBe(true);
  expect(model.getObjectByName('debris:wing')).toBeUndefined();
});

it('partitions a shared marking mesh without moving the other wing markings or mutating its source', () => {
  const model = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [2, 1, 0, 3, 1, 0, 2, 1, 0.5, -2, 1, 0, -3, 1, 0, -2, 1, 0.5],
      3,
    ),
  );
  const marking = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  marking.name = 'marking_1';
  marking.userData.name = 'marking';
  model.add(marking);
  const damage = createAircraftDamageVisual(model, spec);
  damage.update(damaged());
  expect(marking.visible).toBe(false);
  const remaining = model.getObjectByName('section:body:marking_1') as THREE.Mesh;
  const separated = model.getObjectByName('section:wing:marking_1') as THREE.Mesh;
  expect(remaining.geometry.index?.count).toBe(3);
  expect(remaining.visible).toBe(true);
  expect(separated.visible).toBe(false);
  expect(geometry.index).toBeNull();
  expect(model.getObjectByName('debris:wing')?.children).toHaveLength(1);
  damage.update({ ...damaged(), debris: [] });
  expect(model.getObjectByName('debris:wing')).toBeUndefined();
  expect(separated.visible).toBe(false);
  damage.reset();
  expect(separated.visible).toBe(true);
  expect(marking.visible).toBe(false);
});
