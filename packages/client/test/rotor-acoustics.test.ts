import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { rotorAcoustics } from '../src/audio/rotor-acoustics';

const spec = { engine: { rotorAngularSpeed: 48 } } as AircraftSpec;
const state = {
  rpm: 1,
  roll: 0,
  rollRate: 0,
  pitchRate: 0,
  airspeed: 35,
  verticalSpeed: 0,
  grounded: false,
} as AircraftStateData;
const controls = { power: 0.6, roll: 0, pitch: 0 } as AircraftInputData;
describe('rotor acoustic loading', () => {
  it('changes timbre and pulses in a bank while governed rotor frequency stays constant', () => {
    const level = rotorAcoustics(spec, state, controls, [0, 1, 2]);
    const banked = rotorAcoustics(
      spec,
      { ...state, roll: -0.5, rollRate: -0.3 },
      { ...controls, roll: -0.6 },
      [0, 1, 2],
    );
    expect(banked.pulseHz).toBe(level.pulseHz);
    expect(banked.lowpassHz).toBeGreaterThan(level.lowpassHz);
    expect(banked.pulseDepth).toBeGreaterThan(level.pulseDepth);
    expect(banked.gain).toBeGreaterThan(level.gain);
    expect(banked.cyclicRoll).toBeLessThan(0);
  });
  it('varies the loaded sector around the rotor and strengthens descending interaction noise', () => {
    const roll = { ...controls, roll: 1 };
    const left = rotorAcoustics(spec, state, roll, [20, 0, 0]);
    const right = rotorAcoustics(spec, state, roll, [-20, 0, 0]);
    expect(left.lowpassHz).toBeGreaterThan(right.lowpassHz);
    const cruise = rotorAcoustics(spec, state, controls, [0, 0, 20]);
    const descending = rotorAcoustics(spec, { ...state, verticalSpeed: -5 }, controls, [0, 0, 20]);
    expect(descending.pulseDepth).toBeGreaterThan(cruise.pulseDepth);
    expect(descending.lowpassHz).toBeGreaterThan(cruise.lowpassHz);
    expect(rotorAcoustics(spec, { ...state, rpm: 0 }, controls, [0, 0, 0]).gain).toBe(0);
  });
});
