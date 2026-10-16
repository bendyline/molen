import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import {
  buildSaoJorgeTower,
  saoJorgeParts,
  saoJorgePassages,
  saoJorgePreviewHeight,
  saoJorgeRing,
  saoJorgeStudy,
} from '../../worldgen/scripts/sao-jorge-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/ey/eyc/n0308_castle_of_saint_george/',
    import.meta.url,
  ),
  frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  k = frame.controls;
const mesh = (fn, d) => {
  const out = [];
  fn({ addTriangle: (slot, _ref, p, n) => out.push({ slot, p, n }) }, d);
  return out;
};
const complete = (d) => Object.values(saoJorgeParts).flatMap((fn) => mesh(fn, d));

it('renders the attributed research hill without flattening away unresolved foundation contacts', () => {
  const descriptor = JSON.parse(readFileSync(new URL('qa-terrain.json', root))),
    relief = JSON.parse(readFileSync(new URL('relief-grid.json', root))),
    review = JSON.parse(readFileSync(new URL('terrain-review.json', root))),
    field = heightfieldFromPng(descriptor, readFileSync(new URL('qa-heightmap.png', root)));
  expect(saoJorgeStudy.previewTerrain).toEqual({
    descriptor: 'qa-terrain.json',
    heightmap: 'qa-heightmap.png',
  });
  expect(relief.anchor).toEqual(frame.anchor);
  expect(review.status).toBe('pending');
  expect(review.preview.correctionsApplied).toEqual([]);
  for (const [row, z] of relief.zs.entries())
    for (const [column, x] of relief.xs.entries()) {
      const height = relief.elevationsMeters[row][column] - relief.previewDatumElevationMeters;
      expect(saoJorgePreviewHeight(x, z)).toBeCloseTo(height, 10);
      expect(Math.abs(field.sampleHeight(x, z) - height)).toBeLessThan(0.001);
    }
  expect(saoJorgePreviewHeight(0, 0)).toBeCloseTo(k.courtY, 5);
  // Preserve this visible grade discrepancy until actual ledge/wing levels are established.
  expect(k.museumBaseY - saoJorgePreviewHeight(-50, 125)).toBeGreaterThan(10);
  expect(saoJorgePreviewHeight(-65, -70)).toBeLessThan(1);
});
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
        len = dx * dx + dz * dz,
        t = len ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / len)) : 0;
      return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t);
    }),
  );
}
const downward = (m, x, z, y = 60) =>
  m
    .map((t) => ({ slot: t.slot, t: hit([x, y, z], [0, -1, 0], t.p) }))
    .filter((v) => v.t !== null && v.t > 0)
    .sort((a, b) => a.t - b.t);

it('builds deterministic four-level models within browser budgets using existing shared graphs', async () => {
  const id = 'molen.worldgen.structure.n0308_castle_of_saint_george',
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
      level === 'skyline' ? 0 : level === 'district' ? 4 : 5,
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

it('keeps the exact castle and separate hillside tower identities, including conflicting raw labels', () => {
  expect(frame.elements.find((e) => e.id === 1382432568).tags.wikidata).toBe('Q636780');
  expect(k.towers).toHaveLength(k.published.outerTurrets + k.published.interiorTower);
  expect(new Set(k.towers.map((t) => t.id)).size).toBe(11);
  expect(k.towers.filter((t) => t.roof === 'hipped')).toHaveLength(2);
  expect(k.courtyards).toHaveLength(k.published.placesOfArms);
  expect(k.hillsideTowerWay).toBe(591833135);
  const central = k.towers.find((t) => t.id === 'central');
  expect(central.ring).toEqual(saoJorgeRing(246379169));
  expect(central.name).not.toContain('Lourenço');
  expect(frame.elements.find((e) => e.id === 246379169).tags.name).toContain('Lourenço');
  expect(k.published.observatoryAltitude).toBe(111.229);
  expect(k.towers.find((t) => t.id === 'observatory').height).toBeLessThan(30);
  expect(frame.heading).toBe(0);
  expect(saoJorgeStudy.geographic().status).toBe('draft');
  expect(saoJorgeStudy.geographic().replaceFootprint).toBe(false);
  const pack = JSON.parse(
    readFileSync(new URL('../../../content/worldgen/stylepack.json', import.meta.url)),
  );
  expect(typeof pack.styles[saoJorgeStudy.mediumFiContext.neighborStyle]).toBe('string');
});

it('round-trips every attributed source coordinate within one millimetre', () => {
  const R = 111319.49079327358,
    co = Math.cos((frame.anchor[1] * Math.PI) / 180);
  let count = 0;
  for (const feature of frame.geometry.rawFeatures) {
    expect(feature.lonLat.length).toBe(feature.points.length);
    for (let i = 0; i < feature.points.length; i++) {
      const [x, z] = feature.points[i],
        [lon, lat] = feature.lonLat[i];
      expect(
        Math.hypot(x - (lon - frame.anchor[0]) * R * co, z - (frame.anchor[1] - lat) * R),
      ).toBeLessThan(0.001);
      count++;
    }
  }
  expect(count).toBe(223);
});

it('retains both open courts and their declared floor at every level', () => {
  for (const d of [0, 1, 2, 3]) {
    const m = complete(d);
    for (const court of k.courtyards) {
      let samples = 0;
      for (let x = -34; x < 25; x += 3.73)
        for (let z = -30; z < 23; z += 3.91) {
          if (!inside([x, z], court) || distance([x, z], court) < 2.5) continue;
          if (k.towers.some((t) => inside([x, z], t.ring) || distance([x, z], t.ring) < 0.7))
            continue;
          const found = downward(m, x, z);
          expect(found.length).toBeGreaterThan(0);
          expect(60 - found[0].t, `Blocked court ${x},${z},d${d}`).toBeCloseTo(k.courtY, 3);
          expect(found[0].slot).toBe('paving');
          samples++;
        }
      expect(samples).toBeGreaterThan(30);
    }
  }
});

it('keeps mapped entrance and divider routes open through the real wall masses', () => {
  for (const d of [0, 1, 2, 3]) {
    const m = complete(d);
    for (const h of saoJorgePassages(d).filter((h) => h.way)) {
      const p = saoJorgeRing(h.way),
        a = p[0],
        b = p.at(-1),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        dir = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
      for (const y of [k.courtY + 0.15, k.courtY + 1.2]) {
        const hits = m
          .map((t) => hit([a[0], y, a[1]], dir, t.p))
          .filter((v) => v !== null && v > 0.001 && v < len - 0.001);
        expect(hits, `Blocked ${h.id},Y${y},d${d}`).toHaveLength(0);
      }
    }
  }
});

it('covers the entire current museum footprint and closes every roof edge', () => {
  const p = saoJorgeRing(k.museumWay);
  for (const d of [0, 1, 2, 3]) {
    const m = mesh(saoJorgeParts.museum, d),
      roof = m.filter((t) => t.slot === 'tile');
    let samples = 0;
    for (let x = -67; x < -32; x += 1.37)
      for (let z = 33; z < 150; z += 1.63) {
        if (!inside([x, z], p) || distance([x, z], p) < 0.08) continue;
        const found = downward(roof, x, z);
        expect(found.length, `Missing museum roof ${x},${z},d${d}`).toBeGreaterThan(0);
        expect(60 - found[0].t).toBeGreaterThanOrEqual(k.museumEavesY - 0.00001);
        samples++;
      }
    expect(samples).toBeGreaterThan(300);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        mid = a.map((v, j) => (v + b[j]) / 2),
        normal = [(b[1] - a[1]) / len, 0, -(b[0] - a[0]) / len],
        origin = [mid[0] - normal[0], k.museumEavesY - 0.1, mid[1] - normal[2]];
      expect(
        m
          .filter((t) => t.slot === 'stone')
          .some((t) => {
            const v = hit(origin, normal, t.p);
            return v !== null && v > 0.98 && v < 1.02;
          }),
        `Missing museum facade edge${i},d${d}`,
      ).toBe(true);
    }
  }
});

it('leaves all nine unroofed tower terraces open with one top surface near', () => {
  for (const d of [1, 2, 3])
    for (const t of k.towers.filter((t) => t.roof !== 'hipped')) {
      const q = t.ring.reduce((s, v) => s.map((x, i) => x + v[i] / t.ring.length), [0.153, 0.271]),
        m = mesh((o) => buildSaoJorgeTower(o, t, d), d),
        found = downward(m, q[0], q[1]);
      expect(found.length).toBeGreaterThan(0);
      expect(found[0].slot).toBe('paving');
      expect(60 - found[0].t).toBeCloseTo(k.courtY + t.height - 1.3, 3);
      expect(found.filter((v) => Math.abs(v.t - found[0].t) < 0.0001)).toHaveLength(1);
    }
});

it('retains the full hillside stair link with 149 horizontal treads near', () => {
  expect(k.hillsideStepCount).toBe(149);
  const path = saoJorgeRing(k.hillsideStairsWay),
    a = path.at(-1),
    b = path[0];
  for (const d of [0, 1, 2, 3]) {
    const m = mesh(saoJorgeParts.hills, d);
    for (const fraction of [0.13, 0.37, 0.63, 0.88]) {
      const q = a.map((v, i) => v + (b[i] - v) * fraction),
        found = downward(m, q[0], q[1]);
      const y =
        d >= 2
          ? k.hillsideStairBottomY +
            ((k.hillsideStairTopY - k.hillsideStairBottomY) * Math.ceil(fraction * 149)) / 149
          : k.hillsideStairBottomY + (k.hillsideStairTopY - k.hillsideStairBottomY) * fraction;
      expect(60 - found[0].t).toBeCloseTo(y, 3);
    }
    if (d >= 2)
      expect(
        m.filter(
          (t) => t.slot === 'paving' && t.p.every((v) => Math.abs(v[1] - t.p[0][1]) < 0.00001),
        ),
      ).toHaveLength(298 + 5);
  }
});

it('exports finite nondegenerate float32 faces with correct winding and declared lower/upper bounds', () => {
  for (const d of [0, 1, 2, 3]) {
    const m = complete(d);
    let min = Infinity,
      max = -Infinity;
    for (const t of m) {
      const p = t.p.map((q) => q.map(Math.fround)),
        n = cross(sub(p[1], p[0]), sub(p[2], p[0]));
      expect(Math.hypot(...n)).toBeGreaterThanOrEqual(1e-9);
      expect(dot(n, t.n)).toBeGreaterThanOrEqual(-1e-7);
      for (const q of p) for (const v of q) expect(Number.isFinite(v)).toBe(true);
      for (const q of p) {
        min = Math.min(min, q[1]);
        max = Math.max(max, q[1]);
      }
    }
    expect(min).toBe(0);
    expect(max).toBe(54);
  }
});
