import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  akmensControls as C,
  akmensDeckY as deck,
} from '../../../content/worldgen/source/places/ud/ud1/akmens_tilts/models/akmens-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/ud/ud1/akmens_tilts'),
  sidecar = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/ud/ud1/akmens_tilts/asset.json'),
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
it('keeps continuous road and both sidewalks, open water spans and granite supports in every model', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(
      name === 'source'
        ? source + '/models/source.glb'
        : resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const x of [-260, -220, -150, -100, -40, 10, 70, 130, 205, 260]) {
      expect(Math.abs(30 - hit([x, 30, 6], [0, -1, 0]) - deck(x)), name + ' roadway').toBeLessThan(
        0.16,
      );
      for (const z of [-12, 12])
        expect(
          Math.abs(30 - hit([x, 30, z], [0, -1, 0]) - deck(x) - 0.2),
          name + ' sidewalk',
        ).toBeLessThan(0.16);
    }
    for (const x of [-224, -166, -107, -48, 10, 69, 136, 211])
      expect(hit([x, 2, 25], [0, 0, -1], 50), name + ' open water').toBe(Infinity);
    for (const x of C.piers)
      expect(hit([x, 1.5, 25], [0, 0, -1], 50), name + ' granite pier').toBeLessThan(14);
  }
}, 120000);
it('retains all seven globes and truly open railing cells beside solid decorative plaques', async () => {
  for (const name of ['master', 'closeup']) {
    const hit = await geometry(
      resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const x of C.torchStations)
      for (const side of [-1, 1]) {
        const z = side * (Math.abs(x) > 230 ? 15.35 : 14.2),
          y = deck(x) + 0.18;
        expect(30 - hit([x, 30, z], [0, -1, 0])).toBeGreaterThan(y + 6.7);
        for (let i = 0; i < 6; i++) {
          const a = (2 * Math.PI * i) / 6;
          expect(
            30 - hit([x + 1.04 * Math.cos(a), 30, z + 1.04 * Math.sin(a)], [0, -1, 0]),
          ).toBeGreaterThan(y + 6.1);
        }
      }
    const x0 = C.west + 1,
      step = (C.east - C.west - 2) / Math.ceil((C.east - C.west - 2) / 2.4),
      x = x0 + step * 0.29,
      y = deck(x) + 0.8;
    expect(hit([x, y, 14.3], [0, 0, -1], 2)).toBe(Infinity);
    expect(hit([x0 + step * 0.5, y, 14.3], [0, 0, -1], 2)).toBeLessThan(1.2);
  }
}, 120000);
it('rebuilds exact shared-material browser tiers, preserves the detailed source and uses separate GPU streams', async () => {
  const before = JSON.parse(await readFile(sidecar)),
    src = digest(await readFile(source + '/models/source.glb')),
    master = digest(await readFile(resolve(sidecar, '../model.glb')));
  expect(src).toBe('4174dd4eee0cbfef851a50a703a7f5b07746b3dbf4600caf1ded25635a397cf5');
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
