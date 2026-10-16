import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildKsiazStable } from '../../worldgen/scripts/ksiaz-stable-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

it('keeps the stable ensemble deterministic and within browser budgets using shared materials', async () => {
  const id = 'molen.worldgen.structure.ksiaz_stable_ensemble',
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
      pos = [];
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials).toHaveLength(name === 'skyline' ? 1 : 7);
    if (name !== 'skyline')
      expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(6);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        pos.push(g.accessors[p.attributes.POSITION]);
        for (const i of Object.values(p.attributes)) {
          const a = g.accessors[i];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
      }
    for (const t of types.values()) expect(t.size).toBe(1);
    expect(Math.min(...pos.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...pos.map((a) => a.max[1]))).toBeLessThan(22);
    levels.push(a);
  }
  expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
});
function barycentric(x, y, t) {
  const [a, b, c] = t,
    den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-8) return null;
  const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den,
    v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001 ? [u, v, 1 - u - v] : null;
}
it('retains a true open quadrangle, secondary entry and arched gate passage at every level', () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const tris = [];
    buildKsiazStable({ addTriangle: (_s, _r, p) => tris.push(p) }, 'ksiaz_stable_ensemble', level);
    const vertical = (x, z) =>
      tris
        .flatMap((t) => {
          const w = barycentric(
            x,
            z,
            t.map((v) => [v[0], v[2]]),
          );
          return w ? [w.reduce((s, v, i) => s + v * t[i][1], 0)] : [];
        })
        .filter((y) => y > 0.02);
    for (const [x, z] of [
      [0, 0],
      [10, 10],
      [-40, 0],
      [40, 0],
      [0, -42],
      [0, 40],
      [-57, 40],
    ])
      expect(vertical(x, z), `${level} courtyard ${x},${z}`).toHaveLength(0);
    expect(vertical(90, -17).some((y) => y >= 10 && y < 13)).toBe(true);
    const gate = (y, z) =>
      tris
        .flatMap((t) => {
          const w = barycentric(
            y,
            z,
            t.map((v) => [v[1], v[2]]),
          );
          return w ? [w.reduce((s, v, i) => s + v * t[i][0], 0)] : [];
        })
        .filter((x) => x > -65 && x < -50);
    for (const z of [-12, -10.4, -8.8]) expect(gate(2, z), `${level} gate ${z}`).toHaveLength(0);
    expect(gate(5.4, -10.4)).toHaveLength(0);
    expect(gate(8, -10.4).length).toBeGreaterThan(0);
    expect(gate(2, -16).length).toBeGreaterThan(0);
  }
});

it('covers every mapped stable perimeter with a roof, including porch and turret projections', () => {
  const frame = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u3/u35/ksiaz_stable_ensemble/map-frame.json',
        import.meta.url,
      ),
    ),
  );
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const roofs = [];
    buildKsiazStable(
      {
        addTriangle: (s, _r, p) => {
          if (s === 'tile' || s === 'slate') roofs.push(p);
        },
      },
      'ksiaz_stable_ensemble',
      level,
    );
    const covered = (x, z) =>
      roofs.some(
        (t) =>
          !!barycentric(
            x,
            z,
            t.map((p) => [p[0], p[2]]),
          ),
      );
    for (let i = 0; i < frame.geometry.outline.length - 1; i++) {
      const a = frame.geometry.outline[i],
        b = frame.geometry.outline[i + 1];
      for (const t of [0, 0.25, 0.5, 0.75, 1])
        expect(
          covered(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t),
          `${level} roof edge ${i} at ${t}`,
        ).toBe(true);
    }
  }
});
