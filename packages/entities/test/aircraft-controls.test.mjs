import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../../client/dist/aircraft.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, base)));
const slugs = [
  'uh-1h',
  'bell-206b',
  'bell-407',
  'bell-412ep',
  'robinson-r44',
  'airbus-h125',
  'airbus-h145',
  'uh-60m',
  'ch-47f',
  'aw139',
  'pa-28-180',
  'cessna-172s',
  'cessna-208b',
  'cessna-182t',
  'bonanza-g36',
  'baron-g58',
  'king-air-350i',
  'cirrus-sr22t',
  'diamond-da42',
  'pilatus-pc12',
];

// Physical movement, checked on the imported hierarchy rather than binding constants.
// +X is pilot left; +Z is forward; positive input means nose up / right bank / right yaw.
it.each(slugs)('%s moves controls in the commanded physical direction', async (slug) => {
  const doc = await json(`source/aircraft/${slug}/entity.types.json`);
  const c = Object.values(doc.types)[0].components,
    spec = c.aircraft.spec;
  const source = await json(`source/aircraft/${slug}/source.json`);
  const bytes = await readFile(
    new URL(source.files.models[0].output.replace('asset.json', 'model.glb'), base),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createAircraftVisual(scene, spec);
  const bindings = [...spec.visual.interior.bindings, ...spec.visual.animation.bindings];
  const nodes = (predicate) =>
    [...new Set(bindings.filter(predicate).map((b) => b.node))].map((name) => {
      const n = scene.getObjectByName(name);
      expect(n, name).toBeDefined();
      return n;
    });
  const point = (node, xyz = [0, 0, 0]) => node.localToWorld(new Vector3(...xyz));
  const update = (input = {}, flapPosition = 0) => {
    const command = { ...c.aircraftInput, ...input };
    visual.update(
      { ...c.aircraftState, gearPosition: 1, flapPosition, elevator: command.pitch },
      command,
      0,
      { flapPosition },
      0,
    );
    scene.updateMatrixWorld(true);
  };
  update();
  const rollControls = nodes((b) => b.source === 'rollInput');
  const pitchControls = nodes(
    (b) => b.source === 'pitchInput' && /yoke|stick|cyclic/i.test(b.node),
  );
  expect(rollControls.length).toBeGreaterThan(0);
  expect(pitchControls.length).toBeGreaterThan(0);
  const ailerons = spec.visual.ailerons.map((b) => scene.getObjectByName(b.node));
  const pedals = nodes((b) => b.source === 'yawInput' && b.property === 'position').sort(
    (a, b) => point(a).x - point(b).x,
  );
  const flaps = [
    ...new Set([
      ...spec.visual.flaps.map((b) => b.node),
      ...bindings
        .filter(
          (b) =>
            b.source === 'flapPosition' &&
            b.property === 'rotation' &&
            /flap-[+-]?1$/i.test(b.node),
        )
        .map((b) => b.node),
    ]),
  ].map((name) => scene.getObjectByName(name));
  const rudders = nodes((b) => b.source === 'yawInput' && /rudder/i.test(b.node));
  const elevators = nodes(
    (b) => ['pitchInput', 'elevator'].includes(b.source) && /elevator|stabilator/i.test(b.node),
  );
  const rest = new Map(
    [
      ...rollControls,
      ...pitchControls,
      ...ailerons,
      ...pedals,
      ...flaps,
      ...rudders,
      ...elevators,
    ].map((n) => [
      n,
      { origin: point(n), grip: point(n, [0, 0.3, 0]), trailing: point(n, [0, 0, -0.25]) },
    ]),
  );
  for (const direction of [-1, 1]) {
    update({ roll: direction });
    for (const n of rollControls)
      expect((point(n, [0, 0.3, 0]).x - rest.get(n).grip.x) * direction, n.name).toBeLessThan(
        -0.005,
      );
    for (const n of ailerons)
      expect(
        (point(n, [0, 0, -0.25]).y - rest.get(n).trailing.y) *
          Math.sign(rest.get(n).origin.x) *
          direction,
        n.name,
      ).toBeLessThan(-0.005);
    update({ pitch: direction });
    for (const n of pitchControls)
      expect((point(n, [0, 0.3, 0]).z - rest.get(n).grip.z) * direction, n.name).toBeLessThan(
        -0.005,
      );
    for (const n of elevators)
      expect(
        (point(n, [0, 0, -0.25]).y - rest.get(n).trailing.y) * direction,
        n.name,
      ).toBeGreaterThan(0.005);
    update({ yaw: direction });
    for (const [i, n] of pedals.entries())
      expect(
        (point(n).z - rest.get(n).origin.z) * (i % 2 === 0 ? 1 : -1) * direction,
        n.name,
      ).toBeGreaterThan(0.005);
    for (const n of rudders)
      expect((point(n, [0, 0, -0.25]).x - rest.get(n).trailing.x) * direction, n.name).toBeLessThan(
        -0.005,
      );
  }
  update({}, 1);
  for (const n of flaps)
    expect(point(n, [0, 0, -0.25]).y - rest.get(n).trailing.y, n.name).toBeLessThan(-0.05);
  const fullFlapDegrees = {
    'pa-28-180': 40,
    'cessna-172s': 30,
    'cessna-182t': 30,
    'cessna-208b': 30,
  }[slug];
  if (fullFlapDegrees)
    for (const n of flaps) expect((n.rotation.x * 180) / Math.PI).toBeCloseTo(-fullFlapDegrees, 8);
  visual.dispose();
});
