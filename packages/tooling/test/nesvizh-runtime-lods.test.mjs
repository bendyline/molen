import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { nesvizhStudy } from '../../worldgen/scripts/nesvizh-castle-model.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u9/u96/n0254_nesvizh_castle'),
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
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.88, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  tile: { graph: 'tile_ceramic', slot: 'roof', roughness: 0.88, metallic: 0 },

  bronze: { graph: 'metal_bronze_cast', slot: 'trim', roughness: 0.65, metallic: 0.7 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
it('reproduces original bytes and verifies signed fresh map and retained terrain inputs', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  nesvizhStudy.build(a.wrap(b));
  const m = b.finalize();
  const bytes = Buffer.from(
    encodeGlb(
      m,
      a.materials(m.groups).map((s, i) => ({
        ...s,
        name: `${s.sharedSurface ? s.name : m.groups[i].slot}-${m.groups[i].slot}`,
      })),
      'Molen original Nesvizh Castle',
    ),
  );
  expect(m.triangleCount).toBe(186936);
  expect(bytes.length).toBe(16074828);
  expect(hash(bytes)).toBe(
    'sha256:265d4166b08bc10b7bb06532d44d4ff7aba160f03cbc98ea4aa454d389e61f70',
  );
  const spec = await read(source + '/spec.json'),
    asset = await read(runtime + '/asset.json'),
    frame = await read(source + '/map-frame.json'),
    grade = await read(source + '/site-grade.json'),
    manifest = await read(source + '/source.json');
  expect(hash(await readFile(source + '/models/source.glb'))).toBe(spec.mesh.sha256);
  expect(hash(await readFile(runtime + '/model.glb'))).toBe(asset.hash);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(frame.identity.tags.wikidata).toBe('Q719422');
  expect(frame.identity.version).toBe(8);
  expect(frame.palaceIdentity.id).toBe(1732915);
  expect(Math.max(...frame.features.map((f) => f.maxErrorMeters))).toBeLessThan(0.00007);
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
  expect(grade.datumMeters).toBe(187.6694);
  expect(grade.workingCourtFloor).toBe(1.5806);
  for (const r of grade.sources) expect(hash(await readFile(source + '/' + r.file))).toBe(r.hash);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.groundCutout).toBeUndefined();
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(0);
});
it('keeps roofless court, entrance and three bridge vaults open at every browser level', async () => {
  const asset = await read(runtime + '/asset.json'),
    grade = await read(source + '/site-grade.json'),
    parts = await read(source + '/map-parts-reviewed.json');
  for (const l of asset.runtimeLods.levels) {
    const { triangles } = decode(await readFile(runtime + '/' + l.file));
    expect(nearest(triangles, [-20, 80, 0], [0, -1, 0]), l.name + ' open court').toBeCloseTo(
      80 - grade.workingCourtFloor,
      2,
    );
    const route = parts.features.find((f) => f.id === 'way/649550040').points,
      a0 = route[0],
      b0 = route.at(-1),
      dl = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]),
      d = [(b0[0] - a0[0]) / dl, 0, (b0[1] - a0[1]) / dl];
    for (const side of [-0.5, 0, 0.5])
      expect(
        nearest(
          triangles,
          [
            a0[0] - 3 * d[0] - side * d[2],
            grade.workingCourtFloor + 1.8,
            a0[1] - 3 * d[2] + side * d[0],
          ],
          d,
        ),
        l.name + ' mapped entrance ' + side,
      ).toBeGreaterThan(dl + 3);
    const bridge = parts.features.find((f) => f.id === 'way/112500238').points,
      a = bridge[0],
      b = bridge.at(-1),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [-axis[1], axis[0]];
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.5) / 3,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      expect(
        nearest(
          triangles,
          [x + n[0] * 4, grade.workingCourtFloor - 2, z + n[1] * 4],
          [-n[0], 0, -n[1]],
        ),
        l.name + ' bridge arch ' + k,
      ).toBeGreaterThan(7.5);
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
