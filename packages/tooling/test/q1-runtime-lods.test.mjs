import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineNext } from '../../worldgen/scripts/signature-tower-next-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/r7/r7j/q1_tower'),
  runtime = await runtimeLodFixture(source.replace(/([\\/])source([\\/])/, '$1assets$2')),
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

it('reproduces the original master and keeps the separately mapped podium and Pacific-facing mast', async () => {
  const m = (
      await read(resolve('../../content/earth/structures/georeferencing.json'))
    ).candidates.find((p) => p.candidateId === 'q1_tower'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
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
    });
  skylineNext.find((p) => p.id === 'q1_tower').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    f = await read(`${source}/map-frame.json`);
  expect(f.wikidataId).toBe('Q125846');
  expect(f.elements.map((p) => p.id)).toEqual([188325694, 492716887]);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(f.heading).toBeCloseTo(-0.518755024953, 10);
  expect(f.orientationControl.entranceSurveyed).toBe(false);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  const [x, z] = f.orientationControl.mastLocal,
    E = x * Math.cos(f.heading) + z * Math.sin(f.heading),
    S = -x * Math.sin(f.heading) + z * Math.cos(f.heading);
  expect(E).toBeCloseTo(18.596555, 5);
  expect(S).toBeCloseTo(9.580613, 5);
  expect(E).toBeGreaterThan(0);
  expect(S).toBeGreaterThan(0);
  expect(spec.sourceFacts.climbLaunchDatum).toBe('above street');
  expect(spec.sourceFacts.climbSummitDatum).toBe('above sea level');
});
it('retains complete shaft and podium, an open sail/glazed ceiling and exterior climb at all levels', async () => {
  const asset = await read(`${runtime}/asset.json`),
    f = await read(`${source}/map-frame.json`),
    [mx, mz] = f.orientationControl.mastLocal,
    paths = [
      `${source}/models/source.glb`,
      ...asset.runtimeLods.levels.map((l) => `${runtime}/${l.file}`),
    ];
  const route = [
      [-19.5, -13.8],
      [-10, -19.3],
      [0, -18.1],
      [9, -15.2],
      [19, -8.4],
      [23.1, -2.2],
    ],
    lengths = [0];
  for (let i = 1; i < route.length; i++)
    lengths.push(lengths.at(-1) + Math.hypot(...route[i].map((v, k) => v - route[i - 1][k])));
  for (const path of paths) {
    const { g, triangles: ts } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBeCloseTo(322.5, 3);
    expect(nearest(ts, [mx, 330, mz], [0, -1, 0])).toBeCloseTo(7.5, 3);
    // The crown has no opaque roof at its top. A downward interior ray must reach the
    // sloping observation glazing well below the sail edge, rather than a flat cap.
    const ceiling = 234.5 + (10.5 * (2 + 22.7)) / 45.4;
    expect(nearest(ts, [2, 294, 3], [0, -1, 0]), `${path} open crown`).toBeCloseTo(
      294 - ceiling,
      2,
    );
    // Independent rear podium sample lies outside the tower; preserve its separate roof.
    expect(nearest(ts, [-38, 15, 20], [0, -1, 0]), `${path} mapped podium`).toBeCloseTo(8.8, 3);
    for (const y of [70, 160, 225])
      for (let i = 0; i < 12; i++) {
        const a = ((i + 0.31) * 2 * Math.PI) / 12,
          d = [-Math.cos(a), 0, -Math.sin(a)],
          hit = nearest(ts, [40 * Math.cos(a), y, 40 * Math.sin(a)], d);
        expect(hit, `${path} shaft ${y} azimuth ${i}`).toBeGreaterThan(10);
        expect(hit).toBeLessThan(25);
      }
    for (const ratio of [0.12, 0.4, 0.7, 0.94]) {
      const d = ratio * lengths.at(-1);
      let i = 1;
      while (i < lengths.length - 1 && d > lengths[i]) i++;
      const q = route[i - 1].map(
          (v, k) => v + ((route[i][k] - v) * (d - lengths[i - 1])) / (lengths[i] - lengths[i - 1]),
        ),
        y = 240 + 30 * ratio;
      const hit = nearest(ts, [q[0], y + 3, q[1]], [0, -1, 0]);
      expect(hit, `${path} exposed climb ${ratio}`).toBeGreaterThan(2.4);
      expect(hit).toBeLessThan(3.2);
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
