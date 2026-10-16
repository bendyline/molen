import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildEgeskovDormers,
  buildEgeskovRuntime,
  egeskovParts,
  egeskovPlanPoint,
} from '../../worldgen/scripts/egeskov-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const f = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u1/u1z/n0298_egeskov_castle/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  k = f.controls;
const levels = { skyline: 0, district: 1, street: 2, closeup: 3 };
const point = (x, y, z) => {
  const q = egeskovPlanPoint(x, z);
  return [q[0], y, q[1]];
};
function mesh(level, part) {
  const t = [],
    out = { addTriangle: (s, _r, p, n) => t.push({ s, p, n }) };
  if (part) egeskovParts[part](out, levels[level]);
  else buildEgeskovRuntime(out, level);
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
function rayHit(origin, d, p) {
  const sub = (a, b) => a.map((v, k) => v - b[k]),
    dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    e1 = sub(p[1], p[0]),
    e2 = sub(p[2], p[0]),
    h = cross(d, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(origin, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, e1)) / det;
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(e2, cross(q, e1)) / det;
}
it('reproduces four browser levels with shared graphs, homogeneous uploads and small initial downloads', async () => {
  const id = 'molen.worldgen.structure.n0298_egeskov_castle',
    bytes = [];
  for (const [level, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const build = () => (level === 'skyline' ? authoredSkyline(id) : authoredDetail(id, level)),
      a = await build(),
      b = await build();
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.triangles).toBeLessThanOrEqual(cap);
    bytes.push(a.bytes.length);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.length).toBeLessThanOrEqual(7);
    expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(
      level === 'skyline' ? 0 : 6,
    );
    const types = new Map();
    for (const m of g.meshes)
      for (const p of m.primitives)
        for (const i of Object.values(p.attributes)) {
          const a = g.accessors[i];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
    for (const s of types.values()) expect(s.size).toBe(1);
  }
  expect(bytes[0] + bytes[1]).toBeLessThan(3_000_000);
});
it('covers both longhouse roofs and the stair tower at every level', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level).filter((t) => t.s === 'tile');
    for (const [x, z] of [
      [-8, -12],
      [-4.8, -12],
      [-1, -12],
      [1, 10],
      [4.9, 10],
      [8, 10],
      [-14, -3],
      [-11, 2],
    ]) {
      const p = point(x, 0, z),
        hits = t.map((t) => verticalHit(p[0], p[2], t.p)).filter((v) => v !== null);
      expect(
        hits.some((y) => y >= k.mainEaveY),
        `${level} roof at ${[x, z]}`,
      ).toBe(true);
    }
  }
});
it('keeps both mapped wall passages open at floor height and the full route clear at head height', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level);
    for (const h of [k.castlePassage, k.gatePassage])
      for (const height of [0.1, 1.4]) {
        // The castle has a separate 0.28m entrance threshold; test the cut wall at
        // floor height, and all geometry (including that threshold) at head height.
        const walls = h === k.castlePassage ? mesh(level, 'main') : mesh(level, 'gate');
        const a = h.route[0],
          b = h.route.at(-1),
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          dx = (b[0] - a[0]) / len,
          dz = (b[1] - a[1]) / len,
          start = point(a[0] - dx * 8, h.baseY + height, a[1] - dz * 8),
          q = egeskovPlanPoint(dx, dz),
          hits = (height === 0.1 ? walls : t)
            .map((t) => rayHit(start, [q[0], 0, q[1]], t.p))
            .filter((v) => v !== null && v > 0.01 && v < len + 16);
        expect(hits, `${level} route ${h.mapWay} at floor + ${height}`).toHaveLength(0);
      }
  }
});
it('seats every dormer corner on the actual sloping tiled roof', () => {
  for (const d of [2, 3]) {
    const t = [];
    buildEgeskovDormers({ addTriangle: (s, _r, p, n) => t.push({ s, p, n }) }, d);
    for (const z of [-12, 8, 14])
      for (const x of [-8.75, -7.3])
        for (const zz of [z - 0.725, z + 0.725]) {
          const p = point(x, 0, zz),
            v = t
              .filter((t) => t.s === 'brick')
              .flatMap((t) => t.p)
              .filter((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.003),
            expected =
              k.mainEaveY +
              ((k.mainRidgeY - k.mainEaveY) * (x - k.roofBounds.x0)) /
                (k.ridgeX[0] - k.roofBounds.x0);
          expect(v.length).toBeGreaterThan(0);
          expect(Math.min(...v.map((p) => p[1]))).toBeCloseTo(expected - 0.08, 3);
        }
  }
});
it('keeps gatehouse glazing outside the physical arched opening', () => {
  const h = k.gatePassage,
    a = h.route[0],
    b = h.route.at(-1),
    center = a.map((v, i) => (v + b[i]) / 2),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    axis = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
    c = Math.cos(k.planAngleRadians),
    s = Math.sin(k.planAngleRadians),
    local = (p) => [p[0] * c - p[2] * s, p[0] * s + p[2] * c],
    radius = h.width / 2;
  for (const level of ['district', 'street', 'closeup']) {
    const panes = mesh(level, 'gate').filter((t) => t.s === 'glass');
    expect(panes.length).toBeGreaterThan(0);
    for (const t of panes)
      for (const p of [...t.p, [0, 1, 2].map((i) => t.p.reduce((sum, p) => sum + p[i], 0) / 3)]) {
        const q = local(p),
          u = (q[0] - center[0]) * axis[0] + (q[1] - center[1]) * axis[1],
          n = -(q[0] - center[0]) * axis[1] + (q[1] - center[1]) * axis[0];
        if (Math.abs(u) >= radius || Math.abs(n) >= 8 || p[1] <= h.baseY) continue;
        const arch = h.baseY + h.height - radius + Math.sqrt(radius * radius - u * u);
        expect(p[1], `${level} glazing intrudes into the mapped gate arch`).toBeGreaterThanOrEqual(
          arch,
        );
      }
  }
});
it('retains both flared copper tower profiles and the clock-tower spire in the skyline', () => {
  const t = mesh('skyline', 'towers')
    .filter((t) => t.s === 'patina')
    .flatMap((t) => t.p);
  for (const tower of k.towers) {
    const c = egeskovPlanPoint(...tower.center),
      v = t.filter((p) => Math.hypot(p[0] - c[0], p[2] - c[1]) < tower.radius + 1);
    expect(Math.max(...v.map((p) => p[1]))).toBeCloseTo(tower.eaveY + tower.helmRise, 4);
    expect(v.some((p) => Math.hypot(p[0] - c[0], p[2] - c[1]) > tower.radius + 0.2)).toBe(true);
  }
  expect(Math.max(...mesh('skyline', 'stair').flatMap((t) => t.p.map((p) => p[1])))).toBeCloseTo(
    k.stair.spireTopY,
    4,
  );
});
it('has upward exterior roof normals on every authored level', () => {
  for (const level of Object.keys(levels))
    for (const t of mesh(level).filter((t) => t.s === 'tile')) expect(t.n[1]).toBeGreaterThan(0);
});
it('faces north and south facade panes outward rather than into the wall', () => {
  const c = Math.cos(k.planAngleRadians),
    s = Math.sin(k.planAngleRadians),
    local = (p) => [p[0] * c - p[2] * s, p[0] * s + p[2] * c];
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level, 'main').filter((t) => t.s === 'glass');
    for (const z of [k.roofBounds.z0, k.roofBounds.z1]) {
      const panes = t.filter((t) => t.p.every((p) => Math.abs(local(p)[1] - z) < 0.1));
      expect(panes.length).toBeGreaterThan(0);
      for (const p of panes) {
        const normal = local([p.n[0], 0, p.n[2]]);
        expect(normal[1] * Math.sign(z)).toBeGreaterThan(0.9);
      }
    }
  }
});
it('keeps every clipped rear gate-wall triangle facing outside after Float32 rounding', () => {
  const p = k.gatehouse.outline,
    a = p[6],
    b = p[7],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    c = Math.cos(k.planAngleRadians),
    s = Math.sin(k.planAngleRadians),
    local = (p) => [p[0] * c - p[2] * s, p[0] * s + p[2] * c],
    expected = [-dz / len, dx / len];
  for (const level of ['district', 'street', 'closeup']) {
    const walls = mesh(level, 'gate').filter(
      (t) =>
        t.s === 'brick' &&
        t.p.every(
          (p) =>
            p[1] > k.gatehouse.baseY - 0.01 &&
            p[1] <= k.gatehouse.eaveY + 0.001 &&
            Math.abs((local(p)[0] - a[0]) * dz - (local(p)[1] - a[1]) * dx) / len < 0.003,
        ),
    );
    expect(walls.length).toBeGreaterThan(0);
    for (const t of walls) {
      const n = local([t.n[0], 0, t.n[2]]);
      expect(n[0] * expected[0] + n[1] * expected[1]).toBeGreaterThan(0.99);
    }
  }
});
