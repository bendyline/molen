import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { expect, it } from 'vitest';
import {
  compileModelSignalExpressions,
  createModelSignalVisual,
  readModelSignals,
} from '../../client/dist/instruments.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
it('keeps An-124 analog panel, four engine readings and swept control hinges consistent', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/an-124/entity.types.json', base))),
    c = Object.values(doc.types)[0].components,
    s = c['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/an_124/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s),
    node = (name) => {
      const n = scene.getObjectByName(`AN124-${name}`);
      expect(n, name).toBeDefined();
      return n;
    };
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
  expect(values.kmh).toBeCloseTo(raw.trueAirspeed * 3.6, 8);
  const read = readModelSignals(
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
  expect([read.engine1, read.engine2, read.engine3, read.engine4]).toEqual([0.9, 1, 0.85, 0]);
  const update = (change, t) => {
    visual.update({ ...raw, ...change }, t);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  for (const [i, rpm] of [0.9, 1, 0.85, 0].entries())
    expect(node(`rpm-${i + 1}`).position.y).toBeCloseTo(
      8.6 + ((670 - 622) * 3) / 1040 - 0.085 + rpm * 0.17,
      7,
    );
  for (const side of ['pilot', 'copilot'])
    expect(node(`${side}-attitude-bank`).rotation.z).toBeCloseTo(2 * Math.PI - 0.3, 7);
  const hinges = [
    'flap-1-0',
    'flap-1-1',
    'flap-1-2',
    'flap--1-0',
    'flap--1-1',
    'flap--1-2',
    'aileron-1',
    'aileron--1',
    'elevator-1',
    'elevator--1',
  ];
  const rests = Object.fromEntries(
    hinges.map((n) => [n, node(n).localToWorld(new Vector3(1, 0, 0))]),
  );
  const rudderRest = node('rudder').localToWorld(new Vector3(0, 1, 0));
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
    expect(node('column-1').rotation.x).toBeCloseTo(-direction * 0.18, 7);
    expect(node('yoke--1').rotation.z).toBeCloseTo(direction * 0.65, 7);
    for (const [n, p] of Object.entries(trailing)) {
      const delta = node(n).localToWorld(p.local.clone()).y - p.y;
      if (n.startsWith('flap')) expect(delta, n).toBeLessThan(-0.1);
      else expect(delta * direction, n).toBeGreaterThan(0.05);
    }
  }
  update({ gear: 0 }, 50);
  for (const side of [-1, 1]) expect(node(`nose-gear-${side}`).visible).toBe(false);
  for (const side of [-1, 1])
    for (const j of [0, 1, 2, 3, 4]) expect(node(`main-gear-${side}-${j}`).visible).toBe(false);
  expect(node('gear-down').visible).toBe(false);
  update({ engine1: undefined }, 60);
  expect(node('rpm-1').visible).toBe(false);
  expect(node('rpm-2').visible).toBe(true);
  visual.update({}, 70);
  expect(node('pilot-attitude-bank').visible).toBe(false);
  expect(node('copilot-attitude-bank').visible).toBe(false);
  expect(c.aircraft.spec.visual.rotors.map((r) => r.engine)).toEqual([
    'engine-1',
    'engine-2',
    'engine-3',
    'engine-4',
  ]);
  for (let i = 1; i <= 4; i++) expect(node(`engine-fan-${i}`).rotation.z).toBe(0);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});
