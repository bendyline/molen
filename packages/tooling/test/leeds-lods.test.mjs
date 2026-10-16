import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { leedsParts, leedsPlanPoint } from '../../worldgen/scripts/leeds-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u1/u10/n0304_leeds_castle/',
  import.meta.url,
);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  k = frame.controls;
const triangles = (part, d) => {
  const out = [];
  leedsParts[part]({ addTriangle: (slot, _ref, p, n) => out.push({ slot, p, n }) }, d);
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
  const p = leedsPlanPoint(x, z);
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
it('rebuilds four deterministic browser levels with five shared surfaces and compact GPU layouts', async () => {
  const id = 'molen.worldgen.structure.n0304_leeds_castle',
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
it('preserves the exact castle relation, separate component footprints, courtyard and island attribution', () => {
  expect(frame.elements.find((e) => e.type === 'relation' && e.id === 6941053).tags.wikidata).toBe(
    'Q746876',
  );
  for (const id of [471509263, 895608770, 895608772, 120567641, 120567645, 297495785])
    expect(frame.elements.some((e) => e.id === id)).toBe(true);
  expect(frame.heading).toBe(0);
  expect(frame.geometry.holes).toHaveLength(1);
  expect(frame.elements.some((e) => e.id === 448880140)).toBe(false); // Detached Fairfax Courtyard.
});
it('leaves the Gloriette courtyard open at every runtime level', () => {
  for (const d of [0, 1, 2, 3]) {
    const mesh = ['gloriette', 'coveredBridge', 'newCastle'].flatMap((part) => triangles(part, d));
    for (const p of [
      [75, -20],
      [78, -21],
      [73, -19],
    ])
      expect(
        mesh
          .map((t) => hit(native([p[0], 5, p[1]]), [0, 1, 0], t.p))
          .filter((v) => v !== null && v > 0),
      ).toHaveLength(0);
  }
});
it('covers all four mapped building roofs while preserving the Gloriette court hole', () => {
  const original = frame.geometry.outline
    .map((p) => inverse([p[0], 0, p[1]]))
    .map((p) => [p[0], p[2]]);
  const court = frame.geometry.holes[0]
    .map((p) => inverse([p[0], 0, p[1]]))
    .map((p) => [p[0], p[2]]);
  for (const [part, control] of [
    ['newCastle', k.newCastle],
    ['gloriette', k.gloriette],
    ['maiden', k.maiden],
    ['gatehouse', k.gatehouse],
  ]) {
    const p = control.outerIndices
      ? control.outerIndices.map((i) => original[i])
      : frame.geometry.rawFeatures
          .find((w) => w.id === control.way)
          .points.map((p) => inverse([p[0], 0, p[1]]))
          .map((p) => [p[0], p[2]]);
    p.push(p[0]);
    const hole = part === 'gloriette' ? [court] : [];
    for (const d of [0, 1, 2, 3]) {
      const mesh = triangles(part, d).filter((t) => t.slot === 'tile' && t.n[1] > 0);
      let samples = 0;
      for (let x = -94; x < 93; x += 2.37)
        for (let z = -42; z < 39; z += 2.71) {
          if (
            !inside([x, z], p) ||
            hole.some((h) => inside([x, z], h)) ||
            boundaryDistance([x, z], [p, ...hole]) < (d === 0 ? 1.0 : d === 1 ? 0.5 : 0.02)
          )
            continue;
          samples++;
          expect(
            mesh
              .map((t) => hit(native([x, control.roofBaseY - 1, z]), [0, 1, 0], t.p))
              .filter((v) => v !== null && v > 0).length,
            `${part} roof missing at${x},${z},d${d}`,
          ).toBeGreaterThan(0);
        }
      expect(samples).toBeGreaterThan(25);
    }
  }
});
it('keeps the entire water channel free of island foundation walls at every level', () => {
  for (const d of [0, 1, 2, 3]) {
    const mesh = triangles('foundation', d);
    for (const x of [51, 53, 55, 57, 59])
      for (const y of [1, 2, 4])
        expect(
          mesh
            .map((t) => hit(native([x, y, 50]), native([0, 0, -1]), t.p))
            .filter((v) => v !== null && v > 0 && v < 100),
          `Unexpected foundation wall in channel at X${x},Y${y},d${d}`,
        ).toHaveLength(0);
  }
});
it('supports every Gloriette chimney corner on its roof in nearby levels', () => {
  for (const d of [2, 3]) {
    const roof = triangles('gloriette', d).filter((t) => t.slot === 'tile' && t.n[1] > 0);
    for (const [x, z] of k.gloriette.chimneyCenters)
      for (const dx of [-0.55, 0.55])
        for (const dz of [-0.8, 0.8]) {
          const hits = roof
            .map((t) => hit(native([x + dx, k.gloriette.roofBaseY - 1, z + dz]), [0, 1, 0], t.p))
            .filter((v) => v !== null && v > 0);
          expect(hits.length, `Unsupported chimney at${x + dx},${z + dz}`).toBeGreaterThan(0);
          expect(Math.min(...hits)).toBeCloseTo(1, 3);
        }
  }
});
it('retains both actual covered-bridge water arches and open channel at all four levels', () => {
  const b = k.coveredBridge,
    n = [-b.archAxis[1], b.archAxis[0]];
  for (const d of [0, 1, 2, 3]) {
    const mesh = ['coveredBridge', 'foundation'].flatMap((part) => triangles(part, d));
    for (const c of b.archCenters)
      for (const y of [1.0, 2.0, 2.8]) {
        const origin = native([c[0] - n[0] * 5, y, c[1] - n[1] * 5]),
          dir = native([n[0], 0, n[1]]);
        expect(
          mesh
            .map((t) => hit(origin, dir, t.p))
            .filter((v) => v !== null && v > 0.001 && v < 9.999),
          `Bridge blocked at${c},Y${y},d${d}`,
        ).toHaveLength(0);
      }
    const c = b.archCenters[0];
    expect(mesh.some((t) => t.p.some((p) => p[1] > 12))).toBe(true);
    const overhead = mesh
      .map((t) => hit(native([c[0], 0.1, c[1]]), [0, 1, 0], t.p))
      .filter((v) => v !== null && v > 0);
    // The first overhead surface is the vault apex, with no invented slab at water level.
    expect(Math.min(...overhead)).toBeCloseTo(b.archBottomY + b.archHeight - 0.1, 3);
  }
});
it('keeps each mapped gatehouse route segment clear at pedestrian heights in nearby levels', () => {
  const p = frame.geometry.rawFeatures.find((w) => w.id === k.gatehouse.routeWay).points;
  for (const d of [1, 2, 3]) {
    const mesh = triangles('gatehouse', d);
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i],
        b = p[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dir = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
      for (const above of [0.1, 1.7, 2.4])
        expect(
          mesh
            .map((t) => hit([a[0], k.baileyFloorY + above, a[1]], dir, t.p))
            .filter((v) => v !== null && v > 0.001 && v < len - 0.001),
          `Gate blocked segment${i},d${d}`,
        ).toHaveLength(0);
    }
  }
});
it('retains both low bath watergate arches in nearby levels', () => {
  const b = k.watergate,
    n = [-b.archAxis[1], b.archAxis[0]];
  for (const d of [1, 2, 3]) {
    const mesh = ['maiden', 'foundation'].flatMap((part) => triangles(part, d));
    for (const c of b.archCenters) {
      const origin = native([c[0] - n[0] * 4, 1.6, c[1] - n[1] * 4]),
        dir = native([n[0], 0, n[1]]);
      expect(
        mesh.map((t) => hit(origin, dir, t.p)).filter((v) => v !== null && v > 0.001 && v < 7.999),
      ).toHaveLength(0);
    }
  }
});
