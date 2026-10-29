import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u0p/torre_dei_lamberti');
const path = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/u0/u0p/torre_dei_lamberti/asset.json'),
);
async function geometry(file) {
  const b = await readFile(file),
    g = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      '',
    );
  g.scene.updateMatrixWorld(true);
  return {
    bounds: new Box3().setFromObject(g.scene),
    hit(origin, direction) {
      return (
        new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(
          g.scene,
          true,
        )[0]?.distance ?? Infinity
      );
    },
  };
}
const rotate = (a, [x, y, z]) => [
  x * Math.cos(a) + z * Math.sin(a),
  y,
  -x * Math.sin(a) + z * Math.cos(a),
];

it('retains all twelve lower gallery bays, sixteen open belfry bays, their columns, four bells, clock and open terrace at every level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(84, 3);
    expect(g.bounds.max.x).toBeGreaterThan(5.21);
    expect(g.bounds.max.z).toBeGreaterThan(5.33);
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2,
        ray = (x, y) => g.hit(rotate(a, [x, y, 15]), rotate(a, [0, 0, -1]));
      for (const x of [-1.75, 0, 1.75])
        expect(ray(x, 59), `${name} trifora${side}/${x}`).toBeGreaterThan(17);
      for (const x of [-0.875, 0.875])
        expect(ray(x, 59), `${name} gallery column${side}/${x}`).toBeLessThan(10.7);
    }
    for (let side = 0; side < 8; side++) {
      const a = (side * Math.PI) / 4,
        ray = (x) => g.hit(rotate(a, [x, 72.7, 15]), rotate(a, [0, 0, -1]));
      for (const x of [-0.64, 0.64])
        expect(ray(x), `${name} belfry bay${side}/${x}`).toBeGreaterThan(11.5);
      expect(ray(0), `${name} belfry column${side}`).toBeLessThan(11.6);
    }
    for (const [x, z, y, r] of [
      [-1.15, 0, 74.1, 0.9155],
      [1.25, 0, 74.8, 0.65],
      [0, -1.6, 75.6, 0.54],
      [0, 1.6, 75.8, 0.41],
    ]) {
      const bell = g.hit([x, y + r * 0.5, z + 2 * r], [0, 0, -1]);
      expect(bell, `${name} independent bell${x}/${z}`).toBeGreaterThan(r * 0.5);
      expect(bell).toBeLessThan(r * 2.2);
    }
    expect(g.hit([3.1, 47.7, 15], [0, 0, -1]), `${name} southwest clock`).toBeLessThan(10.3);
    expect(g.hit([3.1, 47.7, -15], [0, 0, 1]), `${name} plain opposite face`).toBeGreaterThan(
      10.35,
    );
    expect(g.hit([4.9, 70, 4.9], [0, -1, 0]), `${name} open square terrace`).toBeCloseTo(2.43, 2);
    const roof = 90 - g.hit([2, 90, 0], [0, -1, 0]);
    expect(roof, `${name} pitched roof`).toBeGreaterThan(79.9);
    expect(roof).toBeLessThan(81.4);
    expect(g.hit([0.4, 83.3, 2], [0, 0, -1]), `${name} vane front`).toBeCloseTo(2, 3);
    expect(g.hit([0.4, 83.3, -2], [0, 0, 1]), `${name} vane reverse`).toBeCloseTo(2, 3);
  }
}, 120000);

it('rebuilds registered budgeted variants while preserving the detailed source/master and separate GPU streams', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    master = digest(await readFile(resolve(path, '../model.glb'))),
    before = JSON.parse(await readFile(path));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'b741403ffec1690b3a0b8c29847dc72f2fe58fffc447627e6d0d8739c2793dd3',
  );
  expect(master).toBe('0d0ac473c4067299415e669bba0bb58e18d90b4af804f29759b98c1bb5925692');
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    const b = await readFile(resolve(path, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          normal = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(normal.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
