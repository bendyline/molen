import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildRodsherMaster } from '../../worldgen/scripts/rodsher-detail-model.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/ud/udd/n0672_rodsher'),
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

it('retains the full vane, recessed doorway, four panels and open gallery at every browser level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 21, 0], [0, -1, 0]), name + ' vane tip').toBeCloseTo(0.55, 4);
    expect(nearest(ts, [0.1, 1.1, -4], [0, 0, 1]), name + ' door depth').toBeCloseTo(
      4 - 3.1 * Math.cos(Math.PI / 8) + 0.3,
      4,
    );
    expect(nearest(ts, [2.4, 14.5, 0], [0, -1, 0]), name + ' lower deck').toBeCloseTo(1.28, 4);
    expect(nearest(ts, [1.9, 18, 0], [0, -1, 0]), name + ' upper deck').toBeCloseTo(2.52, 4);
    expect(nearest(ts, [0.25, 13.95, 4], [0, 0, -1]), name + ' rail gap').toBeGreaterThan(2.4);
    for (const x of [-0.7, 0.7])
      for (const y of [3.6, 6.1]) {
        const d = nearest(ts, [x, y, 4], [0, 0, -1]);
        expect(d, name + ' panel surface').toBeGreaterThan(1.06);
        expect(d).toBeLessThan(1.08);
      }
  }
});
it('preserves arched shaft-window recesses, clear lantern glazing and exact original source bytes', async () => {
  for (const name of ['district', 'street', 'closeup']) {
    const b = await readFile(runtime + '/model.' + name + '.glb'),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(
      nearest(geometry(b), [0.06, 9.3, 4], [0, 0, -1]),
      name + ' arched window back',
    ).toBeCloseTo(4 - 2.58 * Math.cos(Math.PI / 8) + 0.3, 4);
    const glass = g.materials.filter((m) => m.alphaMode === 'BLEND');
    expect(glass).toHaveLength(1);
    expect(glass[0].pbrMetallicRoughness.baseColorFactor[3]).toBe(0.22);
  }
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')();
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, {
      metricTriangleUv: true,
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
    });
  buildRodsherMaster(a.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation'], 32);
  expect(m.triangleCount).toBe(38480);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(p.anchor).toEqual([26.67976, 59.968681]);
  expect(p.heading).toBe(-Math.PI / 2);
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(f.orientationControl.evidenceType).toBe('photo-context inference');
  expect(f.orientationControl.uncertaintyDegrees).toBe(22.5);
  expect(f.mappedIdentity.contextOnlyFeatureIds).toBe(true);
  expect(s.sourceFacts.publishedFocalHeightMeters).toBe(20);
  expect(s.sourceFacts.modeledVaneTopMeters).toBe(20.45);
});
it('rebuilds exact pinned derivatives within all budgets with four shared graph bindings and separate vertex streams', async () => {
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
  }
  expect([...refs].sort()).toEqual(
    ['plaster_lime', 'metal_painted', 'wood_plain', 'concrete_plain']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
