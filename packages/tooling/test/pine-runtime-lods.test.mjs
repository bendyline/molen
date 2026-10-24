import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import {
  pineParts,
  pinePortalEdges,
  pineRevolvingCenters,
} from '../../worldgen/scripts/pine-runtime-model.mjs';
import { build70Pine } from '../../worldgen/scripts/signature-tower-pine-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/70_pine_street'),
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

const surfaces = {
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  brick: { graph: 'brick', slot: 'wall', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
};
it('reconstitutes the original detailed master and verifies signed independent door/outline controls', async () => {
  const m = (
      await read(resolve('../../content/earth/structures/georeferencing.json'))
    ).candidates.find((p) => p.candidateId === '70_pine_street'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  build70Pine(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    f = await read(`${source}/map-frame.json`);
  expect(f.wikidataId).toBe('Q262041');
  expect(f.elements.filter((p) => p.tags?.['building:part'])).toHaveLength(58);
  expect(pineParts).toHaveLength(50);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(Math.cos(f.heading)).toBeGreaterThan(0);
  expect(Math.sin(f.heading)).toBeLessThan(0);
  const doors = pinePortalEdges.flatMap((e) =>
    e.portals.map((p) => ({ x: e.a[0] + ((e.b[0] - e.a[0]) * p.c) / e.len, n: e.n, big: p.big })),
  );
  expect(doors).toHaveLength(5);
  expect(doors.find((p) => !p.big && p.n[2] > 0.9).x).toBeCloseTo(-13.8738883, 5);
  expect(doors.find((p) => !p.big && p.n[2] < -0.9).x).toBeCloseTo(-23, 5);
  expect(f.orientationControl.entrances.find((p) => p.id === 12085335624).local[0]).toBeCloseTo(
    -13.8738883,
    5,
  );
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
}, 20000);
it('keeps the whole asymmetric parcel and290m crown and exposes three revolving forms at street/closeup', async () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const { g, triangles: ts } = decode(await readFile(`${runtime}/model.${level}.glb`));
    const ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...ps.map((a) => a.max[1]))).toBeCloseTo(290.1696, 3);
    expect(Math.min(...ps.map((a) => a.min[0]))).toBeLessThan(-39);
    expect(Math.max(...ps.map((a) => a.max[0]))).toBeGreaterThan(39);
    // Independent whole-parcel envelope probes must encounter substantial masonry on both ends.
    expect(nearest(ts, [-30, 320, 0], [0, -1, 0])).toBeGreaterThan(195);
    expect(nearest(ts, [-30, 320, 0], [0, -1, 0])).toBeLessThan(276);
    expect(nearest(ts, [6, 320, 0], [0, -1, 0])).toBeGreaterThan(50);
    expect(nearest(ts, [6, 320, 0], [0, -1, 0])).toBeLessThan(80);
  }
  for (const path of [
    `${source}/models/source.glb`,
    `${runtime}/model.street.glb`,
    `${runtime}/model.closeup.glb`,
  ]) {
    const { triangles: ts } = decode(await readFile(path));
    // The fourth ground-floor window row must remain recessed: a one-row facade
    // incorrectly filled this14m-high opening with a12m masonry spandrel.
    expect(nearest(ts, [-5.8, 14, 23], [0, 0, -1]), `${path} fourth window row`).toBeGreaterThan(
      4.43,
    );
    expect(nearest(ts, [-5.8, 14, 23], [0, 0, -1])).toBeLessThan(4.65);
    for (const c of pineRevolvingCenters) {
      const o = c.point.map((x, i) => (i === 1 ? 2.605 : x + c.normal[i] * 3)),
        d = c.normal.map((x) => -x),
        t = nearest(ts, o, d);
      expect(t, `${path} revolving casing`).toBeGreaterThan(2.05);
      expect(t).toBeLessThan(2.2);
    }
  }
}, 20000);
it('rebuilds pinned four-level bytes within download/triangle/draw budgets without repeated GPU streams', async () => {
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
