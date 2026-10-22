import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/ws/ws1/n0187_ping_an_finance_centre'),
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
  const doorTriangles = [],
    windowTriangles = [];
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
            [0.14, 0.23, 0.27].every((v, k) => Math.abs(colors[j][k] / divisor - v) < 0.005),
          )
        )
          doorTriangles.push(js.map((j) => ps[j]));
      }
      const decoded = Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
      if (g.materials[p.material].name.startsWith('window')) windowTriangles.push(...decoded);
      return decoded;
    }),
  );
  return { g, values, triangles, doorTriangles, windowTriangles };
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

it('reproduces the preserved Ping An master and verifies independent signed map parts and road', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineWorld.find((p) => p.id === 'N0187').build(a.wrap(b), m);
  const baseline = await read(`${source}/georeferencing-baseline.json`),
    prior = await read(`${source}/map-parts.json`),
    spec = await read(`${source}/spec.json`);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.geometry.outline).toEqual(baseline.geometry.outline);
  expect(m.heading).toBeCloseTo(0.0005397205, 12);
  expect(m.elements).toHaveLength(56);
  for (const p of prior.elements)
    expect(m.elements.find((q) => q.id === p.id).geometry).toEqual(p.geometry);
  const local = (p) => {
    const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      S = -(p.lat - m.anchor[1]) * 111319.490793;
    return [
      E * Math.cos(m.heading) - S * Math.sin(m.heading),
      E * Math.sin(m.heading) + S * Math.cos(m.heading),
    ];
  };
  const whole = m.elements.find((p) => p.id === 535860513);
  expect(whole.tags.wikidata).toBe('Q1077308');
  for (const p of whole.geometry)
    expect(
      Math.min(...baseline.geometry.outline.map((v) => Math.hypot(...sub(v, local(p))))),
    ).toBeLessThan(0.002);
  const road = m.elements.find((p) => p.id === 996752254);
  expect(road.tags['name:en']).toBe('Yitian Road');
  expect(road.geometry.every((p) => local(p)[0] > 45)).toBe(true);
  expect(spec.sourceFacts.architecturalHeightMeters).toBe(599.1);
  expect(decode(await readFile(`${source}/models/source.glb`)).g.materials).toHaveLength(3);
}, 60000);
it('retains notched taper, closed occupied roof, genuinely open crown, pyramid and outward folded canopy', async () => {
  const detailed = decode(await readFile(`${source}/models/source.glb`)),
    master = detailed.triangles,
    asset = await read(`${runtime}/asset.json`);
  const canopy = master.filter((t) =>
    t.every((p) => p[0] > 36.8 && p[0] < 44.7 && p[1] > 6.54 && p[1] < 6.81),
  );
  expect(canopy).toHaveLength(2);
  for (const t of canopy) expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    for (const y of [5.4, 77.3, 147.4, 222.6, 295.6, 365.3, 439.6, 511.4, 553.3])
      for (let i = 0; i < 32; i++) {
        const a = ((i + 0.271) * Math.PI * 2) / 32,
          o = [60 * Math.cos(a), y, 60 * Math.sin(a)],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        expect(Number.isFinite(target)).toBe(true);
        expect(Math.abs(hit - target), `${level.name} ${y}/${i}`).toBeLessThan(allowance);
      }
    for (const y of [574, 579, 584, 588])
      for (const [o, d] of [
        [
          [0, y, 60],
          [0, 0, -1],
        ],
        [
          [60, y, 0],
          [-1, 0, 0],
        ],
      ])
        expect(nearest(triangles, o, d), `${level.name} open crown ${y}`).toBe(Infinity);
    for (const [x, z] of [
      [0, 0],
      [3, 2],
      [-2, -3],
    ])
      expect(
        Math.abs(nearest(triangles, [x, 588, z], [0, -1, 0]) - 19.8),
        `${level.name} closed roof`,
      ).toBeLessThan(0.03);
    for (const [x, z] of [
      [1, 1],
      [-2, 1],
      [1, -2],
    ])
      expect(
        Math.abs(
          nearest(triangles, [x, 612, z], [0, -1, 0]) - nearest(master, [x, 612, z], [0, -1, 0]),
        ),
        `${level.name} pyramid`,
      ).toBeLessThan(allowance);
    for (const [x, _z] of [
      [8.4, 0],
      [-8.4, 0],
    ])
      expect(
        Number.isFinite(nearest(triangles, [x, 579, 60], [0, 0, -1])),
        `${level.name} crown leg`,
      ).toBe(true);
    const tops = triangles.filter((t) =>
      t.every((p) => p[0] > 36.8 && p[0] < 44.7 && p[1] > 6.54 && p[1] < 6.81),
    );
    expect(tops).toEqual(canopy);
    const hi = triangles.flat().reduce((n, p) => Math.max(n, p[1]), -Infinity);
    expect(Math.abs(hi - 599.1)).toBeLessThan(0.1);
    expect(g.materials.every((p) => p.alphaMode !== 'BLEND')).toBe(true);
  }
}, 60000);
it('rebuilds four levels within browser ceilings and avoids duplicated interleaved GPU uploads', async () => {
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
