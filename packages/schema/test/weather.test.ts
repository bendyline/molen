import { describe, expect, it } from 'vitest';
import { componentIssues } from '../src/components';
import {
  resolveWeather,
  snowCoverAt,
  snowWalkingPace,
  weatherProfile,
  weatherSchema,
} from '../src/weather';

describe('weather data', () => {
  it('validates every preset and permits independent cloud, phase and visibility choices', () => {
    for (const name of [
      'sunny',
      'partly-cloudy',
      'overcast',
      'rain',
      'storm',
      'snow',
      'fog',
    ] as const)
      expect(componentIssues('weather', weatherProfile(name), '/weather')).toEqual([]);
    const unusual = {
      clouds: { coverage: 0, type: 'cumulonimbus', cirrus: 0.8, cirrusAltitude: 300 },
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
      { clouds: { type: 'cirrus' } },
      { clouds: { cirrus: 1.5 } },
      { precipitation: { kind: 'auto' } },
      { visibility: 0 },
      { visibility: Infinity },
      { seed: -1 },
      { rain: true },
    ])
      expect(weatherSchema.safeParse(value).success).toBe(false);
  });
  it('lays snow above a snow line, deeper with height', () => {
    const cover = { level: 1000 };
    expect(componentIssues('weather', { snowCover: cover }, '/weather')).toEqual([]);
    for (const value of [{}, { level: 1000, transition: -1 }, { level: 1000, depth: -0.1 }])
      expect(weatherSchema.safeParse({ snowCover: value }).success).toBe(false);
    // No snow without a cover, and none at or below the line.
    expect(snowCoverAt(undefined, 4000)).toEqual({ coverage: 0, depth: 0 });
    expect(snowCoverAt(cover, 1000)).toEqual({ coverage: 0, depth: 0 });
    expect(snowCoverAt(cover, 200)).toEqual({ coverage: 0, depth: 0 });
    // Patchy through the transition (150 m by default), complete at its top at the base depth.
    const patchy = snowCoverAt(cover, 1075);
    expect(patchy.coverage).toBeCloseTo(0.5, 6);
    expect(patchy.depth).toBeCloseTo(0.075, 6);
    expect(snowCoverAt(cover, 1150)).toEqual({ coverage: 1, depth: 0.15 });
    // 0.6 m more for each 1000 m above that, up to the cap.
    expect(snowCoverAt(cover, 2150).depth).toBeCloseTo(0.75, 6);
    expect(snowCoverAt(cover, 4392).depth).toBe(1.5);
    // A zero transition is a hard line that includes the line itself.
    expect(snowCoverAt({ level: 0, transition: 0, depth: 0.3 }, 0)).toEqual({
      coverage: 1,
      depth: 0.3,
    });
    expect(resolveWeather().snowCover).toBeUndefined();
    expect(resolveWeather({ snowCover: cover }).snowCover).toEqual({
      level: 1000,
      transition: 150,
      depth: 0.15,
      depthGain: 0.6,
      maxDepth: 1.5,
    });
  });
  it('slows a walker with the depth of the snow', () => {
    // Boot-sole depth costs nothing; 30 cm leaves 72%, knee-deep 40%, and deeper is no worse.
    expect(snowWalkingPace(0)).toBe(1);
    expect(snowWalkingPace(0.03)).toBe(1);
    expect(snowWalkingPace(0.3)).toBeCloseTo(0.72, 2);
    expect(snowWalkingPace(0.6)).toBeCloseTo(0.4, 6);
    expect(snowWalkingPace(1.5)).toBeCloseTo(0.4, 6);
    for (let depth = 0; depth < 1; depth += 0.05)
      expect(snowWalkingPace(depth + 0.05)).toBeLessThanOrEqual(snowWalkingPace(depth));
  });
  it('returns independent default and profile values', () => {
    const a = weatherProfile('rain');
    const resolved = resolveWeather(a);
    resolved.atmosphere.windVelocity[0] = 100;
    expect(resolveWeather(a).atmosphere.windVelocity[0]).toBe(7);
    expect(resolveWeather(weatherProfile('rain')).atmosphere.windVelocity[0]).toBe(7);
    expect(resolveWeather().precipitation.kind).toBe('none');
    // Existing scenes keep a cumulus layer and gain no cirrus.
    expect(resolveWeather({ clouds: { coverage: 0.5 } }).clouds).toMatchObject({
      type: 'cumulus',
      cirrus: 0,
      cirrusAltitude: 9000,
    });
  });
});
