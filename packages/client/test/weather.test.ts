import { weatherProfile } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SkyVisual } from '../src/sky/visual';
import { WeatherVisual } from '../src/weather/visual';

describe('weather rendering', () => {
  it('seeks particles reproducibly, remains anchored when rebased and reuses allocations', () => {
    const weather = new WeatherVisual(weatherProfile('snow'));
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 50000);
    camera.position.set(15000, 1000, -22000);
    weather.update(20, camera, [0, 0, 0]);
    const particles = weather.object.getObjectByName('molen:precipitation') as THREE.Mesh;
    const geometry = particles.geometry;
    const a = Array.from(geometry.getAttribute('position').array);
    weather.update(100, camera, [0, 0, 0]);
    weather.update(20, camera, [0, 0, 0]);
    expect(Array.from(geometry.getAttribute('position').array)).toEqual(a);
    const layer = weather.object.getObjectByName('molen:cloud-layer-0') as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;
    const offset = layer.material.map?.offset.clone();
    camera.position.set(0, 0, 0);
    weather.update(20, camera, [15000, 1000, -22000]);
    expect(geometry.getAttribute('position').getX(0)).toBeCloseTo((a[0] ?? 0) - 15000, 2);
    expect(layer.position.y).toBe(600);
    expect(layer.material.map?.offset).toEqual(offset);
    weather.setData(weatherProfile('rain'));
    weather.update(20, camera, [15000, 1000, -22000]);
    expect(particles.geometry).toBe(geometry);
    expect(weather.stats.particles).toBe(980);
    weather.setData(weatherProfile('sunny'));
    weather.update(20, camera, [0, 0, 0]);
    expect(weather.stats).toEqual({ cloudLayers: 0, particles: 0 });
    weather.dispose();
    weather.dispose();
    expect(() => weather.update(0, camera, [0, 0, 0])).toThrow(/disposed/);
  });
  it('limits visibility without modifying authored fog and changes no precipitation phase', () => {
    const weather = new WeatherVisual({
      visibility: 500,
      atmosphere: { temperatureK: 320 },
      precipitation: { kind: 'snow', intensity: 1 },
    });
    const base = new THREE.Fog('#ffffff', 300, 8000);
    expect(weather.fogFor(base)).toMatchObject({ far: 500 });
    expect(base.far).toBe(8000);
    expect(weather.data.precipitation.kind).toBe('snow');
    weather.dispose();
  });
  it('preserves the clear foreground in sunny weather and restores it after fog', () => {
    const weather = new WeatherVisual(weatherProfile('sunny'));
    const base = new THREE.Fog('#d6e0e3', 2_100, 20_000);
    const sunny = weather.fogFor(base) as THREE.Fog;
    expect(THREE.MathUtils.smoothstep(2_000, sunny.near, sunny.far)).toBe(0);
    expect(sunny.near).toBe(base.near);
    expect(sunny.far).toBe(base.far);

    weather.setData(weatherProfile('fog'));
    const foggy = weather.fogFor(base) as THREE.Fog;
    expect(THREE.MathUtils.smoothstep(300, foggy.near, foggy.far)).toBeGreaterThan(0.7);
    expect(THREE.MathUtils.smoothstep(500, foggy.near, foggy.far)).toBe(1);
    expect(foggy.color).toEqual(base.color);
    expect(base.near).toBe(2_100);
    expect(base.far).toBe(20_000);

    weather.setData(weatherProfile('sunny'));
    expect(weather.fogFor(base)).toBe(base);
    weather.dispose();
  });
  it('dims the sky lights without cumulative attenuation and restores clear lighting', () => {
    const sky = new SkyVisual({ mode: 'custom', sunBody: { direction: [0, 1, 0] } });
    const initial = sky.sunLight.intensity;
    sky.setCloudAttenuation(1);
    sky.update(0);
    expect(sky.sunLight.intensity).toBeLessThan(initial * 0.1);
    const cloudy = sky.sunLight.intensity;
    sky.update(1);
    sky.update(2);
    expect(sky.sunLight.intensity).toBe(cloudy);
    sky.setCloudAttenuation(0);
    sky.update(3);
    expect(sky.sunLight.intensity).toBe(initial);
    sky.dispose();
  });
});
