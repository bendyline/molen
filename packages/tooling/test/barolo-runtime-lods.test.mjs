import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { encodeAuthoredAssembly } from '../../worldgen/scripts/authored-glb-assembly.mjs';
import { baroloPalaceStudy } from '../../worldgen/scripts/barolo-palace-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/69/69y/n0234_barolo_palace'),
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
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  marble: { graph: 'stone_marble', slot: 'wall', roughness: 0.78, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
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
it('preserves the exact original detailed instanced master and reconciles source/import bytes', async () => {
  const bytes = baroloPalaceStudy.encodeAssembly((build, name) => {
    const b = new MeshBufferBuilder(),
      a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
    build(a.wrap(b));
    const m = b.finalize();
    return encodeGlb(
      m,
      a.materials(m.groups).map((s, i) => ({
        ...s,
        name: `${s.sharedSurface ? s.name : m.groups[i].slot}-${m.groups[i].slot}`,
      })),
      name,
    );
  }, encodeAuthoredAssembly);
  expect(bytes.byteLength).toBe(49608172);
  execFileSync(
    process.execPath,
    ['packages/worldgen/scripts/generate-signature-towers.mjs', '--ids=N0234', '--check'],
    { cwd: resolve('../..'), stdio: 'pipe' },
  );
  const spec = await read(`${source}/spec.json`);
  expect(spec.sourceFacts.plotWidthMeters).toBe(30.88);
  expect(spec.sourceFacts.plotDepthMeters).toBe(44.21);
}, 120000);
it('retains the open through passage, H-plan light courts, offset 100 m crown and readable lantern at every level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    reference = decode(await readFile(`${source}/models/source.glb`));
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [3.27, 7.13, 10.17])
      expect(nearest(d.triangles, [0.17, y, -40], [0, 0, 1]), `${l.name} through passage`).toBe(
        Infinity,
      );
    for (const x of [-10.3, 10.3])
      expect(nearest(d.triangles, [x, 110, 0.13], [0, -1, 0]), `${l.name} open light court`).toBe(
        Infinity,
      );
    const floor = nearestWithNormal(d.triangles, [0.31, 1.3, 4.3], [0, -1, 0]);
    expect(floor.distance).toBeCloseTo(1.22, 3);
    expect(floor.normal[1]).toBeGreaterThan(0.99);
    for (const [o, v] of [
      [
        [10.3, 21.3, -50],
        [0, 0, 1],
      ],
      [
        [-40, 21.3, 16.7],
        [1, 0, 0],
      ],
      [
        [40, 21.3, 16.7],
        [-1, 0, 0],
      ],
    ]) {
      const a = nearestWithNormal(reference.triangles, o, v),
        b = nearestWithNormal(d.triangles, o, v);
      expect(Number.isFinite(b.distance)).toBe(true);
      expect(Math.abs(a.distance - b.distance)).toBeLessThanOrEqual(l.errorMeters + 0.1);
      // A front ray can strike the oblique cheek of a projecting bow bay.
      expect(dot(b.normal, v), `${l.name} outward wall/bay face`).toBeLessThan(-0.4);
      if (Math.abs(v[0]) > 0.5) expect(dot(a.normal, b.normal)).toBeGreaterThan(0.99);
    }
    expect(
      Math.max(
        ...d.g.meshes
          .flatMap((m) => m.primitives)
          .map((p) => d.g.accessors[p.attributes.POSITION].max[1]),
      ),
    ).toBeCloseTo(100, 3);
    const top = nearest(d.triangles, [0.23, 110, -14.13], [0, -1, 0]);
    expect(top).toBeLessThan(10.7);
    expect(nearest(d.triangles, [0.23, 110, 14.13], [0, -1, 0])).toBeGreaterThan(55);
    if (l.name !== 'skyline') {
      const clear = d.g.materials.find((m) => m.alphaMode === 'BLEND');
      expect(clear.pbrMetallicRoughness.baseColorFactor[3]).toBe(0.52);
      expect(d.transparentTriangles.some((p) => p.every((v) => v[1] > 95.5 && v[1] < 99.1))).toBe(
        true,
      );
    }
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
