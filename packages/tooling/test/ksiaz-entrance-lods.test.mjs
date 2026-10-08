import { expect, it } from 'vitest';
import {
  buildKsiazEntrance,
  ksiazEntranceModels,
} from '../../worldgen/scripts/ksiaz-entrance-models.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

it.each(
  ksiazEntranceModels,
)('keeps $key source-specific, deterministic and within browser budgets', async ({ key }) => {
  const id = `molen.worldgen.structure.${key}`,
    levels = [];
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const build = () => (name === 'skyline' ? authoredSkyline(id) : authoredDetail(id, name));
    const a = await build(),
      b = await build();
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.triangles).toBeLessThanOrEqual(cap);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.length).toBeLessThanOrEqual(5);
    const types = new Map(),
      positions = [];
    for (const mesh of g.meshes)
      for (const primitive of mesh.primitives) {
        positions.push(g.accessors[primitive.attributes.POSITION]);
        for (const index of Object.values(primitive.attributes)) {
          const accessor = g.accessors[index];
          if (!types.has(accessor.bufferView)) types.set(accessor.bufferView, new Set());
          types.get(accessor.bufferView).add(accessor.componentType);
        }
      }
    for (const typesInView of types.values()) expect(typesInView.size).toBe(1);
    expect(Math.min(...positions.map((p) => p.min[1]))).toBe(0);
    expect(Math.max(...positions.map((p) => p.max[1]))).toBeLessThanOrEqual(22);
    levels.push(a);
  }
  expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
});

it.each(ksiazEntranceModels)('keeps $key window surfaces distinct and facing outward', ({
  key,
}) => {
  const glass = [];
  buildKsiazEntrance(
    {
      addTriangle: (surface, _ref, points, normal) => {
        if (surface === 'glass') glass.push({ points, normal });
      },
    },
    key,
  );
  const signatures = glass.map((t) =>
    t.points
      .map((p) => p.map((v) => Math.round(v * 1000)).join(','))
      .sort()
      .join(';'),
  );
  expect(new Set(signatures).size).toBe(glass.length);
  if (key !== 'ksiaz_gatehouse') return;
  for (const center of [
    [0.81, -15.14],
    [1.813, 15.164],
  ]) {
    const tower = glass.filter((t) => {
      const x = t.points.reduce((n, p) => n + p[0], 0) / 3,
        z = t.points.reduce((n, p) => n + p[2], 0) / 3;
      return Math.hypot(x - center[0], z - center[1]) < 4.4;
    });
    expect(tower.length).toBeGreaterThan(0);
    for (const t of tower) {
      const midpoint = [0, 2].map((i) => t.points.reduce((n, p) => n + p[i], 0) / 3);
      const outward =
        (midpoint[0] - center[0]) * t.normal[0] + (midpoint[1] - center[1]) * t.normal[2];
      expect(outward).toBeGreaterThan(3.7);
    }
  }
});
