import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { createEarthFog } from '../src/client/atmosphere';
import { earthEnvironment } from '../src/client/earth-view';
import {
  EARTH_LIGHTING,
  EARTH_SKY_PALETTE,
  earthHazeColor,
  earthShadowFocus,
} from '../src/client/look';
import { earthPerformanceTier } from '../src/client/performance';

describe('the shared Earth look', () => {
  it('hazes toward the sky dome horizon on each backend', () => {
    const horizon = new Color(EARTH_SKY_PALETTE.dayHorizon);
    // WebGPU fogs before tone mapping: the dome's own radiance.
    expect(earthHazeColor('webgpu', horizon).equals(horizon)).toBe(true);
    // WebGL fogs after tone mapping, so the fog is the tone-mapped value: below the input where
    // Neutral compresses highlights, the same hue order, and never above one.
    const webgl = earthHazeColor('webgl', horizon);
    expect(webgl.b).toBeLessThan(horizon.b);
    expect(webgl.b).toBeGreaterThan(webgl.g);
    expect(webgl.g).toBeGreaterThan(webgl.r);
    expect(Math.max(webgl.r, webgl.g, webgl.b)).toBeLessThanOrEqual(1);
    // Mid-tones below Neutral's compression start only lose its small toe offset.
    const mid = earthHazeColor('webgl', new Color(0.3, 0.4, 0.5));
    expect(mid.r).toBeCloseTo(0.26, 6);
    expect(mid.b).toBeCloseTo(0.46, 6);
    // The default distance haze is the horizon, not a separate grey.
    expect(createEarthFog('webgpu').color.equals(horizon)).toBe(true);
    expect(createEarthFog('webgl').color.equals(webgl)).toBe(true);
  });

  it('gives mountEarthView the same light rig as the clock-driven sky', () => {
    const env = earthEnvironment(undefined);
    expect(env.toneMapping).toBe('neutral');
    expect(env.sun?.intensity).toBe(EARTH_LIGHTING.sunIntensity);
    expect(env.ambient?.intensity).toBe(EARTH_LIGHTING.dayAmbient);
    expect(env.ambient?.sky).toBe(EARTH_SKY_PALETTE.dayHorizon);
    expect(env.background).toBe(EARTH_SKY_PALETTE.dayZenith);
  });

  it('turns sun shadows on from the Medium tier and aims them ahead of the camera', () => {
    expect([0, 1, 2, 3, 4, 5].map((level) => earthPerformanceTier(level).shadows)).toEqual([
      'off',
      'off',
      'medium',
      'high',
      'high',
      'high',
    ]);
    const walk = earthShadowFocus('walk', [0, 2, 0], [0, 0, -1], 0);
    expect(walk.radius).toBe(160);
    expect(walk.center).toEqual([0, 0, -80]);
    // A flying camera's square widens with height above the ground, within limits.
    expect(earthShadowFocus('fly', [0, 600, 0], [1, -0.3, 0], 100).radius).toBe(1_000);
    expect(earthShadowFocus('fly', [0, 50, 0], [1, 0, 0], 0).radius).toBe(300);
    expect(earthShadowFocus('fly', [0, 9_000, 0], [1, 0, 0], 0).radius).toBe(2_500);
  });
});
