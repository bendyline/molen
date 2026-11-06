import '../../worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/we/wec/bank_of_china_tower');
const installed = source.replace(/([\\/])source([\\/])/, '$1assets$2');
const runtime = await runtimeLodFixture(installed);
const read = async (p) => JSON.parse(await readFile(p));
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
function decode(bytes) {
  const g = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const bin = 28 + bytes.readUInt32LE(12);
  const values = (index) => {
    const a = g.accessors[index],
      view = g.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const width = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
    const start = bin + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, k) => {
        const at = start + i * (view.byteStride ?? n * width) + k * width;
        return a.componentType === 5126
          ? bytes.readFloatLE(at)
          : a.componentType === 5125
            ? bytes.readUInt32LE(at)
            : a.componentType === 5123
              ? bytes.readUInt16LE(at)
              : bytes.readUInt8(at);
      }),
    );
  };
  const glassTriangles = [];
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const points = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      const decoded = Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => points[j]),
      );
      if (g.materials[p.material].pbrMetallicRoughness.metallicFactor === 0.28)
        glassTriangles.push(...decoded);
      return decoded;
    }),
  );
  return { g, triangles, glassTriangles };
}
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function nearest(ts, o, d) {
  return ts.reduce((best, p) => {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]),
      h = cross(d, b),
      det = dot(a, h);
    if (Math.abs(det) < 1e-8) return best;
    const q = sub(o, p[0]),
      u = dot(q, h) / det,
      v = dot(d, cross(q, a)) / det,
      t = dot(b, cross(q, a)) / det;
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}
function local(m, p) {
  const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180);
  const S = -(p.lat - m.anchor[1]) * 111319.490793;
  return [
    E * Math.cos(m.heading) - S * Math.sin(m.heading),
    E * Math.sin(m.heading) + S * Math.cos(m.heading),
  ];
}
it('preserves the detailed source and signs all roof quadrants and mast centers to retained map data', async () => {
  const m = await read(source + '/georeferencing-baseline.json');
  const evidence = await read(resolve('../../content/earth/structures/georeferencing.json'));
  expect(m).toEqual(evidence.candidates.find((x) => x.candidateId === 'bank_of_china_tower'));
  const parts = (await read(source + '/map-parts.json')).elements;
  expect(parts.find((x) => x.id === 25604760).tags.wikidata).toBe('Q214855');
  expect(m.heading).toBeCloseTo(1.293228519094, 12);
  expect(m.anchor).toEqual([114.16156875, 22.2792677]);
  const master = await readFile(source + '/models/source.glb');
  expect(hash(master)).toBe(
    'sha256:7193bb67a6a8939d205e5274f0992b55fc8a48bf7df2d2cc7e2d8150704a7cad',
  );
  const spec = await read(source + '/spec.json');
  expect(spec.mesh.triangles).toBe(156097);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(true);
  for (const id of [279949066, 279949067, 279949068, 279949069])
    expect(parts.find((p) => p.id === id).geometry).toHaveLength(4);
});
it('retains four independent inclined roofs, both grounded masts and full-height structural diagonals at every tier', async () => {
  const m = await read(source + '/georeferencing-baseline.json');
  const parts = (await read(source + '/map-parts.json')).elements;
  const asset = await read(runtime + '/asset.json');
  for (const level of asset.runtimeLods.levels) {
    const { triangles: ts, glassTriangles } = decode(await readFile(runtime + '/' + level.file));
    expect(Math.max(...ts.flat().map((p) => p[1]))).toBeCloseTo(367.4, 3);
    for (const id of [279949066, 279949067, 279949068, 279949069]) {
      const p = parts.find((p) => p.id === id),
        plan = p.geometry.slice(0, -1).map((p) => local(m, p));
      const angle = (+p.tags['roof:direction'] * Math.PI) / 180;
      const E = Math.sin(angle),
        S = -Math.cos(angle);
      const dir = [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
      const projections = plan.map((p) => dot(p, dir)),
        lo = Math.min(...projections),
        hi = Math.max(...projections);
      for (const weights of [
        [0.15, 0.3, 0.55],
        [0.45, 0.4, 0.15],
      ]) {
        const q = [0, 1].map((i) => plan.reduce((s, p, j) => s + p[i] * weights[j], 0));
        const y = +p.tags.height + 5 - (+p.tags['roof:height'] * (dot(q, dir) - lo)) / (hi - lo);
        expect(
          nearest(glassTriangles, [q[0], 400, q[1]], [0, -1, 0]),
          level.name + ' roof ' + id,
        ).toBeCloseTo(400 - y, 2);
      }
    }
    for (const id of [279949064, 279949065]) {
      const plan = parts
        .find((p) => p.id === id)
        .geometry.slice(0, -1)
        .map((p) => local(m, p));
      const q = [0, 1].map((i) => plan.reduce((s, p) => s + p[i] / plan.length, 0));
      expect(nearest(ts, [q[0], 400, q[1]], [0, -1, 0]), level.name + ' mast ' + id).toBeCloseTo(
        32.6,
        3,
      );
      expect(
        nearest(ts, [q[0] + 5, 330, q[1]], [-1, 0, 0]),
        level.name + ' mast body',
      ).toBeLessThan(5);
    }
    // Continuous opaque enclosure must not have the old per-pane holes.
    for (let y = 20; y < 80; y += 17)
      for (const z of [-17, -7, 8, 18])
        expect(nearest(ts, [80, y, z], [-1, 0, 0]), level.name + ' wall').toBeLessThan(60);
  }
}, 60000);
it('rebuilds exact pinned tiers within transfer/draw budgets with shared textures and separate GPU streams', async () => {
  const after = await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  const installedAsset = await read(installed + '/asset.json');
  expect(after.levels[0].bytes + after.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const level = after.levels.find((l) => l.name === name),
      bytes = await readFile(runtime + '/' + level.file),
      { g } = decode(bytes);
    expect(hash(bytes)).toBe(installedAsset.runtimeLods.levels.find((l) => l.name === name).hash);
    expect(level.triangles).toBeLessThanOrEqual(cap);
    expect(level.drawCalls).toBe(3);
    expect(g.images ?? []).toHaveLength(0);
    expect(
      g.materials
        .filter((m) => m.extras?.molenSurface)
        .map((m) => m.extras.molenSurface.ref)
        .sort(),
    ).toEqual([
      'matgraph:molen.worldgen.material.metal_stainless',
      'matgraph:molen.worldgen.material.stone_granite',
    ]);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const a = g.accessors[p.attributes.POSITION],
        b = g.accessors[p.attributes.NORMAL];
      expect(a.bufferView).not.toBe(b.bufferView);
      expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[b.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 30000);
