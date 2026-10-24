import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { wartburgStudy } from '../../worldgen/scripts/wartburg-castle-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u1/u1p/wartburg'),
  runtime = await runtimeLodFixture(source.replace(/([\\/])source([\\/])/, '$1assets$2'));
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
  sandstone: { graph: 'stone_sandstone', slot: 'wall', roughness: 0.85, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.88, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  tile: { graph: 'tile_ceramic', slot: 'roof', roughness: 0.88, metallic: 0 },
  copper: { graph: 'metal_copper', slot: 'roof', roughness: 0.5, metallic: 0.85 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  gold: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    alphaMode: 'OPAQUE',
    roughness: 0.2,
    metallic: 0.28,
  },
};
it('reproduces the preserved Wartburg master and independently verifies signed map/terrain evidence', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  wartburgStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(227673);
  const spec = await read(`${source}/spec.json`),
    frame = await read(`${source}/map-frame.json`),
    grade = await read(`${source}/site-grade.json`);
  expect(frame.identity.tags.wikidata).toBe('Q151545');
  expect(frame.occupied).toHaveLength(21);
  expect(frame.cachedVertexMaxErrorMeters).toBeLessThan(0.002);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.status).toBe('preview-proposal');
  expect(hash(await readFile(`${source}/${grade.sourceRaster}`))).toBe(grade.sourceRasterHash);
  expect(grade.grid.heights).toHaveLength(3225);
  expect(grade.grid.heights.every((v) => Number.isFinite(v) && v > 300 && v < 430)).toBe(true);
  expect(grade.heightDatum).toContain('DHHN2016');
  expect(grade.sourceMetadata).toContain('2022-11');
  expect(grade.checks.find((p) => p.native[0] === 85).relativeY).toBeCloseTo(-5.309794962, 7);
  expect(spec.geographicProposal.terrainReference.anchor).toEqual(grade.checks[0].coordinate);
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(0);
}, 120000);
it('preserves two courtyard voids,distinct tower crowns and actual open gate passages in every browser level', async () => {
  const asset = await read(`${runtime}/asset.json`);
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const [x, z] of [
      [-20, 0],
      [-10, 0],
      [40, -8],
      [60, -7],
    ])
      expect(nearest(d.triangles, [x, 80, z], [0, -1, 0]), `${l.name} open court${x}/${z}`).toBe(
        Infinity,
      );
    expect(
      nearest(d.triangles, [14.15, 60, 4.55], [0, -1, 0]),
      `${l.name} keep and cross`,
    ).toBeLessThan(24);
    expect(
      nearest(d.triangles, [-51.2, 50, -0.5], [0, -1, 0]),
      `${l.name} South Tower`,
    ).toBeLessThan(32);
    expect(
      nearest(d.triangles, [17, 4.3, -4], [1, 0, 0]),
      `${l.name} inner gate opening`,
    ).toBeGreaterThan(10);
    expect(
      nearest(d.triangles, [78, -3.5, -0.05], [1, 0, 0]),
      `${l.name} outer gate opening`,
    ).toBeGreaterThan(14);
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
