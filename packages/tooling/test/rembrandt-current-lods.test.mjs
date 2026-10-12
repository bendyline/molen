import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross as meshCross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { rembrandtStudy } from '../../worldgen/scripts/rembrandt-tower-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u1/u17/n0623_rembrandt_tower'),
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

it('reproduces the untouched historical draft and binds the southern entrance to the attributed BAG outline', async () => {
  const gen = await readFile('../worldgen/scripts/generate-signature-towers.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function(`return (${gen.slice(at + 17, gen.indexOf(';', at))})`)(),
    wrap = Function(
      'surfaces',
      'normalize',
      'cross',
      'MATERIAL_REPEAT_METERS',
      'return (' +
        gen.slice(gen.indexOf('function mappedBuilder('), gen.indexOf('async function emit')) +
        ')',
    )(surfaces, normalize, meshCross, MATERIAL_REPEAT_METERS),
    b = new MeshBufferBuilder(),
    used = new Map();
  rembrandtStudy.build(wrap(b, used, rembrandtStudy.surfaceOverrides));
  const m = b.finalize();

  const materials = m.groups.map((group) => {
      const s = used.get(`${group.slot}:${group.materialRef}`);
      return {
        name: `${s.graph ?? group.slot}-${s.slot}`,
        roughness: s.roughness,
        metallic: s.metallic,
        ...(s.opacity !== undefined
          ? { baseColorFactor: [1, 1, 1, s.opacity], alphaMode: 'BLEND', doubleSided: true }
          : {}),
        ...(s.graph
          ? { sharedSurface: { ref: group.materialRef, slot: group.slot, uv: 'repeats' } }
          : {}),
      };
    }),
    s = await read(`${source}/spec.json`),
    scope = await read(`${source}/review-scope.json`),
    frame = await read(`${source}/map-frame.json`),
    live = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(hash(Buffer.from(encodeGlb(m, materials, `Molen original ${s.title}`)))).toBe(
    scope.sourceFacts.originalMasterHash,
  );
  expect(m.triangleCount).toBe(641134);
  expect(s.sourceGeometry.export).toBe('buildRembrandtReviewed');
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(live.heading).toBeCloseTo(0.3589785079857852, 12);
  expect(live.anchor).toEqual([4.917060476756789, 52.34506411408192]);
  expect(live.datum).toBe('terrain');
  expect(live.replaceFootprint).toBe(false);
  expect(frame.mappedIdentity.featureIds).toEqual(['way/44451577']);
  const captured = sourceLocalFootprint(s, await readFile(`${source}/map-frame.json`));
  expect(captured.footprint).toHaveLength(18);
  expect(frame.mappedIdentity.wikidataId).toBe('Q2361620');
  expect(frame.coordinateSpace).toBe('model-local-xz');
  expect(s.sourceFacts.publishedRoofHeightMeters).toBe(135);
  expect(s.sourceFacts.publishedTipHeightMeters).toBe(150);
  expect(s.sourceFacts.entranceLandingReconstructedMeters).toBe(0.45);
  expect(s.mesh.sha256).toBe(hash(await readFile(`${source}/models/source.glb`)));
});
it('retains full beacon, four corner pods, open crown galleries, five canopy columns and raised landing at every level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const bytes = await readFile(`${runtime}/model.${name}.glb`),
      g = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))),
      ts = geometry(bytes),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1])), `${name} full beacon`).toBe(150);
    expect(Math.min(...ps.map((p) => p.min[1])), `${name} ground`).toBe(0);
    for (const x of [-7.1, -3.6, 0, 3.6, 7.1]) {
      const d = nearest(ts, [x + 0.36, 2, 35], [0, 0, -1]);
      expect(d, `${name} canopy column`).toBeGreaterThan(5.7);
      expect(d, `${name} canopy column`).toBeLessThan(6.1);
    }
    expect(nearest(ts, [0.36, 1, 26], [0, -1, 0]), `${name} raised entry steps`).toBeCloseTo(
      0.55,
      3,
    );
    for (const x of [-10.8, 10.8])
      for (const z of [-10.8, 10.8])
        expect(
          nearest(ts, [x + 0.36, 125, z + 0.1], [0, -1, 0]),
          `${name} four crown roofs`,
        ).toBeCloseTo(4.5045, 3);
    expect(nearest(ts, [7.56, 108.5, 25], [0, 0, -1]), `${name} open gallery bay`).toBeGreaterThan(
      12,
    );
  }
});
it('regenerates identical four-level bytes within all triangle/draw/download budgets and uses four shared graphs without duplicated GPU streams', async () => {
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
    if (l.name !== 'skyline') {
      const clear = g.materials.find((m) => m.alphaMode === 'BLEND');
      expect(clear.doubleSided).toBe(true);
      expect(clear.pbrMetallicRoughness.baseColorFactor[3]).toBe(0.52);
    }
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
    ['stone_granite', 'metal_painted', 'concrete_plain', 'metal_stainless']
      .map((n) => `matgraph:molen.worldgen.material.${n}`)
      .sort(),
  );
}, 30000);
