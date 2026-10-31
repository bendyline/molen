import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  altinoPlans,
  buildAltinoDistrict,
  buildAltinoSkyline,
  buildAltinoStreet,
} from '../../worldgen/scripts/altino-arantes-current-model.mjs';
import { localGeographic } from '../../worldgen/scripts/signature-tower-expansion-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

it('preserves the independently mapped upper core and northwest address entrance', async () => {
  const base = resolve('../../content/worldgen/source/places/6g/6gy/edificio_altino_arantes');
  const frame = JSON.parse(await readFile(base + '/map-frame.json')),
    parts = JSON.parse(await readFile(base + '/map-parts.json'));
  const raw = parts.elements
    .find((e) => e.id === 425691323)
    .geometry.slice(0, -1)
    .map((p) => localGeographic(frame, p.lon, p.lat));
  for (const p of raw)
    expect(altinoPlans().core.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6)).toBe(true);
  const entry = parts.elements.find((e) => e.id === 5079752545),
    p = localGeographic(frame, entry.lon, entry.lat);
  expect(p[0]).toBeCloseTo(4.159, 3);
  expect(p[1]).toBeCloseTo(-8.293, 3);
  expect(entry.tags['addr:street']).toBe('Rua João Brícola');
});

it('retains mast height, front-facing portal and a visible canton on both flag sides within strict budgets', () => {
  for (const [build, budget] of [
    [buildAltinoSkyline, 1000],
    [buildAltinoDistrict, 4000],
    [buildAltinoStreet, 16000],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const mesh = b.finalize();
    expect(mesh.triangleCount).toBeLessThanOrEqual(budget);
    expect(Math.max(...mesh.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(161.22, 2);
    const redNormals = [],
      portalZ = [];
    build({
      ...Object.fromEntries(
        ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
          method,
          (slot, _ref, points, normal, _uv, color) => {
            if (slot === 'canvas' && color[0] > 0.6 && color[1] < 0.04) redNormals.push(normal[2]);
            if (slot === 'recess') portalZ.push(...points.map((p) => p[2]));
          },
        ]),
      ),
    });
    expect(redNormals.some((n) => n > 0.5)).toBe(true);
    expect(redNormals.some((n) => n < -0.5)).toBe(true);
    expect(Math.max(...portalZ)).toBeLessThan(-8.28);
  }
});

it('reproduces all four browser levels with the exact repaired source and shared mosaic', async () => {
  const path = await runtimeLodFixture(
    resolve('../../content/worldgen/assets/places/6g/6gy/edificio_altino_arantes/asset.json'),
  );
  const asset = JSON.parse(await readFile(path)),
    master = await readFile(resolve(path, '../model.glb'));
  await buildModelLandmarkLods(path, { force: true });
  expect(await readFile(resolve(path, '../model.glb'))).toEqual(master);
  const g = JSON.parse(master.toString('utf8', 20, 20 + master.readUInt32LE(12)));
  expect(
    g.materials.some(
      (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.tile_mosaic',
    ),
  ).toBe(true);
  expect(g.images?.length ?? 0).toBe(0);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
});
