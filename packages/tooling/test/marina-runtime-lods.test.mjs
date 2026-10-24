import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/th/thr/23_marina'),
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
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

it('reproduces 23 Marina original master and signs the independent triangular map and mast', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      clear_glass: {
        slot: 'window',
        localRef: 'palette:#feffff',
        roughness: 0.12,
        metallic: 0.05,
        opacity: 0.52,
        alphaMode: 'BLEND',
        baseColorFactor: [1, 1, 1, 0.52],
        doubleSided: true,
      },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineWorld.find((p) => p.id === '23_marina').build(a.wrap(b), m);

  const independent = await read(`${source}/map-parts.json`),
    spec = await read(`${source}/spec.json`);
  expect(m.elements).toHaveLength(3);
  expect(m.elements.find((p) => p.id === 186351097).tags.wikidata).toBe('Q216264');
  for (const p of independent.elements)
    expect(m.elements.find((q) => q.id === p.id).geometry).toEqual(p.geometry);
  const local = (p) => {
    const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      S = -(p.lat - m.anchor[1]) * 111319.490793;
    return [
      E * Math.cos(m.heading) - S * Math.sin(m.heading),
      E * Math.sin(m.heading) + S * Math.cos(m.heading),
    ];
  };
  for (const p of m.elements.find((p) => p.id === 186351097).geometry) {
    const q = local(p);
    expect(
      Math.min(...m.geometry.outline.map((v) => Math.hypot(v[0] - q[0], v[1] - q[1]))),
    ).toBeLessThan(0.002);
  }
  const mast = m.elements
      .find((p) => p.id === 186351102)
      .geometry.slice(0, -1)
      .map(local),
    c = mast.reduce((s, p) => [s[0] + p[0] / mast.length, s[1] + p[1] / mast.length], [0, 0]);
  expect(c[0]).toBeCloseTo(-4.64670006789034, 6);
  expect(c[1]).toBeCloseTo(-1.4478434202331212, 6);
  expect(Math.hypot(...c)).toBeGreaterThan(4.8);
  expect(m.heading).toBeCloseTo(-0.72546838218, 12);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.sourceFacts.architecturalHeightMeters).toBe(392.4);
  const { g, values } = decode(await readFile(`${source}/models/source.glb`));
  expect(g.materials).toHaveLength(4);
  expect(g.materials.filter((p) => p.alphaMode === 'BLEND')).toHaveLength(1);
  for (const p of g.meshes.flatMap((m) => m.primitives))
    if (g.materials[p.material].alphaMode === 'BLEND') {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      expect(ids.reduce((s, id) => Math.max(s, ps[id][1]), -Infinity)).toBeLessThan(311);
      expect(ids.reduce((s, id) => Math.min(s, ps[id][1]), Infinity)).toBeGreaterThan(225);
    }
}, 60000);
it('retains offset octagonal facade, all 48 terraces, open canopy slots and capped mast through every level', async () => {
  const m = await read(`${source}/map-frame.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles,
    asset = await read(`${runtime}/asset.json`),
    local = (p) => {
      const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
        S = -(p.lat - m.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    },
    plan = m.elements
      .find((p) => p.id === 907717855)
      .geometry.slice(0, -1)
      .map(local),
    center = m.orientationControl.mastCenter;
  const edges = plan.map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    }),
    cardinal = edges.filter((e) => Math.abs(e.n[0]) > 0.95 || Math.abs(e.n[2]) > 0.95);
  expect(plan).toHaveLength(8);
  expect(cardinal).toHaveLength(4);
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    // Avoid omitted far terrace rails at 310 m; slab probes below check every terrace.
    for (const { a, b, n } of edges)
      for (const u of [0.22, 0.43, 0.72])
        for (const y of [30, 100, 123, 170, 220, 260, 312]) {
          const o = [a[0] + (b[0] - a[0]) * u + n[0] * 20, y, a[1] + (b[1] - a[1]) * u + n[2] * 20],
            d = n.map((v) => -v);
          expect(
            Math.abs(nearest(triangles, o, d) - nearest(master, o, d)),
            `${level.name} facade ${y}`,
          ).toBeLessThan(allowance);
        }
    for (const { a, b, n } of cardinal)
      for (let i = 0; i < 12; i++) {
        const y = 225.9 + 7.6 * i,
          mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          o = [mid[0] + n[0] * 3.5, y + 4, mid[1] + n[2] * 3.5],
          d = [0, -1, 0];
        expect(
          Math.abs(nearest(triangles, o, d) - nearest(master, o, d)),
          `${level.name} terrace ${i}`,
        ).toBeLessThan(allowance);
        expect(nearest(triangles, o, d)).toBeLessThan(4.4);
      }
    const vertices = triangles.flat();
    expect(vertices.reduce((s, p) => Math.min(s, p[1]), Infinity)).toBe(0);
    expect(vertices.reduce((s, p) => Math.max(s, p[1]), -Infinity)).toBeCloseTo(392.4, 3);
    for (const { a, b, n } of edges) {
      const scale = 1 - ((349 - 317.3) / (369 - 317.3)) * 0.9,
        mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        q = [
          center[0] + (mid[0] - center[0]) * scale,
          349,
          center[1] + (mid[1] - center[1]) * scale,
        ],
        o = [q[0] + n[0] * 20, 349, q[2] + n[2] * 20],
        d = n.map((v) => -v);
      if (Math.abs(n[0]) < 0.95 && Math.abs(n[2]) < 0.95)
        expect(
          Math.abs(nearest(triangles, o, d) - nearest(master, o, d)),
          `${level.name} canopy`,
        ).toBeLessThan(allowance);
    }
    // Mast top is registered at the separately mapped center, not the podium origin.
    const tip = vertices.filter((p) => p[1] > 392.39);
    expect(tip.length).toBeGreaterThan(0);
    for (const p of tip) expect(Math.hypot(p[0] - center[0], p[2] - center[1])).toBeLessThan(0.026);
    expect(g.materials.filter((p) => p.alphaMode === 'BLEND')).toHaveLength(
      level.name === 'skyline' ? 0 : 1,
    );
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
