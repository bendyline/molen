import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildLindesnesMaster } from '../../worldgen/scripts/lindesnes-detail-model.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u4/u4m/lindesnes_lighthouse'),
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

const housePoint = ([x, y, z]) => [
  x * Math.cos(0.157) + z * Math.sin(0.157) - 1.22,
  y,
  -x * Math.sin(0.157) + z * Math.cos(0.157) - 7.66,
];
const houseDirection = ([x, y, z]) => [
  x * Math.cos(0.157) + z * Math.sin(0.157),
  y,
  -x * Math.sin(0.157) + z * Math.cos(0.157),
];
it('retains the open gallery, full16.1m tip and reconstructed north vestibule at every browser level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 17, 0], [0, -1, 0]), name + ' conductor tip').toBeCloseTo(0.9, 4);
    expect(nearest(ts, [2.8, 12, 0], [0, -1, 0]), name + ' open gallery deck').toBeCloseTo(3.31, 4);
    expect(nearest(ts, [0.36, 9, 4], [0, 0, -1]), name + ' gallery clear gap').toBeGreaterThan(1.9);
    expect(
      nearest(ts, housePoint([-4.25, 10, 3.5]), [0, -1, 0]),
      name + ' vestibule roof',
    ).toBeCloseTo(7.03, 4);
  }
});
it('keeps round continuous pressure-vessel bodies and a true tower-door recess in district and near levels', async () => {
  for (const name of ['district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0.1, 2, 4], [0, 0, -1]), name + ' main door back').toBeCloseTo(1.52, 4);
    for (const x of [-2.7, 2.7]) {
      expect(
        nearest(ts, housePoint([x, 1.6, -6.5]), houseDirection([0, 0, 1])),
        name + ' round vessel mid-body',
      ).toBeCloseTo(1.03, 4);
      expect(
        nearest(ts, housePoint([x + 0.5, 4, -4.6]), [0, -1, 0]),
        name + ' full vessel top',
      ).toBeCloseTo(1.53, 4);
    }
  }
});
it('reproduces the original master mesh and uses mapped main entrance to sign the station frame', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')();
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
    });
  buildLindesnesMaster(a.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation', 'wall'], 32);
  expect(m.triangleCount).toBe(57082);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(p.anchor).toEqual([7.0466733, 57.9824978]);
  expect(p.heading).toBe(-3.0647546436407804);
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(f.mappedIdentity.entranceNative[0]).toBeCloseTo(0, 8);
  expect(f.mappedIdentity.entranceNative[1]).toBeGreaterThan(3);
  expect(f.geometry.outlines[1].every((p) => p[1] < -2)).toBe(true);
  expect(s.sourceFacts.heightMeters).toBe(16.1);
  expect(f.heightControl.mappedLightFocalHeightMeters).toBe(66.1);
});
it('rebuilds derivatives within every geometry and draw limit using shared surfaces', async () => {
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
  }
  expect([...refs].sort()).toEqual(
    ['wood_painted_lap', 'slate', 'metal_painted', 'wood_plain', 'concrete_plain', 'stone_granite']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
