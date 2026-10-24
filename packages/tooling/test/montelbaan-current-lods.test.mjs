import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross as meshCross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { montelbaanstoren } from '../../worldgen/scripts/montelbaanstoren-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u1/u17/montelbaanstoren'),
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

it('reproduces the untouched historical draft and binds the signed land entrance to the asymmetric mapped foot', async () => {
  const gen = await readFile('../worldgen/scripts/generate-heritage-towers.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')(),
    wrap = Function(
      'surfaces',
      'normalize',
      'cross',
      'MATERIAL_REPEAT_METERS',
      'return (' +
        gen.slice(gen.indexOf('function wrap('), gen.indexOf('async function emit')) +
        ')',
    )(surfaces, normalize, meshCross, MATERIAL_REPEAT_METERS),
    b = new MeshBufferBuilder(),
    used = new Map();
  montelbaanstoren.build(wrap(b, used, montelbaanstoren.componentMap));
  const m = b.finalize();
  montelbaanstoren.decorateMesh(m);
  const s = await read(source + '/spec.json'),
    scope = await read(source + '/review-scope.json'),
    frame = await read(source + '/map-frame.json'),
    live = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(m.triangleCount).toBe(123692);
  expect(s.sourceGeometry.export).toBe('buildMontelbaanReviewed');
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(live.heading).toBeCloseTo(1.407879250402, 12);
  expect(live.anchor).toEqual([4.905663475, 52.372039158]);
  expect(live.datum).toBe('terrain');
  expect(live.replaceFootprint).toBe(false);
  expect(frame.mappedIdentity.featureIds).toEqual(['way/57864086']);
  const captured = sourceLocalFootprint(s, await readFile(source + '/map-frame.json'));
  expect(frame.geometry.outline).toHaveLength(42);
  expect(captured.footprint).toHaveLength(43);
  expect(captured.footprint[42]).toEqual(captured.footprint[0]);
  expect(frame.mappedIdentity.wikidataId).toBe('Q1946061');
  expect(frame.orientationControl.uncertaintyDegrees).toBe(20);
  expect(s.sourceFacts.sectionGroundToTipMeters).toBe(42.05);
  expect(s.sourceFacts.historicalReportedHeightMeters).toBe(48);
});
it('retains ground-level land entry, filled niches, complete crown and physically open lanterns', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(runtime + '/model.' + name + '.glb'),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
      ts = geometry(b),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1])), name + ' whole crown').toBeCloseTo(42.05, 4);
    expect(Math.min(...ps.map((p) => p.min[1])), name + ' pavement datum').toBe(0);
    expect(nearest(ts, [-2.036, 1, -13], [0, 0, 1]), name + ' land doorway').toBeGreaterThan(7.3);
    expect(nearest(ts, [-2.036, 1, -13], [0, 0, 1]), name + ' land doorway').toBeLessThan(7.6);
    for (const y of [27.5, 33.8])
      expect(nearest(ts, [0, y, 8], [0, 0, -1]), name + ' open lantern at ' + y).toBe(Infinity);
    if (name !== 'skyline') {
      expect(nearest(ts, [0, 17, 8], [0, 0, -1]), name + ' brick niche back').toBeGreaterThan(4);
      expect(nearest(ts, [0, 17, 8], [0, 0, -1]), name + ' brick niche back').toBeLessThan(4.2);
    }
  }
});
it('regenerates identical four-level bytes within all triangle/draw/download budgets and uses six shared graphs without duplicated GPU streams', async () => {
  const a = await read(runtime + '/asset.json');
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(runtime + '/' + l.file),
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
    ['brick', 'stone_limestone', 'metal_painted', 'wood_plain']
      .map((n) => 'matgraph:molen.worldgen.material.' + n)
      .sort(),
  );
});
