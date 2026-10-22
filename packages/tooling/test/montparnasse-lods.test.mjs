import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildMontparnasseDistrict,
  buildMontparnasseSkyline,
} from '../../worldgen/scripts/montparnasse-runtime-model.mjs';
import { localGeographic } from '../../worldgen/scripts/signature-tower-expansion-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

it('retains the signed native perimeter against the attributed raw map coordinates', async () => {
  const frame = JSON.parse(
    await readFile(
      resolve(
        '../../content/worldgen/source/places/u0/u09/n0151_montparnasse_tower/map-frame.json',
      ),
    ),
  );
  const native = frame.elements[0].geometry.map((p) => localGeographic(frame, p.lon, p.lat));
  expect(native.length).toBe(frame.geometry.outline.length);
  for (let i = 0; i < native.length; i++)
    for (let k = 0; k < 2; k++) expect(native[i][k]).toBeCloseTo(frame.geometry.outline[i][k], 2);
});

it('keeps the full height and an open district observation terrace within the strict budgets', () => {
  for (const [build, limit] of [
    [buildMontparnasseSkyline, 1000],
    [buildMontparnasseDistrict, 4000],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const mesh = b.finalize();
    expect(mesh.triangleCount).toBeLessThanOrEqual(limit);
    expect(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(210, 1);
    if (build !== buildMontparnasseDistrict) continue;
    const ray = new Ray(new Vector3(20, 206.6, 0), new Vector3(0, 1, 0));
    const point = new Vector3(),
      vertex = (i) => new Vector3(...mesh.positions.slice(i * 3, i * 3 + 3));
    for (let i = 0; i < mesh.indices.length; i += 3)
      expect(
        ray.intersectTriangle(
          vertex(mesh.indices[i]),
          vertex(mesh.indices[i + 1]),
          vertex(mesh.indices[i + 2]),
          false,
          point,
        ),
      ).toBeNull();
  }
});

it('reproduces four derivatives while preserving the exact original detailed source hash', async () => {
  const path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/u0/u09/n0151_montparnasse_tower/asset.json'),
  );
  const asset = JSON.parse(await readFile(path)),
    master = await readFile(resolve(path, '../model.glb'));
  await buildModelLandmarkLods(path, { force: true });
  expect(await readFile(resolve(path, '../model.glb'))).toEqual(master);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
}, 10000);
