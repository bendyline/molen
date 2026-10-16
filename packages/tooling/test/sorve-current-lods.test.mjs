import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildSorveDistrict,
  buildSorveSkyline,
  buildSorveStreet,
  sorveOpenings,
} from '../../worldgen/scripts/sorve-skyline-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u6/u6r/n0648_sorve_lighthouse'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p));
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
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
it('keeps the53m tapered silhouette, paint split, galleries and real recessed openings at browser budgets', () => {
  for (const [name, build, cap] of [
    ['skyline', buildSorveSkyline, 1000],
    ['district', buildSorveDistrict, 4000],
    ['street', buildSorveStreet, 16000],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const m = b.finalize();
    expect(m.triangleCount).toBeLessThanOrEqual(cap);
    const ps = Array.from({ length: m.vertexCount }, (_, i) =>
      Array.from(m.positions.slice(i * 3, i * 3 + 3)),
    );
    expect(Math.max(...ps.map((p) => p[1]))).toBe(53);
    expect(Math.min(...ps.map((p) => p[1]))).toBe(0);
    for (const [y, r] of [
      [0, 4.12],
      [17.4, 3.04],
      [30, 2.65],
      [45.9, 2.27],
      [46.9, 3.53],
    ]) {
      const at = ps.filter((p) => Math.abs(p[1] - y) < 0.0001);
      expect(at.length, name + ' profile ' + y).toBeGreaterThan(8);
      expect(Math.max(...at.map((p) => Math.hypot(p[0], p[2])))).toBeCloseTo(r, 2);
    }
    if (name === 'skyline') continue;
    const ts = Array.from({ length: m.triangleCount }, (_, i) =>
      Array.from(m.indices.slice(i * 3, i * 3 + 3), (v) => ps[v]),
    );
    for (const h of sorveOpenings) {
      const sign = h.angle === 0 ? 1 : -1,
        y = h.y + h.h * 0.5;
      const ds = ts
        .map((p) => hit([0, y, sign * 6], [0, 0, -sign], p))
        .filter((t) => t !== null && t > 0 && t < 4);
      expect(ds.length, name + ' aperture ' + y).toBeGreaterThan(0);
      const profile = [
          [0, 4.12],
          [0.5, 4.08],
          [9, 3.5],
          [17.4, 3.04],
          [30, 2.65],
          [45.9, 2.27],
        ],
        i = profile.findIndex((p) => p[0] >= y),
        a = profile[i - 1],
        c = profile[i];
      const r = a[1] + ((c[1] - a[1]) * (y - a[0])) / (c[0] - a[0]);
      expect(6 - Math.min(...ds), name + ' recessed glass ' + y).toBeLessThan(r - 0.22);
    }
  }
});
it('preserves the original master and binds the actual northwest access to native-Z entry', async () => {
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json');
  expect(s.nativeAxes.front).toBe('-Z');
  expect(s.sourceFacts.heightMeters).toBe(53);
  expect(f.accessPath.at(-1)[0]).toBeCloseTo(0, 4);
  expect(f.accessPath.at(-1)[1]).toBeCloseTo(-3.6398179128, 5);
  expect(f.elements[0].geometry.at(-1)).toMatchObject({ lon: 22.0553305, lat: 57.9098546 });
  expect(s.geographicProposal.heading).toBe(0.505986351887);
  expect(s.geographicProposal.elevationMode).toBe('terrain-contact');
});
it('reproduces independent image-free levels with three draws and sub-phone initial download', async () => {
  const a = await read(runtime + '/asset.json');
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3_000_000);
  const graph = new Set();
  for (const l of a.runtimeLods.levels) {
    const b = await readFile(runtime + '/' + l.file);
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(l.drawCalls).toBeLessThanOrEqual(3);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) graph.add(m.extras.molenSurface.ref);
  }
  expect([...graph].sort()).toEqual([
    'matgraph:molen.worldgen.material.concrete_plain',
    'matgraph:molen.worldgen.material.metal_painted',
  ]);
});
