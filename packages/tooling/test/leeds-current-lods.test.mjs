import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildLeedsCurrentRuntime,
  leedsCurrentY,
} from '../../worldgen/scripts/leeds-castle-current-model.mjs';
import { leedsPlanPoint } from '../../worldgen/scripts/leeds-castle-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u1/u10/n0304_leeds_castle'),
  runtime = resolve('../../content/worldgen/assets/places/u1/u10/n0304_leeds_castle');
const read = async (p) => JSON.parse(await readFile(p));
const triangles = (level) => {
  const ts = [];
  buildLeedsCurrentRuntime({ addTriangle: (slot, _ref, p, n) => ts.push({ slot, p, n }) }, level);
  return ts;
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function hit(o, d, p) {
  const a = sub(p[1], p[0]),
    b = sub(p[2], p[0]),
    h = cross(d, b),
    det = dot(a, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(o, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}
const native = ([x, y, z]) => {
  const p = leedsPlanPoint(x, z);
  return [p[0], y, p[1]];
};
it('separates public DTM observations from the reconstructed floor within all browser budgets', async () => {
  const g = await read(source + '/terrain-grid.json'),
    spec = await read(source + '/spec.json');
  expect(g.verticalDatum).toBe('ODN');
  expect(g.modelDatumElevationMeters).toBe(56.28);
  expect(g.observations.points).toHaveLength(29);
  expect(g.observations.pathMedianMeters).toBe(62.245);
  expect(g.reconstruction.baileyFloorModelY).toBe(6);
  expect(g.reconstruction.basis).toContain('reconstructed');
  expect(spec.geographicProposal.groundCutout.outline).toHaveLength(21);
  for (const [level, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const b = new MeshBufferBuilder();
    buildLeedsCurrentRuntime(b, level);
    const m = b.finalize();
    expect(m.triangleCount).toBeLessThanOrEqual(cap);
    const ts = triangles(level);
    const top = Math.max(...ts.flatMap((t) => t.p.map((p) => p[1])));
    expect(top).toBeGreaterThan(20);
    expect(22.25 - top).toBeLessThanOrEqual(
      level === 'skyline' ? 2 : level === 'district' ? 0.7 : 0.001,
    );
    expect(
      ts.filter((t) => t.slot === 'lawn' && t.p.every((p) => Math.abs(p[1] - 6) < 0.002)).length,
    ).toBeGreaterThan(10);
  }
});
it('keeps both scaled water arches, the open Gloriette court and mapped gate route clear', async () => {
  const f = await read(source + '/map-frame.json'),
    k = f.controls,
    b = k.coveredBridge,
    n = [-b.archAxis[1], b.archAxis[0]],
    route = f.geometry.rawFeatures.find((w) => w.id === 120567645).points;
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const ts = triangles(level);
    for (const c of b.archCenters)
      for (const y of [1, 2, 2.8]) {
        const o = native([c[0] - n[0] * 5, leedsCurrentY(y), c[1] - n[1] * 5]),
          d = native([n[0], 0, n[1]]);
        expect(
          ts.filter((t) => {
            const v = hit(o, d, t.p);
            return v !== null && v > 0.001 && v < 9.999;
          }),
          level + ' water arch',
        ).toHaveLength(0);
      }
    for (const [x, z] of [
      [75, -20],
      [78, -21],
      [73, -19],
    ])
      expect(
        ts.filter((t) => {
          const v = hit(native([x, leedsCurrentY(5), z]), [0, 1, 0], t.p);
          return v !== null && v > 0;
        }),
        level + ' courtyard',
      ).toHaveLength(0);
    if (level !== 'skyline')
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i],
          b = route[i + 1],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          d = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
        expect(
          ts.filter((t) => {
            const v = hit([a[0], 7.7, a[1]], d, t.p);
            return v !== null && v > 0.001 && v < len - 0.001;
          }),
          level + ' gate route',
        ).toHaveLength(0);
      }
  }
});
it('reproduces the exact graded source and four shared-material levels with no embedded images', async () => {
  const a = await read(runtime + '/asset.json'),
    master = await readFile(runtime + '/model.glb'),
    bytes = await readFile(source + '/models/source.glb');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    'd16b54283a0f86440f462d94a9e9e5c41b4530f2a8f7dab7e021e1bd9878df27',
  );
  expect(await buildModelLandmarkLods(runtime + '/asset.json', { force: true })).toEqual(
    a.runtimeLods,
  );
  expect(await readFile(runtime + '/model.glb')).toEqual(master);
  const g = JSON.parse(master.toString('utf8', 20, 20 + master.readUInt32LE(12)));
  expect(g.images ?? []).toHaveLength(0);
  expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(5);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
}, 10000);
