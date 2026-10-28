import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../../client/dist/aircraft.mjs';
import {
  compileModelSignalExpressions,
  createModelSignalVisual,
  readModelSignals,
} from '../../client/dist/instruments.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
it('keeps MV-22 conversion, independent rotor axes and live displays consistent in both render paths', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/mv-22b/entity.types.json', base))),
    c = Object.values(doc.types)[0].components,
    s = c['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/mv_22b/model.glb', base));
  const load = async () =>
    (
      await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      )
    ).scene;
  const scene = await load(),
    visual = createModelSignalVisual(scene, s),
    node = (name) => scene.getObjectByName(`MV22-${name}`);
  expect(visual.missingNodes).toEqual([]);
  const raw = {
    trueAirspeed: (250 * 1852) / 3600,
    altitude: 3048,
    pitch: 0.1,
    roll: 0.3,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    gear: 1,
    flapPosition: 0,
    thrustVector: 1,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    engine1: 0.9,
    engine2: 0.8,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(250, 8);
  expect(values.feet).toBeCloseTo(10000, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  expect(values.headingDegrees).toBeCloseTo(90, 8);
  const origin = new Vector3(),
    axis = new Vector3(0, 0, 1);
  for (const [j, v] of [1, 0.5, 0].entries()) {
    visual.update({ ...raw, thrustVector: v }, j * 10);
    scene.updateMatrixWorld(true);
    for (let i = 1; i <= 2; i++) {
      const nacelle = node(`nacelle-${i}`),
        o = nacelle.localToWorld(origin.clone()),
        a = nacelle.localToWorld(axis.clone()).sub(o);
      expect(a.x).toBeCloseTo(0, 7);
      expect(a.y).toBeCloseTo(Math.sin((v * Math.PI) / 2), 7);
      expect(a.z).toBeCloseTo(Math.cos((v * Math.PI) / 2), 7);
      expect(o.x).toBeCloseTo(i === 1 ? 7.09 : -7.09, 7);
      expect(o.y).toBeCloseTo(3.97, 7);
    }
    expect(Math.sin(node('nacelle-1').rotation.x)).toBeCloseTo(-Math.sin((v * Math.PI) / 2), 7);
  }
  for (const side of [-1, 1]) {
    visual.update({ ...raw, thrustVector: 0, pitchInput: 0, flapPosition: 0 }, 40);
    scene.updateMatrixWorld(true);
    const g = node(`elevator-${side}`),
      p = g.getWorldPosition(new Vector3()).add(new Vector3(0, 0, -0.4)),
      local = g.worldToLocal(p.clone());
    visual.update({ ...raw, thrustVector: 0, pitchInput: 1, flapPosition: 0 }, 50);
    scene.updateMatrixWorld(true);
    expect(g.localToWorld(local).y).toBeGreaterThan(p.y);
  }
  for (const side of [-1, 1]) {
    visual.update({ ...raw, thrustVector: 0, flapPosition: 0 }, 60);
    scene.updateMatrixWorld(true);
    const g = node(`flaperon-${side}-0`),
      p = g.getWorldPosition(new Vector3()).add(new Vector3(0, 0, -0.5)),
      local = g.worldToLocal(p.clone());
    visual.update({ ...raw, thrustVector: 1, flapPosition: 0 }, 65);
    scene.updateMatrixWorld(true);
    expect(g.localToWorld(local).y).toBeLessThan(p.y);
  }
  visual.update(
    {
      ...raw,
      engine2: undefined,
      trueAirspeed: undefined,
      altitude: -30.48,
      thrustVector: undefined,
    },
    70,
  );
  expect(node('rpm-1-2').visible).toBe(false);
  expect(node('rpm-1-1').visible).toBe(true);
  expect(node('nacelle-1').visible).toBe(true);
  expect(node('alt-0-minus').visible).toBe(true);
  expect(node('standby-speed').visible).toBe(false);
  for (let digit = 0; digit < 3; digit++)
    for (let segment = 0; segment < 7; segment++)
      expect(node(`tas-0-${digit}-${segment}`).visible).toBe(false);
  // Earth calls the dedicated aircraft renderer with explicit component source readings.
  const earthScene = await load(),
    earth = createAircraftVisual(earthScene, c.aircraft.spec);
  const state = {
    ...c.aircraftState,
    airspeed: raw.trueAirspeed,
    gearPosition: 1,
    flapPosition: 0,
    thrustVectorPosition: 1,
    engines: {
      'engine-1': { rpm: 0.9, rotorAngle: 0.4 },
      'engine-2': { rpm: 0.8, rotorAngle: 0.7 },
    },
  };
  const input = { ...c.aircraftInput, power: 0.8 };
  const readings = readModelSignals(
    { ...c.aircraft.spec.visual.interior.sources, ...c.aircraft.spec.visual.animation.sources },
    (name) =>
      ({ aircraftState: state, aircraftInput: input, transform: { pos: [0, 3048, 0] } })[name],
  );
  earth.update(state, input, 3048, readings, 0);
  earthScene.updateMatrixWorld(true);
  expect(earthScene.getObjectByName('MV22-gear-left').visible).toBe(true);
  const flap = earthScene.getObjectByName('MV22-flaperon-1-0');
  expect(Math.sin(flap.rotation.x)).toBeCloseTo(Math.sin(-1.05), 7);
  expect(earthScene.getObjectByName('MV22-proprotor-1').rotation.z).toBeCloseTo(0.4, 7);
  expect(earthScene.getObjectByName('MV22-proprotor-2').rotation.z).toBeCloseTo(-0.7, 7);
  earth.dispose();
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});
