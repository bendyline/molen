import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { sforzaStudy } from '../../worldgen/scripts/sforza-castle-model.mjs';
import { sforzaGround } from '../../worldgen/scripts/sforza-runtime-model.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u0n/sforza_castle'),
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
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  aggregate: { graph: 'gravel', slot: 'foundation', roughness: 0.98, metallic: 0 },
  brick: { graph: 'brick', slot: 'wall', roughness: 0.9, metallic: 0 },
  tile: { graph: 'tile_ceramic', slot: 'roof', roughness: 0.88, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.88, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  copper: { graph: 'metal_copper', slot: 'roof', roughness: 0.5, metallic: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
it('reproduces the original mesh and verifies signed fresh map and retained terrain inputs', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  sforzaStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(509200);
  const spec = await read(source + '/spec.json'),
    frame = await read(source + '/map-frame.json'),
    grade = await read(source + '/site-grade.json'),
    manifest = await read(source + '/source.json');
  expect(frame.identity.tags.wikidata).toBe('Q23354');
  expect(frame.identity.version).toBe(38);

  expect(frame.identity.id).toBe(1918);
  expect(frame.currentMapReconciliation.maxSavedVertexErrorMeters).toBeLessThan(0.000681);
  expect(frame.currentMapReconciliation.missing).toEqual([]);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: manifest,
      spec,
      placement: spec.geographicProposal,
      geographicReviewed: true,
    }),
  ).toMatchObject({ heading: frame.heading, axis: frame.axis });
  expect(grade.grid.heights).toHaveLength(16641);
  expect(grade.grid.heights.every(Number.isFinite)).toBe(true);
  expect(grade.datumMeters).toBe(127.0364);
  expect(grade.workingCourtFloor).toBe(1.815);
  for (const r of grade.sources) expect(hash(await readFile(source + '/' + r.file))).toBe(r.hash);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.groundCutout.outline).toEqual(grade.groundCutout);
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(0);
});
it('retains three roofless courts, real gateways, open belfry and complete terrain-fitted moat', async () => {
  const asset = await read(runtime + '/asset.json'),
    grade = await read(source + '/site-grade.json');
  for (const l of asset.runtimeLods.levels) {
    const { triangles } = decode(await readFile(runtime + '/' + l.file));
    for (const p of [
      [-7, 20],
      [-57, -54],
      [29, -46],
    ]) {
      const h = 80 - nearest(triangles, [p[0], 80, p[1]], [0, -1, 0]);
      expect(h, l.name + ' roofless court ' + p).toBeGreaterThanOrEqual(
        grade.workingCourtFloor - 0.001,
      );
      expect(h, l.name + ' roofless court ' + p).toBeLessThan(grade.workingCourtFloor + 0.3);
    }
    for (const lateral of [-0.6, 0, 0.6])
      expect(
        nearest(triangles, [-6.7 + lateral, grade.workingCourtFloor + 1.8, 110], [0, 0, -1]),
        l.name + ' Filarete gate ' + lateral,
      ).toBeGreaterThan(35);
    expect(
      nearest(triangles, [-7.35, grade.workingCourtFloor + 1.8, -110], [0, 0, 1]),
      l.name + ' Barchio gate',
    ).toBeGreaterThan(25);
    expect(
      nearest(triangles, [-6.7, grade.workingCourtFloor + 50, 100], [0, 0, -1]),
      l.name + ' open belfry',
    ).toBeGreaterThan(25);
    const moat = 80 - nearest(triangles, [-112, 80, 0], [0, -1, 0]);
    expect(moat, l.name + ' complete moat floor').toBeCloseTo(grade.moatFloor, 3);
    const wall = nearestWithNormal(triangles, [-114, grade.moatFloor + 1, 0], [-1, 0, 0]);
    expect(wall.distance, l.name + ' inward moat side').toBeLessThan(4);
    expect(wall.normal[0], l.name + ' inward side faces ditch').toBeGreaterThan(0.95);
    // The skyline uses coarser terrain banks; the visible approach must still meet
    // the retained coarse ground within a small step, rather than hover meters above it.
    expect(
      Math.abs(
        80 -
          nearestWithNormal(triangles, [-6.7, 80, 117.9], [0, -1, 0]).distance -
          sforzaGround(-6.7, 117.9),
      ),
      l.name + ' fitted bridge/apron end clearance',
    ).toBeLessThan(l.name === 'skyline' ? 0.2 : 0.15);
    if (l.name !== 'skyline')
      expect(
        nearest(triangles, [-5.7, grade.workingCourtFloor + 60.5, 90], [0, 0, -1]),
        l.name + ' octagonal open loggia',
      ).toBeGreaterThan(12);
  }
});
it('rebuilds four browser levels within download, draw and upload limits', async () => {
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
