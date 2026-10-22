import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve(
    '../../content/worldgen/source/places/ws/ws0/n0186_guangzhou_international_finance_center',
  ),
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

it('reproduces the unchanged Guangzhou master and verifies the fresh signed triangular outline', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
    });
  skylineWorld.find((p) => p.id === 'N0186').build(a.wrap(b), m);
  const baseline = await read(`${source}/georeferencing-baseline.json`),
    spec = await read(`${source}/spec.json`);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(m.elements).toHaveLength(1);
  expect(m.elements[0].tags.wikidata).toBe('Q1043438');
  expect(m.geometry.outline).toEqual(baseline.geometry.outline);
  expect(m.heading).toBeCloseTo(0.383087548587, 12);
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
  const [x, z] = m.orientationControl.helipadCenter;
  expect(x * Math.cos(m.heading) + z * Math.sin(m.heading)).toBeLessThan(-18);
  expect(Math.abs(-x * Math.sin(m.heading) + z * Math.cos(m.heading))).toBeLessThan(0.2);
  expect(spec.sourceFacts.architecturalHeightMeters).toBe(438.6);
  expect(spec.sourceFacts.helipadHeightMeters).toBe(437.5);
  expect(decode(await readFile(`${source}/models/source.glb`)).g.materials).toHaveLength(2);
}, 60000);
it('retains continuously curved shaft, west helipad, triangular roof and outward north canopy across all levels', async () => {
  const detailed = decode(await readFile(`${source}/models/source.glb`)),
    master = detailed.triangles,
    asset = await read(`${runtime}/asset.json`);
  const canopy = master.filter((t) => t.every((p) => Math.abs(p[1] - 6.2) < 0.0001));
  expect(canopy).toHaveLength(2);
  for (const t of canopy) expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
  expect(detailed.doorTriangles).toHaveLength(16);
  for (const t of detailed.doorTriangles) {
    const c = [0, 1, 2].map((i) => t.reduce((s, p) => s + p[i], 0) / 3),
      n = cross(sub(t[1], t[0]), sub(t[2], t[0])),
      r = [c[0] + 1.3, 0, c[2] + 7.6],
      len = Math.hypot(...r),
      d = r.map((v) => -v / len),
      o = c.map((v, i) => v - d[i] * 3);
    expect(dot(n, r), 'door points outward').toBeGreaterThan(0);
    expect(nearest(detailed.windowTriangles, o, d), 'door is ahead of facade').toBeCloseTo(3, 3);
  }
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    for (const y of [4.6, 75.4, 145.3, 219.4, 305.7, 367.4, 421.4])
      for (let i = 0; i < 24; i++) {
        const a = ((i + 0.37) / 24) * Math.PI * 2,
          o = [-1.3 + 60 * Math.cos(a), y, -7.6 + 60 * Math.sin(a)],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        expect(Number.isFinite(target), `source ${y}/${i}`).toBe(true);
        expect(Math.abs(hit - target), `${level.name} shaft ${y}/${i}`).toBeLessThan(allowance);
      }
    for (const [x, z] of [
      [-17, -7],
      [-17, -1],
      [-17, -13],
      [-23, -7],
      [-11, -7],
    ]) {
      const hit = nearest(triangles, [x, 450, z], [0, -1, 0]);
      expect(Number.isFinite(hit)).toBe(true);
      expect(
        Math.abs(hit - nearest(master, [x, 450, z], [0, -1, 0])),
        `${level.name} raised landing plane`,
      ).toBeLessThan(allowance);
      expect(Math.abs(hit - 12.5)).toBeLessThan(0.11);
    }
    for (const [x, z] of [
      [0, 0],
      [5, 5],
      [6, -18],
    ])
      expect(
        Math.abs(
          nearest(triangles, [x, 450, z], [0, -1, 0]) - nearest(master, [x, 450, z], [0, -1, 0]),
        ),
        `${level.name} closed roof`,
      ).toBeLessThan(allowance);
    const c = triangles.filter((t) => t.every((p) => Math.abs(p[1] - 6.2) < 0.0001));
    expect(c).toEqual(canopy);
    const vertices = triangles.flat(),
      lo = vertices.reduce((n, p) => Math.min(n, p[1]), Infinity),
      hi = vertices.reduce((n, p) => Math.max(n, p[1]), -Infinity);
    expect(lo).toBe(0);
    expect(hi).toBeLessThanOrEqual(438.6);
    expect(438.6 - hi).toBeLessThan(0.1);
    expect(g.materials.filter((p) => p.alphaMode === 'BLEND')).toHaveLength(0);
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
