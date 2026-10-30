import { weatherProfile } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SkyVisual } from '../src/sky/visual';
import {
  createCloudShadowUniforms,
  hasShaderHook,
  injectCloudShadows,
  installWebGlCloudShadows,
} from '../src/weather/cloud-shadows';
import { CloudNoise } from '../src/weather/noise';
import { WeatherVisual } from '../src/weather/visual';

type DeckMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
const deckOf = (weather: WeatherVisual): DeckMesh =>
  weather.object.getObjectByName('molen:cloud-deck') as DeckMesh;
const shellsOf = (weather: WeatherVisual): DeckMesh =>
  weather.object.getObjectByName('molen:cloud-shells') as DeckMesh;
/** Distance between two wrapped texture coordinates. */
const wrapped = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};
const litShader = (): THREE.WebGLProgramParametersWithUniforms =>
  ({
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  }) as unknown as THREE.WebGLProgramParametersWithUniforms;

describe('weather rendering', () => {
  it('seeks particles reproducibly, remains anchored when rebased and reuses allocations', () => {
    const weather = new WeatherVisual(weatherProfile('snow'), { noiseBudgetMs: Infinity });
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 50000);
    camera.position.set(15000, 1000, -22000);
    weather.update(20, camera, [0, 0, 0]);
    const particles = weather.object.getObjectByName('molen:precipitation') as THREE.Mesh;
    const geometry = particles.geometry;
    const a = Array.from(geometry.getAttribute('position').array);
    weather.update(100, camera, [0, 0, 0]);
    weather.update(20, camera, [0, 0, 0]);
    expect(Array.from(geometry.getAttribute('position').array)).toEqual(a);
    const deck = deckOf(weather);
    const uniforms = deck.material.uniforms;
    const field = (uniforms.cloudField?.value as THREE.Vector4).clone();
    const shape = (uniforms.cloudShapeUv?.value as THREE.Vector4).clone();
    camera.position.set(0, 0, 0);
    weather.update(20, camera, [15000, 1000, -22000]);
    expect(geometry.getAttribute('position').getX(0)).toBeCloseTo((a[0] ?? 0) - 15000, 2);
    // The deck lies at the cloud base (1600 m) in rendered coordinates, and its pattern
    // offsets shift by exactly the rebase, which the rendered positions shift back.
    expect(deck.position.y).toBe(600);
    expect((uniforms.cloudSlab?.value as THREE.Vector4).x).toBe(600);
    const next = uniforms.cloudField?.value as THREE.Vector4;
    expect(wrapped(next.y, field.y + 15000 * field.x)).toBeLessThan(1e-6);
    expect(wrapped(next.z, field.z - 22000 * field.x)).toBeLessThan(1e-6);
    const nextShape = uniforms.cloudShapeUv?.value as THREE.Vector4;
    expect(wrapped(nextShape.z, shape.z + 1000 * shape.x)).toBeLessThan(1e-6);
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
  it('draws the deck from outside the layer and nested shells from inside it', () => {
    const weather = new WeatherVisual(weatherProfile('partly-cloudy'), {
      noiseBudgetMs: Infinity,
    });
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 80000);
    weather.update(0, camera, [0, 0, 0]);
    // Cumulus and cirrus: two layers.
    expect(weather.stats.cloudLayers).toBe(2);
    expect(deckOf(weather).visible).toBe(true);
    expect(shellsOf(weather).visible).toBe(false);
    camera.position.set(0, 2000, 0);
    weather.update(0, camera, [0, 0, 0]);
    expect(deckOf(weather).visible).toBe(false);
    expect(shellsOf(weather).visible).toBe(true);
    expect(shellsOf(weather).position.y).toBe(2000);
    // Above the layer the deck lies on its top, 1800 + 600 m.
    camera.position.set(0, 1500, 0);
    weather.update(0, camera, [0, 3000, 0]);
    expect(deckOf(weather).visible).toBe(true);
    expect(deckOf(weather).position.y).toBe(2400 - 3000);
    weather.dispose();
  });
  it('changes cloud work and shadows by quality without rebuilding the material', () => {
    const weather = new WeatherVisual(weatherProfile('partly-cloudy'), {
      noiseBudgetMs: Infinity,
    });
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 80000);
    weather.update(0, camera, [0, 0, 0]);
    const material = deckOf(weather).material;
    const march = material.uniforms.cloudMarch?.value as THREE.Vector4;
    const shadows = createCloudShadowUniforms(new THREE.Texture());
    const steps: number[] = [];
    const active: boolean[] = [];
    for (const quality of ['low', 'medium', 'high', 'ultra'] as const) {
      weather.setCloudQuality(quality);
      weather.update(0, camera, [0, 0, 0]);
      steps.push(march.x);
      active.push(weather.shadowsActive);
      weather.writeShadows(shadows);
      expect(shadows.molenCloudShadow.value.x).toBe(weather.shadowsActive ? 1 : 0);
    }
    expect(steps).toEqual([...steps].sort((x, y) => x - y));
    expect(new Set(steps).size).toBe(4);
    expect(active).toEqual([false, false, true, true]);
    expect(deckOf(weather).material).toBe(material);
    // Shadows fall where the deck's clouds are: the same field, offset and coverage.
    expect(shadows.molenCloudField.value.toArray()).toEqual(
      (material.uniforms.cloudField?.value as THREE.Vector4).toArray(),
    );
    weather.dispose();
  });
  it('builds cloud noise in slices, tiled seamlessly, with coverage meaning sky fraction', () => {
    const noise = new CloudNoise();
    let slices = 0;
    while (!noise.build(['weather'], 0)) slices++;
    expect(slices).toBeGreaterThan(4);
    expect(noise.has('weather')).toBe(true);
    expect(noise.has('shape')).toBe(false);
    const size = Math.sqrt(noise.weather.length / 4);
    // Opposite edges are neighbours: across the seam texels differ as much as adjacent ones.
    let seam = 0;
    let inner = 0;
    for (let y = 0; y < size; y++) {
      const at = (x: number): number => noise.weather[(y * size + x) * 4] as number;
      seam += Math.abs(at(0) - at(size - 1));
      inner += Math.abs(at(1) - at(0));
    }
    expect(seam).toBeLessThan(inner * 2);
    // Equalized channels: 40% of the cumulus field lies in its top 40%.
    let above = 0;
    for (let i = 0; i < noise.weather.length; i += 4)
      if ((noise.weather[i] as number) > 153) above++;
    expect(above / (size * size)).toBeCloseTo(0.4, 1);
  });
  it('lets spatial cloud shadows replace the uniform dimming of direct light', () => {
    const sky = new SkyVisual({ mode: 'custom', sunBody: { direction: [0, 1, 0] } });
    const sun = sky.sunLight.intensity;
    const ambient = sky.ambientLight.intensity;
    sky.setCloudAttenuation(0.8, 0);
    sky.update(0);
    expect(sky.sunLight.intensity).toBe(sun);
    expect(sky.ambientLight.intensity).toBeLessThan(ambient);
    sky.dispose();
  });
  it('injects cloud shadows into lit shaders only, and only for registered renderers', () => {
    const uniforms = createCloudShadowUniforms(new THREE.Texture());
    const lit = litShader();
    // Guards three upgrades: the light-loop line the shadow attaches to must still exist.
    expect(injectCloudShadows(lit, uniforms)).toBe(true);
    expect(lit.fragmentShader).toContain('molenCloudShadowAt( geometryPosition');
    expect(lit.uniforms.molenCloudMap).toBe(uniforms.molenCloudMap);
    const unlit = {
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    expect(injectCloudShadows(unlit, uniforms)).toBe(false);
    expect(unlit.fragmentShader).toBe(THREE.ShaderLib.basic.fragmentShader);

    const renderer = {} as THREE.WebGLRenderer;
    const release = installWebGlCloudShadows(renderer, uniforms);
    const material = new THREE.MeshStandardMaterial();
    // The shared hook is not a material's own variation: static batching still merges it.
    expect(hasShaderHook(material)).toBe(false);
    const mine = litShader();
    material.onBeforeCompile(mine, renderer);
    expect(mine.fragmentShader).toContain('molenCloudShadowAt');
    const other = litShader();
    material.onBeforeCompile(other, {} as THREE.WebGLRenderer);
    expect(other.fragmentShader).not.toContain('molenCloudShadowAt');
    // A material's own hook that calls the prototype's first keeps the shadow.
    material.onBeforeCompile = (shader, target): void => {
      THREE.Material.prototype.onBeforeCompile.call(material, shader, target);
    };
    expect(hasShaderHook(material)).toBe(true);
    const chained = litShader();
    material.onBeforeCompile(chained, renderer);
    expect(chained.fragmentShader).toContain('molenCloudShadowAt');
    release();
    const released = litShader();
    material.onBeforeCompile(released, renderer);
    expect(released.fragmentShader).not.toContain('molenCloudShadowAt');
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
