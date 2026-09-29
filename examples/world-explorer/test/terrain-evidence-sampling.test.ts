import { describe, expect, it } from 'vitest';
import { omitUnknownTriangles, sampleEvidenceGrid } from './visual/terrain-evidence-sampling';

describe('independent terrain no-data', () => {
  it('keeps unknown cells and out-of-grid references unresolved instead of clamping', () => {
    const heights = [10, 12, null, 14, 16, null, 18, 20, null];
    expect(sampleEvidenceGrid(heights, 3, 2, [100, 200], 100.5, 200.5)).toBe(13);
    expect(sampleEvidenceGrid(heights, 3, 2, [100, 200], 101.5, 200.5)).toBeUndefined();
    expect(sampleEvidenceGrid(heights, 3, 2, [100, 200], 99.9, 200.5)).toBeUndefined();
    expect(sampleEvidenceGrid(heights, 3, 2, [100, 200], 101, 202)).toBe(20);
    expect(sampleEvidenceGrid(heights, 3, 2, [100, 200], 102, 202)).toBeUndefined();
  });
  it('omits only triangles touching missing source vertices without filling a river', () => {
    const triangles = [0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5];
    expect([...omitUnknownTriangles(triangles, [1, 2, null, 3, 4, 5])]).toEqual([0, 3, 1, 1, 3, 4]);
    expect([...omitUnknownTriangles(triangles, [1, 2, 3, 4, 5, 6])]).toEqual(triangles);
  });
});
