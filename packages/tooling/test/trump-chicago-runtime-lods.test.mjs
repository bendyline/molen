import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineGlobal } from '../../worldgen/scripts/signature-tower-global-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve(
    '../../content/worldgen/source/places/dp/dp3/trump_international_hotel_and_tower',
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

it('reproduces the Chicago Trump detailed master and eight independent signed map ways', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
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
    });
  skylineGlobal.find((p) => p.id === 'trump_international_hotel_and_tower').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`);
  expect(m.elements).toHaveLength(8);
  expect(m.elements.find((p) => p.id === 64594680).tags.wikidata).toBe('Q546221');
  expect(m.orientationControl.riverSignFace).toBe('+Z');
  expect(m.orientationControl.wabashCanopyEnd).toBe('-X');
  expect(m.orientationControl.spireWays).toEqual([188356529, 284773992, 284773991]);
  expect(m.heading).toBeCloseTo(0.753576679582, 12);
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
});
it('keeps rounded asymmetric stages, terrace roofs and attached spire through every level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles;
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`));
    // Probe shaft walls above the 1.05 m terrace rails that distant levels intentionally omit.
    // An oblique ray through a missing rail measures a second-wall gap, not surface displacement.
    for (const y of [5, 30, 59.2, 65, 110, 125, 180, 205, 300, 344, 350])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          o = [Math.cos(a) * 120, y, Math.sin(a) * 120],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(target)) expect(hit, level.name).toBe(Infinity);
        else {
          expect(Math.abs(hit - target), `${level.name} wall ${y}/${i}`).toBeLessThan(
            { skyline: 1.5, district: 0.65, street: 0.25, closeup: 0.1 }[level.name],
          );
        }
      }
    // Probe roof interiors, away from approximate rounded-boundary facets.
    for (const [x, z] of [
      [-20, -5],
      [-20, 5],
      [-5, -5],
      [-5, 5],
      [10, -5],
      [10, 5],
      [40, 0],
    ]) {
      const o = [x, 500, z],
        d = [0, -1, 0],
        target = nearest(master, o, d),
        hit = nearest(triangles, o, d);
      if (!Number.isFinite(target)) expect(hit, level.name).toBe(Infinity);
      else
        expect(Math.abs(hit - target), `${level.name} roof ${x},${z}`).toBeLessThan(
          { skyline: 1.5, district: 0.65, street: 0.25, closeup: 0.1 }[level.name],
        );
    }
    expect(g.materials.length).toBeLessThanOrEqual(4);
    // Reproject independent geographic parts to check the offset ornamental spire.
    const m = await read(`${source}/map-frame.json`),
      vertices = triangles.flat();
    expect(vertices.reduce((h, p) => Math.max(h, p[1]), -Infinity)).toBeCloseTo(423.2, 2);
    expect(vertices.reduce((h, p) => Math.min(h, p[1]), Infinity)).toBe(0);
    const local = (p) => {
      const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
        S = -(p.lat - m.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    };
    for (const [id, lo, hi] of [
      [188356529, 357, 380],
      [284773992, 380, 400],
      [284773991, 400, 423.2],
    ]) {
      const geo = m.elements
          .find((p) => p.id === id)
          .geometry.slice(0, -1)
          .map(local),
        center = geo.reduce((s, p) => [s[0] + p[0] / geo.length, s[1] + p[1] / geo.length], [0, 0]),
        radius = Math.max(...geo.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1])));
      for (const y of [lo + 0.2, (lo + hi) / 2, hi - 0.2])
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4,
            o = [center[0] + Math.cos(a) * 20, y, center[1] + Math.sin(a) * 20],
            d = [-Math.cos(a), 0, -Math.sin(a)],
            target = nearest(master, o, d),
            hit = nearest(triangles, o, d);
          expect(Number.isFinite(target)).toBe(true);
          expect(Math.abs(hit - target), `${level.name} spire ${y}/${i}`).toBeLessThan(
            { skyline: 1.5, district: 0.65, street: 0.25, closeup: 0.1 }[level.name],
          );
        }
      expect(
        vertices.some(
          (p) =>
            Math.abs(p[1] - lo) < 0.01 &&
            Math.hypot(p[0] - center[0], p[2] - center[1]) <= radius + 0.1,
        ),
      ).toBe(true);
    }

    expect(g.materials.every((m) => (m.alphaMode ?? 'OPAQUE') === 'OPAQUE')).toBe(true);
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
