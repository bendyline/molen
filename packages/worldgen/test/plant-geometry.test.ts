import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ModelLibrary } from '../src/client/instanced-models';
import { createPlantGeometry } from '../src/client/plant-geometry';
import { SCATTER_SOLID_UV } from '../src/client/scatter-material';
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
      // Leaf cards' clear corners may reach a little past the visible top.
      expect(Math.abs((a.boundingBox?.max.y ?? 0) - (base.boundingBox?.max.y ?? 0))).toBeLessThan(
        p.height * 0.03,
      );
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
          detail === 'distant' ? 64 : detail ? 140 : 640,
        );
        expect([...positions.array].every(Number.isFinite), p.id).toBe(true);
        expect([...normals.array].every(Number.isFinite), p.id).toBe(true);
        for (let i = 0; i < normals.count; i++)
          expect(
            Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)),
            `${p.id}: degenerate face`,
          ).toBeGreaterThan(0.99);
        // Ground cover draws near only; understory shrubs have no distant level.
        if ((ground && detail !== false) || (detail === 'distant' && p.height < 2.5)) {
          expect(positions.count).toBe(0);
          g.dispose();
          continue;
        }
        // Sized by what can be seen: a leaf card's clear corners may overshoot a little.
        const bottom = ground ? 0.15 : 0;
        expect(g.boundingBox?.min.y, p.id).toBeLessThan(bottom + 1e-4);
        expect(g.boundingBox?.min.y, p.id).toBeGreaterThan(bottom - p.height * 0.03);
        const top = p.height + bottom;
        expect(g.boundingBox?.max.y, p.id).toBeGreaterThan(top - 1e-4);
        expect(g.boundingBox?.max.y, p.id).toBeLessThan(top * 1.03);
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
  }, 30_000); // Checks every vertex of 354 presets at three detail levels; exceeds 5 s on CI.

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
  it('shades crowns as rounded masses: facets meeting at a vertex nearly agree', () => {
    // Every vertex shared by two or more foliage facets: the spread of their normals there.
    const agreement = (family: string): number => {
      const p = catalog.plants.find((plant) => plant.family === family && !plant.leafless);
      if (!p) throw new Error(`no ${family} plant`);
      const geometry = createPlantGeometry({ ...p, shapeSeed: 0 }, 'distant');
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const byPoint = new Map<string, number[]>();
      for (let i = 0; i < position.count; i++) {
        const key = [position.getX(i), position.getY(i), position.getZ(i)]
          .map((v) => v.toFixed(4))
          .join();
        byPoint.set(key, [...(byPoint.get(key) ?? []), i]);
      }
      let worst = 1;
      for (const indices of byPoint.values())
        for (const a of indices)
          for (const b of indices)
            worst = Math.min(
              worst,
              normal.getX(a) * normal.getX(b) +
                normal.getY(a) * normal.getY(b) +
                normal.getZ(a) * normal.getZ(b),
            );
      geometry.dispose();
      return worst;
    };
    // A five-sided crown's flat facets meet at 72 degrees; bent toward the volume they stay
    // within about 40.
    expect(agreement('broadleaf')).toBeGreaterThan(0.75);
    expect(agreement('conifer')).toBeGreaterThan(0.75);
  });
  it('shades leaf clusters smoothly: every facet meeting at a crown vertex gives it one color', () => {
    const p = catalog.plants.find((plant) => plant.family === 'broadleaf' && !plant.leafless);
    if (!p) throw new Error('no broadleaf plant');
    const geometry = createPlantGeometry({ ...p, shapeSeed: 0 });
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    // Foliage vertices are the foliage color scaled by their shade; bark tubes are left out.
    const leaf = new THREE.Color(p.foliage);
    const foliage = (i: number): boolean => {
      const k = color.getX(i) / leaf.r;
      return (
        Math.abs(color.getY(i) - k * leaf.g) < 1e-4 && Math.abs(color.getZ(i) - k * leaf.b) < 1e-4
      );
    };
    const byPoint = new Map<string, number[]>();
    for (let i = 0; i < position.count; i++) {
      if (!foliage(i)) continue;
      const key = [position.getX(i), position.getY(i), position.getZ(i)]
        .map((v) => v.toFixed(5))
        .join();
      byPoint.set(key, [...(byPoint.get(key) ?? []), i]);
    }
    let shared = 0,
      spread = 0;
    for (const indices of byPoint.values()) {
      if (indices.length < 2) continue;
      shared++;
      const values = indices.map((i) => color.getX(i) + color.getY(i) + color.getZ(i));
      spread = Math.max(spread, Math.max(...values) - Math.min(...values));
    }
    geometry.dispose();
    expect(shared).toBeGreaterThan(50);
    // Flat bands put two shades on every ring vertex; a gradient gives each vertex one.
    expect(spread).toBeLessThan(1e-6);
  });
  it('crowns trees with double-sided leaf and bough cards near and at medium range only', () => {
    // Card vertices per detail level, by atlas region: the leaf sprig left of u = 0.5, the fir
    // spray right of it; everything else samples the solid block.
    const cards = (family: string): [number, number][] => {
      const p = catalog.plants.find(
        (plant) => plant.family === family && !plant.leafless && !plant.climber,
      );
      if (!p) throw new Error(`no ${family} plant`);
      return [false, true, 'distant'].map((detail) => {
        const geometry = createPlantGeometry({ ...p, shapeSeed: 0 }, detail as boolean | 'distant');
        const uv = geometry.getAttribute('uv');
        const counts: [number, number] = [0, 0];
        for (let i = 0; i < uv.count; i++) {
          if (uv.getX(i) === Math.fround(SCATTER_SOLID_UV[0])) {
            expect(uv.getY(i)).toBe(Math.fround(SCATTER_SOLID_UV[1]));
            continue;
          }
          expect(uv.getX(i)).toBeLessThan(0.9);
          counts[uv.getX(i) <= 0.5 ? 0 : 1]++;
        }
        geometry.dispose();
        return counts;
      });
    };
    // Twelve vertices a card: two triangles a face, a face either way. A broadleaf crown has
    // four cards a cluster near (twenty clusters) and three at medium (six); a conifer has
    // thirty-seven boughs over five skirts near and ten over four at medium.
    expect(cards('broadleaf')).toEqual([
      [20 * 4 * 12, 0],
      [6 * 3 * 12, 0],
      [0, 0],
    ]);
    expect(cards('conifer')).toEqual([
      [0, 37 * 12],
      [0, 10 * 12],
      [0, 0],
    ]);
  });
});
