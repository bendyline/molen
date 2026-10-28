import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u1/u14/yser_tower');
const path = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/u1/u14/yser_tower/asset.json'),
);
async function geometry(file) {
  const b = await readFile(file);
  const g = await new GLTFLoader().parseAsync(
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
    material(origin, direction) {
      const hit = new Raycaster(new Vector3(...origin), new Vector3(...direction)).intersectObject(
        g.scene,
        true,
      )[0];
      if (!hit) return undefined;
      const material = Array.isArray(hit.object.material)
        ? hit.object.material[hit.face.materialIndex]
        : hit.object.material;
      return material.name;
    },
  };
}

it('retains the complete current tower, lobed shaft, open cross terraces, twin stair flights and37 bell bodies at every level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(89.8, 3);
    expect(g.bounds.min.x).toBeLessThan(-17.6);
    expect(g.bounds.max.x).toBeGreaterThan(17.67);
    expect(g.bounds.max.z).toBeGreaterThan(19.4);
    const center = g.hit([0, 40, 20], [0, 0, -1]);
    expect(center, `${name} central shaft return`).toBeCloseTo(20 - 5.348 * 1.03, 2);
    for (const x of [-4, 4])
      expect(center - g.hit([x, 40, 20], [0, 0, -1]), `${name} shaft lobes`).toBeGreaterThan(1);
    for (const x of [-6.8, 6.8])
      expect(g.hit([x, 70.5, 20], [0, 0, -1]), `${name} cross arm`).toBeCloseTo(15.5, 2);
    expect(g.hit([4, 82.5, 20], [0, 0, -1]), `${name} cross shoulder void`).toBe(Infinity);
    for (const x of [-5.5, 5.5])
      expect(g.hit([x, 86, 0], [0, -1, 0]), `${name} open arm terrace`).toBeCloseTo(6.57, 2);
    expect(g.hit([1.8, 88, 0], [0, -1, 0]), `${name} open upper roof`).toBeCloseTo(4.77, 2);
    for (const x of [-9, 9]) {
      const d = g.hit([x, 10, 18.5], [0, -1, 0]);
      expect(d, `${name} attached stairs`).toBeGreaterThan(7.2);
      expect(d).toBeLessThan(8.5);
    }
    expect(g.hit([0, 1, 25], [0, 0, -1]), `${name} glazed entry`).toBeLessThan(6);
    let bells = 0;
    for (const [row, count] of [5, 5, 5, 5, 5, 4, 4, 4].entries())
      for (let col = 0; col < count; col++) {
        const x = (col - (count - 1) / 2) * 0.79,
          y = 15 + row * 1.08 + 0.3;
        expect(g.hit([x, y, 15], [0, 0, -1]), `${name} bell${bells}`).toBeLessThan(8.3);
        bells++;
      }
    expect(bells).toBe(37);
  }
}, 120000);

it('rebuilds the four registered budgeted variants while preserving the detailed source/master and separate GPU streams', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    master = digest(await readFile(resolve(path, '../model.glb'))),
    before = JSON.parse(await readFile(path));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'f73256e0ae7248763d6f44ed31c3f565bd69f6fab54496fb217fd329dccd1b82',
  );
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 6, 6, 6][i]);
    const b = await readFile(resolve(path, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          norm = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(norm.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
