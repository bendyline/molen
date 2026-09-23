import { describe, expect, it } from 'vitest';
import { anyClassMatches, classMatches, lookupByClass } from '../../src/kernel/classes';
import {
  cleanRing,
  clipRingToRect,
  ensureOrientation,
  isSimpleRing,
  minAreaRectangle,
  offsetRing,
  pointInPolygon,
  ringArea,
  ringSignedArea,
  ringStrictlyInside,
  ringsOverlap,
} from '../../src/kernel/geometry2d';
import { triangulatePolygon } from '../../src/kernel/triangulate';
import type { Vec2 } from '../../src/kernel/types';
import { ring, rotate, SHAPES } from '../helpers/shapes';

describe('label matching', () => {
  it('matches whole words, not substrings', () => {
    expect(classMatches('semidetached_house', ['house'])).toBe(true);
    expect(classMatches('warehouse', ['house'])).toBe(false);
    expect(classMatches('major_road', ['road'])).toBe(true);
    expect(classMatches('Temperate Forest', ['forest'])).toBe(true);
    expect(classMatches('major road', ['major road'])).toBe(true);
    expect(anyClassMatches(['yes', 'building'], ['building'])).toBe(true);
    expect(lookupByClass({ forest: 1, urban_area: 2 }, 'urban area')).toBe(2);
    expect(lookupByClass({ forest: 1 }, 'water')).toBeUndefined();
  });
});

describe('2D geometry', () => {
  it('measures area and canonical orientation', () => {
    const box = SHAPES.box as Vec2[];
    expect(ringArea(box)).toBe(96);
    expect(ringSignedArea(box)).toBeGreaterThan(0);
    const reversed = ensureOrientation([...box].reverse(), true);
    expect(ringSignedArea(reversed)).toBeGreaterThan(0);
    expect(pointInPolygon([1, 1], box)).toBe(true);
    expect(pointInPolygon([13, 1], box)).toBe(false);
    expect(
      pointInPolygon([10, 8], SHAPES.courtyardOuter as Vec2[], [SHAPES.courtyardHole as Vec2[]]),
    ).toBe(false);
  });

  it('cleans duplicate and collinear vertices and detects self-intersection', () => {
    const noisy: Vec2[] = [
      [0, 0],
      [6, 0.02],
      [12, 0],
      [12, 0],
      [12, 8],
      [0, 8],
      [0, 0],
    ];
    expect(cleanRing(noisy)).toHaveLength(4);
    expect(isSimpleRing(SHAPES.box as Vec2[])).toBe(true);
    expect(isSimpleRing(SHAPES.bowtie as Vec2[])).toBe(false);
  });

  it('finds the minimum-area rectangle of a rotated box', () => {
    const rotated = rotate(SHAPES.box as Vec2[], 33);
    const box = minAreaRectangle(rotated);
    const sides = [box.width, box.depth].sort((a, b) => a - b);
    expect(sides[0]).toBeCloseTo(8, 5);
    expect(sides[1]).toBeCloseTo(12, 5);
  });

  it('clips and offsets rings', () => {
    const clipped = clipRingToRect(SHAPES.box as Vec2[], [2, 2, 20, 20]);
    expect(ringArea(clipped)).toBeCloseTo(60, 6);
    const inset = offsetRing(SHAPES.box as Vec2[], -1);
    expect(ringArea(inset)).toBeCloseTo(60, 6);
    const outset = offsetRing(SHAPES.box as Vec2[], 1);
    expect(ringArea(outset)).toBeCloseTo(140, 6);
  });

  it('triangulates polygons with holes and rejects bowties', () => {
    const outer = SHAPES.courtyardOuter as Vec2[];
    const hole = SHAPES.courtyardHole as Vec2[];
    const result = triangulatePolygon(outer, [hole]);
    expect(result).toBeDefined();
    expect(result?.vertices).toHaveLength(8);
    expect((result?.indices.length ?? 0) / 3).toBe(8);
    expect(triangulatePolygon(SHAPES.bowtie as Vec2[])).toBeUndefined();
  });

  it('rejects holes that are not inside the outer ring (coverage is two-sided)', () => {
    // Covering MORE than outer-minus-holes is as wrong as covering less: earcut emits the
    // stray triangles instead of failing, so a one-sided check waves these through.
    const outer = ring([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    const outside = ring([
      [20, 2],
      [22, 2],
      [22, 4],
      [20, 4],
    ]);
    expect(triangulatePolygon(outer, [outside])).toBeUndefined();

    const crossing = ring([
      [8, 2],
      [14, 2],
      [14, 6],
      [8, 6],
    ]);
    expect(triangulatePolygon(outer, [crossing])).toBeUndefined();

    const first = ring([
      [2, 2],
      [6, 2],
      [6, 6],
      [2, 6],
    ]);
    const overlapping = ring([
      [4, 4],
      [8, 4],
      [8, 8],
      [4, 8],
    ]);
    expect(triangulatePolygon(outer, [first, overlapping])).toBeUndefined();

    // A genuine hole still triangulates to exactly outer - hole.
    expect(triangulatePolygon(outer, [first])).toBeDefined();
  });

  it('classifies ring containment and overlap', () => {
    const outer = SHAPES.courtyardOuter as Vec2[];
    const inner = SHAPES.courtyardHole as Vec2[];
    expect(ringStrictlyInside(inner, outer)).toBe(true);
    expect(ringStrictlyInside(outer, inner)).toBe(false);
    // Sharing the outline's edge is not "strictly inside": the wall builder needs clearance.
    const touching = ring([
      [0, 4],
      [6, 4],
      [6, 10],
      [0, 10],
    ]);
    expect(ringStrictlyInside(touching, outer)).toBe(false);
    expect(ringsOverlap(inner, touching)).toBe(false);
    expect(
      ringsOverlap(
        inner,
        ring([
          [10, 8],
          [16, 8],
          [16, 14],
          [10, 14],
        ]),
      ),
    ).toBe(true);
    // Nested with no crossing edges still counts as overlapping.
    expect(
      ringsOverlap(
        inner,
        ring([
          [8, 6],
          [12, 6],
          [12, 10],
          [8, 10],
        ]),
      ),
    ).toBe(true);
  });
});
