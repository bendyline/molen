import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildMoeve } from '../../worldgen/scripts/signature-tower-moeve-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/ez/ezj/torre_moeve'),
  runtime = await runtimeLodFixture(source.replace(/([\\/])source([\\/])/, '$1assets$2'));
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
  const windowTriangles = [],
    mainTriangles = [];
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      const decoded = Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
      if (
        g.materials[p.material].pbrMetallicRoughness.roughnessFactor === 0.2 &&
        g.materials[p.material].pbrMetallicRoughness.metallicFactor === 0.28
      )
        windowTriangles.push(...decoded);
      const rough = g.materials[p.material].pbrMetallicRoughness.roughnessFactor;
      if (rough === 0.48 || rough === 0.2) mainTriangles.push(...decoded);
      return decoded;
    }),
  );
  return { g, values, triangles, windowTriangles, mainTriangles };
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
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

function nearestWithNormal(ts, o, d) {
  let best = { distance: Infinity, normal: [0, 0, 0] };
  for (const p of ts) {
    const t = nearest([p], o, d);
    if (t >= best.distance) continue;
    const n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
      len = Math.hypot(...n);
    best = { distance: t, normal: n.map((v) => v / len) };
  }
  return best;
}
const surfaces = {
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  clear_glass: {
    slot: 'window',
    localRef: 'palette:#feffff',
    roughness: 0.12,
    metallic: 0.05,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.52],
    doubleSided: true,
  },
};
it('reproduces unchanged detailed Moeve and verifies independent east-west cores', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildMoeve(a.wrap(b));
  const mesh = b.finalize();
  expect(mesh.triangleCount).toBe(410898);
  const spec = await read(source + '/spec.json'),
    m = await read(source + '/map-frame.json'),
    prior = await read(source + '/georeferencing-baseline.json');
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(prior.heading);
  const project = (p) => {
    const e = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      south = -(p.lat - m.anchor[1]) * 111319.490793;
    return [
      e * Math.cos(m.heading) - south * Math.sin(m.heading),
      e * Math.sin(m.heading) + south * Math.cos(m.heading),
    ];
  };
  const raw = m.elements.find((e) => e.id === 188396764);
  expect(raw.tags.wikidata).toBe('Q519568');
  expect(Number(raw.tags.height)).toBe(248.3);
  expect(raw.tags['building:levels']).toBe('53');
  expect(spec.sourceFacts.officeBlockFloorCounts).toEqual([11, 12, 11]);
  expect(spec.sourceFacts.constructionTransferDatums).toEqual([39, 102, 168]);
  for (const v of raw.geometry.map(project))
    expect(
      Math.min(...prior.geometry.outline.map((q) => Math.hypot(v[0] - q[0], v[1] - q[1]))),
    ).toBeLessThan(0.001);
  const east = m.elements.find((e) => e.id === 188396759).geometry,
    west = m.elements.find((e) => e.id === 188396760).geometry;
  expect(east.reduce((n, p) => n + p.lon / east.length, 0)).toBeGreaterThan(
    west.reduce((n, p) => n + p.lon / west.length, 0),
  );
  expect(Math.min(...east.map(project).map((p) => p[0]))).toBeGreaterThan(13);
  expect(Math.max(...west.map(project).map((p) => p[0]))).toBeLessThan(-13);
  expect(Math.abs(Math.max(...east.map(project).map((p) => p[0])) - 26.5)).toBeLessThan(0.2);
  expect(m.heading).toBeCloseTo(-0.20327044179, 10);
  const g = decode(await readFile(source + '/models/source.glb')).g;
  expect(g.materials).toHaveLength(4);
  expect(g.images ?? []).toHaveLength(0);
}, 120000);
it('keeps three office blocks, recessed belts, full cores and genuinely open curved crown', async () => {
  const asset = await read(runtime + '/asset.json'),
    master = decode(await readFile(source + '/models/source.glb'));
  for (const level of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + level.file));
    for (const y of [31, 65, 96, 140, 163, 193, 215])
      for (let k = 0; k < 24; k++) {
        const a = (k * Math.PI) / 12,
          dir = [-Math.cos(a), 0, -Math.sin(a)],
          o = [80 * Math.cos(a), y, 80 * Math.sin(a)],
          ref = nearestWithNormal(master.triangles, o, dir),
          hit = nearestWithNormal(d.triangles, o, dir);
        expect(Number.isFinite(hit.distance), level.name + ' ' + y + '/' + k).toBe(true);
        expect(
          Math.abs(hit.distance - ref.distance) * Math.abs(dot(dir, ref.normal)),
          level.name + ' ' + y + '/' + k,
        ).toBeLessThanOrEqual(level.errorMeters + 0.015);
      }
    // Across the middle of the high arch there is empty air, not a filled facade.
    expect(nearest(d.triangles, [0, 233, 80], [0, 0, -1]), level.name).toBe(Infinity);
    expect(nearest(d.triangles, [3.7, 235, 4.8], [0, -1, 0]), level.name).toBeCloseTo(15.3, 1);
    expect(nearest(d.triangles, [0, 233, 0], [0, 1, 0]), level.name).toBeCloseTo(6, 2);
    expect(nearest(d.triangles, [0, 260, 0], [0, -1, 0]), level.name).toBeCloseTo(11.7, 2);
    for (const x of [-21.3, 21.3])
      expect(nearest(d.triangles, [x, 233, 80], [0, 0, -1]), level.name).toBeCloseTo(68.22, 1);
    for (const [y, z] of [
      [65, 21.17],
      [96, 18.37],
      [140, 21.17],
      [163, 18.37],
      [193, 21.17],
    ])
      expect(
        Math.abs(80 - nearest(d.triangles, [0, y, 80], [0, 0, -1]) - z),
        level.name + 'profile' + y,
      ).toBeLessThan(0.4);
  }
}, 120000);
it('rebuilds every browser level below phone and draw budgets with separate vertex streams', async () => {
  const p = resolve(runtime, 'asset.json');
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(runtime + '/' + l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    const { g } = decode(bytes);
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.length).toBeLessThanOrEqual(4);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const a = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(a.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
