import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildEclaireursMaster } from '../../worldgen/scripts/eclaireurs-browser-model.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve(
    '../../content/worldgen/source/places/4q/4qp/n0657_les_eclaireurs_lighthouse',
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

it('keeps the recessed doorway, open gallery, paired inclined panels and full11m tip in all browser levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 1.1, 2], [0, 0, -1]), name + ' recessed wooden door').toBeCloseTo(
      0.78,
      4,
    );
    expect(nearest(ts, [0.9, 12, 0], [0, -1, 0]), name + ' gallery deck').toBeCloseTo(2.89, 4);
    expect(nearest(ts, [0.3, 9.3, 2], [0, 0, -1]), name + ' open rail gap').toBeGreaterThan(1);
    expect(nearest(ts, [0.3, 9.89, 2], [0, 0, -1]), name + ' top rail').toBeLessThan(1.18);
    expect(nearest(ts, [0, 12, 0], [0, -1, 0]), name + ' complete finial').toBeCloseTo(1, 4);
    for (const x of [-0.43, 0.65])
      expect(
        nearest(ts, [x, 9.6, -2], [0, 0, 1]),
        name + ' inclined panel above middle rail',
      ).toBeCloseTo(1.234528302, 4);
  }
});
it('reproduces the original source master and keeps unresolved doorway bearing out of active placement', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = ');
  const surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')();
  const b = new MeshBufferBuilder(),
    authoring = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
    });
  buildEclaireursMaster(authoring.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation', 'wall'], 32);
  expect(m.triangleCount).toBe(8320);
  expect(
    hash(
      Buffer.from(
        encodeGlb(m, authoring.materials(m.groups), 'Molen original Les Éclaireurs Lighthouse'),
      ),
    ),
  ).toBe('sha256:738d6fada7a6d09478850bb02aa34b5013a70907662f19fd4865b9ceceddd074');
  const s = await read(source + '/spec.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.sourceFacts.heightMeters).toBe(11);
  expect(s.geographicProposal.anchor).toEqual([-68.0832452, -54.8715452]);
  expect(s.geographicProposal.heading).toBeNull();
  expect(s.geographicProposal.status).toBe('orientation-review');
  expect(p.status).toBe('draft');
  expect(p.replaceFootprint).toBe(false);
});
it('rebuilds byte-identical budgeted levels with three shared graphs and no embedded images', async () => {
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
  }
  expect([...refs].sort()).toEqual(
    ['plaster_lime', 'metal_painted', 'wood_plain']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
