import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { build3Wtc } from '../../worldgen/scripts/signature-tower-3wtc-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/3_world_trade_center'),
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
  clear_glass: {
    slot: 'window',
    localRef: 'palette:#feffff',
    roughness: 0.12,
    metallic: 0.05,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.52],
    doubleSided: true,
  },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
it('reproduces the unchanged detailed master and preserves independently mapped signed ground and four parts', async () => {
  const m = await read(source + '/map-frame.json'),
    prior = await read(source + '/georeferencing-baseline.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  build3Wtc(a.wrap(b), prior);
  const mesh = b.finalize();
  expect(mesh.triangleCount).toBe(295672);
  const spec = await read(source + '/spec.json');
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBeCloseTo(-0.472632939657, 12);
  expect(m.geometry.outline).toEqual(prior.geometry.outline);
  expect(m.elements.map((x) => x.id)).toEqual([
    166839381, 960146508, 960146509, 960146510, 960146511,
  ]);
  for (const p of m.elements)
    expect(p.geometry).toEqual(prior.elements.find((x) => x.id === p.id).geometry);
  expect(m.elements[0].tags.wikidata).toBe('Q941908');
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.001);
  expect(Math.cos(m.heading)).toBeGreaterThan(0.88);
  expect(-Math.sin(m.heading)).toBeGreaterThan(0.45);
  expect(spec.sourceFacts.architecturalHeightMeters).toBe(328.8792);
  expect(spec.sourceFacts.terracesFeet).toEqual({ level17: 205, level60: 718, level76: 935 });
  expect(decode(await readFile(source + '/models/source.glb')).g.materials).toHaveLength(4);
}, 60000);
it('retains the complete skew podium, cruciform setbacks, three roof decks, continuous walls and original K-brace cadence', async () => {
  const master = decode(await readFile(source + '/models/source.glb')).triangles,
    asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file)),
      ts = d.triangles,
      wt = l.name === 'skyline' ? ts : d.windowTriangles,
      allowance = { skyline: 2, district: 1.2, street: 0.6, closeup: 0.1 }[l.name];
    for (const y of [4.1, 13.2, 42.7, 100.1, 170.3, 229.3, 271.2, 300.4, 319.3])
      for (let k = 0; k < 24; k++) {
        const t = ((k + 0.17) * Math.PI * 2) / 24,
          o = [20 + 100 * Math.cos(t), y, 100 * Math.sin(t)],
          v = [-Math.cos(t), 0, -Math.sin(t)],
          target = nearest(master, o, v);
        expect(Number.isFinite(target)).toBe(true);
        expect(
          Math.abs(nearest(ts, o, v) - target),
          l.name + ' envelope ' + y + '/' + k,
        ).toBeLessThan(allowance);
      }
    for (const y of [100.1, 240.1, 300.1])
      expect(nearest(wt, [-60, y, 0], [1, 0, 0]), l.name + ' central west').toBeCloseTo(51.14, 2);
    for (const y of [100.1, 240.1])
      expect(nearest(wt, [20, y, -60], [0, 0, 1]), l.name + ' northern shoulder').toBeCloseTo(
        29.608,
        2,
      );
    expect(nearest(wt, [20, 300.1, -60], [0, 0, 1]), l.name + ' north setback').toBeCloseTo(
      43.84,
      2,
    );
    expect(nearest(wt, [20, 240.1, 60], [0, 0, -1]), l.name + ' south setback').toBeCloseTo(
      43.84,
      2,
    );
    expect(nearest(wt, [-60, 100.1, -20], [1, 0, 0]), l.name + ' reentrant west').toBeCloseTo(
      56.96,
      2,
    );
    for (const [p, top] of [
      [[-20, 350, -18], 62.484],
      [[25, 350, 20.3], 218.8464],
      [[25, 350, -20.3], 284.988],
      [[20, 350, 0], 328.1792],
    ])
      expect(nearest(ts, p, [0, -1, 0]), l.name + ' roof ' + top).toBeCloseTo(350 - top, 2);
    const low = 62.934,
      high = 283.788,
      count = 9;
    for (let i = 0; i < count; i++) {
      const y = low + ((high - low) * (i + 0.25)) / count,
        t = nearest(ts, [-20, y, -21.275], [1, 0, 0]);
      expect(t, l.name + ' north brace ' + i).toBeGreaterThan(16);
      expect(t).toBeLessThan(17);
    }
    expect(ts.flat().reduce((hi, p) => Math.max(hi, p[1]), 0)).toBeCloseTo(328.8792, 3);
    if (l.name !== 'skyline') expect(d.g.materials.some((m) => m.alphaMode === 'BLEND')).toBe(true);
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
}, 20000);
