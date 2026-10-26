import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../../client/dist/aircraft.mjs';
import {
  compileModelSignalExpressions,
  createModelSignalVisual,
  readModelSignals,
} from '../../client/dist/instruments.mjs';
import { IDLE_AIRCRAFT_INPUT, stepAircraft } from '../../kernel/dist/aircraft.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

it('Twin Otter displays and controls follow simulated state while fixed landing gear stays deployed', async () => {
  const base = new URL('../../../content/entities/', import.meta.url),
    doc = JSON.parse(await readFile(new URL('source/aircraft/dhc-6/entity.types.json', base))),
    c = Object.values(doc.types)[0].components,
    s = c['model.signals'],
    spec = c.aircraft.spec;
  const b = await readFile(new URL('assets/molen/entities/aircraft/dhc_6/model.glb', base)),
    load = async () =>
      (
        await new GLTFLoader().parseAsync(
          b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
          '',
        )
      ).scene;
  const root = await load(),
    visual = createModelSignalVisual(root, s),
    node = (n) => root.getObjectByName(`TwinOtter-${n}`);
  expect(visual.missingNodes).toEqual([]);
  const read = (components) => readModelSignals(s.sources, (k) => components[k]);
  let state = c.aircraftState,
    t = c.transform;
  const input = { ...IDLE_AIRCRAFT_INPUT, engine: true, power: 0.9, brake: false };
  for (let i = 0; i < 240; i++) {
    const r = stepAircraft(t, state, input, spec, 1 / 60, { groundHeight: () => 0 });
    state = r.state;
    t = r.transform;
  }
  const live = { ...c, aircraftState: state, aircraftInput: input, transform: t },
    raw = read(live);
  expect(raw.engine1).toBeGreaterThan(0.5);
  expect(raw.engine2).toBeGreaterThan(0.5);
  const sample = {
      ...raw,
      trueAirspeed: (100 * 1852) / 3600,
      altitude: 3048,
      verticalSpeed: 5.08,
      yaw: Math.PI / 2,
      pitchInput: 0,
      rollInput: 0,
      yawInput: 0,
      flapPosition: 0,
    },
    v = compileModelSignalExpressions(s.derived)(sample);
  expect(v.knots).toBeCloseTo(100, 8);
  expect(v.feet).toBeCloseTo(10000, 8);
  expect(v.degreesTrue).toBeCloseTo(90, 8);
  expect(v.verticalFpm).toBeCloseTo(1000, 8);
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
  visual.update({ ...sample, altitude: -30.48, engine1: undefined }, 30);
  expect(node('PFD-0-altitude-minus').visible).toBe(true);
  expect(node('engine-0-indicator').visible).toBe(false);
  for (const i of [0, 1, 2]) expect(node(`gear-${i}`).visible).toBe(true);
  const earth = await load(),
    ev = createAircraftVisual(earth, spec);
  ev.update({ ...state, flapPosition: 1 }, input, 0, {
    ...readModelSignals(spec.visual.animation.sources, (k) => live[k]),
    ...readModelSignals(spec.visual.interior.sources, (k) => live[k]),
    flapPosition: 1,
  });
  expect(earth.getObjectByName('TwinOtter-flap-1').rotation.x).toBeCloseTo(-0.65, 7);
  ev.dispose();
  for (const scene of [earth, root])
    scene.traverse((n) => {
      if (n.isMesh) n.geometry.dispose();
    });
});
