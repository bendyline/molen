import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { centerStudy } from '../../worldgen/scripts/signature-tower-center-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/we/wec/the_center'),
  runtime = await runtimeLodFixture(source.replace(/([\\/])source([\\/])/, '$1assets$2'));
const read = async (p) => JSON.parse(await readFile(p));
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
  const windowTriangles = [],
    mainTriangles = [];
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      const decoded = Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
      if (
        g.materials[p.material].pbrMetallicRoughness.roughnessFactor === 0.2 &&
        g.materials[p.material].pbrMetallicRoughness.metallicFactor === 0.28
      )
        windowTriangles.push(...decoded);
      const rough = g.materials[p.material].pbrMetallicRoughness.roughnessFactor;
      if (rough === 0.48 || rough === 0.2) mainTriangles.push(...decoded);
      return decoded;
    }),
  );
  return { g, values, triangles, windowTriangles, mainTriangles };
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

function nearestWithNormal(ts, o, d) {
  let best = { distance: Infinity, normal: [0, 0, 0] };
  for (const p of ts) {
    const t = nearest([p], o, d);
    if (t >= best.distance) continue;
    const n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
      len = Math.hypot(...n);
    best = { distance: t, normal: n.map((v) => v / len) };
  }
  return best;
}

const surfaces = {
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  clear_glass: {
    slot: 'window',
    localRef: 'palette:#feffff',
    roughness: 0.12,
    metallic: 0.05,
    baseColorFactor: [1, 1, 1, 0.52],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
};
it('reproduces unchanged Center master and independently signs star, gallery and southwest entrance', async () => {
  const prior = await read(source + '/georeferencing-baseline.json'),
    m = await read(source + '/map-frame.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, { legacyAlphaFields: true });
  centerStudy.build(a.wrap(b), prior);
  const mesh = b.finalize();
  expect(mesh.triangleCount).toBe(488748);
  const spec = await read(source + '/spec.json');
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(prior.heading);
  expect(m.elements).toHaveLength(25);
  for (const e of prior.elements) {
    const p = m.elements.find((p) => p.id === e.id && p.type === e.type);
    e.type === 'way'
      ? expect(p.geometry).toEqual(e.geometry)
      : expect([p.lon, p.lat]).toEqual([e.lon, e.lat]);
  }
  const raw = m.elements.find((e) => e.id === 148228888);
  expect(raw.tags.wikidata).toBe('Q130478');
  expect(raw.tags.height).toBe('346');
  expect(raw.tags['building:levels']).toBe('73');
  expect(spec.sourceFacts.contractorMarketingStoreys).toBe(80);
  expect(spec.sourceFacts.occupiedHeightMeters).toBe(275);
  const project = (p) => {
    const r = 6378137,
      f = Math.cos((m.anchor[1] * Math.PI) / 180),
      e = (((p.lon - m.anchor[0]) * Math.PI) / 180) * r * f,
      s =
        (-r * Math.asinh(Math.tan((p.lat * Math.PI) / 180)) +
          r * Math.asinh(Math.tan((m.anchor[1] * Math.PI) / 180))) *
        f;
    return [
      e * Math.cos(m.heading) - s * Math.sin(m.heading),
      e * Math.sin(m.heading) + s * Math.cos(m.heading),
    ];
  };
  for (const p of raw.geometry.map(project))
    expect(
      Math.min(...prior.geometry.towerOutline.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
    ).toBeLessThan(0.001);
  const door = m.elements.find((e) => e.id === 10219320513),
    point = project(door);
  expect(point[0]).toBeCloseTo(-12.83839, 4);
  expect(point[1]).toBeCloseTo(29.96369, 4);
  expect(door.lon).toBeLessThan(m.anchor[0]);
  expect(door.lat).toBeLessThan(m.anchor[1]);
  expect(m.elements.find((e) => e.id === 1323732353).tags['roof:direction']).toBe('213.31');
  expect(m.heading).toBeCloseTo(-0.5813691738393112, 12);
  expect(m.geometry.parts.find((e) => e.id === 148461575).outline).toEqual(prior.geometry.outline);
  expect(decode(await readFile(source + '/models/source.glb')).g.images ?? []).toHaveLength(0);
}, 120000);
it('retains suspended half-pyramids, star envelope, open column base and gallery court at every level', async () => {
  const asset = await read(runtime + '/asset.json'),
    master = decode(await readFile(source + '/models/source.glb'));
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file));
    for (const y of [31, 39, 80, 145, 200, 250, 267, 284, 294, 316.4, 330])
      for (let k = 0; k < 24; k++) {
        const a = (k * Math.PI) / 12,
          o = [100 * Math.cos(a), y, 100 * Math.sin(a)],
          v = [-Math.cos(a), 0, -Math.sin(a)],
          ref = nearestWithNormal(master.triangles, o, v),
          hit = nearestWithNormal(d.triangles, o, v);
        expect(Number.isFinite(ref.distance), l.name + 'reference' + y + '/' + k).toBe(true);
        expect(Number.isFinite(hit.distance), l.name + 'hit' + y + '/' + k).toBe(true);
        expect(
          Math.abs(hit.distance - ref.distance) * Math.abs(dot(v, ref.normal)),
          l.name + 'radial' + y + '/' + k,
        ).toBeLessThanOrEqual(l.errorMeters + 0.015);
      }
    for (let k = 0; k < 4; k++)
      for (const y of [40, 267]) {
        const a = (k * Math.PI) / 2,
          distance = k % 2 === 0 ? 21.43 : 21.1,
          o = [42 * Math.sin(a), y, 42 * Math.cos(a)],
          v = [-Math.sin(a), 0, -Math.cos(a)],
          expected =
            42 -
            (distance + 8.92 * (y === 40 ? (y - 35.4) / (45.3 - 35.4) : (270 - y) / (270 - 260.8)));
        expect(
          Math.abs(nearest(d.triangles, o, v) - expected),
          l.name + 'half-pyramid' + k + '/' + y,
        ).toBeLessThan(0.12);
      }
    // No opaque wall fills the public undercroft between the four principal columns.
    expect(nearest(d.triangles, [21, 12, 0], [-1, 0, 0]), l.name + 'undercroft').toBeCloseTo(
      12.2,
      2,
    );
    expect(nearest(d.triangles, [0, 20, -25], [0, -1, 0]), l.name + 'gallery-court').toBeCloseTo(
      19.8,
      2,
    );
    for (const [x, z] of [
      [-48, -15],
      [-44, 8],
      [33, -20],
      [42, -7],
    ])
      expect(
        nearest(d.triangles, [x, 20, z], [0, -1, 0]),
        l.name + 'gallery-roof' + x + '/' + z,
      ).toBeCloseTo(8.7, 2);
    const stoneTriangles = d.g.meshes.flatMap((m) =>
      m.primitives
        .filter((p) => d.g.materials[p.material].extras?.molenSurface?.slot === 'foundation')
        .flatMap((p) => {
          const ps = d.values(p.attributes.POSITION),
            ids = d.values(p.indices).flat();
          return Array.from({ length: ids.length / 3 }, (_, i) =>
            ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
          );
        }),
    );
    // Skyline is palette-baked, so its explicit slab void is inspected in images and all-triangle rays.
    if (l.name !== 'skyline')
      expect(
        nearest(stoneTriangles, [-14, 25, 22], [0, -1, 0]),
        l.name + 'atrium-slab-void',
      ).toBeGreaterThan(24.7);
    expect(nearest(d.triangles, [0, 350, 0], [0, -1, 0]), l.name + 'mast-tip').toBeCloseTo(4, 2);
  }
}, 120000);
it('rebuilds four levels within download/triangle/draw budgets, with separate vertex streams and clear atrium', async () => {
  const p = resolve(runtime, 'asset.json');
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(runtime + '/' + l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    const { g } = decode(bytes);
    expect(g.images ?? []).toHaveLength(0);
    if (l.name !== 'skyline') {
      const transparent = g.materials.filter((m) => m.alphaMode === 'BLEND');
      expect(transparent).toHaveLength(1);
      expect(transparent[0].doubleSided).toBe(true);
      expect(transparent[0].pbrMetallicRoughness.baseColorFactor[3]).toBe(0.52);
    }
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const a = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(a.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
