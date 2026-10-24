import { weatherProfile } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { sampleAtmosphere, Weather, weatherOf } from '../src/weather';
import { World } from '../src/world';

describe('physical weather', () => {
  it('matches independent standard-atmosphere checkpoints and remains continuous at the tropopause', () => {
    const sea = sampleAtmosphere({}),
      high = sampleAtmosphere({}, 11000);
    expect(sea.speedOfSound).toBeCloseTo(340.294, 2);
    expect(high.temperatureK).toBeCloseTo(216.774, 2);
    expect(high.pressurePa).toBeCloseTo(22699.8, 0);
    expect(high.densityKgM3).toBeCloseTo(0.3648, 3);
    expect(high.speedOfSound).toBeCloseTo(295.153, 2);
    const boundary = (11000 * 6356766) / (6356766 - 11000);
    expect(
      Math.abs(
        sampleAtmosphere({}, boundary - 0.01).pressurePa -
          sampleAtmosphere({}, boundary + 0.01).pressurePa,
      ),
    ).toBeLessThan(0.1);
    expect(
      sampleAtmosphere(
        { atmosphere: { referenceAltitude: 3000, temperatureK: 280, pressurePa: 70000 } },
        3000,
      ).pressurePa,
    ).toBe(70000);
    expect(sampleAtmosphere({ atmosphere: { model: 'isothermal' } }, 11000).temperatureK).toBe(
      288.15,
    );
    const humid = sampleAtmosphere({
      atmosphere: { moistAir: true, relativeHumidity: 1, temperatureK: 305 },
    });
    const dry = sampleAtmosphere({ atmosphere: { moistAir: false, temperatureK: 305 } });
    expect(humid.densityKgM3).toBeLessThan(dry.densityKgM3);
  });
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
