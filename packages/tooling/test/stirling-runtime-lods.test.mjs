import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { stirlingStudy } from '../../worldgen/scripts/stirling-castle-model.mjs';
import {
  stirlingGateControls,
  stirlingGround,
} from '../../worldgen/scripts/stirling-runtime-model.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';

const source = resolve('../../content/worldgen/source/places/gc/gcv/n0262_stirling_castle'),
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
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
it('reproduces the original mesh and verifies signed fresh map and retained terrain inputs', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  stirlingStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(8327);
  const spec = await read(source + '/spec.json'),
    frame = await read(source + '/map-frame.json'),
    grade = await read(source + '/site-grade.json'),
    manifest = await read(source + '/source.json');
  expect(frame.identity.id).toBe(100542995);
  expect(frame.identity.version).toBe(12);
  expect(frame.identity.tags.wikidata).toBe('Q756268');
  expect(frame.currentMapReconciliation.maxSavedVertexErrorMeters).toBeLessThan(0.0007);
  expect(
    Math.max(...Object.values(frame.currentMapReconciliation.componentErrorsMeters)),
  ).toBeLessThan(0.0007);
  expect(frame.anchor).toEqual([-3.948153826, 56.124036337]);
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
  expect(grade.datumMeters).toBe(102.05);
  expect(grade.workingCourtFloor).toBe(4.0559);
  for (const r of grade.sources) expect(hash(await readFile(source + '/' + r.file))).toBe(r.hash);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.groundCutout).toBeUndefined();
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(0);
});
it('preserves Lion’s Den, all Forework portals, corrected New Port bearing and buried foundations at every tier', async () => {
  const asset = await read(runtime + '/asset.json'),
    grade = await read(source + '/site-grade.json'),
    frame = await read(source + '/map-frame.json'),
    q = [64, 18, 26]
      .map((i) => frame.geometry.outline[i])
      .concat(
        [[0, 65]],
        [43, 58, 62].map((i) => frame.geometry.outline[i]),
      ),
    sign =
      q.reduce((n, a, i) => {
        const b = q[(i + 1) % q.length];
        return n + a[0] * b[1] - b[0] * a[1];
      }, 0) < 0
        ? -1
        : 1;
  const ctl = stirlingGateControls.newPort;
  expect(ctl.angle).toBeLessThan(0);
  const front = [
    ctl.center[0] + (Math.sin(ctl.angle) * ctl.depth) / 2,
    ctl.center[1] + (Math.cos(ctl.angle) * ctl.depth) / 2,
  ];
  expect(Math.hypot(front[0] + 6.29316411898, front[1] - 115.157638466)).toBeLessThan(0.1);
  for (const l of asset.runtimeLods.levels) {
    const { triangles } = decode(await readFile(runtime + '/' + l.file));
    expect(80 - nearest(triangles, [-26, 80, 31], [0, -1, 0]), l.name + ' Lion’s Den').toBeCloseTo(
      7 + grade.architectureShift,
      3,
    );
    expect(80 - nearest(triangles, [-8, 80, -6], [0, -1, 0]), l.name + ' Inner Close').toBeCloseTo(
      grade.workingCourtFloor,
      3,
    );
    for (const [name, c] of Object.entries(stirlingGateControls)) {
      const dx = Math.sin(c.angle),
        dz = Math.cos(c.angle);
      for (const lateral of name === 'forework' ? [-3.5, 0, 3.5] : [-0.35, 0, 0.35]) {
        const x = c.center[0] + dx * (c.depth / 2 + 0.35) + Math.cos(c.angle) * lateral,
          z = c.center[1] + dz * (c.depth / 2 + 0.35) - Math.sin(c.angle) * lateral;
        expect(
          nearest(triangles, [x, c.floor + 1.7, z], [-dx, 0, -dz]),
          l.name + ' ' + name + ' ' + lateral,
        ).toBeGreaterThan(c.depth + (name === 'forework' ? 3 : 0.35));
      }
    }
    for (const i of [1, 4, 5]) {
      const a = q[i],
        b = q[(i + 1) % q.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2,
        n = [(sign * (b[1] - a[1])) / len, (-sign * (b[0] - a[0])) / len],
        hit = nearestWithNormal(
          triangles,
          [x + n[0] * 3, stirlingGround(x, z) + 0.12, z + n[1] * 3],
          [-n[0], 0, -n[1]],
        );
      expect(hit.distance, l.name + ' foundation ' + i).toBeLessThan(4.2);
      expect(hit.normal[0] * n[0] + hit.normal[2] * n[1]).toBeGreaterThan(0.85);
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
