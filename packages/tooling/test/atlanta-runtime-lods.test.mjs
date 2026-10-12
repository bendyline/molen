import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { atlantaStudy } from '../../worldgen/scripts/signature-tower-atlanta-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dn/dn5/n0207_bank_of_america_plaza'),
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
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
  foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  gold: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  clear_glass: {
    slot: 'window',
    localRef: 'palette:#feffff',
    roughness: 0.12,
    metallic: 0.05,
    baseColorFactor: [1, 1, 1, 0.52],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
it('reproduces the preserved Atlanta master and independently signs west wing and three portals', async () => {
  const prior = await read(`${source}/georeferencing-baseline.json`),
    m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, { legacyAlphaFields: true });
  atlantaStudy.build(a.wrap(b), prior);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(mesh.triangleCount).toBe(401609);
  expect(
    hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original Bank of America Plaza'))),
  ).toBe('sha256:64b7f8122901de67d5066dae6bd9469e6f3587bc9a5dc80cefcb068033a4a35b');
  const spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(hash(await readFile(`${runtime}/model.glb`))).toBe(asset.hash);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(prior.heading);
  expect(m.elements).toHaveLength(5);
  for (const e of prior.elements) {
    const p = m.elements.find((p) => p.id === e.id && p.type === e.type);
    e.type === 'way'
      ? expect(p.geometry).toEqual(e.geometry)
      : expect([p.lon, p.lat]).toEqual([e.lon, e.lat]);
  }
  const raw = m.elements.find((e) => e.id === 39449840);
  expect(raw.tags.wikidata).toBe('Q499486');
  expect(raw.tags.height).toBe('311.8');
  expect(raw.tags['building:levels']).toBe('55');
  expect(spec.sourceFacts.occupiedHeightMeters).toBe(222);
  const project = (p) => {
    const r = 6378137,
      f = Math.cos((m.anchor[1] * Math.PI) / 180),
      e = (((p.lon - m.anchor[0]) * Math.PI) / 180) * r * f,
      s =
        (-r * Math.asinh(Math.tan((p.lat * Math.PI) / 180)) +
          r * Math.asinh(Math.tan((m.anchor[1] * Math.PI) / 180))) *
        f;
    return [
      e * Math.cos(m.heading) - s * Math.sin(m.heading),
      e * Math.sin(m.heading) + s * Math.cos(m.heading),
    ];
  };
  for (const p of raw.geometry.map(project))
    expect(
      Math.min(...prior.geometry.towerOutline.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
    ).toBeLessThan(0.001);
  const wing = m.elements.find((e) => e.id === 886044291);
  expect(wing.tags['building:levels']).toBe('3');
  expect(Math.min(...wing.geometry.map(project).map((p) => p[0]))).toBeLessThan(-105);
  for (const [id, expected] of [
    [3201574161, [-18.67839, -19.25988]],
    [3201574162, [18.5019, 17.87758]],
    [3201574167, [18.15665, -17.74658]],
  ]) {
    const p = project(m.elements.find((e) => e.id === id));
    expect(p[0]).toBeCloseTo(expected[0], 4);
    expect(p[1]).toBeCloseTo(expected[1], 4);
  }
  expect(m.heading).toBeCloseTo(0.766815, 12);
  expect(decode(await readFile(`${source}/models/source.glb`)).g.images ?? []).toHaveLength(0);
}, 120000);
it('retains stepped shaft, signed western wing, recessed arches, open crown and gold tip in every level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    master = decode(await readFile(`${source}/models/source.glb`));
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [25, 100, 160, 210])
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8,
          o = [60 * Math.cos(a), y, 60 * Math.sin(a)],
          v = [-Math.cos(a), 0, -Math.sin(a)],
          ref = nearestWithNormal(master.triangles, o, v),
          hit = nearestWithNormal(d.triangles, o, v);
        expect(
          Number.isFinite(ref.distance) && Number.isFinite(hit.distance),
          `${l.name} shaft ${y}/${k}`,
        ).toBe(true);
        expect(
          Math.abs(hit.distance - ref.distance) * Math.abs(dot(v, ref.normal)),
          `${l.name} shaft displacement ${y}/${k}`,
        ).toBeLessThanOrEqual(l.errorMeters + 0.015);
      }
    expect(nearest(d.triangles, [-60, 20, -25], [0, -1, 0]), `${l.name} west roof`).toBeCloseTo(
      8,
      2,
    );
    expect(nearest(d.triangles, [0, 320, 0], [0, -1, 0]), `${l.name} gold tip`).toBeCloseTo(8.2, 2);
    // A local probe through the actual cavity; absent thin bars may legitimately produce Infinity.
    expect(nearest(d.triangles, [0, 273, 0], [0, 0, 1]), `${l.name} crown cavity`).toBeGreaterThan(
      3.5,
    );
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2,
        z = 18.4 * Math.SQRT2,
        turn = (x, y, zz) => [
          Math.cos(a) * x + Math.sin(a) * zz,
          y,
          -Math.sin(a) * x + Math.cos(a) * zz,
        ];
      const wallRay = [-Math.sin(a), 0, -Math.cos(a)],
        wallHit = nearestWithNormal(d.triangles, turn(1.5, 10.32, z + 5), wallRay);
      expect(wallHit.distance, `${l.name} above-arch wall ${k}`).toBeLessThan(6);
      expect(
        dot(wallRay, wallHit.normal),
        `${l.name} above-arch outward winding ${k}`,
      ).toBeLessThan(-0.9);
      expect(
        nearest(l.name === 'skyline' ? d.triangles : d.windowTriangles, turn(0, 5.32, z + 5), [
          -Math.sin(a),
          0,
          -Math.cos(a),
        ]),
        `${l.name} recessed door ${k}`,
      ).toBeCloseTo(5.9, 2);
    }
  }
}, 120000);
it('rebuilds four levels byte-identically within download/triangle/draw budgets, with separate vertex streams', async () => {
  const p = resolve(runtime, 'asset.json'),
    asset = await read(p),
    before = await Promise.all(
      asset.runtimeLods.levels.map((l) => readFile(`${runtime}/${l.file}`)),
    );
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.recipeHash).toBe(asset.runtimeLods.recipeHash);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(`${runtime}/${l.file}`);
    expect(bytes.equals(before[i])).toBe(true);
    expect(hash(bytes)).toBe(l.hash);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    const { g } = decode(bytes);
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(0);
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
