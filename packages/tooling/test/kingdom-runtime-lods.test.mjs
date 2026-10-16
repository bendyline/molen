import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineGlobal } from '../../worldgen/scripts/signature-tower-global-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/th/th3/n0166_kingdom_centre'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
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

it('reproduces preserved Kingdom master and independent signed map registration', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineGlobal.find((p) => p.id === 'N0166').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`);
  expect(m.elements).toHaveLength(5);
  for (const id of [264745917, 264745922])
    expect(m.elements.find((p) => p.id === id).tags.wikidata).toBe('Q656743');
  expect(m.orientationControl.pierWays).toEqual([264745924, 264745925]);
  expect(m.orientationControl.bridgeWay).toBe(984443070);
  expect(m.heading).toBeCloseTo(0.439272294515, 12);
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
});
it('keeps closed elliptical shaft, true open arch, independently curved crossbridge and both raised podium roofs', async () => {
  const asset = await read(`${runtime}/asset.json`);
  for (const path of [
    `${source}/models/source.glb`,
    ...asset.runtimeLods.levels.map((l) => `${runtime}/${l.file}`),
  ]) {
    const { triangles, g } = decode(await readFile(path));
    for (const y of [60, 150, 190])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          o = [Math.cos(a) * 100, y, Math.sin(a) * 100],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          hit = nearest(triangles, o, d);
        expect(hit, path).toBeGreaterThan(45);
        expect(hit, path).toBeLessThan(85);
      }
    for (const x of [-15, 0, 15])
      for (const sign of [-1, 1])
        expect(nearest(triangles, [x, 260, sign * 100], [0, 0, -sign]), path).toBe(Infinity);
    expect(310 - nearest(triangles, [0, 310, 0], [0, -1, 0]), path).toBeCloseTo(302.3, 2);
    expect(290 + nearest(triangles, [0, 290, 0], [0, 1, 0]), path).toBeCloseTo(296.5, 2);
    expect(230 - nearest(triangles, [0, 230, 0], [0, -1, 0]), path).toBeGreaterThanOrEqual(204.8);
    expect(230 - nearest(triangles, [0, 230, 0], [0, -1, 0]), path).toBeLessThan(206);
    for (const x of [-94, 94])
      expect(100 - nearest(triangles, [x, 100, 0], [0, -1, 0]), path).toBeCloseTo(27, 2);
    const slopes = triangles.filter(
      (p) =>
        p.some((q) => q[1] > 16) &&
        p.every((q) => q[1] >= 15.74 && q[1] <= 27.001 && Math.abs(q[0]) > 44.9) &&
        Math.abs(cross(sub(p[1], p[0]), sub(p[2], p[0]))[1]) > 0.001,
    );
    expect(slopes.length, path).toBeGreaterThan(20);
    for (const p of slopes)
      expect(cross(sub(p[1], p[0]), sub(p[2], p[0]))[1], path).toBeGreaterThan(0);
    expect(g.materials.length).toBeLessThanOrEqual(4);
  }
});
it('rebuilds all levels deterministically within phone and geometry budgets without duplicated GPU layout', async () => {
  const assetPath = `${runtime}/asset.json`,
    after = await buildModelLandmarkLods(assetPath, { force: true });
  expect(after.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
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
    expect(l.drawCalls).toBeLessThanOrEqual(4);
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
