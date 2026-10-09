import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildWawelRuntime, wawelParts } from '../../worldgen/scripts/wawel-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2y/n0299_wawel_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3 };
function mesh(level, part) {
  const triangles = [],
    out = { addTriangle: (slot, _ref, points, normal) => triangles.push({ slot, points, normal }) };
  if (part) wawelParts[part](out, levels[level]);
  else buildWawelRuntime(out, level);
  return triangles;
}
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
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
function vertical(x, z, triangles) {
  return triangles
    .map((t) => ray([x, 100, z], [0, -1, 0], t.points))
    .filter((v) => v !== null && v > 0)
    .map((v) => 100 - v);
}
it('reproduces four browser levels with six shared graphs and homogeneous GPU attributes', async () => {
  const id = 'molen.worldgen.structure.n0299_wawel_castle',
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
    for (const values of types.values()) expect(values.size).toBe(1);
  }
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
it('keeps the mapped courtyard open to the sky at every detail level', () => {
  for (const level of Object.keys(levels)) {
    const roof = mesh(level).filter((t) => t.slot === 'tile' || t.slot === 'patina');
    for (const [x, z] of [
      [0, -30],
      [20, -25],
      [15, 8],
      [0, 12],
      [26, 15],
      [-10, -22],
    ])
      expect(vertical(x, z, roof), `${level} courtyard ${x},${z}`).toHaveLength(0);
  }
});
it('covers all principal palace roof wings at every detail level', () => {
  for (const level of Object.keys(levels)) {
    const roof = mesh(level, 'main').filter((t) => t.slot === 'tile');
    for (const [x, z] of [
      [-10, -52],
      [25, -49],
      [40, -20],
      [42, 16],
      [-28, -30],
      [-23, 10],
      [-20, 46],
      [-55, 5],
    ])
      expect(vertical(x, z, roof).length, `${level} roof ${x},${z}`).toBeGreaterThan(0);
  }
});
it('leaves both mapped entrance routes physically open in the three detailed levels', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const triangles = mesh(level);
    for (const control of [frame.controls.gate, frame.controls.southPassage])
      for (let i = 1; i < control.route.length; i++) {
        const a = control.route[i - 1],
          b = control.route[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          direction = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
        const origin = [a[0] + direction[0] * 0.1, control.baseY + 1.7, a[1] + direction[2] * 0.1];
        const hits = triangles
          .map((t) => ray(origin, direction, t.points))
          .filter((v) => v !== null && v > 0.02 && v < len - 0.2);
        expect(hits, `${level} passage ${control.mapWay} segment ${i}`).toHaveLength(0);
      }
  }
});
it('keeps the lower gallery archways empty ahead of the recessed room walls', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const triangles = mesh(level);
    for (const g of frame.controls.galleries.slice(0, 3)) {
      const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]),
        u = g.b.map((v, i) => (v - g.a[i]) / len);
      let n = [-u[1], u[0]];
      if (dot(n, g.inward) < 0) n = n.map((v) => -v);
      const x = (len / g.bays) * 0.5,
        origin = [g.a[0] + u[0] * x + n[0] * 0.5, 12.4, g.a[1] + u[1] * x + n[1] * 0.5],
        direction = [-n[0], 0, -n[1]];
      const hits = triangles
        .map((t) => ray(origin, direction, t.points))
        .filter((v) => v !== null && v > 0 && v < 2.3);
      expect(hits, `${level} gallery ${g.key}`).toHaveLength(0);
    }
  }
});
it('points copper helm and roof normals toward their visible exteriors', () => {
  for (const level of Object.keys(levels))
    for (const t of mesh(level, 'towers')) {
      if (t.slot === 'patina') {
        const center = [0, 2].map((i) => t.points.reduce((s, p) => s + p[i], 0) / 3);
        const tower = frame.controls.cornerTowers.find(
          (t) => Math.hypot(center[0] - t.center[0], center[1] - t.center[1]) < 7,
        );
        if (tower)
          expect(
            dot(t.normal, [center[0] - tower.center[0], 0, center[1] - tower.center[1]]),
          ).toBeGreaterThan(0);
      }
      if (t.slot === 'tile') expect(t.normal[1]).toBeGreaterThanOrEqual(-1e-5);
    }
});
it('preserves the mapped Senator tower height and a supported terrace section', () => {
  const t = mesh('closeup', 'towers').filter(
    (t) => t.slot === 'tile' && t.points.every((p) => p[2] > 35),
  );
  expect(Math.max(...t.flatMap((t) => t.points.map((p) => p[1])))).toBeCloseTo(39, 4);
  const all = mesh('closeup');
  expect(Math.min(...all.flatMap((t) => t.points.map((p) => p[1])))).toBe(0);
  const foundation = mesh('closeup', 'main').filter(
    (t) => t.slot === 'stone' && t.points.some((p) => p[1] === 0),
  );
  expect(foundation.length).toBeGreaterThan(100);
});
