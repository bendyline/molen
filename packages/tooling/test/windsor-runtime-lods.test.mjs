import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { windsorStudy } from '../../worldgen/scripts/windsor-castle-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/gc/gcp/n0239_windsor_castle'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2');
const read = async (p) => JSON.parse(await readFile(p)),
  hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
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
  const transparentTriangles = [],
    opaqueTriangles = [];
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      const decoded = Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
      if (g.materials[p.material].alphaMode === 'BLEND') transparentTriangles.push(...decoded);
      else opaqueTriangles.push(...decoded);
      return decoded;
    }),
  );
  return { g, values, triangles, transparentTriangles, opaqueTriangles };
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

const originals = {
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  weathered: {
    graph: 'stone_limestone_weathered',
    slot: 'foundation',
    roughness: 0.9,
    metallic: 0,
  },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  brick: { graph: 'brick', slot: 'wall', roughness: 0.9, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    alphaMode: 'OPAQUE',
    roughness: 0.2,
    metallic: 0.28,
  },
};
it('reproduces the original detailed Windsor and independently verifies signed footprint/elevation evidence', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  windsorStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(385417);
  execFileSync(
    process.execPath,
    ['packages/worldgen/scripts/generate-signature-towers.mjs', '--ids=N0239', '--check'],
    { cwd: resolve('../..'), stdio: 'pipe' },
  );
  const spec = await read(`${source}/spec.json`),
    frame = await read(`${source}/map-frame.json`),
    parts = await read(`${source}/map-parts.json`);
  expect(frame.elements[0].tags.wikidata).toBe('Q42646');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.status).toBe('preview-proposal');
  const R = 6378137,
    f = Math.cos((frame.anchor[1] * Math.PI) / 180),
    project = (q) => {
      const e = (((q.lon - frame.anchor[0]) * Math.PI) / 180) * R * f,
        s =
          (-R * Math.asinh(Math.tan((q.lat * Math.PI) / 180)) +
            R * Math.asinh(Math.tan((frame.anchor[1] * Math.PI) / 180))) *
          f;
      return [
        Math.cos(frame.heading) * e - Math.sin(frame.heading) * s,
        Math.sin(frame.heading) * e + Math.cos(frame.heading) * s,
      ];
    };
  for (const part of parts.features.filter((p) => p.points)) {
    const e = frame.elements.find((e) => `way/${e.id}` === part.id);
    expect(e.geometry.length).toBe(part.points.length);
    for (const [i, q] of e.geometry.entries())
      expect(Math.hypot(...project(q).map((v, k) => v - part.points[i][k]))).toBeLessThan(0.005);
  }
  const grade = await read(`${source}/site-grade.json`),
    responses = await read(`${source}/grade-responses.json`),
    values = [];
  for (const batch of responses.batches) {
    expect(hash(Buffer.from(batch.responseText))).toBe(batch.responseHash);
    const samples = JSON.parse(batch.responseText).samples;
    expect(samples.length).toBe(batch.values.length);
    const v = [];
    for (const s of samples) v[s.locationId] = Number(s.value);
    values.push(...v);
  }
  expect(values.length).toBe(4787);
  expect(values.slice(14)).toEqual(grade.grid.heights);
  expect(values[0]).toBeCloseTo(38.270999908, 8);
  expect(values[10] - values[0]).toBeCloseTo(14.051998139, 8);
  expect(values[12] - values[0]).toBeCloseTo(25.052749634, 8);
  expect(grade.heightDatum).toContain('Newlyn');
  expect(spec.geographicProposal.terrainReference.anchor).toEqual(grade.checks[0].coordinate);
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(0);
}, 120000);
it('keeps the open quadrangle and real cloister passage through every browser level', async () => {
  const asset = await read(`${runtime}/asset.json`);
  for (const level of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${level.file}`));
    expect(
      nearest(d.triangles, [85, 100, 3], [0, -1, 0]),
      `${level.name} open upper quadrangle`,
    ).toBe(Infinity);
    expect(
      nearest(d.triangles, [-221.56, 3.6, 55.1], [-0.357816, 0, -0.933792]),
      `${level.name} open cloister through`,
    ).toBeGreaterThan(21);
    expect(
      nearest(d.triangles, [-17, 0, -10], [0, 1, 0]),
      `${level.name} no duplicated artificial terrain`,
    ).toBeGreaterThan(20);
    if (['street', 'closeup'].includes(level.name)) {
      // Scan the formerly cracked inner facade at several elevations, so a
      // passage/foundation edit cannot leave diagonal holes between fragments.
      for (let i = 1; i < 8; i++)
        for (const y of [2, 4, 6]) {
          const t = i / 8,
            x = -253.894622169 + (-263.288526961 + 253.894622169) * t,
            z = 39.64751152 + (31.823299405 - 39.64751152) * t;
          expect(
            nearest(d.triangles, [x + 1.92, y, z - 2.3052], [-0.64, 0, 0.7684]),
            `${level.name} continuous cloister facade ${i}/${y}`,
          ).toBeLessThan(3.6);
        }
      const vault = nearestWithNormal(d.triangles, [-228, 3.5, 38.3], [0, 1, 0]);
      expect(vault.distance).toBeCloseTo(1.993122864, 3);
      expect(vault.normal[1]).toBeLessThan(-0.9);
    }
    expect(d.g.images ?? []).toHaveLength(0);
    expect(d.g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
  }
});
it('rebuilds all browser levels deterministically within triangle/download/draw budgets without repeated vertex uploads', async () => {
  const p = `${runtime}/asset.json`;
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(`${runtime}/${l.file}`),
      { g } = decode(bytes);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.filter((m) => m.alphaMode === 'BLEND').length).toBeLessThanOrEqual(1);
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
