import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import {
  buildMaiden,
  lighthouseExpansionStudies,
} from '../../worldgen/scripts/lighthouse-expansion-models.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/sx/sxk/n0638_maiden_s_tower'),
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

it('preserves the exact historical source master and uses real fort controls without inventing a tower QID', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')();
  const study = lighthouseExpansionStudies.find((s) => s.id === 'N0638'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
      metricTriangleUv: study.metricTriangleUv,
    });
  buildMaiden(a.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation'], 32);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    scope = await read(source + '/review-scope.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(hash(Buffer.from(encodeGlb(m, a.materials(m.groups), 'Molen original ' + s.title)))).toBe(
    scope.sourceFacts.originalMasterHash,
  );
  expect(scope.sourceFacts.originalMasterHash).toBe(
    'sha256:edc07774f5ba692057bb7c1ff2a5434e52ac14466f05501839bf8a372fc4f4b0',
  );
  expect(p.anchor).toEqual([29.004089875, 41.021059]);
  expect(p.heading).toBe(1.721295251);
  expect(p.replaceFootprint).toBe(false);
  expect(f.geometry.outline).toHaveLength(5);
  const [x, z] = f.geometry.outline[0],
    c = Math.cos(p.heading),
    sn = Math.sin(p.heading),
    meters = 111319.49079327358;
  expect(
    p.anchor[0] + (x * c + z * sn) / (meters * Math.cos((p.anchor[1] * Math.PI) / 180)),
  ).toBeCloseTo(29.0040466, 9);
  expect(p.anchor[1] - (-x * sn + z * c) / meters).toBeCloseTo(41.0210819, 9);
  expect(f.geometry.outlines).toHaveLength(4);
  expect(f.mappedIdentity.siteFeature).toBe('way/103821246');
  expect(f.identityStatus).toContain('no QID');
});
it('keeps the full ensemble at every distance and retains recessed east entry and connected timber stair in near levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 34, 0], [0, -1, 0]), name + ' full mast').toBeCloseTo(1.5, 4);
    expect(nearest(ts, [8, 20, -8], [0, -1, 0]), name + ' west pavilion roof').toBeGreaterThan(
      13.5,
    );
    expect(nearest(ts, [8, 20, -8], [0, -1, 0]), name + ' west pavilion roof').toBeLessThan(15.1);
    if (name !== 'skyline') {
      expect(
        nearest(ts, [0, 2, 5], [0, 0, -1]),
        name + ' recessed east Fatih entrance',
      ).toBeCloseTo(5 - 3.2 + (0.45 * 6.4) / 7.6, 4);
      expect(
        nearest(ts, [9.3, 7, 8.35], [0, -1, 0]),
        name + ' top stair joins 4.1m timber deck',
      ).toBeCloseTo(2.9, 4);
    }
  }
});
it('reproduces four exact browser derivatives within strict caps and uses six shared graphs with separate GPU streams', async () => {
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
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const ps = g.accessors[p.attributes.POSITION],
          ns = g.accessors[p.attributes.NORMAL];
        expect(ps.bufferView).not.toBe(ns.bufferView);
        expect(g.bufferViews[ps.bufferView].byteStride ?? 12).toBe(12);
      }
  }
  expect([...refs].sort()).toEqual(
    ['stone_ashlar', 'plaster_lime', 'tile_ceramic', 'metal_painted', 'wood_plain', 'stone_granite']
      .map((n) => 'matgraph:molen.worldgen.material.' + n)
      .sort(),
  );
});
