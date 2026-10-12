import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/tp/tp5/n0191_flame_towers'),
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

it('reproduces original Flame Towers and preserves four independent mapped footprints and cardinal identities', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineWorld.find((p) => p.id === 'N0191').build(a.wrap(b), m);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original Flame Towers')))).toBe(
    'sha256:a68a35dcd6d4a70289117247913290dd8a508d158c4e08af4e694656cbc329d5',
  );
  const prior = await read(`${source}/georeferencing-baseline.json`),
    spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(0);
  expect(m.geometry).toEqual(prior.geometry);
  expect(m.parts.map((p) => [p.role, p.id])).toEqual([
    ['residential', 'way/253081850'],
    ['hotel', 'way/253081914'],
    ['office', 'way/253082095'],
    ['podium', 'way/687226634'],
  ]);
  for (const part of m.parts) {
    const baseline = prior.parts.find((p) => p.role === part.role),
      fresh = m.elements.find((p) => 'way/' + p.id === part.id);
    expect(part.local).toEqual(baseline.local);
    expect(fresh.geometry).toEqual(baseline.geometry);
    for (const [i, p] of fresh.geometry.slice(0, -1).entries()) {
      const q = [
        (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((40.3598 * Math.PI) / 180),
        -(p.lat - m.anchor[1]) * 111319.490793,
      ];
      expect(Math.hypot(...sub(q, baseline.local[i]))).toBeLessThan(0.003);
    }
  }
  expect(m.parts.find((p) => p.role === 'hotel').local.every((p) => p[1] < -75)).toBe(true);
  expect(m.parts.find((p) => p.role === 'residential').local.every((p) => p[1] > 20)).toBe(true);
  expect(m.parts.find((p) => p.role === 'office').local.every((p) => p[0] < -30)).toBe(true);
  expect(decode(await readFile(`${source}/models/source.glb`)).g.materials).toHaveLength(3);
}, 60000);
it('retains three curved shells, unequal pointed crowns, separate podium features and visible hotel canopy', async () => {
  const { triangles: master } = decode(await readFile(`${source}/models/source.glb`)),
    asset = await read(`${runtime}/asset.json`);
  const parts = [
    {
      name: 'residential',
      h: 182,
      tip: [36.1352, 182, 88.5644],
      filter: (t) => t.every((p) => p[2] > 20),
    },
    {
      name: 'hotel',
      h: 165,
      tip: [3.1978, 165, -145.4959],
      filter: (t) => t.every((p) => p[2] < -75),
    },
    {
      name: 'office',
      h: 161,
      tip: [-103.1299, 161, -29.9574],
      filter: (t) => t.every((p) => p[0] < -30 && p[2] > -65),
    },
  ];
  const slice = (ts, y) => {
    const points = [];
    for (const t of ts)
      for (let i = 0; i < 3; i++) {
        const a = t[i],
          b = t[(i + 1) % 3];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          const f = (y - a[1]) / (b[1] - a[1]);
          points.push(a.map((v, j) => v + (b[j] - v) * f));
        }
      }
    return [0, 2].map(
      (k) => (Math.min(...points.map((p) => p[k])) + Math.max(...points.map((p) => p[k]))) / 2,
    );
  };
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 4, district: 1.5, street: 0.5, closeup: 0.1 }[level.name];
    for (const part of parts) {
      const target = master.filter(part.filter),
        actual = triangles.filter(part.filter);
      expect(actual.some((t) => t.some((p) => Math.hypot(...sub(p, part.tip)) < 0.001))).toBe(true);
      for (const y of [40, 65, 85, 115, part.h * 0.82, part.h * 0.92]) {
        const c = slice(target, y);
        for (let i = 0; i < 12; i++) {
          const angle = ((i + 0.15) * Math.PI) / 6,
            o = [c[0] + 100 * Math.cos(angle), y, c[1] + 100 * Math.sin(angle)],
            d = [-Math.cos(angle), 0, -Math.sin(angle)],
            expected = nearest(target, o, d),
            hit = nearest(actual, o, d);
          expect(Number.isFinite(expected)).toBe(true);
          expect(Math.abs(hit - expected), `${level.name} ${part.name} ${y}/${i}`).toBeLessThan(
            allowance,
          );
        }
      }
    }
    // Top and underside canopy checks, barrel roof, red cinema and all three pavilion roofs.
    for (const [o, d] of [
      [
        [29, 8, -101],
        [0, -1, 0],
      ],
      [
        [29, 5, -101],
        [0, 1, 0],
      ],
    ])
      expect(Math.abs(nearest(triangles, o, d) - nearest(master, o, d))).toBeLessThan(0.03);
    const canopyTop = triangles.filter(
      (t) =>
        t.every((p) => Math.abs(p[1] - 6.12) < 0.001) && t.some((p) => p[0] > 28 && p[2] < -95),
    );
    expect(canopyTop.length).toBeGreaterThan(0);
    expect(canopyTop.every((t) => cross(sub(t[1], t[0]), sub(t[2], t[0]))[1] > 0)).toBe(true);
    expect(Math.abs(nearest(triangles, [-20, 24, -25], [0, -1, 0]) - 5.95)).toBeLessThan(0.03);
    expect(Math.abs(nearest(triangles, [-42, 31, -67], [0, -1, 0]) - 3.5)).toBeLessThan(0.03);
    for (const [x, z, top] of [
      [29, -51, 25.2],
      [38, -24, 21.8],
      [42, 2, 18.6],
    ])
      expect(
        Math.abs(nearest(triangles, [x, 30, z], [0, -1, 0]) - (30 - top)),
        `${level.name} pavilion`,
      ).toBeLessThan(0.12);
    expect(g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
  }
}, 60000);
it('rebuilds four levels within browser ceilings and avoids duplicated interleaved GPU uploads', async () => {
  const assetPath = `${runtime}/asset.json`,
    before = (await read(assetPath)).runtimeLods,
    after = await buildModelLandmarkLods(assetPath, { force: true });
  expect(after.recipeHash).toBe(before.recipeHash);
  expect(after.levels.map((l) => l.hash)).toEqual(before.levels.map((l) => l.hash));
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
    expect(hash(b)).toBe(l.hash);
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
