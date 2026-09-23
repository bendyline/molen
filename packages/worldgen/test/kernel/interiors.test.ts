import { describe, expect, it } from 'vitest';
import { resolveInteriorProfile, validateInteriorCatalog } from '../../src/kernel/interior-catalog';
import { generateInteriorGeometry } from '../../src/kernel/interior-geometry';
import { generateInteriorPlan, interiorRectFits } from '../../src/kernel/interior-plan';
import { createInteriorSite, interiorToWorld } from '../../src/kernel/interior-site';
import type { InteriorSite } from '../../src/kernel/interior-types';
import { FLAT_GROUND, type Vec2 } from '../../src/kernel/types';
import { INTERIORS } from '../helpers/content';
import { SHAPES } from '../helpers/shapes';

export function site(
  label = 'supermarket',
  outline: Vec2[] = [
    [0, 0],
    [30, 0],
    [30, 24],
    [0, 24],
  ],
  holes: Vec2[][] = [],
): InteriorSite {
  const value = createInteriorSite(
    { identity: 'fixed-place', labels: [label], outline },
    INTERIORS,
    outline,
    holes,
    0,
    3.4,
    FLAT_GROUND,
  );
  if (!value) throw new Error('Fixture has no entrance');
  return value;
}

describe('deterministic inferred interiors', () => {
  it('validates data-driven profiles and rejects ambiguous catalogs', () => {
    expect(validateInteriorCatalog(INTERIORS)).toEqual(INTERIORS);
    expect(() => validateInteriorCatalog({ ...INTERIORS, fallback: 'missing' })).toThrow();
    expect(() =>
      validateInteriorCatalog({
        ...INTERIORS,
        profiles: [INTERIORS.profiles[0], INTERIORS.profiles[0]],
      }),
    ).toThrow();
    expect(resolveInteriorProfile(['fast_food', 'commercial'], INTERIORS).id).toBe('fast-food');
    expect(resolveInteriorProfile(['unknown'], INTERIORS).id).toBe('generic');
  });
  it.each(
    INTERIORS.profiles,
  )('builds bounded repeatable $id interiors with clear access', (profile) => {
    const s = site(profile.labels[0] ?? 'unknown');
    const a = generateInteriorPlan(s, { catalog: INTERIORS }),
      b = generateInteriorPlan(s, { catalog: INTERIORS });
    expect(a).toEqual(b);
    expect(a.profile).toBe(profile.id);
    expect(a.fixtures.length).toBeGreaterThan(0);
    expect(a.fixtures.length).toBeLessThanOrEqual(160);
    expect(a.stats.candidates).toBeLessThanOrEqual(1024);
    for (const fixture of a.fixtures) {
      expect(interiorRectFits(s, fixture.bounds)).toBe(true);
      const [x0, , x1] = fixture.bounds;
      expect(x0 >= profile.aisleWidth / 2 - 1e-9 || x1 <= -profile.aisleWidth / 2 + 1e-9).toBe(
        true,
      );
    }
    const geometry = generateInteriorGeometry(a, INTERIORS);
    expect(geometry.bytes).toBeLessThan(2 * 1024 * 1024);
    expect(geometry.structure.triangleCount).toBeGreaterThan(0);
    expect(geometry.glass.triangleCount).toBeGreaterThan(0);
    expect([...geometry.furniture.positions].every(Number.isFinite)).toBe(true);
    expect(geometry).toEqual(generateInteriorGeometry(b, INTERIORS));
  });
  it('keeps identity and placements stable under translation and smaller budgets', () => {
    const a = site();
    const shifted = structuredClone(a);
    shifted.outline = a.outline.map((p) => [p[0] + 9_000_000, p[1] - 8_000_000]);
    shifted.entrance = [a.entrance[0] + 9_000_000, a.entrance[1] - 8_000_000];
    const full = generateInteriorPlan(a, { catalog: INTERIORS }),
      translated = generateInteriorPlan(shifted, { catalog: INTERIORS });
    expect(translated.fixtures).toEqual(full.fixtures);
    expect(generateInteriorPlan(a, { catalog: INTERIORS, maxFixtures: 3 }).fixtures).toEqual(
      full.fixtures.slice(0, 3),
    );
    expect(
      generateInteriorPlan({ ...a, identity: 'different-place' }, { catalog: INTERIORS }),
    ).not.toEqual(full);
  });
  it.each([
    'L',
    'T',
    'U',
    'H',
    'plus',
    'parallelogram',
  ])('fits the actual %s footprint', (shape) => {
    const s = site(
      'house',
      (SHAPES[shape] as Vec2[]).map(([x, z]) => [x * 3, z * 3]),
    );
    const p = generateInteriorPlan(s, { catalog: INTERIORS });
    for (const f of p.fixtures) expect(interiorRectFits(s, f.bounds)).toBe(true);
    for (const r of p.rooms) expect(interiorRectFits(s, r.bounds)).toBe(true);
  });
  it('rejects furniture enclosing a courtyard even if all four corners are inside', () => {
    const s = site(
      'supermarket',
      [
        [0, 0],
        [30, 0],
        [30, 24],
        [0, 24],
      ],
      [
        [
          [12, 8],
          [12, 14],
          [18, 14],
          [18, 8],
        ],
      ],
    );
    expect(interiorRectFits(s, [-10, 4, 10, 18])).toBe(false);
    for (const f of generateInteriorPlan(s, { catalog: INTERIORS }).fixtures)
      expect(interiorRectFits(s, f.bounds)).toBe(true);
  });
  it('caps work on huge outlines and rejects nonfinite budgets', () => {
    const s = site('warehouse', [
      [0, 0],
      [100000, 0],
      [100000, 100000],
      [0, 100000],
    ]);
    const p = generateInteriorPlan(s, { catalog: INTERIORS, maxCandidates: 20, maxFixtures: 10 });
    expect(p.stats.candidates).toBeLessThanOrEqual(20);
    expect(p.fixtures.length).toBeLessThanOrEqual(10);
    expect(p.stats.truncated).toBe(true);
    expect(() => generateInteriorPlan(s, { catalog: INTERIORS, maxCandidates: NaN })).toThrow();
  });
  it('never invents walkable ground access for clipped or elevated pieces', () => {
    const s = site();
    for (const extra of [{ clipped: true }, { minHeight: 3 }])
      expect(
        createInteriorSite(
          { identity: 'piece', outline: s.outline, labels: [], ...extra },
          INTERIORS,
          s.outline,
          [],
          0,
          3,
          FLAT_GROUND,
        ),
      ).toBeUndefined();
    const p = interiorToWorld(s, [0, 1]);
    expect(p[0]).toBeCloseTo(s.entrance[0] + s.inward[0]);
  });
});
