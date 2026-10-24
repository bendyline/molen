import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildVorontsov } from '../../worldgen/scripts/lighthouse-blacksea-models.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u8/u8m/vorontsov_lighthouse'),
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
  Math.min(...ts.map((p) => hit(o, d, p)).filter((t) => t !== null && t > 0));

it('preserves the exact operator-photo source and signed sea-level pier placement', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')(),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
    });
  buildVorontsov(a.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim'], 32);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(p.anchor).toEqual([30.7600343, 46.4965348]);
  expect(p.heading).toBe(0.5);
  expect(p.datum).toBe('sea-level');
  expect(p.elevation).toBe(0);
  expect(p.replaceFootprint).toBe(false);
  expect(f.geometry.centerlines).toHaveLength(2);
  expect(f.geometry.centerlines.map((l) => l.length)).toEqual([8, 12]);
  const [x, z] = f.geometry.centerlines[0][0],
    c = Math.cos(p.heading),
    sn = Math.sin(p.heading),
    meters = 111319.49079327358;
  expect(
    p.anchor[0] + (x * c + z * sn) / (meters * Math.cos((p.anchor[1] * Math.PI) / 180)),
  ).toBeCloseTo(30.7603345, 9);
  expect(p.anchor[1] - (-x * sn + z * c) / meters).toBeCloseTo(46.4962604, 9);
  expect(f.mappedIdentity.featureIds).toContain('node/703128124');
  expect(s.sourceFacts.towerHeightMeters).toBe(26);
  expect(s.sourceFacts.focalHeightMeters).toBe(27);
});
it('retains supported asymmetric quay, full tower, recessed harbor facade and access stair across browser distances', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 35, 0], [0, -1, 0]), name + ' full main mast').toBeGreaterThan(3.7);
    expect(nearest(ts, [0, 35, 0], [0, -1, 0]), name + ' full main mast').toBeLessThan(5.7);
    expect(nearest(ts, [2, 10, 6], [0, -1, 0]), name + ' supported service deck').toBeCloseTo(6, 4);
    expect(nearest(ts, [2.5, 10, 13], [0, -1, 0]), name + ' descending stair').toBeGreaterThan(6.7);
    expect(nearest(ts, [2.5, 10, 13], [0, -1, 0]), name + ' descending stair').toBeLessThan(7.2);
    if (name !== 'skyline')
      expect(nearest(ts, [0, 5, 5], [0, 0, -1]), name + ' recessed tower door').toBeGreaterThan(
        2.9,
      );
  }
});
it('rebuilds exact four derivatives with four shared graphs, strict budgets and separate position streams', async () => {
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
    ['plaster_lime', 'stone', 'metal_painted', 'concrete_plain']
      .map((n) => 'matgraph:molen.worldgen.material.' + n)
      .sort(),
  );
});
