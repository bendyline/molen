import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildRumeliMaster } from '../../worldgen/scripts/rumeli-detail-model.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/sx/sxk/n0670_rumeli_feneri'),
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

const yaw = Math.atan2(-2.8, 1.04),
  entry = ([x, y, z]) => [
    x * Math.cos(yaw) + z * Math.sin(yaw) - 3.93,
    y,
    -x * Math.sin(yaw) + z * Math.cos(yaw) + 1.74,
  ],
  towardDoor = [-Math.sin(yaw), 0, -Math.cos(yaw)];
it('renders outward-facing gallery/tier tops, open cage and complete mast at all four levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 34, 0], [0, -1, 0]), name + ' full mast').toBeCloseTo(0.2, 4);
    expect(nearest(ts, [2, 31, 0], [0, -1, 0]), name + ' repaired gallery top').toBeCloseTo(
      5.955,
      4,
    );
    expect(nearest(ts, [4, 12, 0], [0, -1, 0]), name + ' lower ledge top').toBeCloseTo(1.23, 4);
    expect(nearest(ts, [0.6, 28.4, 4], [0, 0, -1]), name + ' cage air gap').toBeGreaterThan(3);
    const door = nearest(ts, entry([0.2, 1.1, 2]), towardDoor);
    expect(door, name + ' real door depth').toBeGreaterThan(2.15);
    expect(door).toBeLessThan(2.3);
  }
});
it('reproduces the historical inward-wound source exactly while preserving the reviewed mapped identity and dimensions', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')();
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
    });
  buildRumeliMaster(a.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation'], 32);
  expect(m.triangleCount).toBe(21710);
  expect(
    nearest(
      geometry(Buffer.from(encodeGlb(m, a.materials(m.groups), 'Molen original Rumeli Feneri'))),
      [2, 31, 0],
      [0, -1, 0],
    ),
  ).toBeCloseTo(6.05, 4);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(p.anchor).toEqual([29.11214925, 41.23422865]);
  expect(p.heading).toBe(0);
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(f.geometry.outline).toHaveLength(9);
  expect(f.orientationControl.doorFace).toBe(7);
  expect(s.sourceFacts.towerHeightMeters).toBe(30);
  expect(s.sourceFacts.focalElevationMeters).toBe(58);
  expect(s.sourceFacts.modeledRadarMastHeightMeters).toBe(33.8);
});
it('rebuilds exact deterministic budgeted derivatives with shared textures and separate position/normal streams', async () => {
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
    ['plaster_lime', 'stone_limestone', 'metal_painted', 'stone_granite', 'wood_plain']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
