import type { ModelSignalSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  altimeterInstrument,
  attitudeInstrument,
  compileModelSignalExpressions,
  createModelSignalVisual,
  dialInstrument,
  numericInstrument,
} from '../src/instruments';

it('returns JSON-pure helper data that can be embedded directly in a scene', () => {
  const bindings = [
    dialInstrument({
      node: 'speed',
      source: 'speed',
      calibration: [
        [0, 0],
        [100, 2],
      ],
    }),
    ...altimeterInstrument({ source: 'feet', hundreds: 'hundreds', thousands: 'thousands' }),
    ...attitudeInstrument({
      bankNode: 'bank',
      pitchNode: 'pitch',
      pitchScale: 0.1,
      pitchLimit: 0.03,
    }),
  ];
  expect(JSON.parse(JSON.stringify(bindings))).toEqual(bindings);
});

it('evaluates out-of-order formulas, conversions and unavailable branches without coercion', () => {
  const evaluate = compileModelSignalExpressions({
    knots: { op: 'multiply', args: ['eas', 3600 / 1852] },
    eas: { op: 'multiply', args: ['tas', 'densityCorrection'] },
    densityCorrection: { op: 'sqrt', args: ['densityRatio'] },
    densityRatio: { op: 'divide', args: ['density', 1.225] },
    warning: { op: 'less', args: ['knots', 40] },
    selected: { op: 'if', args: ['backupOn', 'backup', 'knots'] },
    fallback: { op: 'coalesce', args: ['absent', 'knots'] },
    invalid: { op: 'divide', args: [1, 0] },
    invalidRoot: { op: 'sqrt', args: [-1] },
    inherited: { op: 'add', args: ['constructor', 1] },
  });
  const result = evaluate({ tas: 100, density: 1.225 / 4, backupOn: 0 });
  expect(result.knots).toBeCloseTo(97.19222462);
  expect(result.selected).toBe(result.knots);
  expect(result.fallback).toBe(result.knots);
  expect(result.warning).toBe(0);
  expect(result.invalid).toBeUndefined();
  expect(result.invalidRoot).toBeUndefined();
  expect(result.inherited).toBeUndefined();
  expect(evaluate({ tas: Infinity, density: 1.225 }).knots).toBeUndefined();
  expect(evaluate({ tas: 100, density: 1.225, backupOn: 1 }).selected).toBeUndefined();
  expect(() =>
    compileModelSignalExpressions({
      a: { op: 'add', args: ['b', 1] },
      b: { op: 'add', args: ['a', 1] },
    }),
  ).toThrow(/Cyclic/);
});

function pointer(spec: ModelSignalSpec) {
  const root = new THREE.Group(),
    needle = new THREE.Group();
  needle.name = 'needle';
  root.add(needle);
  return { root, needle, visual: createModelSignalVisual(root, spec) };
}

it('filters with simulation time, handles pauses/rewinds, and crosses north by the short arc', () => {
  const spec: ModelSignalSpec = {
    bindings: [
      {
        node: 'needle',
        source: 'heading',
        property: 'rotation',
        axis: 'z',
        scale: Math.PI / 180,
        period: 2 * Math.PI,
        responseSeconds: 1,
      },
    ],
  };
  const a = pointer(spec),
    b = pointer(spec);
  for (const p of [a, b]) p.visual.update({ heading: 359 }, 0);
  a.visual.update({ heading: 1 }, 1);
  for (let tick = 1; tick <= 60; tick++) b.visual.update({ heading: 1 }, tick / 60);
  expect(a.needle.rotation.z).toBeCloseTo(b.needle.rotation.z, 12);
  expect((a.needle.rotation.z * 180) / Math.PI).toBeCloseTo(1 - 2 / Math.E);
  const paused = a.needle.rotation.z;
  a.visual.update({ heading: 180 }, 1);
  expect(a.needle.rotation.z).toBe(paused);
  a.visual.update({ heading: 90 }, 0);
  expect(a.needle.rotation.z).toBeCloseTo(Math.PI / 2);
  a.visual.reset();
  expect(a.needle.rotation.z).toBe(0);
  a.visual.update({ heading: 270 });
  expect(a.needle.rotation.z).toBeCloseTo((3 * Math.PI) / 2);
});

it('keeps nonlinear calibration local to rotated cockpit frames and reports missing signals', () => {
  const { root, needle, visual } = pointer({
    derived: { kph: { op: 'multiply', args: ['speed', 3.6] } },
    bindings: [
      dialInstrument({
        node: 'needle',
        source: 'kph',
        calibration: [
          [0, -2],
          [40, 0],
          [120, 1],
        ],
        missing: 'rest',
      }),
    ],
  });
  root.rotation.set(0.3, 1.2, -0.7);
  visual.update({ speed: 80 / 3.6 });
  expect(needle.rotation.z).toBeCloseTo(0.5);
  expect(root.rotation.toArray()).toEqual([0.3, 1.2, -0.7, 'XYZ']);
  visual.update({});
  expect(needle.rotation.z).toBe(0);
  expect(visual.missingSignals).toEqual(['kph']);
  visual.update({ speed: 0 });
  expect(visual.missingSignals).toEqual([]);
});

it('reads a three-pointer altimeter and independently translates/rolls a nested horizon', () => {
  const root = new THREE.Group();
  for (const name of ['hundreds', 'thousands', 'tenThousands', 'bank']) {
    const node = new THREE.Group();
    node.name = name;
    root.add(node);
  }
  const card = new THREE.Group();
  card.name = 'pitch';
  root.getObjectByName('bank')?.add(card);
  const visual = createModelSignalVisual(root, {
    bindings: [
      ...altimeterInstrument({
        source: 'feet',
        hundreds: 'hundreds',
        thousands: 'thousands',
        tenThousands: 'tenThousands',
      }),
      ...attitudeInstrument({
        bankNode: 'bank',
        pitchNode: 'pitch',
        pitchScale: -0.04,
        pitchLimit: 0.02,
      }),
    ],
  });
  visual.update({ feet: 12500, roll: Math.PI / 6, pitch: Math.PI / 18 });
  expect(root.getObjectByName('hundreds')?.rotation.z).toBeCloseTo(Math.PI);
  expect(root.getObjectByName('thousands')?.rotation.z).toBeCloseTo(Math.PI * 1.5);
  expect(root.getObjectByName('tenThousands')?.rotation.z).toBeCloseTo(Math.PI * 1.75);
  expect(root.getObjectByName('bank')?.rotation.z).toBeCloseTo((11 * Math.PI) / 6);
  expect(card.position.y).toBeCloseTo((-0.04 * Math.PI) / 18);
});

it('drives independent numeric readouts and blanks missing, negative and overflowing readings', () => {
  const root = new THREE.Group();
  const digits = [0, 1, 2].map((digit) => {
    return ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((segment) => {
      const node = new THREE.Group();
      node.name = `d${digit}${segment}`;
      node.visible = false;
      root.add(node);
      return node.name;
    }) as [string, string, string, string, string, string, string];
  });
  const spec = numericInstrument({ source: 'knots', prefix: 'asi', digits });
  const visual = createModelSignalVisual(root, spec);
  const mask = (digit: number) =>
    digits[digit].reduce(
      (mask, name, index) => mask | (Number(root.getObjectByName(name)?.visible) << index),
      0,
    );
  visual.update({ knots: 128.9 });
  expect([mask(0), mask(1), mask(2)]).toEqual([0x06, 0x5b, 0x7f]);
  for (const value of [-1, 1000, NaN, undefined]) {
    visual.update({ knots: value });
    expect([mask(0), mask(1), mask(2)]).toEqual([0, 0, 0]);
  }
  visual.update({ knots: 7 });
  expect([mask(0), mask(1), mask(2)]).toEqual([0x3f, 0x3f, 0x07]);
  visual.reset();
  expect([mask(0), mask(1), mask(2)]).toEqual([0, 0, 0]);
});
