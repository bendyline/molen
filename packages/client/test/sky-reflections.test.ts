import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SkyVisual } from '../src/sky/visual';
import {
  luminance,
  reflectionStateFromLights,
  type SkyReflectionState,
  SkyReflections,
  sampleSkyReflection,
} from '../src/three/sky-reflections';

/** The light a surface facing `normal` gets from the map: radiance over its hemisphere. */
function irradiance(state: SkyReflectionState, normal: readonly number[]): number {
  const color = new THREE.Color();
  const steps = 96;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const y = -1 + (2 * (i + 0.5)) / steps;
    const r = Math.sqrt(1 - y * y);
    for (let j = 0; j < steps; j++) {
      const angle = (2 * Math.PI * (j + 0.5)) / steps;
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      const cosine =
        x * (normal[0] as number) + y * (normal[1] as number) + z * (normal[2] as number);
      if (cosine > 0) sum += luminance(sampleSkyReflection(state, x, y, z, color)) * cosine;
    }
  }
  return (sum * 4 * Math.PI) / (steps * steps);
}

function setup() {
  const scene = new THREE.Scene();
  const output = new THREE.Texture();
  const filter = { update: vi.fn(() => output), dispose: vi.fn() };
  const reflections = new SkyReflections(scene, filter);
  const sky = new SkyVisual({ mode: 'custom', sunBody: { direction: [0, 1, 0] } });
  return { scene, output, filter, reflections, sky };
}

describe('shared sky reflections', () => {
  it('uploads linear half-float radiance with ground below and sky above', () => {
    const { reflections, sky, scene, output } = setup();
    reflections.update(sky.reflectionState);
    expect(scene.environment).toBe(output);
    expect(reflections.texture.type).toBe(THREE.HalfFloatType);
    expect(reflections.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(reflections.texture.mapping).toBe(THREE.EquirectangularReflectionMapping);
    const { data, width, height } = reflections.texture.image;
    const ground = THREE.DataUtils.fromHalfFloat(data[2] as number);
    const skyBlue = THREE.DataUtils.fromHalfFloat(data[(height - 1) * width * 4 + 2] as number);
    expect(skyBlue).toBeGreaterThan(ground * 4);
    expect(Array.from(data).every(Number.isFinite)).toBe(true);
    reflections.dispose();
    sky.dispose();
  });

  it('casts less saturated skylight than the dome when asked, keeping its brightness', () => {
    const saturated = new SkyVisual({ mode: 'custom', sunBody: { direction: [0, 1, 0] } });
    const muted = new SkyVisual({
      mode: 'custom',
      sunBody: { direction: [0, 1, 0] },
      lighting: { skyLightSaturation: 0.2 },
    });
    saturated.update(0);
    muted.update(0);
    const spread = (rgb: readonly number[]): number => Math.max(...rgb) - Math.min(...rgb);
    const luminance = (rgb: readonly number[]): number =>
      (rgb[0] as number) * 0.2126 + (rgb[1] as number) * 0.7152 + (rgb[2] as number) * 0.0722;
    const a = saturated.reflectionState.zenith;
    const b = muted.reflectionState.zenith;
    expect(spread(b)).toBeLessThan(spread(a) * 0.3);
    expect(luminance(b)).toBeCloseTo(luminance(a), 6);
    saturated.dispose();
    muted.dispose();
  });

  it('reuses the same input and output for unchanged frames and refreshes on weather changes', () => {
    const { reflections, sky, filter, output, scene } = setup();
    const source = reflections.texture;
    expect(reflections.update(sky.reflectionState)).toBe(true);
    const version = source.version;
    for (let i = 0; i < 30; i++) expect(reflections.update(sky.reflectionState)).toBe(false);
    expect(source.version).toBe(version);
    expect(filter.update).toHaveBeenCalledTimes(1);
    sky.setCloudAttenuation(1);
    sky.update(0);
    expect(reflections.update(sky.reflectionState)).toBe(true);
    expect(reflections.texture).toBe(source);
    expect(filter.update).toHaveBeenLastCalledWith(source);
    expect(scene.environment).toBe(output);
    const color = sampleSkyReflection(sky.reflectionState, 0, 1, 0, new THREE.Color());
    expect(color.r).toBeCloseTo(color.g);
    expect(color.g).toBeCloseTo(color.b);
    reflections.dispose();
    sky.dispose();
  });

  it('ignores sub-threshold solar motion but updates substantial time-of-day changes', () => {
    const { reflections, sky, filter } = setup();
    const frame = sky.reflectionState;
    reflections.update(frame);
    expect(reflections.update({ ...frame, sunDirection: [0.000001, 1, 0] })).toBe(false);
    const night = new SkyVisual({ mode: 'custom', sunBody: { direction: [0, -1, 0] } });
    expect(reflections.update(night.reflectionState)).toBe(true);
    expect(filter.update).toHaveBeenCalledTimes(2);
    const dayColor = sampleSkyReflection(frame, 0, 1, 0, new THREE.Color());
    const nightColor = sampleSkyReflection(night.reflectionState, 0, 1, 0, new THREE.Color());
    expect(nightColor.b).toBeLessThan(dayColor.b / 10);
    reflections.dispose();
    sky.dispose();
    night.dispose();
  });

  it('lights a level surface as much as the hemisphere light it replaces, scaled by dayAmbient', () => {
    // The map replaces the hemisphere while reflections are on. Graded to the palette's dark
    // zenith, it used to give level ground 40% of the hemisphere's light: shade was nearly black.
    const palettes = [
      undefined,
      { dayZenith: '#2a6cc4', dayHorizon: '#b2cde4', ground: '#9a8f70' },
      { dayZenith: '#000000', dayHorizon: '#b2cde4' },
    ];
    for (const palette of palettes) {
      const fills = [1, 2].map((dayAmbient) => {
        const sky = new SkyVisual({
          mode: 'custom',
          sunBody: { direction: [0.3, 1, 0] },
          lighting: { dayAmbient },
          ...(palette ? { palette } : {}),
        });
        // The broad glow around the sun is the map's own, not the hemisphere's.
        const fill = irradiance({ ...sky.reflectionState, sunGlow: 0 }, [0, 1, 0]);
        const hemisphere = sky.ambientLight.intensity * luminance(sky.ambientLight.color);
        expect(fill / hemisphere).toBeGreaterThan(0.98);
        expect(fill / hemisphere).toBeLessThan(1.02);
        sky.dispose();
        return fill;
      });
      expect((fills[1] as number) / (fills[0] as number)).toBeCloseTo(2, 5);
    }
    // A fixed rig's map stands in for its hemisphere the same way.
    const ambient = new THREE.HemisphereLight('#b2cde4', '#9a8f70', 1.4);
    const state = reflectionStateFromLights(ambient, undefined, new THREE.Color('#2a6cc4'), 0);
    const fill = irradiance(state, [0, 1, 0]);
    expect(fill / (1.4 * luminance(ambient.color))).toBeCloseTo(1, 1);
  });

  it('keeps the sky deeper overhead than at the horizon, and no brighter than it needs', () => {
    const { sky, reflections } = setup();
    const { zenith, horizon } = sky.reflectionState;
    const bright = (c: readonly [number, number, number]) => luminance(new THREE.Color(...c));
    expect(bright(zenith)).toBeLessThan(bright(horizon) * 0.8);
    // The horizon rises at most by what lifting the darkest zenith half way costs.
    const radiance = (sky.ambientLight.intensity * luminance(sky.ambientLight.color)) / Math.PI;
    expect(bright(horizon)).toBeGreaterThan(radiance);
    expect(bright(horizon)).toBeLessThan(radiance * 1.7);
    reflections.dispose();
    sky.dispose();
  });

  it('lights walls from sunlit ground, most of all under a high sun', () => {
    const at = (elevation: number) => {
      const angle = (elevation * Math.PI) / 180;
      return new SkyVisual({
        mode: 'custom',
        sunBody: { direction: [Math.cos(angle), Math.sin(angle), 0] },
        lighting: { sunIntensity: 4.9, dayAmbient: 1.4 },
        palette: { dayZenith: '#2a6cc4', dayHorizon: '#b2cde4', ground: '#9a8f70' },
      });
    };
    const [low, high] = [at(20), at(88)] as const;
    const ground = (sky: SkyVisual) => luminance(new THREE.Color(...sky.reflectionState.ground));
    expect(ground(high)).toBeGreaterThan(ground(low) * 1.5);
    // A wall turned from a sun overhead gets no direct light: what lights it comes off the street.
    const wall = irradiance({ ...high.reflectionState, sunGlow: 0 }, [0, 0, 1]);
    const dark = { ...high.reflectionState, sunGlow: 0, ground: [0, 0, 0] as const };
    expect(irradiance(dark, [0, 0, 1])).toBeLessThan(wall * 0.75);
    low.dispose();
    high.dispose();
  });

  it('respects a host environment and disposes only its own resources once', () => {
    const { reflections, sky, scene, filter } = setup();
    reflections.update(sky.reflectionState);
    const sourceDispose = vi.fn();
    reflections.texture.addEventListener('dispose', sourceDispose);
    const host = new THREE.Texture();
    const hostDispose = vi.fn();
    host.addEventListener('dispose', hostDispose);
    scene.environment = host;
    expect(reflections.update({ ...sky.reflectionState, clouds: 1 })).toBe(false);
    reflections.dispose();
    reflections.dispose();
    expect(scene.environment).toBe(host);
    expect(hostDispose).not.toHaveBeenCalled();
    expect(sourceDispose).toHaveBeenCalledTimes(1);
    expect(filter.dispose).toHaveBeenCalledTimes(1);
    expect(reflections.update(sky.reflectionState)).toBe(false);
    sky.dispose();
    host.dispose();
  });

  it('clears its own scene binding when disposed and derives static rig direction from its target', () => {
    const { reflections, scene, sky } = setup();
    const ambient = new THREE.HemisphereLight('#abcdef', '#123456', 0.4);
    const sun = new THREE.DirectionalLight('#ffffff', 2);
    sun.position.set(10, 10, 4);
    sun.target.position.set(10, 0, 4);
    const state = reflectionStateFromLights(ambient, sun, new THREE.Color('#78aadd'), 0);
    expect(state.sunDirection).toEqual([0, 1, 0]);
    // The horizon keeps the ambient sky's hue, at the strength that makes up the hemisphere.
    expect(state.horizon[0] / state.horizon[2]).toBeCloseTo(ambient.color.r / ambient.color.b);
    expect(state.horizon[0]).toBeGreaterThan((ambient.color.r * 0.4) / Math.PI);
    expect(state.ground[2] / state.ground[0]).toBeCloseTo(
      ambient.groundColor.b / ambient.groundColor.r,
    );
    reflections.update(state);
    reflections.dispose();
    expect(scene.environment).toBeNull();
    sky.dispose();
  });
});
