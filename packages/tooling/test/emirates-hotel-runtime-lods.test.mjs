import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildEmirates } from '../../worldgen/scripts/signature-tower-emirates-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve(
    '../../content/worldgen/source/places/th/thr/n0199_jumeirah_emirates_towers_hotel',
  ),
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
  const windowTriangles = [];
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
      return decoded;
    }),
  );
  return { g, values, triangles, windowTriangles };
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

const surfaces = {
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
};
it('reproduces the original hotel master and independently signs the primary-source hotel footprint', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildEmirates(a.wrap(b), null, true);
  const spec = await read(source + '/spec.json'),
    m = await read(source + '/map-frame.json'),
    baseline = await read(source + '/georeferencing-baseline.json');
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.sourceFacts.equilateralPlanSideMeters).toBe(55.5);
  expect(m.elements).toHaveLength(1);
  expect(m.elements[0].id).toBe(393391114);
  expect(m.elements[0].geometry).toEqual(baseline.elements[0].geometry);
  expect(m.elements[0].tags.wikidata).toBe('Q845182');
  expect(m.identityOverride.wikidata).toBe('Q1049027');
  expect(m.identityOverride.operatorCoordinates).toEqual([55.281903, 25.217773]);
  expect(m.geometry.outline).toEqual(baseline.geometry.outline);
  expect(m.anchor).toEqual(baseline.anchor);
  expect(m.heading).toBeCloseTo(-0.5679485566001423, 12);
  for (const p of m.elements[0].geometry) {
    const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      S = -(p.lat - m.anchor[1]) * 111319.490793,
      q = [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    expect(
      Math.min(...baseline.geometry.outline.map((v) => Math.hypot(...sub(v, q)))),
    ).toBeLessThan(0.001);
  }
  expect(Math.cos(m.heading)).toBeGreaterThan(0.8);
  expect(-Math.sin(m.heading)).toBeGreaterThan(0.5);
  expect(decode(await readFile(source + '/models/source.glb')).g.materials).toHaveLength(3);
}, 60000);
it('retains triangular/curved shaft, three open base bays, five crown slits, copper beacon, sloped roof and309m mast', async () => {
  const master = decode(await readFile(source + '/models/source.glb')).triangles,
    asset = await read(runtime + '/asset.json'),
    S = 55.5,
    H = (S * Math.sqrt(3)) / 2,
    rear = -H / 3,
    tip = (2 * H) / 3,
    cut = tip - 10,
    w = (10 * S) / (2 * H);
  for (const level of asset.runtimeLods.levels) {
    const decoded = decode(await readFile(runtime + '/' + level.file)),
      { g, triangles: ts } = decoded,
      windowTriangles = level.name === 'skyline' ? ts : decoded.windowTriangles,
      allowance = { skyline: 2, district: 1.2, street: 0.6, closeup: 0.1 }[level.name];
    for (const y of [12.2, 25.8, 44.2, 72.3, 119.6, 161.2, 189.4, 209.1])
      for (let k = 0; k < 24; k++) {
        const t = ((k + 0.17) * Math.PI * 2) / 24,
          o = [80 * Math.cos(t), y, 80 * Math.sin(t)],
          d = [-Math.cos(t), 0, -Math.sin(t)],
          target = nearest(master, o, d);
        expect(Number.isFinite(target)).toBe(true);
        expect(
          Math.abs(nearest(ts, o, d) - target),
          `${level.name} envelope${y}/${k}`,
        ).toBeLessThan(allowance);
      }
    for (const t of [Math.PI / 3, Math.PI, (5 * Math.PI) / 3]) {
      const o = [80 * Math.cos(t), 20, 80 * Math.sin(t)],
        d = [-Math.cos(t), 0, -Math.sin(t)],
        distance = nearest(ts, o, d);
      expect(distance, `${level.name} open base${t}`).toBeGreaterThan(60);
      expect(distance).toBeLessThan(65);
    }
    for (const [a, b] of [
      [
        [cut, -w],
        [rear, -S / 2],
      ],
      [
        [rear, S / 2],
        [cut, w],
      ],
    ]) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len];
      for (let k = 0; k < 5; k++) {
        const u = 0.29 + ((k + 0.235) * (0.76 - 0.29)) / 5,
          p = [a[0] + (b[0] - a[0]) * u, 195.4, a[1] + (b[1] - a[1]) * u],
          o = p.map((v, i) => v + 20 * n[i]);
        expect(
          nearest(
            windowTriangles,
            o,
            n.map((v) => -v),
          ),
          `${level.name} slit${k}`,
        ).toBeCloseTo(20.18, 2);
      }
    }
    expect(
      nearest(windowTriangles, [60, 198, 0], [-1, 0, 0]),
      `${level.name} copper beacon`,
    ).toBeCloseTo(60 - (tip - 5.6 + 4.7), 2);
    const roofY = 215 + ((5 - rear) / H) * 48.3;
    expect(
      nearest(windowTriangles, [5, 288, 10], [0, -1, 0]),
      `${level.name} glazed roof`,
    ).toBeCloseTo(288 - roofY, 2);
    expect(ts.flat().reduce((hi, p) => Math.max(hi, p[1]), 0)).toBeCloseTo(309, 3);
    expect(nearest(ts, [tip - 0.3, 334, 0], [0, -1, 0]), `${level.name} mast`).toBeCloseTo(25, 3);
    expect(g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
  }
}, 60000);
it('rebuilds four pinned browser levels within transfer/triangle/draw caps with separate GPU streams', async () => {
  const after = await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(after.levels[0].bytes + after.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = after.levels.find((l) => l.name === name),
      b = await readFile(runtime + '/' + l.file),
      { g } = decode(b);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(3);
    expect(g.images ?? []).toHaveLength(0);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const pa = g.accessors[p.attributes.POSITION],
        na = g.accessors[p.attributes.NORMAL];
      expect(pa.bufferView).not.toBe(na.bufferView);
      expect(g.bufferViews[pa.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[na.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 20000);
