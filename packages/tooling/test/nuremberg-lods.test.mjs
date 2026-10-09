import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildNurembergRuntime,
  nurembergParts,
} from '../../worldgen/scripts/nuremberg-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u0z/n0297_nuremberg_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
const control = frame.controls,
  levels = { skyline: 0, district: 1, street: 2, closeup: 3 };
function mesh(level, part) {
  const t = [],
    out = { addTriangle: (s, _r, p, n) => t.push({ s, p, n }) };
  if (part) nurembergParts[part](out, levels[level]);
  else buildNurembergRuntime(out, level);
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

it('builds repeatable shared-material levels within all four browser budgets', async () => {
  const id = 'molen.worldgen.structure.n0297_nuremberg_castle',
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
it('keeps the documented Sinwell plinth-to-weather-vane height at 41 metres', () => {
  const t = control.towers.find((t) => t.key === 'sinwell');
  for (const level of Object.keys(levels)) {
    const p = mesh(level, 'towers')
      .flatMap((t) => t.p)
      .filter((p) => Math.hypot(p[0] - t.center[0], p[2] - t.center[1]) < t.radius * 1.3);
    expect(Math.min(...p.map((p) => p[1]))).toBeCloseTo(t.baseY, 3);
    expect(Math.max(...p.map((p) => p[1])) - t.baseY).toBeCloseTo(41, 3);
  }
});
it('preserves an open imperial courtyard beneath every roof level', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level);
    for (const [x, z] of [
      [0, 5],
      [3, 12],
      [7, 5],
      [-3, 9],
    ]) {
      const hits = t.map((t) => verticalHit(x, z, t.p)).filter((v) => v !== null);
      expect(hits.length).toBeGreaterThan(0);
      expect(Math.max(...hits), `${level} court ${x},${z}`).toBeLessThan(
        control.innerCourt.y + 0.05,
      );
    }
  }
});
it('keeps all three mapped gate passages clear across their complete cutting envelopes', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level);
    for (const h of control.portals) {
      const axis = [-h.axis[1], h.axis[0]],
        half = h.depth / 2 + 1.5;
      for (const u of [-0.5, 0, 0.5]) {
        const origin = [
            h.center[0] - axis[0] * half + h.axis[0] * u,
            h.baseY + 2,
            h.center[1] - axis[1] * half + h.axis[1] * u,
          ],
          direction = [axis[0], 0, axis[1]];
        const hits = t
          .map((t) => rayHit(origin, direction, t.p))
          .filter((v) => v !== null && v > 0.1 && v < 2 * half - 0.1);
        expect(hits, `${level} ${h.key} offset ${u}`).toHaveLength(0);
      }
    }
  }
});
it('seats the stables dormer walls on the sloped roof rather than a raised flat base', () => {
  const b = control.buildings.find((b) => b.key === 'imperial-stables'),
    rf = b.roofFrame,
    axis = rf.axis.map((v) => v / Math.hypot(...rf.axis)),
    across = [-axis[1], axis[0]],
    ring = b.outline.slice(0, -1),
    vs = ring.map((p) => p[0] * across[0] + p[1] * across[1]),
    lo = Math.min(...vs),
    hi = Math.max(...vs),
    eave = b.baseY + b.eaveHeight;
  const floor = (p) =>
    eave +
    b.roofRise *
      Math.min(
        (p[0] * across[0] + p[2] * across[1] - lo) / ((hi - lo) / 2),
        (hi - p[0] * across[0] - p[2] * across[1]) / ((hi - lo) / 2),
      );
  for (const level of ['district', 'street', 'closeup']) {
    const buildingMesh = mesh(level, 'buildings'),
      roofs = buildingMesh.filter((t) => t.s === 'tile' && t.n[1] > 0),
      sides = buildingMesh.filter(
        (t) =>
          t.s === 'plaster' &&
          Math.abs(t.n[1]) < 0.01 &&
          Math.abs(t.n[0] * axis[0] + t.n[2] * axis[1]) > 0.9 &&
          t.p.every((p) => p[0] > 145 && p[1] > eave + 0.5),
      );
    expect(sides.length).toBeGreaterThan(20);
    for (const t of sides) {
      expect(Math.min(...t.p.map((p) => p[1] - floor(p))), `${level} dormer contact`).toBeCloseTo(
        -0.08,
        3,
      );
      for (const p of t.p.filter((p) => Math.abs(p[1] - floor(p) + 0.08) < 0.001)) {
        const hits = roofs.map((t) => verticalHit(p[0], p[2], t.p)).filter((y) => y !== null);
        expect(
          hits.some((y) => Math.abs(y - floor(p)) < 0.001),
          `${level} dormer foot outside physical roof at ${p[0]},${p[2]}`,
        ).toBe(true);
      }
    }
  }
});
it('keeps exterior roof surfaces facing up and Sinwell helm sides facing out', () => {
  const tower = control.towers.find((t) => t.key === 'sinwell');
  for (const level of Object.keys(levels)) {
    const t = mesh(level).filter((t) => t.s === 'tile');
    expect(t.length).toBeGreaterThan(100);
    for (const tri of t) expect(tri.n[1]).toBeGreaterThanOrEqual(-1e-6);
    for (const tri of mesh(level, 'towers').filter(
      (t) =>
        t.s === 'tile' &&
        Math.hypot(t.n[0], t.n[2]) > 0.1 &&
        t.p.every(
          (p) => Math.hypot(p[0] - tower.center[0], p[2] - tower.center[1]) < tower.radius * 1.3,
        ),
    )) {
      const x = tri.p.reduce((v, p) => v + p[0], 0) / 3 - tower.center[0],
        z = tri.p.reduce((v, p) => v + p[2], 0) / 3 - tower.center[1];
      expect(tri.n[0] * x + tri.n[2] * z).toBeGreaterThan(0);
    }
  }
});
it('closes hip-roof wall edges at every active slope change', () => {
  const structures = [
    ...control.buildings.filter((b) => b.roof === 'hip'),
    ...control.towers.filter((t) => t.kind !== 'round'),
  ];
  for (const level of ['district', 'street', 'closeup']) {
    const t = mesh(level);
    for (const b of structures) {
      const p = b.outline.slice(0, -1),
        axis = b.roofFrame.axis.map((v) => v / Math.hypot(...b.roofFrame.axis)),
        across = [-axis[1], axis[0]],
        project = (q, a) => q[0] * a[0] + q[1] * a[1],
        us = p.map((q) => project(q, axis)),
        vs = p.map((q) => project(q, across)),
        loU = Math.min(...us),
        hiU = Math.max(...us),
        loV = Math.min(...vs),
        hiV = Math.max(...vs),
        half = (hiV - loV) / 2,
        eave = b.baseY + (b.eaveHeight ?? b.height - b.roofRise),
        sign = Math.sign(
          p.reduce((n, a, i) => {
            const b = p[(i + 1) % p.length];
            return n + a[0] * b[1] - b[0] * a[1];
          }, 0),
        );
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          c = p[(i + 1) % p.length],
          len = Math.hypot(c[0] - a[0], c[1] - a[1]),
          normal = [(sign * (c[1] - a[1])) / len, (-sign * (c[0] - a[0])) / len];
        for (const u of [0.1, 0.25, 0.5, 0.75, 0.9]) {
          const q = a.map((v, k) => v + (c[k] - v) * u),
            height =
              b.roofRise *
              Math.min(
                (project(q, axis) - loU) / half,
                (hiU - project(q, axis)) / half,
                (project(q, across) - loV) / half,
                (hiV - project(q, across)) / half,
              );
          if (height < 0.03) continue;
          const origin = [q[0] + normal[0] * 0.2, eave + height * 0.45, q[1] + normal[1] * 0.2],
            direction = [-normal[0], 0, -normal[1]],
            hits = t
              .map((t) => rayHit(origin, direction, t.p))
              .filter((h) => h !== null && h > 0.1 && h < 0.3);
          expect(
            hits.length,
            `${level} ${b.key} roof-wall gap at edge ${i} offset ${u}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  }
});
it('supports the eastern buildings and towers beneath their declared plinths', () => {
  for (const level of Object.keys(levels)) {
    const t = mesh(level);
    for (const b of [...control.buildings, ...control.towers].filter(
      (b) => b.foundationBaseY !== undefined,
    )) {
      const p = b.outline.slice(0, -1),
        a = p[0],
        c = p[1],
        sign = Math.sign(
          p.reduce((n, a, i) => {
            const b = p[(i + 1) % p.length];
            return n + a[0] * b[1] - b[0] * a[1];
          }, 0),
        ),
        len = Math.hypot(c[0] - a[0], c[1] - a[1]),
        normal = [(sign * (c[1] - a[1])) / len, (-sign * (c[0] - a[0])) / len],
        origin = [(a[0] + c[0]) / 2 + normal[0], b.baseY - 0.2, (a[1] + c[1]) / 2 + normal[1]],
        direction = [-normal[0], 0, -normal[1]],
        hits = t
          .map((t) => rayHit(origin, direction, t.p))
          .filter((h) => h !== null && h > 0.1 && h < 2.5);
      expect(hits.length, `${level} ${b.key} unsupported plinth`).toBeGreaterThan(0);
    }
  }
});
