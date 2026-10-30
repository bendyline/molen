import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  greensControls as C,
  greensDeckY as deckY,
  greensIntrados as intrados,
} from '../../../content/worldgen/source/places/gc/gc6/greens_bridge/models/greens-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/gc/gc6/greens_bridge');
const sidecar = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/gc/gc6/greens_bridge/asset.json'),
);
const digest = (b) => createHash('sha256').update(b).digest('hex');
async function geometry(file) {
  const bytes = await readFile(file),
    model = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
  model.scene.updateMatrixWorld(true);
  return {
    hit(p, d, far = Infinity) {
      return (
        new Raycaster(new Vector3(...p), new Vector3(...d), 0, far).intersectObject(
          model.scene,
          true,
        )[0]?.distance ?? Infinity
      );
    },
  };
}

it('preserves five open main barrels,two east culverts,four pier noses and continuous asymmetric road/walk at every tier', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const g = await geometry(
      name === 'source'
        ? source + '/models/source.glb'
        : resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const [a, b] of [...C.spans, ...C.culverts]) {
      const x = (a + b) / 2;
      expect(g.hit([x, 1.35, 15], [0, 0, -1]), name + ' open barrel ' + x).toBe(Infinity);
      expect(
        g.hit([x, deckY(x) - 0.22, 15], [0, 0, -1]),
        name + ' solid spandrel ' + x,
      ).toBeLessThan(12);
      const top = 12 - g.hit([x, 12, 0], [0, -1, 0]);
      expect(Math.abs(top - deckY(x))).toBeLessThan(name === 'skyline' ? 0.08 : 0.035);
      expect(intrados(x)).toBeGreaterThan(2.7);
    }
    for (const x of C.piers) {
      expect(12 - g.hit([x, 12, 4.8], [0, -1, 0]), name + ' projecting nose').toBeGreaterThan(1.5);
      if (!['skyline'].includes(name))
        expect(g.hit([x, 3.1, 10], [0, 0, -1]), name + ' downstream panel').toBeLessThan(6.0);
    }
    for (const x of [-38.6, -30, -16, 0, 14, 28, 38.6]) {
      expect(
        Math.abs(12 - g.hit([x, 12, 0.4], [0, -1, 0]) - deckY(x)),
        name + ' road',
      ).toBeLessThan(0.09);
      expect(
        Math.abs(12 - g.hit([x, 12, -3.05], [0, -1, 0]) - deckY(x) - 0.12),
        name + ' north walk',
      ).toBeLessThan(0.09);
      const south = 12 - g.hit([x, 12, 3.65], [0, -1, 0]);
      expect(south - deckY(x), name + ' south stone parapet').toBeGreaterThan(0.95);
    }
    for (const [x, sign] of [
      [C.west, -1],
      [C.east, 1],
    ])
      for (const z of [-4.25, 0, 4.0])
        expect(
          Number.isFinite(g.hit([x + sign * 0.3, 12, z], [0, -1, 0])),
          name + ' mouth ' + z,
        ).toBe(true);
  }
}, 120000);

it('rebuilds budgeted shared-surface LODs deterministically while preserving the original master and separate GPU streams', async () => {
  const before = JSON.parse(await readFile(sidecar)),
    src = digest(await readFile(source + '/models/source.glb')),
    master = digest(await readFile(resolve(sidecar, '../model.glb')));
  expect(src).toBe('2accbaf1e7e62645681339da54e0a76280a0ed00ef2893b20ba5e09f1469b66e');
  await buildModelLandmarkLods(sidecar, { force: true });
  const after = JSON.parse(await readFile(sidecar));
  expect(after.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(source + '/models/source.glb'))).toBe(src);
  expect(digest(await readFile(resolve(sidecar, '../model.glb')))).toBe(master);
  expect(after.runtimeLods.levels.slice(0, 2).reduce((n, x) => n + x.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const [i, l] of after.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(6);
    expect(after.files.variants[l.name]).toBe(l.file);
    const b = await readFile(resolve(sidecar, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    if (i)
      for (const graph of [
        'stone_drywall',
        'stone_limestone_raw',
        'concrete_plain',
        'metal_painted',
      ])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === `matgraph:molen.worldgen.material.${graph}`,
          ),
        ).toBe(true);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          normal = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(normal.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[normal.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
