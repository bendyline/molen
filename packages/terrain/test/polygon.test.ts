import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  clampBounds,
  convexTrianglePieces,
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
    expect(waterwayWidth(undefined)).toBe(2.5);
    expect(waterwayWidth('canal')).toBe(5);
    expect(waterwayWidth('ditch')).toBe(1);
    expect(waterwayWidth('moat')).toBe(4);
    expect(waterwayWidth('canal', 18)).toBe(18);
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

describe('convexTrianglePieces', () => {
  const area = (points: readonly (readonly [number, number])[], cycle: readonly number[]) =>
    cycle.reduce((sum, v, i) => {
      const p = points[v] as readonly [number, number];
      const q = points[cycle[(i + 1) % cycle.length] as number] as readonly [number, number];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2;

  it('merges a triangulated shape into fewer convex pieces covering the same area', () => {
    // A river-like strip with bends and an island, triangulated as the water mesh is.
    const outer: [number, number][] = [];
    for (let i = 0; i <= 40; i++) outer.push([i * 10, Math.sin(i / 4) * 30]);
    for (let i = 40; i >= 0; i--) outer.push([i * 10, Math.sin(i / 4) * 30 + 25 + (i % 7)]);
    const hole: [number, number][] = [
      [150, -12],
      [170, -12],
      [170, -4],
      [150, -4],
    ];
    const toVectors = (ring: [number, number][]) => ring.map(([x, y]) => new THREE.Vector2(x, y));
    const triangles = THREE.ShapeUtils.triangulateShape(toVectors(outer), [toVectors(hole)]) as [
      number,
      number,
      number,
    ][];
    const points = [...outer, ...hole];
    const pieces = convexTrianglePieces(points, triangles);
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.length).toBeLessThan(triangles.length / 2);
    const winding = Math.sign(area(points, triangles[0] as number[]));
    let total = 0;
    for (const piece of pieces) {
      // Convex, wound like the triangles.
      for (let i = 0; i < piece.length; i++) {
        const a = points[piece[i] as number] as [number, number];
        const b = points[piece[(i + 1) % piece.length] as number] as [number, number];
        const c = points[piece[(i + 2) % piece.length] as number] as [number, number];
        const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        expect(turn * winding).toBeGreaterThanOrEqual(0);
      }
      total += area(points, piece);
    }
    const expected = triangles.reduce((sum, t) => sum + area(points, t), 0);
    expect(total).toBeCloseTo(expected, 6);
    // Every triangle lies in exactly one piece.
    for (const t of triangles) {
      const cx = t.reduce((s, v) => s + (points[v] as [number, number])[0], 0) / 3;
      const cy = t.reduce((s, v) => s + (points[v] as [number, number])[1], 0) / 3;
      const holders = pieces.filter((piece) =>
        pointInPolygon([cx, cy], { outer: piece.map((v) => points[v] as [number, number]) }),
      );
      expect(holders).toHaveLength(1);
    }
  });

  it('leaves zero-area triangles out and keeps a lone triangle as it is', () => {
    const points: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [2, 0],
    ];
    expect(
      convexTrianglePieces(points, [
        [0, 1, 2],
        [0, 1, 3],
      ]),
    ).toEqual([[0, 1, 2]]);
  });
});
