import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { takhtStudy } from '../../worldgen/scripts/takht-e-soleyman-model.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/tn/tn9/takht_e_soleyman'),
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

const originals = {
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  travertine: { graph: 'stone_travertine', slot: 'wall', roughness: 0.82, metallic: 0 },
  weathered: {
    graph: 'stone_limestone_weathered',
    slot: 'foundation',
    roughness: 0.9,
    metallic: 0,
  },
  brick: { graph: 'brick', slot: 'wall', roughness: 0.9, metallic: 0 },
  sandstone: { graph: 'stone_sandstone', slot: 'wall', roughness: 0.85, metallic: 0 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
};
it('reproduces the original master and binds fresh signed component evidence to reviewed source', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  takhtStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(817410);
  const spec = await read(source + '/spec.json'),
    frame = await read(source + '/map-frame.json');
  expect(frame.identity.id).toBe(203537193);
  expect(frame.identity.version).toBe(7);
  expect(frame.identity.tags.ref).toBe('1077');
  expect(frame.identity.tags.wikipedia).toBe('en:Takht-e Soleymān');
  expect(frame.features).toHaveLength(2);
  expect(frame.cachedVertexMaxErrorMeters).toBeLessThan(0.001);
  expect(frame.nativeAxisBearings).toEqual({ x: 0, z: 90 });
  const sourceManifest = await read(source + '/source.json');
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest,
      spec,
      placement: spec.geographicProposal,
      geographicReviewed: true,
    }),
  ).toMatchObject({ heading: Math.PI / 2, axis: frame.axis });
  expect(frame.features.find((f) => f.id === 'way/314769016')).toBeDefined();
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.groundModelY).toBe(0);
  expect(spec.geographicProposal.status).toBe('preview-proposal');
});
it('keeps open land, the northern gate and ruined courts while retaining mapped water and the protective canopy', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file));
    for (const [x, z] of [
      [-140, -60],
      [-70, 115],
      [15, 110],
    ])
      expect(
        nearest(d.triangles, [x, 100, z], [0, -1, 0]),
        l.name + ' open plateau ' + [x, z],
      ).toBe(Infinity);
    expect(
      nearest(d.triangles, [225, 1.5, 18], [-1, 0, 0]),
      l.name + ' north gate',
    ).toBeGreaterThan(35);
    expect(
      nearest(d.triangles, [225, -3, 30], [-1, 0, 0]),
      l.name + ' occupied wall feet',
    ).toBeLessThan(40);
    expect(nearest(d.triangles, [-50, 100, 20], [0, -1, 0]), l.name + ' mapped lake').toBeCloseTo(
      99.975,
      4,
    );
    expect(
      nearest(d.triangles, [-43, 100, -106], [0, -1, 0]),
      l.name + ' protective roof',
    ).toBeCloseTo(l.name === 'skyline' ? 94.9 : 94.5, 4);
    expect(d.triangles.reduce((n, t) => Math.max(n, ...t.map((p) => p[1])), -Infinity)).toBeCloseTo(
      22,
      4,
    );
    expect(d.g.images ?? []).toHaveLength(0);
    expect(d.g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
  }
});
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
