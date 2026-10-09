import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { arundelParts, arundelPlanPoint } from '../../worldgen/scripts/arundel-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/gc/gcp/n0303_arundel_castle/',
  import.meta.url,
);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  k = frame.controls;
const triangles = (part, d) => {
  const out = [];
  arundelParts[part]({ addTriangle: (slot, _ref, p, n) => out.push({ slot, p, n }) }, d);
  return out;
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function hit(origin, d, p) {
  const e1 = sub(p[1], p[0]),
    e2 = sub(p[2], p[0]),
    h = cross(d, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(origin, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, e1)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(e2, cross(q, e1)) / det;
}
const native = ([x, y, z]) => {
  const p = arundelPlanPoint(x, z);
  return [p[0], y, p[1]];
};
const inverse = ([x, y, z]) => {
  const co = Math.cos(k.planAngleRadians),
    si = Math.sin(k.planAngleRadians);
  return [x * co + z * si, y, -x * si + z * co];
};
function inside(q, p) {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function boundaryDistance(q, rings) {
  let minimum = Infinity;
  for (const p of rings)
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i],
        b = p[i + 1],
        length = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
      if (!length) continue;
      const t = Math.max(
        0,
        Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / length),
      );
      minimum = Math.min(
        minimum,
        Math.hypot(q[0] - a[0] - (b[0] - a[0]) * t, q[1] - a[1] - (b[1] - a[1]) * t),
      );
    }
  return minimum;
}
it('rebuilds four deterministic browser levels with shared materials and separate GPU layouts', async () => {
  const id = 'molen.worldgen.structure.n0303_arundel_castle',
    sizes = [];
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
    sizes.push(a.bytes.length);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.length).toBeLessThanOrEqual(8);
    expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(
      level === 'skyline' ? 0 : 6,
    );
    const types = new Map();
    for (const mesh of g.meshes)
      for (const p of mesh.primitives)
        for (const ix of Object.values(p.attributes)) {
          const a = g.accessors[ix];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
    for (const t of types.values()) expect(t.size).toBe(1);
  }
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
it('retains exact current castle identity, both map voids and separately mapped keep', () => {
  expect(frame.elements.find((e) => e.type === 'relation' && e.id === 1118816).tags.wikidata).toBe(
    'Q716667',
  );
  expect(frame.geometry.holes).toHaveLength(2);
  expect(frame.elements.some((e) => e.id === 1421681564)).toBe(true);
  expect(frame.heading).toBe(0);
  expect(frame.elements.some((e) => e.id === 116218138)).toBe(false);
  expect(k.motte.height).toBe(20);
  expect(k.motte.baseRadius * 2).toBe(75);
  expect(k.keep.height).toBe(9);
});
it('keeps the shell keep open above its declared attachment plane at every level', () => {
  for (const d of [0, 1, 2, 3]) {
    const mesh = triangles('keep', d),
      ray = native([-15.9, 21, 2.3]);
    expect(
      mesh.map((t) => hit(ray, [0, 1, 0], t.p)).filter((v) => v !== null && v > 0),
    ).toHaveLength(0);
    expect(mesh.some((t) => t.p.some((p) => p[1] >= 29))).toBe(true);
  }
});
it('retains an open residential quadrangle instead of roofing over the map courtyard', () => {
  for (const d of [0, 1, 2, 3]) {
    const mesh = ['complex', 'residence', 'towers', 'gates'].flatMap((part) => triangles(part, d));
    for (const point of [
      [73, -6],
      [60, -10],
      [90, -12],
    ])
      expect(
        mesh
          .map((t) => hit(native([point[0], 1, point[1]]), [0, 1, 0], t.p))
          .filter((v) => v !== null && v > 0),
        `Roofed courtyard at ${point}, detail ${d}`,
      ).toHaveLength(0);
  }
});
it('covers the mapped residential roof area through every level', () => {
  const rings = [frame.geometry.outline, ...frame.geometry.holes].map((p) =>
    p.map(([x, z]) => inverse([x, 0, z])).map((v) => [v[0], v[2]]),
  );
  for (const d of [0, 1, 2, 3]) {
    const mesh = triangles('residence', d).filter((t) => t.slot === 'slate' && t.n[1] > 0);
    let samples = 0;
    for (let x = 12; x < 138; x += 7.3)
      for (let z = -43; z < 26; z += 6.1) {
        if (!inside([x, z], rings[0]) || rings.slice(1).some((p) => inside([x, z], p))) continue;
        // Far outlines intentionally omit small notches within the declared simplification error.
        if (boundaryDistance([x, z], rings) < (d === 0 ? 3.1 : d === 1 ? 1.8 : 0)) continue;
        samples++;
        expect(
          mesh
            .map((t) => hit(native([x, 16, z]), [0, 1, 0], t.p))
            .filter((v) => v !== null && v > 0).length,
          `Missing roof at ${x},${z}, detail ${d}`,
        ).toBeGreaterThan(0);
      }
    expect(samples).toBeGreaterThan(50);
  }
});
it('leaves the mapped inner-gate corridor clear at pedestrian heights', () => {
  const way = frame.geometry.rawFeatures.find((w) => w.id === k.innerGate.routeWay),
    points = way.points;
  for (const d of [1, 2, 3]) {
    const mesh = ['complex', 'gates', 'towers'].flatMap((part) => triangles(part, d));
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        direction = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
      for (const y of [0.1, 1.7, 2.4])
        expect(
          mesh
            .map((t) => hit([a[0], y, a[1]], direction, t.p))
            .filter((v) => v !== null && v > 0.02 && v < len - 0.02),
          `Blocked tunnel at height ${y}, detail ${d}`,
        ).toHaveLength(0);
    }
  }
});
it('grounds the artificial motte at zero and seats the keep on its summit in every level', () => {
  for (const d of [0, 1, 2, 3]) {
    const p = triangles('motte', d).flatMap((t) => t.p);
    expect(Math.min(...p.map((v) => v[1]))).toBe(0);
    expect(Math.max(...p.map((v) => v[1]))).toBe(20);
    const keep = triangles('keep', d).flatMap((t) => t.p);
    expect(Math.min(...keep.map((v) => v[1]))).toBe(20);
  }
});
