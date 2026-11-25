import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ModelLibrary, type PreparedModel } from '../../src/client/instanced-models';
import { SCATTER_CANOPY_ATTRIBUTE } from '../../src/client/scatter-material';
import { createTurf, type TurfObject, type TurfSource, turfReach } from '../../src/client/turf';
import { createTuftGeometry, type TuftLevel } from '../../src/client/turf-geometry';
import { TURF_TUFT_MODEL } from '../../src/client/vegetation';
import { sampleTurfCover } from '../../src/kernel/turf';
import type { TurfCover, TurfRequest, Vec2 } from '../../src/kernel/types';

function model(ref: string, level: TuftLevel): PreparedModel {
  const geometry = createTuftGeometry(level);
  return {
    ref,
    geometry,
    material: new THREE.MeshStandardMaterial(),
    bounds: (geometry.boundingBox as THREE.Box3).clone(),
    builtin: true,
  };
}
const near = model('near', 0),
  middle = model('middle', 1),
  far = model('far', 2);

function rect(x0: number, z0: number, x1: number, z1: number): Vec2[] {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

const SIZE = 256;
const LAWN = { label: 'lawn', height: 0.3, density: 2 };
const MEADOW = { label: 'meadow', height: 0.45, density: 1 };

/** A cover over [x0, x0 + SIZE) x [0, SIZE) from a turf request in that frame. */
function cover(turf: TurfRequest, x0 = 0): TurfCover {
  return sampleTurfCover(
    {
      polygons: [],
      exclusions: [],
      emitBounds: [x0, 0, x0 + SIZE, SIZE],
      frame: { originX: 0, originZ: 0, unitsPerMeter: 1 },
      keep: 1,
      turf,
    },
    SIZE * SIZE,
  ) as TurfCover;
}

/** Lawn all over, but for a road along z = 128 (6 m either side) and a meadow east of x = 192. */
const field = cover({
  swards: [LAWN, MEADOW],
  ground: [
    { ring: rect(0, 0, SIZE, SIZE), sward: 0 },
    { ring: rect(192, 0, SIZE, SIZE), sward: 1 },
  ],
  clear: [
    {
      polyline: [
        [0, 128],
        [SIZE, 128],
      ],
      width: 12,
      radius: 0,
    },
  ],
});

/** Sloping ground: 10 m at x = 0, rising a meter every ten along x. */
const ground = (x: number): number => 10 + x / 10;
const source: TurfSource = {
  near,
  middle,
  far,
  ground: (x) => ground(x),
  color: (label, _x, _z, out) =>
    label === 'lawn' ? out.setRGB(0.2, 0.3, 0.1) : out.setRGB(0.3, 0.3, 0.1),
};

interface Tuft {
  position: THREE.Vector3;
  height: number;
  spread: number;
  color: THREE.Color;
  band: 'near' | 'middle' | 'far';
}

/** Every tuft drawn, at its position in the object's frame. */
function drawn(object: TurfObject): Tuft[] {
  const out: Tuft[] = [];
  const matrix = new THREE.Matrix4();
  for (const child of object.children) {
    const batch = child as THREE.InstancedMesh;
    if (!batch.isInstancedMesh || !batch.visible) continue;
    const geometry =
      (batch as THREE.InstancedMesh & { sourceGeometry?: THREE.BufferGeometry }).sourceGeometry ??
      batch.geometry;
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix);
      const scale = new THREE.Vector3().setFromMatrixScale(matrix);
      const color = new THREE.Color();
      batch.getColorAt(i, color);
      out.push({
        position: new THREE.Vector3().setFromMatrixPosition(matrix).add(batch.position),
        height: scale.y,
        spread: scale.x,
        color,
        band: geometry === near.geometry ? 'near' : geometry === middle.geometry ? 'middle' : 'far',
      });
    }
  }
  return out;
}

function perspective(x: number, y: number, z: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  camera.position.set(x, y, z);
  camera.updateMatrixWorld();
  return camera;
}

const key = (tuft: Tuft): string => `${tuft.position.x.toFixed(3)},${tuft.position.z.toFixed(3)}`;

describe('turf', () => {
  const options = { full: 30, radius: 60, shrink: 5, detail: 8, plain: 25, step: 2 };

  it('stands tufts on the grass round the camera, on the ground, in its color', () => {
    const object = createTurf(field, source, options, 'turf-test');
    object.updateMatrixWorld(true);
    // Two meters over the lawn, 60 m north of the road.
    const camera = new THREE.Vector3(100, ground(100) + 2, 68);
    object.choose(camera);
    const tufts = drawn(object);
    expect(object.drawn).toBe(tufts.length);
    expect(tufts.length).toBeGreaterThan(1000);
    for (const tuft of tufts) {
      const { x, z } = tuft.position;
      // Rooted in the ground, a little below its surface.
      expect(tuft.position.y).toBeGreaterThan(ground(x) - 0.05);
      expect(tuft.position.y).toBeLessThanOrEqual(ground(x));
      // Never on the road, and none past the reach.
      expect(Math.abs(z - 128)).toBeGreaterThan(5.4);
      const distance = tuft.position.distanceTo(camera);
      expect(distance).toBeLessThan(options.radius);
      expect(tuft.band).toBe(
        distance < options.detail ? 'near' : distance < options.plain ? 'middle' : 'far',
      );
      // The lawn's color, each tuft a little off it.
      expect(tuft.color.g / 0.3).toBeGreaterThan(0.8);
      expect(tuft.color.g / 0.3).toBeLessThan(1.2);
      expect(tuft.color.g).toBeGreaterThan(tuft.color.r);
      // A tuft of that sward: its height round the sward's, and about as wide as tall.
      if (distance < options.full - options.shrink) {
        expect(tuft.height).toBeGreaterThan(LAWN.height * 0.6);
        expect(tuft.height).toBeLessThan(LAWN.height * 1.9);
        expect(tuft.spread).toBeGreaterThan(tuft.height * 0.5);
        expect(tuft.spread).toBeLessThan(tuft.height * 2.5);
      }
    }
    // Within `full` every tuft stands: the sward's two a square meter.
    const close = tufts.filter((tuft) => tuft.position.distanceTo(camera) < 20);
    const disc = (Math.PI * (20 * 20 - 2 * 2) * 2) / 1;
    expect(close.length).toBeGreaterThan(disc * 0.85);
    expect(close.length).toBeLessThan(disc * 1.15);
    // Past it they thin: fewer a square meter in the outer ring than in the inner one.
    const ring = (from: number, to: number): number =>
      tufts.filter((tuft) => {
        const d = Math.hypot(tuft.position.x - camera.x, tuft.position.z - camera.z);
        return d >= from && d < to && tuft.position.z < 120;
      }).length /
      (to * to - from * from);
    expect(ring(30, 40)).toBeLessThan(ring(10, 20));
    expect(ring(50, 60)).toBeLessThan(ring(30, 40));
    expect(ring(50, 60)).toBeGreaterThan(0);
    // The batches cast no shadows and stay out of walk collision; bounds hold every tuft.
    for (const child of object.children) {
      const batch = child as THREE.InstancedMesh;
      expect(batch.castShadow).toBe(false);
      expect(batch.userData.shadowCaster).toBe(false);
      expect(batch.userData.walkIgnore).toBe(true);
      if (!batch.visible) continue;
      const box = (batch.boundingBox as THREE.Box3).clone().translate(batch.position);
      for (const tuft of tufts.slice(0, 200)) expect(box.containsPoint(tuft.position)).toBe(true);
    }
    // The same camera chooses the same tufts, after going away and coming back too.
    object.choose(new THREE.Vector3(100, ground(100) + 2, 250));
    object.choose(camera);
    expect(drawn(object).map(key).sort()).toEqual(tufts.map(key).sort());
    object.dispose();
  });

  it('gives each sward its own density, height and reach', () => {
    const object = createTurf(field, source, { ...options, full: 20, radius: 60 });
    // On the seam between the lawn (x < 192) and the meadow.
    const camera = new THREE.Vector3(192, ground(192) + 2, 60);
    object.choose(camera);
    const tufts = drawn(object);
    const within = (list: Tuft[], radius: number): Tuft[] =>
      list.filter((tuft) => tuft.position.distanceTo(camera) < radius);
    const lawn = tufts.filter((tuft) => tuft.position.x < 192),
      meadow = tufts.filter((tuft) => tuft.position.x >= 192);
    // Half a 15 m disc each: two a square meter of lawn, one of meadow.
    const half = (Math.PI * 15 * 15) / 2;
    expect(within(lawn, 15).length / half).toBeGreaterThan(1.7);
    expect(within(lawn, 15).length / half).toBeLessThan(2.3);
    expect(within(meadow, 15).length / half).toBeGreaterThan(0.8);
    expect(within(meadow, 15).length / half).toBeLessThan(1.2);
    const mean = (list: Tuft[]): number =>
      list.reduce((sum, tuft) => sum + tuft.height, 0) / Math.max(1, list.length);
    expect(mean(within(meadow, 12))).toBeGreaterThan(mean(within(lawn, 12)) * 1.25);
    // The meadow's own ground color.
    for (const tuft of meadow.slice(0, 50))
      expect(tuft.color.r / tuft.color.g).toBeGreaterThan(0.8);
    object.dispose();
  });

  it('keeps a tuft in its place whichever cover draws it', () => {
    // The same lawn as two covers side by side, each anchored where it lies in the world.
    const lawn = (x0: number): TurfRequest => ({
      swards: [LAWN],
      ground: [{ ring: rect(x0, 0, x0 + SIZE, SIZE), sward: 0 }],
      clear: [],
    });
    const whole = createTurf(cover(lawn(0)), source, options);
    // The second cover's frame starts at its own corner: world x = local x + 1000.
    const shifted = createTurf(
      cover(lawn(-1000), -1000),
      { ...source, ground: (x) => ground(x + 1000), anchor: [1000, 0] },
      options,
    );
    whole.choose(new THREE.Vector3(120, ground(120) + 2, 100));
    shifted.choose(new THREE.Vector3(120 - 1000, ground(120) + 2, 100));
    // In the world's frame, in one order: the two differ only by what a float keeps of a
    // coordinate a thousand meters from its origin.
    const world = (object: TurfObject, shift: number): [number, number][] =>
      drawn(object)
        .map((tuft): [number, number] => [tuft.position.x + shift, tuft.position.z])
        .sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    const a = world(whole, 0),
      b = world(shifted, 1000);
    expect(a.length).toBeGreaterThan(1000);
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i]?.[0]).toBeCloseTo(a[i]?.[0] as number, 2);
      expect(b[i]?.[1]).toBeCloseTo(a[i]?.[1] as number, 2);
    }
    whole.dispose();
    shifted.dispose();
  });

  it('chooses again only once the view camera has moved a step, and never for a shadow camera', () => {
    const object = createTurf(field, source, options);
    object.updateMatrixWorld(true);
    object.update(perspective(100, ground(100) + 2, 60));
    const first = drawn(object).map(key).sort();
    expect(first.length).toBeGreaterThan(0);
    const sun = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    sun.position.set(0, 50, 0);
    sun.updateMatrixWorld();
    object.update(sun);
    expect(drawn(object).map(key).sort()).toEqual(first);
    object.update(perspective(101, ground(100) + 2, 60));
    expect(drawn(object).map(key).sort()).toEqual(first);
    object.update(perspective(130, ground(130) + 2, 60));
    const moved = drawn(object);
    expect(Math.max(...moved.map((tuft) => tuft.position.x))).toBeGreaterThan(
      Math.max(...first.map((entry) => Number(entry.split(',')[0]))),
    );
    // The object's own frame: a cover moved by a floating origin moves its camera with it.
    object.position.set(5000, 0, 0);
    object.updateMatrixWorld(true);
    object.update(perspective(5100, ground(100) + 2, 60));
    expect(drawn(object).map(key).sort()).toEqual(first);
    object.dispose();
  });

  it('draws nothing out of reach, high above the ground, or where no grass grows', () => {
    const object = createTurf(field, source, options);
    object.choose(new THREE.Vector3(-200, 12, 60));
    expect(object.drawn).toBe(0);
    expect(object.children.every((child) => !child.visible)).toBe(true);
    object.choose(new THREE.Vector3(100, ground(100) + 300, 60));
    expect(object.drawn).toBe(0);
    // Standing on the road: grass to either side, none within its width.
    object.choose(new THREE.Vector3(100, ground(100) + 1.7, 128));
    expect(object.drawn).toBeGreaterThan(0);
    for (const tuft of drawn(object)) expect(Math.abs(tuft.position.z - 128)).toBeGreaterThan(5.4);
    // Given the highest ground under the cover, a camera above its reach never asks for the
    // ground at all; one within reach of it is answered as before.
    let asked = 0;
    const topped = createTurf(
      field,
      {
        ...source,
        ground: (x) => {
          asked++;
          return ground(x);
        },
        top: () => ground(SIZE),
      },
      options,
    );
    topped.choose(new THREE.Vector3(100, ground(SIZE) + options.radius + 1, 60));
    expect(topped.drawn).toBe(0);
    expect(asked).toBe(0);
    topped.choose(new THREE.Vector3(100, ground(100) + 2, 60));
    object.choose(new THREE.Vector3(100, ground(100) + 2, 60));
    expect(topped.drawn).toBe(object.drawn);
    expect(asked).toBeGreaterThan(0);
    topped.dispose();
    // A density of zero is no turf at all.
    const none = createTurf(field, source, { ...options, density: 0 });
    none.choose(new THREE.Vector3(100, ground(100) + 2, 60));
    expect(none.drawn).toBe(0);
    // Fewer, not smaller, tufts at a lower density.
    const thin = createTurf(field, source, { ...options, density: 0.5 });
    thin.choose(new THREE.Vector3(100, ground(100) + 2, 60));
    object.choose(new THREE.Vector3(100, ground(100) + 2, 60));
    expect(thin.drawn / object.drawn).toBeGreaterThan(0.4);
    expect(thin.drawn / object.drawn).toBeLessThan(0.6);
    object.dispose();
    none.dispose();
    thin.dispose();
  });

  it('reaches as its options say', () => {
    expect(turfReach()).toEqual({ full: 28, radius: 68, shrink: 8 });
    expect(turfReach({ full: 90, radius: 50, shrink: 0 })).toEqual({
      full: 50,
      radius: 50,
      shrink: 0.01,
    });
  });
});

describe('the tuft model', () => {
  it('is blades fanned from one root, a unit tall and a unit across, plainer at each level', () => {
    for (const level of [0, 1, 2] as const) {
      const geometry = createTuftGeometry(level);
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const color = geometry.getAttribute('color');
      expect(position.count / 3).toBe([132, 28, 14][level]);
      const box = geometry.boundingBox as THREE.Box3;
      expect(box.max.y).toBeCloseTo(1, 5);
      expect(box.min.y).toBeLessThan(0);
      expect(Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z)).toBeLessThan(1.4);
      let tips = 0;
      for (let i = 0; i < position.count; i++) {
        // Lit from above on both faces of a blade, and paler toward its tip.
        expect(normal.getY(i)).toBeGreaterThan(0.85);
        if (position.getY(i) > 0.45 && color.getX(i) > color.getZ(i) * 1.2) tips++;
      }
      expect(tips).toBeGreaterThan(0);
      // Every face has its twin wound the other way, so a blade shows from both sides.
      const faces = new Map<string, number>();
      for (let i = 0; i < position.count; i += 3) {
        const corners = [0, 1, 2]
          .map((k) =>
            [position.getX(i + k), position.getY(i + k), position.getZ(i + k)]
              .map((value) => value.toFixed(4))
              .join(','),
          )
          .sort()
          .join('|');
        faces.set(corners, (faces.get(corners) ?? 0) + 1);
      }
      expect([...faces.values()].every((count) => count === 2)).toBe(true);
    }
  });

  it('is a library builtin with a near, a middle and a far level', async () => {
    const library = new ModelLibrary();
    const close = await library.prepare(TURF_TUFT_MODEL, false);
    const plain = await library.prepare(TURF_TUFT_MODEL, true);
    const distant = await library.prepare(TURF_TUFT_MODEL, 'distant');
    expect(close.geometry.getAttribute('position').count).toBe(396);
    expect(plain.geometry.getAttribute('position').count).toBe(84);
    expect(distant.geometry.getAttribute('position').count).toBe(42);
    // No level of its own past the far one.
    expect((await library.prepare(TURF_TUFT_MODEL, 'horizon')).geometry).toBe(distant.geometry);
    expect(close.material).toBe(plain.material);
    // A plant open to the sky from root to tip: the blades' own colors shade it.
    const canopy = close.geometry.getAttribute(SCATTER_CANOPY_ATTRIBUTE);
    const position = close.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) expect(canopy.getX(i)).toBe(2);
    expect(close.geometry.getAttribute('uv')).toBeDefined();
    library.dispose();
  });
});
