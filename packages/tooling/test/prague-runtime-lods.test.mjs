import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { pragueStudy } from '../../worldgen/scripts/prague-castle-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u2/u2f/n0240_prague_castle'),
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
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.88, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  weathered: {
    graph: 'stone_limestone_weathered',
    slot: 'foundation',
    roughness: 0.9,
    metallic: 0,
  },
  tile: { graph: 'tile_ceramic', slot: 'roof', roughness: 0.88, metallic: 0 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  copper: { graph: 'metal_copper', slot: 'roof', roughness: 0.5, metallic: 0.85 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    alphaMode: 'OPAQUE',
    roughness: 0.2,
    metallic: 0.28,
  },
};
it('reproduces the preserved detailed Prague master and verifies independent plan/terrain evidence', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  pragueStudy.build(a.wrap(b));
  const m = b.finalize(),
    bytes = Buffer.from(
      encodeGlb(
        m,
        a.materials(m.groups).map((s, i) => ({
          ...s,
          name: `${s.sharedSurface ? s.name : m.groups[i].slot}-${m.groups[i].slot}`,
        })),
        'Molen original Prague Castle',
      ),
    );
  expect(m.triangleCount).toBe(567918);
  expect(bytes.length).toBe(47961476);
  expect(hash(bytes)).toBe(
    'sha256:80beee517c6a4c2b3e50ceea71e4e24d6270c97381b6f2b3d11533180f662ff0',
  );
  const spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`),
    frame = await read(`${source}/map-frame.json`),
    grade = await read(`${source}/site-grade.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(hash(await readFile(`${runtime}/model.glb`))).toBe(asset.hash);
  expect(frame.precinct.tags.wikidata).toBe('Q193369');
  expect(frame.occupied).toHaveLength(299);
  expect(frame.cachedVertexMaxErrorMeters).toBeLessThan(0.003);
  expect(frame.extraElements[0].tags.wikidata).toBe('Q3506740');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.status).toBe('preview-proposal');
  expect(hash(await readFile(`${source}/${grade.sourceRaster}`))).toBe(grade.sourceRasterHash);
  expect(grade.grid.heights).toHaveLength(4305);
  expect(grade.grid.heights.every((v) => Number.isFinite(v) && v > 180 && v < 270)).toBe(true);
  expect(grade.heightDatum).toContain('Bpv');
  expect(grade.exportRequest.parameters.pixelType).toBe('F32');
  expect(JSON.parse(grade.exportRequest.parameters.renderingRule).rasterFunction).toBe('None');
  expect(grade.checks.find((p) => p.native[0] === 253).relativeY).toBeCloseTo(-11.447822782, 7);
  expect(spec.geographicProposal.terrainReference.anchor).toEqual(
    grade.checks.find((p) => p.native[0] === -114).coordinate,
  );
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(0);
}, 120000);
it('keeps genuinely open courtyard holes and all three unequal cathedral towers in every level', async () => {
  const asset = await read(`${runtime}/asset.json`);
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const [x, z] of [
      [-197, 15],
      [-114, 29],
      [125, 7],
      [175, -5],
      [85, 15],
      [242, -8],
      [221, -7],
      [-3, 42],
    ])
      expect(nearest(d.triangles, [x, 130, z], [0, -1, 0]), `${l.name} open court${x}/${z}`).toBe(
        Infinity,
      );
    for (const [x, z, minHeight] of [
      [-134.2, -37.6, 75],
      [-134.2, -16.5, 75],
      [-95.15, -11.4, 85],
    ])
      expect(
        nearest(d.triangles, [x, 120, z], [0, -1, 0]),
        `${l.name} cathedral tower`,
      ).toBeLessThan(120 - minHeight);
    expect(
      nearest(d.triangles, [269, 100, -78], [0, -1, 0]),
      `${l.name} retained Daliborka`,
    ).toBeLessThan(98);
    if (['street', 'closeup'].includes(l.name)) {
      expect(
        nearest(d.triangles, [220, -0.85, -69.8], [0, -1, 0]),
        `${l.name} supported Golden Lane gallery eave`,
      ).toBeLessThan(0.3);
      for (const y of [13.2, 14])
        expect(
          nearest(d.triangles, [139.7, y, -74.1], [0, 0, 1]),
          `${l.name} closed White Tower hip boundary at ${y}`,
        ).toBeLessThan(0.5);
    }
    expect(d.g.images ?? []).toHaveLength(0);
    expect(d.g.materials.every((m) => m.alphaMode !== 'BLEND')).toBe(true);
  }
});
it('rebuilds all browser levels deterministically within triangle/download/draw budgets without repeated vertex uploads', async () => {
  const p = `${runtime}/asset.json`,
    asset = await read(p),
    before = await Promise.all(
      asset.runtimeLods.levels.map((l) => readFile(`${runtime}/${l.file}`)),
    );
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.recipeHash).toBe(asset.runtimeLods.recipeHash);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(`${runtime}/${l.file}`),
      { g } = decode(bytes);
    expect(bytes.equals(before[i])).toBe(true);
    expect(hash(bytes)).toBe(l.hash);
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
