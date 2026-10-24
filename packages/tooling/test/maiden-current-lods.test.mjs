import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross as meshCross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { heritageTowers } from '../../worldgen/scripts/heritage-tower-models.mjs';
import { buildMaidenCloseup } from '../../worldgen/scripts/maiden-detail-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/tp/tp5/maiden_tower'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p));
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

it('reproduces the unchanged Maiden draft and binds the published west-facing entrance', async () => {
  const gen = await readFile('../worldgen/scripts/generate-heritage-towers.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function(`return (${gen.slice(at + 17, gen.indexOf(';', at))})`)(),
    wrap = Function(
      'surfaces',
      'normalize',
      'cross',
      'MATERIAL_REPEAT_METERS',
      `return (${gen.slice(gen.indexOf('function wrap('), gen.indexOf('async function emit'))})`,
    )(surfaces, normalize, meshCross, MATERIAL_REPEAT_METERS),
    b = new MeshBufferBuilder(),
    used = new Map(),
    draft = heritageTowers.find((s) => s.planId === 'maiden_tower');
  draft.build(wrap(b, used, draft.componentMap));
  const s = await read(`${source}/spec.json`),
    scope = await read(`${source}/review-scope.json`),
    frame = await read(`${source}/map-frame.json`),
    live = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.sourceGeometry.export).toBe('buildMaidenReviewed');
  expect(s.mesh.sha256).not.toBe(scope.sourceFacts.originalMasterHash);
  expect(live.heading).toBeCloseTo(0.081716996579, 12);
  expect(live.anchor).toEqual([49.837270733, 40.366150763]);
  expect(live.datum).toBe('terrain');
  expect(live.replaceFootprint).toBe(false);
  expect(frame.mappedIdentity.wikidataId).toBe('Q842822');
  expect(frame.coordinateSpace).toBe('model-local-xz');
  expect(frame.orientationControl.uncertaintyDegrees).toBe(5);
  expect(frame.geometry.outline[16]).toEqual(frame.geometry.outline[0]);
  expect(
    sourceLocalFootprint(s, await readFile(`${source}/map-frame.json`)).footprint,
  ).toHaveLength(17);
  const head = live.heading,
    east = Math.cos(head),
    north = Math.sin(head);
  expect(east).toBeGreaterThan(0.99);
  expect(north).toBeGreaterThan(0);
  const tipX = 12.715 * Math.cos(head) + 6.87 * Math.sin(head),
    tipNorth = 12.715 * Math.sin(head) - 6.87 * Math.cos(head);
  expect(tipX).toBeGreaterThan(12);
  expect(tipNorth).toBeLessThan(-5);
  let curvedFaces = 0;
  buildMaidenCloseup({
    addQuad(slot, material, points, _normal, uv) {
      if (slot !== 'limestone_round') return;
      expect(material).toBe('metric:uv');
      for (let i = 0; i < points.length; i++) expect(uv[i][1]).toBe(points[i][1]);
      expect(Math.max(...uv.map((p) => p[0])) - Math.min(...uv.map((p) => p[0]))).toBeLessThan(0.6);
      curvedFaces++;
    },
    addTriangle() {},
    addConvexPolygon() {},
  });
  expect(curvedFaces).toBeGreaterThan(8000);
});
it('retains the full asymmetric exterior, deep western entrance, recessed slits and open roof terraces at every level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(`${runtime}/model.${name}.glb`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
      ts = geometry(b),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1])), `${name} complete31m parapet`).toBeCloseTo(31, 4);
    expect(Math.min(...ps.map((p) => p.min[1])), `${name} lowest ground0`).toBe(0);
    expect(Math.max(...ps.map((p) => p.max[0])), `${name} rounded eastern arm`).toBeGreaterThan(14);
    // Offset from the draft's preserved narrow gate bar when testing the recess.
    const door = nearest(ts, [-20, 1, 0.211], [1, 0, 0]);
    expect(door, `${name} western entrance is deeply recessed`).toBeGreaterThan(7.75);
    expect(door, `${name} western entrance is opaque at back`).toBeLessThan(7.9);
    expect(
      nearest(ts, [-4.782, 35, 0.011], [0, -1, 0]),
      `${name} circle terrace beneath parapet`,
    ).toBeCloseTo(4.88, 3);
    expect(
      nearest(ts, [9.5, 35, 5], [0, -1, 0]),
      `${name} buttress terrace is inset, not solid parapet slab`,
    ).toBeCloseTo(4.88, 3);
    const angle = 1.226,
      origin = [-4.782 + 20 * Math.cos(angle), 20.5, 0.011 + 20 * Math.sin(angle)],
      direction = [-Math.cos(angle), 0, -Math.sin(angle)],
      slit = nearest(ts, origin, direction);
    if (name === 'skyline') expect(slit, `${name} far slit marker`).toBeLessThan(11.9);
    else {
      expect(slit, `${name} slit physical recess`).toBeGreaterThan(12.5);
      expect(slit, `${name} slit opaque backing`).toBeLessThan(12.7);
    }
  }
});
it('rebuilds exact four-level bytes within triangle/draw/download budgets with shared limestone and painted-metal graphs and separate GPU streams', async () => {
  const a = await read(`${runtime}/asset.json`);
  await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(`${runtime}/${l.file}`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
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
    ['stone_limestone', 'metal_painted'].map((n) => `matgraph:molen.worldgen.material.${n}`).sort(),
  );
}, 30000);
