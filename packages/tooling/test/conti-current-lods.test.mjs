import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross as meshCross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import { torreDeiConti } from '../../worldgen/scripts/torre-dei-conti-model.mjs';
import { createStructureIndex } from '../../worldgen-earth/dist/kernel.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/sr/sr2/torre_dei_conti'),
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

it('reproduces the unchanged Conti draft and binds the reviewed directed map frame', async () => {
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
    draft = torreDeiConti;
  draft.build(wrap(b, used, draft.componentMap));
  const s = await read(`${source}/spec.json`),
    scope = await read(`${source}/review-scope.json`),
    frame = await read(`${source}/map-frame.json`),
    live = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.sourceGeometry.export).toBe('buildContiReviewed');
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(live.heading).toBeCloseTo(-0.840086736674, 12);
  expect(live.anchor).toEqual([12.487946867, 41.893582146]);
  expect(live.replaceFootprint).toBe(false);
  expect(frame.mappedIdentity.wikidataId).toBe('Q605721');
  expect(frame.geometry.outline[5]).toEqual(frame.geometry.outline[0]);
  expect(
    sourceLocalFootprint(s, await readFile(`${source}/map-frame.json`)).footprint,
  ).toHaveLength(6);
  expect(live.status).toBe('historical');
  expect(live.appearance.currentWorldEligible).toBe(false);
  const index = createStructureIndex({
      format: 'molen/structure-placements@1',
      title: 'Conti dated placement',
      entries: [live],
    }),
    bounds = [12.48, 41.89, 12.5, 41.9];
  expect(index.query(bounds)).toHaveLength(0);
  expect(index.query(bounds, { viewingDate: '2024-09-18' })).toHaveLength(1);
  for (const date of ['2024-09-17', '2024-09-19', '2026-10-09'])
    expect(index.query(bounds, { viewingDate: date })).toHaveLength(0);
  expect(Math.sin(live.heading)).toBeLessThan(0);
  expect(-Math.cos(live.heading)).toBeLessThan(0);
});
it('retains the full intact dated tower, asymmetric buttresses, closed roof and actual entrance at every level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(`${runtime}/model.${name}.glb`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
      ts = geometry(b),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBe(29);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    expect(Math.max(...ps.map((p) => p.max[0]))).toBeGreaterThan(13);
    expect(nearest(ts, [0, 40, 0], [0, -1, 0]), `${name} roof`).toBeCloseTo(12.85, 3);
    expect(nearest(ts, [20, 15, 0.5], [-1, 0, 0]), `${name} southeast rib`).toBeLessThan(9);
    expect(nearest(ts, [-20, 15, 0.5], [1, 0, 0]), `${name} northwest rib`).toBeLessThan(9.1);
    const entry = nearest(ts, [20, 4, 4.62], [-1, 0, 0]);
    if (name === 'skyline') {
      expect(entry).toBeGreaterThan(11.87);
      expect(entry).toBeLessThan(11.9);
    } else {
      expect(entry, `${name} entry is recessed rather than covered by the facade`).toBeGreaterThan(
        12.06,
      );
      expect(entry).toBeLessThan(12.12);
    }
    const aperture = nearest(ts, [-5.3, 11.2, 20], [0, 0, -1]);
    if (name === 'skyline') expect(aperture).toBeCloseTo(12.938, 3);
    else {
      expect(aperture, `${name} window back`).toBeGreaterThan(13.1);
      expect(aperture).toBeLessThan(13.16);
    }
    expect(nearest(ts, [9.7, 10, 4.62], [0, -1, 0]), `${name} access deck`).toBeCloseTo(6.7, 3);
  }
});
it('rebuilds exact four-level bytes within triangle/draw/download budgets with seven canonical shared material graphs and separate GPU streams', async () => {
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
    [
      'brick',
      'plaster_lime',
      'stone_limestone',
      'metal_painted',
      'stone_basalt',
      'concrete_plain',
      'wood_plain',
    ]
      .map((n) => `matgraph:molen.worldgen.material.${n}`)
      .sort(),
  );
}, 30000);
