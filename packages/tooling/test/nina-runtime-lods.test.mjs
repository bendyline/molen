import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { encodeAuthoredAssembly } from '../../worldgen/scripts/authored-glb-assembly.mjs';
import { ninaTowerStudy } from '../../worldgen/scripts/nina-tower-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/we/wec/n0230_nina_tower'),
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
  cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
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
it('reconstitutes the original instanced master and uses independently signed mapped complex rings', async () => {
  const bytes = ninaTowerStudy.encodeAssembly((build, name) => {
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
  expect(bytes.byteLength).toBe(3554848);
  execFileSync(
    process.execPath,
    ['packages/worldgen/scripts/generate-signature-towers.mjs', '--ids=N0230', '--check'],
    { cwd: resolve('../..'), stdio: 'pipe' },
  );
  const spec = await read(`${source}/spec.json`);
  expect(spec.assembly).toBeUndefined();
  const f = await read(`${source}/map-frame.json`),
    prior = await read(`${source}/georeferencing-baseline.json`);
  expect(prior.status).toBe('research-only');
  expect(f.anchor).not.toEqual(prior.anchor);
  expect(f.heading).toBeCloseTo(0.252050826619587, 10);
  expect(f.elements[0].tags.wikidata).toBe('Q520839');
  expect(f.elements[1].id).toBe(112284860);
  expect(f.elements[2].id).toBe(112284790);
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
  for (const [name, i] of [
    ['tall', 1],
    ['short', 2],
    ['mall', 3],
    ['podium', 4],
    ['low', 5],
  ]) {
    const a = f.elements[i].geometry.slice(0, -1).map(project),
      b = f.orientationControl.nativeRings[name];
    expect(a.length).toBe(b.length);
    a.forEach((p, j) => {
      expect(Math.hypot(p[0] - b[j][0], p[1] - b[j][1])).toBeLessThan(0.00001);
    });
  }
  expect(Math.min(...f.orientationControl.nativeRings.short.map((p) => p[0]))).toBeGreaterThan(32);
  expect(Math.max(...f.orientationControl.nativeRings.low.map((p) => p[0]))).toBeLessThan(0);
}, 120000);
it('retains curved hotel concavity, separate low podium, bridge attachments and open asymmetric roof shapes', async () => {
  const reference = decode(await readFile(`${source}/models/source.glb`)),
    asset = await read(`${runtime}/asset.json`);
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [75.73, 190.73, 280.73])
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
        expect(Math.abs(a.distance - b.distance), `${l.name} tall facade`).toBeLessThanOrEqual(
          l.errorMeters + 0.08,
        );
        expect(dot(b.normal, v)).toBeLessThan(-0.95);
      }
    for (const [x, dx] of [
      [30, 1],
      [80, -1],
    ]) {
      const a = nearestWithNormal(reference.triangles, [x, 95.73, 44], [dx, 0, 0]),
        b = nearestWithNormal(d.triangles, [x, 95.73, 44], [dx, 0, 0]);
      expect(Math.abs(a.distance - b.distance), `${l.name} crescent hotel`).toBeLessThanOrEqual(
        l.errorMeters + 0.08,
      );
      expect(dot(b.normal, [dx, 0, 0])).toBeLessThan(-0.95);
    }
    expect(
      nearest(d.triangles, [35, 200, 45], [0, -1, 0]),
      `${l.name} concave hotel does not fill inner arc`,
    ).toBeGreaterThan(155);
    expect(
      nearest(d.triangles, [52, 200, 45], [0, -1, 0]),
      `${l.name} curved hotel roof`,
    ).toBeLessThan(45);
    expect(
      nearest(d.triangles, [-90, 70, 50], [0, -1, 0]),
      `${l.name} low western wing`,
    ).toBeCloseTo(62, 2);
    for (const [x, z] of [
      [5, 2],
      [52, 45],
    ]) {
      const a = nearest(reference.triangles, [x, 350, z], [0, -1, 0]),
        b = nearestWithNormal(d.triangles, [x, 350, z], [0, -1, 0]);
      expect(Math.abs(a - b.distance), `${l.name} sail crown`).toBeLessThanOrEqual(
        l.errorMeters + 0.12,
      );
      expect(b.normal[1]).toBeGreaterThan(0.5);
    }
    expect(
      nearest(d.triangles, [30.5, 152, 26.5], [0, -1, 0]),
      `${l.name} bridge deck`,
    ).toBeCloseTo(0.3, 2);
    expect(
      nearest(d.triangles, [30.5, 152, 26.5], [0, 1, 0]),
      `${l.name} enclosed bridge roof`,
    ).toBeCloseTo(3.3, 2);
    const max = Math.max(
      ...d.g.meshes
        .flatMap((m) => m.primitives)
        .map((p) => d.g.accessors[p.attributes.POSITION].max[1]),
    );
    expect(Math.abs(max - 320.4)).toBeLessThan(0.1);
    if (['street', 'closeup'].includes(l.name)) {
      expect(d.g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(1);
      expect(
        d.g.materials.find((m) => m.alphaMode === 'BLEND').pbrMetallicRoughness.baseColorFactor[3],
      ).toBe(0.52);
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
