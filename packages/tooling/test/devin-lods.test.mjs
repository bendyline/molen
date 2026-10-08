import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { prepareOpening } from '../../worldgen/scripts/authored-wall-openings.mjs';
import {
  buildDevinRuntime,
  devinGroundHeight,
} from '../../worldgen/scripts/devin-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2s/n0292_devin_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
function triangles(level) {
  const out = [];
  buildDevinRuntime({ addTriangle: (s, _r, p, n) => out.push({ s, p, n }) }, level);
  return out;
}
function ray(x, z, p) {
  const [a, b, c] = p,
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(den) < 1e-9) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den,
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001
    ? u * a[1] + v * b[1] + (1 - u - v) * c[1]
    : null;
}
it('builds deterministic browser levels with reusable graphs and homogeneous GPU views', async () => {
  const id = 'molen.worldgen.structure.n0292_devin_castle',
    bytes = [];
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const generate = () => (name === 'skyline' ? authoredSkyline(id) : authoredDetail(id, name)),
      a = await generate(),
      b = await generate();
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.triangles).toBeLessThanOrEqual(cap);
    bytes.push(a.bytes.length);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12))),
      types = new Map();
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials).toHaveLength(name === 'skyline' ? 1 : 5);
    if (name !== 'skyline') {
      expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(4);
      for (const m of g.materials.filter((m) => m.extras?.molenSurface))
        expect(['wall', 'foundation']).toContain(m.extras.molenSurface.slot);
    }
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
it('keeps the independently mapped small Maiden Tower hollow and to the published dimensions', () => {
  const c = frame.controls.maiden;
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const t = triangles(level).filter((t) => t.s === 'brick'),
      p = t.flatMap((t) => t.p);
    expect(t.length).toBeGreaterThan(30);
    expect(Math.min(...p.map((p) => p[1]))).toBeCloseTo(c.base, 4);
    expect(Math.max(...p.map((p) => p[1])) - c.base).toBeCloseTo(4.88, 4);
    expect(
      Math.max(...p.map((p) => Math.hypot(p[0] - c.center[0], p[2] - c.center[1]))),
    ).toBeCloseTo(1.4, 4);
    expect(t.map((t) => ray(...c.center, t.p)).filter((v) => v !== null)).toHaveLength(0);
  }
});
it('keeps the upper court roofless and its cliff support below the ruin walls at every level', () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const t = triangles(level),
      x = -196,
      z = -133,
      ground = devinGroundHeight(x, z),
      hits = t.map((t) => ray(x, z, t.p)).filter((v) => v !== null);
    expect(ground).toBe(72);
    expect(Math.max(...hits)).toBeLessThanOrEqual(72.002);
    expect(t.some((t) => t.s === 'rubble' && t.p.some((p) => p[1] > 77))).toBe(true);
  }
});
it('seats approach-wall bottoms on rendered cliff triangles rather than detached height overrides', () => {
  const t = triangles('closeup'),
    f = frame.geometry.wallFeatures.find((f) => f.way === 721570678);
  for (const [x, z] of f.points) {
    const y = devinGroundHeight(x, z);
    expect(
      t.some(
        (t) =>
          t.s === 'rubble' &&
          t.p.some((p) => Math.hypot(p[0] - x, p[2] - z) < 0.8 && Math.abs(p[1] - y) < 0.01),
      ),
    ).toBe(true);
  }
});
const apertures = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2s/n0292_devin_castle/openings.json',
      import.meta.url,
    ),
  ),
);
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
  if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) return null;
  return dot(e2, cross(q, e1)) / det;
}
it('leaves the five mapped passages and six main window openings geometrically clear at their authored levels', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const detail = { district: 1, street: 2, closeup: 3 }[level],
      mesh = triangles(level).filter((t) => t.s === 'rubble');
    for (const h of apertures.openings.filter((h) => h.minDetail <= detail)) {
      const l = Math.hypot(...h.axis),
        axis = h.axis.map((v) => v / l),
        n = [-axis[1], 0, axis[0]];
      const base = devinGroundHeight(...h.center);
      for (const u of [0, -h.width * 0.2, h.width * 0.2]) {
        const c = [
          h.center[0] + axis[0] * u,
          base + (h.bottom ?? 0) + h.height * 0.45,
          h.center[1] + axis[1] * u,
        ];
        const p = c.map((v, k) => v - n[k] * h.depth);
        const hits = mesh
          .map((t) => rayHit(p, n, t.p))
          .filter((t) => t !== null && Math.abs(t - h.depth) < h.depth / 2 - 0.002);
        expect(hits, `${h.id} ${level} u=${u}`).toHaveLength(0);
      }
    }
  }
});
it('keeps the grass mesh inside the mapped site rather than filling the surrounding rectangle', () => {
  const inside = (p) => {
    let hit = false;
    const ring = frame.geometry.outline;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        hit = !hit;
    }
    return hit;
  };
  const distance = (p) =>
    Math.min(
      ...frame.geometry.outline.map((a, i) => {
        const b = frame.geometry.outline[(i + 1) % frame.geometry.outline.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          l = dx * dx + dz * dz,
          t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0;
        return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
      }),
    );
  for (const t of triangles('closeup').filter((t) => t.s === 'foliage')) {
    const p = [t.p.reduce((s, p) => s + p[0], 0) / 3, t.p.reduce((s, p) => s + p[2], 0) / 3];
    expect(inside(p) || distance(p) < 0.36).toBe(true);
  }
});

it('supports every mapped upper boundary vertex on the same rendered cliff cap, including the entry', () => {
  for (const [x, z] of frame.geometry.upperEnvelope) {
    expect(devinGroundHeight(x, z)).toBeCloseTo(frame.controls.upperRock.top, 3);
    const hits = triangles('closeup')
      .filter((t) => t.s === 'weathered')
      .map((t) => ray(x, z, t.p))
      .filter((v) => v !== null);
    expect(Math.max(...hits)).toBeCloseTo(frame.controls.upperRock.top, 2);
  }
});
it('faces masonry reveals into the empty opening, including clipped polygons with collinear first vertices', () => {
  const mesh = triangles('closeup').filter((t) => t.s === 'rubble');
  let found = 0;
  for (const raw of apertures.openings) {
    const h = prepareOpening(raw, devinGroundHeight(...raw.center)),
      ring = h.ring;
    for (const t of mesh) {
      const q = t.p.map(h.local),
        c = q[0].map((_, k) => q.reduce((s, v) => s + v[k], 0) / 3);
      if (Math.abs(c[2]) >= h.depth / 2 + 0.0001) continue;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          u = b[0] - a[0],
          v = b[1] - a[1],
          l = Math.hypot(u, v),
          along = (c[0] - a[0]) * u + (c[1] - a[1]) * v;
        if (along < -0.0001 || along > l * l + 0.0001) continue;
        if (!q.every((p) => Math.abs(-v * (p[0] - a[0]) + u * (p[1] - a[1])) < 0.0001)) continue;
        const facing = t.n[0] * (-v * h.axis[0]) + t.n[1] * u + t.n[2] * (-v * h.axis[1]);
        expect(facing, raw.id).toBeGreaterThanOrEqual(-0.001);
        found++;
      }
    }
  }
  expect(found).toBeGreaterThan(300);
});
