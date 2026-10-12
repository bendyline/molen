import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildMetlife } from '../../worldgen/scripts/signature-tower-metlife-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/n0192_metlife_building'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2');
const read = async (p) => JSON.parse(await readFile(p)),
  hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
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
      if (g.materials[p.material].pbrMetallicRoughness.roughnessFactor===.2&&g.materials[p.material].pbrMetallicRoughness.metallicFactor===.28) windowTriangles.push(...decoded);
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
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  travertine: { graph: 'stone_travertine', slot: 'wall', roughness: 0.82, metallic: 0 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
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
};
it('reconstitutes the original per-cell master and signs the north entrance independently', async () => {
  const m = await read(`${source}/map-frame.json`),
    baseline = await read(`${source}/georeferencing-baseline.json`),
    parts = (await read(`${source}/map-parts.json`)).elements,
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildMetlife(a.wrap(b), baseline);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original MetLife Building')))).toBe(
    'sha256:167aa3da726b558e0397c02c34a9671852f4ea38493b53f55925ee55055e865e',
  );
  const spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.heading).toBeCloseTo(1.062997418385, 12);
  expect(m.geometry.outline).toEqual(baseline.geometry.outline);
  expect(m.elements).toHaveLength(8);
  expect(m.elements[0].id).toBe(137564642);
  expect(m.elements[0].tags.wikidata).toBe('Q464482');
  for (const part of m.elements.slice(1))
    expect(part.geometry).toEqual(parts.find((p) => p.id === part.id).geometry);
  for (const p of m.elements[0].geometry) {
    const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      S = -(p.lat - m.anchor[1]) * 111319.490793,
      q = [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    expect(
      Math.min(...baseline.geometry.outline.map((v) => Math.hypot(...sub(v, q)))),
    ).toBeLessThan(0.003);
  }
  expect(m.orientationControl.entry[0]).toBeGreaterThan(55);
  expect(Math.abs(m.orientationControl.entry[1])).toBeLessThan(1);
  expect(-Math.sin(m.heading)).toBeLessThan(-0.8);
  expect(Math.cos(m.heading)).toBeGreaterThan(0.4);
  expect(decode(await readFile(`${source}/models/source.glb`)).g.materials).toHaveLength(4);
}, 60000);
it('retains the octagonal envelope, truly inset mechanical floors, roof closure and recessed north arcade', async () => {
  const master = decode(await readFile(`${source}/models/source.glb`)).triangles,
    asset = await read(`${runtime}/asset.json`);
  for (const level of asset.runtimeLods.levels) {
    const {
        g,
        triangles: ts,
        windowTriangles,
      } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.5, closeup: 0.1 }[level.name];
    // Finite broad-surface probes exclude intentionally omitted skinny fins/columns and door hardware.
    for (const y of [42.7, 71.2, 102.3, 150.6, 199.2, 226.1])
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8 + 0.037,
          o = [-11 + 70 * Math.cos(a), y, 70 * Math.sin(a)],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(ts, o, d);
        expect(Number.isFinite(target)).toBe(true);
        expect(Math.abs(hit - target), `${level.name} envelope${y}/${i}`).toBeLessThan(allowance);
      }
    for (const y of [86.1, 190.5]) {
      const t = nearest(level.name === 'skyline' ? ts : windowTriangles, [25, y, 2.3], [-1, 0, 0]);
      expect(t, `${level.name} mechanical recess`).toBeGreaterThan(16);
      expect(t).toBeLessThan(19);
    }
    expect(nearest(ts, [-11, 260, 0], [0, -1, 0])).toBeCloseTo(13.7, 3);
    const roof = ts.filter((t) => t.every((p) => Math.abs(p[1] - 246.3) < 0.001));
    expect(roof.length).toBeGreaterThan(0);
    expect(roof.every((t) => cross(sub(t[1], t[0]), sub(t[2], t[0]))[1] > 0)).toBe(true);
    const soffit = ts.filter(
      (t) => t.every((p) => Math.abs(p[1] - 9.9) < 0.001) && t.every((p) => p[0] > 50),
    );
    expect(soffit.length).toBeGreaterThanOrEqual(2);
    expect(soffit.every((t) => cross(sub(t[1], t[0]), sub(t[2], t[0]))[1] < 0)).toBe(true);
    expect(g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
    expect(ts.flat().reduce((hi, p) => Math.max(hi, p[1]), 0)).toBeCloseTo(246.3, 3);
    if (level.name !== 'skyline')
      for (const z of [-4.7, 4.7]) {
        const t = nearest(ts, [55.2, 2.1, z], [-1, 0, 0]);
        expect(t, `${level.name} north door behind arcade`).toBeGreaterThan(1.9);
        expect(t).toBeLessThan(3.4);
      }
  }
}, 60000);
it('rebuilds pinned four-level bytes within download/triangle/draw budgets without repeated GPU streams', async () => {
  const before = (await read(`${runtime}/asset.json`)).runtimeLods,
    after = await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect(after.recipeHash).toBe(before.recipeHash);
  expect(after.levels.map((l) => l.hash)).toEqual(before.levels.map((l) => l.hash));
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
    expect(hash(b)).toBe(l.hash);
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
