import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { karlstejnStudy } from '../../worldgen/scripts/karlstejn-castle-model.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';

const source = resolve('../../content/worldgen/source/places/u2/u2f/karlstejn_castle'),
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
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.82, metallic: 0 },
  carved: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.82, metallic: 0 },
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.88, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.85, metallic: 0 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
};
it('reproduces the original master and retains signed fresh map and numeric terrain inputs', async () => {
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(originals, { legacyAlphaFields: true });
  karlstejnStudy.build(a.wrap(b));
  const m = b.finalize();
  expect(m.triangleCount).toBe(556934);
  const spec = await read(source + '/spec.json'),
    frame = await read(source + '/map-frame.json'),
    grade = await read(source + '/site-grade.json'),
    manifest = await read(source + '/source.json');
  expect(frame.identity.tags.wikidata).toBe('Q266698');
  expect(frame.identity.version).toBe(27);
  expect(frame.features).toHaveLength(35);
  expect(frame.cachedVertexMaxErrorMeters).toBeLessThan(0.006);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: manifest,
      spec,
      placement: spec.geographicProposal,
      geographicReviewed: true,
    }),
  ).toMatchObject({ heading: frame.heading, axis: frame.axis });
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.terrainReference.modelHeight).toBe(
    grade.grid.heights[5100] - grade.datumMeters,
  );
  expect(spec.geographicProposal.groundModelY).toBe(0);
  expect(hash(await readFile(source + '/grade-source.tif'))).toBe(grade.sourceRasterHash);
  expect(grade.grid.heights).toHaveLength(10201);
  expect(grade.datumMeters).toBe(300);
  expect(spec.actualBounds.max[1]).toBeCloseTo(grade.workingFloors[443238530] + 62, 3);
});
it('keeps courts open, occupied mapped feet buried and the gate and timber passage clear', async () => {
  const asset = await read(runtime + '/asset.json'),
    frame = await read(source + '/map-frame.json'),
    grade = await read(source + '/site-grade.json');
  const { karlstejnGround } = await import('../../worldgen/scripts/karlstejn-runtime-model.mjs');
  for (const l of asset.runtimeLods.levels) {
    const { triangles } = decode(await readFile(runtime + '/' + l.file));
    expect(nearest(triangles, [-18, 150, 15], [0, -1, 0]), l.name + ' open central court').toBe(
      Infinity,
    );
    const a = [12.39, -71.56],
      b = [17.21, -67.9],
      w = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [-(b[1] - a[1]) / w, (b[0] - a[0]) / w],
      start = [
        (a[0] + b[0]) / 2 - n[0],
        grade.workingFloors[453018676] + 1.7,
        (a[1] + b[1]) / 2 - n[1],
      ];
    expect(nearest(triangles, start, [n[0], 0, n[1]]), l.name + ' north gate').toBeGreaterThan(7.3);
    const deck = (grade.workingFloors[443238530] + 4.5 + grade.workingFloors[443238531] + 16.5) / 2;
    expect(
      nearest(triangles, [47, deck - 2, 6.3], [0, 1, 0]),
      l.name + ' skyway underside',
    ).toBeCloseTo(2, 1);
    expect(
      nearest(triangles, [47, deck - 1, 6.3], [0, -1, 0]),
      l.name + ' open space below skyway',
    ).toBe(Infinity);
    if (l.name === 'skyline' || l.name === 'district') continue;
    for (const id of ['way/443238530', 'way/443238531', 'way/443238533']) {
      const p = frame.features.find((f) => f.id === id).native,
        area = p.reduce((v, a, i) => {
          const b = p[(i + 1) % p.length];
          return v + a[0] * b[1] - b[0] * a[1];
        }, 0);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i],
          b = p[i + 1],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 2) continue;
        const sign = area < 0 ? -1 : 1,
          n = [(sign * (b[1] - a[1])) / len, (-sign * (b[0] - a[0])) / len],
          x = (a[0] + b[0]) / 2,
          z = (a[1] + b[1]) / 2,
          hit = nearestWithNormal(
            triangles,
            [x + n[0] * 3, karlstejnGround(x, z) + 0.12, z + n[1] * 3],
            [-n[0], 0, -n[1]],
          );
        expect(hit.distance, l.name + ' foundation ' + id + ' edge' + i).toBeLessThan(4.2);
        expect(
          dot(hit.normal, [n[0], 0, n[1]]),
          l.name + ' outward foundation ' + id + ' edge' + i,
        ).toBeGreaterThan(0.8);
      }
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
