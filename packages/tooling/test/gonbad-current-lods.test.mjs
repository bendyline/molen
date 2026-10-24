import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross as meshCross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { heritageTowers } from '../../worldgen/scripts/heritage-tower-models.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/tn/tnx/gonbad_e_qabus'),
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

it('reproduces the unchanged Gonbad draft and binds the published east-facing entrance', async () => {
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
    draft = heritageTowers.find((s) => s.planId === 'gonbad_e_qabus');
  draft.build(wrap(b, used, draft.componentMap));
  const s = await read(`${source}/spec.json`),
    scope = await read(`${source}/review-scope.json`),
    frame = await read(`${source}/map-frame.json`),
    live = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.sourceGeometry.export).toBe('buildGonbadReviewed');
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(live.heading).toBeCloseTo(Math.PI / 2, 12);
  expect(live.anchor).toEqual([55.169013207, 37.258093443]);
  expect(live.datum).toBe('terrain');
  expect(live.replaceFootprint).toBe(false);
  expect(frame.mappedIdentity.wikidataId).toBe('Q606763');
  expect(frame.coordinateSpace).toBe('model-local-xz');
  expect(frame.orientationControl.uncertaintyDegrees).toBe(10);
  expect(frame.geometry.outline[64]).toEqual(frame.geometry.outline[0]);
  expect(
    sourceLocalFootprint(s, await readFile(`${source}/map-frame.json`)).footprint,
  ).toHaveLength(65);
});
it('keeps ten tapered flanges, the whole measured cone, deep pointed entrance and closed roof light at every level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(runtime + '/model.' + name + '.glb'),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
      ts = geometry(b),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1])), name + ' full measured52.844m tip').toBeCloseTo(
      52.844,
      4,
    );
    expect(Math.min(...ps.map((p) => p.min[1])), name + ' summit ground').toBe(0);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + Math.PI / 10 - (i * 2 * Math.PI) / 10,
        d = [-Math.cos(a), 0, -Math.sin(a)];
      expect(
        nearest(ts, [20 * Math.cos(a), 20, 20 * Math.sin(a)], d),
        name + ' flange' + i,
      ).toBeCloseTo(20 - (8.648 - ((8.648 - 7.729) * 20) / 36), 1);
    }
    const door = nearest(ts, [0, 2, 20], [0, 0, -1]);
    expect(door, name + ' entrance is recessed, not filled at exterior').toBeGreaterThan(15.65);
    expect(door, name + ' entrance has opaque rear/wood infill').toBeLessThan(15.8);
    const light = nearest(ts, [0, 41, 20], [0, 0, -1]);
    expect(light, name + ' roof-light recess').toBeGreaterThan(14.4);
    expect(light, name + ' roof-light closed backing').toBeLessThan(15.7);
    const foot = nearest(ts, [0, 1, 8.7], [0, -1, 0]);
    expect(foot, name + ' lower approach step').toBeCloseTo(0.8, 3);
  }
  const ts = geometry(await readFile(runtime + '/model.closeup.glb'));
  expect(
    nearest(ts, [0.61, 4.5, 10], [0, 0, -1]),
    'right entrance niche has physical closed recess',
  ).toBeGreaterThan(5.4);
  expect(nearest(ts, [0.61, 4.5, 10], [0, 0, -1])).toBeLessThan(5.6);
});
it('rebuilds exact four-level bytes within triangle/draw/download budgets with shared brick and wood graphs and separate GPU streams', async () => {
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
    ['brick', 'wood_plain'].map((n) => `matgraph:molen.worldgen.material.${n}`).sort(),
  );
}, 30000);
