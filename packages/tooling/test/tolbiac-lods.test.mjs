import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  tolbiacBrowserControls as C,
  tolbiacBrowserDeck as deck,
} from '../../../content/worldgen/source/places/u0/u09/pont_de_tolbiac/models/tolbiac-browser.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u09/pont_de_tolbiac');
const sidecar = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/u0/u09/pont_de_tolbiac/asset.json'),
);
const digest = (b) => createHash('sha256').update(b).digest('hex');
async function geometry(file) {
  const b = await readFile(file),
    model = await new GLTFLoader().parseAsync(
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
it('retains five open vaults, projected round cutwaters, crowned road and both sidewalks in every model', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(
      name === 'source'
        ? `${source}/models/source.glb`
        : resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const a of C.arches) {
      expect(hit([a.c, 2.2, 25], [0, 0, -1], 50), `${name}: open vault`).toBe(Infinity);
      expect(
        Math.abs(20 - hit([a.c, 20, 0.7], [0, -1, 0]) - deck(a.c)),
        `${name}: road crown`,
      ).toBeLessThan(0.07);
    }
    for (const x of [-98, -71, -30, -5, 5, 30, 71, 94])
      for (const z of [-8, 8])
        expect(
          Math.abs(20 - hit([x, 20, z], [0, -1, 0]) - deck(x) - 0.16),
          `${name}: sidewalk`,
        ).toBeLessThan(0.1);
    for (const [x, r] of C.piers)
      expect(
        10 - hit([x, 10, 9.8 + r + 0.1], [0, -1, 0]),
        `${name}: projecting cap`,
      ).toBeGreaterThan(2.8);
  }
}, 120000);
it('keeps actual open balustrade apertures and solid backing at their authored cells', async () => {
  for (const [name, panels, holes] of [
    ['district', 8, 1],
    ['street', 24, 5],
    ['closeup', 48, 9],
  ]) {
    const hit = await geometry(resolve(sidecar, '..', `model.${name}.glb`)),
      step = 180 / panels,
      a = -89 + Math.floor(panels / 2) * step + 0.22,
      b = -89 + (Math.floor(panels / 2) + 1) * step - 0.22,
      x = a + ((b - a) * 0.5) / holes,
      y = deck((a + b) / 2) + 0.24 + 0.535;
    expect(hit([x, y, 10.6], [0, 0, -1], 1.1), `${name}: true opening`).toBe(Infinity);
    expect(hit([a + 0.05, y, 10.6], [0, 0, -1], 1.1), `${name}: solid stone frame`).toBeLessThan(
      0.8,
    );
  }
}, 120000);
it('rebuilds exact shared-material tiers within budgets and preserves the detailed master and separate GPU streams', async () => {
  const before = JSON.parse(await readFile(sidecar)),
    src = digest(await readFile(`${source}/models/source.glb`)),
    master = digest(await readFile(resolve(sidecar, '../model.glb')));
  expect(src).toBe('9dae38078bfe6db4516b242056772ae4ad8a91dc5062379875bdb09fb167d3c3');
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
    expect(l.drawCalls).toBeLessThanOrEqual(6);
    const b = await readFile(resolve(sidecar, '..', l.file)),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    if (i)
      for (const graph of [
        'stone_limestone_raw',
        'stone_limestone_weathered',
        'concrete_plain',
        'metal_painted',
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
