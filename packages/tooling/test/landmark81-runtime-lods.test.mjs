import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineNext } from '../../worldgen/scripts/signature-tower-next-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/w3/w3g/n0163_landmark_81'),
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

it('reproduces the preserved master and retains independent tower, hotel and signed mast controls', async () => {
  const m = (
      await read(resolve('../../content/earth/structures/georeferencing.json'))
    ).candidates.find((p) => p.candidateId === 'N0163'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineNext.find((p) => p.id === 'N0163').build(a.wrap(b), m);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original Landmark 81')))).toBe(
    'sha256:fa15f06beec25a5e48dbdf17f0078a8cdd2dbfbaec5e77c5819a9bfc2647334a',
  );
  const spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`),
    f = await read(`${source}/map-frame.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(f.wikidataId).toBe('Q18640924');
  expect(f.elements.map((p) => p.id)).toEqual([622296615, 622296616, 622296617, 622296618]);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(f.heading).toBeCloseTo(-0.193504070833, 10);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  const top = f.elements.find((p) => p.id === 622296618).geometry.slice(0, -1),
    lng = top.reduce((s, p) => s + p.lon / top.length, 0),
    lat = top.reduce((s, p) => s + p.lat / top.length, 0),
    E = (lng - f.anchor[0]) * 111319.490793 * Math.cos((f.anchor[1] * Math.PI) / 180),
    S = -(lat - f.anchor[1]) * 111319.490793,
    [x, z] = f.orientationControl.mastCenter;
  expect(x * Math.cos(f.heading) + z * Math.sin(f.heading)).toBeCloseTo(E, 5);
  expect(-x * Math.sin(f.heading) + z * Math.cos(f.heading)).toBeCloseTo(S, 5);
  expect(S).toBeLessThan(-18);
  expect(f.orientationControl.entranceSurveyed).toBe(false);
  expect(spec.sourceFacts.observationLevel81Status).toContain('earlier scheme');
});
it('keeps all thirty-six setback roofs, spire support and podium/atrium geometry at every level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    f = await read(`${source}/map-frame.json`),
    s = f.orientationControl,
    at = (x, z) => [
      s.towerCenter[0] + s.gridU[0] * x + s.gridV[0] * z,
      s.towerCenter[1] + s.gridU[1] * x + s.gridV[1] * z,
    ],
    heights = [
      [60, 120, 170, 140, 89, 65],
      [105, 265, 300, 257, 192, 102],
      [183, 400.2, 400.2, 310, 223, 134],
      [210, 400.2, 400.2, 320, 238, 148],
      [170, 280, 305, 269, 185, 90],
      [18, 18, 86, 130, 93, 62],
    ];
  for (const path of [
    `${source}/models/source.glb`,
    ...asset.runtimeLods.levels.map((l) => `${runtime}/${l.file}`),
  ]) {
    const { g, triangles: ts } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBeCloseTo(461.2, 3);
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 6; col++) {
        const q = at((col - 2.5) * 9 + 2.6, (row - 2.5) * 9 + 2.6),
          hi = heights[row][col];
        expect(
          nearest(ts, [q[0], hi + 5, q[1]], [0, -1, 0]),
          `${path} roof ${row},${col}`,
        ).toBeCloseTo(5, 3);
      }
    const [mx, mz] = s.mastCenter;
    expect(nearest(ts, [mx, 470, mz], [0, -1, 0])).toBeCloseTo(8.8, 3);
    expect(nearest(ts, [mx, 390, mz], [0, 1, 0]), `${path} spire support`).toBeCloseTo(10.2, 3);
    expect(nearest(ts, [-40, 30, 0], [0, -1, 0]), `${path} independent podium`).toBeCloseTo(
      15.6,
      3,
    );
    const a = at(-32, 6);
    expect(nearest(ts, [a[0], 30, a[1]], [0, -1, 0]), `${path} glazed atrium`).toBeCloseTo(11.4, 3);
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.23) * 2 * Math.PI) / 12,
        hit = nearest(
          ts,
          [mx + 40 * Math.cos(a), 360, mz + 40 * Math.sin(a)],
          [-Math.cos(a), 0, -Math.sin(a)],
        );
      expect(hit, `${path} continuous upper tower`).toBeGreaterThan(22);
      expect(hit).toBeLessThan(40);
    }
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
