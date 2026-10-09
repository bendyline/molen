import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  liechtensteinParts,
  liechtensteinPlanPoint,
} from '../../worldgen/scripts/liechtenstein-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/u2/u2e/n0302_liechtenstein_castle/',
    import.meta.url,
  ),
  frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  k = frame.controls;
const triangles = (part, d) => {
  const a = [];
  liechtensteinParts[part]({ addTriangle: (slot, _r, p, n) => a.push({ slot, p, n }) }, d);
  return a;
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
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(e2, cross(q, e1)) / det;
}
const native = ([x, y, z]) => {
  const p = liechtensteinPlanPoint(x, z);
  return [p[0], y, p[1]];
};
const inside = (q, p) => {
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
};
it('rebuilds four byte-deterministic levels within browser budgets using shared surfaces', async () => {
  const id = 'molen.worldgen.structure.n0302_liechtenstein_castle',
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
    expect(g.materials.length).toBeLessThanOrEqual(7);
    expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(
      level === 'skyline' ? 0 : 5,
    );
    const types = new Map();
    for (const m of g.meshes)
      for (const p of m.primitives)
        for (const ix of Object.values(p.attributes)) {
          const a = g.accessors[ix];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
    for (const s of types.values()) expect(s.size).toBe(1);
  }
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
it('preserves the Austrian castle identity and excludes the separate palace', () => {
  expect(frame.wikidataId).toBe('Q699474');
  expect(frame.elements.find((v) => v.id === 1020587803).tags.wikidata).toBe('Q699474');
  expect(frame.elements.some((v) => v.tags.wikidata === 'Q1726817')).toBe(false);
  expect(frame.elements.some((v) => v.id === 1424741241)).toBe(true);
  expect(frame.heading).toBe(0);
});
it('covers the whole mapped main footprint with upward roofs in every level', () => {
  const co = Math.cos(k.planAngleRadians),
    si = Math.sin(k.planAngleRadians),
    ring = frame.geometry.outline.map(([x, z]) => [x * co - z * si, x * si + z * co]);
  for (const d of [0, 1, 2, 3]) {
    const mesh = [...triangles('keep', d), ...triangles('residence', d)].filter(
      (t) => ['tile', 'slate'].includes(t.slot) && t.n[1] > 0,
    );
    let samples = 0;
    for (let x = -23; x < 24; x += 1.9)
      for (let z = -8; z < 8; z += 1.7) {
        if (!inside([x, z], ring)) continue;
        samples++;
        const h = mesh
          .map((t) => ({ distance: hit(native([x, 0, z]), [0, 1, 0], t.p), n: t.n }))
          .filter((v) => v.distance !== null && v.distance > 10);
        expect(h.length, `Uncovered main roof ${x},${z},detail${d}`).toBeGreaterThan(0);
        for (const v of h) expect(v.n[1]).toBeGreaterThan(0);
      }
    expect(samples).toBeGreaterThan(100);
  }
});
it('keeps the mapped gate route physically open at its own floor height', () => {
  const p = k.gate.route,
    a = p[0],
    b = p.at(-1),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    direction = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
  for (const d of [1, 2, 3]) {
    const mesh = [...triangles('gate', d), ...triangles('walls', d)];
    for (const h of [0.1, 1.7, 2.4]) {
      const origin = [a[0], k.gate.baseY + h, a[1]],
        hits = mesh
          .map((t) => hit(origin, direction, t.p))
          .filter((t) => t !== null && t > 0.02 && t < len - 0.02);
      expect(hits, `Gate blocked at ${h} detail${d}`).toHaveLength(0);
    }
  }
});
it('opens all five upper arches without cutting away their surrounding facade', () => {
  const dirXZ = liechtensteinPlanPoint(0, -1),
    direction = [dirXZ[0], 0, dirXZ[1]];
  for (const d of [1, 2, 3]) {
    const mesh = triangles('residence', d);
    for (let i = 0; i < 5; i++) {
      const x = k.arcade.center[0] + (i - 2) * k.arcade.spacing;
      const origin = native([x, k.arcade.bottomY + 1.2, 9]);
      const near = mesh
        .map((t) => hit(origin, direction, t.p))
        .filter((t) => t !== null && t > 0 && t < 4);
      expect(near, `Closed arcade ${i + 1} detail${d}`).toHaveLength(0);
      const wall = mesh
        .map((t) => hit(native([x, k.arcade.bottomY - 0.5, 9]), direction, t.p))
        .filter((t) => t !== null && t > 0 && t < 4);
      expect(wall.length).toBeGreaterThan(0);
    }
  }
});
it('retains the west keep, east tower and lower gatehouse in its skyline', () => {
  const inverse = ([x, y, z]) => [
    x * Math.cos(k.planAngleRadians) - z * Math.sin(k.planAngleRadians),
    y,
    x * Math.sin(k.planAngleRadians) + z * Math.cos(k.planAngleRadians),
  ];
  const vertices = Object.keys(liechtensteinParts).flatMap((p) =>
    triangles(p, 0).flatMap((t) => t.p.map(inverse)),
  );
  expect(vertices.some((v) => v[0] < -11 && v[1] > 38)).toBe(true);
  expect(vertices.some((v) => v[0] > 18 && v[0] < 28 && v[1] > 31)).toBe(true);
  expect(vertices.some((v) => v[0] > 26 && v[0] < 35 && v[1] > 6)).toBe(true);
});
it('seats the grey tower roof on the separately mapped tower in every level', () => {
  const p = frame.geometry.rawFeatures.find((v) => v.id === 1424741253).points;
  const center = [0, 1].map(
    (i) => (Math.min(...p.map((v) => v[i])) + Math.max(...p.map((v) => v[i]))) / 2,
  );
  for (const d of [0, 1, 2, 3]) {
    const roof = triangles('residence', d).filter((t) => t.slot === 'slate');
    const hits = roof
      .map((t) => hit([center[0], 25, center[1]], [0, 1, 0], t.p))
      .filter((v) => v !== null && v > 3);
    expect(hits.length, `Missing mapped east-tower roof detail${d}`).toBeGreaterThan(0);
  }
});
it('preserves the continuous palas roof ridge behind its south cross-gable', () => {
  for (const d of [0, 1, 2, 3]) {
    const roof = triangles('residence', d).filter((t) => t.slot === 'tile');
    for (const x of [-2, 10, 14.5]) {
      const hits = roof
        .map((t) => hit(native([x, 0, -0.3]), [0, 1, 0], t.p))
        .filter((v) => v !== null && v > 0);
      expect(Math.max(...hits), `Lowered palas ridge at${x} detail${d}`).toBeGreaterThan(28);
    }
  }
});
it('seals the gate roof overhang with a visible underside instead of an open eave gap', () => {
  const co = Math.cos(k.planAngleRadians),
    si = Math.sin(k.planAngleRadians);
  const p = frame.geometry.rawFeatures
    .find((v) => v.id === k.gate.way)
    .points.slice(0, -1)
    .map(([x, z]) => [x * co - z * si, x * si + z * co]);
  const c = [0, 1].map(
    (i) => (Math.min(...p.map((v) => v[i])) + Math.max(...p.map((v) => v[i]))) / 2,
  );
  for (const d of [0, 1, 2, 3]) {
    const mesh = triangles('gate', d).filter((t) => t.n[1] < -0.5);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        q = a.map((v, j) => c[j] + ((v + b[j]) / 2 - c[j]) * 1.04);
      const origin = native([q[0], k.gate.baseY + k.gate.eaveHeight - 0.5, q[1]]);
      const hits = mesh
        .map((t) => hit(origin, [0, 1, 0], t.p))
        .filter((t) => t !== null && t > 0.4 && t < 0.6);
      expect(hits.length, `Open gate eave${i} detail${d}`).toBeGreaterThan(0);
    }
  }
});
