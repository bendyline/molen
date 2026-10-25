import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineGlobal } from '../../worldgen/scripts/signature-tower-global-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/ws/ws1/shun_hing_square'),
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

it('reproduces preserved master and binds main tower, twin masts and independent signed annex controls', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
    });
  skylineGlobal.find((p) => p.id === 'shun_hing_square').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`);
  expect(m.elements).toHaveLength(13);
  expect(m.elements.find((p) => p.id === 64601041).tags.wikidata).toBe('Q236201');
  expect(m.orientationControl.mastWays).toEqual([188388373, 188388378]);
  expect(m.orientationControl.connectorWay).toBe(1145586647);
  expect(m.heading).toBeCloseTo(-1.229005358699, 12);
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.orientationControl.entranceSurveyed).toBe(false);
});
it('retains both complete syringe crowns, closed shaft, independent annex wings and supported pool court across all levels', async () => {
  const m = await read(`${source}/map-frame.json`),
    asset = await read(`${runtime}/asset.json`),
    local = (p) => {
      const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
        S = -(p.lat - m.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    },
    centers = [188388373, 188388378].map((id) => {
      const p = m.elements
        .find((p) => p.id === id)
        .geometry.slice(0, -1)
        .map(local);
      return p.reduce((s, q) => [s[0] + q[0] / p.length, s[1] + q[1] / p.length], [0, 0]);
    });
  expect(centers[0][0]).toBeLessThan(-23);
  expect(centers[1][0]).toBeGreaterThan(23);
  expect(Math.abs(centers[0][1] - centers[1][1])).toBeGreaterThan(0.3);
  for (const path of [
    `${source}/models/source.glb`,
    ...asset.runtimeLods.levels.map((l) => `${runtime}/${l.file}`),
  ]) {
    const { g, triangles: ts } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBeCloseTo(384, 3);
    expect(Math.max(...ps.map((p) => p.max[2]))).toBeGreaterThan(180);
    for (const y of [60, 150, 280])
      for (let i = 0; i < 12; i++) {
        const a = ((i + 0.17) * Math.PI * 2) / 12,
          h = nearest(ts, [65 * Math.cos(a), y, 65 * Math.sin(a)], [-Math.cos(a), 0, -Math.sin(a)]);
        expect(h, `${path} closed shaft at ${y}`).toBeGreaterThan(20);
        expect(h).toBeLessThan(65);
      }
    for (const [x, z] of centers) {
      expect(nearest(ts, [x, 390, z], [0, -1, 0]), `${path}384m mast`).toBeCloseTo(6, 3);
      const h = nearest(ts, [x + 20, 320, z], [-1, 0, 0]);
      expect(h, `${path} independent rounded crown`).toBeGreaterThan(9);
      expect(h).toBeLessThan(12);
    }
    for (const [x, z] of [
      [8, 110],
      [-7, 168],
    ])
      expect(
        nearest(ts, [x, 150, z], [0, -1, 0]),
        `${path}retained east/west apartment wing`,
      ).toBeCloseTo(32.8, 3);
    expect(nearest(ts, [-11, 40, 135], [0, -1, 0]), `${path} supported courtyard pool`).toBeCloseTo(
      4.36,
      3,
    );
    expect(
      nearest(ts, [-11, 40, 135], [0, 1, 0]),
      `${path} open court below upper bridge`,
    ).toBeCloseTo(19.4, 3);
    expect(
      nearest(ts, [-2, 1, 177], [0, -1, 0]),
      `${path} west cylinder foundation contact`,
    ).toBeCloseTo(0.75, 3);
    expect(nearest(ts, [0, 10, -25], [0, 0, 1]), `${path}triangular portal glazing`).toBeCloseTo(
      5.4,
      3,
    );
    expect(g.materials.length).toBeLessThanOrEqual(8);
  }
});
it('rebuilds deterministic budgeted levels with separate GPU vertex streams and shared surfaces', async () => {
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
