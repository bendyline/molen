import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ModelLibrary } from '../src/client/instanced-models';
import { createPlantGeometry } from '../src/client/plant-geometry';
import { seasonalPlantPresets } from '../src/kernel/plant-seasons';
import { type PlantPreset, plantPresetSchema } from '../src/kernel/plant-types';

const catalog = JSON.parse(
  await readFile(
    new URL('../../../content/ecology/regional.catalog.json', import.meta.url),
    'utf8',
  ),
) as { plants: PlantPreset[] };
const plants = Object.values(
  seasonalPlantPresets(
    Object.fromEntries(catalog.plants.map((p) => [p.id, plantPresetSchema.parse(p)])),
  ),
);

describe('regional procedural plants', () => {
  it('varies branching and fronds in every family without changing bounds, density or topology', () => {
    expect(catalog.plants).toHaveLength(264);
    expect(plants).toHaveLength(354);
    const families = new Map(catalog.plants.map((p) => [p.family, p]));
    expect(families.size).toBe(19);
    for (const p of families.values()) {
      const base = createPlantGeometry({ ...p, shapeSeed: 0 });
      const a = createPlantGeometry({ ...p, shapeSeed: 137 });
      const b = createPlantGeometry({ ...p, shapeSeed: 911 });
      expect(a.getAttribute('position').array, p.family).not.toEqual(
        base.getAttribute('position').array,
      );
      expect(a.getAttribute('position').array, p.family).not.toEqual(
        b.getAttribute('position').array,
      );
      expect(a.getAttribute('position').count).toBe(base.getAttribute('position').count);
      expect(a.boundingBox?.max.y).toBeCloseTo(base.boundingBox?.max.y ?? 0, 4);
      base.dispose();
      a.dispose();
      b.dispose();
    }
  });
  it('keeps every preset finite, ground aligned, outward wound, and bounded at all detail levels', () => {
    expect(plants.length).toBeGreaterThanOrEqual(40);
    for (const p of plants) {
      const counts: number[] = [];
      for (const detail of [false, true, 'distant'] as const) {
        const g = createPlantGeometry(p, detail);
        const positions = g.getAttribute('position'),
          normals = g.getAttribute('normal');
        const ground = ['grass', 'fern', 'reed', 'forb', 'vine', 'mat', 'crop'].includes(p.family);
        counts.push(positions.count / 3);
        expect(positions.count / 3, `${p.id}/${detail}`).toBeLessThanOrEqual(
          detail === 'distant' ? 64 : detail ? 140 : 450,
        );
        expect([...positions.array].every(Number.isFinite), p.id).toBe(true);
        expect([...normals.array].every(Number.isFinite), p.id).toBe(true);
        for (let i = 0; i < normals.count; i++)
          expect(
            Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)),
            `${p.id}: degenerate face`,
          ).toBeGreaterThan(0.99);
        if (ground && detail !== false) {
          expect(positions.count).toBe(0);
          g.dispose();
          continue;
        }
        expect(g.boundingBox?.min.y, p.id).toBeCloseTo(ground ? 0.15 : 0, 4);
        expect(g.boundingBox?.max.y, p.id).toBeCloseTo(p.height + (ground ? 0.15 : 0), 4);
        let volume = 0;
        for (let i = 0; i < positions.count; i += 3) {
          const ax = positions.getX(i),
            ay = positions.getY(i),
            az = positions.getZ(i);
          const bx = positions.getX(i + 1),
            by = positions.getY(i + 1),
            bz = positions.getZ(i + 1);
          const cx = positions.getX(i + 2),
            cy = positions.getY(i + 2),
            cz = positions.getZ(i + 2);
          volume +=
            (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
        }
        expect(volume, `${p.id}/${detail}: inverted or zero-volume mesh`).toBeGreaterThan(0);
        g.dispose();
      }
      expect(counts[0]).toBeGreaterThan(counts[1] as number);
      if ((counts[1] as number) > 0) expect(counts[1]).toBeGreaterThan(counts[2] as number);
    }
  });

  it('caches and releases distinct procedural LODs without requesting a GLB', async () => {
    const p = plants.find((entry) => entry.family === 'palm');
    if (p === undefined) throw new Error('Missing palm fixture');
    const library = new ModelLibrary(
      async () => {
        throw new Error('Procedural plants must not fetch GLBs');
      },
      {},
      false,
      { [p.id]: p },
    );
    const near = await library.acquire(p.id);
    const far = await library.acquire(p.id, 'distant');
    expect(near.geometry).not.toBe(far.geometry);
    expect(far.geometry.getAttribute('position').count).toBeLessThan(
      near.geometry.getAttribute('position').count,
    );
    expect(await library.prepare(p.id)).toBe(near);
    library.release(p.id, 'distant');
    expect(library.get(p.id, 'distant')).toBeUndefined();
    expect(library.get(p.id)).toBe(near);
    library.release(p.id);
    expect(library.get(p.id)).toBeUndefined();
    library.dispose();
  });
});
