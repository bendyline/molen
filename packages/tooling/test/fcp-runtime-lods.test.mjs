import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { encodeAuthoredAssembly } from '../../worldgen/scripts/authored-glb-assembly.mjs';
import { firstCanadianPlaceStudy } from '../../worldgen/scripts/first-canadian-place-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dp/dpz/n0227_first_canadian_place'),
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

const originals = {
  frit: { graph: 'glass_frit_triangular', slot: 'wall', roughness: 0.2, metallic: 0 },
  fcp_vision: { slot: 'window', localRef: 'palette:#fffefd', roughness: 0.16, metallic: 0.08 },
  bronze_glass: { slot: 'window', localRef: 'palette:#fffefe', roughness: 0.17, metallic: 0.05 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  marble: { graph: 'stone_marble', slot: 'wall', roughness: 0.78, metallic: 0 },
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
};
it('reproduces the preserved four-part source assembly and independently signed raw placement', async () => {
  const bytes = firstCanadianPlaceStudy.encodeAssembly((build, name) => {
    const b = new MeshBufferBuilder(),
      a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
    build(a.wrap(b));
    const m = b.finalize();
    const materials = a.materials(m.groups).map((s, i) => ({
      ...s,
      name: `${s.sharedSurface ? s.name : m.groups[i].slot}-${m.groups[i].slot}`,
    }));
    return encodeGlb(m, materials, name);
  }, encodeAuthoredAssembly);
  expect(bytes.byteLength).toBe(1975096);
  const m = await read(`${source}/map-frame.json`),
    prior = await read(`${source}/georeferencing-baseline.json`),
    spec = await read(`${source}/spec.json`);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(prior.heading);
  expect(m.geometry).toEqual(prior.geometry);
  expect(m.elements[0].tags.wikidata).toBe('Q1052475');
  expect(m.elements[0].id).toBe(27767627);
  const project = (q) => {
    const r = 6378137,
      f = Math.cos((m.anchor[1] * Math.PI) / 180),
      e = (((q.lon - m.anchor[0]) * Math.PI) / 180) * r * f,
      s =
        (-r * Math.asinh(Math.tan((q.lat * Math.PI) / 180)) +
          r * Math.asinh(Math.tan((m.anchor[1] * Math.PI) / 180))) *
        f;
    return [
      Math.cos(m.heading) * e - Math.sin(m.heading) * s,
      Math.sin(m.heading) * e + Math.cos(m.heading) * s,
    ];
  };
  for (const q of m.elements[0].geometry.map(project))
    expect(
      Math.min(...prior.geometry.outline.map((p) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
    ).toBeLessThan(0.002);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.mesh.triangles).toBe(27876);
  expect(spec.sourceFacts.architecturalHeightMeters).toBe(298.1);
  expect(spec.sourceFacts.tipHeightMeters).toBe(355);
}, 120000);
it('keeps the outward notched facade, closed roof, distinct masts and recessed lobby across levels', async () => {
  const b = new MeshBufferBuilder();
  firstCanadianPlaceStudy.build(b);
  const m = b.finalize(),
    ts = [];
  for (let i = 0; i < m.indices.length; i += 3)
    ts.push(
      Array.from(m.indices.slice(i, i + 3), (j) => Array.from(m.positions.slice(j * 3, j * 3 + 3))),
    );
  const plan = [
    [-24.384, -27.432],
    [-24.384, -22.86],
    [-28.956, -22.86],
    [-28.956, 22.86],
    [-24.384, 22.86],
    [-24.384, 27.432],
    [24.384, 27.432],
    [24.384, 22.86],
    [28.956, 22.86],
    [28.956, -22.86],
    [24.384, -22.86],
    [24.384, -27.432],
  ];
  const asset = await read(`${runtime}/asset.json`);
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [74.03, 160.27, 264.55])
      for (let k = 0; k < plan.length; k++) {
        const a = plan[k],
          b = plan[(k + 1) % plan.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          nx = -(b[1] - a[1]) / len,
          nz = (b[0] - a[0]) / len,
          o = [(a[0] + b[0]) / 2 + 5 * nx, y, (a[1] + b[1]) / 2 + 5 * nz],
          v = [-nx, 0, -nz],
          ref = nearestWithNormal(ts, o, v),
          hit = nearestWithNormal(d.triangles, o, v);
        expect(
          Number.isFinite(ref.distance) && Number.isFinite(hit.distance),
          `${l.name} facade ${k}/${y}`,
        ).toBe(true);
        expect(
          Math.abs(ref.distance - hit.distance) * Math.abs(dot(v, ref.normal)),
          `${l.name} displacement ${k}/${y}`,
        ).toBeLessThan(l.errorMeters + 0.02);
        expect(dot(v, hit.normal)).toBeLessThan(0);
      }
    expect(
      nearest(d.triangles, [20, 295, 0], [0, -1, 0]),
      `${l.name} closed main roof`,
    ).toBeCloseTo(5.23, 2);
    expect(nearest(d.triangles, [0, 310, 0], [0, -1, 0]), `${l.name} plant top`).toBeCloseTo(
      11.9,
      2,
    );
    expect(nearest(d.triangles, [0, 2, 0], [0, -1, 0]), `${l.name} lobby paving`).toBeCloseTo(
      l.name === 'closeup' || l.name === 'street' ? 1.8 : 1.87,
      2,
    );
    for (const [x, z, y] of [
      [-7, -19, 343],
      [-7, 19, 343],
      [7, 0, 321],
    ]) {
      const lattice = x === -7 && z === -19 && (l.name === 'street' || l.name === 'closeup');
      // Open latticework is tested at a leg, not by expecting a wall across its hollow centre.
      const origin = lattice ? [x - 0.82, y, z - 0.82] : [x, y, z];
      expect(nearest(d.triangles, origin, [1, 0, 0]), `${l.name} mast ${x}/${z}`).toBeLessThan(1);
    }
    expect(
      Math.max(
        ...d.g.meshes
          .flatMap((m) => m.primitives)
          .map((p) => d.g.accessors[p.attributes.POSITION].max[1]),
      ),
    ).toBeCloseTo(355, 4);
  }
}, 120000);
it('rebuilds all browser levels deterministically within triangle/download/draw budgets without repeated vertex uploads', async () => {
  const p = `${runtime}/asset.json`;
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(`${runtime}/${l.file}`),
      { g } = decode(bytes);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.filter((m) => m.alphaMode === 'BLEND').length).toBeLessThanOrEqual(1);
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
