import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { plakaControls as C } from '../../../content/worldgen/source/places/sr/srn/plaka_bridge/models/plaka-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/sr/srn/plaka_bridge');
const sidecar = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/sr/srn/plaka_bridge/asset.json'),
);
const digest = (b) => createHash('sha256').update(b).digest('hex');
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
it('keeps three genuinely open stone vaults and solid separating masonry in all six GLBs', async () => {
  for (const name of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const hit = await geometry(
      name === 'source'
        ? source + '/models/source.glb'
        : resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const a of [C.main, ...C.reliefs])
      expect(hit([a.c, a.spring + a.rise * 0.4, 6], [0, 0, -1], 12), name + ' vault').toBe(
        Infinity,
      );
    for (const x of [-27, 22])
      expect(hit([x, 2.3, 6], [0, 0, -1], 12), name + ' solid pier').toBeLessThan(4);
    const heights = [];
    for (let x = -38.4; x <= 38.4; x += 0.4) {
      const y = 50 - hit([x, 50, 0], [0, -1, 0]);
      expect(Number.isFinite(y), name + ' complete walk').toBe(true);
      heights.push(y);
    }
    expect(Math.max(...heights)).toBeGreaterThan(19.5);
    for (let i = 1; i < heights.length; i++)
      expect(
        Math.abs(heights[i] - heights[i - 1]),
        name + ' continuous humpback walk',
      ).toBeLessThan(1.1);
    expect(Math.abs(50 - hit([-38.55, 50, 0], [0, -1, 0]) - C.deckEnds[0])).toBeLessThan(0.01);
    expect(Math.abs(50 - hit([38.55, 50, 0], [0, -1, 0]) - C.deckEnds[1])).toBeLessThan(0.01);
    for (const z of [-2, 2])
      expect(50 - hit([-4, 50, z], [0, -1, 0]), name + ' parapet').toBeGreaterThan(20.5);
  }
}, 120000);
it('retains projecting double voussoir bands and separate soffits in the detailed models', async () => {
  for (const name of ['master', 'closeup']) {
    const hit = await geometry(
      resolve(sidecar, '..', name === 'master' ? 'model.glb' : `model.${name}.glb`),
    );
    for (const a of [C.main, ...C.reliefs]) {
      for (const ring of [0.3, 0.85])
        expect(
          hit([a.c + 0.1, a.spring + a.rise + ring, 3], [0, 0, -1], 2),
          name + ' visible radial ring',
        ).toBeLessThan(0.9);
      expect(hit([a.c, 0, 0], [0, 1, 0], 30), name + ' open barrel soffit').toBeGreaterThan(
        a.spring + a.rise - 0.05,
      );
    }
  }
}, 120000);
it('rebuilds exact budgeted shared-material tiers without changing masters or duplicating GPU streams', async () => {
  const before = JSON.parse(await readFile(sidecar)),
    src = digest(await readFile(source + '/models/source.glb')),
    master = digest(await readFile(resolve(sidecar, '../model.glb')));
  expect(src).toBe('fe1dd806736c1323e7aafb87525479b766cbe54d49a296348146e5ce3eef96f8');
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
      for (const graph of ['stone_limestone', 'stone_limestone_raw', 'stone_granite'])
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
