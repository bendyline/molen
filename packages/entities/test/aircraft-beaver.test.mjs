import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../../client/dist/aircraft.mjs';
import {
  compileModelSignalExpressions,
  createModelSignalVisual,
  readModelSignals,
} from '../../client/dist/instruments.mjs';
import { IDLE_AIRCRAFT_INPUT, stepAircraft } from '../../kernel/dist/aircraft.mjs';

it('Beaver live instruments, drooping ailerons and tailwheel stance use independent sources', async () => {
  const base = new URL('../../../content/entities/', import.meta.url),
    doc = JSON.parse(await readFile(new URL('source/aircraft/dhc-2/entity.types.json', base))),
    c = Object.values(doc.types)[0].components,
    s = c['model.signals'],
    spec = c.aircraft.spec,
    b = await readFile(new URL('assets/molen/entities/aircraft/dhc_2/model.glb', base)),
    load = async () =>
      (
        await new GLTFLoader().parseAsync(
          b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
          '',
        )
      ).scene,
    root = await load(),
    visual = createModelSignalVisual(root, s),
    node = (n) => root.getObjectByName(`Beaver-${n}`);
  expect(visual.missingNodes).toEqual([]);
  let state = c.aircraftState,
    t = c.transform;
  const input = { ...IDLE_AIRCRAFT_INPUT, engine: true, power: 0.9, brake: false };
  for (let i = 0; i < 240; i++) {
    const r = stepAircraft(t, state, input, spec, 1 / 60, { groundHeight: () => 0 });
    state = r.state;
    t = r.transform;
  }
  const live = { ...c, aircraftState: state, aircraftInput: input, transform: t },
    raw = readModelSignals(s.sources, (k) => live[k]);
  expect(raw.engine1).toBeGreaterThan(0.5);
  const sample = {
      ...raw,
      trueAirspeed: 44.704,
      altitude: 3048,
      verticalSpeed: 5.08,
      yaw: Math.PI / 2,
      yawRate: Math.PI / 60,
      pitchInput: 0,
      rollInput: 0,
      yawInput: 0,
      flapPosition: 0,
    },
    v = compileModelSignalExpressions(s.derived)(sample);
  expect(v.mph).toBeCloseTo(100, 8);
  expect(v.feet).toBeCloseTo(10000, 8);
  expect(v.trueHeading).toBeCloseTo(Math.PI / 2, 8);
  expect(v.verticalFpm).toBeCloseTo(1000, 8);
  expect(v.turnDegrees).toBeCloseTo(3, 8);
  visual.update(sample, 0);
  root.updateMatrixWorld(true);
  for (const [name, source, sign] of [
    ['flap-1', 'flapPosition', -1],
    ['elevator-1', 'pitchInput', 1],
  ]) {
    const g = node(name),
      p = g.getWorldPosition(new Vector3()).add(new Vector3(0, 0, -0.3)),
      local = g.worldToLocal(p.clone());
    visual.update({ ...sample, [source]: 1 }, 10);
    root.updateMatrixWorld(true);
    expect((g.localToWorld(local).y - p.y) * sign).toBeGreaterThan(0);
    visual.update(sample, 20);
    root.updateMatrixWorld(true);
  }
  visual.update({ ...sample, flapPosition: 1, rollInput: 0, engine1: undefined }, 30);
  expect(node('aileron-1').rotation.x).toBeCloseTo(-0.18, 7);
  expect(node('aileron--1').rotation.x).toBeCloseTo(-0.18, 7);
  expect(node('rpm').visible).toBe(false);
  const earth = await load(),
    ev = createAircraftVisual(earth, spec);
  ev.update({ ...state, flapPosition: 1 }, { ...input, roll: 0 }, 0, {
    ...readModelSignals(spec.visual.animation.sources, (k) => live[k]),
    ...readModelSignals(spec.visual.interior.sources, (k) => live[k]),
    flapPosition: 1,
    rollInput: 0,
  });
  expect(earth.getObjectByName('Beaver-aileron-1').rotation.x).toBeCloseTo(-0.18, 7);
  ev.dispose();
  for (const scene of [earth, root])
    scene.traverse((n) => {
      if (n.isMesh) n.geometry.dispose();
    });
});
