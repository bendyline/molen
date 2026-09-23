import { expect, it } from 'vitest';
import { businessShowcaseTile } from './business-showcase';

it('keeps the original stores accessible and all 40 new treatments inside the review tile', () => {
  const tile = businessShowcaseTile(1000);
  expect(tile.buildings).toHaveLength(49);
  expect(tile.buildings.find((b) => b.id === 'showcase:mcdonalds')?.polygons[0]?.outer[0]).toEqual([
    0.433, 0.371,
  ]);
  for (const building of tile.buildings)
    for (const polygon of building.polygons)
      for (const point of polygon.outer)
        for (const value of point) {
          expect(value).toBeGreaterThan(0);
          expect(value).toBeLessThan(1);
        }
  expect(tile.buildings.find((b) => b.id === 'showcase:mall')?.polygons[0]?.holes).toHaveLength(1);
  expect(tile.pois?.filter((p) => p.id?.toString().includes(':tenant:'))).toHaveLength(6);
});
