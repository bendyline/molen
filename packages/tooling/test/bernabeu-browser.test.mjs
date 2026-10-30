import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { landmarkLodRecipeHash } from '../scripts/source-runtime-lods.mjs';
import { bernabeuGroundOutline as outline } from '../../worldgen/scripts/bernabeu-model.mjs';
const source = resolve('../../content/worldgen/source/places/ez/ezj/santiago_bernabeu_stadium'),
  runtime = resolve('../../content/worldgen/assets/places/ez/ezj/santiago_bernabeu_stadium'),
  digest = (b) => createHash('sha256').update(b).digest('hex');
async function geometry(path) {
  const b = await readFile(path),
    g = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      '',
    );
  g.scene.updateMatrixWorld(true);
  return (p, d, far = Infinity) =>
    new Raycaster(new Vector3(...p), new Vector3(...d), 0, far).intersectObject(g.scene, true)[0]
      ?.distance ?? Infinity;
}
it('retains a genuinely open roof, depressed marked pitch, four tiers and asymmetric shell in source,master and all four browser GLBs', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(
      name === 'source'
        ? source + '/models/source.glb'
        : runtime + '/' + (name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const [x, z] of [
      [20, 20],
      [-20, -20],
      [0, 0],
    ])
      expect(
        Math.abs(100 - hit([x, 100, z], [0, -1, 0]) + 9.184),
        name + ' open roof to depressed turf',
      ).toBeLessThan(0.06);
    for (const [x, lo, hi] of [
      [50, -7, 3],
      [70, 6, 14],
      [80, 15, 28],
      [94, 28, 44],
    ]) {
      const y = 44 - hit([x, 44, 0], [0, -1, 0]);
      expect(y, name + ' separate tier at ' + x).toBeGreaterThan(lo);
      expect(y, name + ' separate tier at ' + x).toBeLessThan(hi);
    }
    for (const [x, z] of [
      [80, 0],
      [-80, 0],
      [0, 90],
    ]) {
      const y = 100 - hit([x, 100, z], [0, -1, 0]);
      expect(y, name + ' fixed roof').toBeGreaterThan(47);
      expect(y, name + ' fixed roof').toBeLessThan(58);
    }
    const east = 140 - hit([140, 25, 0], [-1, 0, 0]),
      west = -140 + hit([-140, 25, 0], [1, 0, 0]);
    expect(east + west, name + ' east bulge').toBeGreaterThan(12);
  }
}, 120000);
it('closes the actual mapped ground-cut boundary with a street-level concourse in every browser model', async () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(runtime + '/model.' + level + '.glb');
    for (let i = 1; i < outline.length; i++) {
      const a = outline[i - 1],
        b = outline[i],
        x = (a[0] + b[0]) * 0.495,
        z = (a[1] + b[1]) * 0.495;
      expect(
        Math.abs(0.3 - hit([x, 0.3, z], [0, -1, 0], 0.6) - 0.01),
        level + ' covered mapped edge ' + i,
      ).toBeLessThan(0.001);
    }
  }
}, 120000);
it('preserves the detailed master and pins four budgeted shared-material tiers with separate GPU streams', async () => {
  const a = JSON.parse(await readFile(runtime + '/asset.json'));
  expect(digest(await readFile(source + '/models/source.glb'))).toBe(
    '919bbed8d4912b405a5b52658a71bf4fc8dc3ca85826e76f3ef9c2ecd2880bf3',
  );
  expect(digest(await readFile(runtime + '/model.glb'))).toBe(
    '8ac313bb2191740e73a1dc487aaa2bb203f133cfd87ab85c1410ac43e9979f0c',
  );
  expect(await landmarkLodRecipeHash(a.id)).toBe(a.runtimeLods.recipeHash);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    const b = await readFile(runtime + '/' + l.file);
    expect('sha256:' + digest(b)).toBe(l.hash);
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    if (i)
      for (const graph of ['metal_stainless', 'metal_painted', 'concrete_plain', 'membrane'])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === `matgraph:molen.worldgen.material.${graph}`,
          ),
        ).toBe(true);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const x = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(x.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[x.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
