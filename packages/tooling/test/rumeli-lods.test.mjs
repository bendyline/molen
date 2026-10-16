import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildRumeliRuntime,
  rumeliGroundHeight,
  rumeliParts,
  rumeliTowerBase,
} from '../../worldgen/scripts/rumeli-fortress-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sx/sxk/n0293_rumeli_hisar/map-frame.json',
      import.meta.url,
    ),
  ),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3 };
function mesh(level, part) {
  const t = [],
    o = { addTriangle: (s, _r, p, n) => t.push({ s, p, n }) };
  if (part) rumeliParts[part](o, levels[level]);
  else buildRumeliRuntime(o, level);
  return t;
}
function verticalHit(x, z, p) {
  const [a, b, c] = p,
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(den) < 1e-8) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den,
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001
    ? u * a[1] + v * b[1] + (1 - u - v) * c[1]
    : null;
}
function rayHit(origin, direction, p) {
  const sub = (a, b) => a.map((v, k) => v - b[k]),
    dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  const e1 = sub(p[1], p[0]),
    e2 = sub(p[2], p[0]),
    h = cross(direction, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(origin, p[0]),
    u = dot(q, h) / det,
    v = dot(direction, cross(q, e1)) / det;
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(e2, cross(q, e1)) / det;
}
it('builds byte-deterministic browser levels within budgets with shared surfaces and homogeneous GPU views', async () => {
  const id = 'molen.worldgen.structure.n0293_rumeli_hisar',
    bytes = [];
  for (const [level, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const generate = () => (level === 'skyline' ? authoredSkyline(id) : authoredDetail(id, level)),
      a = await generate(),
      b = await generate();
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.triangles).toBeLessThanOrEqual(cap);
    bytes.push(a.bytes.length);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12))),
      types = new Map();
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.length).toBeLessThanOrEqual(8);
    expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(
      level === 'skyline' ? 0 : level === 'district' ? 3 : 4,
    );
    for (const m of g.meshes)
      for (const p of m.primitives)
        for (const i of Object.values(p.attributes)) {
          const a = g.accessors[i];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
    for (const t of types.values()) expect(t.size).toBe(1);
  }
  expect(bytes[0] + bytes[1]).toBeLessThan(3_000_000);
});
it('preserves all three published tower heights and hollow upper courts at every level', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level, 'largeTowers');
    for (const tower of frame.controls.largeTowers) {
      const p = t.filter((t) =>
        t.p.every(
          (p) => Math.hypot(p[0] - tower.center[0], p[2] - tower.center[1]) <= tower.radius + 0.1,
        ),
      );
      expect(p.length).toBeGreaterThan(50);
      expect(Math.max(...p.flatMap((t) => t.p.map((p) => p[1])))).toBeCloseTo(
        rumeliTowerBase(tower) + tower.height,
        3,
      );
      const hits = p.map((t) => verticalHit(...tower.center, t.p)).filter((h) => h !== null);
      expect(Math.max(...hits)).toBeCloseTo(rumeliTowerBase(tower) + tower.height - 4, 3);
    }
  }
});
it('retains the twelve-sided lower Halil tower rather than rounding away its identity', () => {
  const tower = frame.controls.largeTowers.find((t) => t.baseSides === 12),
    base = rumeliTowerBase(tower);
  for (const level of Object.keys(levels)) {
    const normals = new Set();
    for (const t of mesh(level, 'largeTowers')) {
      if (
        t.s !== 'rubble' ||
        Math.abs(t.n[1]) > 0.001 ||
        !t.p.every((p) => p[1] >= base - 1e-4 && p[1] <= base + tower.stepHeight + 0.001)
      )
        continue;
      const c = t.p[0].map((_, k) => t.p.reduce((s, p) => s + p[k] / 3, 0)),
        r = [c[0] - tower.center[0], c[2] - tower.center[1]],
        len = Math.hypot(...r);
      if (
        len < tower.radius * 0.92 ||
        len > tower.radius + 0.05 ||
        (r[0] * t.n[0] + r[1] * t.n[2]) / len < 0.95
      )
        continue;
      normals.add([t.n[0], t.n[2]].map((v) => v.toFixed(4)).join(','));
    }
    expect(normals.size, level).toBe(12);
  }
});
it('leaves all five estimated gates physically clear at their authored levels', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level).filter((t) => t.s === 'rubble');
    for (const h of frame.controls.gates.filter((h) => h.minDetail <= levels[level])) {
      const len = Math.hypot(...h.axis),
        axis = h.axis.map((v) => v / len),
        n = [-axis[1], 0, axis[0]],
        base = rumeliGroundHeight(...h.center, level);
      for (const u of [0, -h.width * 0.2, h.width * 0.2]) {
        const c = [h.center[0] + axis[0] * u, base + h.height * 0.45, h.center[1] + axis[1] * u],
          p = c.map((v, k) => v - n[k] * h.depth);
        const hits = t
          .map((t) => rayHit(p, n, t.p))
          .filter((v) => v !== null && Math.abs(v - h.depth) < h.depth / 2 - 0.002);
        expect(hits, `${h.id} ${level} offset=${u}`).toHaveLength(0);
      }
    }
  }
});
it('uses the rendered terrain triangles for the ground sampler at each level', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level, 'terrain');
    expect(t.length).toBeGreaterThan(50);
    for (const tri of t.filter((_, i) => i % 11 === 0)) {
      const c = tri.p[0].map((_, k) => tri.p.reduce((s, p) => s + p[k] / 3, 0));
      expect(rumeliGroundHeight(c[0], c[2], level)).toBeCloseTo(c[1], 4);
    }
  }
});
