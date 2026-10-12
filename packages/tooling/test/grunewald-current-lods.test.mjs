import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import {
  cross as meshCross,
  normalize,
  smoothMeshNormals,
} from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { grunewaldTower } from '../../worldgen/scripts/grunewald-tower-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u33/n0616_grunewald_tower'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p)),
  hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
function geometry(b) {
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
    bin = 28 + b.readUInt32LE(12);
  const array = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
      w = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType],
      p = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, c) => {
        const at = p + i * (v.byteStride ?? w * n) + c * w;
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
  return g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = array(p.attributes.POSITION),
        ids = array(p.indices).flat();
      return Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((id) => ps[id]),
      );
    }),
  );
}
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function hit(o, d, p) {
  const a = sub(p[1], p[0]),
    b = sub(p[2], p[0]),
    h = cross(d, b),
    det = dot(a, h);
  if (det < 1e-8) return null;
  const q = sub(o, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}

const nearest = (ts, o, d) =>
  ts.reduce((nearest, p) => {
    const t = hit(o, d, p);
    return t !== null && t > 0 ? Math.min(nearest, t) : nearest;
  }, Infinity);

it('reproduces the untouched historical draft and binds the signed northeast entrance to the exact mapped terrace', async () => {
  const gen = await readFile('../worldgen/scripts/generate-heritage-towers.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')(),
    wrap = Function(
      'surfaces',
      'normalize',
      'cross',
      'MATERIAL_REPEAT_METERS',
      'return (' +
        gen.slice(gen.indexOf('function wrap('), gen.indexOf('async function emit')) +
        ')',
    )(surfaces, normalize, meshCross, MATERIAL_REPEAT_METERS),
    b = new MeshBufferBuilder(),
    used = new Map();
  grunewaldTower.build(wrap(b, used, grunewaldTower.componentMap));
  const m = b.finalize(),
    materials = m.groups.map((group) => {
      const s = used.get(group.slot + ':' + group.materialRef);
      return {
        name: (s.graph ?? 'recess') + '-' + s.slot,
        roughness: s.roughness,
        metallic: s.metallic ?? 0,
        ...(s.graph
          ? { sharedSurface: { ref: group.materialRef, slot: group.slot, uv: 'repeats' } }
          : {}),
      };
    }),
    s = await read(source + '/spec.json'),
    scope = await read(source + '/review-scope.json'),
    frame = await read(source + '/map-frame.json'),
    live = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(hash(Buffer.from(encodeGlb(m, materials, 'Molen original researched ' + s.title)))).toBe(
    scope.sourceFacts.originalMasterHash,
  );
  expect(m.triangleCount).toBe(296070);
  expect(s.sourceGeometry.export).toBe('buildGrunewaldReviewed');
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(live.heading).toBeCloseTo(2.185851134577897, 12);
  expect(live.anchor).toEqual([13.196730627, 52.478193956]);
  expect(live.datum).toBe('terrain');
  expect(live.replaceFootprint).toBe(false);
  expect(frame.mappedIdentity.featureIds).toEqual(['way/23722446']);
  const captured = sourceLocalFootprint(s, await readFile(source + '/map-frame.json'));
  expect(captured.footprint[0][0]).toBeCloseTo(13.1964768, 10);
  expect(captured.footprint[0][1]).toBeCloseTo(52.4782276, 10);
  expect(s.sourceFacts.heightMeters).toBe(55);
  expect(s.sourceFacts.upperViewingFloorMeters).toBe(36);
});
it('keeps the complete height, supported podium, three front stair routes and open galleries while adding the hall artwork', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0.008, 60, 0.008], [0, -1, 0]), name + ' whole height').toBeCloseTo(5, 3);
    expect(nearest(ts, [8, 10, 8], [0, -1, 0]), name + ' podium').toBeCloseTo(6, 3);
    expect(nearest(ts, [0, 10, -18], [0, -1, 0]), name + ' no invented rear staircase').toBe(
      Infinity,
    );
    for (const x of [-6, 6]) {
      const stair = nearest(ts, [x, 10, 13.5], [0, -1, 0]);
      expect(stair, name + ' side stair').toBeGreaterThan(6);
      expect(stair, name + ' side stair').toBeLessThan(9);
    }
    expect(nearest(ts, [1.8, 6, 8], [0, 0, -1]), name + ' open east portal').toBeGreaterThan(8);
    expect(nearest(ts, [0, 39, 8], [0, 0, -1]), name + ' open viewing hall').toBeGreaterThan(12);
    if (name === 'street' || name === 'closeup') {
      expect(nearest(ts, [0.08, 7.8, 3.5], [0, 0, -1]), name + ' sculpted figure').toBeGreaterThan(
        2.9,
      );
      expect(nearest(ts, [0.08, 7.8, 3.5], [0, 0, -1]), name + ' sculpted figure').toBeLessThan(
        3.6,
      );
      expect(nearest(ts, [1, 6, 0], [0, 1, 0]), name + ' visible mosaic underside').toBeGreaterThan(
        3.8,
      );
      expect(nearest(ts, [1, 6, 0], [0, 1, 0]), name + ' visible mosaic underside').toBeLessThan(
        5.2,
      );
    }
  }
  const m = geometry(await readFile(source + '/models/source.glb'));
  expect(nearest(m, [1.8, 6, 8], [0, 0, -1])).toBeGreaterThan(10);
  expect(nearest(m, [1, 6, 0], [0, 1, 0])).toBeLessThan(5.2);
});
it('regenerates identical four-level bytes within all triangle/draw/download budgets and uses six shared graphs without duplicated GPU streams', async () => {
  const a = await read(runtime + '/asset.json'),
    before = await Promise.all(a.runtimeLods.levels.map((l) => readFile(runtime + '/' + l.file)));
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect((await read(runtime + '/asset.json')).runtimeLods).toEqual(a.runtimeLods);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(runtime + '/' + l.file),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(b.equals(before[i])).toBe(true);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) refs.add(m.extras.molenSurface.ref);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const ps = g.accessors[p.attributes.POSITION],
          ns = g.accessors[p.attributes.NORMAL];
        expect(ps.bufferView).not.toBe(ns.bufferView);
        expect(g.bufferViews[ps.bufferView].byteStride ?? 12).toBe(12);
      }
  }
  expect([...refs].sort()).toEqual(
    ['stone_sandstone_raw', 'brick', 'metal_painted', 'plaster_lime', 'stone_marble', 'tile_mosaic']
      .map((n) => 'matgraph:molen.worldgen.material.' + n)
      .sort(),
  );
});
