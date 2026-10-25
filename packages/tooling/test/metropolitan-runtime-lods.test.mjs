import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildMetropolitan } from '../../worldgen/scripts/signature-tower-metropolitan-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve(
    '../../content/worldgen/source/places/dr/dr5/metropolitan_life_insurance_company_tower',
  ),
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
  foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  marble: { graph: 'stone_marble', slot: 'wall', roughness: 0.78, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
it('reproduces the original clock-tower master and independently signs the Madison/24thStreet corner', async () => {
  const m = await read(`${source}/map-frame.json`),
    baseline = await read(`${source}/georeferencing-baseline.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildMetropolitan(a.wrap(b));
  const spec = await read(`${source}/spec.json`);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.sourceFacts.baseMeters).toEqual([25.908, 22.86]);
  expect(m.heading).toBeCloseTo(2.6397482317108167, 12);
  expect(m.geometry.outline).toEqual(baseline.geometry.outline);
  expect(m.elements).toHaveLength(9);
  expect(m.elements[0].id).toBe(158404390);
  expect(m.elements[0].tags.wikidata).toBe('Q652452');
  for (const part of m.elements)
    expect(part.geometry).toEqual(baseline.elements.find((p) => p.id === part.id).geometry);
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
  expect(Math.cos(m.heading)).toBeLessThan(-0.8);
  expect(-Math.sin(m.heading)).toBeLessThan(-0.4);
  expect(Math.sin(m.heading)).toBeGreaterThan(0.4);
  expect(spec.sourceFacts.bellsPounds).toEqual({
    west: 7000,
    east: 3000,
    north: 2000,
    south: 1500,
  });
  expect(decode(await readFile(`${source}/models/source.glb`)).g.materials).toHaveLength(4);
}, 60000);
it('retains the narrowing shaft, all20gallery apertures, four clocks, roof profile and near unequal bells', async () => {
  const master = decode(await readFile(`${source}/models/source.glb`)).triangles,
    asset = await read(`${runtime}/asset.json`),
    half = (y) => [
      12.954 - (0.3048 * Math.min(y, 146)) / 146,
      11.43 - (0.2286 * Math.min(y, 146)) / 146,
    ];
  for (const level of asset.runtimeLods.levels) {
    const {
        g,
        triangles: ts,
        windowTriangles,
      } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 2, district: 1.2, street: 0.6, closeup: 0.1 }[level.name];
    for (const y of [12.3, 38.2, 73.1, 102.2, 122.4, 145.7, 153.3, 160.6])
      for (const axis of [0, 2])
        for (const sign of [-1, 1])
          for (const u of y > 150 ? [-8, 8] : [-9.2, 9.2]) {
            const o = axis === 0 ? [sign * 40, y, u] : [u, y, sign * 40],
              d = axis === 0 ? [-sign, 0, 0] : [0, 0, -sign],
              target = nearest(master, o, d);
            expect(Number.isFinite(target)).toBe(true);
            expect(
              Math.abs(nearest(ts, o, d) - target),
              `${level.name} envelope${y}/${axis}/${sign}/${u}`,
            ).toBeLessThan(allowance);
          }
    const h = half(135);
    for (const axis of [0, 2])
      for (const sign of [-1, 1]) {
        const width = 2 * h[axis === 0 ? 1 : 0],
          pitch = (width - 1.4) / 5;
        for (let k = 0; k < 5; k++) {
          const u = (k - 2) * pitch,
            o = axis === 0 ? [sign * 40, 135, u] : [u, 135, sign * 40],
            d = axis === 0 ? [-sign, 0, 0] : [0, 0, -sign],
            t = nearest(ts, o, d);
          expect(t, `${level.name} aperture${axis}/${sign}/${k}`).toBeGreaterThan(
            40 - h[axis === 0 ? 0 : 1] + 1.5,
          );
          expect(t).toBeLessThan(34);
        }
      }
    for (const axis of [0, 2])
      for (const sign of [-1, 1]) {
        const o = axis === 0 ? [sign * 25, 110.7, 0] : [0, 110.7, sign * 25],
          d = axis === 0 ? [-sign, 0, 0] : [0, 0, -sign];
        expect(
          Math.abs(nearest(ts, o, d) - nearest(master, o, d)),
          `${level.name} clock${axis}/${sign}`,
        ).toBeLessThan(0.6);
      }
    const roofY = 165 + ((9.1 - 6) * 22.8) / 6.3;
    expect(nearest(ts, [6, 195, 6], [0, -1, 0]), `${level.name} pyramid`).toBeCloseTo(
      195 - roofY,
      2,
    );
    expect(ts.flat().reduce((hi, p) => Math.max(hi, p[1]), 0)).toBeCloseTo(213.36, 3);
    expect(g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
    if (['street', 'closeup'].includes(level.name)) {
      // Independent LPC1530 plate7 shows two pairs at each clock floor.
      for (const y of [108.1, 112.43, 116.76])
        for (const axis of [0, 2])
          for (const sign of [-1, 1]) {
            const width = axis === 0 ? 22.86 : 25.908,
              windowWidth = axis === 0 ? 1.0668 : 1.2192;
            for (const bank of [-1, 1]) {
              const center = bank * width * 0.285,
                d = axis === 0 ? [-sign, 0, 0] : [0, 0, -sign],
                origin = (u) => {
                  const narrowed = (u * half(y)[axis === 0 ? 1 : 0]) / (width / 2);
                  return axis === 0 ? [sign * 40, y, narrowed] : [narrowed, y, sign * 40];
                };
              expect(nearest(windowTriangles, origin(center), d)).toBe(Infinity);
              for (const side of [-1, 1])
                expect(
                  nearest(windowTriangles, origin(center + (side * (windowWidth + 0.28)) / 2), d),
                ).toBeCloseTo(40 - half(y)[axis === 0 ? 0 : 1] + 0.2, 2);
            }
          }
      for (const [c, axis, sign] of [
        [[4.05, 0], 0, 1],
        [[-4.05, 0], 0, -1],
        [[0, 3.5], 2, 1],
        [[0, -3.5], 2, -1],
      ]) {
        const o = [c[0], 190.7, c[1]];
        o[axis] += sign * 2;
        const d = [0, 0, 0];
        d[axis] = -sign;
        expect(
          Math.abs(nearest(ts, o, d) - nearest(master, o, d)),
          `${level.name} bell${axis}/${sign}`,
        ).toBeLessThan(0.15);
      }
    }
  }
}, 60000);
it('rebuilds pinned four-level bytes within download/triangle/draw budgets without repeated GPU streams', async () => {
  const after = await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect(after.levels[0].bytes + after.levels[1].bytes).toBeLessThan(3000000);
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
