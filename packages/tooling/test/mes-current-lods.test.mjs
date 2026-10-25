import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildMesCloseup,
  buildMesDistrict,
  buildMesSkyline,
  buildMesStreet,
  mesDeckDelta,
  mesGround,
} from '../../worldgen/scripts/mes-bridge-current-model.mjs';
import { mesStudy } from '../../worldgen/scripts/mes-bridge-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/sr/srm/mes_bridge');
const runtime = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/sr/srm/mes_bridge'),
);
const read = async (p) => JSON.parse(await readFile(p));
const awaitFrame = await readFile(source + '/map-frame.json', 'utf8');
const centerline = JSON.parse(awaitFrame).centerline;
function center(x) {
  const upper = centerline.findIndex((p) => p[0] >= x);
  if (upper <= 0) return upper === 0 ? centerline[0][1] : centerline.at(-1)[1];
  const lo = centerline[upper - 1],
    hi = centerline[upper];
  return lo[1] + ((hi[1] - lo[1]) * (x - lo[0])) / (hi[0] - lo[0]);
}
const levels = {
  skyline: [buildMesSkyline, 1000],
  district: [buildMesDistrict, 4000],
  street: [buildMesStreet, 16000],
  closeup: [buildMesCloseup, 64000],
};
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
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}
it('retains thirteen clear arches, outward faces and the humped deck at every browser budget', () => {
  for (const [name, [build, cap]] of Object.entries(levels)) {
    const mesh = new MeshBufferBuilder();
    build(mesh);
    expect(mesh.finalize().triangleCount).toBeLessThanOrEqual(cap);
    const ts = [];
    build({ addTriangle: (slot, _ref, p, n) => ts.push({ slot, p, n }) });
    expect(mesStudy.reconstruction.arches).toHaveLength(13);
    for (const a of mesStudy.reconstruction.arches) {
      const y = a.bottom + (a.spring + a.rise - a.bottom) * 0.7;
      const z = center(a.x);
      const hits = ts.filter((t) => {
        const v = hit([a.x, y, z - 1.8], [0, 0, 1], t.p);
        return v !== null && v > 0 && v < 3.6;
      });
      expect(hits, name + ' arch ' + a.x).toHaveLength(0);
    }
    const front = ts.filter(
      (t) =>
        Math.abs(t.n[2]) > 0.95 &&
        t.p.every(
          (p) => Math.abs(p[0] + 6.4) < 15 && p[1] > 11 && Math.abs(p[2] - center(p[0])) >= 1.67,
        ),
    );
    expect(front.length).toBeGreaterThan(0);
    for (const t of front) {
      const offset = t.p.reduce((s, p) => s + p[2] - center(p[0]), 0) / 3;
      expect(offset * t.n[2]).toBeGreaterThan(0);
    }
    const top = ts.filter((t) =>
      t.p.some((p) => Math.abs(p[0] + 6.4) < 0.001 && Math.abs(p[1] - 12.25) < 0.001),
    );
    expect(top.length).toBeGreaterThan(0);
    expect(ts.filter((t) => t.n[1] > 0.9).length).toBeGreaterThan(10);
  }
});
it('keeps measured terrain separate from reconstructed rock and matches both outer approaches', async () => {
  const g = await read(source + '/terrain-grid.json'),
    s = await read(source + '/spec.json');
  expect(g.source.verticalDatum).toContain('Not stated');
  expect(g.source.nativeResolution).toContain('does not establish2m');
  expect(g.heights).toHaveLength(129 * 129);
  expect(s.geographicProposal.terrainReference.anchor).toEqual(g.reference.coordinate);
  expect(s.geographicProposal.terrainReference.modelHeight).toBe(8.05);
  expect(s.geographicProposal.heading).toBe(0.108927584258);
  expect(Math.abs(7.75 + mesDeckDelta(-62.361) - mesGround(-62.361, 4.675))).toBeLessThan(0.02);
  expect(Math.abs(7.45 + mesDeckDelta(62.361) - mesGround(62.361, 4.675))).toBeLessThan(0.02);
  expect(mesDeckDelta(-6.4)).toBe(0);
});
it('reproduces all four image-free shared-material levels and keeps initial downloads below phone limits', async () => {
  const a = await read(runtime + '/asset.json'),
    master = await readFile(runtime + '/model.glb');
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect((await readFile(runtime + '/model.glb')).equals(master)).toBe(true);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const l of a.runtimeLods.levels) {
    const bytes = await readFile(runtime + '/' + l.file),
      g = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(l.drawCalls).toBeLessThanOrEqual(3);
  }
}, 10000);
