import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u3c/karnan'),
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

it('preserves exact detailed source bytes and resolves the southwest entrance and northwest privy from the actual map frame', async () => {
  const s = await read(source + '/spec.json'),
    frame = await read(source + '/map-frame.json'),
    live = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.mesh.triangles).toBe(76762);
  expect(s.sourceGeometry).toBeUndefined();
  expect(live.heading).toBeCloseTo(0.909308291221, 12);
  expect(live.anchor).toEqual([12.697479224, 56.04827929]);
  expect(live.datum).toBe('terrain');
  expect(live.replaceFootprint).toBe(false);
  expect(frame.coordinateSpace).toBe('model-local-xz');
  expect(frame.mappedIdentity.featureIds).toEqual(['way/236992894']);
  const placed = sourceLocalFootprint(s, await readFile(source + '/map-frame.json'));
  expect(placed.footprint[0][0]).toBeCloseTo(12.6973497, 6);
  expect(placed.footprint[0][1]).toBeCloseTo(56.0482621, 6);
  expect(s.sourceFacts.mainBattlementHeightMeters).toBe(34.5);
});
it('retains the mast, main battlements, open terrace floor, privy and supported elevated stair at every distance', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const bytes = await readFile(runtime + '/model.' + name + '.glb'),
      g = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))),
      ts = geometry(bytes),
      positions = g.meshes
        .flatMap((m) => m.primitives)
        .map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...positions.map((p) => p.max[1])), name + ' mast').toBeCloseTo(44.08, 3);
    expect(Math.min(...positions.map((p) => p.min[1])), name + ' footing').toBe(0);
    expect(nearest(ts, [8.7, 40, 8], [0, -1, 0]), name + ' eight main merlons').toBeCloseTo(5.5, 2);
    expect(nearest(ts, [0, 40, 3], [0, -1, 0]), name + ' open roof floor').toBeCloseTo(7.4, 2);
    expect(nearest(ts, [1.3, 15, -12], [0, 0, 1]), name + ' northwest privy').toBeGreaterThan(2.6);
    expect(nearest(ts, [1.3, 15, -12], [0, 0, 1]), name + ' northwest privy').toBeLessThan(3);
    const stair = nearest(ts, [-13, 10, 0.7], [0, -1, 0]);
    expect(stair, name + ' stair support').toBeGreaterThan(4);
    expect(stair, name + ' stair support').toBeLessThan(10);
    if (name !== 'skyline')
      expect(nearest(ts, [-15, 6.5, 0.63], [1, 0, 0]), name + ' recessed entrance').toBeGreaterThan(
        8.8,
      );
  }
});
it('regenerates identical four-level bytes within all transfer, triangle, draw and separate-stream limits', async () => {
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
    ['brick', 'stone_sandstone_raw', 'metal_painted', 'wood_plain', 'concrete_plain', 'slate']
      .map((n) => 'matgraph:molen.worldgen.material.' + n)
      .sort(),
  );
});
