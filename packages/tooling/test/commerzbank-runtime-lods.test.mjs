import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { partPlan } from '../../worldgen/scripts/signature-tower-expansion-models.mjs';
import { skylineNext } from '../../worldgen/scripts/signature-tower-next-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u0y/n0159_commerzbank_tower'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  read = async (p) => JSON.parse(await readFile(p));
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

it('reproduces the original master and retains independent three-core placement and named arrival', async () => {
  const m = (
      await read(resolve('../../content/earth/structures/georeferencing.json'))
    ).candidates.find((p) => p.candidateId === 'N0159'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineNext.find((p) => p.id === 'N0159').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    f = await read(`${source}/map-frame.json`);
  expect(f.wikidataId).toBe('Q151765');
  expect(f.elements).toHaveLength(21);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(f.orientationControl.entrance.id).toBe(1414949624);
  expect(f.orientationControl.entranceLocal[0]).toBeCloseTo(-17.979909, 5);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  const highest = partPlan(
      f,
      f.elements.find((p) => p.id === 183060773),
    ),
    c = highest.reduce((s, p) => s.map((v, i) => v + p[i] / highest.length), [0, 0]);
  expect(c[0]).toBeLessThan(-15);
  expect(c[1]).toBeGreaterThan(15);
  expect(f.heading).toBeCloseTo(0.03415534455, 10);
});
it('keeps a flat259m crown, open300m lattice, recessed arrival and all nine sky gardens', async () => {
  const f = await read(`${source}/map-frame.json`),
    e = f.orientationControl.entranceLocal,
    n = [-0.866025403784, 0, -0.5],
    mast = partPlan(
      f,
      f.elements.find((p) => p.id === 279967630),
    ),
    c = mast.reduce((s, p) => s.map((v, i) => v + p[i] / mast.length), [0, 0]),
    outer = partPlan(
      f,
      f.elements.find((p) => p.id === 183060777),
    ),
    exteriorDistance = (p) =>
      Math.min(
        ...outer.map((a, i) => {
          const b = outer[(i + 1) % outer.length],
            v = b.map((x, k) => x - a[k]),
            l = dot(v, v),
            t = Math.max(0, Math.min(1, dot(sub(p, a), v) / l));
          return Math.hypot(
            ...sub(
              p,
              a.map((x, k) => x + t * v[k]),
            ),
          );
        }),
      );
  for (const path of [
    `${source}/models/source.glb`,
    ...['skyline', 'district', 'street', 'closeup'].map((l) => `${runtime}/model.${l}.glb`),
  ]) {
    const { g, triangles: ts } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...ps.map((a) => a.max[1]))).toBeCloseTo(300, 3);
    expect(
      nearest(ts, [0.263393, 310, 6.071507], [0, -1, 0]),
      `${path} central atrium roof`,
    ).toBeCloseTo(150, 3);
    for (const p of [
      [-23, 21],
      [-25, 17],
    ])
      expect(nearest(ts, [p[0], 310, p[1]], [0, -1, 0]), `${path} flat crown`).toBeCloseTo(51, 3);
    expect(
      nearest(ts, [c[0] + 0.07, 310, c[1] + 0.04], [0, -1, 0]),
      `${path} open lattice interior`,
    ).toBeCloseTo(90, 3);
    if (!path.endsWith('skyline.glb'))
      expect(
        nearest(
          ts,
          [e[0] + 10 * n[0], 2, e[1] + 10 * n[2]],
          n.map((v) => -v),
        ),
        `${path} recessed main entrance`,
      ).toBeGreaterThan(10.35);
    if (path.endsWith('skyline.glb') || path.endsWith('district.glb')) continue;
    for (const [id, gardens] of [
      [279967645, [70, 110, 150]],
      [279967660, [40, 80, 120]],
      [279967663, [60, 100, 140]],
    ]) {
      const plan = partPlan(
          f,
          f.elements.find((p) => p.id === id),
        ),
        edges = plan
          .map((a, i) => {
            const b = plan[(i + 1) % plan.length],
              len = Math.hypot(b[0] - a[0], b[1] - a[1]),
              mid = a.map((v, k) => (v + b[k]) / 2);
            return { a, b, len, mid, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
          })
          // Probe the actual exterior, rather than a long edge shared with a solid corner core.
          .filter((p) => p.len > 2 && exteriorDistance(p.mid) < 0.002)
          .sort((a, b) => b.len - a.len),
        edge = edges[0],
        p = edge.a.map((v, i) => v + 0.37 * (edge.b[i] - v));
      for (const low of gardens) {
        const distance = nearest(
          ts,
          [p[0] + 10 * edge.n[0], low + 8.5, p[1] + 10 * edge.n[2]],
          edge.n.map((v) => -v),
        );
        expect(distance, `${path} garden ${id}/${low}`).toBeGreaterThan(11);
        expect(distance, `${path} garden rear wall ${id}/${low}`).toBeLessThan(70);
      }
    }
  }
});
it('rebuilds deterministic budgeted levels with separate GPU vertex streams and shared surfaces', async () => {
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
