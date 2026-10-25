import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { edinburghStudy } from '../../worldgen/scripts/edinburgh-castle-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/gc/gcv/edinburgh_castle'),
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
  weathered: {
    graph: 'stone_limestone_weathered',
    slot: 'foundation',
    roughness: 0.9,
    metallic: 0,
  },
  sandstone: { graph: 'stone_sandstone', slot: 'wall', roughness: 0.85, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  tile: { graph: 'tile_ceramic', slot: 'roof', roughness: 0.88, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    alphaMode: 'OPAQUE',
    roughness: 0.2,
    metallic: 0.28,
  },
};
it('reproduces the original Edinburgh master and verifies its signed116-part frame and retained open terrain', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  edinburghStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(259930);
  const spec = await read(`${source}/spec.json`),
    frame = await read(`${source}/map-frame.json`),
    grade = await read(`${source}/site-grade.json`);
  expect(frame.identity.tags.wikidata).toBe('Q212065');
  expect(frame.identity.id).toBe(4301292);
  expect(frame.features).toHaveLength(116);
  expect(frame.occupied).toHaveLength(87);
  expect(frame.cachedVertexMaxErrorMeters).toBeLessThan(0.002);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.status).toBe('preview-proposal');
  expect(hash(await readFile(`${source}/${grade.sourceRaster}`))).toBe(grade.sourceRasterHash);
  expect(grade.grid.heights).toHaveLength(6695);
  expect(grade.grid.heights.every((v) => Number.isFinite(v) && v > 45 && v < 140)).toBe(true);
  expect(grade.license).toBe('OGL-3.0');
  expect(grade.coordinateTransform.pipeline).toContain('OSTN15');
  expect(grade.coordinateTransform.accuracyMeters).toBeLessThanOrEqual(1);
  expect(grade.checks.find((p) => p.native[0] === 50 && p.native[1] === 25).relativeY).toBeCloseTo(
    19.808273270659,
    7,
  );
  expect(spec.geographicProposal.terrainReference.anchor).toEqual(grade.checks[0].coordinate);
  // Reference the sampled bare earth, not the raised entrance floor: their difference
  // otherwise shifts the entire castle below its retained terrain fixture.
  expect(spec.geographicProposal.terrainReference.modelHeight).toBeCloseTo(-0.32287230489107765, 7);
}, 120000);
it('retains both open squares,the clock turret and genuinely open gate passages in every browser level', async () => {
  const asset = await read(`${runtime}/asset.json`);
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const [x, z] of [
      [58, 27],
      [62, 30],
    ])
      expect(
        nearest(d.triangles, [x, 80, z], [0, -1, 0]),
        `${l.name} paved open court`,
      ).toBeCloseTo(59.8, 4);
    for (const [x, z] of [
      [-92, -23],
      [-95, -25],
    ])
      expect(nearest(d.triangles, [x, 80, z], [0, -1, 0]), `${l.name} open hospital court`).toBe(
        Infinity,
      );

    expect(
      nearest(d.triangles, [70.7, 60, 25.1], [0, -1, 0]),
      `${l.name} clock turret`,
    ).toBeLessThan(25);
    for (const gate of [
      { c: [106.54, 2.2, -25.61], a: -Math.PI / 2 + 0.383, depth: 8.98 },
      { c: [34.134126998284124, 9.2, -42.53984363196876], a: 1.0951931797477348, depth: 8.5 },
    ]) {
      const dir = [Math.sin(gate.a), 0, Math.cos(gate.a)],
        origin = gate.c.map((v, k) => v - dir[k] * (gate.depth / 2 + 0.2));
      expect(nearest(d.triangles, origin, dir), `${l.name} gateway opening`).toBeGreaterThan(
        gate.depth + 0.2,
      );
    }
    expect(d.g.images ?? []).toHaveLength(0);
    // Viewed from Half Moon Battery, the cut court edge must close the formerly
    // exposed sky seam where bare-earth samples rise above the paving floor.
    const edgeDirection = [-58.49172943574487, -13.998198130058245, -11.740779443870395],
      edgeLength = Math.hypot(...edgeDirection);
    expect(
      nearest(
        d.triangles,
        [130, 35, 0],
        edgeDirection.map((v) => v / edgeLength),
      ),
    ).toBeLessThan(70);
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
