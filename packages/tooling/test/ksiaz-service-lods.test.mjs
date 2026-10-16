import { expect, it } from 'vitest';
import { buildKsiazService } from '../../worldgen/scripts/ksiaz-service-models.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

it('keeps the forester house deterministic, textured and within all browser LOD budgets', async () => {
  const id = 'molen.worldgen.structure.ksiaz_forester_house',
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
    expect(g.materials).toHaveLength(name === 'skyline' ? 1 : 5);
    if (name !== 'skyline') {
      const shared = g.materials.filter((m) => m.extras?.molenSurface);
      expect(shared).toHaveLength(4);
      for (const m of shared)
        expect(['wall', 'roof', 'trim', 'foundation']).toContain(m.extras.molenSurface.slot);
    }
    for (const m of g.meshes)
      for (const p of m.primitives) {
        positions.push(g.accessors[p.attributes.POSITION]);
        for (const index of Object.values(p.attributes)) {
          const a = g.accessors[index];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
      }
    for (const group of types.values()) expect(group.size).toBe(1);
    expect(Math.min(...positions.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...positions.map((a) => a.max[1]))).toBeLessThan(13);
    levels.push(a);
  }
  expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
});

function inside(x, z, t) {
  const sides = t.map((a, i) => {
    const b = t[(i + 1) % 3];
    return (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
  });
  return sides.every((v) => v >= -1e-5) || sides.every((v) => v <= 1e-5);
}
it('covers the main house with continuous roof ranges in every runtime level', () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const roof = [];
    buildKsiazService(
      {
        addTriangle: (s, _r, p) => {
          if (s === 'tile') roof.push(p);
        },
      },
      'ksiaz_forester_house',
      level,
    );
    for (const x of [-5.4, -3.2, -0.3, 1.6, 3.6])
      for (const z of [-5.3, -3.0, 0, 2.8, 6.4])
        expect(
          roof.some(
            (t) =>
              Math.abs(t[0][1] - t[1][1]) + Math.abs(t[1][1] - t[2][1]) > 1e-4 && inside(x, z, t),
          ),
        ).toBe(true);
  }
});

it('seats the side dormer and keeps its window below its gable', () => {
  const windows = [];
  buildKsiazService(
    {
      addTriangle: (s, _r, p) => {
        if (s === 'glass') windows.push(p);
      },
    },
    'ksiaz_forester_house',
  );
  const dormer = windows.filter((t) =>
    t.every((p) => Math.abs(p[0] + 4.882) < 1e-3 && Math.abs(p[2] + 0.25) < 1),
  );
  expect(dormer.length).toBeGreaterThan(0);
  for (const t of dormer)
    for (const p of t) {
      expect(p[1]).toBeGreaterThan(4.6);
      expect(p[1]).toBeLessThan(6.05);
    }
});
