import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u6/u6x/bengtskar_lighthouse');
const path = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/u6/u6x/bengtskar_lighthouse/asset.json'),
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

it('retains the complete stepped keeper block, curved oculus pediment, shaft profile, gallery and46m finial at all levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(46, 3);
    expect(g.bounds.min.x).toBeLessThan(-23);
    expect(g.bounds.max.x).toBeGreaterThan(6);
    // Independent architectural controls: roof ridge, pediment and distinct eastern mass.
    expect(g.hit([-14, 25, 1.4514], [0, -1, 0]), `${name} west roof`).toBeCloseTo(7.05, 1);
    expect(g.hit([-11.5, 16.2, 12], [0, 0, -1]), `${name} oculus`).toBeLessThan(3.9);
    expect(g.hit([4.5, 20, 2], [0, -1, 0]), `${name} east roof`).toBeCloseTo(4.65, 1);
    for (const [y, r] of [
      [24, 3.15857],
      [30, 2.89714],
      [36, 2.64982],
    ])
      expect(g.hit([0, y, 12], [0, 0, -1]), `${name} taper at${y}m`).toBeCloseTo(12 - r, 1);
    expect(g.hit([2.75, 45, 0], [0, -1, 0]), `${name} red gallery`).toBeLessThan(4.8);
    expect(g.hit([0, 42.7, 12], [0, 0, -1]), `${name} lantern`).toBeLessThan(10);
    expect(g.hit([-17.4, 25, 0.9], [0, -1, 0]), `${name} chimney`).toBeLessThan(5.7);
    if (name !== 'skyline')
      for (const y of [1.85, 6.1, 10.3]) {
        const window = g.material([-11.859, y, 12], [0, 0, -1]);
        expect(window, `${name} visible window at${y}m`).toBeDefined();
        expect(window).not.toBe(g.material([-10.7, y, 12], [0, 0, -1]));
      }
    if (name === 'street' || name === 'closeup') {
      const wall = g.hit([-10.7, 6.1, 12], [0, 0, -1]);
      const inset = g.hit([-11.859, 6.1, 12], [0, 0, -1]);
      expect(inset - wall, `${name} real keeper-window recess`).toBeGreaterThan(0.15);
    }
  }
}, 120000);

it('rebuilds the four registered budgeted variants while preserving the detailed source/master and separate GPU streams', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    master = digest(await readFile(resolve(path, '../model.glb'))),
    before = JSON.parse(await readFile(path));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    '68dff7c364eb38c5a076484a7b1337ba29ed565c303b0ac5630499495edd47b5',
  );
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 5, 5, 5][i]);
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
