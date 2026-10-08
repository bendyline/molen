import { expect, it } from 'vitest';
import { buildKsiazGate, ksiazGateModels } from '../../worldgen/scripts/ksiaz-gate-models.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

it.each(ksiazGateModels)('keeps $key deterministic, shared and within browser budgets', async ({
  key,
}) => {
  const id = `molen.worldgen.structure.${key}`,
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
    expect(g.materials).toHaveLength(name === 'skyline' ? 1 : key === 'ksiaz_lion_gate' ? 3 : 2);
    if (name !== 'skyline')
      for (const material of g.materials) {
        expect(['wall', 'roof', 'trim', 'foundation', 'window', 'door']).toContain(
          material.extras.molenSurface.slot,
        );
        expect(material.extras.molenSurface.ref).toMatch(/^matgraph:molen\.worldgen\.material\./);
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
    for (const group of types.values()) expect(group.size).toBe(1);
    expect(Math.min(...positions.map((p) => p.min[1]))).toBe(0);
    levels.push(a);
  }
  expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
});
it.each(ksiazGateModels)('retains a real clear passage in $key at every level', ({ key }) => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const blocking = [];
    buildKsiazGate(
      {
        addTriangle: (surface, _r, p) => {
          const center = [0, 1, 2].map((i) => p.reduce((s, v) => s + v[i], 0) / 3);
          if (
            center[1] > 0.2 &&
            center[1] < 2.6 &&
            Math.abs(center[0]) < 0.8 &&
            Math.abs(center[2]) < 0.3
          )
            blocking.push({ surface, center });
        },
      },
      key,
      level,
    );
    expect(blocking).toEqual([]);
  }
});

it('keeps the Lion Gate open to the sky and retains two seated sculpture silhouettes', () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const triangles = [];
    buildKsiazGate({ addTriangle: (_s, _r, p) => triangles.push(p) }, 'ksiaz_lion_gate', level);
    const projectedContains = (p, x, y) => {
      const [a, b, c] = p;
      const determinant = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(determinant) < 1e-8) return false;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / determinant;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / determinant;
      return u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7;
    };
    for (const x of [-1.4, 0, 1.4])
      for (const y of [0.5, 2, 3.5, 5, 6.5, 7.5])
        expect(
          triangles.some((p) => projectedContains(p, x, y)),
          `${level} opening at ${x},${y}`,
        ).toBe(false);
    for (const sign of [-1, 1]) {
      const sculpture = triangles.flat().filter(([x, y]) => sign * x > 2.4 && y > 5.3);
      expect(sculpture.length).toBeGreaterThan(30);
      expect(Math.max(...sculpture.map((p) => p[1]))).toBeGreaterThan(7);
    }
  }
});
