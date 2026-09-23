import { describe, expect, it } from 'vitest';
import { generateInteriorGeometry } from '../../src/kernel/interior-geometry';
import { generateInteriorPlan, interiorRectFits } from '../../src/kernel/interior-plan';
import { createInteriorSite } from '../../src/kernel/interior-site';
import { FLAT_GROUND, type Vec2 } from '../../src/kernel/types';
import { INTERIORS } from '../helpers/content';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing generated fixture');
  return value;
}

function home(width = 12, depth = 14) {
  const outline: Vec2[] = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];
  return required(
    createInteriorSite(
      { identity: 'home', outline, labels: ['house'] },
      INTERIORS,
      outline,
      [],
      0,
      2.84,
      FLAT_GROUND,
      undefined,
      [
        { floor: 0.04, ceiling: 2.84 },
        { floor: 3, ceiling: 5.8 },
      ],
    ),
  );
}

describe('residential programs and connected storeys', () => {
  it('provides distinct domestic rooms and a clear, bounded stairwell', () => {
    const site = home(),
      plan = generateInteriorPlan(site, { catalog: INTERIORS });
    expect(plan.storeys).toHaveLength(2);
    expect(plan.stairs).toHaveLength(1);
    expect(new Set(plan.rooms.map((r) => r.program))).toEqual(
      new Set(['living', 'kitchen', 'bathroom', 'bedroom', 'stairwell']),
    );
    expect(plan.fixtures.filter((f) => f.kind === 'bed')).toHaveLength(2);
    expect(plan.fixtures.some((f) => f.kind === 'toilet')).toBe(true);
    expect(plan.fixtures.some((f) => f.kind === 'shower')).toBe(true);
    expect(plan.fixtures.some((f) => f.kind === 'kitchen')).toBe(true);
    const stair = required(plan.stairs[0]);
    expect(interiorRectFits(site, stair.bounds)).toBe(true);
    expect(
      (required(plan.storeys[1]).floor - required(plan.storeys[0]).floor) / stair.steps,
    ).toBeLessThanOrEqual(0.18);
    for (const room of plan.rooms) {
      expect(interiorRectFits(site, room.bounds)).toBe(true);
      expect(required(room.door).at - room.bounds[1]).toBeGreaterThan(0.58);
      expect(room.bounds[3] - required(room.door).at).toBeGreaterThan(0.58);
    }
    for (const f of plan.fixtures) {
      expect(interiorRectFits(site, f.bounds)).toBe(true);
      const a = f.bounds,
        b = stair.bounds;
      expect(a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]).toBe(false);
    }
    const geometry = generateInteriorGeometry(plan, INTERIORS);
    expect(geometry.steps.triangleCount).toBeGreaterThan(100);
    expect(geometry.collision.triangleCount).toBeLessThan(12);
    expect(geometry.bytes).toBeLessThan(700_000);
    expect(geometry.structure.groups.some((g) => g.materialRef === 'interior:wood')).toBe(true);
    expect(geometry.furniture.groups.some((g) => g.materialRef === 'interior:fabric')).toBe(true);
  });
  it('does not generate inaccessible upper slabs in a shallow house or bungalow', () => {
    for (const site of [home(8, 8), { ...home(), storeys: undefined }]) {
      const plan = generateInteriorPlan(site, { catalog: INTERIORS });
      expect(plan.storeys).toHaveLength(1);
      expect(plan.stairs).toHaveLength(0);
      expect(plan.rooms.some((r) => r.program === 'bedroom')).toBe(true);
      expect(plan.rooms.some((r) => r.program === 'bathroom')).toBe(true);
    }
  });
  it('keeps layout, decor, and geometry deterministic while varying households', () => {
    const a = home(),
      p = generateInteriorPlan(a, { catalog: INTERIORS });
    expect(generateInteriorGeometry(p, INTERIORS)).toEqual(
      generateInteriorGeometry(generateInteriorPlan(a, { catalog: INTERIORS }), INTERIORS),
    );
    expect(generateInteriorPlan(a, { catalog: INTERIORS, maxFixtures: 5 }).fixtures).toEqual(
      p.fixtures.slice(0, 5),
    );
    expect(
      generateInteriorPlan(a, { catalog: INTERIORS, maxCandidates: 1 }).stats.candidates,
    ).toBeLessThanOrEqual(1);
    const variants = new Set(
      Array.from({ length: 10 }, (_, i) =>
        JSON.stringify(
          generateInteriorPlan(
            { ...a, identity: `house-${i}` },
            { catalog: INTERIORS },
          ).fixtures.map((f) => [f.kind, f.variant, f.bounds]),
        ),
      ),
    );
    expect(variants.size).toBeGreaterThan(5);
    const shifted = {
      ...a,
      outline: a.outline.map(([x, z]): Vec2 => [x + 8000000, z - 7000000]),
      entrance: [a.entrance[0] + 8000000, a.entrance[1] - 7000000] as Vec2,
    };
    expect(generateInteriorPlan(shifted, { catalog: INTERIORS }).fixtures).toEqual(p.fixtures);
  });
});
