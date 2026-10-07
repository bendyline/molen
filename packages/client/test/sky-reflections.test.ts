import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { defaultSkyPalette, SkyVisual } from '../src/sky/visual';
import {
  reflectionStateFromLights,
  SkyReflections,
  sampleSkyReflection,
} from '../src/three/sky-reflections';

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

  it('carries the sky fill the hemisphere light would, scaled by dayAmbient', () => {
    // The map replaces the hemisphere while reflections are on, so its radiance is the
    // hemisphere's irradiance over π: doubling dayAmbient doubles the fill, and the fill matches
    // the light-only rig's.
    const dim = new SkyVisual({
      mode: 'custom',
      sunBody: { direction: [0, 1, 0] },
      lighting: { dayAmbient: 1 },
    });
    const bright = new SkyVisual({
      mode: 'custom',
      sunBody: { direction: [0, 1, 0] },
      lighting: { dayAmbient: 2 },
    });
    const up = (sky: SkyVisual) =>
      sampleSkyReflection(sky.reflectionState, 0, 1, 0, new THREE.Color());
    expect(up(bright).b).toBeCloseTo(up(dim).b * 2, 6);
    // Full daylight with no cloud: the day zenith at the ambient intensity (1) over π.
    const zenith = new THREE.Color(defaultSkyPalette.dayZenith).multiplyScalar(1 / Math.PI);
    dim.reflectionState.zenith.forEach((value, i) => {
      expect(value).toBeCloseTo(zenith.toArray()[i] as number, 6);
    });
    dim.dispose();
    bright.dispose();
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
    expect(state.horizon[0]).toBeCloseTo((ambient.color.r * 0.4) / Math.PI);
    reflections.update(state);
    reflections.dispose();
    expect(scene.environment).toBeNull();
    sky.dispose();
  });
});
