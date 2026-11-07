import { readFileSync } from 'node:fs';
import type { EarthSkyData, Vec3 } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { evaluateEarthSky, skyTimeMs, starDirection } from '../src/sky/astronomy';
import { SkyVisual } from '../src/sky/visual';

const time = Date.parse('2024-03-20T12:00:00Z');
const earth: EarthSkyData = {
  mode: 'earth',
  observer: { latitude: 0, longitude: 0 },
  time: { epochMs: time },
};
const radians = Math.PI / 180;
const angle = (a: Vec3, b: Vec3): number =>
  Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0),
      ),
    ),
  ) / radians;

const meshNamed = (
  sky: SkyVisual,
  name: string,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> => {
  const object = sky.scene.getObjectByName(name);
  if (!(object instanceof THREE.Mesh)) throw new Error(`missing ${name}`);
  return object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
};

describe('Earth ephemeris', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/sky-reference.json', import.meta.url), 'utf8'),
  ) as {
    cases: {
      date: string;
      latitude: number;
      longitude: number;
      sun: { altitudeDeg: number; azimuthDeg: number };
      moon: { altitudeDeg: number; azimuthDeg: number };
    }[];
  };
  for (const sample of fixture.cases)
    it(`matches independent reference at ${sample.date}, ${sample.latitude}°`, () => {
      const state = evaluateEarthSky(Date.parse(sample.date), sample);
      for (const name of ['sun', 'moon'] as const) {
        const { altitudeDeg: alt, azimuthDeg: az } = sample[name];
        const reference: Vec3 = [
          Math.cos(alt * radians) * Math.sin(az * radians),
          Math.sin(alt * radians),
          -Math.cos(alt * radians) * Math.cos(az * radians),
        ];
        expect(angle(state[name].direction, reference), name).toBeLessThan(
          name === 'sun' ? 0.03 : 0.15,
        );
        expect(Math.hypot(...state[name].direction)).toBeCloseTo(1, 12);
      }
    });

  it('handles frozen, accelerated, reverse and directly sought clocks', () => {
    expect(skyTimeMs({ epochMs: time, scale: 0 }, 1234)).toBe(time);
    expect(skyTimeMs({ epochMs: time, scale: 3600 }, 24)).toBe(time + 86400000);
    expect(skyTimeMs({ epochMs: time, scale: -1 }, 60)).toBe(time - 60000);
    expect(() => skyTimeMs({ epochMs: Number.NaN })).toThrow(/finite/);
    expect(() => skyTimeMs({ epochMs: time }, Infinity)).toThrow(/finite/);
    expect(() => evaluateEarthSky(0, { latitude: 91, longitude: 0 })).toThrow(/observer/);
    expect(() => evaluateEarthSky(Date.parse('2200-01-01'), earth.observer)).toThrow(/1900/);
  });

  it('puts dawn in the east, dusk in the west, and supports polar day/night', () => {
    const morning = evaluateEarthSky(Date.parse('2024-03-20T06:00:00Z'), earth.observer);
    const evening = evaluateEarthSky(Date.parse('2024-03-20T18:00:00Z'), earth.observer);
    expect(morning.sun.direction[0]).toBeGreaterThan(0.99);
    expect(evening.sun.direction[0]).toBeLessThan(-0.99);
    for (const latitude of [-90, 90]) {
      const summer = evaluateEarthSky(Date.parse('2024-06-21T00:00:00Z'), {
        latitude,
        longitude: 0,
      });
      const winter = evaluateEarthSky(Date.parse('2024-12-21T00:00:00Z'), {
        latitude,
        longitude: 0,
      });
      expect(summer.sun.altitudeDeg * Math.sign(latitude)).toBeGreaterThan(23);
      expect(winter.sun.altitudeDeg * Math.sign(latitude)).toBeLessThan(-23);
    }
  });

  it('tracks new/full/quarter moon and distance-dependent disk size', () => {
    const fresh = evaluateEarthSky(Date.parse('2024-04-08T18:00:00Z'), earth.observer);
    const full = evaluateEarthSky(Date.parse('2024-03-25T07:00:00Z'), earth.observer);
    const quarter = evaluateEarthSky(Date.parse('2024-04-15T19:00:00Z'), earth.observer);
    expect(fresh.moon.illuminatedFraction).toBeLessThan(0.002);
    expect(full.moon.illuminatedFraction).toBeGreaterThan(0.998);
    expect(quarter.moon.illuminatedFraction).toBeCloseTo(0.5, 1);
    expect(quarter.moon.phase).toBeCloseTo(0.25, 2);
    expect(fresh.moon.angularDiameterDeg).toBeGreaterThan(full.moon.angularDiameterDeg);
  });

  it('rotates north consistently and aligns the catalog pole with observer latitude', () => {
    const state = evaluateEarthSky(Date.parse('2000-01-01T12:00:00Z'), {
      latitude: 37,
      longitude: -122,
    });
    const pole = starDirection(0, 90, state);
    expect(Math.asin(pole[1]) / radians).toBeCloseTo(37, 8);
    expect(pole[2]).toBeLessThan(0);
    const turned = evaluateEarthSky(state.utcMs, {
      latitude: 37,
      longitude: -122,
      northOffsetDeg: 90,
    });
    const shiftedPole = starDirection(0, 90, turned);
    expect(shiftedPole[0]).toBeCloseTo(-pole[2], 8);
    expect(turned.sun.direction[1]).toBeCloseTo(state.sun.direction[1], 12);
    expect(turned.sun.direction[0]).toBeCloseTo(-state.sun.direction[2], 12);
  });
});

describe('generic sky and lighting', () => {
  it('moves the observer at a frozen instant without replacing render resources', () => {
    const sky = new SkyVisual(earth);
    const stars = sky.scene.getObjectByName('molen:sky-stars');
    const before = sky.frame.sunDirection;
    sky.setObserver({ latitude: 47, longitude: -122, elevation: 1000 });
    const after = sky.update(0);
    expect(after.sunDirection).not.toEqual(before);
    expect(after.earth).toEqual(
      evaluateEarthSky(time, { latitude: 47, longitude: -122, elevation: 1000 }),
    );
    expect(sky.scene.getObjectByName('molen:sky-stars')).toBe(stars);
    expect(() => sky.setObserver({ latitude: 91, longitude: 0 })).toThrow();
    sky.dispose();
  });
  it('fades stars and sunlight across a day, and seeking is path-independent', () => {
    const sky = new SkyVisual(earth);
    expect(sky.frame.daylight).toBe(1);
    expect(sky.frame.starVisibility).toBe(0);
    expect(sky.sunLight.intensity).toBeGreaterThan(2.9);
    const midnight = sky.update(43200);
    expect(midnight.daylight).toBe(0);
    expect(midnight.starVisibility).toBeGreaterThan(0.3);
    expect(sky.sunLight.intensity).toBe(0);
    sky.update(10.4);
    expect(sky.update(43200)).toEqual(midnight);
    expect(sky.update(43200.9)).toEqual(midnight);
    sky.dispose();
  });

  it('redraws the dome and stars once the sky has moved enough to show, or on demand', () => {
    const sky = new SkyVisual(earth, {
      stars: [
        { direction: [0, 1, 0], magnitude: 1 },
        { direction: [0.6, 0.8, 0], magnitude: 2 },
      ],
    });
    const dome = sky.scene.getObjectByName('molen:sky-dome') as THREE.Mesh;
    const stars = sky.scene.getObjectByName('molen:sky-stars') as THREE.Points;
    const versions = () => [
      dome.geometry.getAttribute('color').version,
      stars.geometry.getAttribute('position').version,
    ];
    sky.update(43200);
    const midnight = versions();
    // A second of sky motion is far below a pixel.
    sky.update(43201);
    expect(versions()).toEqual(midnight);
    // Ten minutes is not.
    sky.update(43800);
    const later = versions();
    expect(later[0]).toBeGreaterThan(midnight[0] as number);
    expect(later[1]).toBeGreaterThan(midnight[1] as number);
    // A new observer redraws at once.
    sky.setObserver({ latitude: 10, longitude: 20 });
    sky.update(43801);
    expect(versions()[0]).toBeGreaterThan(later[0] as number);
    sky.dispose();
  });

  it('provides authored bodies and custom stars without Earth time or location', () => {
    const sky = new SkyVisual(
      {
        mode: 'custom',
        sunBody: { direction: [-1, -1, 0] },
        moonBody: { direction: [1, 1, 0], angularDiameterDeg: 6 },
        palette: { nightZenith: '#180428' },
      },
      { stars: [{ direction: [0, 1, 0], magnitude: 1 }] },
    );
    expect(sky.frame.earth).toBeUndefined();
    expect(sky.frame.moonIllumination).toBeCloseTo(1);
    expect(sky.moonLight.intensity).toBeCloseTo(0.12);
    expect(sky.scene.getObjectByName('molen:sky-stars')).toBeDefined();
    expect(() => new SkyVisual({ mode: 'custom', sunBody: { direction: [0, 0, 0] } })).toThrow(
      /nonzero/,
    );
    sky.dispose();
  });

  it('draws the sky behind the Moon so an unlit Moon matches the dome in every direction', () => {
    const elevation = 8 * radians;
    for (let i = 0; i < 8; i++) {
      const azimuth = (i * Math.PI) / 4;
      // A black Moon reflects nothing, leaving only the sky color. The low Sun makes the dome
      // differ with azimuth, so a sample from the wrong side of the sky cannot pass.
      const direction: Vec3 = [
        Math.cos(azimuth) * Math.cos(elevation),
        Math.sin(elevation),
        Math.sin(azimuth) * Math.cos(elevation),
      ];
      const sky = new SkyVisual({
        mode: 'custom',
        sunBody: { direction: [1, 0.035, 0] },
        moonBody: { direction },
        palette: { moon: '#000000' },
      });
      const dome = meshNamed(sky, 'molen:sky-dome');
      const domePositions = dome.geometry.getAttribute('position');
      const domeColors = dome.geometry.getAttribute('color');
      const toward = new THREE.Vector3(...direction);
      const vertex = new THREE.Vector3();
      let nearest = 0;
      let closest = -2;
      for (let v = 0; v < domePositions.count; v++) {
        const dot = vertex.fromBufferAttribute(domePositions, v).normalize().dot(toward);
        if (dot > closest) {
          closest = dot;
          nearest = v;
        }
      }
      const colors = meshNamed(sky, 'molen:sky-moon').geometry.getAttribute('color');
      for (let v = 0; v < colors.count; v++) {
        expect(Math.abs(colors.getX(v) - domeColors.getX(nearest))).toBeLessThan(0.03);
        expect(Math.abs(colors.getY(v) - domeColors.getY(nearest))).toBeLessThan(0.03);
        expect(Math.abs(colors.getZ(v) - domeColors.getZ(nearest))).toBeLessThan(0.03);
      }
      sky.dispose();
    }
  });

  it('hides the dark side of the Moon by day, keeps it opaque, and shows earthshine at night', () => {
    const darkSide = (sunDirection: Vec3): { lift: number; alpha: number; lit: number } => {
      const sky = new SkyVisual({
        mode: 'custom',
        sunBody: { direction: sunDirection },
        moonBody: { direction: [0, 1, 0] },
        moon: { earthshine: 0.5 },
      });
      const moon = meshNamed(sky, 'molen:sky-moon');
      const positions = moon.geometry.getAttribute('position');
      const colors = moon.geometry.getAttribute('color');
      const toSun = new THREE.Vector3(...sunDirection).normalize();
      const normal = new THREE.Vector3();
      // The Moon sits at the zenith, where the first dome vertex is.
      const zenith = meshNamed(sky, 'molen:sky-dome').geometry.getAttribute('color').getZ(0);
      const result = { lift: 0, alpha: 1, lit: 0 };
      for (let v = 0; v < positions.count; v++) {
        normal.fromBufferAttribute(positions, v).normalize();
        // The camera sees the hemisphere facing it, which points down from the zenith.
        if (normal.y > 0) continue;
        const lift = colors.getZ(v) - zenith;
        if (normal.dot(toSun) < -0.05) {
          result.lift = Math.max(result.lift, lift);
          result.alpha = Math.min(result.alpha, colors.getW(v));
        } else result.lit = Math.max(result.lit, lift);
      }
      sky.dispose();
      return result;
    };
    // The Sun 28° from the Moon: a thin crescent in full daylight.
    const day = darkSide([Math.sin(28 * radians), Math.cos(28 * radians), 0]);
    expect(day.lift).toBeLessThan(0.03);
    expect(day.alpha).toBe(1);
    expect(day.lit).toBeGreaterThan(0.25);
    // The Sun well below the horizon, with part of the Moon still turned away from it.
    expect(darkSide([1, -0.6, 0]).lift).toBeGreaterThan(0.3);
  });

  it('surrounds a visible Sun with glare that fades to nothing at its rim', () => {
    const sky = new SkyVisual(earth);
    const glare = meshNamed(sky, 'molen:sky-sun-glare');
    expect(glare.visible).toBe(true);
    expect(glare.material.blending).toBe(THREE.AdditiveBlending);
    // Over the disk, so the disk is not dimmer than its own glare, and under the Moon.
    expect(glare.renderOrder).toBeGreaterThan(meshNamed(sky, 'molen:sky-sun').renderOrder);
    expect(glare.renderOrder).toBeLessThan(meshNamed(sky, 'molen:sky-moon').renderOrder);
    expect(glare.position.toArray()).toEqual(sky.frame.sunDirection);
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(glare.quaternion);
    expect(facing.distanceTo(new THREE.Vector3(...sky.frame.sunDirection))).toBeLessThan(1e-9);

    const positions = glare.geometry.getAttribute('position');
    const colors = glare.geometry.getAttribute('color');
    const profile = Array.from({ length: positions.count }, (_, v) => ({
      radius: Math.hypot(positions.getX(v), positions.getY(v)),
      alpha: colors.getW(v),
    })).sort((a, b) => a.radius - b.radius);
    for (const [i, sample] of profile.entries()) {
      if (i > 0) expect(sample.alpha).toBeLessThanOrEqual((profile[i - 1]?.alpha ?? 0) + 1e-6);
    }
    expect(profile[0]).toEqual({ radius: 0, alpha: 1 });
    expect(profile.at(-1)?.radius).toBeCloseTo(1, 6);
    expect(profile.at(-1)?.alpha).toBeCloseTo(0, 6);

    const doubled = new SkyVisual({ ...earth, sun: { size: 2 } });
    expect(meshNamed(doubled, 'molen:sky-sun-glare').scale.x).toBeCloseTo(glare.scale.x * 2, 5);
    doubled.dispose();
    const hidden = new SkyVisual({ ...earth, sun: { visible: false } });
    expect(meshNamed(hidden, 'molen:sky-sun-glare').visible).toBe(false);
    hidden.dispose();

    sky.update(43200);
    expect(glare.visible).toBe(false);
    sky.dispose();
  });

  it('keeps the background centered and lighting stable through large translations and ortho views', () => {
    const sky = new SkyVisual(earth, { shadows: 'medium' });
    const camera = new THREE.PerspectiveCamera(70, 2, 1, 500000);
    camera.position.set(1000000, 5000, -1000000);
    camera.lookAt(1000000, 5000, -1000100);
    sky.prepareCamera(camera);
    expect(sky.camera.position.toArray()).toEqual([0, 0, 0]);
    expect(sky.camera.far).toBe(10);
    expect(sky.camera.fov).toBe(70);
    expect(
      sky.sunLight.position.clone().sub(sky.sunLight.target.position).normalize().toArray(),
    ).toEqual(expect.arrayContaining(sky.frame.sunDirection.map((v) => expect.closeTo(v, 8))));
    expect(sky.sunLight.castShadow).toBe(true);
    expect(sky.sunLight.shadow.mapSize.x).toBe(2048);
    sky.prepareCamera(new THREE.OrthographicCamera(-20, 20, 10, -10));
    expect(sky.camera.aspect).toBe(2);
    sky.dispose();
  });

  it('disposes owned geometry, materials and lights exactly once', () => {
    const sky = new SkyVisual(earth);
    const dispose = vi.fn();
    sky.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.addEventListener('dispose', dispose);
        object.material.addEventListener('dispose', dispose);
      }
    });
    sky.sunLight.addEventListener('dispose', dispose);
    const parent = new THREE.Scene();
    parent.add(sky.lights);
    sky.dispose();
    sky.dispose();
    expect(dispose).toHaveBeenCalledTimes(11);
    expect(parent.children).toHaveLength(0);
    expect(() => sky.update(1)).toThrow(/disposed/);
  });
});
