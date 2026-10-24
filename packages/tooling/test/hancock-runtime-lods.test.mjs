import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineGlobal } from '../../worldgen/scripts/signature-tower-global-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve(
    '../../content/worldgen/source/places/dp/dp3/875_north_michigan_avenue',
  ),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
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

it('reproduces 875 North Michigan Avenue detailed master and nine independent signed map ways', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
    });
  skylineGlobal.find((p) => p.id === '875_north_michigan_avenue').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`);
  expect(m.elements).toHaveLength(9);
  expect(m.elements.find((p) => p.id === 31064573).tags.wikidata).toBe('Q217727');
  expect(m.orientationControl.westMastWay).toBe(279951771);
  expect(m.orientationControl.eastMastWay).toBe(279951772);
  expect(m.heading).toBeCloseTo(0.017505085315, 12);
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
});
it('keeps the full taper, penthouse and both broadcast arrays through every level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles;
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`));
    for (const y of [8, 23, 90, 185, 250, 312, 339])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          o = [Math.cos(a) * 100, y, Math.sin(a) * 100],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(target)) expect(hit, level.name).toBe(Infinity);
        else {
          expect(Math.abs(hit - target), `${level.name} wall ${y}/${i}`).toBeLessThan(
            { skyline: 1.5, district: 1.5, street: 0.4, closeup: 0.1 }[level.name],
          );
        }
      }
    // Probe the roof, avoiding nearly vertical rays grazing the tapered shaft.
    for (let x = -18; x <= 18; x += 6)
      for (let z = -10; z <= 10; z += 5) {
        const o = [x, 500, z],
          d = [0, -1, 0],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(target)) expect(hit, level.name).toBe(Infinity);
        else
          expect(Math.abs(hit - target), `${level.name} roof ${x},${z}`).toBeLessThan(
            { skyline: 1.5, district: 1.5, street: 0.4, closeup: 0.1 }[level.name],
          );
      }
    expect(g.materials.length).toBeLessThanOrEqual(4);
    // Independent geographic corridors catch displaced/floating antennas even when the
    // facade and total tip height remain correct.
    const map = await read(`${source}/map-frame.json`),
      centers = [279951771, 279951772].map((id) => {
        const plan = map.elements.find((p) => p.id === id).geometry.slice(0, -1);
        return plan.reduce(
          (sum, p) => {
            const east =
                (p.lon - map.anchor[0]) * 111319.490793 * Math.cos((map.anchor[1] * Math.PI) / 180),
              south = -(p.lat - map.anchor[1]) * 111319.490793;
            return [
              sum[0] + (east * Math.cos(map.heading) - south * Math.sin(map.heading)) / plan.length,
              sum[1] + (east * Math.sin(map.heading) + south * Math.cos(map.heading)) / plan.length,
            ];
          },
          [0, 0],
        );
      });
    for (const [i, tip] of [456.9, 435].entries()) {
      const vertices = triangles
        .flat()
        .filter((p) => p[1] > 337.35 && Math.hypot(p[0] - centers[i][0], p[2] - centers[i][1]) < 3);
      expect(Math.max(...vertices.map((p) => p[1])), `${level.name} mast ${i}`).toBeCloseTo(tip, 1);
      expect(Math.min(...vertices.map((p) => p[1]))).toBeLessThan(337.45);
    }
    for (const p of triangles.flat().filter((p) => p[1] > 350))
      expect(Math.min(...centers.map((c) => Math.hypot(p[0] - c[0], p[2] - c[1])))).toBeLessThan(3);
  }
}, 20000);
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
}, 20000);
