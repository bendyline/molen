import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { park432Center } from '../../worldgen/scripts/park-432-runtime-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/n0197_432_park_avenue'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2');
const read = async (p) => JSON.parse(await readFile(p));
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
it('retains the reproducible detailed source master and independently mapped signed southwest arrival', async () => {
  const spec = await read(`${source}/spec.json`),
    frame = await read(`${source}/map-frame.json`);
  expect(spec.mesh.triangles).toBe(292272);
  expect(frame.wikidataId).toBe('Q233940');
  expect(frame.heading).toBeCloseTo(1.072509089709, 10);
  expect(Math.max(...frame.orientationControl.shaftPerimeterResiduals)).toBeLessThan(0.15);
  expect(frame.orientationControl.mainEntrance.local[0]).toBeLessThan(park432Center[0] - 13);
  expect(Math.abs(frame.orientationControl.mainEntrance.local[1] - park432Center[1])).toBeLessThan(
    0.1,
  );
  const E = Math.cos(frame.heading),
    N = Math.sin(frame.heading);
  expect(E).toBeGreaterThan(0);
  expect(N).toBeGreaterThan(0);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.mapGeometrySource).toBe('map-frame.json');
});
it('preserves all five genuinely open wind levels, cylindrical cores, grounded podium and complete flat roof at every browser level', async () => {
  const [cx, cz] = park432Center,
    top = 425.5,
    pitch = 4.7244,
    base = top - 90 * pitch;
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const { g, triangles: ts } = decode(await readFile(`${runtime}/model.${level}.glb`));
    for (const row of [20, 34, 48, 62, 76])
      for (const pair of [0, 1]) {
        const y = base + (row + pair + 0.5) * pitch;
        expect(nearest(ts, [cx + 50, y, cz + 11.875], [-1, 0, 0]), `${level} open edge`).toBe(
          Infinity,
        );
        const core = nearest(ts, [cx + 50, y, cz + 2.375], [-1, 0, 0]);
        expect(core).toBeGreaterThan(42);
        expect(core).toBeLessThan(45);
        expect(nearest(ts, [cx + 50, y, cz], [-1, 0, 0])).toBeCloseTo(35.75, 3);
      }
    const closed = nearest(ts, [cx + 50, base + 30.5 * pitch, cz + 2.375], [-1, 0, 0]);
    expect(closed).toBeGreaterThan(35.7);
    expect(closed).toBeLessThan(35.9);
    expect(nearest(ts, [cx, 500, cz], [0, -1, 0])).toBeCloseTo(74.5, 3);
    expect(nearest(ts, [cx + 18, 55, cz], [0, -1, 0])).toBeCloseTo(25, 3);
    const ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...ps.map((a) => a.max[1]))).toBe(425.5);
  }
});
it('rebuilds deterministic pinned levels within triangle/draw/download caps with shared graphs and separate GPU streams', async () => {
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
    if (name === 'district')
      expect(
        g.materials.some(
          (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.window_punched',
        ),
      ).toBe(true);
  }
}, 20000);
