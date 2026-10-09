import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildSaintMichaelRuntime,
  saintMichaelParts,
} from '../../worldgen/scripts/saint-michaels-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ud/udt/n0300_saint_michael_s_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3 },
  a = frame.controls.planAngleRadians,
  ca = Math.cos(a),
  sa = Math.sin(a);
const native = (p) => [ca * p[0] + sa * p[2], p[1], -sa * p[0] + ca * p[2]];
function mesh(level, part) {
  const t = [],
    o = { addTriangle: (slot, _ref, p, normal) => t.push({ slot, p, normal }) };
  if (part) saintMichaelParts[part](o, levels[level]);
  else buildSaintMichaelRuntime(o, level);
  return t;
}
const subtract = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function ray(origin, direction, p) {
  const e1 = subtract(p[1], p[0]),
    e2 = subtract(p[2], p[0]),
    h = cross(direction, e2),
    den = dot(e1, h);
  if (Math.abs(den) < 1e-8) return null;
  const q = subtract(origin, p[0]),
    u = dot(q, h) / den,
    v = dot(direction, cross(q, e1)) / den;
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(e2, cross(q, e1)) / den;
}
const roofHits = (x, z, t) => {
  const p = native([x, 100, z]);
  return t
    .map((t) => ray(p, [0, -1, 0], t.p))
    .filter((v) => v !== null && v > 0)
    .map((v) => 100 - v);
};
it('builds deterministic browser levels within budgets with six reusable graphs and consistent GPU layout', async () => {
  const id = 'molen.worldgen.structure.n0300_saint_michael_s_castle',
    sizes = [];
  for (const [level, limit] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const build = () => (level === 'skyline' ? authoredSkyline(id) : authoredDetail(id, level)),
      a = await build(),
      b = await build();
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.triangles).toBeLessThanOrEqual(limit);
    sizes.push(a.bytes.length);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.length).toBeLessThanOrEqual(7);
    expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(
      level === 'skyline' ? 0 : 6,
    );
    const types = new Map();
    for (const m of g.meshes)
      for (const p of m.primitives)
        for (const ix of Object.values(p.attributes)) {
          const accessor = g.accessors[ix];
          if (!types.has(accessor.bufferView)) types.set(accessor.bufferView, new Set());
          types.get(accessor.bufferView).add(accessor.componentType);
        }
    for (const v of types.values()) expect(v.size).toBe(1);
  }
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
it('keeps the main octagonal courtyard and both triangular service courts open at every level', () => {
  for (const l of Object.keys(levels)) {
    const roof = mesh(l).filter((t) => t.slot === 'painted' || t.slot === 'copper');
    for (const [x, z] of [
      [7, 0],
      [-10, 10],
      [16, 20],
      [41, -31],
      [-28, -24],
    ])
      expect(roofHits(x, z, roof), `${l} court ${x},${z}`).toHaveLength(0);
  }
});
it('covers each principal roof wing with upward-facing geometry at every level', () => {
  for (const l of Object.keys(levels)) {
    const roof = mesh(l, 'main').filter((t) => t.slot === 'painted');
    for (const [x, z] of [
      [-36, -42],
      [5, -42],
      [51, -20],
      [47, 40],
      [5, 48],
      [-35, 30],
    ])
      expect(roofHits(x, z, roof).length, `${l} wing ${x},${z}`).toBeGreaterThan(0);
    for (const t of roof) expect(t.normal[1]).toBeGreaterThan(0);
  }
});
it('leaves the separately mapped south passage physically open at head and near-floor height', () => {
  for (const l of ['district', 'street', 'closeup'])
    for (const h of [0.1, 1.7]) {
      const t = mesh(l);
      for (let i = 1; i < frame.controls.gate.route.length; i++) {
        const a = frame.controls.gate.route[i - 1],
          b = frame.controls.gate.route[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          d = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
          o = [a[0] + d[0] * 0.1, h, a[1] + d[2] * 0.1];
        const hits = t
          .map((t) => ray(o, d, t.p))
          .filter((v) => v !== null && v > 0.02 && v < len - 0.2);
        expect(hits, `${l} passage${i} Y${h}`).toHaveLength(0);
      }
    }
});
it('retains outward visible wall faces on all four façades', () => {
  const samples = [
    [-46, 12, 30, -1, 0],
    [60, 12, 30, 1, 0],
    [45, 12, -51, 0, -1],
    [45, 12, 55, 0, 1],
  ];
  for (const l of Object.keys(levels))
    for (const [x, y, z, dx, dz] of samples) {
      const t = mesh(l, 'main'),
        n = native([dx, 0, dz]),
        o = native([x + dx * 10, y, z + dz * 10]),
        d = n.map((v) => -v);
      const hits = t
        .map((t) => ({ t, v: ray(o, d, t.p) }))
        .filter(({ v }) => v !== null && v > 5 && v < 15);
      expect(hits.length, `${l} wall ${x},${z}`).toBeGreaterThan(0);
      for (const { t } of hits) expect(dot(t.normal, n)).toBeGreaterThan(0.8);
    }
});
it('retains the estimated church spire, separate river dome, and declared ground attachment', () => {
  for (const l of Object.keys(levels)) {
    const t = mesh(l),
      ys = t.flatMap((t) => t.p.map((p) => p[1]));
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBeCloseTo(frame.controls.church.crossTopY, 4);
    const domes = mesh(l, 'domes').filter((t) => t.slot === 'copper');
    for (const c of [frame.controls.church, frame.controls.river])
      expect(roofHits(c.center[0] + c.domeRadius * 0.8, c.center[1], domes).length).toBeGreaterThan(
        0,
      );
  }
});
