import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  maloControls as C,
  maloDeckY as deck,
} from '../../../content/worldgen/source/places/ud/udt/malo_kalinkin_bridge/models/malo-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
const source = resolve('../../content/worldgen/source/places/ud/udt/malo_kalinkin_bridge'),
  sidecar = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/ud/udt/malo_kalinkin_bridge/asset.json'),
  ),
  digest = (b) => createHash('sha256').update(b).digest('hex');
async function geometry(path) {
  const b = await readFile(path),
    m = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      '',
    );
  m.scene.updateMatrixWorld(true);
  return (p, d, far = Infinity) =>
    new Raycaster(new Vector3(...p), new Vector3(...d), 0, far).intersectObject(m.scene, true)[0]
      ?.distance ?? Infinity;
}
it('retains three open spans, two rounded granite supports and a continuous skew deck in all six GLBs', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(
      name === 'source'
        ? source + '/models/source.glb'
        : resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const x of [-11, -8, 0, 8, 11]) {
      for (const z of [-4, 4])
        expect(
          Math.abs(20 - hit([x + C.skew * z, 20, z], [0, -1, 0]) - deck(x)),
          name + ' road',
        ).toBeLessThan(0.1);
      for (const z of [-7, 7])
        expect(
          Math.abs(20 - hit([x + C.skew * z, 20, z], [0, -1, 0]) - deck(x) - 0.18),
          name + ' sidewalk',
        ).toBeLessThan(0.1);
    }
    for (const x of [-8, 0, 8])
      expect(hit([x, 1.3, 15], [0, 0, -1], 30), name + ' open span').toBe(Infinity);
    for (const x of C.piers)
      expect(
        hit([x + C.skew * 8.6, 1.3, 12], [0, 0, -1], 7),
        name + ' projecting drum',
      ).toBeLessThan(4);
    for (const x of C.piers)
      for (const side of [-1, 1])
        expect(
          hit([x + C.skew * side * 8.55, deck(x) + 0.05, side * 12], [0, 0, -side], 4),
          name + ' stone coping beneath the outboard obelisk base',
        ).toBeLessThan(3.5);
  }
}, 120000);
it('keeps four obelisk finials, oval lanterns and actual pierced ornamental ironwork in the detailed models', async () => {
  for (const name of ['master', 'closeup']) {
    const hit = await geometry(
      resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const x of C.piers)
      for (const z of [-8, 8]) {
        const xx = x + C.skew * z,
          y = deck(x) + 0.18;
        expect(20 - hit([xx, 20, z], [0, -1, 0])).toBeGreaterThan(y + 4);
        expect(20 - hit([xx, 20, z + Math.sign(z) * 0.72], [0, -1, 0])).toBeGreaterThan(y + 3.15);
      }
    const a = C.west + 0.15,
      step = (C.east - C.west - 0.3) / (name === 'master' ? 30 : 24),
      mid = a + step * 0.5,
      x = mid + 0.09,
      y = deck(a) + 0.89,
      z = 7.95;
    expect(hit([x + C.skew * z, y, 9], [0, 0, -1], 2)).toBe(Infinity);
    expect(hit([a + C.skew * z, deck(a) + 0.7, 9], [0, 0, -1], 2)).toBeLessThan(1.2);
  }
}, 120000);
it('rebuilds exact budgeted shared-material tiers without altering the master or duplicating GPU streams', async () => {
  const before = JSON.parse(await readFile(sidecar)),
    src = digest(await readFile(source + '/models/source.glb')),
    master = digest(await readFile(resolve(sidecar, '../model.glb')));
  expect(src).toBe('d9d8f2caa97a2fd7a9d3ecf271dd48f3ff585b992c1d53bc946b78df2f20252c');
  await buildModelLandmarkLods(sidecar, { force: true });
  const after = JSON.parse(await readFile(sidecar));
  expect(after.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(source + '/models/source.glb'))).toBe(src);
  expect(digest(await readFile(resolve(sidecar, '../model.glb')))).toBe(master);
  expect(after.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const [i, l] of after.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(6);
    const b = await readFile(resolve(sidecar, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    if (i)
      for (const graph of [
        'stone_granite',
        'stone_limestone_raw',
        'metal_painted',
        'concrete_plain',
      ])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === `matgraph:molen.worldgen.material.${graph}`,
          ),
        ).toBe(true);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const a = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(a.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
