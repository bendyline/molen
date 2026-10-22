import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/th/thr/n0184_rose_tower'),
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
  const goldTriangles = [];
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat(),
        colors = values(p.attributes.COLOR_0),
        divisor = g.accessors[p.attributes.COLOR_0].componentType === 5126 ? 1 : 255;
      for (let i = 0; i < ids.length; i += 3) {
        const js = ids.slice(i, i + 3);
        if (
          js.every((j) =>
            [0.67, 0.5, 0.24].every((v, k) => Math.abs(colors[j][k] / divisor - v) < 0.005),
          )
        )
          goldTriangles.push(js.map((j) => ps[j]));
      }
      return Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
    }),
  );
  return { g, values, triangles, goldTriangles };
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

it('reproduces the original Rose master and verifies fresh identity plus prior signed road frame', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
    });
  skylineWorld.find((p) => p.id === 'N0184').build(a.wrap(b), m);
  const baseline = await read(`${source}/georeferencing-baseline.json`),
    spec = await read(`${source}/spec.json`);
  expect(m.elements).toHaveLength(1);
  expect(m.elements[0].tags.wikidata).toBe('Q648338');
  expect(m.geometry.outline).toEqual(baseline.geometry.outline);
  expect(m.heading).toBeCloseTo(1.011171401094, 12);
  expect(m.orientationControl.roadFront).toBe('-X');
  expect(m.orientationControl.mast).toEqual([5.7, 0]);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  for (const p of m.elements[0].geometry) {
    const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      S = -(p.lat - m.anchor[1]) * 111319.490793,
      q = [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    expect(
      Math.min(...baseline.geometry.outline.map((v) => Math.hypot(v[0] - q[0], v[1] - q[1]))),
    ).toBeLessThan(0.002);
  }
  expect(spec.sourceFacts.architecturalHeightMeters).toBe(333);
  const { g } = decode(await readFile(`${source}/models/source.glb`));
  expect(g.materials).toHaveLength(3);
  expect(g.materials.every((p) => p.alphaMode !== 'BLEND')).toBe(true);
}, 60000);
it('retains curved lobes and petals, closes the shoulder gap and keeps the northeast mast and southwest canopy', async () => {
  const detailed = decode(await readFile(`${source}/models/source.glb`)),
    master = detailed.triangles,
    asset = await read(`${runtime}/asset.json`);
  const eyeY = 0.2 + (55 * 244.8) / 69;
  const eyeRing = detailed.goldTriangles.filter((t) =>
    t.every((p) => Math.abs(p[1] - eyeY) < 0.39),
  );
  expect(eyeRing).toHaveLength(96);
  for (const t of eyeRing) {
    const n = cross(sub(t[1], t[0]), sub(t[2], t[0]));
    const c = [0, 1, 2].map((i) => t.reduce((sum, p) => sum + p[i], 0) / 3);
    expect(n[0] * c[0] + n[2] * c[2], 'gold eye faces outward').toBeGreaterThan(0);
  }
  // Offset probes avoid narrow decorative eye rings and the original pane seams. The master
  // is the same for every level, so cast its probes once.
  const probes = [
    5.8, 22.5, 81.4, 145.7, 202.5, 245.5, 251.5, 267.5, 287.5, 299.5, 306.5, 309.5,
  ].flatMap((y) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = ((i + 0.37) / 32) * Math.PI * 2,
        o = [Math.cos(a) * 30, y, Math.sin(a) * 30],
        d = [-Math.cos(a), 0, -Math.sin(a)];
      return { y, i, o, d, target: nearest(master, o, d) };
    }),
  );
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    for (const { y, i, o, d, target } of probes) {
      const hit = nearest(triangles, o, d);
      expect(Number.isFinite(target), `${level.name} source ${y}/${i}`).toBe(true);
      expect(Math.abs(hit - target), `${level.name} surface ${y}/${i}`).toBeLessThan(allowance);
    }
    const vertices = triangles.flat();
    expect(vertices.reduce((s, p) => Math.min(s, p[1]), Infinity)).toBe(0);
    expect(vertices.reduce((s, p) => Math.max(s, p[1]), -Infinity)).toBe(333);
    const tip = vertices.filter((p) => p[1] > 332.99);
    for (const p of tip) expect(Math.hypot(p[0] - 5.7, p[2])).toBeLessThan(0.029);
    for (const [x, z] of [
      [0, 0],
      [1, 1],
      [-1, -1],
    ])
      expect(
        Math.abs(
          nearest(triangles, [x, 325, z], [0, -1, 0]) - nearest(master, [x, 325, z], [0, -1, 0]),
        ),
        `${level.name} sphere`,
      ).toBeLessThan(allowance);
    const canopy = triangles.filter((t) => t.every((p) => Math.abs(p[1] - 5.38) < 0.0001));
    expect(canopy).toHaveLength(2);
    for (const t of canopy) expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
    expect(nearest(triangles, [-15, 8, 0], [0, -1, 0])).toBeCloseTo(2.62, 3);
    expect(g.materials.filter((p) => p.alphaMode === 'BLEND')).toHaveLength(0);
  }
}, 60000);
it('rebuilds all levels deterministically within phone and geometry budgets without duplicated GPU layout', async () => {
  const assetPath = `${runtime}/asset.json`,
    after = await buildModelLandmarkLods(assetPath, { force: true });
  expect(after.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
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
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    expect(g.images ?? []).toHaveLength(0);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const pa = g.accessors[p.attributes.POSITION],
        na = g.accessors[p.attributes.NORMAL];
      expect(pa.bufferView).not.toBe(na.bufferView);
      expect(g.bufferViews[pa.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[na.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 60000);
