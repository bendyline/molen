import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Triangle, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildLakhtaSkyline,
  lakhtaSkinRows,
} from '../../worldgen/scripts/lakhta-skyline-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

it('keeps the five-petal skin samples within the declared one-metre skyline reservation', () => {
  const rows = lakhtaSkinRows(),
    v = (p) => new Vector3(...p),
    nearest = new Vector3();
  let maxDeviation = 0;
  for (let i = 0; i < rows.length; i += 2) {
    const first = rows[i],
      last = rows[Math.min(i + 1, rows.length - 1)];
    for (let cell = 0; cell < first.length; cell++) {
      const q = [first[cell][0], first[cell][1], last[cell][2], last[cell][3]];
      const triangles = [
        [0, 1, 2],
        [0, 2, 3],
      ].map((k) => new Triangle(...k.map((j) => v(q[j]))));
      for (const row of rows.slice(i, i + 2)) {
        const points = row[cell].map(v);
        points.push(points.reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(0.25));
        for (const point of points) {
          const distance = Math.min(
            ...triangles.map((t) => t.closestPointToPoint(point, nearest).distanceTo(point)),
          );
          maxDeviation = Math.max(maxDeviation, distance);
        }
      }
    }
  }
  expect(maxDeviation).toBeLessThan(1);
  const b = new MeshBufferBuilder();
  buildLakhtaSkyline(b);
  const mesh = b.finalize();
  expect(mesh.triangleCount).toBeLessThanOrEqual(1000);
  expect(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1))).toBe(462);
});

it('reproduces four levels while preserving the exact original tower master', async () => {
  const path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/ud/udt/n0160_lakhta_centre/asset.json'),
  );
  const asset = JSON.parse(await readFile(path)),
    master = await readFile(resolve(path, '../model.glb'));
  await buildModelLandmarkLods(path, { force: true });
  expect(await readFile(resolve(path, '../model.glb'))).toEqual(master);
  expect(
    asset.runtimeLods.levels.every((l, i) => l.triangles <= [1000, 4000, 16000, 64000][i]),
  ).toBe(true);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
}, 10000);
