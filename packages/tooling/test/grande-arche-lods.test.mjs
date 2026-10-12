import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildGrandeArcheCurrent,
  buildGrandeArcheDistrict,
  buildGrandeArcheSkyline,
  buildGrandeArcheStreet,
} from '../../worldgen/scripts/grande-arche-runtime-model.mjs';
import { skylineExpansion } from '../../worldgen/scripts/signature-tower-expansion-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

it('preserves every original face and adds the missing panelled soffit', () => {
  const capture = (build) => {
    const faces = [],
      out = Object.fromEntries(
        ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
          method,
          (...args) => faces.push([method, ...args.slice(0, 4), args.at(-1)]),
        ]),
      );
    build(out);
    return faces;
  };
  const original = capture(skylineExpansion.find((s) => s.id === 'N0147').build),
    current = capture(buildGrandeArcheCurrent);
  expect(current.slice(0, original.length)).toEqual(original);
  expect(current.length).toBeGreaterThan(original.length);
  expect(current.slice(original.length).some((f) => f[1] === 'glass' && f[4][1] < -0.99)).toBe(
    true,
  );
});

it('keeps the upper opening empty and both piers and top beam solid at every authored level', () => {
  for (const [build, cap] of [
    [buildGrandeArcheSkyline, 1000],
    [buildGrandeArcheDistrict, 4000],
    [buildGrandeArcheStreet, 16000],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const mesh = b.finalize();
    expect(mesh.triangleCount).toBeLessThanOrEqual(cap);
    expect(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(111.7275, 2);
    const vertex = (i) => new Vector3(...mesh.positions.slice(i * 3, i * 3 + 3));
    const hit = (x, y) => {
      const ray = new Ray(new Vector3(x, y, 100), new Vector3(0, 0, -1)),
        p = new Vector3();
      for (let i = 0; i < mesh.indices.length; i += 3)
        if (
          ray.intersectTriangle(
            vertex(mesh.indices[i]),
            vertex(mesh.indices[i + 1]),
            vertex(mesh.indices[i + 2]),
            false,
            p,
          )
        )
          return true;
      return false;
    };
    expect(hit(20, 65)).toBe(false);
    expect(hit(-45, 65)).toBe(true);
    expect(hit(45, 65)).toBe(true);
    expect(hit(20, 105)).toBe(true);
  }
});

it('reproduces the current source and four strict-budget derivatives without altering the master', async () => {
  const path = resolve('../../content/worldgen/assets/places/u0/u09/n0147_grande_arche/asset.json');
  const asset = JSON.parse(await readFile(path)),
    master = await readFile(resolve(path, '../model.glb'));
  const source = await readFile(
    resolve('../../content/worldgen/source/places/u0/u09/n0147_grande_arche/models/source.glb'),
  );
  expect(createHash('sha256').update(source).digest('hex')).toBe(
    'f658050a2adce167684b6623b9b4e9d9ccd3187728f727b44c7129369136ad9a',
  );
  expect(await buildModelLandmarkLods(path, { force: true })).toEqual(asset.runtimeLods);
  expect(await readFile(resolve(path, '../model.glb'))).toEqual(master);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
}, 10000);
