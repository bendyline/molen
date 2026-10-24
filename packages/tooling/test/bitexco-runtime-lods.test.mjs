import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { bitexcoStudy } from '../../worldgen/scripts/signature-tower-bitexco-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/w3/w3g/bitexco_financial_tower'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2');
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
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
it('reproduces the preserved Bitexco master and signs independent podium/crown/landing square', async () => {
  const prior = await read(`${source}/georeferencing-baseline.json`),
    m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, { legacyAlphaFields: true });
  bitexcoStudy.build(a.wrap(b), prior);
  const mesh = b.finalize();
  expect(mesh.triangleCount).toBe(315402);
  const spec = await read(`${source}/spec.json`);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(prior.heading);
  expect(m.elements).toHaveLength(6);
  for (const e of prior.elements)
    expect(m.elements.find((p) => p.id === e.id).geometry).toEqual(e.geometry);
  expect(m.elements.find((e) => e.id === 804073951).tags.wikidata).toBe('Q638512');
  expect(m.elements.find((e) => e.id === 1231606415).tags.aeroway).toBe('helipad');
  expect(m.elements.find((e) => e.id === 1222241873).tags['building:levels']).toBe('6');
  expect(spec.sourceFacts.helipadHeightMeters).toBe(191.4);
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
  for (const p of m.elements.find((e) => e.id === 804073951).geometry.map(project))
    expect(
      Math.min(...prior.geometry.outline.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
    ).toBeLessThan(0.002);
  const pad = m.elements
      .find((e) => e.id === 1231606415)
      .geometry.slice(0, -1)
      .map(project),
    pod = m.elements.find((e) => e.id === 1222241873).geometry.map(project);
  expect(pad.reduce((s, p) => s + p[1], 0) / 4).toBeCloseTo(11.484413975979317, 4);
  expect(Math.max(...pod.map((p) => p[0]))).toBeGreaterThan(35);
  expect(m.heading).toBeCloseTo(0.737047755372, 12);
}, 120000);
it('retains curved shaft, outward crown closure, helipad top/soffit, mapped podium and floating canopy', async () => {
  const asset = await read(`${runtime}/asset.json`),
    master = decode(await readFile(`${source}/models/source.glb`));
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [40, 90, 145, 180])
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8,
          o = [-17.2 + 50 * Math.cos(a), y, -6 + 50 * Math.sin(a)],
          v = [-Math.cos(a), 0, -Math.sin(a)],
          ref = nearestWithNormal(master.triangles, o, v),
          hit = nearestWithNormal(d.triangles, o, v);
        expect(
          Number.isFinite(ref.distance) && Number.isFinite(hit.distance),
          `${l.name}shaft${y}/${k}`,
        ).toBe(true);
        expect(
          Math.abs(ref.distance - hit.distance) * Math.abs(dot(v, ref.normal)),
          `${l.name} displacement ${y}/${k}`,
        ).toBeLessThanOrEqual(l.errorMeters + 0.02);
        expect(dot(v, hit.normal), `${l.name} shaft outward winding`).toBeLessThan(0);
      }
    for (const y of [204, 220, 240, 256]) {
      const hit = nearestWithNormal(d.triangles, [-17.2, y, 40], [0, 0, -1]);
      expect(hit.distance, `${l.name} closed inclined curtain ${y}`).toBeLessThan(75);
      expect(dot([0, 0, -1], hit.normal), `${l.name} crown outward winding`).toBeLessThan(-0.1);
    }
    const top = nearestWithNormal(d.triangles, [-18.8, 205, 28], [0, -1, 0]),
      under = nearestWithNormal(d.triangles, [-18.8, 180, 28], [0, 1, 0]);
    expect(top.distance, `${l.name} pad top`).toBeCloseTo(13.6, 2);
    expect(dot([0, -1, 0], top.normal)).toBeLessThan(-0.99);
    // Exposed radial ribs are at most 0.063 m below the closed soffit at this probe.
    expect(Math.abs(under.distance - 9.4), `${l.name} closed soffit/ribs`).toBeLessThan(0.08);
    expect(dot([0, 1, 0], under.normal)).toBeLessThan(-0.99);
    expect(nearest(d.triangles, [20, 40, 0], [0, -1, 0]), `${l.name} canopy top`).toBeLessThan(15);
    expect(nearest(d.triangles, [20, 24, 0], [0, 1, 0]), `${l.name} canopy underside`).toBeLessThan(
      6,
    );
    expect(nearest(d.triangles, [20, 24, 0], [0, -1, 0]), `${l.name} podium roof`).toBeCloseTo(
      1.5,
      2,
    );
    const ys = d.g.meshes
      .flatMap((m) => m.primitives)
      .map((p) => d.g.accessors[p.attributes.POSITION].max[1]);
    expect(Math.max(...ys)).toBeCloseTo(264, 4);
  }
}, 120000);
it('rebuilds four levels within download/triangle/draw budgets, with separate vertex streams', async () => {
  const p = resolve(runtime, 'asset.json');
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(`${runtime}/${l.file}`);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    const { g } = decode(bytes);
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(0);
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
