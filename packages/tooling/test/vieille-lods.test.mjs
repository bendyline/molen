import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/gb/gbs/vieille_lighthouse');
const path = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/gb/gbs/vieille_lighthouse/asset.json'),
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

it('retains the complete tapered square tower, rounded north projection, gallery, PV pair and attached entrance flight at all levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(resolve(path, '..', `model.${name}.glb`));
    expect(g.bounds.min.y).toBe(0);
    expect(g.bounds.max.y).toBeCloseTo(26.9, 3);
    expect(g.bounds.min.x).toBeLessThan(-4.09);
    expect(g.bounds.max.x).toBeGreaterThan(4.09);
    expect(g.bounds.min.z).toBeLessThan(-7.8);
    const r = 3.217 + ((2.77 - 3.217) * (10.5 - 3.7)) / 16.5;
    expect(g.hit([0, 10.5, 10], [0, 0, -1]), `${name} main taper`).toBeCloseTo(10 - r, 2);
    const north = 2.48 + 1.51 - (0.27 * (10.5 - 3.3)) / 16.9;
    expect(g.hit([0, 10.5, -12], [0, 0, 1]), `${name} rounded north projection`).toBeCloseTo(
      12 - north,
      2,
    );
    const foot = g.hit([0, 6, -7.6], [0, -1, 0]);
    expect(foot, `${name} attached stair foot`).toBeGreaterThan(5);
    expect(foot).toBeLessThan(5.7);
    expect(g.hit([2.65, 22.95, -8], [0, 0, 1]), `${name} open gallery`).toBe(Infinity);
    expect(g.hit([1, 23, 8], [0, 0, -1]), `${name} south PV`).toBeLessThan(5);
    expect(g.hit([0, 24.5, 10], [0, 0, -1]), `${name} lantern`).toBeLessThan(8.6);
    if (name !== 'skyline')
      for (const y of [4.8, 8.85, 12.9, 16.95]) {
        const pane = g.material([0, y, 10], [0, 0, -1]);
        expect(pane).toBeDefined();
        expect(pane, `${name} visible main windows`).not.toBe(g.material([1, y, 10], [0, 0, -1]));
      }
  }
}, 120000);

it('rebuilds the four registered budgeted variants while preserving the detailed source/master and separate GPU streams', async () => {
  const digest = (b) => createHash('sha256').update(b).digest('hex'),
    master = digest(await readFile(resolve(path, '../model.glb'))),
    before = JSON.parse(await readFile(path));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    '833d866c2e9c9f1b56d6af8a3af8e108b64efd169df5df24b3663ba9566a2f64',
  );
  await buildModelLandmarkLods(path, { force: true });
  const a = JSON.parse(await readFile(path));
  expect(a.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(resolve(path, '../model.glb')))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(a.files.variants[l.name]).toBe(l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe([1, 4, 4, 4][i]);
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
