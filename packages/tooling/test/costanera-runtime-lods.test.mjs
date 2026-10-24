import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { encodeAuthoredAssembly } from '../../worldgen/scripts/authored-glb-assembly.mjs';
import { granTorreCostaneraStudy } from '../../worldgen/scripts/gran-torre-costanera-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/66/66j/gran_torre_costanera'),
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
  const transparentTriangles = [],
    opaqueTriangles = [];
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      const decoded = Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
      if (g.materials[p.material].alphaMode === 'BLEND') transparentTriangles.push(...decoded);
      else opaqueTriangles.push(...decoded);
      return decoded;
    }),
  );
  return { g, values, triangles, transparentTriangles, opaqueTriangles };
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
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
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
};
it('reconstitutes the original instanced master and independently reprojects exact tower placement', async () => {
  const bytes = granTorreCostaneraStudy.encodeAssembly((build, name) => {
    const b = new MeshBufferBuilder(),
      a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
    build(a.wrap(b));
    const m = b.finalize();
    return encodeGlb(
      m,
      a.materials(m.groups).map((s, i) => ({
        ...s,
        name: `${s.sharedSurface ? s.name : m.groups[i].slot}-${m.groups[i].slot}`,
      })),
      name,
    );
  }, encodeAuthoredAssembly);
  expect(bytes.byteLength).toBe(1959180);
  execFileSync(
    process.execPath,
    [
      'packages/worldgen/scripts/generate-signature-towers.mjs',
      '--ids=gran_torre_costanera',
      '--check',
    ],
    { cwd: resolve('../..'), stdio: 'pipe' },
  );
  const spec = await read(`${source}/spec.json`);
  expect(spec.assembly).toBeUndefined();
  const f = await read(`${source}/map-frame.json`),
    prior = await read(`${source}/georeferencing-baseline.json`);
  expect(f.anchor).toEqual(prior.anchor);
  expect(f.heading).toBeCloseTo(0.938147971775, 10);
  expect(f.elements[0].tags.wikidata).toBe('Q1542408');
  expect(f.elements[0].tags['not:name']).toBe('Costanera Center');
  expect(f.elements[0].tags.height).toBe('300');
  const r = 6378137,
    c = Math.cos((f.anchor[1] * Math.PI) / 180),
    project = (q) => {
      const e = (((q.lon - f.anchor[0]) * Math.PI) / 180) * r * c,
        s =
          (-r * Math.asinh(Math.tan((q.lat * Math.PI) / 180)) +
            r * Math.asinh(Math.tan((f.anchor[1] * Math.PI) / 180))) *
          c;
      return [
        Math.cos(f.heading) * e - Math.sin(f.heading) * s,
        Math.sin(f.heading) * e + Math.cos(f.heading) * s,
      ];
    };
  const p = f.elements[0].geometry.map(project);
  p.forEach((p, i) => {
    expect(
      Math.hypot(p[0] - f.geometry.outline[i][0], p[1] - f.geometry.outline[i][1]),
    ).toBeLessThan(0.00001);
    expect(
      Math.hypot(p[0] - prior.geometry.outline[i][0], p[1] - prior.geometry.outline[i][1]),
    ).toBeLessThan(0.002);
  });
  expect(f.orientationControl.notes).toContain('illustrative');
  expect(f.orientationControl.notes).toContain('southeast');
}, 120000);
it('retains four outward folded walls, recessed lower corners, open upper crown and clear doorway/canopy', async () => {
  const reference = decode(await readFile(`${source}/models/source.glb`)),
    asset = await read(`${runtime}/asset.json`);
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [35.73, 145.73, 243.73])
      for (const [x, z, dx, dz] of [
        [0.73, -40, 0, 1],
        [0.73, 40, 0, -1],
        [-40, 2.37, 1, 0],
        [40, 2.37, -1, 0],
      ]) {
        const o = [x, y, z],
          v = [dx, 0, dz],
          a = nearestWithNormal(reference.triangles, o, v),
          b = nearestWithNormal(d.triangles, o, v);
        expect(Number.isFinite(b.distance)).toBe(true);
        expect(Math.abs(a.distance - b.distance), `${l.name} folded facade`).toBeLessThanOrEqual(
          l.errorMeters + 0.12,
        );
        expect(dot(b.normal, v)).toBeLessThan(-0.95);
      }
    const diagonal = [-Math.SQRT1_2, 0, -Math.SQRT1_2];
    expect(
      nearest(d.triangles, [40, 275.73, 40], diagonal),
      `${l.name} lower corner screen`,
    ).toBeLessThan(40);
    expect(
      nearest(d.triangles, [40, 292.73, 40], diagonal),
      `${l.name} open upper corner`,
    ).toBeGreaterThan(55);
    expect(
      nearest(d.triangles, [10, 350, 10], [0, -1, 0]),
      `${l.name} open crown without solid roof cap`,
    ).toBeCloseTo(88.2, 2);
    const max = Math.max(
      ...d.g.meshes
        .flatMap((m) => m.primitives)
        .map((p) => d.g.accessors[p.attributes.POSITION].max[1]),
    );
    expect(Math.abs(max - 300)).toBeLessThan(0.1);
    expect(
      nearest(d.triangles, [3.7, 6, -29], [0, -1, 0]),
      `${l.name} projected canopy`,
    ).toBeCloseTo(0.85, 2);
    if (['street', 'closeup'].includes(l.name)) {
      expect(d.g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(1);
      expect(
        d.g.materials.find((m) => m.alphaMode === 'BLEND').pbrMetallicRoughness.baseColorFactor[3],
      ).toBe(0.52);
      const door = nearestWithNormal(d.transparentTriangles, [1.7, 1.6, -40], [0, 0, 1]);
      expect(door.distance).toBeLessThan(15);
      expect(door.normal[2]).toBeLessThan(-0.95);
      expect(
        nearest(d.opaqueTriangles, [1.7, 1.6, -40], [0, 0, 1]),
        `${l.name} real clear entrance opening`,
      ).toBeGreaterThan(25);
    }
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
