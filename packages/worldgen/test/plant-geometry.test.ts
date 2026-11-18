import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ModelLibrary } from '../src/client/instanced-models';
import { createPlantGeometry } from '../src/client/plant-geometry';
import { SCATTER_MASS_UV, SCATTER_SOLID_UV } from '../src/client/scatter-material';
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
  it('covers every catalog preset and its declared seasonal variants', () => {
    expect(new Set(catalog.plants.map((p) => p.id)).size).toBe(catalog.plants.length);
    const expectedIds = catalog.plants.flatMap((p) =>
      p.phenology === undefined
        ? [p.id]
        : [p.id, `${p.id}.spring`, `${p.id}.autumn`, `${p.id}.winter`],
    );
    expect(plants.map((p) => p.id).sort()).toEqual(expectedIds.sort());
  });
  it('varies branching and fronds in every family without changing bounds, density or topology', () => {
    const families = new Map(catalog.plants.map((p) => [p.family, p]));
    expect(families.size).toBe(21);
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
  }, 30_000); // Checks every preset's vertices at three detail levels; exceeds 5 s on CI.

  it('draws a far broadleaf crown round the near crown, on its trunk', () => {
    const tree = catalog.plants.find(
      (plant) => plant.id === 'molen.ecology.plant.maple' && plant.family === 'broadleaf',
    );
    if (!tree) throw new Error('Missing maple fixture');
    const p = { ...tree, shapeSeed: 0 };
    // Per level: how wide the tree is at each tenth of its height, and where its foliage is.
    const profile = (detail: boolean | 'distant' | 'horizon') => {
      const geometry = createPlantGeometry(p, detail);
      const position = geometry.getAttribute('position');
      const uv = geometry.getAttribute('uv');
      const widths = new Array<number>(10).fill(0);
      let lowestFoliage = Number.POSITIVE_INFINITY;
      let mass = 0;
      for (let i = 0; i < position.count; i++) {
        const band = Math.min(9, Math.floor((position.getY(i) / p.height) * 10));
        widths[band] = Math.max(
          widths[band] as number,
          Math.hypot(position.getX(i) - p.lean * p.height, position.getZ(i)),
        );
        const isMass =
          uv.getX(i) === Math.fround(SCATTER_MASS_UV[0]) &&
          uv.getY(i) === Math.fround(SCATTER_MASS_UV[1]);
        const isCard = uv.getX(i) < 0.9;
        if (isMass) mass++;
        if (isMass || isCard) lowestFoliage = Math.min(lowestFoliage, position.getY(i));
      }
      const triangles = position.count / 3;
      geometry.dispose();
      return { widths, lowestFoliage, mass, triangles };
    };
    const near = profile(false);
    const far = profile('distant');
    const horizon = profile('horizon');
    // The near tree is a trunk under a crown: nothing but stem in its lowest fifth.
    expect(Math.max(near.widths[0] as number, near.widths[1] as number)).toBeLessThan(
      p.width * 0.1,
    );
    // So is the far one. As one ellipsoid over the tree's whole height it was half the tree's
    // width at a tenth of its height, and its widest at the middle.
    expect(Math.max(far.widths[0] as number, far.widths[1] as number)).toBeLessThan(p.width * 0.1);
    expect(far.lowestFoliage).toBeGreaterThan(p.height * p.crownBase * 0.6);
    expect(far.lowestFoliage).toBeLessThan(near.lowestFoliage + p.height * 0.08);
    // Both are widest in the same part of the crown, and to nearly the same width.
    const widest = (widths: number[]): number => widths.indexOf(Math.max(...widths));
    expect(Math.abs(widest(far.widths) - widest(near.widths))).toBeLessThanOrEqual(1);
    expect(Math.max(...far.widths)).toBeGreaterThan(Math.max(...near.widths) * 0.8);
    expect(Math.max(...far.widths)).toBeLessThanOrEqual(Math.max(...near.widths) * 1.001);
    // Its crown is a foliage mass, and all of its crown: the trunk is eight triangles of bark.
    expect(far.mass).toBe((far.triangles - 8) * 3);
    expect(far.triangles).toBeLessThanOrEqual(56);
    // Past it the horizon level has no trunk and fewer faces, and stands at the same height.
    expect(horizon.triangles).toBeLessThanOrEqual(30);
    expect(horizon.mass).toBe(horizon.triangles * 3);
    expect(horizon.lowestFoliage).toBeGreaterThan(p.height * p.crownBase * 0.6);
    // Its corners reach a little past the far crown's: with fewer sides its outline cuts
    // inside theirs, and at the same reach a wood thinned where the two levels met.
    expect(Math.max(...horizon.widths)).toBeGreaterThan(Math.max(...far.widths));
    expect(Math.max(...horizon.widths)).toBeLessThan(Math.max(...far.widths) * 1.25);
  });

  it('gives conifers a horizon cone past a far level that keeps their skirts', async () => {
    const fir = plants.find((entry) => entry.family === 'conifer' && !entry.leafless);
    const palm = plants.find((entry) => entry.family === 'palm');
    if (fir === undefined || palm === undefined) throw new Error('Missing fixtures');
    const triangles = (geometry: { getAttribute(name: string): { count: number } }): number =>
      geometry.getAttribute('position').count / 3;
    const far = createPlantGeometry(fir, 'distant');
    const horizon = createPlantGeometry(fir, 'horizon');
    expect(triangles(horizon)).toBeLessThanOrEqual(16);
    expect(triangles(far)).toBeGreaterThan(triangles(horizon) * 3);
    // The far outline steps in and out up the tree; the horizon one only narrows.
    const widths = (geometry: typeof far): number[] => {
      const position = geometry.getAttribute('position');
      const byHeight = new Map<number, number>();
      for (let i = 0; i < position.count; i++) {
        const y = Math.round(position.getY(i) * 20) / 20;
        byHeight.set(
          y,
          Math.max(byHeight.get(y) ?? 0, Math.hypot(position.getX(i), position.getZ(i))),
        );
      }
      return [...byHeight.entries()].sort((a, b) => a[0] - b[0]).map(([, width]) => width);
    };
    const widens = (values: number[]): number =>
      values.filter((value, i) => i > 0 && value > (values[i - 1] as number) * 1.1).length;
    expect(widens(widths(far))).toBe(2);
    expect(widens(widths(horizon))).toBe(0);
    far.dispose();
    horizon.dispose();
    const library = new ModelLibrary(undefined, {}, false, { [fir.id]: fir, [palm.id]: palm });
    expect(await library.prepare(fir.id, 'horizon')).not.toBe(
      await library.prepare(fir.id, 'distant'),
    );
    // A palm's horizon level is its far model, cached once.
    expect(await library.prepare(palm.id, 'horizon')).toBe(
      await library.prepare(palm.id, 'distant'),
    );
    library.dispose();
    // A broadleaf tree in leaf has one of its own; a bare one and a shrub do not.
    const maple = plants.find((entry) => entry.id === 'molen.ecology.plant.maple');
    const bare = plants.find((entry) => entry.id === 'molen.ecology.plant.maple.winter');
    if (maple === undefined || bare === undefined) throw new Error('Missing maple fixtures');
    const broadleaf = new ModelLibrary(undefined, {}, false, {
      [maple.id]: maple,
      [bare.id]: bare,
    });
    expect(await broadleaf.prepare(maple.id, 'horizon')).not.toBe(
      await broadleaf.prepare(maple.id, 'distant'),
    );
    expect(await broadleaf.prepare(bare.id, 'horizon')).toBe(
      await broadleaf.prepare(bare.id, 'distant'),
    );
    expect(await broadleaf.prepare('builtin:shrub', 'horizon')).toBe(
      await broadleaf.prepare('builtin:shrub', 'distant'),
    );
    broadleaf.dispose();
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
            // Bark and cores are plain solids; a far crown is a foliage mass.
            expect([SCATTER_SOLID_UV[1], SCATTER_MASS_UV[1]].map(Math.fround)).toContain(
              uv.getY(i),
            );
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
