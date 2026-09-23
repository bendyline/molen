import { describe, expect, it } from 'vitest';
import { type AircraftData, getComponent } from '../src/index';

const component = getComponent('aircraft');
const sample = component?.meta.examples[0] as AircraftData;
if (!component || !sample?.spec.engine) throw new Error('Missing aircraft example');
const { engine, ...airframe } = sample.spec;
const twin = {
  ...airframe,
  engines: [
    { ...engine, id: 'left', position: [2, 1, 1] },
    { ...engine, id: 'right', position: [-2, 1, 1] },
  ],
};
const valid = (spec: unknown) => component.zod.safeParse({ kind: 'test.twin', spec }).success;

describe('aircraft engine authoring', () => {
  it('accepts the original single engine and named multi-engine layouts', () => {
    expect(valid(sample.spec)).toBe(true);
    expect(valid(twin)).toBe(true);
    expect(
      valid({
        ...twin,
        airplane: { ...twin.airplane, yawInertia: 45000, thrustYawDamping: 2 },
        visual: {
          ...twin.visual,
          rotors: [{ node: 'left-prop', axis: 'z', multiplier: 1, engine: 'left' }],
        },
      }),
    ).toBe(true);
  });
  it('rejects missing, ambiguous, empty, duplicate or unsupported engine banks', () => {
    for (const spec of [
      airframe,
      { ...twin, engine },
      { ...airframe, engines: [] },
      { ...twin, engines: [twin.engines[0], twin.engines[0]] },
      { ...twin, model: 'helicopter' },
      { ...twin, engines: [{ ...engine, id: 'constructor' }] },
      { ...twin, engines: [{ ...engine, id: 'left', thrustAxis: [0, 0, 0] }] },
      { ...twin, engines: [{ ...engine, id: 'left', propellerEfficiency: 2 }] },
      { ...twin, airplane: { ...twin.airplane, yawInertia: 0 } },
      {
        ...twin,
        visual: {
          ...twin.visual,
          rotors: [{ node: 'prop', axis: 'z', multiplier: 1, engine: 'typo' }],
        },
      },
    ])
      expect(valid(spec)).toBe(false);
  });
  it('allows throttle overrides but keeps failure state out of pilot input', () => {
    const input = getComponent('aircraftInput');
    if (!input) throw new Error('Missing input schema');
    expect(
      input.zod.safeParse({
        ...input.meta.examples[0],
        engines: { left: { power: 0.5 }, right: { enabled: false } },
      }).success,
    ).toBe(true);
    expect(
      input.zod.safeParse({ ...input.meta.examples[0], engines: { left: { failed: false } } })
        .success,
    ).toBe(false);
  });
});
