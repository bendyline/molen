import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ArchStyleDoc } from '../../src/kernel/archstyle-types';
import { generateBuilding } from '../../src/kernel/building';
import { generateInteriorGeometry } from '../../src/kernel/interior-geometry';
import { generateInteriorPlan, interiorRectFits } from '../../src/kernel/interior-plan';
import type { InteriorPlan, InteriorSite } from '../../src/kernel/interior-types';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { FLAT_GROUND, type Vec2 } from '../../src/kernel/types';
import { INTERIORS } from '../helpers/content';

const content = fileURLToPath(new URL('../../../../content/worldgen/', import.meta.url));
const rect = (w: number, d: number): Vec2[] => [
  [0, 0],
  [w, 0],
  [w, d],
  [0, d],
];
// label, style file, width, depth, height
const STEREOTYPES: readonly [string, string, number, number, number][] = [
  ['office', 'use/office_block', 44, 36, 30],
  ['skyscraper', 'use/skyscraper', 42, 42, 160],
  ['apartment_tower', 'use/apartment_tower', 40, 30, 70],
  ['apartments', 'use/apartment_tower', 36, 22, 18],
  ['hotel', 'use/hotel', 60, 24, 40],
  ['hospital', 'use/hospital', 80, 44, 30],
  ['school', 'use/school', 70, 40, 10],
  ['civic', 'use/civic', 40, 30, 14],
  ['mall', 'generic/shopping_mall', 150, 120, 14],
  ['place_of_worship', 'use/place_of_worship', 18, 36, 12],
  ['theatre', 'use/theatre', 28, 36, 14],
  ['cinema', 'use/theatre', 30, 34, 12],
  ['museum', 'use/museum', 60, 44, 14],
  ['sports_hall', 'use/sports_hall', 36, 34, 10],
  ['station', 'catalog/railway_station', 60, 26, 12],
  ['fire_station', 'catalog/brick_fire_station', 28, 22, 8],
];
const styles = new Map<string, ArchStyleDoc>();
beforeAll(async () => {
  for (const [, file] of STEREOTYPES)
    styles.set(
      file,
      JSON.parse(await readFile(resolve(content, `styles/${file}.archstyle.json`), 'utf8')),
    );
});

function building(label: string, file: string, w: number, d: number, height: number): InteriorSite {
  const result = generateBuilding(
    {
      request: {
        identity: `s:${label}`,
        labels: [label, 'building'],
        outline: rect(w, d),
        height,
        interiorLabels: [label],
      },
      style: styles.get(file) as ArchStyleDoc,
      pack: { name: 'test', version: '1' },
      ground: FLAT_GROUND,
      tier: 0,
      interiors: INTERIORS,
    },
    new MeshBufferBuilder(),
  );
  const site = result.record?.interior;
  if (!site) throw new Error(`${label}: no site`);
  return site;
}
const count = (plan: InteriorPlan, kind: string): number =>
  plan.fixtures.filter((f) => f.kind === kind).length;

describe('building stereotypes', () => {
  for (const [label, file, w, d, height] of STEREOTYPES)
    it(`generates ${label} inside and out, under budget and deterministically`, () => {
      const site = building(label, file, w, d, height);
      const plan = generateInteriorPlan(site, { catalog: INTERIORS });
      expect(plan.profile).not.toBe('generic');
      const geometry = generateInteriorGeometry(plan, INTERIORS);
      expect(geometry.structure.triangleCount).toBeGreaterThan(20);
      expect(plan.fixtures.length + (plan.tower?.cells.length ?? 0)).toBeGreaterThan(0);
      // Interior streaming refuses anything over its 16 MiB resident cap.
      expect(geometry.bytes).toBeLessThan(12 * 1024 * 1024);
      expect(generateInteriorPlan(site, { catalog: INTERIORS }).fixtures).toEqual(plan.fixtures);
    });

  it('gives a tower a storey for each floor of its height, and lifts inside the plate', () => {
    const site = building('skyscraper', 'use/skyscraper', 42, 42, 160);
    expect(site.storeys?.length).toBeGreaterThan(30);
    const plan = generateInteriorPlan(site, { catalog: INTERIORS });
    expect(plan.tower?.elevators.length).toBeGreaterThanOrEqual(4);
    for (const lift of plan.tower?.elevators ?? [])
      expect(interiorRectFits(site, lift.bounds, 0.1)).toBe(true);
  });

  it('builds only the floors around a viewer, so a tall tower costs what a short one does', () => {
    const site = building('skyscraper', 'use/skyscraper', 42, 42, 160);
    expect(generateInteriorPlan(site, { catalog: INTERIORS }).tower?.levels).toEqual([0, 1]);
    const high = generateInteriorPlan(site, { catalog: INTERIORS, focus: 20 });
    expect(high.tower?.levels).toEqual([0, 19, 20, 21]);
    expect(high.storeys).toHaveLength(4);
    expect(high.storeys[2]).toEqual(site.storeys?.[20]);
    expect(generateInteriorGeometry(high, INTERIORS).bytes).toBeLessThan(8 * 1024 * 1024);
    // Fixtures address the storeys built, not the building's own numbering.
    expect(Math.max(...high.fixtures.map((f) => f.level ?? 0))).toBeLessThan(4);
  });

  it('leaves the lobby clear with rooms beyond it', () => {
    const plan = generateInteriorPlan(building('hotel', 'use/hotel', 60, 24, 40), {
      catalog: INTERIORS,
    });
    expect(count(plan, 'reception')).toBe(1);
    expect(plan.tower?.cells.filter((c) => !c.open).length).toBeGreaterThan(8);
  });

  it('opens a mall around voids, with shops on every floor and escalators between them', () => {
    const site = building('mall', 'generic/shopping_mall', 150, 120, 14);
    const plan = generateInteriorPlan(site, { catalog: INTERIORS });
    const mall = plan.atrium;
    expect(plan.storeys.length).toBeGreaterThan(1);
    expect(mall?.shops.length).toBeGreaterThan(12);
    expect(mall?.voids.length).toBeGreaterThan(1);
    expect(mall?.escalators.length).toBe((plan.storeys.length - 1) * 2);
    for (const e of mall?.escalators ?? []) {
      // A run must land on a floor: the bridge past its well, not more void.
      const landing = e.bounds[3] + 1;
      expect(mall?.voids.some((v) => landing > v[1] && landing < v[3] && e.bounds[0] >= v[0])).toBe(
        false,
      );
    }
    // No two floor holes may touch, or the slab between them triangulates to nothing.
    for (const [i, a] of (mall?.voids ?? []).entries())
      for (const b of (mall?.voids ?? []).slice(i + 1))
        expect(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]).toBe(false);
  });

  it('points an auditorium at its focus, down a central aisle', () => {
    const plan = generateInteriorPlan(building('theatre', 'use/theatre', 28, 36, 14), {
      catalog: INTERIORS,
    });
    expect(count(plan, 'screen')).toBe(1);
    expect(count(plan, 'seat-row')).toBeGreaterThan(20);
    for (const fixture of plan.fixtures.filter((f) => f.kind === 'seat-row'))
      expect(fixture.bounds[0] >= 0.5 || fixture.bounds[2] <= -0.5).toBe(true);
    const church = generateInteriorPlan(
      building('place_of_worship', 'use/place_of_worship', 18, 36, 12),
      { catalog: INTERIORS },
    );
    expect(count(church, 'altar')).toBe(1);
    expect(count(church, 'pew')).toBeGreaterThan(10);
  });
});
