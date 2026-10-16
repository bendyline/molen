import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildKalmarRuntime,
  kalmarParts,
  kalmarPlanPoint,
} from '../../worldgen/scripts/kalmar-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u6/u65/n0296_kalmar_castle/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  control = frame.controls,
  levels = { skyline: 0, district: 1, street: 2, closeup: 3 },
  point = (x, y, z) => {
    const q = kalmarPlanPoint(x, z);
    return [q[0], y, q[1]];
  },
  direction = (x, z) => {
    const q = kalmarPlanPoint(x, z);
    return [q[0], 0, q[1]];
  };
function mesh(level, part) {
  const t = [],
    out = { addTriangle: (s, _r, p, n) => t.push({ s, p, n }) };
  if (part) kalmarParts[part](out, levels[level]);
  else buildKalmarRuntime(out, level);
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
it('builds deterministic shared-material levels within all four browser budgets', async () => {
  const id = 'molen.worldgen.structure.n0296_kalmar_castle',
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
it('preserves the courtyard as a physical hole below all four palace roofs', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level);
    for (const [x, z] of [
      [0, 0],
      [5, 12],
      [8, -10],
      [-4, 5],
    ]) {
      const q = kalmarPlanPoint(x, z),
        hits = t.map((t) => verticalHit(...q, t.p)).filter((v) => v !== null);
      expect(hits.length).toBeGreaterThan(0);
      expect(Math.max(...hits), `${level} court ${x},${z}`).toBeLessThan(control.platformY + 0.05);
    }
  }
});
it('covers the mapped eastern and northern wings with an upward-facing roof', () => {
  for (const level of Object.keys(levels)) {
    const roof = mesh(level, 'roofs').filter((t) => t.s === 'metal' && t.n[1] > 0);
    for (const [x, z] of [
      [32, -15],
      [32, 0],
      [31, 15],
      [-5, -36],
      [6, 31],
    ]) {
      const q = kalmarPlanPoint(x, z),
        hits = roof.map((t) => verticalHit(...q, t.p)).filter((v) => v !== null);
      expect(hits.length, `${level} missing roof at ${x},${z}`).toBeGreaterThan(0);
      expect(Math.max(...hits)).toBeGreaterThanOrEqual(control.platformY + control.eaveHeight);
    }
  }
});
it('leaves the old Kuretornet entrance clear through the complete castle mass', () => {
  const h = control.kure.portal,
    n = [-h.axis[1], h.axis[0]];
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level);
    for (const u of [-0.5, 0, 0.5]) {
      const p = point(
          h.center[0] + n[0] * 19 + h.axis[0] * u,
          control.platformY + 2.1,
          h.center[1] + n[1] * 19 + h.axis[1] * u,
        ),
        dir = direction(-n[0], -n[1]),
        hits = t.map((t) => rayHit(p, dir, t.p)).filter((v) => v !== null && v > 0.5 && v < 36.8);
      expect(hits, `${level} offset ${u}`).toHaveLength(0);
    }
  }
});
it('does not fill the bent western fort tunnel with overlapping aperture returns', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level, 'defenses'),
      q = control.gateRoute;
    for (let i = 0; i < q.length - 1; i++) {
      const a = q[i],
        b = q[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dir = direction((b[0] - a[0]) / len, (b[1] - a[1]) / len),
        hits = t
          .map((t) => rayHit(point(a[0], control.platformY + 1.6, a[1]), dir, t.p))
          .filter((v) => v !== null && v > 0.05 && v < len - 0.05);
      expect(hits, `${level} tunnel segment ${i}`).toHaveLength(0);
    }
  }
});
it('keeps the four copper helmet profiles flared below their narrow finials', () => {
  for (const level of Object.keys(levels))
    for (const tower of control.towers) {
      const center = kalmarPlanPoint(...tower.center),
        roof = mesh(level, 'towers').filter(
          (t) =>
            t.s === 'patina' &&
            t.p.every((p) => Math.hypot(p[0] - center[0], p[2] - center[1]) < tower.radius * 1.18),
        ),
        vertices = roof.flatMap((t) => t.p),
        base = control.platformY + tower.height;
      expect(vertices.length).toBeGreaterThan(20);
      expect(
        Math.max(...vertices.map((p) => Math.hypot(p[0] - center[0], p[2] - center[1]))),
      ).toBeGreaterThan(tower.radius * 1.08);
      expect(Math.max(...vertices.map((p) => p[1]))).toBeGreaterThan(base + tower.roofRise * 0.9);
      const top = Math.max(...vertices.map((p) => p[1]));
      expect(
        Math.max(
          ...vertices
            .filter((p) => p[1] > top - 0.01)
            .map((p) => Math.hypot(p[0] - center[0], p[2] - center[1])),
        ),
      ).toBeLessThan(tower.radius * 0.08);
    }
});
it('keeps low cannon-tower windows below their roofs and the western lantern open', () => {
  for (const level of ['street', 'closeup']) {
    const fort = mesh(level, 'defenses').filter((t) => t.s === 'glass'),
      max = Math.max(...fort.flatMap((t) => t.p.map((p) => p[1])));
    expect(fort.length).toBeGreaterThan(0);
    expect(max).toBeLessThan(Math.max(...control.bastions.map((t) => t.baseY + t.height)));
  }
  for (const level of ['district', 'street', 'closeup']) {
    const p = control.kure.outline.slice(0, -1),
      center = [0, 1].map((k) => p.reduce((v, q) => v + q[k], 0) / p.length),
      y = control.platformY + control.kure.height + 10.5,
      t = mesh(level, 'kure'),
      dir = direction(1, 0),
      hits = t
        .map((t) => rayHit(point(center[0] - 2.4, y, center[1]), dir, t.p))
        .filter((v) => v !== null && v > 0 && v < 4.8);
    expect(hits, `${level} lantern void`).toHaveLength(0);
  }
});

it('keeps copper roof-cap undersides facing outward so backface culling cannot hide them', () => {
  const p = control.kure.outline.slice(0, -1),
    kureCenter = [0, 1].map((k) => p.reduce((v, q) => v + q[k], 0) / p.length),
    caps = [
      { part: 'kure', center: kureCenter, base: control.platformY + control.kure.height + 12.8 },
      ...control.towers.map((t) => ({
        part: 'towers',
        center: t.center,
        base: control.platformY + t.height + t.roofRise * (t.kind === 'low-bulb' ? 0.64 : 0.65),
        radius: t.radius,
      })),
    ];
  for (const level of Object.keys(levels)) {
    let downward = 0;
    for (const cap of caps) {
      const center = kalmarPlanPoint(...cap.center),
        roof = mesh(level, cap.part).filter(
          (t) =>
            t.s === 'patina' &&
            t.p.every((p) => p[1] >= cap.base - 0.001) &&
            (!cap.radius ||
              t.p.every((p) => Math.hypot(p[0] - center[0], p[2] - center[1]) < cap.radius)) &&
            Math.hypot(t.n[0], t.n[2]) > 0.1,
        );
      expect(roof.length).toBeGreaterThan(0);
      for (const t of roof) {
        const x = t.p.reduce((v, p) => v + p[0], 0) / 3 - center[0],
          z = t.p.reduce((v, p) => v + p[2], 0) / 3 - center[1];
        expect(t.n[0] * x + t.n[2] * z, `${level} ${cap.part} cap side`).toBeGreaterThan(0);
        if (t.n[1] < -0.01) downward++;
      }
    }
    if (level !== 'skyline') expect(downward, `${level} flared undersides`).toBeGreaterThan(0);
  }
});
