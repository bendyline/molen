import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import * as levels from '../../worldgen/scripts/kazarma-current-lods.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/sw/sw8/kazarma_mycenaean_bridge');
const runtime = await runtimeLodFixture(
  resolve('../../content/worldgen/assets/places/sw/sw8/kazarma_mycenaean_bridge'),
);
const read = async (p) => JSON.parse(await readFile(p));
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
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}
it('keeps the asymmetric corbelled passage open and road continuous at every browser budget', () => {
  for (const [name, cap] of Object.entries({
    Skyline: 1000,
    District: 4000,
    Street: 16000,
    Closeup: 64000,
  })) {
    const build = levels['buildKazarma' + name],
      mesh = new MeshBufferBuilder();
    build(mesh);
    expect(mesh.finalize().triangleCount).toBeLessThanOrEqual(cap);
    const ts = [];
    build({ addTriangle: (slot, _ref, p, n) => ts.push({ slot, p, n }) });
    for (const x of [-0.1, 0.05])
      for (const y of [0.5, 1.1, 1.8])
        expect(
          ts.filter((t) => {
            const v = hit([x, y, -3.1], [0, 0, 1], t.p);
            return v !== null && v > 0 && v < 6.2;
          }),
          name + ' passage',
        ).toHaveLength(0);
    for (const x of [-10, -4, 0, 4, 10]) {
      const road = ts.filter((t) => {
        const v = hit([x, 6, 0], [0, -1, 0], t.p);
        return v !== null && Math.abs(6 - v - levels.kazarmaRoadHeight(x)) < 0.06;
      });
      expect(road.length).toBeGreaterThan(0);
      expect(road.every((t) => t.n[1] > 0.9)).toBe(true);
    }
    expect(
      ts.filter((t) => t.p.every((p) => p[0] === -11) && t.n[0] < -0.9).length,
    ).toBeGreaterThan(0);
    expect(ts.filter((t) => t.p.every((p) => p[0] === 11) && t.n[0] > 0.9).length).toBeGreaterThan(
      0,
    );
  }
});
it('reproduces the repaired detailed source and mapped central crossing with a declared relative bank contact', async () => {
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    t = await read(source + '/terrain-context.json');
  expect(f.features.find((v) => v.id === 306121794).tags.wikidata).toBe('Q254087');
  expect(f.centerline[1][0] - f.centerline[0][0]).toBeCloseTo(7.944, 3);
  expect(s.sourceFacts.publishedDimensionsMeters).toEqual([22, 5.6, 4]);
  expect(t.basis).toContain('not sampled');
  expect(s.geographicProposal.terrainReference.modelHeight).toBe(levels.kazarmaRoadHeight(-11));
  expect(s.geographicProposal.heading).toBe(1.486301543755);
});
it('reproduces four image-free derivatives with two reused material graphs and a small initial download', async () => {
  const a = await read(runtime + '/asset.json'),
    master = await readFile(runtime + '/model.glb');
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect((await readFile(runtime + '/model.glb')).equals(master)).toBe(true);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const l of a.runtimeLods.levels) {
    const bytes = await readFile(runtime + '/' + l.file),
      g = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(l.drawCalls).toBeLessThanOrEqual(2);
  }
}, 10000);
