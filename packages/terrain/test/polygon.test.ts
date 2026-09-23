import { describe, expect, it } from 'vitest';
import {
  clampBounds,
  isDegenerateRing,
  normalizeRing,
  pointInPolygon,
  polygonArea,
  polygonBounds,
  ringArea,
  ringSignedArea,
} from '../src/polygon';
import { roadWidth, waterwayWidth } from '../src/semantic-widths';

const square: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const hole: [number, number][] = [
  [0.25, 0.25],
  [0.25, 0.5],
  [0.5, 0.5],
  [0.5, 0.25],
];

describe('semantic polygon helpers', () => {
  it('measures signed area, holes, and containment', () => {
    expect(ringSignedArea(square)).toBe(1);
    expect(ringArea([...square].reverse())).toBe(1);
    expect(polygonArea({ outer: square, holes: [hole] })).toBeCloseTo(0.9375, 9);
    expect(pointInPolygon([0.1, 0.1], { outer: square, holes: [hole] })).toBe(true);
    expect(pointInPolygon([0.3, 0.3], { outer: square, holes: [hole] })).toBe(false);
    expect(pointInPolygon([1.2, 0.3], { outer: square })).toBe(false);
  });

  it('keeps buffered bounds unless clamped', () => {
    const buffered = { outer: square.map(([u, v]): [number, number] => [u * 1.1 - 0.05, v]) };
    expect(polygonBounds(buffered)).toEqual([-0.05, 0, 1.05, 1]);
    expect(clampBounds(polygonBounds(buffered))).toEqual([0, 0, 1, 1]);
  });

  it('normalizes closed and duplicated rings', () => {
    expect(normalizeRing([...square, [0, 0]])).toHaveLength(4);
    expect(
      normalizeRing([
        square[0] as [number, number],
        square[0] as [number, number],
        ...square.slice(1),
      ]),
    ).toHaveLength(4);
  });

  it('exposes the ribbon width heuristics', () => {
    expect(roadWidth('motorway')).toBe(16);
    expect(roadWidth('minor_road')).toBe(8);
    expect(roadWidth('path')).toBe(2.5);
    expect(roadWidth('service', 4.5)).toBe(4.5);
    expect(waterwayWidth('river')).toBe(10);
    expect(waterwayWidth(undefined)).toBe(5);
  });
});

describe('degenerate ring detection', () => {
  it('flags rings that bound no face and passes real footprints', () => {
    expect(
      isDegenerateRing([
        [0.5, 0.5],
        [0.5, 0.5],
        [0.5, 0.5],
      ]),
    ).toBe(true);
    expect(
      isDegenerateRing([
        [0, 0],
        [1, 1],
        [0.5, 0.5],
        [0, 0],
      ]),
    ).toBe(true);
    expect(
      isDegenerateRing([
        [0, 0],
        [1, 0],
      ]),
    ).toBe(true);
    expect(isDegenerateRing(square)).toBe(false);
    expect(isDegenerateRing(hole)).toBe(false);
    // A repeated vertex on an otherwise real triangle is still renderable.
    expect(
      isDegenerateRing([
        [0, 0],
        [0, 0],
        [1, 0],
        [0, 1],
      ]),
    ).toBe(false);
  });
});
