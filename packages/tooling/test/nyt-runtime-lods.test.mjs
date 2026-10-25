import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineNext } from '../../worldgen/scripts/signature-tower-next-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/new_york_times_building'),
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

it('reproduces the unchanged original rod master and binds nine signed mapped parts', async () => {
  const m = (
      await read(resolve('../../content/earth/structures/georeferencing.json'))
    ).candidates.find((p) => p.candidateId === 'new_york_times_building'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
    });
  skylineNext.find((p) => p.id === 'new_york_times_building').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    f = await read(`${source}/map-frame.json`);
  expect(f.wikidataId).toBe('Q192680');
  expect(f.elements).toHaveLength(10);
  expect(f.geometry.holes).toHaveLength(1);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(f.elements.find((p) => p.id === 260282089).tags.min_height).toBe('25');
  expect(Math.cos(f.heading)).toBeGreaterThan(0);
  expect(Math.sin(f.heading)).toBeLessThan(0);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
});
it('keeps the full mast, low eastern podium, open court, planted grove and omitted west glass at every level', async () => {
  for (const path of [
    `${source}/models/source.glb`,
    ...['skyline', 'district', 'street', 'closeup'].map((l) => `${runtime}/model.${l}.glb`),
  ]) {
    const { g, triangles: ts, values } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...ps.map((a) => a.max[1]))).toBeCloseTo(319, 3);
    expect(nearest(ts, [30, 50, 15], [0, -1, 0]), `${path} eastern podium`).toBeCloseTo(25.4, 3);
    expect(nearest(ts, [0, 350, 0], [0, -1, 0]), `${path} courtyard has no roof`).toBeCloseTo(
      349.64,
      3,
    );
    expect(nearest(ts, [-7, 50, -8], [0, -1, 0]), `${path} fifty foot grove`).toBeCloseTo(34.76, 3);
    const glass = g.meshes
      .flatMap((m) => m.primitives)
      .filter(
        (p) =>
          g.materials[p.material].pbrMetallicRoughness.roughnessFactor === 0.2 ||
          path.includes('skyline'),
      )
      .flatMap((p) => {
        const ps = values(p.attributes.POSITION),
          ids = values(p.indices).flat();
        return Array.from({ length: ids.length / 3 }, (_, i) =>
          ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
        );
      });
    expect(
      nearest(glass, [-100, 101.8, 5.3], [1, 0, 0]),
      `${path} complete western glass`,
    ).toBeGreaterThan(38);
    expect(
      nearest(glass, [-100, 101.8, 5.3], [1, 0, 0]),
      `${path} complete western glass`,
    ).toBeLessThan(40);
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
      { g, values } = decode(b);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const pa = g.accessors[p.attributes.POSITION],
        na = g.accessors[p.attributes.NORMAL];
      expect(pa.bufferView).not.toBe(na.bufferView);
      expect(g.bufferViews[pa.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[na.bufferView].byteStride ?? 12).toBe(12);
      if (g.materials[p.material].name === 'tile_ceramic') {
        const positions = values(p.attributes.POSITION),
          normals = values(p.attributes.NORMAL);
        for (let i = 0; i < positions.length; i++) {
          const [x, , z] = positions[i],
            n = normals[i];
          const outward = Math.abs(z) > 28 ? n[2] * Math.sign(z) : n[0] * (x < -60 ? -1 : 1);
          expect(
            outward,
            `${name} ceramic screens remain visible with single-sided shared materials`,
          ).toBeGreaterThan(0.99);
        }
      }
    }
  }
}, 20000);
