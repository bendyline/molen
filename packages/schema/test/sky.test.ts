import { describe, expect, it } from 'vitest';
import { componentIssues } from '../src/components';
import { skySchema } from '../src/sky';

const sky = {
  mode: 'earth',
  observer: { latitude: 47.6, longitude: -122.3 },
  time: { epochMs: 1718971200000, scale: 60 },
};

describe('environment sky schema', () => {
  it('accepts Earth, custom, and legacy environments', () => {
    expect(componentIssues('environment', { sky }, '/environment')).toEqual([]);
    expect(componentIssues('environment', { background: '#112233' }, '/environment')).toEqual([]);
    expect(skySchema.safeParse({ mode: 'custom', sunBody: { direction: [1, 2, 3] } }).success).toBe(
      true,
    );
  });
  it('rejects ambiguous clocks, invalid locations and unknown options at the data boundary', () => {
    for (const candidate of [
      { ...sky, time: { epochMs: 'now' } },
      { ...sky, time: { epochMs: 0, scale: Infinity } },
      { ...sky, observer: { latitude: 91, longitude: 0 } },
      { ...sky, observer: { latitude: 0, longitude: -181 } },
      { ...sky, stars: { magnitudeLimit: 10 } },
      { ...sky, palette: { dayZenith: 'blue' } },
      { ...sky, atmosphere: { haze: 1 } },
      { mode: 'custom', sunBody: { direction: [1, 2] } },
    ])
      expect(skySchema.safeParse(candidate).success).toBe(false);
    expect(
      componentIssues('environment', { sky: { ...sky, stars: { intensitty: 2 } } }, '/environment')
        .length,
    ).toBeGreaterThan(0);
  });
});
