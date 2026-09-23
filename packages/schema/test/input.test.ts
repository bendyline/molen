import { describe, expect, it } from 'vitest';
import { validate } from '../src/index';

const scene = (input: unknown): unknown => ({
  format: 'molen/scene@3',
  name: 'controls',
  entities: [],
  commands: { flaps: {}, pitch: {} },
  input,
});
const flying = {
  bindings: { KeyF: 'flaps.up' },
  axes: [{ action: 'pitch', axis: 12 }],
  buttons: [{ action: 'flaps.fullUp', button: 20 }],
};

describe('input profile validation', () => {
  it('accepts actions produced only by named profiles or arbitrary raw indices', () => {
    expect(
      validate(
        'scene',
        scene({
          bindings: {},
          profiles: { flying },
          profile: 'flying',
          emit: [
            { kind: 'press', action: 'flaps.fullUp', command: 'flaps', payload: { position: 0 } },
            { kind: 'axis', action: 'pitch', command: 'pitch' },
          ],
        }),
      ).ok,
    ).toBe(true);
  });
  it('rejects missing profiles, invalid calibration and unbound scalar opposites', () => {
    const result = validate(
      'scene',
      scene({
        bindings: {},
        profile: 'missing',
        axes: [{ action: 'pitch', axis: 0, min: 0.5, center: 0 }],
        emit: [{ kind: 'axis', action: 'pitch', negative: 'typo', command: 'pitch' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          'unknown_input_profile',
          'invalid_axis_calibration',
          'unknown_input_action',
        ]),
      );
  });
  it.each([
    { axis: -1 },
    { deadZone: 1 },
    { curve: 0 },
    { mode: 'unknown' },
  ])('rejects malformed axis binding %j', (patch) => {
    expect(
      validate('scene', scene({ bindings: {}, axes: [{ action: 'pitch', axis: 0, ...patch }] })).ok,
    ).toBe(false);
  });
});
