import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  gediminasParts,
  gediminasRing,
  gediminasStudy,
} from '../../worldgen/scripts/gediminas-tower-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u9/u99/n0306_gediminas_tower/',
  import.meta.url,
);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  k = frame.controls;
const triangles = (fn, d) => {
  const out = [];
  fn({ addTriangle: (slot, _ref, p, n) => out.push({ slot, p, n }) }, d);
  return out;
};
const mesh = (d) => Object.values(gediminasParts).flatMap((fn) => triangles(fn, d));
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
const hits = (m, p, d) =>
  m
    .map((t) => ({ ...t, t: hit(p, d, t.p) }))
    .filter((v) => v.t !== null && v.t > 0.00001)
    .sort((a, b) => a.t - b.t);
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
function facadeRay(story, index, y, offset = 0) {
  const p = gediminasRing(story),
    a = p[index],
    b = p[(index + 1) % p.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const sign = Math.sign(
      p.reduce((s, a, i) => {
        const b = p[(i + 1) % p.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    ),
    n = [(sign * (b[1] - a[1])) / len, (-sign * (b[0] - a[0])) / len],
    c = [
      (a[0] + b[0]) / 2 + (offset * (b[0] - a[0])) / len,
      (a[1] + b[1]) / 2 + (offset * (b[1] - a[1])) / len,
    ];
  return { origin: [c[0] + n[0], y, c[1] + n[1]], direction: [-n[0], 0, -n[1]] };
}
it('rebuilds compact deterministic four-level browser geometry with reusable shared surfaces', async () => {
  const id = 'molen.worldgen.structure.n0306_gediminas_tower',
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
    for (const set of types.values()) expect(set.size).toBe(1);
  }
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
it('preserves the tower identity and all three independently traced octagons without regularizing them', () => {
  expect(frame.elements.find((e) => e.id === 24569542).tags.wikidata).toBe('Q1497616');
  expect(frame.heading).toBe(0);
  expect(frame.rejectedIdentity.id).toBe(325130082);
  for (let i = 0; i < 3; i++) {
    const raw = frame.geometry.rawFeatures
        .find((w) => w.id === k.stories[i].way)
        .points.slice(0, -1),
      ring = gediminasRing(i);
    expect(ring).toHaveLength(8);
    for (const p of raw) expect(ring).toContainEqual(p);
  }
  expect(k.stories.map((c) => c.bottom)).toEqual([0, 6, 12]);
  expect(k.mappedHeight).toBe(20);
  const pack = JSON.parse(
    readFileSync(new URL('../../../content/worldgen/stylepack.json', import.meta.url)),
  );
  expect(typeof pack.styles[gediminasStudy.mediumFiContext.neighborStyle]).toBe('string');
});
it('keeps the observed terrace floor below the open parapet rather than sealing the tower at20m', () => {
  for (const d of [0, 1, 2, 3]) {
    const m = mesh(d);
    let samples = 0;
    for (let x = -4; x <= 4; x += 1.1)
      for (let z = -4; z <= 4; z += 1.2) {
        if (
          !inside(
            [x, z],
            gediminasRing(2).map((p) => p.map((v) => v * 0.8)),
          ) ||
          (x > -4 && x < 0 && z > -3.1 && z < 0) ||
          Math.hypot(x - k.flagpole.point[0], z - k.flagpole.point[1]) < 0.3
        )
          continue;
        const found = hits(m, [x, 30, z], [0, -1, 0]);
        expect(found.length).toBeGreaterThan(0);
        expect(30 - found[0].t, `Terrace at${x},${z},d${d}`).toBeCloseTo(k.deckY, 3);
        expect(found[0].slot).toBe('paving');
        samples++;
      }
    expect(samples).toBeGreaterThan(20);
  }
});
it('cuts all twenty-four facade openings and seats panes behind the real outer wall at district and closer', () => {
  for (const d of [1, 2, 3]) {
    const m = mesh(d);
    for (let story = 0; story < 3; story++)
      for (let index = 0; index < 8; index++) {
        const door = story === 0 && index === k.entrance.face,
          c = door ? k.entrance : k.windowFloors[story],
          ray = facadeRay(story, index, c.bottom + c.height * 0.45, door ? 0.3 : 0),
          found = hits(m, ray.origin, ray.direction);
        expect(found[0].slot, `Opening story${story}/face${index}/d${d}`).toBe(
          door ? 'wood' : 'glass',
        );
        expect(found[0].t).toBeGreaterThan(1.15);
        expect(found[0].t).toBeLessThan(1.36);
      }
  }
});
it('leaves all eight narrow parapet gaps open at all four levels', () => {
  for (const d of [0, 1, 2, 3])
    for (let i = 0; i < 8; i++) {
      const ray = facadeRay(2, i, 19.3),
        m = triangles(gediminasParts.terrace, d),
        found = hits(m, ray.origin, ray.direction).filter((v) => v.t < 2);
      expect(found, `Parapet gap${i},d${d}`).toHaveLength(0);
    }
});
it('retains the Lithuanian tricolor and mapped pole point without an embedded flag image', () => {
  expect(k.flagpole.node).toBe(5154800235);
  expect(k.flag.width / k.flag.height).toBeCloseTo(5 / 3, 8);
  for (const d of [0, 1, 2, 3]) {
    const flag = triangles(gediminasParts.nationalFlag, d);
    expect(flag.filter((t) => t.slot === 'flag').length).toBeGreaterThanOrEqual(12);
    expect(Math.max(...flag.flatMap((t) => t.p.map((p) => p[1])))).toBe(25);
  }
});
it('keeps geometry above the declared attachment plane and preserves the lower footprint extents', () => {
  const base = gediminasRing(0);
  for (const d of [0, 1, 2, 3]) {
    const m = mesh(d);
    for (const t of m) for (const p of t.p) expect(p[1]).toBeGreaterThanOrEqual(0);
    const shell = triangles(gediminasParts.tower, d)
      .flatMap((t) => t.p)
      .filter((p) => p[1] === 0);
    for (const axis of [0, 2]) {
      expect(Math.min(...shell.map((p) => p[axis]))).toBeCloseTo(
        Math.min(...base.map((p) => p[axis === 0 ? 0 : 1])),
        3,
      );
      expect(Math.max(...shell.map((p) => p[axis]))).toBeCloseTo(
        Math.max(...base.map((p) => p[axis === 0 ? 0 : 1])),
        3,
      );
    }
  }
});
