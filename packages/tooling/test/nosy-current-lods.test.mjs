import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildNosyAlanana } from '../../worldgen/scripts/lighthouse-final-coastal-models.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/mh/mhg/n0662_nosy_alanana_light'),
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
  Math.min(...ts.map((p) => hit(o, d, p)).filter((t) => t !== null && t > 0));

it('preserves the historical source recipe while binding reviewed repair and an explicitly approximate north-northeast entrance', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')(),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
    });
  buildNosyAlanana(a.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim'], 32);
  const s = await read(source + '/spec.json'),
    scope = await read(source + '/review-scope.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(s.sourceGeometry.export).toBe('buildNosyReviewed');
  expect(p.anchor).toEqual([49.4600634, -18.0488027]);
  expect(p.heading).toBe(2.7);
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(f.coordinateSpace).toBe('model-local-xz');
  expect(f.geometry.outline).toHaveLength(0);
  expect(f.geometry.point).toEqual([0, 0]);
  expect(f.geometry.centerlines).toHaveLength(0);
  expect(f.mappedIdentity.featureIds).toEqual(['node/5316362054']);
  expect(f.orientationControl.uncertaintyDegrees).toBe(20);
  expect(f.orientationControl.basis).toContain('parallax');
  expect(s.sourceFacts.heightMeters).toBe(60);
});
it('retains full sixty-metre mast, supported canopy, connected landing and sixteen recessed staggered openings across near models', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 65, 0], [0, -1, 0]), name + ' full aerial').toBeCloseTo(5, 4);
    expect(nearest(ts, [0, 2, 4.8], [0, -1, 0]), name + ' connected podium landing').toBeCloseTo(
      1.2,
      4,
    );
    expect(nearest(ts, [0, 5, 4], [0, -1, 0]), name + ' supported entrance canopy').toBeCloseTo(
      1.8,
      4,
    );
    if (name === 'skyline') continue;
    expect(
      nearest(ts, [0.29, 1.8, 6], [0, 0, -1]),
      name + ' exposed recessed wooden door',
    ).toBeCloseTo(2.755, 4);
    for (let j = 0; j < 8; j++)
      for (const [f, y] of [
        [j % 2, 5.2 + j * 5.65],
        [4 + (j % 2), 7.9 + j * 5.65],
      ]) {
        const height = y + 0.2,
          a = (f * Math.PI) / 4,
          c = Math.cos(a),
          sn = Math.sin(a),
          r = 3.55 - ((height - 0.8) * 1.73) / 52.1,
          dist = nearest(ts, [0.14 * c + 6 * sn, height, -0.14 * sn + 6 * c], [-sn, 0, -c]);
        expect(dist, name + ' recessed opening ' + f + '/' + y).toBeGreaterThan(6 - r + 0.14);
        expect(dist, name + ' backed opening ' + f + '/' + y).toBeLessThan(6 - r + 0.4);
      }
  }
  const master = geometry(await readFile(source + '/models/source.glb'));
  expect(nearest(master, [0, 2, 4.8], [0, -1, 0])).toBeCloseTo(1.2, 4);
  expect(nearest(master, [0.29, 1.8, 6], [0, 0, -1])).toBeCloseTo(2.755, 4);
});
it('regenerates four identical budgeted levels using four shared graphs and separate twelve-byte GPU position streams', async () => {
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
    ['plaster_lime', 'metal_painted', 'wood_plain', 'concrete_plain']
      .map((n) => 'matgraph:molen.worldgen.material.' + n)
      .sort(),
  );
});
