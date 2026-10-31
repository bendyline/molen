import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  archevecheBrowserControls as C,
  archevecheBrowserDeck as deck,
} from '../../../content/worldgen/source/places/u0/u09/pont_de_l_archeveche/models/archeveche-browser.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u09/pont_de_l_archeveche');
const sidecar = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/u0/u09/pont_de_l_archeveche/asset.json'),
);
const digest = (b) => createHash('sha256').update(b).digest('hex');
async function geometry(file) {
  const b = await readFile(file);
  const model = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  model.scene.updateMatrixWorld(true);
  return (p, d, far = Infinity) =>
    new Raycaster(new Vector3(...p), new Vector3(...d), 0, far).intersectObject(
      model.scene,
      true,
    )[0]?.distance ?? Infinity;
}
it('preserves three open vaults, rounded cutwaters, crowned roadway, raised walks and the wide mainland flare', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(
      name === 'source'
        ? `${source}/models/source.glb`
        : resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const a of C.arches) {
      expect(hit([a.c, 3, 20], [0, 0, -1], 40), `${name}: open vault`).toBe(Infinity);
      expect(
        Math.abs(20 - hit([a.c, 20, 0.4], [0, -1, 0]) - deck(a.c)),
        `${name}: roadway`,
      ).toBeLessThan(0.07);
    }
    for (const x of [-33, -20, 0, 12, 32])
      for (const z of [-4.3, 4.3])
        expect(
          Math.abs(20 - hit([x, 20, z], [0, -1, 0]) - deck(x) - 0.15),
          `${name}: walk`,
        ).toBeLessThan(0.07);
    for (const z of [-13.5, 13.5])
      expect(Number.isFinite(hit([-33, 20, z], [0, -1, 0])), `${name}: mainland flare`).toBe(true);
    for (const x of C.piers)
      expect(
        10 - hit([x, 10, 5.8], [0, -1, 0]),
        `${name}: rounded projecting nose`,
      ).toBeGreaterThan(3.8);
  }
}, 120000);
it('reconstructs all four tiers deterministically and retains the exact detailed master, shared graphs and separate GPU streams', async () => {
  const before = JSON.parse(await readFile(sidecar)),
    src = digest(await readFile(`${source}/models/source.glb`)),
    master = digest(await readFile(resolve(sidecar, '../model.glb')));
  expect(src).toBe('1f9964ba99a151ce709af9b30662190c0adac758190d8231fdc8c7ba7ca785d5');
  await buildModelLandmarkLods(sidecar, { force: true });
  const after = JSON.parse(await readFile(sidecar));
  expect(after.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(src);
  expect(digest(await readFile(resolve(sidecar, '../model.glb')))).toBe(master);
  expect(after.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const [i, l] of after.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(5);
    const b = await readFile(resolve(sidecar, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    if (i)
      for (const graph of ['stone_limestone_raw', 'stone_granite', 'metal_painted'])
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
