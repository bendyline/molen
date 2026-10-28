import type { TerrainSemanticPolygon } from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { packPolygons, unpackPolygons } from '../src/kernel/packed-polygons';

describe('packed polygons', () => {
  it('round-trips outer rings, empty hole lists and holes through transferable arrays', () => {
    const square = (u: number, v: number, w: number): [number, number][] => [
      [u, v],
      [u + w, v],
      [u + w, v + w],
      [u, v + w],
    ];
    const polygons: TerrainSemanticPolygon[] = [
      { outer: square(0.1, 0.1, 0.2) },
      { outer: square(0.5, 0.5, 0.1), holes: [] },
      { outer: square(0.2, 0.6, 0.3), holes: [square(0.25, 0.65, 0.05), square(0.4, 0.7, 0.05)] },
      {
        outer: [
          [1 / 3, 2 / 3],
          [0.123456789012345, 0.9876543210987],
          [0.5, 1e-12],
        ],
      },
    ];
    const packed = packPolygons(polygons);
    expect(packed.polygons).toEqual(Uint32Array.of(0, 1, 3, 0));
    expect(unpackPolygons(structuredClone(packed))).toEqual(polygons);
    expect(unpackPolygons(packPolygons([]))).toEqual([]);
  });
});
