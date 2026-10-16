import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  aljaferiaParts,
  aljaferiaPlanPoint,
  buildAljaferiaRuntime,
} from '../../worldgen/scripts/aljaferia-palace-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ez/ezr/n0294_aljaferia/map-frame.json',
      import.meta.url,
    ),
  ),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3 };
const point = (x, y, z) => {
  const p = aljaferiaPlanPoint(x, z);
  return [p[0], y, p[1]];
};
function mesh(level, part) {
  const t = [],
    o = { addTriangle: (s, _r, p, n) => t.push({ s, p, n }) };
  if (part) aljaferiaParts[part](o, levels[level]);
  else buildAljaferiaRuntime(o, level);
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
    dot = (a, b) => a.reduce((v, x, k) => v + x * b[k], 0),
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
const direction = (x, z) => {
  const p = aljaferiaPlanPoint(x, z);
  return [p[0], 0, p[1]];
};
it('builds deterministic levels with no embedded images and within browser budgets', async () => {
  const id = 'molen.worldgen.structure.n0294_aljaferia',
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
      level === 'skyline' ? 0 : 6,
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
it('keeps all three mapped courts open from above at every level', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level);
    for (const [x, z] of [
      [-30, 0],
      [7, 7],
      [33, -17],
    ]) {
      const p = aljaferiaPlanPoint(x, z),
        hits = t.map((t) => verticalHit(...p, t.p)).filter((h) => h !== null);
      expect(hits.length).toBeGreaterThan(0);
      expect(Math.max(...hits), `${level} court ${x},${z}`).toBeLessThan(3.5);
    }
  }
});
it('preserves six hollow round-tower crowns and the26m Trovador at all levels', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level, 'roundTowers');
    for (const tower of frame.controls.roundTowers) {
      const q = aljaferiaPlanPoint(...tower.center),
        near = t.filter((t) =>
          t.p.every((p) => Math.hypot(p[0] - q[0], p[2] - q[1]) <= tower.radius + 0.03),
        );
      expect(near.length).toBeGreaterThan(30);
      expect(Math.max(...near.flatMap((t) => t.p.map((p) => p[1])))).toBeCloseTo(tower.height, 3);
      const hits = near.map((t) => verticalHit(...q, t.p)).filter((h) => h !== null);
      expect(Math.max(...hits)).toBeCloseTo(tower.height - 2.2, 3);
    }
    const tall = mesh(level, 'trovador');
    expect(Math.max(...tall.flatMap((t) => t.p.map((p) => p[1])))).toBe(26);
  }
});
it('leaves the mapped east portal clear through both curtain and court wall', () => {
  const g = frame.controls.entrance;
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level);
    for (const dz of [-0.55, 0, 0.55]) {
      const o = point(52, 2.2, g.center[1] + dz),
        dir = direction(-1, 0),
        hits = t.map((t) => rayHit(o, dir, t.p)).filter((v) => v !== null && v > 0 && v < 10);
      expect(hits, `${level} dz=${dz}`).toHaveLength(0);
    }
  }
});
it('opens Taifa front and backing apertures instead of filling their arches', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level, 'taifa').filter((t) => t.s === 'plaster');
    for (const dx of [-0.5, 0, 0.5]) {
      const o = point(7.05 + dx, 2, 0),
        dir = direction(0, -1),
        hits = t.map((t) => rayHit(o, dir, t.p)).filter((v) => v !== null && v > 5 && v < 9.1);
      expect(hits, `${level} dx=${dx}`).toHaveLength(0);
    }
  }
});
it('keeps parliament glazing visible after removing the duplicate court backing', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level),
      o = point(36, 5, -20),
      dir = direction(0, 1),
      hits = t
        .map((t) => ({ v: rayHit(o, dir, t.p), s: t.s }))
        .filter((t) => t.v !== null && t.v > 0)
        .sort((a, b) => a.v - b.v);
    expect(hits[0].s).toBe('glass');
    expect(hits[0].v).toBeCloseTo(17.16, 2);
  }
});

it('supports the southern tiled reception wing above its portico without an unmodeled wall gap', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level, 'taifa'),
      o = point(6, 6.8, 0),
      dir = direction(0, 1),
      hits = t
        .map((t) => ({ v: rayHit(o, dir, t.p), s: t.s }))
        .filter((t) => t.v !== null && t.v > 19 && t.v < 26)
        .sort((a, b) => a.v - b.v);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].s).toBe('brick');
    expect(hits[0].v).toBeCloseTo(20.4, 3);
  }
});
