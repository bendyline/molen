import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { landmarkLodRecipeHash } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/wx/wx4/beijing_national_stadium');
const runtime = resolve('../../content/worldgen/assets/places/wx/wx4/beijing_national_stadium');
const digest = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
async function geometry(path) {
  const b = await readFile(path);
  const g = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  g.scene.updateMatrixWorld(true);
  return (x, z, y = 100, far = 200) => {
    const hit = new Raycaster(new Vector3(x, y, z), new Vector3(0, -1, 0), 0, far).intersectObject(
      g.scene,
      true,
    )[0];
    return hit?.point.y ?? null;
  };
}
it('keeps an open oval roof, depressed field, saddle and three seating tiers in source,master and all browser GLBs', async () => {
  for (const level of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(
      level === 'source'
        ? source + '/models/source.glb'
        : runtime + '/' + (level === 'master' ? 'model.glb' : `model.${level}.glb`),
    );
    for (const [x, z] of [
      [0, 0],
      [20, 20],
      [-20, -20],
    ])
      expect(Math.abs(hit(x, z) + 5), level + ' open aperture to field').toBeLessThan(0.08);
    for (const [x, lo, hi, eye] of [
      [60, -5, 6, 8],
      [86, 8, 22, 22.6],
      [112, 22, 48, 48],
    ]) {
      // Start beneath the acoustic roof and overhead steel, above the tier under test.
      const y = hit(x, 0, eye);
      expect(y, level + ' tier at ' + x).toBeGreaterThan(lo);
      expect(y, level + ' tier at ' + x).toBeLessThan(hi);
    }
    const crest = hit(140, 0),
      valley = hit(0, 160);
    expect(crest, level + ' east crest').toBeGreaterThan(63);
    expect(valley, level + ' north valley').toBeGreaterThan(38);
    expect(valley, level + ' north valley').toBeLessThan(47);
    expect(crest - valley, level + ' saddle').toBeGreaterThan(19);
  }
}, 120000);
it('covers all120 inherited cutout edges with a plaza slab at each browser tier', async () => {
  const spec = JSON.parse(await readFile(source + '/spec.json'));
  const ps = spec.geographicProposal.groundCutout.outline;
  expect(ps).toHaveLength(120);
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(runtime + `/model.${level}.glb`);
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length];
      expect(
        hit((a[0] + b[0]) * 0.495, (a[1] + b[1]) * 0.495, 0.3, 1),
        level + ' edge ' + i,
      ).toBeCloseTo(0.01, 3);
    }
  }
}, 120000);
it('preserves both detailed master pins and four budgeted image-free tiers using three shared graphs and separate GPU streams', async () => {
  const a = JSON.parse(await readFile(runtime + '/asset.json'));
  expect(digest(await readFile(source + '/models/source.glb'))).toBe(
    'sha256:24a3be75c462e0549e8b96960dbdf1447abbcef0814149cd8e0231d666e60af1',
  );
  expect(digest(await readFile(runtime + '/model.glb'))).toBe(
    'sha256:05a3a96bc409f54a983c0937c55f7db0fd7b1c8084466f2d58396ce3c246faea',
  );
  expect(await landmarkLodRecipeHash(a.id)).toBe(a.runtimeLods.recipeHash);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    const b = await readFile(runtime + '/' + l.file);
    expect(digest(b)).toBe(l.hash);
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const graph of ['metal_painted', 'concrete_plain', 'membrane'])
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
