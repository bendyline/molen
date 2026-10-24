import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hohenzollernStudy } from '../../worldgen/scripts/hohenzollern-castle-model.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u0w/hohenzollern_castle'),
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
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  sandstone: { graph: 'stone_sandstone', slot: 'wall', roughness: 0.85, metallic: 0 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
};
it('preserves the original detailed source and registers fresh signed evidence', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  hohenzollernStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(349299);
  const spec = await read(source + '/spec.json'),
    frame = await read(source + '/map-frame.json'),
    grade = await read(source + '/site-grade.json'),
    manifest = await read(source + '/source.json'),
    cut = await read(source + '/ground-cutout.json');
  expect(frame.identity.tags.wikidata).toBe('Q156457');
  expect(frame.identity.version).toBe(51);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: manifest,
      spec,
      placement: spec.geographicProposal,
      geographicReviewed: true,
    }),
  ).toMatchObject({ heading: frame.heading, axis: frame.axis });
  expect(grade.grid.heights).toHaveLength(4225);
  expect(grade.grid.heights.every(Number.isFinite)).toBe(true);
  expect(grade.datumMeters).toBe(835.9281);
  expect(grade.architectureShift).toBe(-10.4563);
  for (const r of grade.sources) expect(hash(await readFile(source + '/' + r.file))).toBe(r.hash);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(0);
  expect(cut.areaMeters2).toBeLessThan(500);
  expect(cut.retainedGroundIslands.length).toBeGreaterThan(0);
});
it('keeps both mapped gate passages open and exterior platform feet below terrain', async () => {
  const asset = await read(runtime + '/asset.json'),
    frame = await read(source + '/map-frame.json'),
    grade = await read(source + '/site-grade.json'),
    gates = await read(source + '/gate-frame.json'),
    parts = await read(source + '/map-parts-reviewed.json');
  const { hohenzollernGround } = await import(
    '../../worldgen/scripts/hohenzollern-runtime-model.mjs'
  );
  for (const l of asset.runtimeLods.levels) {
    const { triangles } = decode(await readFile(runtime + '/' + l.file));
    // Test the curved lower route, including the excavation liner before the
    // gate. Rays only inside the gate would miss a blocked approach.
    for (const [id, lo, hi] of [
      [42139345, 0, 0.3],
      [275154217, 0.3, 1.3],
      [275154210, 1.3, 6],
      [275154214, 6, 7],
    ]) {
      const p = parts.features.find((f) => f.id === 'way/' + id).points,
        lengths = p.slice(1).map((b, i) => Math.hypot(b[0] - p[i][0], b[1] - p[i][1])),
        total = lengths.reduce((n, x) => n + x, 0);
      let walked = 0;
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1],
          b = p[i],
          length = lengths[i - 1],
          ya = lo + ((hi - lo) * walked) / total + grade.architectureShift,
          yb = lo + ((hi - lo) * (walked + length)) / total + grade.architectureShift,
          delta = [b[0] - a[0], yb - ya, b[1] - a[1]],
          distance = Math.hypot(...delta),
          direction = delta.map((x) => x / distance);
        expect(
          nearest(
            triangles,
            [
              a[0] + direction[0] * 0.05,
              ya + 1.8 + direction[1] * 0.05,
              a[1] + direction[2] * 0.05,
            ],
            direction,
          ),
          l.name + ' lower route segment ' + id + ':' + i,
        ).toBeGreaterThan(distance - 0.1);
        walked += length;
      }
    }
    for (const g of gates.gates) {
      const d = [Math.sin(g.a), Math.cos(g.a)],
        n = [Math.cos(g.a), -Math.sin(g.a)];
      for (const side of [-0.4, 0, 0.4])
        expect(
          nearest(
            triangles,
            [
              g.x - d[0] * (g.depth / 2 - 0.2) + n[0] * side,
              g.lo + grade.architectureShift + 2.2,
              g.z - d[1] * (g.depth / 2 - 0.2) + n[1] * side,
            ],
            [d[0], 0, d[1]],
          ),
          l.name + ' ' + g.name + ' open through passage',
        ).toBeGreaterThan(g.depth - 0.4);
    }
    const p = frame.geometry.outline,
      sign =
        p.reduce((n, a, i) => {
          const b = p[(i + 1) % p.length];
          return n + a[0] * b[1] - b[0] * a[1];
        }, 0) < 0
          ? -1
          : 1;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i],
        b = p[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 3 || a[0] > 28 || b[0] > 28) continue;
      const x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2,
        n = [(sign * (b[1] - a[1])) / len, (-sign * (b[0] - a[0])) / len];
      expect(
        nearestWithNormal(
          triangles,
          [x + n[0] * 3, hohenzollernGround(x, z) + 0.12, z + n[1] * 3],
          [-n[0], 0, -n[1]],
        ).distance,
        l.name + ' outer platform foot ' + i,
      ).toBeLessThan(4.2);
    }
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
