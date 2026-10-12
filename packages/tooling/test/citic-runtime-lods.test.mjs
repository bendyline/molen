import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineGlobal } from '../../worldgen/scripts/signature-tower-global-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/ws/ws0/n0164_citic_plaza'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  read = async (p) => JSON.parse(await readFile(p)),
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

it('reproduces the preserved master and binds independently mapped crown, mast and contextual identity', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
    });
  skylineGlobal.find((p) => p.id === 'N0164').build(a.wrap(b), m);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original CITIC Plaza')))).toBe(
    'sha256:b153fed1974da91e257d1987bd8a429d450aa34e9a6a7637ef2fb72676a73992',
  );
  const spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`),
    f = await read(`${source}/map-frame.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(f.identityStatus).toContain('no exact-QID tag');
  expect(f.elements).toHaveLength(15);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(f.heading).toBeCloseTo(-0.0007008769705450331, 12);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(f.contextElements.find((p) => p.id === 157418082).tags['name:en']).toBe(
    'CITIC Plaza International Apartment',
  );
  const p = f.elements.find((p) => p.id === 1548063162).geometry.slice(0, -1),
    lng = p.reduce((s, q) => s + q.lon / p.length, 0),
    lat = p.reduce((s, q) => s + q.lat / p.length, 0),
    E = (lng - f.anchor[0]) * 111319.490793 * Math.cos((f.anchor[1] * Math.PI) / 180),
    S = -(lat - f.anchor[1]) * 111319.490793;
  expect(E).toBeGreaterThan(16);
  expect(Math.abs(S)).toBeLessThan(0.1);
  expect(f.orientationControl.entranceSurveyed).toBe(false);
  expect(spec.sourceFacts.occupiedHeightMeters).toBe(296.9);
  expect(spec.sourceFacts.mappedEastMastMeters).toBe(391.1);
});
it('retains continuous facades, open split crown, round lobby and both spires at every browser level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    f = await read(`${source}/map-frame.json`);
  for (const path of [
    `${source}/models/source.glb`,
    ...asset.runtimeLods.levels.map((l) => `${runtime}/${l.file}`),
  ]) {
    const { g, values, triangles: ts } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBeCloseTo(390.2, 3);
    for (const y of [70, 160, 290])
      for (let i = 0; i < 12; i++) {
        const a = ((i + 0.21) * Math.PI * 2) / 12,
          hit = nearest(
            ts,
            [40 * Math.cos(a), y, 40 * Math.sin(a)],
            [-Math.cos(a), 0, -Math.sin(a)],
          );
        expect(hit, `${path} complete tower at ${y}`).toBeGreaterThan(5);
        expect(hit).toBeLessThan(40);
      }
    expect(nearest(ts, [0, 325, 12], [0, -1, 0]), `${path} inner round crown`).toBeCloseTo(14.2, 3);
    expect(nearest(ts, [0, 312, 12], [0, 1, 0]), `${path} open split crown`).toBe(Infinity);
    expect(nearest(ts, [0, 303, 23], [0, -1, 0]), `${path} central office roof`).toBeCloseTo(6, 3);
    expect(nearest(ts, [0, 8, 40], [0, 0, -1]), `${path} recessed round lobby`).toBeGreaterThan(
      23.9,
    );
    expect(nearest(ts, [0, 8, 40], [0, 0, -1])).toBeLessThan(26);
    expect(nearest(ts, [0, 8, 20], [0, 1, 0]), `${path} lobby overhead slab`).toBeCloseTo(9.7, 3);
    for (const id of [1548063161, 1548063162]) {
      const p = f.elements.find((p) => p.id === id).geometry.slice(0, -1),
        lng = p.reduce((s, q) => s + q.lon / p.length, 0),
        lat = p.reduce((s, q) => s + q.lat / p.length, 0),
        E = (lng - f.anchor[0]) * 111319.490793 * Math.cos((f.anchor[1] * Math.PI) / 180),
        S = -(lat - f.anchor[1]) * 111319.490793,
        x = E * Math.cos(f.heading) - S * Math.sin(f.heading),
        z = E * Math.sin(f.heading) + S * Math.cos(f.heading);
      expect(nearest(ts, [x, 400, z], [0, -1, 0]), `${path} mast${id}`).toBeCloseTo(9.8, 3);
      expect(nearest(ts, [x + 3, 360, z], [-1, 0, 0])).toBeLessThan(3);
    }
    let checked = 0;
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const points = values(p.attributes.POSITION),
        normals = values(p.attributes.NORMAL);
      for (let i = 0; i < points.length; i++) {
        const [x, y, z] = points[i],
          r = Math.hypot(x, z),
          n = normals[i];
        if (y >= 0.17 && y < 18 && r > 15.5 && r < 16.1 && Math.abs(n[1]) < 0.001) {
          expect(x * n[0] + z * n[2], `${path} outward lobby`).toBeGreaterThan(14);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  }
});
it('rebuilds deterministic budgeted levels with separate GPU vertex streams and shared surfaces', async () => {
  const before = (await read(`${runtime}/asset.json`)).runtimeLods,
    after = await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect(after.recipeHash).toBe(before.recipeHash);
  expect(after.levels.map((l) => l.hash)).toEqual(before.levels.map((l) => l.hash));
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
    expect(hash(b)).toBe(l.hash);
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
