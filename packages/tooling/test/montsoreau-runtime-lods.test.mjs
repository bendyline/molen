import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { montsoreauStudy } from '../../worldgen/scripts/montsoreau-castle-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u02/chateau_de_montsoreau'),
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
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28, localRef: 'palette:#ffffff' },
  recess: { slot: 'wall', roughness: 0.88, metallic: 0, localRef: 'palette:#ffffff' },
};
it('preserves the original detailed castle and independently projects its occupied ring', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  montsoreauStudy.build(a.wrap(b));
  execFileSync(
    process.execPath,
    [
      'packages/worldgen/scripts/generate-signature-towers.mjs',
      '--ids=chateau_de_montsoreau',
      '--check',
    ],
    { cwd: resolve('../..'), stdio: 'pipe' },
  );
  const f = await read(`${source}/map-frame.json`),
    prior = await read(`${source}/georeferencing-baseline.json`);
  expect(f.heading).toBeCloseTo(-0.502994439024, 10);
  expect(f.anchor).toEqual(prior.anchor);
  expect(f.elements[0].tags.wikidata).toBe('Q1143049');
  expect(f.elements[1].id).toBe(135334005);
  const R = 6378137,
    c = Math.cos((f.anchor[1] * Math.PI) / 180),
    project = (q) => {
      const e = (((q.lon - f.anchor[0]) * Math.PI) / 180) * R * c,
        s =
          (-R * Math.asinh(Math.tan((q.lat * Math.PI) / 180)) +
            R * Math.asinh(Math.tan((f.anchor[1] * Math.PI) / 180))) *
          c;
      return [
        Math.cos(f.heading) * e - Math.sin(f.heading) * s,
        Math.sin(f.heading) * e + Math.cos(f.heading) * s,
      ];
    };
  f.elements[1].geometry.forEach((q, i) => {
    expect(Math.hypot(...sub(project(q), f.geometry.outline[i]))).toBeLessThan(0.00001);
  });
  f.elements[0].geometry.forEach((q, i) => {
    expect(Math.hypot(...sub(project(q), prior.geometry.outline[i]))).toBeLessThan(0.002);
  });
  expect(Math.sin(f.heading)).toBeLessThan(-0.48);
  expect(Math.cos(f.heading)).toBeGreaterThan(0.87);
  expect(f.geometry.outline.some((p) => p[0] > 23 && p[1] < -5.5)).toBe(true);
  expect(f.precinctOutline.some((p) => p[1] > 26)).toBe(true);
}, 120000);
it('keeps complete outward castle masses, upward roofs and an open court in every browser level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    reference = decode(await readFile(`${runtime}/model.closeup.glb`));
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [9.63, 16.43])
      for (const [o, v] of [
        [
          [-4.17, y, -50],
          [0, 0, 1],
        ],
        [
          [-4.17, y, 5],
          [0, 0, -1],
        ],
        [
          [40, y, -9.17],
          [-1, 0, 0],
        ],
      ]) {
        const a = nearestWithNormal(reference.triangles, o, v),
          b = nearestWithNormal(d.triangles, o, v);
        expect(Number.isFinite(b.distance), `${l.name} complete occupied wall`).toBe(true);
        expect(Math.abs(a.distance - b.distance)).toBeLessThanOrEqual(l.errorMeters + 0.5);
        expect(dot(b.normal, v)).toBeLessThan(-0.8);
      }
    const court = nearestWithNormal(d.triangles, [-4.17, 50, 8.13], [0, -1, 0]);
    expect(court.distance).toBeCloseTo(45.5, 3);
    expect(court.normal[1]).toBeGreaterThan(0.99);
    for (const [o, v] of [
      [
        [-4.17, 2.13, 50],
        [0, 0, -1],
      ],
      [
        [45, 2.13, 12.17],
        [-1, 0, 0],
      ],
      [
        [-45, 2.13, 13.17],
        [1, 0, 0],
      ],
    ]) {
      const retaining = nearestWithNormal(d.triangles, o, v);
      expect(Number.isFinite(retaining.distance), `${l.name} continuous retaining wall`).toBe(true);
      expect(dot(retaining.normal, v), `${l.name} outward retaining wall`).toBeLessThan(-0.8);
    }
    const bottom = nearestWithNormal(d.triangles, [-4.17, -10, 8.13], [0, 1, 0]);
    expect(bottom.distance).toBeCloseTo(10, 3);
    expect(bottom.normal[1]).toBeLessThan(-0.99);
    const roof = nearestWithNormal(d.triangles, [-5.23, 60, -17.17], [0, -1, 0]);
    expect(roof.distance).toBeCloseTo(60 - (21 + ((13.75 - 17.17) / -5.175) * 9.8), 3);
    expect(roof.normal[1]).toBeGreaterThan(0.3);
    for (const x of [-20.2, 11.17]) {
      const terrace = nearestWithNormal(d.triangles, [x, 50, -20.13], [0, -1, 0]);
      expect(terrace.distance).toBeCloseTo(22.85, 2);
      expect(terrace.normal[1]).toBeGreaterThan(0.99);
    }
    const pointed = nearestWithNormal(d.triangles, [-14.17, 50, -12.3], [0, -1, 0]);
    expect(pointed.distance).toBeGreaterThan(12);
    expect(pointed.distance).toBeLessThan(14.5);
    expect(pointed.normal[1]).toBeGreaterThan(0.1);
    const eastern = nearestWithNormal(d.triangles, [9.9, 40, -12.5], [0, -1, 0]);
    expect(eastern.distance).toBeCloseTo(l.name === 'skyline' ? 12.82 : 14.45, 2);
    expect(eastern.normal[1]).toBeGreaterThan(0.99);
    const eastTip = nearest(d.triangles, [18.1, 50, -5.0], [0, -1, 0]);
    expect(eastTip, `${l.name} no former southward return roof`).toBeGreaterThan(43);
    expect(d.g.images ?? []).toEqual([]);
    expect(d.g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
  }
}, 120000);
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
