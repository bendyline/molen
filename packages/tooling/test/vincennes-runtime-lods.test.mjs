import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { vincennesStudy } from '../../worldgen/scripts/vincennes-castle-model.mjs';
import { vincennesGround } from '../../worldgen/scripts/vincennes-runtime-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u09/n0265_chateau_de_vincennes'),
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
    const n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
      len = Math.hypot(...n);
    // Match the browser's front-face raycasting, including overlapping palace wings.
    if (dot(n, d) >= 0) continue;
    const t = nearest([p], o, d);
    if (t >= best.distance) continue;
    best = { distance: t, normal: n.map((v) => v / len) };
  }
  return best;
}

const originals = {
  limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
it('reproduces original bytes and verifies signed fresh map and retained terrain inputs', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  vincennesStudy.build(a.wrap(b));
  const m = b.finalize();
  const bytes = Buffer.from(
    encodeGlb(
      m,
      a.materials(m.groups).map((s, i) => ({
        ...s,
        name: `${s.sharedSurface ? s.name : m.groups[i].slot}-${m.groups[i].slot}`,
      })),
      'Molen original Château de Vincennes',
    ),
  );
  expect(m.triangleCount).toBe(12218);
  expect(bytes.length).toBe(1225900);
  expect(hash(bytes)).toBe(
    'sha256:592f1d5e9c9b8943b3abe4f766ad797cff9cb5a18a0edc4d259167bd114b894f',
  );
  const spec = await read(source + '/spec.json'),
    asset = await read(runtime + '/asset.json'),
    frame = await read(source + '/map-frame.json'),
    grade = await read(source + '/site-grade.json'),
    manifest = await read(source + '/source.json');
  expect(hash(await readFile(source + '/models/source.glb'))).toBe(spec.mesh.sha256);
  expect(hash(await readFile(runtime + '/model.glb'))).toBe(asset.hash);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(frame.identity.id).toBe(23032971);
  expect(frame.identity.version).toBe(26);
  expect(frame.identity.tags.wikidata).toBe('Q663673');
  expect(frame.currentMapReconciliation.maxSavedVertexErrorMeters).toBeLessThan(0.0007);
  expect(
    Math.max(...Object.values(frame.currentMapReconciliation.componentErrorsMeters)),
  ).toBeLessThan(0.0007);
  expect(frame.anchor).toEqual([2.435779375, 48.842783541]);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: manifest,
      spec,
      placement: spec.geographicProposal,
      geographicReviewed: true,
    }),
  ).toMatchObject({ heading: frame.heading, axis: frame.axis });
  expect(grade.grid.heights).toHaveLength(58081);
  expect(grade.grid.heights.every(Number.isFinite)).toBe(true);
  expect(grade.datumMeters).toBe(53.6499);
  expect(grade.workingCourtFloor).toBe(0.8777);
  for (const r of grade.sources) expect(hash(await readFile(source + '/' + r.file))).toBe(r.hash);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.groundCutout).toBeUndefined();
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(0);
});
it('keeps court, crowns, four gate voids and outward foundation walls at every tier', async () => {
  const asset = await read(runtime + '/asset.json'),
    grade = await read(source + '/site-grade.json');
  for (const l of asset.runtimeLods.levels) {
    const { triangles } = decode(await readFile(runtime + '/' + l.file));
    expect(
      90 - nearest(triangles, [-40, 90, -88], [0, -1, 0]),
      l.name + ' open keep court',
    ).toBeCloseTo(grade.workingCourtFloor, 3);
    expect(90 - nearest(triangles, [-22, 90, -76], [0, -1, 0]), l.name + ' keep mast').toBeCloseTo(
      59 + grade.architectureShift,
      3,
    );
    for (const [o, dir, clear] of [
      [[-21.5, grade.workingCourtFloor + 2, -56], [0, 0, 1], 14],
      [[-73, grade.workingCourtFloor + 2, 17.7], [1, 0, 0], 23],
      [[155, grade.workingCourtFloor + 2, 18.5], [1, 0, 0], 24],
      [[-182, grade.workingCourtFloor + 2, 17.7], [1, 0, 0], 30],
    ])
      expect(nearest(triangles, o, dir), l.name + ' gate void').toBeGreaterThan(clear);
    for (const [x, n] of [
      [-28, [-1, 0, 0]],
      [-15, [1, 0, 0]],
    ]) {
      const hit = nearestWithNormal(
        triangles,
        [x, -0.1, -29],
        n.map((v) => -v),
      );
      expect(hit.distance, l.name + ' outward bridge fascia').toBeLessThan(8);
      expect(dot(hit.normal, n)).toBeGreaterThan(0.9);
    }
    expect(
      nearestWithNormal(triangles, [178, -0.25, 30], [0, 0, -1]).distance,
      l.name + ' closed deck-support wedge',
    ).toBeLessThan(10);
    for (const x of [178, 196]) {
      const deck =
        grade.workingCourtFloor +
        ((grade.villageBridgeOuterFloor - grade.workingCourtFloor) * (x - 174)) / 28;
      const hit = nearestWithNormal(triangles, [x, deck + 0.001, 30], [0, 0, -1]);
      expect(hit.distance, l.name + ' parapet meets sloping deck').toBeLessThan(10);
      expect(hit.normal[2]).toBeGreaterThan(0.9);
    }
    for (const [z, direction] of [
      [30, -1],
      [7, 1],
    ]) {
      const hit = nearestWithNormal(triangles, [188, -0.95, z], [0, 0, direction]);
      expect(hit.distance, l.name + ' outward arch spandrel').toBeLessThan(10);
      expect(hit.normal[2] * -direction).toBeGreaterThan(0.9);
    }
    for (const [x, z, n] of [
      [-47.5, -88, [-1, 0, 0]],
      [4.5, -88, [1, 0, 0]],
      [-40, -103, [0, 0, -1]],
    ]) {
      const hit = nearestWithNormal(
        triangles,
        [x + n[0] * 3, vincennesGround(x, z) + 0.12, z + n[2] * 3],
        n.map((v) => -v),
      );
      expect(hit.distance, l.name + ' foundation').toBeLessThan(3.2);
      expect(dot(hit.normal, n)).toBeGreaterThan(0.85);
    }
  }
});
it('rebuilds four browser levels byte-identically within download, draw and upload limits', async () => {
  const asset = await read(runtime + '/asset.json');
  expect(asset.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(
    3_000_000,
  );
  const rebuilt = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import {buildModelLandmarkLods} from './packages/tooling/scripts/source-runtime-lods.mjs'; console.log(JSON.stringify(await buildModelLandmarkLods(${JSON.stringify(runtime + '/asset.json')},{force:true})));`,
      ],
      { cwd: resolve('../..'), encoding: 'utf8' },
    ),
  );
  expect(rebuilt.levels.map((l) => l.hash)).toEqual(asset.runtimeLods.levels.map((l) => l.hash));
  for (const l of rebuilt.levels) {
    expect(l.triangles).toBeLessThanOrEqual(
      { skyline: 1000, district: 4000, street: 16000, closeup: 64000 }[l.name],
    );
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    const { g } = decode(await readFile(runtime + '/' + l.file));
    expect(g.images ?? []).toHaveLength(0);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const pa = g.accessors[p.attributes.POSITION],
        na = g.accessors[p.attributes.NORMAL];
      expect(pa.bufferView).not.toBe(na.bufferView);
      expect(g.bufferViews[pa.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[na.bufferView].byteStride ?? 12).toBe(12);
    }
  }
});
