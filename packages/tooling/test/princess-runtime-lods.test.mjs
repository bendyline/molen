import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildPrincess } from '../../worldgen/scripts/signature-tower-princess-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/th/thr/n0196_princess_tower'),
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
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
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
it('reproduces the original master and preserves four independent map rings and current source bindings', async () => {
  const m = await read(source + '/map-frame.json'),
    prior = await read(source + '/georeferencing-baseline.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildPrincess(a.wrap(b), prior);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? mat.sharedSurface.ref.split('.').at(-1) + '-' + mesh.groups[i].slot
        : mesh.groups[i].slot + '-' + mesh.groups[i].slot,
    }));
  expect(mesh.triangleCount).toBe(699554);
  expect(hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original Princess Tower')))).toBe(
    'sha256:83b8e50ee2e2f7110242fabd8837a8589666ff9a8efc3124533426cc43d59676',
  );
  const spec = await read(source + '/spec.json'),
    asset = await read(runtime + '/asset.json');
  expect(hash(await readFile(source + '/models/source.glb'))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBeCloseTo(0.775615371979, 12);
  expect(m.geometry.outline).toEqual(prior.geometry.outline);
  expect(m.elements.map((x) => x.id)).toEqual([186351092, 288039567, 295954576, 295954577]);
  for (const p of m.elements)
    expect(p.geometry).toEqual(prior.elements.find((x) => x.id === p.id).geometry);
  expect(m.elements[0].tags.wikidata).toBe('Q19492');
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.001);
  expect(decode(await readFile(source + '/models/source.glb')).g.materials).toHaveLength(4);
}, 60000);
it('retains complete facade envelopes, all street balconies, keyholes, crown tiers, striped dome and414m tip', async () => {
  const master = decode(await readFile(source + '/models/source.glb')).triangles,
    asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file)),
      ts = d.triangles,
      allowance = { skyline: 2, district: 1.2, street: 0.6, closeup: 0.1 }[l.name];
    for (const y of [31.95, 73.05, 132.85, 232.25, 287.45, 310.15, 341.55, 354.25, 368.35, 384.5])
      for (let k = 0; k < 24; k++) {
        const t = ((k + 0.17) * Math.PI * 2) / 24,
          o = [70 * Math.cos(t), y, 70 * Math.sin(t)],
          v = [-Math.cos(t), 0, -Math.sin(t)],
          target = nearest(master, o, v),
          actual = nearest(ts, o, v);
        expect(Number.isFinite(target)).toBe(true);
        expect(Number.isFinite(actual), l.name + ' coverage ' + y + '/' + k).toBe(true);
        expect(Math.abs(actual - target), l.name + ' envelope ' + y + '/' + k).toBeLessThan(
          allowance,
        );
      }
    expect(ts.flat().reduce((hi, p) => Math.max(hi, p[1]), 0)).toBeCloseTo(414, 3);
    if (l.name === 'street' || l.name === 'closeup') {
      const pitch = (290 - 27.75) / 74;
      for (let j = 0; j < 74; j++)
        for (const [o, v, dist] of [
          [[60, 27.75 + j * pitch + 0.15, 0], [-1, 0, 0], 40.129],
          [[0, 27.75 + j * pitch + 0.15, 60], [0, 0, -1], 41.258],
        ])
          expect(nearest(ts, o, v), l.name + ' balcony ' + j).toBeCloseTo(dist, 2);
      expect(d.g.materials.some((m) => m.alphaMode === 'BLEND')).toBe(true);
    }
    for (const y of [352.9, 363.4, 369.3])
      expect(
        Number.isFinite(nearest(ts, [0, y, 50], [0, 0, -1])),
        l.name + ' glazed tier ' + y,
      ).toBe(true);
  }
}, 60000);
it('rebuilds four pinned browser levels within transfer/triangle/draw caps with separate GPU streams', async () => {
  const before = (await read(runtime + '/asset.json')).runtimeLods,
    after = await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
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
      b = await readFile(runtime + '/' + l.file),
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
