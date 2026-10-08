import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildKsiazPalm } from '../../worldgen/scripts/ksiaz-palm-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

it('keeps the Palm House source and all four levels deterministic, shared and within browser budgets', async () => {
  const id = 'molen.worldgen.structure.ksiaz_palm_house',
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
    expect(g.materials).toHaveLength(name === 'skyline' ? 1 : 4);
    if (name !== 'skyline')
      expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(3);
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
    expect(Math.max(...pos.map((a) => a.max[1]))).toBe(15);
    levels.push(a);
  }
  expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
});
function weights(x, y, t) {
  const [a, b, c] = t,
    den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-8) return null;
  const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den,
    v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001 ? [u, v, 1 - u - v] : null;
}
const triangles = (level) => {
  const t = [];
  buildKsiazPalm({ addTriangle: (s, _r, p, n) => t.push({ s, p, n }) }, 'ksiaz_palm_house', level);
  return t;
};
it('retains both true open courtyards, the tall central hall and entrance porch at every level', () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const t = triangles(level),
      vertical = (x, z) =>
        t
          .flatMap(({ p }) => {
            const w = weights(
              x,
              z,
              p.map((v) => [v[0], v[2]]),
            );
            return w ? [w.reduce((s, v, i) => s + v * p[i][1], 0)] : [];
          })
          .filter((y) => y > 0.01);
    for (const [x, z] of [
      [-20, -5],
      [20, -5],
      [-20, -22],
      [20, -22],
    ])
      expect(vertical(x, z), `${level} courtyard ${x},${z}`).toHaveLength(0);
    expect(vertical(0, 11).some((y) => Math.abs(y - 15) < 1e-4)).toBe(true);
    expect(vertical(0, 20.5).some((y) => y >= 3.8 && y < 5.5)).toBe(true);
    // The simplified skyline closes its low walls at the flat roof. Near gables close at their pitched roofs.
    const end = (x, y) =>
      t
        .flatMap(({ p }) => {
          const w = weights(
            x,
            y,
            p.map((v) => [v[0], v[1]]),
          );
          return w ? [w.reduce((s, v, i) => s + v * p[i][2], 0)] : [];
        })
        .filter((z) => z > 31.45 && z < 31.75);
    expect(
      end(-49.8, level === 'skyline' ? 2.75 : 3.4).length,
      `${level} closed greenhouse gable`,
    ).toBeGreaterThan(0);
  }
});
function roofContains(x, y, t) {
  const [a, b, c] = t,
    sign = Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  if (!sign) return false;
  // Absolute 2mm allowance for millimeter map coordinates split into Float32 sliver triangles.
  return t.every((p, i) => {
    const q = t[(i + 1) % 3],
      length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return (
      length > 0 &&
      (sign * ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]))) / length >= -0.002
    );
  });
}
it('covers the own perimeter within 2mm and keeps courtyard walls facing their openings', () => {
  const frame = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_house/map-frame.json',
        import.meta.url,
      ),
    ),
  );
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const t = triangles(level),
      roof = t.filter((v) => v.n[1] > 0.01 && v.p.every((p) => p[1] > 2));
    for (let i = 1; i < frame.geometry.outline.length; i++)
      for (const f of [0.25, 0.5, 0.75]) {
        const a = frame.geometry.outline[i - 1],
          b = frame.geometry.outline[i],
          x = a[0] + (b[0] - a[0]) * f,
          z = a[1] + (b[1] - a[1]) * f;
        expect(
          roof.some(({ p }) =>
            roofContains(
              x,
              z,
              p.map((v) => [v[0], v[2]]),
            ),
          ),
          `${level} perimeter ${i},${f}`,
        ).toBe(true);
      }
    // Left and right courtyard west boundaries must be visible from the empty courtyard.
    for (const [x, z] of [
      [-46.45, -20],
      [3.7, -22],
    ]) {
      const nearby = t.filter(
        (v) =>
          Math.abs(v.n[0]) > 0.95 &&
          v.p.every((p) => p[1] <= 2.9) &&
          v.p.some((p) => Math.abs(p[0] - x) < 0.3 && Math.abs(p[2] - z) < 20),
      );
      expect(
        nearby.some((v) => v.n[0] > 0),
        `${level} inward courtyard wall ${x},${z}`,
      ).toBe(true);
    }
  }
  const spec = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_house/spec.json',
        import.meta.url,
      ),
    ),
  );
  expect(spec.sitePart.identity).toEqual({ type: 'relation', id: 3532583 });
  expect(spec.geographicProposal.featureIds).toEqual(['relation/3532583']);
});
