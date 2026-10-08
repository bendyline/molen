import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildOldKsiaz } from '../../worldgen/scripts/old-ksiaz-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

it('keeps the mapped ruin within all deterministic browser LOD and shared material budgets', async () => {
  const id = 'molen.worldgen.structure.old_ksiaz_ruins',
    levels = [];
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const build = () => (name === 'skyline' ? authoredSkyline(id) : authoredDetail(id, name)),
      a = await build(),
      b = await build();
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.triangles).toBeLessThanOrEqual(cap);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12))),
      types = new Map(),
      positions = [];
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials).toHaveLength(name === 'skyline' ? 1 : 3);
    if (name !== 'skyline')
      for (const m of g.materials) {
        expect(['wall', 'trim']).toContain(m.extras.molenSurface.slot);
        expect([
          'matgraph:molen.worldgen.material.stone_drywall',
          'matgraph:molen.worldgen.material.brick',
          'matgraph:molen.worldgen.material.stone_limestone',
        ]).toContain(m.extras.molenSurface.ref);
      }
    for (const m of g.meshes)
      for (const p of m.primitives) {
        positions.push(g.accessors[p.attributes.POSITION]);
        for (const i of Object.values(p.attributes)) {
          const a = g.accessors[i];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
      }
    for (const t of types.values()) expect(t.size).toBe(1);
    expect(Math.min(...positions.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...positions.map((a) => a.max[1]))).toBeLessThan(12);
    levels.push(a);
  }
  expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
});

function hit(x, y, t) {
  const [a, b, c] = t,
    den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-8) return false;
  const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den,
    v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001;
}
it('preserves real portal and pointed-window openings and outward wall caps at every level', () => {
  const f = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u3/u35/old_ksiaz_ruins/map-frame.json',
        import.meta.url,
      ),
    ),
  );
  const [a, b] = f.geometry.centerlines.find((w) => w.way === f.controls.mainFacadeWay).points,
    l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    ux = (b[0] - a[0]) / l,
    uz = (b[1] - a[1]) / l;
  const local = (p) => [
    (p[0] - a[0]) * ux + (p[2] - a[1]) * uz,
    p[1],
    -(p[0] - a[0]) * uz + (p[2] - a[1]) * ux,
  ];
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const triangles = [];
    buildOldKsiaz(
      { addTriangle: (s, _r, p, n) => triangles.push({ s, p, n, local: p.map(local) }) },
      'old_ksiaz_ruins',
      level,
    );
    const slab = triangles.filter((t) =>
      t.local.every((p) => Math.abs(p[2]) < 0.7 && p[0] >= -1e-3 && p[0] <= l + 1e-3),
    );
    for (const [x, y] of [
      [l * 0.78, 2.9],
      [l * 0.21, 6.2],
      [l * 0.47, 6.2],
    ])
      expect(slab.some((t) => hit(x, y, t.local))).toBe(false);
    expect(slab.some((t) => hit(l * 0.58, 3.8, t.local))).toBe(true);
    const bottom = triangles.filter((t) => t.p.every((p) => p[1] === 0));
    expect(bottom.length).toBeGreaterThan(0);
    for (const t of bottom) expect(t.n[1]).toBeLessThan(-0.99);
    // Elevated horizontal/diagonal cap surfaces close the broken wall tops, not a roof plane.
    const tops = triangles.filter(
      (t) => t.s === 'rubble' && Math.abs(t.n[1]) > 0.01 && !t.p.every((p) => p[1] === 0),
    );
    expect(tops.some((t) => t.n[1] > 0.8)).toBe(true);
  }
});
