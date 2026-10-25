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

const base = new URL('../../../content/entities/', import.meta.url);
it('drives all four Harrier nozzles and the cockpit from real simulated state, including the Earth renderer', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/av-8b/entity.types.json', base))),
    c = Object.values(doc.types)[0].components,
    s = c['model.signals'],
    spec = c.aircraft.spec;
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/av_8b/model.glb', base)),
    load = async () =>
      (
        await new GLTFLoader().parseAsync(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          '',
        )
      ).scene;
  const scene = await load(),
    v = createModelSignalVisual(scene, s),
    node = (n) => scene.getObjectByName(`AV8-${n}`);
  expect(v.missingNodes).toEqual([]);
  const read = (components) => readModelSignals(s.sources, (k) => components[k]);
  v.update(read(c), 0);
  expect(node('gear-main').visible).toBe(true);
  let state = c.aircraftState,
    transform = c.transform;
  const input = {
    ...IDLE_AIRCRAFT_INPUT,
    engine: true,
    power: 0.85,
    brake: false,
    thrustVector: 1,
  };
  for (let i = 0; i < 240; i++) {
    const r = stepAircraft(transform, state, input, spec, 1 / 60, { groundHeight: () => 0 });
    state = r.state;
    transform = r.transform;
  }
  const live = { ...c, aircraftState: state, aircraftInput: input, transform },
    raw = read(live);
  expect(raw.engine1).toBeGreaterThan(0.5);
  expect(raw.thrustVector).toBe(1);
  const sample = {
    ...raw,
    trueAirspeed: (250 * 1852) / 3600,
    altitude: 3048,
    verticalSpeed: 5.08,
    yaw: Math.PI / 2,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    flapPosition: 0,
    gear: 1,
  };
  const values = compileModelSignalExpressions(s.derived)(sample);
  expect(values.knots).toBeCloseTo(250, 8);
  expect(values.feet).toBeCloseTo(10000, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  expect(values.headingDegrees).toBeCloseTo(90, 8);
  for (const [j, position] of [0, 0.5, 1].entries()) {
    v.update({ ...sample, thrustVector: position }, j * 10 + 10);
    scene.updateMatrixWorld(true);
    for (const side of [-1, 1])
      for (const i of [0, 1]) {
        const nozzle = node(`nozzle-${side}-${i}`),
          origin = nozzle.localToWorld(new Vector3()),
          out = nozzle.localToWorld(new Vector3(0, 0, -1)).sub(origin);
        expect(out.x).toBeCloseTo(0, 7);
        expect(out.y).toBeCloseTo(-Math.sin((position * Math.PI) / 2), 7);
        expect(out.z).toBeCloseTo(-Math.cos((position * Math.PI) / 2), 7);
      }
  }
  for (const side of [-1, 1])
    for (const [name, source, sign] of [
      ['flap', 'flapPosition', -1],
      ['stabilator', 'pitchInput', 1],
    ]) {
      v.update({ ...sample, thrustVector: 0 }, 50);
      scene.updateMatrixWorld(true);
      const g = node(`${name}-${side}`),
        p = g.getWorldPosition(new Vector3()).add(new Vector3(0, 0, -0.3)),
        local = g.worldToLocal(p.clone());
      v.update({ ...sample, [source]: 1 }, 60);
      scene.updateMatrixWorld(true);
      expect((g.localToWorld(local).y - p.y) * sign).toBeGreaterThan(0);
    }
  for (const [yaw, cardinal] of [
    [Math.PI, 0],
    [Math.PI / 2, 90],
    [0, 180],
    [-Math.PI / 2, 270],
  ])
    expect(compileModelSignalExpressions(s.derived)({ ...sample, yaw }).headingDegrees).toBeCloseTo(
      cardinal,
      8,
    );
  v.update({ ...sample, altitude: -30.48, engine1: undefined, thrustVector: undefined }, 70);
  expect(node('MPCD-altitude-minus').visible).toBe(true);
  expect(node('rpm-0-0').visible).toBe(false);
  expect(node('nozzle-1-0').visible).toBe(true);
  const earth = await load(),
    ev = createAircraftVisual(earth, spec),
    extra = {
      ...readModelSignals(spec.visual.animation.sources, (k) => live[k]),
      ...readModelSignals(spec.visual.interior.sources, (k) => live[k]),
    };
  ev.update(state, input, 0, extra);
  earth.updateMatrixWorld(true);
  const nozzle = earth.getObjectByName('AV8-nozzle-1-0');
  expect(Math.sin(nozzle.rotation.x)).toBeCloseTo(-1, 7);
  expect(earth.getObjectByName('AV8-gear-main').visible).toBe(true);
});
