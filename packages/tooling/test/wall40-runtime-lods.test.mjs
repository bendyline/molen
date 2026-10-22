import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/n0177_40_wall_street'),
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

it('reproduces the original 40 Wall Street master and verifies thirty signed map geometries', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
      brick: { graph: 'brick', slot: 'wall', roughness: 0.9, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineWorld.find((p) => p.id === 'N0177').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    independent = await read(`${source}/map-parts.json`);
  expect(m.elements).toHaveLength(30);
  expect(m.elements.find((p) => p.id === 278042253).tags.wikidata).toBe('Q218305');
  for (const p of m.elements)
    expect(p.geometry).toEqual(independent.elements.find((q) => q.id === p.id).geometry);
  for (const p of m.elements.find((p) => p.id === 278042253).geometry) {
    const q = local(m, p);
    expect(
      Math.min(...m.geometry.outline.map((v) => Math.hypot(v[0] - q[0], v[1] - q[1]))),
    ).toBeLessThan(0.002);
  }
  expect(m.heading).toBeCloseTo(-0.668872591958, 12);
  expect(m.orientationControl.roofPart).toBe(286057109);
  expect(m.orientationControl.wallStreetFace).toBe('+Z southwest');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
});
function local(m, p) {
  const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
    S = -(p.lat - m.anchor[1]) * 111319.490793;
  return [
    E * Math.cos(m.heading) - S * Math.sin(m.heading),
    E * Math.sin(m.heading) + S * Math.cos(m.heading),
  ];
}
it('retains asymmetric shafts, closed four-face pyramid and four attached dormers at every level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    m = await read(`${source}/map-frame.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles,
    roof = m.elements
      .find((p) => p.id === 286057109)
      .geometry.slice(0, -1)
      .map((p) => local(m, p)),
    center = roof.reduce((s, p) => [s[0] + p[0] / roof.length, s[1] + p[1] / roof.length], [0, 0]);
  expect(roof).toHaveLength(4);
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    for (const y of [
      6, 20, 38, 56, 62, 68, 85, 105, 119, 128, 160, 200, 218, 225, 236, 252, 267, 276,
    ])
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8,
          o = [Math.cos(a) * 90, y, Math.sin(a) * 90],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(target)) expect(hit).toBe(Infinity);
        else
          expect(Math.abs(hit - target), `${level.name} shaft ${y}/${i}`).toBeLessThan(allowance);
      }
    for (const [x, z] of [
      [-28, 0],
      [-20, 19],
      [28, 0],
      [20, -19],
      [center[0], center[1]],
      [center[0] + 6, center[1] + 4],
      [center[0] - 6, center[1] - 4],
    ]) {
      const o = [x, 300, z],
        d = [0, -1, 0],
        target = nearest(master, o, d),
        hit = nearest(triangles, o, d);
      if (!Number.isFinite(target)) expect(hit).toBe(Infinity);
      else expect(Math.abs(hit - target), `${level.name} roof ${x}/${z}`).toBeLessThan(allowance);
    }
    const vertices = triangles.flat();
    expect(vertices.reduce((s, p) => Math.max(s, p[1]), -Infinity)).toBeCloseTo(282.5496, 3);
    expect(vertices.reduce((s, p) => Math.min(s, p[1]), Infinity)).toBe(0);
    const poleTop = vertices.filter((p) => Math.abs(p[1] - 282.5496) < 0.001),
      poleCenter = [0, 2].map(
        (axis) =>
          (Math.min(...poleTop.map((p) => p[axis])) + Math.max(...poleTop.map((p) => p[axis]))) / 2,
      );
    expect(Math.hypot(poleCenter[0] - center[0], poleCenter[1] - center[1])).toBeLessThan(0.001);
    const dormerTops = triangles.filter((t) => t.every((p) => Math.abs(p[1] - 234.6) < 0.001));
    expect(dormerTops).toHaveLength(8);
    for (const t of dormerTops)
      expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
    const roofCaps = triangles.filter((t) => t.every((p) => Math.abs(p[1] - 262) < 0.001));
    expect(roofCaps.length).toBeGreaterThanOrEqual(2);
    for (const t of roofCaps) expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
    // Independently projected eaves must remain seated on the 230 m upper shaft.
    for (const p of roof)
      expect(
        vertices.some(
          (v) => Math.hypot(v[0] - p[0], v[2] - p[1]) < 0.002 && Math.abs(v[1] - 230) < 0.002,
        ),
      ).toBe(true);
    expect(g.materials.every((m) => (m.alphaMode ?? 'OPAQUE') === 'OPAQUE')).toBe(true);
    expect(g.materials.length).toBeLessThanOrEqual(4);
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
