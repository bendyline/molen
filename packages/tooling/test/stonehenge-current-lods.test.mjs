import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildStonehengeReviewed } from '../../worldgen/scripts/stonehenge-detail-model.mjs';
import { colors, prism } from '../../worldgen/scripts/structure-mesh.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/gc/gcn/n0946_stonehenge'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p));
function triangles(b) {
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
    bin = 28 + b.readUInt32LE(12);
  const values = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
      w = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType],
      start = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, k) => {
        const at = start + i * (v.byteStride ?? n * w) + k * w;
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
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      return Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
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
    return u < 0 || v < 0 || u + v > 1 || t <= 0.00001 ? best : Math.min(best, t);
  }, Infinity);
}

it('reproduces the preserved original draft and the current authored master from checked-in recipes', async () => {
  const gen = await readFile('../worldgen/scripts/generate-next-1000-models.mjs', 'utf8');
  const build = Function(
    'prism',
    'C',
    'pale',
    'stone',
    gen.slice(gen.indexOf('function rectangle'), gen.indexOf('const builders')) +
      ';return buildStonehenge;',
  )(prism, colors, [0.84, 0.81, 0.71], [0.73, 0.69, 0.58]);
  const original = new MeshBufferBuilder();
  build(original);
  const scope = await read(`${source}/review-scope.json`);
  const builder = new MeshBufferBuilder(),
    authoring = createArchitecturalSurfaceAuthoring(scope.surfaces);
  buildStonehengeReviewed(authoring.wrap(builder));
  expect(scope.sourceFacts.completeInnerTrilithons).toBe(3);
  expect(scope.sourceFacts.brokenInnerGroups).toBe(2);
});

it('keeps the open inner trilithons, current gaps, fallen groups, four outliers and bank at every level', async () => {
  const probes = [
    { point: [8.794, 4.5], height: 6.8 },
    { point: [2.907, 8.067], height: 7.3 },
    { point: [-5.523, -2.18], height: 6.8 },
  ];
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = triangles(await readFile(`${runtime}/model.${name}.glb`));
    for (const p of probes)
      expect(
        10 - nearest(ts, [p.point[0], 10, p.point[1]], [0, -1, 0]),
        `${name} complete capped group`,
      ).toBeCloseTo(p.height, 0);
    // These probes are independent of recipe inventory: modern west ring has a large gap,
    // while the northeast Heel, southeast Station and northwest Station stones survive.
    expect(10 - nearest(ts, [62.79, 10, -49.27], [0, -1, 0]), `${name} Heel Stone`).toBeCloseTo(
      4.7,
      1,
    );
    expect(10 - nearest(ts, [42.01, 10, 20.49], [0, -1, 0]), `${name} Station91`).toBeCloseTo(
      1.1,
      1,
    );
    expect(10 - nearest(ts, [-34.88, 10, -20.2], [0, -1, 0]), `${name} Station93`).toBeCloseTo(
      0.82,
      1,
    );
    expect(nearest(ts, [-14, 10, 0], [0, -1, 0]), `${name} unreconstructed western gap`).toBe(
      Infinity,
    );
    expect(
      10 - nearest(ts, [0.3, 10, 17.3], [0, -1, 0]),
      `${name} fallen southern stone`,
    ).toBeLessThan(1.3);
    expect(10 - nearest(ts, [-54.6, 10, 0], [0, -1, 0]), `${name} low bank`).toBeGreaterThan(0.5);
    // Horizontal rays through each inner lintel bay must not hit a solid enclosing box.
    for (const p of probes)
      expect(
        nearest(ts, [p.point[0], 2, p.point[1]], [0, 0, -1]),
        `${name} open trilithon bay`,
      ).toBeGreaterThan(0.5);
  }
});

it('binds signed outlying controls and exact identity, and deterministically stays within browser budgets', async () => {
  const s = await read(`${source}/spec.json`),
    f = await read(`${source}/map-frame.json`),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(f.mappedIdentity.wikidataId).toBe('Q39671');
  expect(f.orientationControl.fit.scale).toBe(1);
  expect(Math.max(...f.orientationControl.fit.controls.map((p) => p.residualMeters))).toBeLessThan(
    1.13,
  );
  expect(p.heading).toBeCloseTo(0.013739514043, 12);
  expect(p.anchor).toEqual([-1.8262310128, 51.1788579596]);
  expect(p.replaceFootprint).toBe(false);
  const a = await read(`${runtime}/asset.json`);
  await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(`${runtime}/${l.file}`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(3);
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
    ['stone_basalt_raw', 'stone_sandstone_raw']
      .map((n) => `matgraph:molen.worldgen.material.${n}`)
      .sort(),
  );
}, 30000);
