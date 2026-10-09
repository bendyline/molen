import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildPembrokeRuntime,
  pembrokeParts,
} from '../../worldgen/scripts/pembroke-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gch/n0295_pembroke_castle/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  control = frame.controls,
  ground = control.platformY,
  levels = { skyline: 0, district: 1, street: 2, closeup: 3 };
function mesh(level, part) {
  const t = [],
    o = { addTriangle: (s, _r, p, n) => t.push({ s, p, n }) };
  if (part) pembrokeParts[part](o, levels[level]);
  else buildPembrokeRuntime(o, level);
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
    ],
    e1 = sub(p[1], p[0]),
    e2 = sub(p[2], p[0]),
    h = cross(direction, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(origin, p[0]),
    u = dot(q, h) / det,
    v = dot(direction, cross(q, e1)) / det;
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(e2, cross(q, e1)) / det;
}
it('builds deterministic browser levels with five shared graphs and homogeneous GPU views', async () => {
  const id = 'molen.worldgen.structure.n0295_pembroke_castle',
    sizes = [];
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
    sizes.push(a.bytes.length);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12))),
      types = new Map();
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.length).toBeLessThanOrEqual(7);
    expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(
      level === 'skyline' ? 0 : 5,
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
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
it('retains the25m tall16m body keep and recessed domed crown in every level', () => {
  const c = control.keep;
  for (const level of Object.keys(levels)) {
    const t = mesh(level, 'keep');
    expect(Math.max(...t.flatMap((t) => t.p.map((p) => p[1])))).toBeCloseTo(ground + 25, 3);
    const hits = t.map((t) => verticalHit(...c.center, t.p)).filter((h) => h !== null);
    expect(Math.max(...hits)).toBeCloseTo(ground + c.domeBase + c.domeRise, 3);
    expect(Math.max(...hits)).toBeLessThan(ground + 25);
    expect(
      Math.max(...t.filter((t) => t.s !== 'aggregate').flatMap((t) => t.p.map((p) => p[0]))) -
        c.center[0],
    ).toBeCloseTo(8 + (levels[level] >= 2 ? 0.13 : 0), 2);
  }
});
it('keeps both wards and all three northern halls physically open from above', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level);
    for (const [x, z] of [
      [10, 5],
      [-26, 24],
    ]) {
      const h = t.map((t) => verticalHit(x, z, t.p)).filter((h) => h !== null);
      expect(h.length).toBeGreaterThan(0);
      expect(Math.max(...h)).toBeLessThan(ground + 0.2);
    }
    for (const h of [...control.halls, control.westernHall]) {
      const [a, b] = h.north,
        l = Math.hypot(b[0] - a[0], b[1] - a[1]),
        q = [
          (a[0] + b[0]) / 2 - (((b[1] - a[1]) / l) * h.depth) / 2,
          (a[1] + b[1]) / 2 + (((b[0] - a[0]) / l) * h.depth) / 2,
        ],
        hits = t.map((t) => verticalHit(...q, t.p)).filter((h) => h !== null);
      expect(hits.length).toBeGreaterThan(0);
      expect(Math.max(...hits), `${level} ${h.id ?? 'western'}`).toBeLessThan(ground + 0.2);
    }
  }
});
it('keeps the oblique mapped gate passage clear through the complete wall assembly', () => {
  const h = control.gatehouse.portal,
    n = [-h.axis[1], h.axis[0]];
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level);
    for (const u of [-0.5, 0, 0.5]) {
      const o = [
          h.center[0] + n[0] * 10 + h.axis[0] * u,
          ground + 2.1,
          h.center[1] + n[1] * 10 + h.axis[1] * u,
        ],
        dir = [-n[0], 0, -n[1]],
        hits = t.map((t) => rayHit(o, dir, t.p)).filter((v) => v !== null && v > 0.05 && v < 19.5);
      expect(hits, `${level} ${u}`).toHaveLength(0);
    }
  }
});
it('opens the Wogan door through rock and masonry without sky gaps at its jambs', () => {
  const h = control.wogan;
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level),
      ray = (u, y) => {
        const o = [
            h.center[0] + h.normal[0] * 12 + h.axis[0] * u,
            y,
            h.center[1] + h.normal[1] * 12 + h.axis[1] * u,
          ],
          d = [-h.normal[0], 0, -h.normal[1]];
        return t.map((t) => rayHit(o, d, t.p)).filter((v) => v !== null && v > 0.05 && v < 18);
      };
    for (const u of [-0.5, 0, 0.5]) expect(ray(u, h.floorY + 1.4)).toHaveLength(0);
    for (const u of [-8, 8]) expect(ray(u, h.floorY + 1.4).length).toBeGreaterThan(0);
    for (const u of [-8, 0, 8]) expect(ray(u, ground - 0.1).length).toBeGreaterThan(0);
  }
});
it('retains roofless crowns on mapped wall towers and both offset gatehouse flanks', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level, 'gatehouse');
    for (const tower of control.gatehouse.towers.slice(0, 2)) {
      const hits = t.map((t) => verticalHit(...tower.center, t.p)).filter((h) => h !== null);
      expect(Math.max(...hits)).toBeCloseTo(ground + tower.height - 2.5, 3);
    }
    const gate = control.gatehouse,
      center = gate.inner.reduce((s, p) => s.map((v, k) => v + p[k] / gate.inner.length), [0, 0]),
      hits = t.map((t) => verticalHit(...center, t.p)).filter((h) => h !== null);
    expect(hits.every((h) => h < ground + 0.1)).toBe(true);
  }
});
