import { emptyWorldgenStats } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { worldgenPreviewBounds } from '../src/ops/worldgen-preview';

describe('worldgen preview framing', () => {
  it('frames the full rotated distant building instead of placing the camera inside its box', () => {
    const bounds = worldgenPreviewBounds({
      records: [],
      stats: emptyWorldgenStats(),
      hash: '',
      placements: [
        {
          setId: 'buildings:box',
          modelRef: 'builtin:box',
          count: 1,
          data: new Float32Array([20, 3, 40, Math.PI / 2, 60, 10, 30, 1, 1, 1]),
        },
      ],
    });
    expect(bounds.min[0]).toBeCloseTo(5);
    expect(bounds.max[0]).toBeCloseTo(35);
    expect(bounds.min[2]).toBeCloseTo(10);
    expect(bounds.max[2]).toBeCloseTo(70);
    expect(bounds.min[1]).toBe(3);
    expect(bounds.max[1]).toBe(13);
  });
  it('fits scaled mapped crowns and tall furniture rather than only their ground anchors', () => {
    const bounds = worldgenPreviewBounds({
      records: [],
      stats: emptyWorldgenStats(),
      hash: '',
      placements: [
        {
          setId: 'tree',
          modelRef: 'builtin:tree.mapped.broadleaf',
          count: 1,
          data: new Float32Array([10, 2, 0, 0, 6, 15, 6, 1, 1, 1]),
        },
        {
          setId: 'lamp',
          modelRef: 'builtin:street_lamp',
          count: 1,
          data: new Float32Array([0, 0, 0, Math.PI / 2, 1, 2, 1, 1, 1, 1]),
        },
      ],
    });
    expect(bounds.max[1]).toBe(17);
    expect(bounds.max[0]).toBe(13);
    expect(bounds.min[2]).toBe(-3);
    expect(bounds.min[1]).toBe(0);
  });
});
