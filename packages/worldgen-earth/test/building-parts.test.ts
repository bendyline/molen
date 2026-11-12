import type { TerrainBuildingFeature } from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { buildingPieces } from '../src/kernel/building-parts';
import { MAP_OVERRIDE_TAG } from '../src/kernel/map-override-tags';

const rect = (u0: number, v0: number, u1: number, v1: number): [number, number][] => [
  [u0, v0],
  [u1, v0],
  [u1, v1],
  [u0, v1],
];

describe('building outlines and their mapped parts', () => {
  const outline: TerrainBuildingFeature = {
    id: 20,
    class: 'building',
    subclass: 'apartments',
    polygons: [{ outer: rect(0.1, 0.1, 0.5, 0.3) }],
  };
  const part: TerrainBuildingFeature = {
    id: 21,
    class: 'building_part',
    height: 8,
    polygons: [{ outer: rect(0.1, 0.1, 0.3, 0.3) }],
  };

  it('gives a mapped outline its parts and what remains around them', () => {
    const pieces = buildingPieces([outline, part]);
    expect(pieces.map((piece) => piece.feature.id)).toEqual([20, 21]);
    expect(pieces[0]?.remainder).toBe(0);
    expect(pieces[0]?.polygon.outer.every((point) => point[0] >= 0.3 - 1e-9)).toBe(true);
    expect(pieces[1]?.groundPolygon).toBe(outline.polygons[0]);
    expect(pieces[1]?.labels).toEqual(['apartments']);
  });

  it("leaves a host's building whole, adopting no mapped part", () => {
    // The same outline as a map override declares it, over a part the map still holds.
    const host: TerrainBuildingFeature = {
      ...outline,
      id: 'override:lot:flats',
      tags: { [MAP_OVERRIDE_TAG]: 'lot' },
    };
    const pieces = buildingPieces([host, part]);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]?.feature).toBe(host);
    expect(pieces[0]?.polygon).toBe(host.polygons[0]);
    expect(pieces[0]?.remainder).toBeUndefined();
    expect(pieces[0]?.groundPolygon).toBeUndefined();
    // The orphaned part keeps its own ground and labels: it is not the host's.
    expect(pieces[1]?.groundPolygon).toBeUndefined();
    expect(pieces[1]?.labels).toEqual(['building']);
    // A mapped outline beside it still takes the part.
    const withMapped = buildingPieces([host, outline, part]);
    expect(withMapped.map((piece) => piece.remainder)).toEqual([undefined, 0, undefined]);
    expect(withMapped[2]?.groundPolygon).toBe(outline.polygons[0]);
  });
});
