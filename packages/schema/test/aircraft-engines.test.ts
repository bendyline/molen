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
  it('validates jet ratings, reheat detents, departure angles and fractional flap input', () => {
    const jet = {
      ...sample.spec,
      engine: { ...engine, propulsion: 'jet', dryThrust: 60000, afterburnerThrust: 100000 },
    };
    expect(valid(jet)).toBe(true);
    expect(valid({ ...jet, engine: { ...jet.engine, dryThrust: undefined } })).toBe(false);
    expect(valid({ ...jet, engine: { ...jet.engine, afterburnerThrust: 50000 } })).toBe(false);
    expect(valid({ ...jet, engine: { ...jet.engine, propulsion: 'propeller' } })).toBe(false);
    expect(valid({ ...jet, engine: { ...jet.engine, afterburnerDetent: 1 } })).toBe(false);
    const departure = {
      onsetAngle: 0.4,
      fullAngle: 1,
      yawInstability: 4,
      yawSaturationRate: 3,
      rudderBlanking: 0.9,
      pitchBlanking: 0.9,
      aileronReversal: 0.8,
    };
    expect(valid({ ...jet, airplane: { ...jet.airplane, departure } })).toBe(true);
    expect(
      valid({ ...jet, airplane: { ...jet.airplane, departure: { ...departure, fullAngle: 0.2 } } }),
    ).toBe(false);
    const input = getComponent('aircraftInput');
    for (const flaps of [false, true, 0, 0.25, 1])
      expect(input?.zod.safeParse({ ...input.meta.examples[0], flaps }).success).toBe(true);
    for (const flaps of [-0.1, 1.1, NaN])
      expect(input?.zod.safeParse({ ...input.meta.examples[0], flaps }).success).toBe(false);
  });
  it('validates powered-lift geometry and finite actuator/control parameters', () => {
    const poweredLift = {
      transitTime: 12,
      controlFadeSpeed: 75,
      pitchAuthority: 1.4,
      rollAuthority: 1.5,
      yawAuthority: 0.8,
      damping: 2.2,
    };
    const spec = {
      ...twin,
      poweredLift,
      engines: twin.engines.map((e) => ({ ...e, thrustAxis: [0, 0, 1], vectored: true })),
    };
    expect(valid(spec)).toBe(true);
    expect(valid({ ...spec, poweredLift: { ...poweredLift, transitTime: 0 } })).toBe(false);
    expect(valid({ ...spec, poweredLift: { ...poweredLift, controlFadeSpeed: Number.NaN } })).toBe(
      false,
    );
    expect(valid({ ...spec, engines: twin.engines })).toBe(false);
    expect(valid({ ...spec, poweredLift: undefined })).toBe(false);
    expect(
      valid({ ...spec, engines: spec.engines.map((e) => ({ ...e, thrustAxis: [0, 1, 0] })) }),
    ).toBe(false);
    const input = getComponent('aircraftInput');
    for (const value of [-1, 2, Number.NaN, Number.POSITIVE_INFINITY])
      expect(input?.zod.safeParse({ ...input.meta.examples[0], thrustVector: value }).success).toBe(
        false,
      );
  });
  it('accepts the original single engine and named multi-engine layouts', () => {
    expect(valid(sample.spec)).toBe(true);
    expect(valid(twin)).toBe(true);
    expect(
      valid({
        ...twin,
        airplane: { ...twin.airplane, yawInertia: 45000, rollInertia: 9000, propellerEffects: 1 },
        // Counter-rotating propellers cancel each other's torque and swing.
        engines: [
          { ...twin.engines[0], propellerRotation: 'clockwise', propellerInertia: 60 },
          { ...twin.engines[1], propellerRotation: 'counterclockwise', propellerInertia: 60 },
        ],
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
      { ...twin, airplane: { ...twin.airplane, propellerEffects: 2 } },
      // Attitude limits are gone: the airplane is a free rigid body.
      { ...twin, airplane: { ...twin.airplane, maxRoll: 1.3 } },
      { ...twin, engines: [{ ...engine, id: 'left', propellerRotation: 'sideways' }] },
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
