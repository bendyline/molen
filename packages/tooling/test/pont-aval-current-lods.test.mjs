import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import {
  pontAvalDepth,
  pontAvalPlan,
  pontAvalRoadY,
} from '../../worldgen/scripts/pont-aval-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u09/n0026_pont_aval'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p));
const nearest = (ts, o, d) =>
  Math.min(...ts.map((p) => hit(o, d, p)).filter((t) => t !== null && t > 0));
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

it('retains continuous curved road slabs, four separate boxes and outward-facing piers', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    for (const u of [
      -156,
      (-156.25 - 88.78) / 2,
      (-88.78 + 3.22) / 2,
      (3.22 + 84.7) / 2,
      (84.7 + 156.25) / 2,
      156,
    ]) {
      const [x, z] = pontAvalPlan(u, -6.5),
        y = 30 - nearest(ts, [x, 30, z], [0, -1, 0]);
      expect(Math.abs(y - pontAvalRoadY(u, -6.5)), name + ' road ' + u).toBeLessThan(0.06);
    }
    for (const zc of [-12.5, -4.5, 4.5, 12.5]) {
      const [x, z] = pontAvalPlan(43.96, zc),
        y = 4 + nearest(ts, [x, 4, z], [0, 1, 0]);
      expect(y, name + ' separate box ' + zc).toBeCloseTo(
        pontAvalRoadY(43.96, zc) - pontAvalDepth(43.96),
        3,
      );
    }
    for (const zc of [-8.5, 0, 8.5]) {
      const [x, z] = pontAvalPlan(43.96, zc),
        y = 4 + nearest(ts, [x, 4, z], [0, 1, 0]);
      expect(y, name + ' open gap ' + zc).toBeGreaterThan(13.5);
    }
    const [x, z] = pontAvalPlan(-98.78, -12.5),
      d = nearest(ts, [x, 4, z], [1, 0, 0]);
    expect(d, name + ' outward pier face').toBeGreaterThan(7);
    expect(d).toBeLessThan(10);
  }
});
it('preserves the detailed master, signed mapped plan and archival vertical controls', async () => {
  const s = await read(source + '/spec.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.sourceFacts.spanControlWestToEastMeters).toEqual([67.47, 92, 81.48, 71.55]);
  expect(p.anchor).toEqual([2.264339604, 48.834900398]);
  expect(p.heading).toBe(-0.063240259176);
  expect(p.datum).toBe('sea-level');
  expect(p.elevation).toBe(26.34);
  expect(p.replaceRoads.deckHeights).toEqual([12.86, 16.41]);
  expect(p.replaceRoads.outline).toHaveLength(130);
});
it('reproduces four independently authored budgeted levels with canonical shared surfaces', async () => {
  const a = await read(runtime + '/asset.json');
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(runtime + '/' + l.file),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) refs.add(m.extras.molenSurface.ref);
  }
  expect([...refs].sort()).toEqual(
    ['concrete_plain', 'stone_granite', 'metal_painted', 'metal_stainless']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
