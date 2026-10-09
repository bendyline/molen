import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildLjubljanaPart,
  ljubljanaParts,
  ljubljanaRing,
  ljubljanaStudy,
} from '../../worldgen/scripts/ljubljana-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u2/u24/n0307_ljubljana_castle/',
  import.meta.url,
);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  k = frame.controls;
const mesh = (fn, d) => {
  const out = [];
  fn({ addTriangle: (slot, _r, p, n) => out.push({ slot, p, n }) }, d);
  return out;
};
const complete = (d) => Object.values(ljubljanaParts).flatMap((fn) => mesh(fn, d));
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function hit(origin, d, p) {
  const a = sub(p[1], p[0]),
    b = sub(p[2], p[0]),
    h = cross(d, b),
    det = dot(a, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(origin, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}
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
function distance(q, p) {
  return Math.min(
    ...p.map((a, i) => {
      const b = p[(i + 1) % p.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = dx * dx + dz * dz,
        t = length
          ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / length))
          : 0;
      return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t);
    }),
  );
}
it('builds deterministic four-level geometry within browser budgets with no embedded textures or duplicated GPU layout types', async () => {
  const id = 'molen.worldgen.structure.n0307_ljubljana_castle',
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
      level === 'skyline' ? 0 : level === 'district' ? 5 : 6,
    );
    const types = new Map();
    for (const m of g.meshes)
      for (const p of m.primitives)
        for (const ix of Object.values(p.attributes)) {
          const a = g.accessors[ix];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
    for (const set of types.values()) expect(set.size).toBe(1);
  }
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
it('keeps exact castle identity, all fifteen independent map parts and the real relation courtyard hole', () => {
  expect(frame.elements.find((e) => e.id === 5821190).tags.wikidata).toBe('Q2075156');
  expect(k.partWays).toHaveLength(15);
  expect(new Set(k.partWays).size).toBe(15);
  expect(frame.elements.find((e) => e.id === 2326426).members).toContainEqual({
    type: 'way',
    ref: '174281987',
    role: 'inner',
  });
  for (const id of k.partWays) {
    const raw = frame.geometry.rawFeatures.find((w) => w.id === id);
    expect(ljubljanaRing(id)).toEqual(raw.points.slice(0, -1));
    expect(k.buildingParts[id].height).toBe(+raw.tags.height);
  }
  expect(frame.heading).toBe(0);
  expect(ljubljanaStudy.geographic().status).toBe('draft');
  expect(ljubljanaStudy.geographic().replaceFootprint).toBe(false);
  expect(k.published.viewingPlatformAltitude).toBe(400);
  expect(k.buildingParts[k.viewingTower].height).toBe(32);
  expect(k.courtBasis).toMatch(/inference/);
  const pack = JSON.parse(
    readFileSync(new URL('../../../content/worldgen/stylepack.json', import.meta.url)),
  );
  expect(typeof pack.styles[ljubljanaStudy.mediumFiContext.neighborStyle]).toBe('string');
});
it('covers every mapped roofed building part at every detail level without gaps', () => {
  for (const d of [0, 1, 2, 3])
    for (const id of k.partWays) {
      if (id === k.viewingTower) continue;
      const p = ljubljanaRing(id),
        c = k.buildingParts[id],
        roof = mesh((o) => buildLjubljanaPart(o, id, d), d).filter((t) =>
          ['tile', 'metal'].includes(t.slot),
        );
      const xs = p.map((q) => q[0]),
        zs = p.map((q) => q[1]);
      const footprintArea =
          Math.abs(
            p.reduce((sum, a, i) => {
              const b = p[(i + 1) % p.length];
              return sum + a[0] * b[1] - a[1] * b[0];
            }, 0),
          ) / 2,
        step = Math.min(1.1, Math.sqrt(footprintArea) / 8);
      let samples = 0;
      for (let x = Math.min(...xs) + step * 0.41; x < Math.max(...xs); x += step)
        for (let z = Math.min(...zs) + step * 0.53; z < Math.max(...zs); z += step) {
          if (!inside([x, z], p) || distance([x, z], p) < (d === 0 && p.length > 4 ? 0.85 : 0.03))
            continue;
          samples++;
          expect(
            roof.some((t) => {
              const v = hit([x, c.height + 1, z], [0, -1, 0], t.p);
              return v !== null && v >= 0.95;
            }),
            `Missing roof way${id} at${x},${z},d${d}`,
          ).toBe(true);
        }
      expect(samples, `No coverage samples way${id},d${d}`).toBeGreaterThanOrEqual(3);
    }
});
it('preserves open courtyard air and its declared six-metre floor throughout the four levels', () => {
  const p = ljubljanaRing(k.courtWay);
  for (const d of [0, 1, 2, 3]) {
    const m = complete(d);
    let samples = 0;
    for (let x = -23; x < 23; x += 4.13)
      for (let z = -23; z < 16; z += 4.21) {
        if (!inside([x, z], p) || distance([x, z], p) < 1.2) continue;
        const found = m
          .map((t) => ({ slot: t.slot, t: hit([x, 50, z], [0, -1, 0], t.p) }))
          .filter((v) => v.t !== null && v.t > 0)
          .sort((a, b) => a.t - b.t);
        expect(found.length).toBeGreaterThan(0);
        expect(50 - found[0].t, `Blocked court${x},${z},d${d}`).toBeCloseTo(k.courtyardY, 3);
        expect(found[0].slot).toBe('paving');
        samples++;
      }
    expect(samples).toBeGreaterThan(60);
  }
});
it('leaves the mapped entrance passage open through both eastern wing walls', () => {
  const p = ljubljanaRing(k.entrance.way),
    a = p[0],
    b = p.at(-1),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dir = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
  for (const d of [0, 1, 2, 3])
    for (const y of [6.15, 7.3, 8.4]) {
      const m = complete(d),
        hits = m
          .map((t) => hit([a[0], y, a[1]], dir, t.p))
          .filter((v) => v !== null && v > 0.001 && v < len - 0.001);
      expect(hits, `Blocked mapped gatewayY${y},d${d}`).toHaveLength(0);
    }
});
it('leaves the clock tower observation terrace open below its crenellations', () => {
  const p = ljubljanaRing(k.viewingTower),
    q = p.reduce((s, v) => s.map((x, i) => x + v[i] / p.length), [0, 0]);
  for (const d of [0, 1, 2, 3]) {
    const m = mesh((o) => buildLjubljanaPart(o, k.viewingTower, d), d),
      found = m
        .map((t) => ({ slot: t.slot, t: hit([q[0], 35, q[1]], [0, -1, 0], t.p) }))
        .filter((v) => v.t !== null && v.t > 0)
        .sort((a, b) => a.t - b.t);
    expect(found[0].slot).toBe('paving');
    expect(35 - found[0].t).toBeCloseTo(k.terraceY, 3);
  }
});
it('exports only finite nondegenerate float32 geometry with correct winding, ground contact and bounded flag tops', () => {
  for (const d of [0, 1, 2, 3]) {
    const m = complete(d);
    let min = Infinity,
      max = -Infinity;
    for (const t of m) {
      const p = t.p.map((q) => q.map(Math.fround)),
        n = cross(sub(p[1], p[0]), sub(p[2], p[0]));
      expect(Math.hypot(...n)).toBeGreaterThanOrEqual(1e-10);
      expect(dot(n, t.n)).toBeGreaterThanOrEqual(-1e-7);
      for (const q of p) for (const v of q) expect(Number.isFinite(v)).toBe(true);
      for (const q of p) {
        min = Math.min(min, q[1]);
        max = Math.max(max, q[1]);
      }
    }
    expect(min).toBe(0);
    expect(max).toBe(43);
  }
});
