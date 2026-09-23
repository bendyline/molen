import { describe, expect, it } from 'vitest';
import { componentIssues } from '../src/components';
import { resolveWeather, weatherProfile, weatherSchema } from '../src/weather';

describe('weather data', () => {
  it('validates every preset and permits independent cloud, phase and visibility choices', () => {
    for (const name of ['sunny', 'partly-cloudy', 'overcast', 'rain', 'snow', 'fog'] as const)
      expect(componentIssues('weather', weatherProfile(name), '/weather')).toEqual([]);
    const unusual = {
      clouds: { coverage: 0 },
      precipitation: { kind: 'snow', intensity: 0.5 },
      visibility: 80000,
      atmosphere: { temperatureK: 300, pressurePa: 0 },
    };
    expect(weatherSchema.safeParse(unusual).success).toBe(true);
  });
  it('rejects invalid physical units and ambiguous phase values', () => {
    for (const value of [
      { atmosphere: { temperatureK: 0 } },
      { atmosphere: { pressurePa: -1 } },
      { atmosphere: { windVelocity: [1, 2] } },
      { clouds: { coverage: 1.1 } },
      { clouds: { thickness: 0 } },
      { precipitation: { kind: 'auto' } },
      { visibility: 0 },
      { visibility: Infinity },
      { seed: -1 },
      { rain: true },
    ])
      expect(weatherSchema.safeParse(value).success).toBe(false);
  });
  it('returns independent default and profile values', () => {
    const a = weatherProfile('rain');
    const resolved = resolveWeather(a);
    resolved.atmosphere.windVelocity[0] = 100;
    expect(resolveWeather(a).atmosphere.windVelocity[0]).toBe(7);
    expect(resolveWeather(weatherProfile('rain')).atmosphere.windVelocity[0]).toBe(7);
    expect(resolveWeather().precipitation.kind).toBe('none');
  });
});
