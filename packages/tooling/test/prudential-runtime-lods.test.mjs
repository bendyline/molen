import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { encodeAuthoredAssembly } from '../../worldgen/scripts/authored-glb-assembly.mjs';
import { twoPrudentialPlazaStudy } from '../../worldgen/scripts/two-prudential-plaza-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dp/dp3/n0228_two_prudential_plaza'),
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

const originals = {
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
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
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
it('reproduces the original instanced master and honors the reviewed geometry override rather than silently encoding that old assembly', async () => {
  const bytes = twoPrudentialPlazaStudy.encodeAssembly((build, name) => {
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
  expect(bytes.byteLength).toBe(1268948);
  // Regression: sourceGeometry must affect the bytes even when the study has encodeAssembly.
  execFileSync(
    process.execPath,
    ['packages/worldgen/scripts/generate-signature-towers.mjs', '--ids=N0228', '--check'],
    { cwd: resolve('../..'), stdio: 'pipe' },
  );
  const spec = await read(`${source}/spec.json`),
    master = decode(await readFile(`${source}/models/source.glb`));
  expect(spec.assembly).toBeUndefined();
  expect(master.triangles).toHaveLength(spec.mesh.triangles);
  expect(master.triangles.length).toBe(52004);
  expect(master.g.nodes.every((n) => !n.extensions?.EXT_mesh_gpu_instancing)).toBe(true);
  const m = await read(`${source}/map-frame.json`),
    prior = await read(`${source}/georeferencing-baseline.json`);
  expect(m.heading).toBe(prior.heading);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.geometry).toEqual(prior.geometry);
  expect(m.elements[0].id).toBe(64388666);
  expect(m.elements[0].tags.wikidata).toBe('Q1121971');
  for (const q of m.elements[0].geometry) {
    const r = 6378137,
      f = Math.cos((m.anchor[1] * Math.PI) / 180),
      e = (((q.lon - m.anchor[0]) * Math.PI) / 180) * r * f,
      s =
        (-r * Math.asinh(Math.tan((q.lat * Math.PI) / 180)) +
          r * Math.asinh(Math.tan((m.anchor[1] * Math.PI) / 180))) *
        f,
      p = [
        Math.cos(m.heading) * e - Math.sin(m.heading) * s,
        Math.sin(m.heading) * e + Math.cos(m.heading) * s,
      ];
    expect(
      Math.min(...prior.geometry.outline.map((a) => Math.hypot(p[0] - a[0], p[1] - a[1]))),
    ).toBeLessThan(0.002);
  }
}, 120000);
it('keeps outward facades, chevron steps, diamond roof and open revolving entrances across browser levels', async () => {
  const reference = decode(await readFile(`${source}/models/source.glb`)),
    asset = await read(`${runtime}/asset.json`);
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [71.02, 158.2, 215.3])
      for (const [x, z, dx, dz] of [
        [40, -17, -1, 0],
        [-40, 17, 1, 0],
        [0, -32, 0, 1],
        [0, 32, 0, -1],
        [40, 0, -1, 0],
        [-40, 0, 1, 0],
      ]) {
        const o = [x, y, z],
          v = [dx, 0, dz],
          a = nearestWithNormal(reference.triangles, o, v),
          b = nearestWithNormal(d.triangles, o, v);
        expect(Number.isFinite(a.distance)).toBe(true);
        expect(Number.isFinite(b.distance), `${l.name} facade ${o}`).toBe(true);
        expect(
          Math.abs(a.distance - b.distance),
          `${l.name} displacement ${o}`,
        ).toBeLessThanOrEqual(l.errorMeters + 0.02);
        expect(dot(b.normal, v), `${l.name} outward`).toBeLessThan(-0.99);
      }
    for (const [x, z, y] of [
      [26, 19, 111],
      [-26, -19, 111],
      [21, 19, 173],
      [-21, -19, 173],
    ]) {
      const a = nearest(reference.triangles, [x, y + 5, z], [0, -1, 0]),
        b = nearest(d.triangles, [x, y + 5, z], [0, -1, 0]);
      expect(Math.abs(a - b), `${l.name} terrace`).toBeLessThanOrEqual(l.errorMeters + 0.02);
    }
    expect(
      nearest(d.triangles, [1, 290, 1], [0, -1, 0]),
      `${l.name} closed diamond roof`,
    ).toBeLessThan(15);
    expect(nearest(d.triangles, [12, 2, 12], [0, -1, 0])).toBeCloseTo(1.72, 2);
    expect(
      Math.max(
        ...d.g.meshes
          .flatMap((m) => m.primitives)
          .map((p) => d.g.accessors[p.attributes.POSITION].max[1]),
      ),
    ).toBeCloseTo(303.3, 4);
    if (l.name === 'street' || l.name === 'closeup') {
      const transparent = d.g.materials.filter((m) => m.alphaMode === 'BLEND');
      expect(transparent).toHaveLength(1);
      expect(transparent[0].pbrMetallicRoughness.baseColorFactor[3]).toBe(0.52);
      // Approach the centre of the southern passage. It remains free of fixed opaque walls;
      // a rotor leaf can cross farther inside the drum, with a metal collar overhead.
      expect(
        nearest(d.triangles, [-7, 1.7, -22.4], [0, 0, 1]),
        `${l.name} drum entrance gap`,
      ).toBeGreaterThan(1.2);
      expect(
        nearest(d.triangles, [-7, 3.6, -20.0755], [0, -1, 0]),
        `${l.name} drum roof`,
      ).toBeCloseTo(0.43, 2);
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
