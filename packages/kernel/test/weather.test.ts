import { weatherProfile } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { sampleAtmosphere, Weather, weatherOf } from '../src/weather';
import { World } from '../src/world';

describe('physical weather', () => {
  it('samples ideal-gas density, pressure at altitude and alternate gas constants', () => {
    expect(sampleAtmosphere({}).densityKgM3).toBeCloseTo(1.225, 3);
    const warm = sampleAtmosphere({ atmosphere: { temperatureK: 320 } });
    const cold = sampleAtmosphere({ atmosphere: { temperatureK: 260 } });
    expect(warm.densityKgM3).toBeLessThan(cold.densityKgM3);
    expect(sampleAtmosphere({}, 1000).pressurePa).toBeLessThan(sampleAtmosphere({}).pressurePa);
    expect(sampleAtmosphere({ atmosphere: { pressurePa: 0 } }, 1000).densityKgM3).toBe(0);
    expect(sampleAtmosphere({ atmosphere: { gasConstant: 400 } }).densityKgM3).toBeLessThan(1);
    expect(sampleAtmosphere({ atmosphere: { referenceAltitude: 500 } }, 500).pressurePa).toBe(
      101325,
    );
  });
  it('keeps weather in snapshots and hashes, and restores it for future physics ticks', () => {
    const world = new World({ seed: 'weather' });
    expect(weatherOf(world)).toBeUndefined();
    world.spawnRaw({ weather: weatherProfile('rain') }, 'conditions');
    const frame = takeKeyframe(world),
      original = stateHash(world);
    const restored = new World({ seed: 'weather' });
    applyKeyframeTo(restored, frame);
    expect(stateHash(restored)).toBe(original);
    expect(sampleAtmosphere(weatherOf(restored) ?? {}, 500)).toEqual(
      sampleAtmosphere(weatherOf(world) ?? {}, 500),
    );
    world.set('conditions', Weather, weatherProfile('snow'));
    expect(stateHash(world)).not.toBe(original);
    expect(weatherOf(restored)?.precipitation?.kind).toBe('rain');
  });
});
