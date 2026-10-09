import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildTurkuPart,
  turkuParts,
  turkuStudy,
} from '../../worldgen/scripts/turku-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u6/u6x/n0305_turku_castle/',
  import.meta.url,
);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  k = frame.controls;
const mesh = (build, d) => {
  const out = [];
  build({ addTriangle: (slot, _ref, p, n) => out.push({ slot, p, n }) }, d);
  return out;
};
const complete = (d) => Object.values(turkuParts).flatMap((fn) => mesh(fn, d));
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
  let min = Infinity;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i],
      b = p[i + 1],
      length = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    if (!length) continue;
    const t = Math.max(
      0,
      Math.min(1, ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / length),
    );
    min = Math.min(
      min,
      Math.hypot(q[0] - a[0] - (b[0] - a[0]) * t, q[1] - a[1] - (b[1] - a[1]) * t),
    );
  }
  return min;
}
it('rebuilds four deterministic browser levels under the medium-fi and phone budgets', async () => {
  const id = 'molen.worldgen.structure.n0305_turku_castle',
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
      level === 'skyline' ? 0 : level === 'district' ? 6 : 7,
    );
    const views = new Map();
    for (const mesh of g.meshes)
      for (const p of mesh.primitives)
        for (const ix of Object.values(p.attributes)) {
          const a = g.accessors[ix];
          if (!views.has(a.bufferView)) views.set(a.bufferView, new Set());
          views.get(a.bufferView).add(a.componentType);
        }
    for (const types of views.values()) expect(types.size).toBe(1);
  }
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
it('preserves exact mapped identity,17 parts and the museum-published tower heights', () => {
  expect(frame.elements.find((e) => e.id === 466736288).tags.wikidata).toBe('Q136893');
  expect(Object.keys(k.buildingParts)).toHaveLength(17);
  expect(frame.geometry.holes).toHaveLength(3);
  expect(frame.heading).toBe(0);
  const stylepack = JSON.parse(
    readFileSync(new URL('../../../content/worldgen/stylepack.json', import.meta.url)),
  );
  expect(typeof stylepack.styles[turkuStudy.mediumFiContext.neighborStyle]).toBe('string');
  for (const d of [0, 1, 2, 3])
    for (const [id, height] of [
      [k.westTower, 38],
      [k.eastTower, 32],
    ]) {
      const p = mesh((o) => buildTurkuPart(o, id, d), d);
      expect(Math.max(...p.flatMap((t) => t.p.map((v) => v[1])))).toBe(height);
    }
});
it('covers every mapped part with a roof at all four levels', () => {
  for (const [id, c] of Object.entries(k.buildingParts)) {
    const p = frame.geometry.rawFeatures.find((w) => w.id === +id).points;
    const xs = p.map((q) => q[0]),
      zs = p.map((q) => q[1]);
    const shortSpan = Math.min(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...zs) - Math.min(...zs),
    );
    for (const d of [0, 1, 2, 3]) {
      const roof = mesh((o) => buildTurkuPart(o, +id, d), d).filter(
        (t) => ['copper', 'metal'].includes(t.slot) && t.n[1] > 0,
      );
      let samples = 0;
      for (
        let x = Math.min(...xs) + Math.min(0.4, shortSpan * 0.2);
        x < Math.max(...xs);
        x += Math.min(1.31, shortSpan * 0.2)
      )
        for (
          let z = Math.min(...zs) + Math.min(0.4, shortSpan * 0.2);
          z < Math.max(...zs);
          z += Math.min(1.17, shortSpan * 0.2)
        ) {
          if (
            !inside([x, z], p) ||
            distance([x, z], p) <
              (d === 0
                ? Math.min(1.0, shortSpan * 0.15)
                : d === 1
                  ? Math.min(0.5, shortSpan * 0.15)
                  : 0.02)
          )
            continue;
          samples++;
          expect(
            roof.some((t) => {
              const v = hit([x, c.height - c.roofRise - 1, z], [0, 1, 0], t.p);
              return v !== null && v > 0;
            }),
            `Missing roof way${id} at${x},${z},d${d}`,
          ).toBe(true);
        }
      expect(samples, `No meaningful coverage samples way${id},d${d}`).toBeGreaterThanOrEqual(3);
    }
  }
});
it('keeps all three courtyard interiors open across the runtime levels', () => {
  for (const d of [0, 1, 2, 3]) {
    const m = complete(d);
    for (const q of [
      [-46, 5],
      [-20, 3],
      [19, -3],
      [25, 11],
      [7, -12],
    ])
      expect(
        m.map((t) => hit([q[0], 0.3, q[1]], [0, 1, 0], t.p)).filter((v) => v !== null && v > 0),
        `Blocked court${q},d${d}`,
      ).toHaveLength(0);
  }
});
it('retains the fifteen-metre gallery clearance and visible glazed band', () => {
  for (const d of [0, 1, 2, 3]) {
    const m = mesh(turkuParts.gallery, d),
      hits = m.map((t) => hit([-32, 0.2, 1], [0, 1, 0], t.p)).filter((v) => v !== null && v > 0);
    expect(Math.min(...hits)).toBeCloseTo(14.8, 3);
    if (d > 0) expect(m.filter((t) => t.slot === 'glass').length).toBeGreaterThan(0);
  }
});
it('leaves all three mapped passage routes clear through towers and adjoining annexes', () => {
  for (const d of [0, 1, 2, 3]) {
    const m = complete(d);
    for (const control of k.passages) {
      const p = frame.geometry.rawFeatures.find((w) => w.id === control.way).points,
        a = p[0],
        b = p.at(-1),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dir = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
      for (const y of [0.1, 1.7, 2.3])
        expect(
          m
            .map((t) => hit([a[0], y, a[1]], dir, t.p))
            .filter((v) => v !== null && v > 0.001 && v < len - 0.001),
          `Blocked route${control.way},Y${y},d${d}`,
        ).toHaveLength(0);
    }
  }
});
it('keeps original facade patches above the declared ground attachment', () => {
  for (const d of [0, 1, 2, 3])
    for (const t of complete(d)) for (const p of t.p) expect(p[1]).toBeGreaterThanOrEqual(0);
});
