import { describe, expect, it } from 'vitest';
import {
  joinTerrainLines,
  lineSegmentIndex,
  pathBounds,
  sampleTerrainLine,
  terrainLinePath,
} from '../src/line-path';

describe('line paths', () => {
  it('puts a positive offset on the right-hand side of travel (+X east, +Z south)', () => {
    // Travelling east (+X): right-hand side is south (+Z).
    const east = terrainLinePath(
      [
        [0, 0.5],
        [1, 0.5],
      ],
      100,
    );
    expect(sampleTerrainLine(east, 50, 2)).toMatchObject({ x: 50, z: 52, dx: 1, dz: 0 });
    // Travelling north (-Z): right-hand side is east (+X).
    const north = terrainLinePath(
      [
        [0.5, 1],
        [0.5, 0],
      ],
      100,
    );
    const p = sampleTerrainLine(north, 50, 2);
    expect(p.x).toBeCloseTo(52);
    expect(p.z).toBeCloseTo(50);
  });

  it('finds the segment containing a distance and bounds the path', () => {
    const path = terrainLinePath(
      [
        [0, 0],
        [0.1, 0],
        [0.1, 0.2],
      ],
      100,
    );
    expect(path.length).toBeCloseTo(30);
    expect(lineSegmentIndex(path, -5)).toBe(0);
    expect(lineSegmentIndex(path, 5)).toBe(0);
    expect(lineSegmentIndex(path, 15)).toBe(1);
    expect(lineSegmentIndex(path, 99)).toBe(1);
    expect(pathBounds(path)).toEqual([0, 0, 10, 20]);
  });

  it('joins degree-two fragments end to end', () => {
    const joined = joinTerrainLines([
      [
        [0, 0],
        [0.5, 0],
      ],
      [
        [1, 0],
        [0.5, 0],
      ],
    ]);
    expect(joined).toHaveLength(1);
    expect(joined[0]).toHaveLength(3);
  });
});
