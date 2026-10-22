import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/we/wec/n0181_central_plaza'),
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

it('reproduces Central Plaza original master and signs the independent triangular map and mast', async () => {
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
  skylineWorld.find((p) => p.id === 'N0181').build(a.wrap(b), m);
  const independent = await read(`${source}/map-parts.json`),
    spec = await read(`${source}/spec.json`);
  expect(m.elements).toHaveLength(9);
  expect(m.elements.find((p) => p.id === 27087018).tags.wikidata).toBe('Q112640');
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
  for (const p of m.elements.find((p) => p.id === 27087018).geometry) {
    const q = local(p);
    expect(
      Math.min(...m.geometry.outline.map((v) => Math.hypot(v[0] - q[0], v[1] - q[1]))),
    ).toBeLessThan(0.002);
  }
  const mast = m.elements
      .find((p) => p.id === 1047690918)
      .geometry.slice(0, -1)
      .map(local),
    center = mast.reduce((s, p) => [s[0] + p[0] / mast.length, s[1] + p[1] / mast.length], [0, 0]);
  expect(Math.hypot(center[0] + 0.01329, center[1] - 4.79924)).toBeLessThan(0.01);
  expect(m.heading).toBeCloseTo(0.076907698117, 12);
  expect(m.orientationControl.southFront).toBe('+Z');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  const { g, values } = decode(await readFile(`${source}/models/source.glb`));
  expect(g.materials).toHaveLength(4);
  expect(g.materials.filter((p) => p.alphaMode === 'BLEND')).toHaveLength(1);
  for (const p of g.meshes.flatMap((m) => m.primitives))
    if (g.materials[p.material].alphaMode === 'BLEND') {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      expect(ids.reduce((s, id) => Math.max(s, ps[id][1]), -Infinity)).toBeLessThan(23.601);
    }
});
it('retains all three facades, eighteen base columns, mapped crown, roof and open mast support through four levels', async () => {
  const m = await read(`${source}/map-frame.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles,
    asset = await read(`${runtime}/asset.json`),
    plan = m.geometry.outline;
  const edges = plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 35);
  expect(edges).toHaveLength(3);
  const center = [-0.01329, 4.79924],
    columns = edges
      .flatMap(({ a, b }) =>
        Array.from({ length: 5 }, (_, i) => {
          const t = 0.12 + i * 0.19,
            p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          return [center[0] + (p[0] - center[0]) * 0.96, center[1] + (p[1] - center[1]) * 0.96];
        }),
      )
      .concat([
        [0, -24.3],
        [-25.25, 19.35],
        [25.25, 19.35],
      ]);
  expect(columns).toHaveLength(18);
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    for (const { a, b, n } of edges)
      for (const u of [0.22, 0.42, 0.72])
        for (const y of [60, 140, 168, 208, 264]) {
          const o = [a[0] + (b[0] - a[0]) * u + n[0] * 20, y, a[1] + (b[1] - a[1]) * u + n[2] * 20],
            d = n.map((v) => -v);
          expect(
            Math.abs(nearest(triangles, o, d) - nearest(master, o, d)),
            `${level.name} facade ${y}`,
          ).toBeLessThan(allowance);
        }
    for (const [x, z] of columns) {
      const o = [x + 4, 10, z],
        d = [-1, 0, 0];
      expect(
        Math.abs(nearest(triangles, o, d) - nearest(master, o, d)),
        `${level.name} base column`,
      ).toBeLessThan(allowance);
    }
    for (const [x, z] of [
      [0, 14],
      [-5, 9],
      [5, 9],
      [-7, 1],
      [7, 1],
    ]) {
      const o = [x, 350, z],
        d = [0, -1, 0];
      expect(
        Math.abs(nearest(triangles, o, d) - nearest(master, o, d)),
        `${level.name} roof`,
      ).toBeLessThan(allowance);
    }
    const vertices = triangles.flat();
    expect(vertices.reduce((s, p) => Math.min(s, p[1]), Infinity)).toBe(0);
    expect(vertices.reduce((s, p) => Math.max(s, p[1]), -Infinity)).toBeCloseTo(374.3, 3);
    const roof = triangles.filter(
      (t) =>
        t.some((p) => Math.abs(p[1] - 310.3) < 0.0001) &&
        t.filter((p) => Math.abs(p[1] - 288.4) < 0.0001).length === 2,
    );
    expect(roof).toHaveLength(3);
    for (const t of roof) expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
    // An offset ray passes through the open frame; a central ray hits the tapered mast.
    expect(nearest(triangles, [0.98671, 324, 20], [0, 0, -1])).toBe(Infinity);
    expect(nearest(triangles, [-0.01329, 324, 20], [0, 0, -1])).toBeLessThan(16);
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
