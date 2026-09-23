import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createVehicleInteriorVisual } from '../src/vehicle-interior';

it('uses arbitrary model nodes, calibrations and authored rest poses without accumulating drift', () => {
  const model = new THREE.Group();
  model.name = 'widebody-flight-deck';
  const left = new THREE.Group();
  const right = new THREE.Group();
  left.name = right.name = 'altitude-tape';
  left.position.y = 1;
  right.position.y = 2;
  const pointer = new THREE.Group();
  pointer.name = 'engine-two-indicator';
  pointer.rotation.x = 0.3;
  model.add(left, right, pointer);
  const visual = createVehicleInteriorVisual(model, {
    nodes: ['widebody-flight-deck'],
    bindings: [
      {
        node: 'altitude-tape',
        source: 'altitude',
        property: 'position',
        axis: 'y',
        scale: 0.001,
        max: 0.4,
      },
      {
        node: 'engine-two-indicator',
        source: 'engine2',
        property: 'rotation',
        axis: 'x',
        scale: -2,
        offset: 1,
      },
    ],
  });
  for (let i = 0; i < 3; i++) visual.update({ altitude: 5000, engine2: 0.7 });
  expect(left.position.y).toBe(1.4);
  expect(right.position.y).toBe(2.4);
  expect(pointer.rotation.x).toBeCloseTo(-0.1);
  visual.update({ altitude: Number.NaN });
  expect(left.position.y).toBe(1.4);
  expect(pointer.rotation.x).toBeCloseTo(-0.1);
  expect(visual.missingNodes).toEqual([]);
  expect(model.children).toEqual([left, right, pointer]);
  expect(model.children.every((node) => node.visible)).toBe(true);
});

it('reports missing authored nodes and never fabricates a cockpit', () => {
  const model = new THREE.Group();
  const visual = createVehicleInteriorVisual(model, {
    nodes: ['cabin'],
    bindings: [{ node: 'dial', source: 'speed', property: 'rotation', axis: 'z', scale: 1 }],
  });
  expect(visual.missingNodes).toEqual(['cabin', 'dial']);
  visual.update({ speed: 20 });
  expect(model.children).toHaveLength(0);
});
