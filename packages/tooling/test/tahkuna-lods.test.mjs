import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { buildTahkuna } from '../../worldgen/scripts/lighthouse-final-coastal-models.mjs';
import {
  buildTahkunaCurrent,
  buildTahkunaDistrict,
  buildTahkunaSkyline,
  buildTahkunaStreet,
} from '../../worldgen/scripts/tahkuna-current-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

it('retains the original detailed recipe and applies the current authority height in source', () => {
  for (const [build, height] of [
    [buildTahkuna, 42.6],
    [buildTahkunaCurrent, 45.2],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const mesh = b.finalize();
    expect(mesh.triangleCount).toBe(61870);
    expect(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(height, 4);
  }
});
it('keeps the current height, red dome and critical near surfaces within all authored budgets', () => {
  for (const [build, limit] of [
    [buildTahkunaSkyline, 1000],
    [buildTahkunaDistrict, 4000],
    [buildTahkunaStreet, 16000],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const mesh = b.finalize();
    expect(mesh.triangleCount).toBeLessThanOrEqual(limit);
    expect(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(45.2, 4);
    const roof = [];
    for (let i = 0; i < mesh.positions.length / 3; i++)
      if (mesh.positions[i * 3 + 1] > 43) roof.push([...mesh.colors.slice(i * 3, i * 3 + 3)]);
    expect(roof.some((c) => c[0] > 128 && c[1] < 40)).toBe(true);
  }
});
it('reconstructs identical four-level bytes from source without changing the detailed import', async () => {
  const p = resolve(
    '../../content/worldgen/assets/places/ud/ud8/n0661_tahkuna_lighthouse/asset.json',
  );
  const before = JSON.parse(await readFile(p));
  const master = await readFile(resolve(p, '../model.glb'));
  expect(await buildModelLandmarkLods(p, { force: true })).toEqual(before.runtimeLods);
  expect(await readFile(resolve(p, '../model.glb'))).toEqual(master);
  expect(before.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
}, 10000);
