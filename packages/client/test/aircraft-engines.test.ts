import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../src/aircraft';

it('animates independently bound propellers and retains the common phase for unbound rotors', () => {
  const model = new THREE.Group();
  const nodes = ['left-prop', 'right-prop', 'legacy-prop'].map((name) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(2, 1, 1);
    model.add(node);
    return node;
  });
  const spec = {
    visual: {
      rotors: [
        { node: 'left-prop', engine: 'left', axis: 'z', multiplier: 1 },
        { node: 'right-prop', engine: 'right', axis: 'z', multiplier: -1 },
        { node: 'legacy-prop', axis: 'z', multiplier: 1 },
      ],
      gearNodes: [],
      flaps: [],
      ailerons: [],
    },
  } as unknown as AircraftSpec;
  const visual = createAircraftVisual(model, spec);
  const state = {
    rotorAngle: 1,
    engines: {
      left: { rpm: 0, rotorAngle: 0.4, failed: true, thrust: 0 },
      right: { rpm: 1, rotorAngle: 2.2, failed: false, thrust: 2000 },
    },
  } as unknown as AircraftStateData;
  visual.update(state, {} as AircraftInputData, 0);
  expect(nodes.map((node) => node.rotation.z)).toEqual([0.4, -2.2, 1]);
  visual.update(
    {
      ...state,
      rotorAngle: 2,
      engines: {
        ...state.engines,
        right: { rpm: 1, rotorAngle: 3, failed: false, thrust: 2000 },
      },
    },
    {} as AircraftInputData,
    0,
  );
  expect(nodes.map((node) => node.rotation.z)).toEqual([0.4, -3, 2]);
  expect(nodes.map((node) => node.position.toArray())).toEqual([
    [2, 1, 1],
    [2, 1, 1],
    [2, 1, 1],
  ]);
  visual.dispose();
});

it('blurs a propeller into a disc at full power, keeping the hub', () => {
  const model = new THREE.Group();
  const prop = new THREE.Group();
  prop.name = 'prop';
  const blades = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 2, 0.02),
    new THREE.MeshStandardMaterial({ name: 'shared' }),
  );
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.15), blades.material);
  prop.add(blades, hub);
  model.add(prop);
  const elsewhere = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), blades.material);
  model.add(elsewhere);
  const spec = {
    engines: [{ id: 'one', rotorAngularSpeed: (2400 * 2 * Math.PI) / 60 }],
    visual: {
      rotors: [{ node: 'prop', engine: 'one', axis: 'z', multiplier: 1 }],
      gearNodes: [],
      flaps: [],
      ailerons: [],
    },
  } as unknown as AircraftSpec;
  const visual = createAircraftVisual(model, spec);
  const at = (rpm: number) =>
    visual.update(
      {
        rotorAngle: 0,
        engines: { one: { rpm, rotorAngle: 0.4, failed: false, thrust: 0 } },
      } as never,
      {} as AircraftInputData,
      0,
    );
  const discs = prop.children.filter((child) => child !== blades && child !== hub);
  expect(discs).toHaveLength(2);
  const faded = blades.material as THREE.Material;
  // Idle: the blades are simply blades.
  at(0.1);
  expect(blades.visible).toBe(true);
  expect(faded.opacity).toBe(1);
  expect(discs.every((disc) => !disc.visible)).toBe(true);
  // Full power: 240 degrees a frame would freeze three blades, so none are drawn.
  at(1);
  expect(blades.visible).toBe(false);
  expect(discs.every((disc) => disc.visible)).toBe(true);
  expect(hub.visible).toBe(true);
  // The fade stays on the blades: the shared material elsewhere on the airframe is untouched.
  expect(hub.material).toBe(elsewhere.material);
  expect((elsewhere.material as THREE.Material).opacity).toBe(1);
  expect(prop.rotation.z).toBe(0.4);
  // Back to idle, the blades return.
  at(0.1);
  expect(blades.visible).toBe(true);
  expect(discs.every((disc) => !disc.visible)).toBe(true);
  visual.dispose();
});
