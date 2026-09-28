import { describe, expect, it } from 'vitest';
import { parseArcGrid, sampleArcGrid } from '../scripts/arc-grid.mjs';

describe('official ASCII elevation evidence', () => {
  it('reads a five-line header and samples north-first rows at pixel centers', () => {
    const grid = parseArcGrid(
      'ncols 2\nnrows 2\nxllcorner 100\nyllcorner 200\ncellsize 2\n10 20\n30 40\n',
    );
    expect(sampleArcGrid(grid, 101, 203)).toBe(10);
    expect(sampleArcGrid(grid, 103, 201)).toBe(40);
    expect(sampleArcGrid(grid, 102, 202)).toBe(25);
    expect(sampleArcGrid(grid, 100, 202)).toBeNull();
  });
  it('supports the non-square dx/dy response and preserves optional no-data', () => {
    const grid = parseArcGrid(
      'ncols 2\nnrows 2\nxllcenter 100\nyllcenter 200\ndx 2\ndy 3\nNODATA_value -9999\n10 -9999\n30 40',
    );
    expect(sampleArcGrid(grid, 100, 203)).toBe(10);
    expect(sampleArcGrid(grid, 101, 201.5)).toBeNull();
    expect(sampleArcGrid(grid, 101, 200)).toBe(35);
    expect(sampleArcGrid(grid, 102, 200)).toBe(40);
  });
  it('rejects truncated or nonfinite service responses', () => {
    expect(() =>
      parseArcGrid('ncols 2\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 1\n1 2 3'),
    ).toThrow('data');
    expect(() => parseArcGrid('<ServiceException>Unavailable</ServiceException>')).toThrow();
  });
});
