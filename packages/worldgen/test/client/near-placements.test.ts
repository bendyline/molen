import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { PreparedModel } from '../../src/client/instanced-models';
import {
  createNearPlacements,
  type NearPlacementObject,
  nearPlacementReach,
} from '../../src/client/near-placements';
import { type NearPlacements, PLACEMENT_STRIDE } from '../../src/kernel/types';

function model(ref: string): PreparedModel {
  const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  geometry.computeBoundingBox();
  return {
    ref,
    geometry,
    material: new THREE.MeshStandardMaterial(),
    bounds: (geometry.boundingBox as THREE.Box3).clone(),
    builtin: true,
  };
}

const CELL = 32;

/**
 * Placements at `points` (x, z) over a grid of 8 x 8 cells, alternating models a and b, with
 * each plant's reach byte from `reachOf` when given.
 */
function placements(
  points: readonly (readonly [number, number])[],
  reachOf?: (x: number, z: number) => number,
): NearPlacements {
  const columns = 8,
    rows = 8;
  const cellOf = ([x, z]: readonly [number, number]) =>
    Math.floor(z / CELL) * columns + Math.floor(x / CELL);
  const ordered = points
    .map((point, index) => ({ point, index, cell: cellOf(point) }))
    .sort((p, q) => p.cell - q.cell || p.index - q.index);
  const data = new Float32Array(ordered.length * PLACEMENT_STRIDE);
  const model = new Uint16Array(ordered.length);
  const start = new Uint32Array(columns * rows + 1);
  const reach = reachOf !== undefined ? new Uint8Array(ordered.length) : undefined;
  ordered.forEach(({ point: [x, z], index, cell }, k) => {
    data.set([x, 10, z, 0.5, 2, 3, 2, 0.5, 0.6, 0.4], k * PLACEMENT_STRIDE);
    model[k] = index % 2;
    if (reach !== undefined && reachOf !== undefined) reach[k] = reachOf(x, z);
    start[cell + 1] = (start[cell + 1] as number) + 1;
  });
  for (let k = 0; k < columns * rows; k++)
    start[k + 1] = (start[k + 1] as number) + (start[k] as number);
  return {
    models: ['a', 'b'],
    count: ordered.length,
    data,
    model,
    ...(reach !== undefined ? { reach } : {}),
    cell: CELL,
    originX: 0,
    originZ: 0,
    columns,
    rows,
    start,
  };
}

/** A plant every 4 m over the whole 256 m grid. */
function lattice(): (readonly [number, number])[] {
  const points: [number, number][] = [];
  for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) points.push([i * 4 + 2, j * 4 + 2]);
  return points;
}

const levels = new Map([
  ['a', { near: model('a:near'), medium: model('a:medium') }],
  ['b', { near: model('b:near'), medium: model('b:medium') }],
]);

interface Drawn {
  position: THREE.Vector3;
  scale: number;
  band: 'near' | 'medium';
}

/** Every instance drawn, at its position in the object's frame. */
function drawn(object: NearPlacementObject): Drawn[] {
  const out: Drawn[] = [];
  const matrix = new THREE.Matrix4();
  for (const child of object.children) {
    const batch = child as THREE.InstancedMesh;
    if (!batch.isInstancedMesh || !batch.visible) continue;
    const source =
      (batch as THREE.InstancedMesh & { sourceGeometry?: THREE.BufferGeometry }).sourceGeometry ??
      batch.geometry;
    const band = [...levels.values()].some((level) => level.near.geometry === source)
      ? 'near'
      : 'medium';
    for (let i = 0; i < batch.count; i++) {
      batch.getMatrixAt(i, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix).add(batch.position);
      out.push({ position, scale: new THREE.Vector3().setFromMatrixScale(matrix).y / 3, band });
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

describe('near placements', () => {
  const options = { full: 40, radius: 100, shrink: 5, detail: 20, step: 2 };

  it('stands every plant within reach, thins them out to the radius and none beyond', () => {
    const near = placements(lattice());
    const object = createNearPlacements(near, levels, options, 'near-test');
    object.updateMatrixWorld(true);
    const camera = new THREE.Vector3(128, 11, 128);
    object.choose(camera);
    const plants = drawn(object);
    expect(object.drawn).toBe(plants.length);
    const within = (radius: number) =>
      lattice().filter(([x, z]) => Math.hypot(x - 128, 10 - 11, z - 128) < radius).length;
    const keys = new Set(plants.map((plant) => `${plant.position.x},${plant.position.z}`));
    // Every plant within `full` stands, at full size; none past the radius.
    for (const [x, z] of lattice()) {
      const distance = Math.hypot(x - 128, 1, z - 128);
      if (distance < options.full) expect(keys.has(`${x},${z}`)).toBe(true);
      if (distance >= options.radius) expect(keys.has(`${x},${z}`)).toBe(false);
    }
    for (const plant of plants) {
      const distance = plant.position.distanceTo(camera);
      expect(distance).toBeLessThan(options.radius);
      if (distance < options.full - options.shrink) expect(plant.scale).toBeCloseTo(1, 5);
      expect(plant.band).toBe(distance < options.detail ? 'near' : 'medium');
      expect(plant.position.y).toBeCloseTo(10, 5);
    }
    // Thinned between `full` and the radius: about half of that ring stands.
    const ring = within(options.radius) - within(options.full);
    const standing = plants.filter((plant) => plant.position.distanceTo(camera) >= options.full);
    expect(standing.length).toBeGreaterThan(ring * 0.3);
    expect(standing.length).toBeLessThan(ring * 0.7);
    // Bounds hold every instance, so a batch is never culled while one of its plants is in view.
    for (const child of object.children) {
      const batch = child as THREE.InstancedMesh;
      if (!batch.visible) continue;
      const box = (batch.boundingBox as THREE.Box3).clone().translate(batch.position);
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < batch.count; i++) {
        batch.getMatrixAt(i, matrix);
        expect(
          box.containsPoint(new THREE.Vector3().setFromMatrixPosition(matrix).add(batch.position)),
        ).toBe(true);
      }
    }
    // The same camera chooses the same plants; returning after going away does too.
    object.choose(new THREE.Vector3(128, 11, 260));
    object.choose(camera);
    expect(drawn(object).map((plant) => plant.position.toArray())).toEqual(
      plants.map((plant) => plant.position.toArray()),
    );
    object.dispose();
  });

  it('chooses again only once the view camera has moved a step', () => {
    const object = createNearPlacements(placements(lattice()), levels, options);
    object.updateMatrixWorld(true);
    object.update(perspective(128, 11, 128));
    const first = drawn(object).length;
    expect(first).toBeGreaterThan(0);
    // A sun's shadow camera never chooses.
    const sun = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    sun.position.set(0, 50, 0);
    sun.updateMatrixWorld();
    object.update(sun);
    expect(drawn(object).length).toBe(first);
    // Under a step: the choice stands; past it, the plants follow the camera.
    object.update(perspective(129, 11, 128));
    const kept = drawn(object).map((plant) => plant.position.x);
    object.update(perspective(140, 11, 128));
    const moved = drawn(object).map((plant) => plant.position.x);
    expect(Math.max(...moved)).toBeGreaterThan(Math.max(...kept));
    // The object's own frame: a tile moved by a floating origin moves its camera with it.
    object.position.set(1000, 0, 0);
    object.updateMatrixWorld(true);
    object.update(perspective(1128, 11, 128));
    expect(Math.max(...drawn(object).map((plant) => plant.position.x))).toBeLessThan(240);
    object.dispose();
  });

  it('stands no plant on ground the host opens, asking again when its openings change', () => {
    // A cutting over x 100..140, z 100..160: opened once `bored`, below 12 m (plants stand at 10).
    let bored = false,
      version = 1,
      asked = 0;
    const inside = (x: number, z: number): boolean => x >= 100 && x < 140 && z >= 100 && z < 160;
    const object = createNearPlacements(placements(lattice()), levels, {
      ...options,
      open: {
        near: (x0, z0, x1, z1) => x0 < 140 && x1 > 100 && z0 < 160 && z1 > 100,
        at: (x, y, z) => {
          asked++;
          return bored && inside(x, z) && y < 12;
        },
        version: () => version,
      },
    });
    object.updateMatrixWorld(true);
    const camera = perspective(128, 11, 128);
    object.update(camera);
    const whole = drawn(object);
    expect(whole.filter(({ position: p }) => inside(p.x, p.z)).length).toBeGreaterThan(100);
    // Only the plants of cells that may open were asked about.
    const first = asked;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(lattice().length / 4);
    // The bore arrives but the host's version has not moved: nothing is asked or changes.
    bored = true;
    object.update(camera);
    expect(asked).toBe(first);
    expect(drawn(object)).toHaveLength(whole.length);
    // It moves: the cutting's plants go at once, though the camera stands still; the rest stay.
    version++;
    object.update(camera);
    const after = drawn(object);
    expect(after.some(({ position: p }) => inside(p.x, p.z))).toBe(false);
    const key = ({ position: p }: Drawn) => `${p.x},${p.z}`;
    expect(after.map(key).sort()).toEqual(
      whole
        .filter(({ position: p }) => !inside(p.x, p.z))
        .map(key)
        .sort(),
    );
    // And come back when the opening closes.
    bored = false;
    version++;
    object.update(camera);
    expect(drawn(object).map(key).sort()).toEqual(whole.map(key).sort());
    object.dispose();
  });

  it("thins each plant at its crown's reach, the one a ground painting the crowns reads", () => {
    // Plants west of x = 128 carry reach byte 0 (they stop at `full`), the rest 255 (they stand
    // out to the radius): exactly where a ground handed that reach paints their crowns again.
    const object = createNearPlacements(
      placements(lattice(), (x) => (x < 128 ? 0 : 255)),
      levels,
      options,
    );
    object.choose(new THREE.Vector3(128, 11, 128));
    const reachOf = (x: number) => (x < 128 ? options.full : options.radius);
    for (const plant of drawn(object)) {
      const distance = plant.position.distanceTo(new THREE.Vector3(128, 11, 128));
      expect(distance).toBeLessThan(reachOf(plant.position.x));
      expect(plant.scale).toBeCloseTo(
        Math.min(1, (reachOf(plant.position.x) - distance) / options.shrink),
        4,
      );
    }
    const keys = new Set(drawn(object).map((plant) => `${plant.position.x},${plant.position.z}`));
    for (const [x, z] of lattice())
      if (Math.hypot(x - 128, 1, z - 128) < reachOf(x) - 0.5)
        expect(keys.has(`${x},${z}`)).toBe(true);
    // The reach the ground takes for the same options.
    expect(nearPlacementReach(options)).toEqual({ full: 40, radius: 100, shrink: 5 });
    expect(nearPlacementReach()).toEqual({ full: 120, radius: 300, shrink: 12 });
    object.dispose();
  });

  it('draws nothing for a camera out of reach, across or above', () => {
    const object = createNearPlacements(placements(lattice()), levels, options);
    object.choose(new THREE.Vector3(-500, 11, 128));
    expect(object.drawn).toBe(0);
    expect(object.children.every((child) => !child.visible)).toBe(true);
    object.choose(new THREE.Vector3(128, 500, 128));
    expect(object.drawn).toBe(0);
    object.dispose();
  });

  it('grows a batch for a dense patch and keeps the shadow flags it was given', () => {
    // 400 plants in a 10 m square: far denser there than the grid's mean.
    const points: [number, number][] = [];
    for (let j = 0; j < 20; j++)
      for (let i = 0; i < 20; i++) points.push([100 + i / 2, 100 + j / 2]);
    const object = createNearPlacements(placements(points), levels, options);
    const before = object.children.length;
    for (const child of object.children) child.castShadow = false;
    object.choose(new THREE.Vector3(105, 11, 105));
    expect(object.drawn).toBe(400);
    expect(drawn(object)).toHaveLength(400);
    expect(object.children).toHaveLength(before);
    for (const child of object.children) expect(child.castShadow).toBe(false);
    for (const child of object.children) expect(child.userData.walkIgnore).toBe(true);
    object.dispose();
  });
});
