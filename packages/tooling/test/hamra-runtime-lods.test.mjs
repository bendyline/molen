import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/tj/tj4/al_hamra_tower'),
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
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

it('reproduces the original Al Hamra master and independently verifies signed north entry and south cut', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      clear_glass: {
        slot: 'window',
        localRef: 'palette:#feffff',
        roughness: 0.12,
        metallic: 0.05,
        opacity: 0.52,
        alphaMode: 'BLEND',
        baseColorFactor: [1, 1, 1, 0.52],
        doubleSided: true,
      },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineWorld.find((p) => p.id === 'al_hamra_tower').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    independent = await read(`${source}/map-parts.json`);
  expect(m.elements).toHaveLength(1);
  expect(m.elements[0].tags.wikidata).toBe('Q557933');
  expect(m.elements[0].geometry).toEqual(independent.elements[0].geometry);
  for (const p of independent.elements[0].geometry) {
    const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      S = -(p.lat - m.anchor[1]) * 111319.490793,
      q = [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    expect(
      Math.min(...m.geometry.outline.map((v) => Math.hypot(v[0] - q[0], v[1] - q[1]))),
    ).toBeLessThan(0.002);
  }
  expect(m.heading).toBeCloseTo(-0.16301785935, 12);
  expect(m.orientationControl.northEntry).toBe('-Z');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.sourceFacts.heightMeters).toBe(412.6);
  const { g, values } = decode(await readFile(`${source}/models/source.glb`));
  expect(g.materials).toHaveLength(4);
  expect(g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(1);
  for (const p of g.meshes.flatMap((m) => m.primitives))
    if (g.materials[p.material].alphaMode === 'BLEND') {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      expect(ids.reduce((best, id) => Math.max(best, ps[id][1]), -Infinity)).toBeLessThanOrEqual(
        24.00001,
      );
    }
});
it('retains moving courtyard, fixed envelope, deep apertures, sloping roof and repaired canopy bases through all levels', async () => {
  const asset = await read(`${runtime}/asset.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles;
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    // Non-window radial probes compare continuous flares and glazing at five published cut levels.
    for (const y of [0.5, 24.5, 75, 150, 225, 300, 350.8])
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
          o = [Math.cos(a) * 90, y, Math.sin(a) * 90],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        const targetPoint = o.map((v, k) => v + d[k] * target);
        // District windows have an explicitly aggregated schedule. Their recess is checked
        // separately at street/close-up; it is outside the district surface-error claim.
        const aggregatedWindow =
          level.name === 'district' &&
          Math.abs(targetPoint[0]) < 17 &&
          targetPoint[2] > 0.9 &&
          targetPoint[2] < 2.11;
        if (!Number.isFinite(target)) expect(hit).toBe(Infinity);
        else if (!aggregatedWindow)
          expect(Math.abs(hit - target), `${level.name} envelope ${y}/${i}`).toBeLessThan(
            allowance,
          );
      }
    for (const [x, z] of [
      [-24, -15],
      [24, -15],
      [0, -25],
      [-23, 0],
      [23, 0],
      [0, 0],
    ]) {
      const target = nearest(master, [x, 460, z], [0, -1, 0]),
        hit = nearest(triangles, [x, 460, z], [0, -1, 0]);
      expect(Math.abs(hit - target), `${level.name} crown ${x}/${z}`).toBeLessThan(allowance);
    }
    // The removed quarter moves SW at grade to SE near the occupied top.
    expect(nearest(triangles, [-26, 1, 50], [0, 0, -1])).toBeGreaterThan(45);
    expect(nearest(triangles, [26, 349, 50], [0, 0, -1])).toBeGreaterThan(45);
    if (['street', 'closeup'].includes(level.name))
      for (const row of [2, 17, 43, 70])
        for (const col of [2, 5, 9]) {
          const x = -17 + (34 * (col + 0.5)) / 12 + ((col + row) % 2 === 0 ? 0.23 : -0.23),
            y = 0.16 + ((351.2 - 0.16) * (row + 0.5)) / 80;
          expect(nearest(triangles, [x, y, 8], [0, 0, -1])).toBeCloseTo(6.92, 3);
        }
    const vertices = triangles.flat();
    expect(vertices.reduce((s, p) => Math.min(s, p[1]), Infinity)).toBe(0);
    expect(vertices.reduce((s, p) => Math.max(s, p[1]), -Infinity)).toBeCloseTo(412.6, 1);
    // The old incorrect canopy boxes crossed the whole northern lobby. Only two small pads remain.
    for (const x of [-10, 0, 10])
      expect(nearest(triangles, [x, 1.8, -20], [0, 0, 1])).toBeGreaterThan(18);
    const canopy = triangles.filter((t) => t.every((p) => Math.abs(p[1] - 8.1) < 0.0001));
    expect(canopy).toHaveLength(2);
    for (const t of canopy) expect(cross(sub(t[1], t[0]), sub(t[2], t[0]))[1]).toBeGreaterThan(0);
    expect(g.materials.length).toBeLessThanOrEqual(4);
    expect(g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(
      level.name === 'skyline' ? 0 : 1,
    );
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
