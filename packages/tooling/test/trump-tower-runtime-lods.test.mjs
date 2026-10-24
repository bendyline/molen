import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineNext } from '../../worldgen/scripts/signature-tower-next-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/trump_tower'),
  runtime = await runtimeLodFixture(source.replace(/([\\/])source([\\/])/, '$1assets$2')),
  read = async (p) => JSON.parse(await readFile(p));
function decode(b) {
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
    bin = 28 + b.readUInt32LE(12);
  const values = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
      w = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType],
      start = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, k) => {
        const at = start + i * (v.byteStride ?? n * w) + k * w;
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
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      return Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
    }),
  );
  return { g, values, triangles };
}
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function nearest(ts, o, d) {
  return ts.reduce((best, p) => {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]),
      h = cross(d, b),
      det = dot(a, h);
    if (Math.abs(det) < 1e-8) return best;
    const q = sub(o, p[0]),
      u = dot(q, h) / det,
      v = dot(d, cross(q, a)) / det,
      t = dot(b, cross(q, a)) / det;
    return u < 0 || v < 0 || u + v > 1 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

it('reproduces the original master and reconciles independently mapped Fifth Avenue entrance and seven parts', async () => {
  const m = (
      await read(resolve('../../content/earth/structures/georeferencing.json'))
    ).candidates.find((p) => p.candidateId === 'trump_tower'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineNext.find((p) => p.id === 'trump_tower').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    f = await read(`${source}/map-frame.json`);
  expect(f.wikidataId).toBe('Q868772');
  expect(f.elements).toHaveLength(7);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(f.orientationControl.mainEntrance.id).toBe(6812091609);
  expect(f.orientationControl.mainEntrance.local[0]).toBeCloseTo(-26.217491, 5);
  expect(f.orientationControl.mainEntrance.local[1]).toBeCloseTo(-9.684525, 5);
  expect(Math.cos(f.heading)).toBeGreaterThan(0);
  expect(Math.sin(f.heading)).toBeLessThan(0);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
});
it('keeps the entire shaft, rear podium and five supported terraces, with a genuinely recessed main portal', async () => {
  for (const path of [
    `${source}/models/source.glb`,
    ...['skyline', 'district', 'street', 'closeup'].map((l) => `${runtime}/model.${l}.glb`),
  ]) {
    const { g, triangles: ts } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...ps.map((a) => a.max[1]))).toBeCloseTo(202.4, 3);
    expect(nearest(ts, [0, 250, 0], [0, -1, 0]), `${path} complete crown`).toBeCloseTo(47.6, 3);
    expect(nearest(ts, [23, 250, 7], [0, -1, 0]), `${path} full rear podium`).toBeCloseTo(230, 3);
    for (const [x, y] of [
      [-20, 25],
      [-16, 30],
      [-12, 35],
      [-8, 40],
      [-4, 45],
    ])
      expect(
        nearest(ts, [x, 250, 16.7], [0, -1, 0]),
        `${path} planted terrace support`,
      ).toBeCloseTo(250 - y, 3);
    expect(
      nearest(ts, [-24, 250, 14.75], [0, -1, 0]),
      `${path} no original floating planter`,
    ).toBeCloseTo(230, 3);
    expect(
      nearest(ts, [-40, 3.5, -9.284525], [1, 0, 0]),
      `${path} recessed entry glazing`,
    ).toBeCloseTo(14.23251, 3);
  }
});
it('force-rebuilds pinned levels inside phone/draw/triangle caps with shared graphs and separate GPU streams', async () => {
  const after = await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect(after.levels[0].bytes + after.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = after.levels.find((l) => l.name === name),
      b = await readFile(`${runtime}/${l.file}`),
      { g } = decode(b);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const pa = g.accessors[p.attributes.POSITION],
        na = g.accessors[p.attributes.NORMAL];
      expect(pa.bufferView).not.toBe(na.bufferView);
      expect(g.bufferViews[pa.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[na.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 20000);
