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
