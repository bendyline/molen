import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildRoterSandMaster } from '../../worldgen/scripts/roter-sand-detail-model.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u1/u1t/n1007_roter_sand'),
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

const height = (y) => 12.65 + ((y - 12.3) * (16.95 - 12.65)) / (16.6 - 12.3);
it('keeps the full offshore ensemble and closes square corners around truly recessed portholes', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 32, 0], [0, -1, 0]), name + ' full finial').toBeCloseTo(1.05, 4);
    const distance = 0.95 / Math.sqrt(2) + Math.sqrt(2.55 * 2.55 - (0.95 * 0.95) / 2);
    for (const a of [0, (-5 * Math.PI) / 8, (3 * Math.PI) / 4]) {
      const hit = nearest(
        ts,
        [(distance + 2) * Math.sin(a), 22.5, (distance + 2) * Math.cos(a)],
        [-Math.sin(a), 0, -Math.cos(a)],
      );
      expect(hit, name + ' all three projecting bays').toBeGreaterThan(0.8);
      expect(hit).toBeLessThan(1.3);
    }
    if (name === 'street' || name === 'closeup') {
      const pane = nearest(ts, [0, height(13.8), 4], [0, 0, -1]);
      expect(pane, name + ' recessed porthole').toBeGreaterThan(1.2);
      expect(pane).toBeLessThan(1.25);
      for (const x of [-0.17, 0.17])
        for (const y of [-0.17, 0.17]) {
          const wall = nearest(ts, [x, height(13.8 + y), 4], [0, 0, -1]);
          expect(wall, name + ' no corner gap').toBeGreaterThan(1.05);
          expect(wall).toBeLessThan(1.14);
        }
    }
  }
});
it('preserves the exact original master separately from the surveyed caisson/bay/aperture refinements', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')();
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
      metricTriangleUv: true,
    });
  buildRoterSandMaster(a.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation'], 32);
  expect(hash(Buffer.from(encodeGlb(m, a.materials(m.groups), 'Molen original Roter Sand')))).toBe(
    (await read(source + '/review-scope.json')).sourceFacts.originalMasterHash,
  );
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(p.anchor).toEqual([8.0821686, 53.8531662]);
  expect(p.heading).toBe(0);
  expect(p.datum).toBe('sea-level');
  expect(p.elevation).toBe(-2.05);
  expect(p.replaceFootprint).toBe(false);
  expect(f.orientationControl.bayBearingsDegrees).toEqual([180, 292.5, 45]);
  expect(f.geometry.outline).toHaveLength(65);
  expect(s.sourceFacts.bayExposedArcDegrees).toBe(270);
  expect(s.sourceFacts.reviewedCaisson.circleRadiusMeters).toBe(7.3);
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
    if (i > 0)
      expect(
        g.materials.some(
          (m) => m.alphaMode === 'BLEND' && m.pbrMetallicRoughness.baseColorFactor[3] === 0.22,
        ),
      ).toBe(true);
  }
  expect([...refs].sort()).toEqual(
    ['metal_painted', 'wood_plain'].map((g) => 'matgraph:molen.worldgen.material.' + g).sort(),
  );
});
