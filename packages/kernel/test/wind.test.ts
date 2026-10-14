import { weatherProfile } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { sampleWind, terrainSlope, windField } from '../src/wind';

const rms = (values: number[]) =>
  Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
/** Wind samples along a line at one instant, minus the mean wind. */
function gustsAlong(weather: Parameters<typeof windField>[0], y: number, count = 4000) {
  const field = windField(weather);
  const mean = weather.atmosphere?.windVelocity ?? [0, 0, 0];
  return Array.from({ length: count }, (_, i) => {
    const w = field.at([i * 7.3, y, i * 3.1], 0);
    return [w[0] - mean[0], w[1] - mean[1], w[2] - mean[2]] as const;
  });
}

describe('wind field', () => {
  it('is the uniform mean wind without shear, turbulence, gusts or terrain', () => {
    const field = windField({ atmosphere: { windVelocity: [3, 0.5, -2] } });
    expect(field.structured).toBe(false);
    expect(field.at([100, 900, -40], 37)).toEqual([3, 0.5, -2]);
    expect(sampleWind({}, [0, 0, 0], 5)).toEqual([0, 0, 0]);
  });

  it('is a pure function of weather, place and time', () => {
    const rain = weatherProfile('rain');
    const a = sampleWind(rain, [120, 400, -60], 12.5);
    expect(sampleWind(weatherProfile('rain'), [120, 400, -60], 12.5)).toEqual(a);
    expect(sampleWind({ ...rain, seed: 2 }, [120, 400, -60], 12.5)).not.toEqual(a);
    expect(sampleWind(rain, [120, 400, -60], 13)).not.toEqual(a);
  });

  it('scales turbulence with intensity and keeps vertical eddies small near the ground', () => {
    const base = { atmosphere: { windVelocity: [0, 0, 0] as [number, number, number] } };
    const light = gustsAlong({ ...base, wind: { turbulence: 0.15 } }, 400);
    const severe = gustsAlong({ ...base, wind: { turbulence: 0.6 } }, 400);
    const vertical = (samples: typeof light) => rms(samples.map((s) => s[1]));
    // Still air: sigma is 2 m/s per unit intensity, scaled by patchiness between 0.1 and 1.
    expect(vertical(light)).toBeGreaterThan(0.15);
    expect(vertical(light)).toBeLessThan(0.45);
    expect(vertical(severe) / vertical(light)).toBeCloseTo(4, 1);
    const low = gustsAlong({ ...base, wind: { turbulence: 0.6 } }, 6);
    expect(vertical(low)).toBeLessThan(vertical(severe) * 0.2);
  });

  it('is coherent over meters and varies over hundreds of meters', () => {
    const field = windField({ wind: { turbulence: 0.5 } });
    const near = [];
    const far = [];
    for (let i = 0; i < 400; i++) {
      const p: [number, number, number] = [i * 211.7, 500, i * 97.1];
      const a = field.at(p, 0)[1];
      near.push(Math.abs(field.at([p[0] + 0.5, p[1], p[2]], 0)[1] - a));
      far.push(Math.abs(field.at([p[0] + 400, p[1], p[2] + 300], 0)[1] - a));
    }
    expect(rms(near)).toBeLessThan(rms(far) * 0.1);
  });

  it('strengthens the mean wind with height above ground by the shear profile', () => {
    const weather = {
      atmosphere: { windVelocity: [6, 0, 0] as [number, number, number] },
      wind: { shear: 0.14 },
    };
    const field = windField(weather);
    expect(field.at([0, 10, 0], 0)[0]).toBeCloseTo(6, 10);
    expect(field.at([0, 2, 0], 0)[0]).toBeLessThan(6);
    expect(field.at([0, 300, 0], 0)[0]).toBeCloseTo(6 * (300 / 10) ** 0.14, 8);
    // Height counts from the ground beneath, and stops growing atop the surface layer.
    expect(field.at([0, 1010, 0], 0, 1000)[0]).toBeCloseTo(6, 10);
    expect(field.at([0, 5000, 0], 0)[0]).toBe(field.at([0, 600, 0], 0)[0]);
  });

  it('gusts along the mean wind and leaves the cross-wind component alone', () => {
    const weather = {
      atmosphere: { windVelocity: [8, 0, 0] as [number, number, number] },
      wind: { gusts: 0.4 },
    };
    const field = windField(weather);
    const along = Array.from({ length: 600 }, (_, i) => field.at([0, 50, 0], i * 0.5));
    const speeds = along.map((w) => w[0]);
    expect(Math.max(...speeds)).toBeGreaterThan(8 + 8 * 0.4 * 0.5);
    expect(Math.min(...speeds)).toBeLessThan(8 - 8 * 0.4 * 0.5);
    expect(along.every((w) => w[1] === 0 && w[2] === 0)).toBe(true);
  });

  it('lifts air up a windward slope and sinks it in the lee', () => {
    const ridge = (x: number) => Math.max(0, 200 - Math.abs(x) * 0.4);
    const slope = (x: number) => terrainSlope((sx) => ridge(sx), x, 0);
    const weather = {
      atmosphere: { windVelocity: [10, 0, 0] as [number, number, number] },
      wind: { terrain: 1 },
    };
    const field = windField(weather);
    const windward = field.at([-250, ridge(-250) + 20, 0], 0, ridge(-250), slope(-250));
    const lee = field.at([250, ridge(250) + 20, 0], 0, ridge(250), slope(250));
    expect(windward[1]).toBeGreaterThan(3);
    expect(lee[1]).toBeLessThan(-3);
    expect(terrainSlope(() => undefined, 0, 0)).toBeUndefined();
  });
});
