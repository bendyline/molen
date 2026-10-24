import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildMarina101 } from '../../worldgen/scripts/signature-tower-marina101-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/th/thr/marina_101'),
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
};
it('reproduces the original Marina101 master and independently signs the sea lift and podium', async () => {
  const prior = await read(source + '/georeferencing-baseline.json'),
    m = await read(source + '/map-frame.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildMarina101(a.wrap(b), prior);
  const mesh = b.finalize();
  expect(mesh.triangleCount).toBe(233064);
  const spec = await read(source + '/spec.json');
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBeCloseTo(0.864924013745, 12);
  expect(m.geometry.outline).toEqual(prior.geometry.outline);
  expect(m.elements).toHaveLength(2);
  for (const p of m.elements)
    expect(p.geometry).toEqual(prior.elements.find((e) => e.id === p.id).geometry);
  expect(m.elements.find((e) => e.id === 195527261).tags.wikidata).toBe('Q1165269');
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.001);
  expect(Math.cos(m.heading)).toBeGreaterThan(0.64);
  expect(-Math.sin(m.heading)).toBeLessThan(-0.75);
  expect(spec.sourceFacts.heightMeters).toBe(425);
  expect(spec.sourceFacts.highestOccupiedMeters).toBe(370.9);
  expect(decode(await readFile(source + '/models/source.glb')).g.materials).toHaveLength(4);
}, 60000);
it('keeps closed shaft faces, seaward paired lift, flared bands, podium and four separated blue crown tips', async () => {
  const master = decode(await readFile(source + '/models/source.glb')).triangles,
    asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file)),
      ts = d.triangles,
      allowance = { skyline: 2, district: 1.2, street: 0.6, closeup: 0.1 }[l.name];
    for (const y of [18.2, 48.3, 122.7, 201.3, 299.1, 339.7, 376.2])
      for (let k = 0; k < 24; k++) {
        const t = ((k + 0.17) * Math.PI * 2) / 24,
          o = [80 * Math.cos(t), y, 80 * Math.sin(t)],
          v = [-Math.cos(t), 0, -Math.sin(t)],
          target = nearest(master, o, v);
        expect(Number.isFinite(target), l.name + ' source ' + y + '/' + k).toBe(true);
        expect(Math.abs(nearest(ts, o, v) - target), l.name + ' shaft ' + y + '/' + k).toBeLessThan(
          allowance,
        );
      }
    const windows = l.name === 'skyline' ? ts : d.windowTriangles;
    for (const x of [1.2, 4.2])
      expect(
        nearest(windows, [x, 187.4, -70], [0, 0, 1]),
        l.name + ' projecting paired lift',
      ).toBeCloseTo(70 - 22.117, 2);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        expect(
          nearest(ts, [sx * 2.7, 440, sz * 2.7], [0, -1, 0]),
          l.name + ' separated425m tip',
        ).toBeLessThan(15.03);
        expect(
          nearest(ts, [sx * 8.3, 420, sz * 8.3], [0, -1, 0]),
          l.name + '413m shoulder',
        ).toBeLessThan(7.03);
        expect(
          nearest(ts, [sx * 13.7, 410, sz * 13.7], [0, -1, 0]),
          l.name + '400m shoulder',
        ).toBeLessThan(10.03);
      }
    expect(nearest(ts, [0, 430, 0], [0, -1, 0]), l.name + ' open crown center').toBeCloseTo(50, 2);
    expect(ts.flat().reduce((hi, p) => Math.max(hi, p[1]), 0)).toBeGreaterThanOrEqual(425);
    expect(ts.flat().reduce((hi, p) => Math.max(hi, p[1]), 0)).toBeLessThan(425.03);
    for (const p of [
      [-27, 7, -8],
      [0, 7, 30],
    ]) {
      const o = [p[0], 350, p[2]],
        v = [0, -1, 0],
        target = nearest(master, o, v);
      expect(Number.isFinite(target), l.name + ' podium source').toBe(true);
      expect(Math.abs(nearest(ts, o, v) - target), l.name + ' podium').toBeLessThan(allowance);
    }
    for (const y of [61, 232, 316])
      expect(nearest(ts, [20.64 + 20, y - 0.2, 0], [-1, 0, 0]), l.name + 'flareband').toBeLessThan(
        19.5,
      );
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
