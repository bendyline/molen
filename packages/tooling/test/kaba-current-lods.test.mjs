import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross as meshCross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { heritageTowers } from '../../worldgen/scripts/heritage-tower-models.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/tj/tjm/n0575_ka_ba_ye_zartosht'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p)),
  hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
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

it('reproduces the preserved14038-triangle draft and binds the measured north-northwest axis', async () => {
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
    draft = heritageTowers.find((s) => s.planId === 'N0575');
  draft.build(wrap(b, used, draft.componentMap));
  const m = b.finalize(),
    materials = m.groups.map((g) => {
      const s = used.get(`${g.slot}:${g.materialRef}`);
      return {
        name: `${s.graph ?? 'recess'}-${s.slot}`,
        roughness: s.roughness,
        metallic: s.metallic ?? 0,
        ...(s.graph ? { sharedSurface: { ref: g.materialRef, slot: g.slot, uv: 'repeats' } } : {}),
      };
    }),
    s = await read(`${source}/spec.json`),
    scope = await read(`${source}/review-scope.json`),
    frame = await read(`${source}/map-frame.json`),
    live = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(hash(Buffer.from(encodeGlb(m, materials, `Molen original researched ${s.title}`)))).toBe(
    scope.sourceFacts.originalMasterHash,
  );
  expect(m.triangleCount).toBe(14038);
  expect(s.sourceGeometry.export).toBe('buildKabaReviewed');
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(s.mesh.sha256).toBe(hash(await readFile(`${source}/models/source.glb`)));
  expect(live.heading).toBeCloseTo((-162 * Math.PI) / 180, 12);
  expect(live.anchor).toEqual([52.8740303, 29.9884865]);
  expect(live.datum).toBe('terrain');
  expect(live.replaceFootprint).toBe(false);
  expect(frame.mappedIdentity.wikidataId).toBe('Q2363092');
  expect(frame.coordinateSpace).toBe('model-local-xz');
  expect(frame.orientationControl.uncertaintyDegrees).toBe(3);
  expect(frame.geometry.outline[8]).toEqual(frame.geometry.outline[0]);
  expect(
    sourceLocalFootprint(s, await readFile(`${source}/map-frame.json`)).footprint,
  ).toHaveLength(9);
});
it('retains the complete tower, deep north door, missing upper stair and asymmetric displaced roof at all four levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(`${runtime}/model.${name}.glb`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
      ts = geometry(b),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1])), `${name} whole roof`).toBeCloseTo(14.12, 4);
    expect(Math.min(...ps.map((p) => p.min[1])), `${name} original ground`).toBe(0);
    expect(nearest(ts, [0, 8.2, 20], [0, 0, -1]), `${name} deep surviving doorway`).toBeCloseTo(
      18.2,
      3,
    );
    expect(
      nearest(ts, [0, 5, 5.8], [0, -1, 0]),
      `${name} absent complete upper stair`,
    ).toBeGreaterThan(4);
    expect(
      nearest(ts, [3.6, 16, 4.2], [0, -1, 0]),
      `${name} west end of displaced north slab`,
    ).toBeGreaterThan(2);
    expect(nearest(ts, [3.6, 16, 4.2], [0, -1, 0])).toBeLessThan(2.3);
    expect(
      nearest(ts, [-3.6, 16, 4.2], [0, -1, 0]),
      `${name} east end not displaced60cm`,
    ).toBeGreaterThan(14);
    for (const x of [-1.61, 1.61]) {
      const h = nearest(ts, [x, 8, -10], [0, 0, 1]);
      expect(h, `${name} closed south false window`).toBeGreaterThan(
        name === 'skyline' ? 6.36 : 6.45,
      );
      expect(h).toBeLessThan(name === 'skyline' ? 6.4 : 6.56);
    }
    if (name === 'street' || name === 'closeup')
      expect(
        nearest(ts, [-2.03, 5.1, 10], [0, 0, -1]),
        `${name} physical4cm decorative recess`,
      ).toBeCloseTo(6.39, 3);
  }
});
it('rebuilds exact four-level bytes within triangle/draw/download budgets with one shared limestone grain graph and separate GPU streams', async () => {
  const a = await read(`${runtime}/asset.json`),
    before = await Promise.all(a.runtimeLods.levels.map((l) => readFile(`${runtime}/${l.file}`)));
  await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect((await read(`${runtime}/asset.json`)).runtimeLods).toEqual(a.runtimeLods);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(`${runtime}/${l.file}`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(b.equals(before[i])).toBe(true);
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
    ['stone_limestone_raw'].map((n) => `matgraph:molen.worldgen.material.${n}`).sort(),
  );
}, 30000);
