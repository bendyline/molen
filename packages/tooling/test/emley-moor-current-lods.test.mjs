import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { emleyMoor } from '../../worldgen/scripts/emley-moor-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve(
    '../../content/worldgen/source/places/gc/gcw/n1006_emley_moor_transmitting_station',
  ),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p)),
  hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
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
  Math.min(...ts.map((p) => hit(o, d, p)).filter((t) => t !== null && t > 0));

it('keeps all four north platforms, twenty turret bays and the full modern antenna envelope at every level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    const values = ts.flat(1).map((p) => p[1]);
    expect(values.reduce((a, b) => Math.max(a, b), -Infinity)).toBeCloseTo(319, 4);
    expect(values.reduce((a, b) => Math.min(a, b), Infinity)).toBe(0);
    for (const y of [27.4, 33.5, 39.6, 45.7])
      expect(nearest(ts, [1.7, y + 2, -12.5], [0, -1, 0]), name + ' north platform ' + y).toBeCloseTo(
        2,
        3,
      );
    for (let i = 0; i < 20; i++) {
      const a = ((i + 0.5) * 2 * Math.PI) / 20,
        hit = nearest(
          ts,
          [12 * Math.sin(a), 265.5, 12 * Math.cos(a)],
          [-Math.sin(a), 0, -Math.cos(a)],
        );
      expect(hit, name + ' turret bay ' + i).toBeGreaterThan(5);
      expect(hit).toBeLessThan(5.2);
    }
  }
});
it('reproduces the exact historical source and binds compass controls without stretching to the smaller map ring', async () => {
  const gen = await readFile('../worldgen/scripts/generate-heritage-towers.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')();
  const wrap = Function(
    'normalize',
    'cross',
    'surfaces',
    'MATERIAL_REPEAT_METERS',
    gen.slice(gen.indexOf('function wrap('), gen.indexOf('async function emit(')) + 'return wrap;',
  )(normalize, cross, surfaces, MATERIAL_REPEAT_METERS);
  const b = new MeshBufferBuilder(),
    used = new Map();
  emleyMoor.build(wrap(b, used));
  const m = b.finalize();
  emleyMoor.decorateMesh(m);
  const bytes = Buffer.from(
    encodeGlb(
      m,
      m.groups.map((g) => {
        const s = used.get(g.slot + ':' + g.materialRef);
        return {
          name: (s.graph ?? 'recess') + '-' + s.slot,
          roughness: s.roughness,
          metallic: s.metallic ?? 0,
          ...(s.graph
            ? { sharedSurface: { ref: g.materialRef, slot: g.slot, uv: 'repeats' } }
            : {}),
        };
      }),
      'Molen original researched ' + emleyMoor.title,
    ),
  );
  expect(hash(bytes)).toBe(
    (await read(source + '/review-scope.json')).sourceFacts.originalMasterHash,
  );
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(p.anchor).toEqual([-1.664470242105263, 53.61206580526316]);
  expect(p.heading).toBe(0);
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(f.orientationControl.platformBearingDegrees).toBe(0);
  expect(f.orientationControl.crossedRackBearingDegrees).toBe(0);
  expect(f.orientationControl.troughBearingDegrees).toBe(270);
  expect(f.geometry.outline.length).toBeGreaterThan(12);
  expect(s.sourceFacts.reportedPost2021HeightMeters).toBeNull();
  expect(s.sourceFacts.modeledModernEnvelopeMeters).toBe(319);
  expect(s.sourceFacts.baseDiameterMeters).toBe(24.38);
});
it('rebuilds exact deterministic budgeted derivatives with shared textures and separate position/normal streams', async () => {
  const a = await read(runtime + '/asset.json'),
    before = await Promise.all(a.runtimeLods.levels.map((l) => readFile(runtime + '/' + l.file)));
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect((await read(runtime + '/asset.json')).runtimeLods).toEqual(a.runtimeLods);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(runtime + '/' + l.file),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(b.equals(before[i])).toBe(true);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) refs.add(m.extras.molenSurface.ref);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const ps = g.accessors[p.attributes.POSITION],
          ns = g.accessors[p.attributes.NORMAL];
        expect(ps.bufferView).not.toBe(ns.bufferView);
        expect(g.bufferViews[ps.bufferView].byteStride ?? 12).toBe(12);
      }
  }
  expect([...refs].sort()).toEqual(
    ['metal_painted', 'concrete_plain', 'metal_copper']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
