import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { buildTurkuCurrentRuntime } from '../../worldgen/scripts/turku-castle-current-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u6/u6x/n0305_turku_castle');
const runtime = resolve('../../content/worldgen/assets/places/u6/u6x/n0305_turku_castle');
const read = async (p) => JSON.parse(await readFile(p));
const triangles = (level) => {
  const out = [];
  buildTurkuCurrentRuntime({ addTriangle: (slot, _ref, p, n) => out.push({ slot, p, n }) }, level);
  return out;
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function hit(origin, d, p) {
  const a = sub(p[1], p[0]),
    b = sub(p[2], p[0]),
    h = cross(d, b),
    det = dot(a, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(origin, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}
it('separates measured city height from the reconstructed bailey datum within four strict budgets', async () => {
  const relief = await read(source + '/terrain-grid.json');
  expect(relief.source.points).toHaveLength(27);
  expect(relief.source.contours).toHaveLength(107);
  expect(
    relief.source.points.some(
      (p) => p.heightMeters === 8.572 && p.coordinates[0][0] === 22.2279555,
    ),
  ).toBe(true);
  expect(relief.courtLevels[2].basis).toContain('reconstruction');
  expect(relief.modelDatumElevationMeters).toBe(4);
  for (const [level, budget] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const b = new MeshBufferBuilder();
    buildTurkuCurrentRuntime(b, level);
    const mesh = b.finalize();
    expect(mesh.triangleCount).toBeLessThanOrEqual(budget);
    const ts = triangles(level);
    expect(Math.max(...ts.flatMap((t) => t.p.map((p) => p[1])))).toBeCloseTo(42.572, 3);
    expect(
      ts.filter((t) => t.slot === 'paving' && t.p.every((p) => Math.abs(p[1] - 4.587) < 0.002))
        .length,
    ).toBeGreaterThan(10);
    expect(ts.some((t) => t.p.some((p) => p[1] < 0))).toBe(true);
  }
});
it('keeps all three mapped passage centre lines clear after height changes and coarse plaster coverage', async () => {
  const frame = await read(source + '/map-frame.json');
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const ts = triangles(level);
    for (const gate of frame.controls.passages) {
      const p = frame.geometry.rawFeatures.find((f) => f.id === gate.way).points,
        a = p[0],
        b = p.at(-1),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const d = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
        base = gate.parts.some((id) => frame.controls.mainWays.includes(id)) ? 4.572 : 0;
      const origin = [a[0], base + 1, a[1]];
      const obstacles = ts.filter((t) => {
        const v = hit(origin, d, t.p);
        return v !== null && v > 0.01 && v < len - 0.01;
      });
      expect(obstacles, `${level}: passage${gate.way}`).toHaveLength(0);
    }
  }
});
it('reproduces the exact repaired source and four shared-material browser levels without changing its master', async () => {
  const asset = await read(runtime + '/asset.json'),
    master = await readFile(runtime + '/model.glb'),
    original = await readFile(source + '/models/source.glb');
  expect(createHash('sha256').update(original).digest('hex')).toBe(
    'a60704ec23541c779b3f323057000d16c6be37de99c5644437f97ae408091e9e',
  );
  expect(await buildModelLandmarkLods(runtime + '/asset.json', { force: true })).toEqual(
    asset.runtimeLods,
  );
  expect(await readFile(runtime + '/model.glb')).toEqual(master);
  const g = JSON.parse(master.toString('utf8', 20, 20 + master.readUInt32LE(12)));
  expect(
    g.materials.some(
      (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.stone_drywall',
    ),
  ).toBe(true);
  expect(g.images?.length ?? 0).toBe(0);
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3000000,
  );
}, 10000);
