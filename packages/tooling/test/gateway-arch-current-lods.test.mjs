import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { sourceLocalFootprint } from '../../../examples/world-explorer/test/visual/landmark-capture-footprint.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { cross as meshCross, normalize } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { gatewayArch, gatewaySection } from '../../worldgen/scripts/gateway-arch-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/9y/9yz/gateway_arch'),
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

it('reproduces the unchanged Gateway Arch master and binds the reviewed directed map frame', async () => {
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
    draft = gatewayArch;
  draft.build(wrap(b, used, draft.componentMap));
  const m = b.finalize();
  draft.decorateMesh(m);
  const s = await read(`${source}/spec.json`),
    frame = await read(`${source}/map-frame.json`),
    live = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(live.anchor).toEqual([-90.1849746, 38.624611275]);
  expect(live.heading).toBeCloseTo(1.262928261877, 12);
  expect(live.replaceFootprint).toBe(false);
  expect(frame.orientationControl.fit.scale).toBe(1);
  expect(
    Math.max(...frame.orientationControl.fit.controls.map((p) => p.residualMeters)),
  ).toBeLessThan(1.02);
  expect(frame.mappedIdentity.wikidataId).toBe('Q2027162');
  expect(sourceLocalFootprint(s, await readFile(`${source}/map-frame.json`)).lines).toHaveLength(2);
  expect(Math.cos(live.heading)).toBeGreaterThan(0.3);
  expect(Math.sin(live.heading)).toBeGreaterThan(0.95);
}, 30000);

it('keeps the full192m arch and both feet at every level, with all32recessed ports from district onward', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(`${runtime}/model.${name}.glb`),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
      ts = geometry(b),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBeCloseTo(192.0255, 1);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    expect(Math.max(...ps.map((p) => p.max[0]))).toBeGreaterThan(95.9);
    expect(Math.min(...ps.map((p) => p.min[0]))).toBeLessThan(-95.9);
    for (const x of [-91, 91])
      expect(nearest(ts, [x, 4, 20], [0, 0, -1]), `${name} steel foot`).toBeLessThan(15);
    expect(nearest(ts, [0, 20, 40], [0, 0, -1]), `${name} open arch span`).toBe(Infinity);
    for (const x of [-85, -70, -45, -12, 12, 45, 70, 85]) {
      const p = gatewaySection(x).corners[0],
        q = gatewaySection(x).corners[1],
        u = 0.22;
      const y = p[1] + (q[1] - p[1]) * u,
        z = p[2] + (q[2] - p[2]) * u,
        px = p[0] + (q[0] - p[0]) * u;
      expect(
        Math.abs(20 - nearest(ts, [px, y, 20], [0, 0, -1]) - z),
        `${name} weighted-catenary shell`,
      ).toBeLessThan(0.14);
    }
    if (name !== 'skyline') {
      const glass = g.meshes
        .flatMap((m) => m.primitives)
        .filter(
          (p) =>
            g.materials[p.material].name.includes('local-architectural') &&
            g.materials[p.material].pbrMetallicRoughness.roughnessFactor === 0.22,
        );
      expect(
        glass.reduce((sum, p) => sum + g.accessors[p.indices].count / 3, 0),
        `${name}16ports on each elevation`,
      ).toBe(64);
    }
  }
});
it('rebuilds exact four-level bytes within budgets with one canonical brushed stainless graph and separate GPU streams', async () => {
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
    ['metal_stainless'].map((n) => `matgraph:molen.worldgen.material.${n}`).sort(),
  );
}, 30000);
