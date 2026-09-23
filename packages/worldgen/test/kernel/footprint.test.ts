import { describe, expect, it } from 'vitest';
import { analyzeFootprint, toWorld } from '../../src/kernel/footprint';
import { pointInPolygon, ringArea } from '../../src/kernel/geometry2d';
import { wingArea, wingDepth, wingWidth } from '../../src/kernel/rectangles';
import type { Vec2 } from '../../src/kernel/types';
import { regularPolygon, ring, rotate, SHAPES, translate } from '../helpers/shapes';

const EXPECTED: Array<[name: string, kind: string, wings: number]> = [
  ['box', 'box', 1],
  ['L', 'L', 2],
  ['T', 'T', 2],
  ['U', 'U', 3],
  ['Z', 'Z', 2],
  ['stair', 'stair', 3],
  ['H', 'H', 3],
  ['plus', 'plus', 2],
];

function sortedWingSizes(sizes: Array<[number, number]>): Array<[number, number]> {
  return sizes
    .map(([a, b]): [number, number] => (a >= b ? [a, b] : [b, a]))
    .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

describe('footprint analysis', () => {
  it.each(EXPECTED)('classifies %s as %s with %i wings', (name, kind, wings) => {
    const analysis = analyzeFootprint(SHAPES[name] as Vec2[]);
    expect(analysis.kind).toBe(kind);
    expect(analysis.rectilinear).toBe(true);
    expect(analysis.wings).toHaveLength(wings);
    for (const wing of analysis.wings) {
      expect(wingWidth(wing)).toBeGreaterThan(0);
      expect(wingDepth(wing)).toBeGreaterThan(0);
      const centre: Vec2 = [(wing.u0 + wing.u1) / 2, (wing.v0 + wing.v1) / 2];
      expect(pointInPolygon(centre, analysis.localOutline)).toBe(true);
    }
  });

  it('is invariant under rotation and translation', () => {
    for (const [name] of EXPECTED) {
      const base = analyzeFootprint(SHAPES[name] as Vec2[]);
      const moved = analyzeFootprint(
        translate(rotate(SHAPES[name] as Vec2[], 37), 1234.5, -987.25),
      );
      expect(moved.kind).toBe(base.kind);
      expect(moved.wings).toHaveLength(base.wings.length);
      expect(Math.abs(moved.area - base.area) / base.area).toBeLessThan(1e-6);
      const baseSizes = sortedWingSizes(base.wings.map((w) => [wingWidth(w), wingDepth(w)]));
      const movedSizes = sortedWingSizes(moved.wings.map((w) => [wingWidth(w), wingDepth(w)]));
      baseSizes.forEach((size, index) => {
        expect(movedSizes[index]?.[0]).toBeCloseTo(size[0], 3);
        expect(movedSizes[index]?.[1]).toBeCloseTo(size[1], 3);
      });
      expect(Math.abs(moved.width - base.width)).toBeLessThan(1e-3);
      expect(Math.abs(moved.depth - base.depth)).toBeLessThan(1e-3);
      // The frame maps the snapped local outline back onto the moved outline.
      const world = moved.localOutline.map((point) => toWorld(moved.frame, point));
      expect(ringArea(world)).toBeCloseTo(moved.area, 3);
    }
  });

  it('trims the T stem to the bar centreline and keeps the Z untrimmed', () => {
    const t = analyzeFootprint(SHAPES.T as Vec2[]);
    const stem = t.wings.find((wing) => wing.longAxis !== t.wings[0]?.longAxis);
    expect(stem).toBeDefined();
    if (stem === undefined) return;
    const dominant = t.wings[0];
    expect(dominant).toBeDefined();
    if (dominant === undefined) return;
    const dominantCentre =
      stem.longAxis === 'u' ? (dominant.u0 + dominant.u1) / 2 : (dominant.v0 + dominant.v1) / 2;
    const stemEnds = stem.longAxis === 'u' ? [stem.u0, stem.u1] : [stem.v0, stem.v1];
    expect(stemEnds.some((end) => Math.abs(end - dominantCentre) < 1e-6)).toBe(true);
    expect(stem.endOnOutline.filter(Boolean)).toHaveLength(1);
    const z = analyzeFootprint(SHAPES.Z as Vec2[]);
    expect(z.wings.every((wing) => wing.endOnOutline[0] && wing.endOnOutline[1])).toBe(true);
  });

  it('covers every inside cell with the union of wings', () => {
    for (const [name] of EXPECTED) {
      const analysis = analyzeFootprint(SHAPES[name] as Vec2[]);
      const total = analysis.wings.reduce((sum, wing) => sum + wingArea(wing), 0);
      expect(total).toBeGreaterThanOrEqual(analysis.area - 1e-6);
      for (let x = 0.25; x < analysis.width; x += 0.5) {
        for (let z = 0.25; z < analysis.depth; z += 0.5) {
          if (!pointInPolygon([x, z], analysis.localOutline)) continue;
          const covered = analysis.wings.some(
            (wing) =>
              x >= wing.u0 - 1e-9 &&
              x <= wing.u1 + 1e-9 &&
              z >= wing.v0 - 1e-9 &&
              z <= wing.v1 + 1e-9,
          );
          expect(covered).toBe(true);
        }
      }
    }
  });

  it('handles courtyards, skew, and irregular outlines', () => {
    const courtyard = analyzeFootprint(SHAPES.courtyardOuter as Vec2[], [
      SHAPES.courtyardHole as Vec2[],
    ]);
    expect(courtyard.kind).toBe('courtyard');
    expect(courtyard.wings.length).toBeGreaterThanOrEqual(2);
    const skewed = analyzeFootprint(SHAPES.skewedBox as Vec2[]);
    expect(skewed.kind).toBe('box');
    expect(Math.abs(ringArea(skewed.localOutline) - skewed.area) / skewed.area).toBeLessThan(0.12);
    expect(analyzeFootprint(SHAPES.parallelogram as Vec2[]).kind).toBe('irregular');
    expect(analyzeFootprint(regularPolygon(8, 6)).kind).toBe('irregular');
    const circle = analyzeFootprint(regularPolygon(40, 9));
    expect(circle.kind).toBe('irregular');
    expect(circle.axisStrength).toBeLessThan(0.35);
    expect(analyzeFootprint(SHAPES.bowtie as Vec2[]).kind).toBe('irregular');
    expect(analyzeFootprint(SHAPES.sliver as Vec2[]).kind).toBe('degenerate');
    expect(
      analyzeFootprint([
        [0, 0],
        [1, 0],
      ]).kind,
    ).toBe('degenerate');
  });

  it('drops holes that leave the outline or overlap each other, and says so', () => {
    const outer = SHAPES.courtyardOuter as Vec2[]; // 20 x 16
    const good = SHAPES.courtyardHole as Vec2[]; // 6 x 6, well inside
    const outside = ring([
      [30, 2],
      [36, 2],
      [36, 8],
      [30, 8],
    ]);
    const crossing = ring([
      [16, 4],
      [26, 4],
      [26, 10],
      [16, 10],
    ]);
    const overlapping = ring([
      [9, 7],
      [15, 7],
      [15, 13],
      [9, 13],
    ]);

    const clean = analyzeFootprint(outer, [good]);
    expect(clean.kind).toBe('courtyard');
    expect(clean.holes).toHaveLength(1);
    expect(clean.holeNotices).toBeUndefined();

    const dirty = analyzeFootprint(outer, [good, outside, crossing, overlapping]);
    expect(dirty.kind).toBe('courtyard');
    expect(dirty.holes).toHaveLength(1);
    expect(dirty.localHoles).toHaveLength(1);
    expect(ringArea(dirty.holes[0] as Vec2[])).toBeCloseTo(36, 6);
    expect(dirty.holeNotices).toEqual([
      'hole 1: not strictly inside the outline; dropped',
      'hole 2: not strictly inside the outline; dropped',
      'hole 3: overlaps hole 0; dropped',
    ]);

    // With nothing but a stray ring there is no courtyard at all: it is a plain box.
    const stray = analyzeFootprint(outer, [outside]);
    expect(stray.kind).toBe('box');
    expect(stray.holes).toHaveLength(0);
    expect(stray.localHoles).toHaveLength(0);
    expect(stray.holeNotices?.[0]).toContain('not strictly inside');
  });

  it('reports metrics rules can use', () => {
    const analysis = analyzeFootprint(SHAPES.L as Vec2[]);
    expect(analysis.elongation).toBeCloseTo(1, 6);
    expect(analysis.rectangularity).toBeCloseTo(108 / 144, 6);
    expect(analysis.reflexCount).toBe(1);
    expect(analysis.vertexCount).toBe(6);
    expect(analysis.perimeter).toBeCloseTo(48, 6);
  });
});
