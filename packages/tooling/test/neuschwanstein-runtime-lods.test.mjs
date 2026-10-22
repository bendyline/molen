import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { neuschwansteinStudy } from '../../worldgen/scripts/neuschwanstein-castle-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u0r/n0237_neuschwanstein_castle'),
  runtime = await runtimeLodFixture(source.replace(/([\\/])source([\\/])/, '$1assets$2'));
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
  sandstone: { graph: 'stone_sandstone', slot: 'wall', roughness: 0.85, metallic: 0 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  copper: { graph: 'metal_copper', slot: 'roof', roughness: 0.5, metallic: 0.85 },
  brick: { graph: 'brick', slot: 'wall', roughness: 0.9, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    alphaMode: 'OPAQUE',
    roughness: 0.2,
    metallic: 0.28,
  },
  recess: {
    slot: 'wall',
    localRef: 'palette:#ffffff',
    alphaMode: 'OPAQUE',
    roughness: 0.88,
    metallic: 0,
  },
};
it('reproduces the original detailed castle and independently projects every mapped part', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  neuschwansteinStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(234177);
  execFileSync(
    process.execPath,
    ['packages/worldgen/scripts/generate-signature-towers.mjs', '--ids=N0237', '--check'],
    { cwd: resolve('../..'), stdio: 'pipe' },
  );
  const f = await read(`${source}/map-frame.json`);
  expect(f.heading).toBeCloseTo(0.381105898007, 10);
  expect(f.elements[0].tags.wikidata).toBe('Q4152');
  expect(f.occupied).toHaveLength(7);
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
  for (let j = 0; j < f.elements.length; j++)
    for (let i = 0; i < f.elements[j].geometry.length; i++) {
      const polygon = j === 0 ? f.geometry.outline : f.occupied[j - 1].outline;
      expect(Math.hypot(...sub(project(f.elements[j].geometry[i]), polygon[i]))).toBeLessThan(
        0.00001,
      );
    }
  const gate = f.occupied.find((p) => p.id === 'way/221599096');
  expect(Math.max(...gate.outline.map((p) => p[0]))).toBeLessThan(64.2);
  expect(Math.min(...gate.outline.map((p) => p[0]))).toBeGreaterThan(53.5);
  const scope = await read(`${source}/review-scope.json`),
    terrain = await read(`${source}/terrain-evidence.json`);
  expect(scope.geographic.status).toBe('preview-proposal');
  const grade = await read(`${source}/site-grade.json`),
    dgm = await read(`${source}/dgm1-response.json`);
  expect(grade.verticalDatum).toBe('DHHN2016');
  expect(dgm.coords).toHaveLength(2785);
  expect(hash(await readFile(`${source}/dgm1-response.json`))).toBe(grade.retainedResponseHash);
  expect(grade.checks[3].heightMeters - grade.checks[14].heightMeters).toBeCloseTo(7.2, 6);
  expect(grade.grid.heights[20 * 71 + 41]).toBeCloseTo(8.2, 6);
  expect(scope.geographic.terrainReference.anchor).toEqual(dgm.coords[14].slice(0, 2));
  expect(scope.geographic.terrainReference.modelHeight).toBe(1);
  expect(terrain.samples[1].height - terrain.samples[0].height).toBeGreaterThan(15);
}, 120000);
it('retains complete roofs, open courts and the actually open entry arch in every level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    reference = decode(await readFile(`${runtime}/model.closeup.glb`));
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [16.43, 30.63])
      for (const [o, v] of [
        [
          [-35.17, y, 50],
          [0, 0, -1],
        ],
        [
          [-35.17, y, -50],
          [0, 0, 1],
        ],
      ]) {
        const a = nearestWithNormal(reference.triangles, o, v),
          b = nearestWithNormal(d.triangles, o, v);
        expect(Number.isFinite(b.distance), `${l.name} occupied Palas wall`).toBe(true);
        expect(Math.abs(a.distance - b.distance)).toBeLessThanOrEqual(l.errorMeters + 0.6);
        expect(dot(b.normal, v)).toBeLessThan(-0.8);
      }
    for (const [x, y] of [
      [18, 8.2],
      [48, 1],
    ]) {
      const q = nearestWithNormal(d.triangles, [x, 60, 4], [0, -1, 0]);
      expect(q.distance).toBeCloseTo(60 - y, 3);
      expect(q.normal[1]).toBeGreaterThan(0.99);
    }
    for (const y of [1.7, 3.8, 7.2])
      expect(
        nearest(d.triangles, [90, y, 3.4], [-1, 0, 0]),
        `${l.name} open gate through to court`,
      ).toBeGreaterThan(48);
    for (const [x, z, tip] of [
      [-55.16, -8.04, 65],
      [-48.04, 13.29, 59.2],
    ]) {
      const q = nearestWithNormal(d.triangles, [x + 0.03, 80, z + 0.02], [0, -1, 0]);
      expect(q.distance).toBeGreaterThanOrEqual(80 - tip - 0.2);
      expect(q.distance).toBeLessThan(80 - tip + 1.1);
      expect(q.normal[1]).toBeGreaterThan(0.05);
    }
    const gate = nearestWithNormal(d.triangles, [58.7, 50, 3.4], [0, -1, 0]);
    expect(gate.distance).toBeGreaterThan(20);
    expect(gate.distance).toBeLessThan(25);
    if (['street', 'closeup'].includes(l.name)) {
      const vault = nearestWithNormal(d.triangles, [58.7, 2.5, 3.4], [0, 1, 0]);
      expect(vault.distance).toBeCloseTo(5.75, 3);
      expect(vault.normal[1]).toBeLessThan(-0.9);
    }
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
