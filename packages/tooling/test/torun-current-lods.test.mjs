import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { torunLean } from '../../worldgen/scripts/torun-detail-model.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u3m/leaning_tower_of_torun'),
  runtime = await runtimeLodFixture(
    source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\'),
  );
const read = async (p) => JSON.parse(await readFile(p));
function geometry(b) {
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
    bin = 28 + b.readUInt32LE(12);
  const array = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
      w = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType],
      p = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, c) => {
        const at = p + i * (v.byteStride ?? w * n) + c * w;
        return a.componentType === 5126
          ? b.readFloatLE(at)
          : a.componentType === 5125
            ? b.readUInt32LE(at)
            : a.componentType === 5123
              ? b.readUInt16LE(at)
              : b.readUInt8(at);
      }),
    );
  };
  return g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = array(p.attributes.POSITION),
        ids = array(p.indices).flat();
      return Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((id) => ps[id]),
      );
    }),
  );
}
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
  if (det < 1e-8) return null;
  const q = sub(o, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}

const nearest = (ts, o, d) =>
  ts.reduce((nearest, p) => {
    const t = hit(o, d, p);
    return t !== null && t > 0 ? Math.min(nearest, t) : nearest;
  }, Infinity);

it('retains the directed map frame, raised north street and geographic northward lean', async () => {
  const s = await read(`${source}/spec.json`),
    frame = await read(`${source}/map-frame.json`),
    live = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.sourceGeometry.export).toBe('buildTorunReviewed');
  expect(live.heading).toBeCloseTo(-0.178170601621, 12);
  expect(live.anchor).toEqual([18.6020742, 53.0083824]);
  expect(live.replaceFootprint).toBe(false);
  expect(live.terrainReference.modelHeight).toBe(4);
  expect(frame.mappedIdentity.wikidataId).toBe('Q2234463');
  expect(frame.geometry.outline[8]).toEqual(frame.geometry.outline[0]);
  expect(
    sourceLocalFootprint(s, await readFile(`${source}/map-frame.json`)).footprint,
  ).toHaveLength(9);
  const e = 15 * (torunLean[0] * Math.cos(live.heading) + torunLean[1] * Math.sin(live.heading)),
    n = 15 * (torunLean[0] * Math.sin(live.heading) - torunLean[1] * Math.cos(live.heading));
  expect(e).toBeCloseTo(0, 10);
  expect(n).toBeCloseTo(1.46, 10);
  expect(live.terrainReference.anchor[1]).toBeGreaterThan(live.anchor[1]);
  expect(live.status).toBe('preview');
});
it('retains the north timber closure, sloping roof, south supports, attached gallery and covered east stair in all levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(`${runtime}/model.${name}.glb`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
      ts = geometry(b),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBeCloseTo(19.6, 4);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    expect(Math.min(...ps.map((p) => p.min[0]))).toBeLessThan(-16);
    expect(Math.max(...ps.map((p) => p.max[0]))).toBeGreaterThan(9.7);
    const roof = nearest(ts, [0, 30, 0], [0, -1, 0]);
    expect(roof, `${name} closed sloping roof`).toBeGreaterThan(12.1);
    expect(roof).toBeLessThan(12.4);
    const north = nearest(ts, [-1.55 + torunLean[0] * 7.1 + 0.022 * -4.5, 11.1, -20], [0, 0, 1]);
    expect(north, `${name} north window/timber facade`).toBeGreaterThan(14.5);
    expect(north).toBeLessThan(15.2);
    expect(nearest(ts, [0, 1, -20], [0, 0, 1]), `${name} closed north basement`).toBeLessThan(18);
    expect(nearest(ts, [-3.6, 2, 20], [0, 0, -1]), `${name} southern support`).toBeLessThan(14.2);
    expect(nearest(ts, [-7, 15, -3], [0, -1, 0]), `${name} west gallery deck`).toBeLessThan(8.5);
    const stairX = 5.78 + torunLean[0] * 2.8 + 0.022 * -2.6,
      stairZ = -2.6 + torunLean[1] * 2.8;
    expect(
      nearest(ts, [stairX, 15, stairZ], [0, -1, 0]),
      `${name} east covered landing`,
    ).toBeGreaterThan(5.5);
    expect(nearest(ts, [stairX, 15, stairZ], [0, -1, 0])).toBeLessThan(6);
  }
});
it('rebuilds exact four-level bytes within triangle/draw/download budgets with four canonical shared material graphs and separate GPU streams', async () => {
  const a = await read(`${runtime}/asset.json`),
    digest = (bytes) => createHash('sha256').update(bytes).digest('hex'),
    master = digest(await readFile(`${runtime}/model.glb`));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'f2cbf6e87acbd496382745664eb9b10b829776bf943e67c6e52e916d406ac7fa',
  );
  await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  const rebuilt = await read(`${runtime}/asset.json`);
  expect(rebuilt.runtimeLods.levels).toEqual(a.runtimeLods.levels);
  expect(digest(await readFile(`${runtime}/model.glb`))).toBe(master);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(rebuilt.files.variants[l.name]).toBe(l.file);
    const b = await readFile(`${runtime}/${l.file}`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) refs.add(m.extras.molenSurface.ref);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const ps = g.accessors[p.attributes.POSITION],
          ns = g.accessors[p.attributes.NORMAL];
        expect(ps.bufferView).not.toBe(ns.bufferView);
        expect(g.bufferViews[ps.bufferView].byteStride ?? 12).toBe(12);
      }
  }
  expect([...refs].sort()).toEqual(
    ['brick', 'plaster_lime', 'metal_painted', 'wood_plain']
      .map((n) => `matgraph:molen.worldgen.material.${n}`)
      .sort(),
  );
}, 30000);
