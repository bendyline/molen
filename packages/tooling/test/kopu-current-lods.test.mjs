import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildKopuCurrent,
  buildKopuDistrict,
  buildKopuSkyline,
} from '../../worldgen/scripts/kopu-current-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u6/u6r/n0641_kopu_lighthouse'),
  runtime = await runtimeLodFixture(
    source.replace('\\source\\', '\\assets\\').replace('/source/', '/assets/'),
  );
const read = async (p) => JSON.parse(await readFile(p));
it('matches every mapped ground vertex, maintains four buttresses and the37.7m upper tower', async () => {
  const f = await read(source + '/map-frame.json');
  for (const [build, cap] of [
    [buildKopuCurrent, 64000],
    [buildKopuDistrict, 4000],
    [buildKopuSkyline, 1000],
  ]) {
    const b = new MeshBufferBuilder();
    build(b);
    const m = b.finalize(),
      ps = Array.from({ length: m.vertexCount }, (_, i) =>
        Array.from(m.positions.slice(i * 3, i * 3 + 3)),
      );
    expect(m.triangleCount).toBeLessThanOrEqual(cap);
    expect(Math.max(...ps.map((p) => p[1]))).toBeCloseTo(37.7, 4);
    const ground = ps.filter((p) => p[1] === 0);
    for (const [x, z] of f.geometry.outline)
      expect(Math.min(...ground.map((p) => Math.hypot(p[0] - x, p[2] - z)))).toBeLessThan(0.00001);
    for (const axis of [0, 2])
      for (const sign of [-1, 1])
        expect(
          ps.filter(
            (p) => Math.abs(p[1] - 22.8) < 0.0001 && Math.abs(p[axis] - sign * 4.45) < 0.0001,
          ).length,
        ).toBeGreaterThan(0);
    let outside = 0;
    for (let i = 0; i < m.indices.length; i += 3) {
      const ids = Array.from(m.indices.slice(i, i + 3)),
        p = ids.map((v) => ps[v]);
      if (!p.every((p) => p[1] > 4 && p[1] < 22.801)) continue;
      const n = Array.from(m.normals.slice(ids[0] * 3, ids[0] * 3 + 3)),
        cx = p.reduce((s, p) => s + p[0], 0) / 3,
        cz = p.reduce((s, p) => s + p[2], 0) / 3;
      expect(cx * n[0] + cz * n[2]).toBeGreaterThan(0);
      outside++;
    }
    expect(outside).toBeGreaterThanOrEqual(42);
  }
});
it('retains the signed mapped main entrance and current source-to-runtime hashes', async () => {
  const f = await read(source + '/map-frame.json'),
    s = await read(source + '/spec.json');
  expect(f.elements[0].tags.wikidata).toBe('Q1795607');
  expect(f.elements[1].tags.entrance).toBe('main');
  expect(s.geographicProposal.heading).toBe(-0.087025590763);
  const b = new MeshBufferBuilder();
  buildKopuCurrent(b);
  const m = b.finalize(),
    door = m.groups.find((g) => g.slot === 'wood');
  const ps = Array.from(m.indices.slice(door.start, door.start + door.count), (v) =>
    Array.from(m.positions.slice(v * 3, v * 3 + 3)),
  );
  const centerX = (Math.min(...ps.map((p) => p[0])) + Math.max(...ps.map((p) => p[0]))) / 2;
  expect(centerX).toBeCloseTo(f.geometry.outline[10][0], 5);
  for (const p of ps) expect(p[2]).toBeCloseTo(f.geometry.outline[10][1], 5);
});
it('reproduces four independently downloadable image-free levels with bounded draw and initial costs', async () => {
  const a = await read(runtime + '/asset.json');
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3_000_000);
  const graphs = new Set();
  for (const l of a.runtimeLods.levels) {
    const b = await readFile(runtime + '/' + l.file);
    expect(l.drawCalls).toBeLessThanOrEqual(5);
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const mat of g.materials)
      if (mat.extras?.molenSurface?.ref) graphs.add(mat.extras.molenSurface.ref);
  }
  expect([...graphs].sort()).toEqual([
    'matgraph:molen.worldgen.material.concrete_plain',
    'matgraph:molen.worldgen.material.metal_painted',
    'matgraph:molen.worldgen.material.plaster_lime',
    'matgraph:molen.worldgen.material.wood_plain',
  ]);
});
