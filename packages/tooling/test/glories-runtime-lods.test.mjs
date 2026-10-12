import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineGlobal } from '../../worldgen/scripts/signature-tower-global-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/sp/sp3/n0173_torre_glories'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  read = async (p) => JSON.parse(await readFile(p)),
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

it('reproduces Torre Glòries original detailed master and the independent signed ellipse', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      pink: { graph: 'metal_painted', slot: 'wall', roughness: 0.5, metallic: 0.12 },
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
  skylineGlobal.find((p) => p.id === 'N0173').build(a.wrap(b), m);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original Torre Glòries')))).toBe(
    'sha256:73e27f0eb39b8aba789897e6c66cb7dfc1a1d8e4682805f15e8270bad2cb0165',
  );
  const spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(m.elements).toHaveLength(1);
  expect(m.elements[0].id).toBe(44213122);
  expect(m.elements[0].tags.wikidata).toBe('Q336246');
  expect(m.orientationControl.ellipseWay).toBe(44213122);
  expect(m.heading).toBeCloseTo(-0.350589088703, 12);
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
});
it('keeps the closed elliptical shaft and rounded crown through every level', async () => {
  const asset = await read(`${runtime}/asset.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles;
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`));
    for (const y of [0.4, 8, 40, 75, 95, 113, 123, 137, 143])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          o = [Math.cos(a) * 70, y, Math.sin(a) * 70],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(target)) expect(hit, level.name).toBe(Infinity);
        else {
          expect(Math.abs(hit - target), `${level.name} wall ${y}/${i}`).toBeLessThan(
            { skyline: 1.4, district: 0.65, street: 0.25, closeup: 0.1 }[level.name],
          );
        }
      }
    // Probe the roof, avoiding nearly vertical rays grazing the tapered shaft.
    for (let x = -8; x <= 8; x += 4)
      for (let z = -8; z <= 8; z += 4) {
        const o = [x, 180, z],
          d = [0, -1, 0],
          target = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(target)) expect(hit, level.name).toBe(Infinity);
        else
          expect(Math.abs(hit - target), `${level.name} roof ${x},${z}`).toBeLessThan(
            { skyline: 1.4, district: 0.65, street: 0.25, closeup: 0.1 }[level.name],
          );
      }
    expect(g.materials.length).toBeLessThanOrEqual(4);
    // Published height and map dimensions are independent of the authored sampling settings.
    const m = await read(`${source}/map-frame.json`),
      vertices = triangles.flat();
    expect(vertices.reduce((h, p) => Math.max(h, p[1]), -Infinity)).toBeCloseTo(144.4, 2);
    expect(vertices.reduce((h, p) => Math.min(h, p[1]), Infinity)).toBe(0);
    for (const [axis, radius] of [
      [0, m.plan.length / 2],
      [2, m.plan.width / 2],
    ]) {
      const shaft = vertices.filter((p) => p[1] < 76.4);
      expect(shaft.reduce((r, p) => Math.max(r, Math.abs(p[axis])), 0)).toBeCloseTo(radius, 0);
    }
    expect(g.materials.every((m) => (m.alphaMode ?? 'OPAQUE') === 'OPAQUE')).toBe(true);
  }
}, 60000);
it('rebuilds all levels deterministically within phone and geometry budgets without duplicated GPU layout', async () => {
  const assetPath = `${runtime}/asset.json`,
    before = (await read(assetPath)).runtimeLods,
    after = await buildModelLandmarkLods(assetPath, { force: true });
  expect(after.recipeHash).toBe(before.recipeHash);
  expect(after.levels.map((l) => l.hash)).toEqual(before.levels.map((l) => l.hash));
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
}, 60000);
