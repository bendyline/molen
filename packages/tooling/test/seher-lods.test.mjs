import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/sr/srv/seher_cehaja_bridge');
const sidecar = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/sr/srv/seher_cehaja_bridge/asset.json'),
);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
  };
}

it('retains four genuinely open arch barrels, three projecting cutwaters, crowned paving, solid parapets and both path mouths in all six GLBs', async () => {
  const files = [
    ['source', `${source}/models/source.glb`],
    ['master', resolve(sidecar, '../model.glb')],
    ...['skyline', 'district', 'street', 'closeup'].map((n) => [
      n,
      resolve(sidecar, '..', `model.${n}.glb`),
    ]),
  ];
  for (const [name, file] of files) {
    const g = await geometry(file);
    expect(g.bounds.min.x, name).toBeCloseTo(-21.336, 3);
    expect(g.bounds.max.x, name).toBeCloseTo(21.336, 3);
    for (const x of [-14.725, -4.85, 4.85, 14.725]) {
      expect(g.hit([x, 1.1, 10], [0, 0, -1]), `${name} open barrel ${x}`).toBe(Infinity);
      expect(g.hit([x, 3.82, 10], [0, 0, -1]), `${name} solid spandrel ${x}`).toBeLessThan(8);
    }
    for (const x of [-9.7, 0, 9.7]) {
      expect(g.hit([x, 1, 10], [0, 0, -1]), `${name} rounded downstream cutwater`).toBeLessThan(7);
      expect(g.hit([x, 1, -10], [0, 0, 1]), `${name} pointed upstream cutwater`).toBeLessThan(7);
    }
    for (const x of [-20, -18, -14, -10, -5, 0, 5, 10, 14, 18, 20]) {
      const y = 3.75 + 0.58 * (1 - (x / 20.386) ** 2);
      expect(Math.abs(10 - g.hit([x, 10, 0], [0, -1, 0]) - y), `${name} walk ${x}`).toBeLessThan(
        0.04,
      );
      for (const z of [-2.2, 2.2])
        expect(
          Math.abs(10 - g.hit([x, 10, z], [0, -1, 0]) - y - 0.94),
          `${name} parapet ${x},${z}`,
        ).toBeLessThan(0.04);
    }
    for (const x of [-20.8, 20.8])
      for (const z of [-1, 0, 1])
        expect(10 - g.hit([x, 10, z], [0, -1, 0]), `${name} complete path mouth`).toBeGreaterThan(
          3.71,
        );
  }
}, 120000);

it('rebuilds deterministic budgeted tiers with three shared graphs and separate GPU streams without changing the detailed master', async () => {
  const before = JSON.parse(await readFile(sidecar));
  const sourceHash = digest(await readFile(`${source}/models/source.glb`));
  expect(sourceHash).toBe('2ad20b86875126e36a00ed0d26d4d81076f72af478f1e13fc7375a2f2f6ea5da');
  const masterHash = digest(await readFile(resolve(sidecar, '../model.glb')));
  await buildModelLandmarkLods(sidecar, { force: true });
  const after = JSON.parse(await readFile(sidecar));
  expect(after.runtimeLods.levels).toEqual(before.runtimeLods.levels);
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(sourceHash);
  expect(digest(await readFile(resolve(sidecar, '../model.glb')))).toBe(masterHash);
  expect(after.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
  for (const [i, l] of after.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBe(i ? 3 : 1);
    expect(after.files.variants[l.name]).toBe(l.file);
    const b = await readFile(resolve(sidecar, '..', l.file));
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
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
        const pos = g.accessors[p.attributes.POSITION],
          normal = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(normal.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[normal.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
