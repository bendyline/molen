import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildSevenWtcCurrent,
  buildSevenWtcDistrict,
  buildSevenWtcSkyline,
} from '../../worldgen/scripts/seven-wtc-runtime-model.mjs';
import { skylineNext } from '../../worldgen/scripts/signature-tower-next-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/7_world_trade_center');
const frame = JSON.parse(await readFile(resolve(source, 'map-frame.json')));
const emit = (build) => {
  const calls = [];
  const out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (...args) => calls.push({ name, args }),
    ]),
  );
  build(out, frame);
  return calls;
};

it('retains every original detailed face and closes the mapped roof plant support gap', () => {
  const original = emit(skylineNext.find((s) => s.id === '7_world_trade_center').build);
  const current = emit(buildSevenWtcCurrent);
  expect(JSON.stringify(current.slice(0, original.length))).toBe(JSON.stringify(original));
  const curb = current.slice(original.length);
  expect(curb.length).toBeGreaterThan(0);
  const ys = curb.flatMap((c) => c.args[2].map((p) => p[1]));
  expect(Math.min(...ys)).toBe(223);
  expect(Math.max(...ys)).toBe(223.85);
  // The original service block starts here; no air gap may remain above the curb.
  expect(original.some((c) => c.args[2].some((p) => p[1] === 223.85))).toBe(true);
});

it('preserves the full tower and asymmetric rooftop volume within the authored budgets', () => {
  for (const [build, ceiling] of [
    [buildSevenWtcSkyline, 1000],
    [buildSevenWtcDistrict, 4000],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const mesh = b.finalize();
    expect(mesh.triangleCount).toBeLessThanOrEqual(ceiling);
    expect(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(226.03, 3);
    const roof = emit(build)
      .flatMap((c) => c.args[2])
      .filter((p) => p[1] > 225.9);
    expect(roof.length).toBeGreaterThan(0);
    const roofCenterX =
      (Math.min(...roof.map((p) => p[0])) + Math.max(...roof.map((p) => p[0]))) / 2;
    expect(Math.abs(roofCenterX)).toBeGreaterThan(1);
  }
});

it('reproduces all browser bytes and keeps recess and glass as separate material slots', async () => {
  const sidecarPath = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/dr/dr5/7_world_trade_center/asset.json'),
  );
  const asset = JSON.parse(await readFile(sidecarPath));
  const master = await readFile(resolve(sidecarPath, '../model.glb'));
  await buildModelLandmarkLods(sidecarPath, { force: true });
  expect(await readFile(resolve(sidecarPath, '../model.glb'))).toEqual(master);
  const bytes = await readFile(resolve(sidecarPath, '../model.district.glb'));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  expect(gltf.materials.length).toBe(5);
  const palette = gltf.materials.filter((m) => m.name === 'local-architectural-surface');
  expect(palette.map((m) => m.pbrMetallicRoughness.roughnessFactor).sort()).toEqual([0.2, 0.88]);
  expect(palette.map((m) => m.pbrMetallicRoughness.metallicFactor).sort()).toEqual([0, 0.28]);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
}, 10000);
