import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross as meshCross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { garniTemple } from '../../worldgen/scripts/garni-temple-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/sz/szp/garni_temple'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
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

it('reproduces the unchanged Garni master and binds the reviewed directed map frame', async () => {
  const gen = await readFile('../worldgen/scripts/generate-heritage-towers.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function(`return (${gen.slice(at + 17, gen.indexOf(';', at))})`)(),
    wrap = Function(
      'surfaces',
      'normalize',
      'cross',
      'MATERIAL_REPEAT_METERS',
      `return (${gen.slice(gen.indexOf('function wrap('), gen.indexOf('async function emit'))})`,
    )(surfaces, normalize, meshCross, MATERIAL_REPEAT_METERS),
    b = new MeshBufferBuilder(),
    used = new Map(),
    draft = garniTemple;
  draft.build(wrap(b, used, draft.componentMap));
  const m = b.finalize();
  draft.decorateMesh(m);
  const s = await read(`${source}/spec.json`),
    scope = await read(`${source}/review-scope.json`),
    frame = await read(`${source}/map-frame.json`),
    live = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.sourceGeometry.export).toBe('buildGarniReviewed');
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(live.heading).toBeCloseTo(-2.886586468439, 12);
  expect(live.anchor).toEqual([44.730218747, 40.11234151]);
  expect(s.geographicProposal.groundModelY).toBe(0);
  expect(live.replaceFootprint).toBe(false);
  expect(frame.mappedIdentity.wikidataId).toBe('Q684072');
  expect(frame.geometry.outline[5]).toEqual(frame.geometry.outline[0]);
  expect(
    sourceLocalFootprint(s, await readFile(`${source}/map-frame.json`)).footprint,
  ).toHaveLength(6);
  expect(-Math.cos(live.heading)).toBeGreaterThan(0.96);
  expect(Math.sin(live.heading)).toBeLessThan(0);
}, 30000);
it('retains all24columns, nine steps, open cella, closed roof and height in all four whole-temple levels', async () => {
  const front = [-5.141, -3.143, -1.084, 1.084, 3.143, 5.141],
    sides = [-5.25, -3.15, -1.05, 1.05, 3.15, 5.25];
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(`${runtime}/model.${level}.glb`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
      ts = geometry(b),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBeCloseTo(13.58, 2);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    for (const x of front) {
      expect(nearest(ts, [x, 5, 20], [0, 0, -1]), `${level} north column ${x}`).toBeGreaterThan(
        12.1,
      );
      expect(nearest(ts, [x, 5, 20], [0, 0, -1])).toBeLessThan(12.9);
      expect(nearest(ts, [x, 5, -20], [0, 0, 1]), `${level} south column ${x}`).toBeGreaterThan(
        12.1,
      );
      expect(nearest(ts, [x, 5, -20], [0, 0, 1])).toBeLessThan(12.9);
    }
    for (const z of sides) {
      expect(nearest(ts, [20, 5, z], [-1, 0, 0]), `${level} east colonnade ${z}`).toBeLessThan(
        15.1,
      );
      expect(nearest(ts, [-20, 5, z], [1, 0, 0]), `${level} west colonnade ${z}`).toBeLessThan(
        15.1,
      );
    }
    const entry = nearest(ts, [0, 5.5, 15], [0, 0, -1]);
    expect(entry, `${level} doorway stays open through the cella`).toBeGreaterThan(19.8);
    expect(entry).toBeLessThan(21.1);
    const lintel = nearest(ts, [0, 7.9, 15], [0, 0, -1]);
    expect(lintel).toBeGreaterThan(10.5);
    expect(lintel).toBeLessThan(12.1);
    for (let i = 0; i < 9; i++) {
      const z = 11.7 - i * 0.39 - 0.195,
        y = ((i + 1) * 2.81) / 9;
      expect(4 - nearest(ts, [0, 4, z], [0, -1, 0]), `${level} step ${i}`).toBeCloseTo(y, 1);
    }
    expect(
      25 - nearest(ts, [1.2, 25, 0], [0, -1, 0]),
      `${level} continuous basalt roof`,
    ).toBeGreaterThan(12.25);
    expect(nearest(ts, [0, 8, 5.8], [0, 1, 0]), `${level} portico soffit/roof`).toBeLessThan(4.9);
  }
});
it('rebuilds exact four-level bytes within budgets with one canonical basalt graph and separate GPU streams', async () => {
  const a = await read(`${runtime}/asset.json`);
  await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
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
    ['stone_basalt_raw'].map((n) => `matgraph:molen.worldgen.material.${n}`).sort(),
  );
}, 120000);
