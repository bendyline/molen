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
import { IDLE_AIRCRAFT_INPUT, initialAircraftState } from '../../kernel/dist/aircraft.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
it('keeps A400M propeller handedness, individual gauges and swept hinges physically consistent', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/a400m/entity.types.json', base))),
    c = Object.values(doc.types)[0].components,
    s = c['model.signals'],
    spec = c.aircraft.spec;
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/a400m/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const node = (name) => {
    const n = scene.getObjectByName(`A400-${name}`);
    expect(n, name).toBeDefined();
    return n;
  };
  const visual = createModelSignalVisual(scene, s);
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
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    engine1: 0.9,
    engine2: 1,
    engine3: 0.85,
    engine4: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(250, 8);
  expect(values.feet).toBeCloseTo(10000, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  expect(values.unavailable).toBeUndefined();
  const readings = readModelSignals(
    s.sources,
    (name) =>
      ({
        aircraftState: {
          engines: {
            'engine-1': { rpm: 0.9 },
            'engine-2': { rpm: 1 },
            'engine-3': { rpm: 0.85 },
            'engine-4': { rpm: 0 },
          },
        },
      })[name],
  );
  expect([readings.engine1, readings.engine2, readings.engine3, readings.engine4]).toEqual([
    0.9, 1, 0.85, 0,
  ]);
  for (const [i, rpm] of [0.9, 1, 0.85, 0].entries())
    expect(values[`propRpm${i + 1}`]).toBeCloseTo(rpm * 860, 8);
  const update = (change, t) => {
    visual.update({ ...raw, ...change }, t);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  for (const [i, rpm] of [0.9, 1, 0.85, 0].entries())
    expect(node(`rpm-${i + 1}`).rotation.z).toBeCloseTo(-2.2 + rpm * 4, 7);
  for (const side of ['pilot', 'copilot'])
    expect(node(`${side}-horizon-bank`).rotation.z).toBeCloseTo(2 * Math.PI - 0.3, 7);
  const hinges = [
    'flap-1-0',
    'flap-1-1',
    'flap--1-0',
    'flap--1-1',
    'aileron-1',
    'aileron--1',
    'elevator-1',
    'elevator--1',
  ];
  const rests = Object.fromEntries(
      hinges.map((n) => [n, node(n).localToWorld(new Vector3(1, 0, 0))]),
    ),
    rudderRest = node('rudder').localToWorld(new Vector3(0, 1, 0));
  const trailing = Object.fromEntries(
    hinges
      .filter((n) => !n.startsWith('aileron'))
      .map((n) => {
        const world = node(n)
          .getWorldPosition(new Vector3())
          .add(new Vector3(0, 0, -1));
        return [n, { y: world.y, local: node(n).worldToLocal(world) }];
      }),
  );
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction, flapPosition: 1 },
      10 + (direction + 1) * 10,
    );
    for (const n of hinges)
      expect(
        node(n)
          .localToWorld(new Vector3(1, 0, 0))
          .distanceTo(rests[n]),
        n,
      ).toBeLessThan(1e-7);
    expect(
      node('rudder')
        .localToWorld(new Vector3(0, 1, 0))
        .distanceTo(rudderRest),
    ).toBeLessThan(1e-7);
    expect(node('stick-1').rotation.x).toBeCloseTo(-direction * 0.22, 7);
    for (const [n, p] of Object.entries(trailing)) {
      const delta = node(n).localToWorld(p.local.clone()).y - p.y;
      if (n.startsWith('flap')) expect(delta, n).toBeLessThan(-0.1);
      else expect(delta * direction, n).toBeGreaterThan(0.05);
    }
  }
  update({ gear: 0 }, 50);
  expect(node('nose-gear').visible).toBe(false);
  expect(node('main-gear-1').visible).toBe(false);
  expect(node('gear-down').visible).toBe(false);
  update({ engine1: undefined }, 60);
  expect(node('rpm-1').visible).toBe(false);
  expect(node('rpm-2').visible).toBe(true);
  update({ altitude: -30.48 }, 70);
  for (const side of ['pilot', 'copilot'])
    expect(node(`${side}-altitude-minus`).visible).toBe(true);
  visual.update({}, 80);
  for (const side of ['pilot', 'copilot']) expect(node(`${side}-horizon-bank`).visible).toBe(false);
  expect(node('standby-bank').visible).toBe(false);
  const aircraft = createAircraftVisual(scene, spec),
    angles = [0.2, 0.4, 0.6, 0.8],
    state = {
      ...initialAircraftState(),
      engines: Object.fromEntries(
        angles.map((rotorAngle, i) => [
          `engine-${i + 1}`,
          { rotorAngle, rpm: 1, thrust: 0, failed: false },
        ]),
      ),
    };
  aircraft.update(state, IDLE_AIRCRAFT_INPUT, 0, {}, 100);
  expect(spec.engines.map((e) => e.propellerRotation)).toEqual([
    'clockwise',
    'counterclockwise',
    'clockwise',
    'counterclockwise',
  ]);
  for (const [i, sign] of [1, -1, 1, -1].entries()) {
    expect(node(`propeller-${i + 1}`).rotation.z).toBeCloseTo(angles[i] * sign, 8);
    expect((spec.engines[i].rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(860, 8);
    for (let j = 0; j < 8; j++) node(`blade-${i + 1}-${j}`);
  }
  // At the side facing its neighbour on the same wing, every propeller moves DOWN.
  for (const e of Object.values(state.engines)) e.rotorAngle = 0.1;
  aircraft.update(state, IDLE_AIRCRAFT_INPUT, 0, {}, 101);
  scene.updateMatrixWorld(true);
  for (const [i, dx] of [-1, 1, -1, 1].entries()) {
    const prop = node(`propeller-${i + 1}`),
      center = prop.getWorldPosition(new Vector3()),
      blade = prop.localToWorld(new Vector3(dx, 0, 0));
    expect(blade.y - center.y).toBeLessThan(-0.09);
  }
  aircraft.dispose();
});
