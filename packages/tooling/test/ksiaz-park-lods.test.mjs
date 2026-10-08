import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildKsiazPark, ksiazParkModels } from '../../worldgen/scripts/ksiaz-park-models.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

it.each(ksiazParkModels)('keeps $key deterministic and within browser budgets', async ({ key }) => {
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
    expect(g.materials.length).toBeLessThanOrEqual(8);
    if (name === 'skyline') expect(g.materials).toHaveLength(1);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        positions.push(g.accessors[p.attributes.POSITION]);
        for (const index of Object.values(p.attributes)) {
          const accessor = g.accessors[index];
          if (!types.has(accessor.bufferView)) types.set(accessor.bufferView, new Set());
          types.get(accessor.bufferView).add(accessor.componentType);
        }
      }
    for (const group of types.values()) expect(group.size).toBe(1);
    expect(Math.min(...positions.map((p) => p.min[1]))).toBe(0);
    expect(Math.max(...positions.map((p) => p.max[1]))).toBeLessThan(11);
    levels.push(a);
  }
  expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
});

it('preserves the forge courtyard instead of covering its L with a rectangular roof', () => {
  const roof = [];
  buildKsiazPark(
    {
      addTriangle: (s, _r, p) => {
        if (s === 'slate') roof.push(p);
      },
    },
    'ksiaz_forge',
    'district',
  );
  expect(roof.length).toBeGreaterThan(0);
  for (const t of roof) {
    const x = t.reduce((sum, p) => sum + p[0], 0) / 3,
      z = t.reduce((sum, p) => sum + p[2], 0) / 3;
    expect(x < -4 || z < -3.1).toBe(true);
  }
});

it('leaves real arched wall openings in front of the forge recessed doors', () => {
  const frame = JSON.parse(
      readFileSync(
        new URL(
          '../../../content/worldgen/source/places/u3/u35/ksiaz_forge/map-frame.json',
          import.meta.url,
        ),
      ),
    ),
    loop = frame.geometry.outline,
    a = loop[9],
    b = loop[10],
    center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    nx = dz / length,
    nz = -dx / length,
    triangles = [];
  buildKsiazPark(
    {
      addTriangle: (s, _r, p) => {
        if (s === 'rubble') triangles.push(p);
      },
    },
    'ksiaz_forge',
  );
  const wall = triangles
    .map((t) =>
      t.map((p) => [
        (p[0] - center[0]) * nz - (p[2] - center[1]) * nx,
        p[1],
        (p[0] - center[0]) * nx + (p[2] - center[1]) * nz,
      ]),
    )
    .filter((t) => t.every((p) => Math.abs(p[2]) < 1e-3));
  expect(wall.length).toBeGreaterThan(0);
  const inside = (x, y, t) => {
    const cross = (a, b) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]),
      s = t.map((a, i) => cross(a, t[(i + 1) % 3]));
    return s.every((v) => v > 1e-4) || s.every((v) => v < -1e-4);
  };
  for (const [x] of frame.controls.portals)
    for (const y of [0.5, 1.5, 2.3]) expect(wall.some((t) => inside(x, y, t))).toBe(false);
});
