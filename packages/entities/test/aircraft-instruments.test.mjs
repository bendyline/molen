import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  compileModelSignalExpressions,
  createModelSignalVisual,
  readModelSignals,
} from '../../client/dist/instruments.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
const definition = JSON.parse(
  await readFile(new URL('source/aircraft/cessna-172s/entity.types.json', base)),
);
const components = definition.types['molen.entities.aircraft.cessna_172s'].components;
const signals = components['model.signals'];

it('places each rotating heading card cardinal at the upper index, including east and west', async () => {
  for (const slug of [
    'cessna-172s',
    'cessna-208b',
    'cessna-182t',
    'bonanza-g36',
    'baron-g58',
    'king-air-350i',
    'cirrus-sr22t',
    'diamond-da42',
    'pilatus-pc12',
    'f-16b',
    'f-14d',
    'f-15c',
    'fa-18c',
    'f-22a',
    'f-35a',
    'typhoon',
    'rafale-c',
    'gripen-c',
    'mig-29a',
    'c-130j',
    'c-17a',
    'a400m',
    'c-5m',
    'an-124',
  ]) {
    const doc = JSON.parse(
        await readFile(new URL(`source/aircraft/${slug}/entity.types.json`, base)),
      ),
      c = Object.values(doc.types)[0].components,
      s = c['model.signals'];
    const bytes = await readFile(
        new URL(`assets/molen/entities/aircraft/${slug.replaceAll('-', '_')}/model.glb`, base),
      ),
      { scene } = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      );
    const cards = s.bindings.filter(
      (b) => b.source === 'trueHeading' && b.property === 'rotation' && b.axis === 'z',
    );
    expect(cards.length, slug).toBeGreaterThan(0);
    for (const heading of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const visual = createModelSignalVisual(scene, s);
      visual.update({ yaw: Math.PI - heading }, 0);
      for (const b of cards) {
        const card = scene.getObjectByName(b.node);
        const mark = new Vector3(-Math.sin(heading), Math.cos(heading), 0).applyQuaternion(
          card.quaternion,
        );
        expect(mark.x, `${slug} ${heading}`).toBeCloseTo(0, 6);
        expect(mark.y, `${slug} ${heading}`).toBeCloseTo(1, 6);
      }
      // Restore rest poses before compiling another independent state.
      visual.update({ yaw: Math.PI }, 10000);
    }
    scene.traverse((n) => {
      if (n.isMesh) n.geometry.dispose();
    });
  }
});

it('keeps C-17 displays, four engine readings and swept control hinges consistent', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/c-17a/entity.types.json', base))),
    c = Object.values(doc.types)[0].components,
    s = c['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/c_17a/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s),
    node = (name) => {
      const n = scene.getObjectByName(`C17-${name}`);
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
  expect(Object.keys(s.derived).some((k) => k.startsWith('C17-copilot.'))).toBe(false);
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
    expect(node('stick-1').rotation.x).toBeCloseTo(-direction * 0.2, 7);
    expect(node('stick--1').rotation.z).toBeCloseTo(direction * 0.2, 7);
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
  visual.update({}, 70);
  expect(node('pilot-horizon-bank').visible).toBe(false);
  expect(node('copilot-horizon-bank').visible).toBe(false);
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

it('shares C-130J flight displays while reading four independent propeller states', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/c-130j/entity.types.json', base))),
    c = Object.values(doc.types)[0].components,
    s = c['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/c_130j/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s),
    node = (name) => {
      const n = scene.getObjectByName(`C130J-${name}`);
      expect(n, name).toBeDefined();
      return n;
    };
  expect(visual.missingNodes).toEqual([]);
  const raw = {
    trueAirspeed: (180 * 1852) / 3600,
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
    prop1: 0.9,
    prop2: 1,
    prop3: 0.85,
    prop4: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(180, 8);
  expect(values.feet).toBeCloseTo(10000, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  expect(Object.keys(s.derived).filter((k) => k.startsWith('C130J-copilot.'))).toEqual([]);
  const state = readModelSignals(
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
  expect([state.prop1, state.prop2, state.prop3, state.prop4]).toEqual([0.9, 1, 0.85, 0]);
  const update = (change, t) => {
    visual.update({ ...raw, ...change }, t);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  for (const [i, rpm] of [0.9, 1, 0.85, 0].entries())
    expect(node(`prop-${i + 1}`).rotation.z).toBeCloseTo(-2.2 + rpm * 4, 7);
  for (let i = 1; i <= 4; i++) {
    expect(node(`propeller-${i}`).rotation.z).toBe(0);
    let owner = node(`prop-${i}`);
    while (owner && owner.name !== 'cockpit') owner = owner.parent;
    expect(owner?.name).toBe('cockpit');
  }
  expect(node('pilot-horizon-bank').rotation.z).toBeCloseTo(2 * Math.PI - 0.3, 7);
  expect(node('copilot-horizon-bank').rotation.z).toBeCloseTo(2 * Math.PI - 0.3, 7);
  const hinges = ['flap-1', 'flap--1', 'aileron-1', 'aileron--1', 'elevator-1', 'elevator--1'];
  const rests = Object.fromEntries(
    hinges.map((n) => [n, node(n).localToWorld(new Vector3(1, 0, 0))]),
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
  }
  update({ gear: 0 }, 50);
  expect(node('nose-gear').visible).toBe(false);
  expect(node('main-gear-1-0').visible).toBe(false);
  update({ prop1: undefined }, 60);
  expect(node('prop-1').visible).toBe(false);
  expect(node('prop-2').visible).toBe(true);
  visual.update({}, 70);
  for (const side of ['pilot', 'copilot']) expect(node(`${side}-horizon-bank`).visible).toBe(false);
  expect(s.bindings.map((b) => b.source).join(' ')).not.toMatch(
    /torque|fuel|ITT|oilPressure|ngPercent/,
  );
  expect(c.aircraft.spec.visual.rotors.map((r) => r.engine)).toEqual([
    'engine-1',
    'engine-2',
    'engine-3',
    'engine-4',
  ]);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('drives MiG-29 metric instruments and preserves its swept and canted hinges', async () => {
  const doc = JSON.parse(
    await readFile(new URL('source/aircraft/mig-29a/entity.types.json', base)),
  );
  const s = Object.values(doc.types)[0].components['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/mig_29a/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s),
    node = (name) => {
      const n = scene.getObjectByName(`MiG29-${name}`);
      expect(n, name).toBeDefined();
      return n;
    };
  expect(visual.missingNodes).toEqual([]);
  const raw = {
    trueAirspeed: 600 / 3.6,
    altitude: 1234,
    pitch: 0.1,
    roll: 0.3,
    yaw: Math.PI / 2,
    verticalSpeed: 50,
    loadFactor: 3,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.kph).toBeCloseTo(600, 8);
  expect(values.altitudeRemainder).toBe(234);
  expect(values.trueHeading).toBeCloseTo(Math.PI / 2, 8);
  const update = (state, time) => {
    visual.update({ ...raw, ...state }, time);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  expect(node('airspeed').rotation.z).toBeCloseTo(2.45, 8);
  expect(node('altitude').rotation.z).toBeCloseTo(0.234 * 2 * Math.PI, 8);
  expect(node('vertical-speed').rotation.z).toBeCloseTo(Math.PI, 8);
  const names = [
    'slat-left',
    'slat-right',
    'flap-left',
    'aileron-right',
    'rudder-left',
    'rudder-right',
  ];
  const point = (name) => new Vector3(...(name.startsWith('rudder') ? [0, 1, 0] : [1, 0, 0]));
  const rests = Object.fromEntries(
    names.map((name) => [name, node(name).localToWorld(point(name))]),
  );
  const stickRest = node('stick').localToWorld(new Vector3(0, 0.3, 0));
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction, flapPosition: 1 },
      10 + (direction + 1) * 10,
    );
    for (const name of names)
      expect(node(name).localToWorld(point(name)).distanceTo(rests[name]), name).toBeLessThan(1e-7);
    expect(node('stabilator-left').rotation.x).toBeCloseTo(0.16 * direction, 8);
    expect(node('stabilator-right').rotation.x).toBeCloseTo(0.42 * direction, 8);
    const stick = node('stick').localToWorld(new Vector3(0, 0.3, 0));
    expect((stick.x - stickRest.x) * direction).toBeLessThan(-0.01);
    expect((stick.z - stickRest.z) * direction).toBeLessThan(-0.01);
  }
  update({ altitude: -30, gear: 0 }, 1000);
  expect(node('altitude-number-minus').visible).toBe(true);
  for (const name of ['left', 'right', 'nose']) expect(node(`gear-${name}`).visible).toBe(false);
  visual.update({}, 1001);
  for (const name of [
    'airspeed',
    'altitude',
    'vertical-speed',
    'G',
    'ADI-bank',
    'heading',
    'gear-lamp',
  ])
    expect(node(name).visible).toBe(false);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 7; j++) expect(node(`altitude-number-${i}-${j}`).visible).toBe(false);
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/fuel|oil|temperature|engineRpm|radar/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('preserves the Gripen swept hinges and drives its portrait cockpit and center stick', async () => {
  const doc = JSON.parse(
      await readFile(new URL('source/aircraft/gripen-c/entity.types.json', base)),
    ),
    s = Object.values(doc.types)[0].components['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/gripen_c/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s),
    node = (name) => {
      const n = scene.getObjectByName(`Gripen-${name}`);
      expect(n, name).toBeDefined();
      return n;
    };
  expect(visual.missingNodes).toEqual([]);
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    pitch: 0.1,
    roll: 0.3,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  const update = (state, time) => {
    visual.update({ ...raw, ...state }, time);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  const names = ['slat-left', 'slat-right', 'elevon-left-0', 'elevon-right-1', 'rudder'],
    point = (name) => new Vector3(...(name === 'rudder' ? [0, 1, 0] : [1, 0, 0]));
  const rests = Object.fromEntries(
      names.map((name) => [name, node(name).localToWorld(point(name))]),
    ),
    stickRest = node('stick').localToWorld(new Vector3(0, 0.23, 0));
  expect(stickRest.x).toBeCloseTo(0, 6);
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction, flapPosition: 1 },
      10 + (direction + 1) * 10,
    );
    for (const side of ['left', 'right']) {
      expect(node(`canard-${side}`).rotation.x).toBeCloseTo(-0.26 * direction, 8);
      for (const j of [0, 1])
        expect(node(`elevon-${side}-${j}`).rotation.x).toBeCloseTo(
          (side === 'left' ? 0.04 : 0.52) * direction,
          8,
        );
    }
    for (const name of names)
      expect(node(name).localToWorld(point(name)).distanceTo(rests[name]), name).toBeLessThan(1e-7);
    const stick = node('stick').localToWorld(new Vector3(0, 0.23, 0));
    expect((stick.x - stickRest.x) * direction).toBeLessThan(-0.01);
    expect((stick.z - stickRest.z) * direction).toBeLessThan(-0.01);
  }
  update({ altitude: -30.48, gear: 0 }, 1000);
  expect(node('altitude-minus').visible).toBe(true);
  for (const name of ['left', 'right', 'nose']) expect(node(`gear-${name}`).visible).toBe(false);
  visual.update({}, 1001);
  for (const name of ['attitude-bank', 'heading', 'gear-lamp'])
    expect(node(name).visible).toBe(false);
  for (const [name, count] of [
    ['speed', 3],
    ['altitude', 5],
    ['vertical-speed', 5],
  ])
    for (let i = 0; i < count; i++)
      for (let j = 0; j < 7; j++) expect(node(`${name}-${i}-${j}`).visible).toBe(false);
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/fuel|oil|temperature|engineRpm|radar/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('preserves the Rafale swept hinges and drives its tilted HLD and right side-stick', async () => {
  const doc = JSON.parse(
      await readFile(new URL('source/aircraft/rafale-c/entity.types.json', base)),
    ),
    s = Object.values(doc.types)[0].components['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/rafale_c/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s),
    node = (name) => {
      const n = scene.getObjectByName(`Rafale-${name}`);
      expect(n, name).toBeDefined();
      return n;
    };
  expect(visual.missingNodes).toEqual([]);
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    pitch: 0.1,
    roll: 0.3,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  const update = (state, time) => {
    visual.update({ ...raw, ...state }, time);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  expect(node('heading').parent).toBe(node('HLD'));
  expect(node('HLD').rotation.x).toBeCloseTo(0.38, 6);
  const names = ['slat-left', 'slat-right', 'elevon-left-0', 'elevon-right-1', 'rudder'],
    point = (name) => new Vector3(...(name === 'rudder' ? [0, 1, 0] : [1, 0, 0]));
  const rests = Object.fromEntries(
      names.map((name) => [name, node(name).localToWorld(point(name))]),
    ),
    stickRest = node('stick').localToWorld(new Vector3(0, 0.23, 0));
  expect(stickRest.x).toBeLessThan(-0.2);
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction, flapPosition: 1 },
      10 + (direction + 1) * 10,
    );
    for (const side of ['left', 'right']) {
      expect(node(`canard-${side}`).rotation.x).toBeCloseTo(-0.25 * direction, 8);
      for (const j of [0, 1])
        expect(node(`elevon-${side}-${j}`).rotation.x).toBeCloseTo(
          (side === 'left' ? 0.04 : 0.52) * direction,
          8,
        );
    }
    for (const name of names)
      expect(node(name).localToWorld(point(name)).distanceTo(rests[name]), name).toBeLessThan(1e-7);
    const stick = node('stick').localToWorld(new Vector3(0, 0.23, 0));
    expect((stick.x - stickRest.x) * direction).toBeLessThan(-0.01);
    expect((stick.z - stickRest.z) * direction).toBeLessThan(-0.01);
  }
  update({ altitude: -30.48, gear: 0 }, 1000);
  expect(node('altitude-minus').visible).toBe(true);
  for (const name of ['left', 'right', 'nose']) expect(node(`gear-${name}`).visible).toBe(false);
  visual.update({}, 1001);
  for (const name of ['attitude-bank', 'standby-attitude-bank', 'heading', 'gear-lamp'])
    expect(node(name).visible).toBe(false);
  for (const [name, count] of [
    ['speed', 3],
    ['altitude', 5],
    ['HLD-vertical-speed', 5],
  ])
    for (let i = 0; i < count; i++)
      for (let j = 0; j < 7; j++) expect(node(`${name}-${i}-${j}`).visible).toBe(false);
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/fuel|oil|temperature|engineRpm|radar/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('mixes Typhoon elevons, moves the canards and center stick, and blanks unavailable flight readings', async () => {
  const doc = JSON.parse(
      await readFile(new URL('source/aircraft/typhoon/entity.types.json', base)),
    ),
    s = Object.values(doc.types)[0].components['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/typhoon/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s),
    node = (name) => {
      const n = scene.getObjectByName(`Typhoon-${name}`);
      expect(n, name).toBeDefined();
      return n;
    };
  expect(visual.missingNodes).toEqual([]);
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    pitch: 0.1,
    roll: 0.3,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  const update = (state, time) => {
    visual.update({ ...raw, ...state }, time);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  for (const name of ['attitude-bank', 'standby-attitude-bank'])
    expect(node(name).rotation.z).toBeCloseTo(Math.PI * 2 - 0.3, 8);
  const names = ['slat-1', 'inboard-elevon-1', 'outboard-elevon-1', 'rudder'],
    point = (name) => new Vector3(...(name === 'rudder' ? [0, 1, 0] : [1, 0, 0]));
  const rests = Object.fromEntries(
      names.map((name) => [name, node(name).localToWorld(point(name))]),
    ),
    stickRest = node('stick').localToWorld(new Vector3(0, 0.44, 0));
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction, flapPosition: 1 },
      10 + (direction + 1) * 10,
    );
    for (const side of [-1, 1]) {
      expect(node(`canard-${side}`).rotation.x).toBeCloseTo(-0.26 * direction, 8);
      for (const name of ['inboard-elevon', 'outboard-elevon'])
        expect(node(`${name}-${side}`).rotation.x).toBeCloseTo((0.28 - side * 0.24) * direction, 8);
    }
    const stick = node('stick').localToWorld(new Vector3(0, 0.44, 0));
    expect((stick.x - stickRest.x) * direction).toBeLessThan(-0.05);
    expect((stick.z - stickRest.z) * direction).toBeLessThan(-0.05);
    for (const name of names)
      expect(node(name).localToWorld(point(name)).distanceTo(rests[name]), name).toBeLessThan(1e-7);
  }
  update({ gear: 0, altitude: -30.48 }, 1000);
  expect(node('altitude-minus').visible).toBe(true);
  expect(node('gear-lamp').visible).toBe(false);
  for (const name of ['left', 'right', 'nose']) expect(node(`gear-${name}`).visible).toBe(false);
  visual.update({}, 1001);
  for (const name of ['attitude-bank', 'standby-attitude-bank', 'heading', 'gear-lamp'])
    expect(node(name).visible).toBe(false);
  for (const [name, count] of [
    ['speed', 3],
    ['altitude', 5],
    ['vertical-speed', 5],
  ])
    for (let i = 0; i < count; i++)
      for (let j = 0; j < 7; j++) expect(node(`${name}-${i}-${j}`).visible).toBe(false);
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/fuel|oil|temperature|engineRpm|radar/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('drives the F-35 panoramic and standby displays and keeps flaperons attached to their hinges', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/f-35a/entity.types.json', base))),
    s = Object.values(doc.types)[0].components['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/f_35a/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s),
    node = (name) => {
      const value = scene.getObjectByName(`F35-${name}`);
      expect(value, name).toBeDefined();
      return value;
    };
  expect(visual.missingNodes).toEqual([]);
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    pitch: 0.1,
    roll: 0.3,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  const update = (state, time) => {
    visual.update({ ...raw, ...state }, time);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  for (const name of ['attitude-bank', 'standby-attitude-bank'])
    expect(node(name).rotation.z).toBeCloseTo(Math.PI * 2 - 0.3, 8);
  expect(node('heading').rotation.z).toBeCloseTo(1.5 * Math.PI, 8);
  const hinges = Object.fromEntries(
    ['leading-1', 'flaperon-1', 'rudder-1'].map((name) => [
      name,
      node(name).localToWorld(new Vector3(...(name.startsWith('rudder') ? [0, 1, 0] : [1, 0, 0]))),
    ]),
  );
  const rest = node('stick').localToWorld(new Vector3(0, 0.17, 0));
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction, flapPosition: 1 },
      10 + (direction + 1) * 10,
    );
    const stick = node('stick').localToWorld(new Vector3(0, 0.17, 0));
    expect((stick.x - rest.x) * direction).toBeLessThan(-0.01);
    expect((stick.z - rest.z) * direction).toBeLessThan(-0.01);
    expect(node('flaperon-1').rotation.x).toBeCloseTo(-0.38 - 0.28 * direction, 8);
    expect(node('flaperon--1').rotation.x).toBeCloseTo(-0.38 + 0.28 * direction, 8);
    for (const [name, rest] of Object.entries(hinges))
      expect(
        node(name)
          .localToWorld(new Vector3(...(name.startsWith('rudder') ? [0, 1, 0] : [1, 0, 0])))
          .distanceTo(rest),
        name,
      ).toBeLessThan(1e-7);
  }
  update({ gear: 0, altitude: -30.48 }, 1000);
  expect(node('altitude-minus').visible).toBe(true);
  expect(node('gear-lamp').visible).toBe(false);
  for (const n of ['left', 'right', 'nose']) expect(node(`gear-${n}`).visible).toBe(false);
  visual.update({}, 1001);
  for (const n of ['attitude-bank', 'standby-attitude-bank', 'heading', 'gear-lamp'])
    expect(node(n).visible).toBe(false);
  for (const [name, count] of [
    ['speed', 3],
    ['altitude', 5],
    ['vertical-speed', 5],
  ])
    for (let i = 0; i < count; i++)
      for (let j = 0; j < 7; j++) expect(node(`${name}-${i}-${j}`).visible).toBe(false);
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/fuel|oil|temperature|engineRpm|radar/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('wires the F-22 display data and controls without inventing engine or tactical readings', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/f-22a/entity.types.json', base))),
    s = Object.values(doc.types)[0].components['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/f_22a/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s);
  expect(visual.missingNodes).toEqual([]);
  const node = (name) => {
    const n = scene.getObjectByName('F22-' + name);
    expect(n, name).toBeDefined();
    return n;
  };
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    pitch: 0.1,
    roll: 0.3,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  const update = (v, t) => {
    visual.update({ ...raw, ...v }, t);
    scene.updateMatrixWorld(true);
  };
  update({}, 0);
  expect(node('attitude-bank').rotation.z).toBeCloseTo(Math.PI * 2 - 0.3, 8);
  expect(node('heading').rotation.z).toBeCloseTo(1.5 * Math.PI, 8);
  const rest = node('stick').localToWorld(new Vector3(0, 0.17, 0));
  const leadPivot = node('leading-1').getWorldPosition(new Vector3());
  const hingeTips = Object.fromEntries(
    ['leading-1', 'flap-1', 'aileron-1', 'rudder-1'].map((n) => [
      n,
      node(n).localToWorld(new Vector3(...(n.startsWith('rudder') ? [0, 1, 0] : [1, 0, 0]))),
    ]),
  );
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction },
      10 + (direction + 1) * 10,
    );
    const p = node('stick').localToWorld(new Vector3(0, 0.17, 0));
    expect((p.x - rest.x) * direction).toBeLessThan(-0.01);
    expect((p.z - rest.z) * direction).toBeLessThan(-0.01);
    for (const part of ['stabilator', 'aileron']) {
      const l = node(part + '-1').localToWorld(new Vector3(0, 0, -1)),
        r = node(part + '--1').localToWorld(new Vector3(0, 0, -1));
      expect((r.y - l.y) * direction).toBeGreaterThan(0.2);
    }
    for (const [n, restTip] of Object.entries(hingeTips))
      expect(
        node(n)
          .localToWorld(new Vector3(...(n.startsWith('rudder') ? [0, 1, 0] : [1, 0, 0])))
          .distanceTo(restTip),
        n,
      ).toBeLessThan(1e-7);
  }
  update({ gear: 0, flapPosition: 1, altitude: -30.48 }, 1000);
  for (const name of ['left', 'right', 'nose']) expect(node('gear-' + name).visible).toBe(false);
  expect(node('leading-1').getWorldPosition(new Vector3()).distanceTo(leadPivot)).toBeLessThan(
    1e-8,
  );
  for (const name of ['leading-1', 'flap-1'])
    expect(
      node(name)
        .localToWorld(new Vector3(1, 0, 0))
        .distanceTo(hingeTips[name]),
      name,
    ).toBeLessThan(1e-7);
  expect(node('flap-1').rotation.x).toBeLessThan(-0.4);
  expect(node('altitude-minus').visible).toBe(true);
  expect(node('gear-lamp').visible).toBe(false);
  visual.update({}, 1001);
  for (const n of ['attitude-bank', 'heading', 'gear-lamp']) expect(node(n).visible).toBe(false);
  for (const [name, count] of [
    ['speed', 3],
    ['altitude', 5],
    ['vertical-speed', 5],
  ])
    for (let i = 0; i < count; i++)
      for (let j = 0; j < 7; j++) expect(node(`${name}-${i}-${j}`).visible).toBe(false);
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/fuel|oil|temperature|engineRpm|radar/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('drives the late Hornet panel, droops its leading flaps and blanks unavailable data', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/fa-18c/entity.types.json', base))),
    s = Object.values(doc.types)[0].components['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/fa_18c/model.glb', base)),
    { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
  const visual = createModelSignalVisual(scene, s);
  expect(visual.missingNodes).toEqual([]);
  const node = (n) => {
    const v = scene.getObjectByName(n);
    expect(v, n).toBeDefined();
    return v;
  };
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    roll: 0.3,
    pitch: 0.1,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const update = (v, t) => {
      visual.update({ ...raw, ...v }, t);
      scene.updateMatrixWorld(true);
    },
    point = (n, p) => node(n).localToWorld(new Vector3(...p));
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  update({}, 0);
  expect(node('FA18-standby-speed').rotation.z).toBeCloseTo(2.65, 8);
  expect(node('FA18-standby-altitude-0').rotation.z).toBeCloseTo(Math.PI, 8);
  expect(node('FA18-heading').rotation.z).toBeCloseTo(Math.PI * 1.5, 8);
  const rest = point('FA18-stick', [0, 0.35, 0]);
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction },
      10 + (direction + 1) * 10,
    );
    const p = point('FA18-stick', [0, 0.35, 0]);
    expect((p.x - rest.x) * direction).toBeLessThan(-0.04);
    expect((p.z - rest.z) * direction).toBeLessThan(-0.04);
    for (const part of ['stabilator', 'aileron']) {
      const left = point(`FA18-${part}-1`, [0, 0, -1]),
        right = point(`FA18-${part}--1`, [0, 0, -1]);
      expect((right.y - left.y) * direction).toBeGreaterThan(0.2);
    }
  }
  update({ gear: 0, flapPosition: 1, altitude: -30.48 }, 1000);
  expect(node('FA18-gear-nose').rotation.x).toBeCloseTo(-Math.PI / 2, 8);
  expect(node('FA18-gear-nose').visible).toBe(false);
  expect(node('FA18-gear-1').visible).toBe(false);
  expect(node('FA18-gear-1').position.x).toBeLessThan(0.1);
  expect(node('FA18-flap-1').rotation.x).toBeLessThan(-0.5);
  expect(node('FA18-leading-1-0').rotation.x).toBeGreaterThan(0.2);
  expect(node('FA18-DDI-altitude-minus').visible).toBe(true);
  expect(node('FA18-gear-lamp-0').visible).toBe(false);
  visual.update({}, 1001);
  for (const n of [
    'standby-speed',
    'vertical-speed',
    'heading',
    'DDI-attitude-bank',
    'standby-bank',
    'gear-lamp-0',
  ])
    expect(node('FA18-' + n).visible).toBe(false);
  for (let digit = 0; digit < 5; digit++)
    for (let segment = 0; segment < 7; segment++)
      expect(node(`FA18-DDI-altitude-${digit}-${segment}`).visible).toBe(false);
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/oil|fuel|temperature|engineRpm/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('drives F-15C MSIP instruments and keeps ailerons, stabilators and pilot controls consistent', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/f-15c/entity.types.json', base))),
    s = Object.values(doc.types)[0].components['model.signals'];
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/f_15c/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s);
  expect(visual.missingNodes).toEqual([]);
  const node = (n) => {
    const v = scene.getObjectByName(n);
    expect(v, n).toBeDefined();
    return v;
  };
  const point = (n, p) => node(n).localToWorld(new Vector3(...p));
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    roll: 0.3,
    pitch: 0.1,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    angleOfAttack: 0.12,
    loadFactor: 2,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const update = (v, t) => {
    visual.update({ ...raw, ...v }, t);
    scene.updateMatrixWorld(true);
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  update({}, 0);
  expect(node('F15-altimeter').rotation.z).toBeCloseTo(Math.PI, 8);
  expect(node('F15-heading').rotation.z).toBeCloseTo(1.5 * Math.PI, 8);
  const rest = point('F15-stick', [0, 0.43, 0]);
  for (const direction of [-1, 1]) {
    update(
      { pitchInput: direction, rollInput: direction, yawInput: direction },
      10 + (direction + 1) * 10,
    );
    const p = point('F15-stick', [0, 0.43, 0]);
    expect((p.x - rest.x) * direction).toBeLessThan(-0.05);
    expect((p.z - rest.z) * direction).toBeLessThan(-0.05);
    for (const part of ['stabilator', 'aileron']) {
      const suffix = part === 'aileron' ? '-2' : '',
        left = point(`F15-${part}-1${suffix}`, [0, 0, -1]),
        right = point(`F15-${part}--1${suffix}`, [0, 0, -1]);
      expect((right.y - left.y) * direction).toBeGreaterThan(0.2);
    }
    expect(node('F15-rudder-1').rotation.y * direction).toBeGreaterThan(0.3);
  }
  update({ gear: 0, flapPosition: 1, altitude: -30.48 }, 1000);
  expect(node('F15-gear-nose').rotation.x).toBeCloseTo(-Math.PI / 2, 8);
  expect(node('F15-flap-1-0').rotation.x).toBeLessThan(-0.4);
  expect(node('F15-gear-lamp-0').visible).toBe(false);
  expect(node('F15-altitude-minus').visible).toBe(true);
  visual.update({}, 1001);
  expect(node('F15-gear-lamp-0').visible).toBe(false);
  for (const name of [
    'airspeed',
    'altimeter',
    'vertical-speed',
    'heading',
    'AOA',
    'G',
    'standby-speed',
  ])
    expect(node('F15-' + name).visible).toBe(false);
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/oil|fuel|temperature|engineRpm/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('moves F-14D sweep wings, spoilers, stabilators and both flight panels from shared telemetry', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/f-14d/entity.types.json', base))),
    c = doc.types['molen.entities.aircraft.f_14d'].components,
    s = c['model.signals'];
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    roll: 0.3,
    pitch: 0.1,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    angleOfAttack: 0.12,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
    gear: 1,
    flapPosition: 0,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.verticalFpm).toBeCloseTo(1000, 8);
  expect(values.headingDegrees).toBeCloseTo(90, 8);
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/f_14d/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s);
  expect(visual.missingNodes).toEqual([]);
  const node = (name) => {
    const n = scene.getObjectByName(name);
    expect(n, name).toBeDefined();
    return n;
  };
  const point = (name, p) => node(name).localToWorld(new Vector3(...p));
  const update = (values, time) => {
    visual.update({ ...raw, ...values }, time);
    scene.updateMatrixWorld(true);
  };
  update({ trueAirspeed: 0 }, 0);
  const tip = (side) => point(`F14-wing-${side}`, [side * (9.77315 - 2.8), -0.15, -1.28 - 1.1]);
  expect(tip(1).x - tip(-1).x).toBeCloseTo(19.5463, 4);
  for (const prefix of ['pilot', 'RIO']) {
    expect(node(`F14-${prefix}-altimeter`).rotation.z).toBeCloseTo(Math.PI, 8);
    expect(node(`F14-${prefix}-heading`).rotation.z).toBeCloseTo(1.5 * Math.PI, 8);
  }
  const stickRest = point('F14-control-stick', [0, 0.43, 0]),
    leftGearRest = point('F14-gear-left', [0, -1.82, 0]);
  for (const direction of [-1, 1]) {
    update(
      { trueAirspeed: 0, pitchInput: direction, rollInput: direction, yawInput: direction },
      10 + (direction + 1) * 10,
    );
    const stick = point('F14-control-stick', [0, 0.43, 0]);
    expect((stick.x - stickRest.x) * direction).toBeLessThan(-0.05);
    expect((stick.z - stickRest.z) * direction).toBeLessThan(-0.05);
    const left = point('F14-stabilator-1', [0, 0, -1]),
      right = point('F14-stabilator--1', [0, 0, -1]);
    expect((right.y - left.y) * direction).toBeGreaterThan(0.2);
    const rs = point('F14-spoiler--1-0', [0, 0, -0.32]),
      ls = point('F14-spoiler-1-0', [0, 0, -0.32]);
    expect((rs.y - ls.y) * direction).toBeGreaterThan(0.1);
    expect(node('F14-rudder-1').rotation.y * direction).toBeGreaterThan(0.3);
  }
  update({ trueAirspeed: 300, gear: 0, flapPosition: 1 }, 1000);
  const sweptSpan = tip(1).x - tip(-1).x;
  expect(sweptSpan).toBeGreaterThan(11.3);
  expect(sweptSpan).toBeLessThan(12.0);
  expect(tip(1).z).toBeLessThan(-5.5);
  expect(point('F14-gear-left', [0, -1.82, 0]).x).toBeLessThan(leftGearRest.x - 1.5);
  expect(node('F14-flap-1-0').rotation.x).toBeLessThan(-0.4);
  expect(node('F14-gear-lamp-0').visible).toBe(false);
  update({ altitude: -30.48 }, 1001);
  for (const prefix of ['pilot', 'RIO']) {
    expect(node(`F14-${prefix}-FLIGHT-altitude-minus`).visible).toBe(true);
    expect(node(`F14-${prefix}-altimeter`).rotation.z).toBeCloseTo(1.8 * Math.PI, 8);
  }
  visual.update({}, 1002);
  for (const prefix of ['pilot', 'RIO'])
    for (const gauge of ['airspeed', 'altimeter', 'vertical-speed', 'heading'])
      expect(node(`F14-${prefix}-${gauge}`).visible).toBe(false);
  expect(node('F14-AOA').visible).toBe(false);
  expect(node('F14-sweep-pointer').visible).toBe(false);
  expect(scene.getObjectByName('F14-RIO-control-stick')).toBeUndefined();
  expect(Object.keys(s.sources).join(' ')).not.toMatch(/oil|fuel|temperature|engineRpm/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('mixes F-16B flaperons and stabilators while keeping both analog panels and force sticks live', async () => {
  const doc = JSON.parse(await readFile(new URL('source/aircraft/f-16b/entity.types.json', base))),
    c = doc.types['molen.entities.aircraft.f_16b'].components,
    s = c['model.signals'];
  const raw = {
    trueAirspeed: 300 / 1.9438444924406,
    altitude: 12500 * 0.3048,
    roll: 0.3,
    pitch: 0.1,
    yaw: Math.PI / 2,
    verticalSpeed: 5.08,
    angleOfAttack: 0.12,
    pitchInput: 0.6,
    rollInput: 0.5,
    yawInput: 1,
    power: 0.8,
    gear: 1,
    flapPosition: 1,
  };
  const values = compileModelSignalExpressions(s.derived)(raw);
  expect(values.knots).toBeCloseTo(300, 8);
  expect(values.feet).toBeCloseTo(12500, 8);
  expect(values.altitudeHundreds).toBeCloseTo(500, 8);
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/f_16b/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, s);
  expect(visual.missingNodes).toEqual([]);
  visual.update(raw, 0);
  scene.updateMatrixWorld(true);
  for (const prefix of ['front', 'rear']) {
    const stick = scene.getObjectByName(`F16-${prefix}-sidestick`);
    expect(stick.rotation.x).toBeCloseTo(-0.015, 8);
    expect(stick.rotation.z).toBeCloseTo(0.0125, 8);
    expect(scene.getObjectByName(`F16-${prefix}-altimeter`).rotation.z).toBeCloseTo(Math.PI, 8);
    expect(scene.getObjectByName(`F16-${prefix}-heading-card`).rotation.z).toBeCloseTo(
      (3 * Math.PI) / 2,
      8,
    );
    expect(scene.getObjectByName(`F16-${prefix}-gear-lamp-0`).visible).toBe(true);
  }
  // Check physical trailing-edge movement after mixing, rather than only expression constants.
  const left = scene.getObjectByName('F16-flaperon-1'),
    right = scene.getObjectByName('F16-flaperon--1');
  const leftPoint = left.localToWorld(new Vector3(3, 0, -0.76)),
    rightPoint = right.localToWorld(new Vector3(-3, 0, -0.76));
  expect(leftPoint.y).toBeLessThan(rightPoint.y);
  expect(rightPoint.y).toBeLessThan(1.94);
  expect(scene.getObjectByName('F16-stabilator-1').rotation.x).toBeCloseTo(0.132, 8);
  expect(scene.getObjectByName('F16-stabilator--1').rotation.x).toBeCloseTo(0.252, 8);
  visual.update({ ...raw, rollInput: -0.5, gear: 0.5 }, 1);
  scene.updateMatrixWorld(true);
  expect(left.localToWorld(new Vector3(3, 0, -0.76)).y).toBeGreaterThan(
    right.localToWorld(new Vector3(-3, 0, -0.76)).y,
  );
  expect(scene.getObjectByName('F16-front-gear-lamp-0').visible).toBe(false);
  visual.update({ ...raw, altitude: -30.48 }, 1.5);
  for (const prefix of ['front', 'rear']) {
    expect(scene.getObjectByName(`F16-${prefix}-altitude-counter-minus`).visible).toBe(true);
    expect(scene.getObjectByName(`F16-${prefix}-altimeter`).rotation.z).toBeCloseTo(
      1.8 * Math.PI,
      8,
    );
  }
  visual.update(
    {
      ...raw,
      trueAirspeed: undefined,
      altitude: undefined,
      angleOfAttack: undefined,
      yaw: undefined,
    },
    2,
  );
  for (const prefix of ['front', 'rear'])
    for (const key of ['speed', 'altimeter', 'AOA', 'heading-card'])
      expect(scene.getObjectByName(`F16-${prefix}-${key}`).visible).toBe(false);
  for (const key of Object.keys(s.sources))
    expect(key).not.toMatch(/oil|fuel|temperature|engineRpm/i);
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('wires PC-12 NGX prop RPM, dual displays, Fowler flaps and aft-retracting nose gear', async () => {
  const doc = JSON.parse(
    await readFile(new URL('source/aircraft/pilatus-pc12/entity.types.json', base)),
  );
  const c = doc.types['molen.entities.aircraft.pilatus_pc12'].components,
    signals = c['model.signals'];
  const raw = {
    trueAirspeed: (270 * 1852) / 3600,
    altitude: 20000 * 0.3048,
    roll: 0.3,
    pitch: -0.1,
    yaw: Math.PI / 2,
    verticalSpeed: 2.54,
    propNormalized: 1550 / 1700,
    pitchInput: 0.4,
    rollInput: 0.5,
    yawInput: 0,
    power: 0.7,
    gear: 1,
    flapPosition: 15 / 40,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.knots).toBeCloseTo(270, 8);
  expect(values.feet).toBeCloseTo(20000, 8);
  expect(values.propRpm).toBeCloseTo(1550, 8);
  expect(values.flapDegrees).toBeCloseTo(15, 8);
  expect((c.aircraft.spec.engines[0].rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(1700, 8);
  expect(Object.keys(signals.derived).length).toBeLessThan(230);
  const bytes = await readFile(
    new URL('assets/molen/entities/aircraft/pilatus_pc12/model.glb', base),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  const yoke = scene.getObjectByName('PC12-yoke-375'),
    rest = yoke.position.z;
  visual.update(raw, 0);
  expect(yoke.rotation.z).toBeCloseTo(0.325, 8);
  expect(yoke.position.z).toBeCloseTo(rest - 0.024, 8);
  for (const side of ['L', 'R']) {
    expect(scene.getObjectByName(`PC12-PFD-${side}-horizon-bank`).rotation.z).toBeCloseTo(
      2 * Math.PI - 0.3,
      8,
    );
    expect(scene.getObjectByName(`PC12-PFD-${side}-horizon-pitch`).position.y).toBeCloseTo(
      0.08 * 1.05 * 0.1,
      8,
    );
  }
  expect(scene.getObjectByName('PC12-gear-icon-669').visible).toBe(true);
  expect(scene.getObjectByName('PC12-gear-transit').visible).toBe(false);
  const flap = scene.getObjectByName('PC12-flap-1');
  expect(flap.rotation.x).toBeCloseTo((-15 * Math.PI) / 180, 8);
  expect(flap.position.z).toBeCloseTo(-0.86 - (0.22 * 15) / 40, 6);
  visual.update({ ...raw, gear: 0.5, flapPosition: 1 }, 1);
  expect(scene.getObjectByName('PC12-gear-icon-669').visible).toBe(false);
  expect(scene.getObjectByName('PC12-gear-transit').visible).toBe(true);
  expect(flap.rotation.x).toBeCloseTo((-40 * Math.PI) / 180, 8);
  visual.update({ ...raw, gear: 0 }, 2);
  expect(scene.getObjectByName('PC12-gear-0').rotation.x).toBeCloseTo(Math.PI / 2, 8);
  expect(scene.getObjectByName('PC12-gear-1').rotation.z).toBeCloseTo(-Math.PI / 2, 8);
  visual.update({ ...raw, gear: undefined, flapPosition: undefined, propNormalized: undefined }, 3);
  expect(scene.getObjectByName('PC12-flap-pointer').visible).toBe(false);
  expect(scene.getObjectByName('PC12-gear-icon-669').visible).toBe(false);
  for (const side of ['L', 'R'])
    for (let digit = 0; digit < 4; digit++)
      for (let seg = 0; seg < 7; seg++)
        expect(scene.getObjectByName(`PC12-PFD-${side}-prop-rpm-${digit}-${seg}`).visible).toBe(
          false,
        );
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1])
    for (const z of [0.67, 0.075, -0.69, -1.68]) {
      const hits = new Raycaster(
        new Vector3(0, 2.27, z),
        new Vector3(side, 0, 0),
        0,
        0.96,
      ).intersectObject(scene, true);
      expect(
        hits
          .filter((h) => !h.object.material.transparent && h.object.name.startsWith('PC12-shell'))
          .map((h) => h.object.name),
      ).toEqual([]);
    }
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('wires DA42 twin RPM sliders, control sticks, gear and transit-sensitive flap lamps', async () => {
  const doc = JSON.parse(
      await readFile(new URL('source/aircraft/diamond-da42/entity.types.json', base)),
    ),
    c = doc.types['molen.entities.aircraft.diamond_da42'].components,
    signals = c['model.signals'];
  const raw = {
    trueAirspeed: (120 * 1852) / 3600,
    altitude: 1066.8,
    roll: 0.3,
    pitch: -0.1,
    yaw: Math.PI / 2,
    verticalSpeed: 2.54,
    propNormalized: 2200 / 2300,
    propNormalized2: 2100 / 2300,
    pitchInput: 0.4,
    rollInput: 0.5,
    yawInput: 0,
    power: 0.7,
    elevator: 0,
    gear: 1,
    flapPosition: 20 / 42,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.knots).toBeCloseTo(120, 8);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values.propRpm).toBeCloseTo(2200, 8);
  expect(values.propRpm2).toBeCloseTo(2100, 8);
  expect(signals.sources.propNormalized2.path).toEqual(['engines', 'engine-2', 'rpm']);
  for (const e of c.aircraft.spec.engines)
    expect((e.rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(2300, 8);
  const bytes = await readFile(
      new URL('assets/molen/entities/aircraft/diamond_da42/model.glb', base),
    ),
    { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  visual.update(raw, 0);
  const [a, b] = [1, 2].map((i) => scene.getObjectByName(`DA42-RPM-slider-${i}`));
  expect(a.position.y - b.position.y).toBeCloseTo((0.024 * 100) / 3000, 8);
  expect(scene.getObjectByName('DA42-stick-1').rotation.z).toBeCloseTo(0.15, 8);
  expect(scene.getObjectByName('DA42-stick-1').rotation.x).toBeCloseTo(-0.104, 8);
  expect(scene.getObjectByName('DA42-PFD-horizon-bank').rotation.z).toBeCloseTo(
    2 * Math.PI - 0.3,
    8,
  );
  expect(scene.getObjectByName('DA42-MD302-horizon-pitch').position.y).toBeCloseTo(
    0.041 * 1.05 * 0.1,
    8,
  );
  const lamps = () => [0, 1, 2].map((i) => scene.getObjectByName(`DA42-flap-lamp-${i}`).visible);
  expect(lamps()).toEqual([false, true, false]);
  for (const [position, wanted] of [
    [0, [true, false, false]],
    [0.2, [true, true, false]],
    [0.75, [false, true, true]],
    [1, [false, false, true]],
  ]) {
    visual.update({ ...raw, flapPosition: position }, 1);
    expect(lamps()).toEqual(wanted);
  }
  expect(scene.getObjectByName('DA42-gear-lamp-0').visible).toBe(true);
  visual.update({ ...raw, gear: 0.5 }, 2);
  expect(scene.getObjectByName('DA42-gear-lamp-0').visible).toBe(false);
  expect(scene.getObjectByName('DA42-gear-transit').visible).toBe(true);
  visual.update({ ...raw, gear: 0 }, 3);
  expect(scene.getObjectByName('DA42-gear-transit').visible).toBe(false);
  expect(scene.getObjectByName('DA42-gear-0').rotation.x).toBeCloseTo(-Math.PI / 2, 8);
  visual.update(
    {
      ...raw,
      propNormalized: undefined,
      propNormalized2: undefined,
      flapPosition: undefined,
      gear: undefined,
    },
    4,
  );
  expect(lamps()).toEqual([false, false, false]);
  expect(a.visible).toBe(false);
  expect(b.visible).toBe(false);
  for (const e of [1, 2])
    for (let digit = 0; digit < 4; digit++)
      for (let seg = 0; seg < 7; seg++)
        expect(scene.getObjectByName(`DA42-MFD-rpm-${e}-${digit}-${seg}`).visible).toBe(false);
  expect(c.aircraft.spec.visual.flaps.every((f) => f.multiplier < 0)).toBe(true);
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1])
    for (const [z, y] of [
      [0.4, 1.6],
      [-0.6, 1.5],
    ]) {
      const hits = new Raycaster(
        new Vector3(0, y, z),
        new Vector3(side, 0, 0),
        0,
        0.95,
      ).intersectObject(scene, true);
      expect(
        hits
          .filter((h) => !h.object.material.transparent && h.object.name.startsWith('DA42-shell'))
          .map((h) => h.object.name),
      ).toEqual([]);
    }
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('wires Cirrus side yokes, MD302, 2500 RPM and detent-sensitive flap lamps', async () => {
  const definition = JSON.parse(
    await readFile(new URL('source/aircraft/cirrus-sr22t/entity.types.json', base)),
  );
  const c = definition.types['molen.entities.aircraft.cirrus_sr22t'].components,
    signals = c['model.signals'];
  const raw = {
    trueAirspeed: (120 * 1852) / 3600 - 1e-9,
    altitude: 1066.8,
    roll: 0.3,
    pitch: -0.1,
    yaw: Math.PI / 2,
    verticalSpeed: 2.54,
    propNormalized: 0.96,
    pitchInput: 0.4,
    rollInput: 0.5,
    yawInput: 0,
    power: 0.7,
    elevator: 0,
    flapPosition: 0.5,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.knots).toBeCloseTo(120, 7);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values.propRpm).toBeCloseTo(2400, 8);
  expect((c.aircraft.spec.engines[0].rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(2500, 8);
  const bytes = await readFile(
    new URL('assets/molen/entities/aircraft/cirrus_sr22t/model.glb', base),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  visual.update(raw, 0);
  for (const side of [-1, 1]) {
    const yoke = scene.getObjectByName(`Cirrus-side-yoke-${side}`);
    expect(yoke.rotation.z).toBeCloseTo(0.325, 8);
    expect(yoke.position.z).toBeCloseTo(0.836, 6);
  }
  expect(scene.getObjectByName('Cirrus-PFD-horizon-bank').rotation.z).toBeCloseTo(
    2 * Math.PI - 0.3,
    8,
  );
  expect(scene.getObjectByName('CirrusStandby-MD302-horizon-pitch').position.y).toBeCloseTo(
    0.043 * 1.05 * 0.1,
    8,
  );
  expect(scene.getObjectByName('Cirrus-flap-lamp-1').visible).toBe(true);
  expect(scene.getObjectByName('Cirrus-flap-lamp-0').visible).toBe(false);
  visual.update({ ...raw, flapPosition: 0.7 }, 1);
  for (let n = 0; n < 3; n++)
    expect(scene.getObjectByName(`Cirrus-flap-lamp-${n}`).visible).toBe(false);
  visual.update({ ...raw, flapPosition: 1, propNormalized: 1 }, 2);
  expect(scene.getObjectByName('Cirrus-flap-lamp-2').visible).toBe(true);
  visual.update(
    { ...raw, trueAirspeed: undefined, propNormalized: undefined, flapPosition: undefined },
    3,
  );
  for (const [name, count] of [
    ['Cirrus-PFD-speed', 3],
    ['CirrusStandby-MD302-speed', 3],
    ['Cirrus-MFD-rpm', 4],
  ])
    for (let digit = 0; digit < count; digit++)
      for (let seg = 0; seg < 7; seg++)
        expect(scene.getObjectByName(`${name}-${digit}-${seg}`).visible).toBe(false);
  for (let n = 0; n < 3; n++)
    expect(scene.getObjectByName(`Cirrus-flap-lamp-${n}`).visible).toBe(false);
  expect(c.aircraft.spec.visual.flaps.every((f) => f.multiplier < 0)).toBe(true);
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1])
    for (const [z, y] of [
      [0.4, 1.7],
      [-0.58, 1.68],
    ]) {
      const hits = new Raycaster(
        new Vector3(0, y, z),
        new Vector3(side, 0, 0),
        0,
        0.95,
      ).intersectObject(scene, true);
      expect(
        hits
          .filter((h) => !h.object.material.transparent && h.object.name.startsWith('Cirrus-shell'))
          .map((h) => h.object.name),
      ).toEqual([]);
    }
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('drives King Air Fusion displays from shared attitude and independent propeller sensors', async () => {
  const definition = JSON.parse(
    await readFile(new URL('source/aircraft/king-air-350i/entity.types.json', base)),
  );
  const components = definition.types['molen.entities.aircraft.king_air_350i'].components,
    signals = components['model.signals'];
  const raw = {
    trueAirspeed: (120 * 1852) / 3600 - 1e-9,
    altitude: 1066.8,
    roll: 0.3,
    pitch: -0.1,
    yaw: Math.PI / 2,
    verticalSpeed: 2.54,
    propNormalized: 1500 / 1700,
    propNormalized2: 1600 / 1700,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.7,
    elevator: 0,
    gear: 1,
    flapPosition: 0,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.knots).toBeCloseTo(120, 7);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values.propRpm).toBeCloseTo(1500, 8);
  expect(values.propRpm2).toBeCloseTo(1600, 8);
  expect(signals.sources.propNormalized2.path).toEqual(['engines', 'engine-2', 'rpm']);
  for (const engine of components.aircraft.spec.engines)
    expect((engine.rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(1700, 8);
  const bytes = await readFile(
    new URL('assets/molen/entities/aircraft/king_air_350i/model.glb', base),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  visual.update(raw, 0);
  for (const side of ['L', 'R']) {
    expect(scene.getObjectByName(`KingAir-PFD-${side}-horizon-bank`).rotation.z).toBeCloseTo(
      2 * Math.PI - 0.3,
      8,
    );
    expect(scene.getObjectByName(`KingAir-PFD-${side}-horizon-pitch`).position.y).toBeCloseTo(
      0.094 * 1.05 * 0.1,
      8,
    );
    expect(scene.getObjectByName(`KingAir-PFD-${side}-speed-2-6`).visible).toBe(false);
  }
  expect(scene.getObjectByName('KingAir-gear-lamp-0').visible).toBe(true);
  visual.update({ ...raw, gear: 0.5 }, 1);
  expect(scene.getObjectByName('KingAir-gear-transit').visible).toBe(true);
  visual.update({ ...raw, gear: 0, propNormalized2: undefined, trueAirspeed: undefined }, 2);
  for (let n = 0; n < 3; n++)
    expect(scene.getObjectByName(`KingAir-gear-${n}`).rotation.x).toBeCloseTo(
      ((n ? -1 : 1) * Math.PI) / 2,
      8,
    );
  expect(scene.getObjectByName('KingAir-prop-1-0-1').visible).toBe(true);
  for (let digit = 0; digit < 4; digit++)
    for (let seg = 0; seg < 7; seg++)
      expect(scene.getObjectByName(`KingAir-prop-2-${digit}-${seg}`).visible).toBe(false);
  for (const side of ['L', 'R'])
    for (let digit = 0; digit < 3; digit++)
      for (let seg = 0; seg < 7; seg++)
        expect(scene.getObjectByName(`KingAir-PFD-${side}-speed-${digit}-${seg}`).visible).toBe(
          false,
        );
  expect(signals.bindings.map((b) => b.source).join(' ')).not.toMatch(
    /torque|ITT|oilPressure|ngPercent/,
  );
  expect(components.aircraft.spec.visual.flaps.every((f) => f.multiplier < 0)).toBe(true);
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1])
    for (const z of [1.17, 0.62, 0.09, -0.44, -0.96, -1.47, -1.98]) {
      // Stop beyond the shell: the distant winglet legitimately crosses one ray.
      const hits = new Raycaster(
        new Vector3(0, 2.34, z),
        new Vector3(side, 0, 0),
        0,
        1.1,
      ).intersectObject(scene, true);
      expect(
        hits
          .filter(
            (h) => !h.object.material.transparent && h.object.name.startsWith('KingAir-shell'),
          )
          .map((h) => h.object.name),
      ).toEqual([]);
    }
  scene.traverse((n) => {
    if (n.isMesh) n.geometry.dispose();
  });
});

it('keeps Baron engine gauges independent and hides only the unavailable sensor', async () => {
  const definition = JSON.parse(
    await readFile(new URL('source/aircraft/baron-g58/entity.types.json', base)),
  );
  const components = definition.types['molen.entities.aircraft.baron_g58'].components;
  const signals = components['model.signals'];
  const raw = {
    trueAirspeed: 61.733333333333334,
    altitude: 1066.8,
    roll: 0.3,
    pitch: -0.1,
    yaw: Math.PI / 2,
    propNormalized: 2500 / 2700,
    propNormalized2: 1800 / 2700,
    verticalSpeed: 2.54,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.7,
    elevator: 0,
    flapPosition: 0,
    gear: 1,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.knots).toBeCloseTo(120, 8);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values.propRpm).toBeCloseTo(2500, 8);
  expect(values.propRpm2).toBeCloseTo(1800, 8);
  expect(signals.sources.propNormalized2.path).toEqual(['engines', 'engine-2', 'rpm']);
  expect(components.aircraft.spec.engines).toHaveLength(2);
  for (const engine of components.aircraft.spec.engines)
    expect((engine.rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(2700, 8);
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/baron_g58/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  visual.update({ ...raw, trueAirspeed: raw.trueAirspeed - 1e-9 }, 0);
  expect(scene.getObjectByName('Baron-PFD-speed-2-6').visible).toBe(false);
  expect(scene.getObjectByName('Baron-MFD-tach-1').rotation.z).toBeCloseTo(
    2.4 - (2500 / 3000) * 1.68,
    8,
  );
  expect(scene.getObjectByName('Baron-MFD-tach-2').rotation.z).toBeCloseTo(
    -2.4 + (1800 / 3000) * 1.68,
    8,
  );
  expect(scene.getObjectByName('Baron-standby-speed').rotation.z).toBeCloseTo(2.8, 8);
  expect(scene.getObjectByName('Baron-PFD-horizon-pitch').position.y).toBeGreaterThan(0);
  for (let i = 0; i < 3; i++)
    expect(scene.getObjectByName(`Baron-gear-lamp-${i}`).visible).toBe(true);
  visual.update({ ...raw, gear: 0.5 }, 1);
  expect(scene.getObjectByName('Baron-gear-transit').visible).toBe(true);
  visual.update({ ...raw, gear: 0, propNormalized2: undefined }, 2);
  expect(scene.getObjectByName('Baron-MFD-tach-1').visible).toBe(true);
  expect(scene.getObjectByName('Baron-MFD-tach-2').visible).toBe(false);
  for (let digit = 0; digit < 4; digit++)
    for (let segment = 0; segment < 7; segment++)
      expect(scene.getObjectByName(`Baron-MFD-rpm-2-${digit}-${segment}`).visible).toBe(false);
  expect(scene.getObjectByName('Baron-gear-1').rotation.z).toBeCloseTo(-Math.PI / 2, 8);
  expect(scene.getObjectByName('Baron-gear-2').rotation.z).toBeCloseTo(Math.PI / 2, 8);
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const hits = new Raycaster(new Vector3(0, 1.78, 0.35), new Vector3(side, 0, 0)).intersectObject(
      scene,
      true,
    );
    expect(
      hits.filter((hit) => !hit.object.material.transparent).map((hit) => hit.object.name),
    ).toEqual([]);
  }
  expect(components.aircraft.spec.visual.flaps.every((f) => f.multiplier < 0)).toBe(true);
  scene.traverse((node) => {
    if (node.isMesh) node.geometry.dispose();
  });
});

it('wires Bonanza standby gauges and gear indications to measured state', async () => {
  const definition = JSON.parse(
    await readFile(new URL('source/aircraft/bonanza-g36/entity.types.json', base)),
  );
  const components = definition.types['molen.entities.aircraft.bonanza_g36'].components;
  const signals = components['model.signals'];
  const raw = {
    trueAirspeed: 61.733333333333334,
    altitude: 1066.8,
    roll: 0.3,
    pitch: -0.1,
    yaw: Math.PI / 2,
    propNormalized: 2500 / 2700,
    verticalSpeed: 2.54,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.7,
    elevator: 0,
    flapPosition: 0,
    gear: 1,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.knots).toBeCloseTo(120, 8);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values.propRpm).toBeCloseTo(2500, 8);
  expect((components.aircraft.spec.engines[0].rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(
    2700,
    8,
  );
  const bytes = await readFile(
    new URL('assets/molen/entities/aircraft/bonanza_g36/model.glb', base),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  visual.update(raw, 0);
  expect(scene.getObjectByName('Bonanza-standby-speed').rotation.z).toBeCloseTo(3.3, 8);
  expect(scene.getObjectByName('Bonanza-standby-altimeter-0').rotation.z).toBeCloseTo(Math.PI, 8);
  expect(scene.getObjectByName('Bonanza-PFD-horizon-pitch').position.y).toBeGreaterThan(0);
  for (let i = 0; i < 3; i++)
    expect(scene.getObjectByName(`Bonanza-gear-lamp-${i}`).visible).toBe(true);
  expect(scene.getObjectByName('Bonanza-gear-transit').visible).toBe(false);
  visual.update({ ...raw, gear: 0.5 }, 1);
  for (let i = 0; i < 3; i++)
    expect(scene.getObjectByName(`Bonanza-gear-lamp-${i}`).visible).toBe(false);
  expect(scene.getObjectByName('Bonanza-gear-transit').visible).toBe(true);
  visual.update({ ...raw, gear: 0 }, 2);
  expect(scene.getObjectByName('Bonanza-gear-transit').visible).toBe(false);
  expect(scene.getObjectByName('Bonanza-gear-1').rotation.z).toBeCloseTo(-Math.PI / 2, 8);
  expect(scene.getObjectByName('Bonanza-gear-2').rotation.z).toBeCloseTo(Math.PI / 2, 8);
  expect(scene.getObjectByName('Bonanza-gear-0').rotation.x).toBeCloseTo(Math.PI / 2, 8);
  visual.update({ ...raw, gear: undefined, trueAirspeed: undefined, propNormalized: undefined }, 3);
  expect(scene.getObjectByName('Bonanza-standby-speed').visible).toBe(false);
  expect(scene.getObjectByName('Bonanza-speed-tape-120').visible).toBe(false);
  expect(scene.getObjectByName('Bonanza-MFD-tach').visible).toBe(false);
  for (let i = 0; i < 3; i++)
    expect(scene.getObjectByName(`Bonanza-gear-lamp-${i}`).visible).toBe(false);
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const hits = new Raycaster(new Vector3(0, 1.78, 0.35), new Vector3(side, 0, 0)).intersectObject(
      scene,
      true,
    );
    expect(
      hits.filter((hit) => !hit.object.material.transparent).map((hit) => hit.object.name),
    ).toEqual([]);
  }
  expect(components.aircraft.spec.visual.flaps.every((f) => f.multiplier < 0)).toBe(true);
  scene.traverse((node) => {
    if (node.isMesh) node.geometry.dispose();
  });
});

it('calibrates the normally aspirated Skylane independently of the Skyhawk', async () => {
  const definition = JSON.parse(
    await readFile(new URL('source/aircraft/cessna-182t/entity.types.json', base)),
  );
  const components = definition.types['molen.entities.aircraft.cessna_182t'].components;
  const signals = components['model.signals'];
  const raw = {
    trueAirspeed: 61.733333333333334,
    altitude: 1066.8,
    roll: 0.3,
    pitch: -0.1,
    yaw: Math.PI / 2,
    propNormalized: 11 / 12,
    verticalSpeed: 2.54,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.7,
    elevator: 0,
    flapPosition: 1,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.knots).toBeCloseTo(120, 8);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values.propRpm).toBeCloseTo(2200, 8);
  expect((components.aircraft.spec.engines[0].rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(
    2400,
    8,
  );
  const bytes = await readFile(
    new URL('assets/molen/entities/aircraft/cessna_182t/model.glb', base),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  const flapRest = scene.getObjectByName('Skylane-flap').position.y;
  visual.update(raw, 0);
  expect(scene.getObjectByName('Skylane-flap').position.y).toBeCloseTo(flapRest - 0.035, 8);
  expect(scene.getObjectByName('Skylane-standby-speed').rotation.z).toBeCloseTo(3.5, 8);
  expect(scene.getObjectByName('Skylane-standby-altimeter-0').rotation.z).toBeCloseTo(Math.PI, 8);
  expect(scene.getObjectByName('Skylane-PFD-horizon-pitch').position.y).toBeGreaterThan(0);
  visual.update({ ...raw, trueAirspeed: undefined, propNormalized: undefined }, 1);
  expect(scene.getObjectByName('Skylane-standby-speed').visible).toBe(false);
  expect(scene.getObjectByName('Skylane-MFD-tach').visible).toBe(false);
  expect(scene.getObjectByName('Skylane-speed-tape-120').visible).toBe(false);
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const hits = new Raycaster(new Vector3(0, 1.6, 0.2), new Vector3(side, 0, 0)).intersectObject(
      scene,
      true,
    );
    expect(
      hits.filter((hit) => !hit.object.material.transparent).map((hit) => hit.object.name),
    ).toEqual([]);
  }
  scene.traverse((node) => {
    if (node.isMesh) node.geometry.dispose();
  });
});

it('keeps both Caravan PFDs synchronized and uses the EX propeller speed', async () => {
  const definition = JSON.parse(
    await readFile(new URL('source/aircraft/cessna-208b/entity.types.json', base)),
  );
  const components = definition.types['molen.entities.aircraft.cessna_208b'].components;
  const signals = components['model.signals'];
  const raw = {
    trueAirspeed: 61.733333333333334,
    altitude: 1066.8,
    roll: 0.3,
    pitch: 0.1,
    yaw: Math.PI / 2,
    propNormalized: 1800 / 1900,
    verticalSpeed: 2.54,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.7,
    elevator: 0,
    flapPosition: 0.5,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.knots).toBeCloseTo(120, 8);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values.propRpm).toBeCloseTo(1800, 8);
  expect(values.trueHeading).toBeCloseTo(Math.PI / 2, 8);
  expect(values.verticalFpm).toBeCloseTo(500, 8);
  expect((components.aircraft.spec.engines[0].rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(
    1900,
    8,
  );
  const bytes = await readFile(
    new URL('assets/molen/entities/aircraft/cessna_208b/model.glb', base),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  visual.update(raw, 0);
  for (const suffix of ['', '-copilot']) {
    expect(scene.getObjectByName(`Caravan-PFD-horizon-bank${suffix}`).rotation.z).toBeCloseTo(
      2 * Math.PI - 0.3,
      8,
    );
    expect(scene.getObjectByName(`Caravan-PFD-speed-tape${suffix}`).position.y).toBeCloseTo(
      0.022 - 0.12,
      8,
    );
    expect(scene.getObjectByName(`Caravan-PFD-speed-tape-120${suffix}`).visible).toBe(true);
    expect(scene.getObjectByName(`Caravan-PFD-speed-tape-80${suffix}`).visible).toBe(false);
    expect(scene.getObjectByName(`Caravan-PFD-rose${suffix}`).rotation.z).toBeCloseTo(
      1.5 * Math.PI,
      8,
    );
  }
  expect(scene.getObjectByName('Caravan-standby-speed').rotation.z).toBeCloseTo(2.9, 8);
  expect(scene.getObjectByName('Caravan-standby-altimeter-0').rotation.z).toBeCloseTo(Math.PI, 8);
  visual.update({ ...raw, trueAirspeed: undefined, propNormalized: undefined, roll: undefined }, 1);
  for (const suffix of ['', '-copilot']) {
    for (let digit = 0; digit < 3; digit++)
      for (let segment = 0; segment < 7; segment++)
        expect(
          scene.getObjectByName(`Caravan-PFD-speed-${digit}-${segment}${suffix}`).visible,
        ).toBe(false);
    expect(scene.getObjectByName(`Caravan-PFD-speed-tape-120${suffix}`).visible).toBe(false);
    expect(scene.getObjectByName(`Caravan-PFD-horizon-bank${suffix}`).visible).toBe(false);
  }
  expect(scene.getObjectByName('Caravan-prop-rpm').visible).toBe(false);
  expect(signals.bindings.map((b) => b.source).join(' ')).not.toMatch(
    /torque|ITT|oilPressure|ngPercent/,
  );
  scene.traverse((node) => {
    if (node.isMesh) node.geometry.dispose();
  });
});

it('wires the Skyhawk gauge units and engine RPM to ordinary scene components', () => {
  const state = {
    ...components,
    transform: { pos: [0, 1066.8, 0] },
    aircraftState: {
      airspeed: 61.733333333333334,
      roll: 0.3,
      pitch: 0.1,
      yaw: Math.PI - Math.PI / 2,
      verticalSpeed: 2.54,
      engines: { 'engine-1': { rpm: 8 / 9 } },
    },
  };
  const values = compileModelSignalExpressions(signals.derived)(
    readModelSignals(signals.sources, (name) => state[name]),
  );
  expect(values.knots).toBeCloseTo(120, 8);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values['Skyhawk.PFD-altitude.1.digit']).toBe(3);
  expect(values['Skyhawk.PFD-altitude.2.digit']).toBe(5);
  expect(values['Skyhawk.PFD-altitude.4.digit']).toBe(0);
  expect(values.rpmDisplay).toBe(2400);
  expect(values.degreesTrue).toBeCloseTo(90, 8);
  expect(values.verticalFpm).toBeCloseTo(500, 8);
  const engine = components.aircraft.spec.engines[0];
  expect((engine.rotorAngularSpeed * 60) / (2 * Math.PI)).toBeCloseTo(2700, 8);
  delete state.aircraftState.engines;
  const missing = compileModelSignalExpressions(signals.derived)(
    readModelSignals(signals.sources, (name) => state[name]),
  );
  expect(missing.propRpm).toBeUndefined();
  expect(missing.rpmDisplay).toBeUndefined();
});

it('moves actual imported needles, horizon and digits and blanks missing readings', async () => {
  const bytes = await readFile(
    new URL('assets/molen/entities/aircraft/cessna_172s/model.glb', base),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const hits = new Raycaster(new Vector3(0, 1.5, 0), new Vector3(side, 0, 0)).intersectObject(
      scene,
      true,
    );
    expect(
      hits.filter((hit) => !hit.object.material.transparent).map((hit) => hit.object.name),
    ).toEqual([]);
  }
  const raw = {
    trueAirspeed: 61.733333333333334,
    altitude: 1066.8,
    roll: 0.3,
    pitch: 0.1,
    yaw: Math.PI / 2,
    propNormalized: 8 / 9,
    verticalSpeed: 2.54,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.7,
    elevator: 0,
  };
  visual.update(raw, 0);
  expect(scene.getObjectByName('Skyhawk-standby-speed').rotation.z).toBeCloseTo(3.55, 8);
  expect(scene.getObjectByName('Skyhawk-PFD-horizon-bank').rotation.z).toBeCloseTo(
    2 * Math.PI - 0.3,
    8,
  );
  expect(scene.getObjectByName('Skyhawk-PFD-horizon-pitch').position.y).toBeCloseTo(
    -0.068 * 1.05 * 0.1,
    8,
  );
  expect(scene.getObjectByName('Skyhawk-standby-altimeter-0').rotation.z).toBeCloseTo(Math.PI, 8);
  // 120: the first digit is 1, so its top segment is off and upper-right is on.
  expect(scene.getObjectByName('Skyhawk-PFD-speed-0-0').visible).toBe(false);
  expect(scene.getObjectByName('Skyhawk-PFD-speed-0-1').visible).toBe(true);
  visual.update({ ...raw, trueAirspeed: undefined, propNormalized: undefined }, 1);
  expect(scene.getObjectByName('Skyhawk-standby-speed').visible).toBe(false);
  for (let digit = 0; digit < 3; digit++)
    for (let segment = 0; segment < 7; segment++)
      expect(scene.getObjectByName(`Skyhawk-PFD-speed-${digit}-${segment}`).visible).toBe(false);
  expect(scene.getObjectByName('Skyhawk-MFD-tach').visible).toBe(false);
  visual.update({ ...raw, altitude: -30.48 }, 2);
  expect(scene.getObjectByName('Skyhawk-PFD-altitude-minus').visible).toBe(true);
  visual.update(raw, 3);
  expect(scene.getObjectByName('Skyhawk-PFD-altitude-minus').visible).toBe(false);
  scene.traverse((node) => {
    if (node.isMesh) node.geometry.dispose();
  });
});

it('uses a live period Cherokee panel, with rate rather than bank for the turn needle', async () => {
  const definition = JSON.parse(
    await readFile(new URL('source/aircraft/pa-28-180/entity.types.json', base)),
  );
  const components = definition.types['molen.entities.aircraft.pa_28_180'].components;
  const signals = components['model.signals'];
  const raw = {
    trueAirspeed: 53.6448,
    altitude: 1066.8,
    roll: 0.3,
    pitch: -0.1,
    yaw: Math.PI / 2,
    yawRate: -Math.PI / 60,
    propNormalized: 8 / 9,
    verticalSpeed: 2.54,
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0,
    power: 0.8,
  };
  const values = compileModelSignalExpressions(signals.derived)(raw);
  expect(values.mph).toBeCloseTo(120, 8);
  expect(values.feet).toBeCloseTo(3500, 8);
  expect(values.propHundreds).toBeCloseTo(24, 8);
  expect(values.climbHundreds).toBeCloseTo(5, 8);
  expect(values.rightYawDegrees).toBeCloseTo(3, 8);
  const bytes = await readFile(new URL('assets/molen/entities/aircraft/pa_28_180/model.glb', base));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createModelSignalVisual(scene, signals);
  expect(visual.missingNodes).toEqual([]);
  visual.update(raw, 0);
  expect(scene.getObjectByName('Cherokee-airspeed').rotation.z).toBeCloseTo(2.75, 8);
  expect(scene.getObjectByName('Cherokee-turn').rotation.z).toBeCloseTo(0.35, 8);
  expect(scene.getObjectByName('Cherokee-heading-drum').rotation.y).toBeCloseTo(1.5 * Math.PI, 8);
  expect(scene.getObjectByName('Cherokee-compass-drum').rotation.y).toBeCloseTo(1.5 * Math.PI, 8);
  expect(scene.getObjectByName('Cherokee-altimeter-0').rotation.z).toBeCloseTo(Math.PI, 8);
  expect(scene.getObjectByName('Cherokee-attitude-pitch').position.y).toBeGreaterThan(0);
  visual.update({ ...raw, roll: -0.3 }, 1);
  expect(scene.getObjectByName('Cherokee-turn').rotation.z).toBeCloseTo(0.35, 8);
  visual.update({ ...raw, trueAirspeed: undefined, propNormalized: undefined, yaw: undefined }, 2);
  expect(scene.getObjectByName('Cherokee-airspeed').visible).toBe(false);
  expect(scene.getObjectByName('Cherokee-tachometer').visible).toBe(false);
  expect(scene.getObjectByName('Cherokee-heading-drum').visible).toBe(false);
  expect(signals.bindings.map((b) => b.node).join(' ')).not.toMatch(/CLOCK|VACUUM|ADF|VOR/);
  scene.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const hits = new Raycaster(new Vector3(0, 1.5, 0), new Vector3(side, 0, 0)).intersectObject(
      scene,
      true,
    );
    expect(
      hits.filter((hit) => !hit.object.material.transparent).map((hit) => hit.object.name),
    ).toEqual([]);
  }
  scene.traverse((node) => {
    if (node.isMesh) node.geometry.dispose();
  });
});
