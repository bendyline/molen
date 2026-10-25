import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/w2/w28/merdeka_118'),
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

it('reproduces the original Merdeka 118 master and verifies signed whole and mast geometry', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
    });
  skylineWorld.find((p) => p.id === 'merdeka_118').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    independent = await read(`${source}/map-parts.json`);
  expect(m.elements).toHaveLength(10);
  expect(m.elements.find((p) => p.id === 645604854).tags.wikidata).toBe('Q7969454');
  for (const p of independent.elements)
    expect(p.geometry).toEqual(m.elements.find((q) => q.id === p.id).geometry);
  for (const p of m.elements.find((p) => p.id === 645604854).geometry) {
    const q = local(m, p);
    expect(
      Math.min(...m.geometry.outline.map((v) => Math.hypot(v[0] - q[0], v[1] - q[1]))),
    ).toBeLessThan(0.002);
  }
  expect(m.heading).toBeCloseTo(1.546962847249, 12);
  expect(m.orientationControl.mastPart).toBe(629116778);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.sourceFacts.heightMeters).toBe(678.9);
});
function local(m, p) {
  const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
    S = -(p.lat - m.anchor[1]) * 111319.490793;
  return [
    E * Math.cos(m.heading) - S * Math.sin(m.heading),
    E * Math.sin(m.heading) + S * Math.cos(m.heading),
  ];
}
it('retains inclined facets, stepped crown, closed canopies and seated northeast angular spire through all levels', async () => {
  const asset = await read(`${runtime}/asset.json`),
    m = await read(`${source}/map-frame.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles,
    mast = m.elements
      .find((p) => p.id === 629116778)
      .geometry.slice(0, -1)
      .map((p) => local(m, p)),
    mastCenter = mast.reduce(
      (s, p) => [s[0] + p[0] / mast.length, s[1] + p[1] / mast.length],
      [0, 0],
    );
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    for (const y of [
      4, 15, 19, 60, 121, 123, 180, 246, 248, 300, 371, 373, 420, 487, 489, 504, 510, 518,
    ])
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8,
          o = [Math.cos(a) * 120, y, Math.sin(a) * 120],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(target)) expect(hit).toBe(Infinity);
        else
          expect(Math.abs(hit - target), `${level.name} shaft ${y}/${i}`).toBeLessThan(allowance);
      }
    // Above 520 m avoids comparing an omitted decorative crown railing with the mast skin.
    for (const y of [520.5, 540, 565, 595, 635, 670, 678.5])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          o = [30.18 + Math.cos(a) * 20, y, 15.74 + Math.sin(a) * 20],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(target)) expect(hit).toBe(Infinity);
        else expect(Math.abs(hit - target), `${level.name} mast ${y}/${i}`).toBeLessThan(allowance);
      }
    for (const [x, z] of [
      [-20, -10],
      [0, 0],
      [10, 15],
      [13, 6],
      [24, 15],
      [30.18, 15.74],
      [-29, -22],
    ]) {
      const o = [x, 720, z],
        d = [0, -1, 0],
        target = nearest(master, o, d),
        hit = nearest(triangles, o, d);
      if (!Number.isFinite(target)) expect(hit).toBe(Infinity);
      else expect(Math.abs(hit - target), `${level.name} roof ${x}/${z}`).toBeLessThan(allowance);
    }
    const vertices = triangles.flat();
    expect(vertices.reduce((s, p) => Math.min(s, p[1]), Infinity)).toBe(0);
    expect(vertices.reduce((s, p) => Math.max(s, p[1]), -Infinity)).toBeCloseTo(678.9, 2);
    const tip = vertices.filter((p) => Math.abs(p[1] - 678.9) < 0.002),
      center = [0, 2].map(
        (axis) => (Math.min(...tip.map((p) => p[axis])) + Math.max(...tip.map((p) => p[axis]))) / 2,
      );
    expect(Math.hypot(center[0] - mastCenter[0], center[1] - mastCenter[1])).toBeLessThan(2);
    expect(
      vertices.some(
        (p) =>
          Math.abs(p[1] - 509.2) < 0.001 &&
          Math.abs(p[0] - 28.38) < 0.002 &&
          Math.abs(p[2] - 13.54) < 0.002,
      ),
    ).toBe(true);
    const cap = triangles.filter((t) => t.every((p) => Math.abs(p[1] - 678.9) < 0.0001));
    expect(cap).toHaveLength(3);
    for (const t of cap) expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
    // Folded canopy tops and their offset undersides must both exist; normals face opposite ways.
    const tops = triangles.filter(
      (t) =>
        t.some((p) => Math.abs(p[1] - 12.7) < 0.001) &&
        t.some((p) => Math.abs(p[1] - 17.4) < 0.001) &&
        t.every((p) => [8.5, 12.7, 17.4].some((y) => Math.abs(p[1] - y) < 0.001)),
    );
    expect(tops).toHaveLength(12); // Four long diamond sides, three folded triangles each.
    for (const t of tops) expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
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
