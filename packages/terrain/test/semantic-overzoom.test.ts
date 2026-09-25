import { describe, expect, it } from 'vitest';
import {
  createOverzoomTerrainSemanticSource,
  overzoomTerrainSemanticTile,
} from '../src/semantic-overzoom';
import { createEmptyTerrainSemanticTile, type TerrainSemanticTile } from '../src/semantic-types';

const parent = { level: 13, x: 10, z: 20 };
const child = (dx: number, dz: number) => ({ level: 14, x: 20 + dx, z: 40 + dz });

function square(u: number, v: number, half: number) {
  return {
    outer: [
      [u - half, v - half],
      [u + half, v - half],
      [u + half, v + half],
      [u - half, v + half],
    ] as [number, number][],
  };
}

function sample(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.landcover.push({ class: 'park', polygons: [square(0.5, 0.5, 0.5)] });
  tile.water.push({
    class: 'river',
    lines: [
      [
        [0.9, 0],
        [0.9, 1],
      ],
    ],
    width: 12,
  });
  tile.transportation.push({
    class: 'major_road',
    lines: [
      [
        [0, 0.25],
        [1, 0.25],
      ],
    ],
    width: 9,
  });
  tile.buildings.push({ polygons: [square(0.3, 0.3, 0.02)], height: 20 });
  // Straddles the quadrant border: its center (0.5, 0.2) belongs to the top-right child.
  tile.buildings.push({ polygons: [square(0.5, 0.2, 0.03)], height: 12 });
  tile.pois = [{ class: 'cafe', point: [0.8, 0.8], name: 'Corner' }];
  tile.buildingsGeneralized = true;
  return tile;
}

describe('semantic overzoom', () => {
  it('rescales and clips lines and areas to the descendant', () => {
    const topLeft = overzoomTerrainSemanticTile(sample(), parent, child(0, 0), { buffer: 0 });
    expect(topLeft.transportation[0]?.lines).toEqual([
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ]);
    expect(topLeft.transportation[0]?.width).toBe(9);
    // The park covered the whole parent: it now covers exactly this tile.
    const park = topLeft.landcover[0]?.polygons[0]?.outer ?? [];
    expect(Math.min(...park.map((p) => p[0]))).toBeCloseTo(0, 9);
    expect(Math.max(...park.map((p) => p[0]))).toBeCloseTo(1, 9);
    // The river at u=0.9 lies in the right half only.
    expect(topLeft.water).toEqual([]);
    expect(topLeft.pois).toEqual([]);
    expect(topLeft.buildingsGeneralized).toBe(true);

    const bottomRight = overzoomTerrainSemanticTile(sample(), parent, child(1, 1), { buffer: 0 });
    expect(bottomRight.transportation).toEqual([]);
    expect(bottomRight.water[0]?.lines?.[0]?.[0]?.[0]).toBeCloseTo(0.8, 9);
    expect(bottomRight.pois?.[0]?.point[0]).toBeCloseTo(0.6, 9);
    expect(bottomRight.pois?.[0]?.point[1]).toBeCloseTo(0.6, 9);
  });

  it('keeps each building whole in exactly one descendant', () => {
    const counts = [child(0, 0), child(1, 0), child(0, 1), child(1, 1)].map(
      (address) => overzoomTerrainSemanticTile(sample(), parent, address).buildings.length,
    );
    expect(counts).toEqual([1, 1, 0, 0]);
    const topRight = overzoomTerrainSemanticTile(sample(), parent, child(1, 0));
    const ring = topRight.buildings[0]?.polygons[0]?.outer ?? [];
    // Uncut: it keeps all four corners, one of them left of the tile edge.
    expect(ring).toHaveLength(4);
    expect(Math.min(...ring.map((p) => p[0]))).toBeLessThan(0);
  });

  it('keeps a small buffer around the descendant, like decoded tiles', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push({
      class: 'path',
      lines: [
        [
          [0.505, 0],
          [0.505, 0.5],
        ],
      ],
    });
    const left = overzoomTerrainSemanticTile(tile, parent, child(0, 0), { buffer: 1 / 64 });
    expect(left.transportation).toHaveLength(1);
    const none = overzoomTerrainSemanticTile(tile, parent, child(0, 0), { buffer: 0 });
    expect(none.transportation).toHaveLength(0);
  });

  it('rejects addresses that are not descendants', () => {
    expect(() => overzoomTerrainSemanticTile(sample(), parent, { level: 14, x: 5, z: 40 })).toThrow(
      /ancestor/,
    );
    expect(() => overzoomTerrainSemanticTile(sample(), child(0, 0), parent)).toThrow(/ancestor/);
  });

  it('loads a shared ancestor once for its descendants and passes coarser levels through', async () => {
    const loads: string[] = [];
    const source = createOverzoomTerrainSemanticSource(
      {
        async load(address) {
          loads.push(`${address.level}/${address.x}/${address.z}`);
          return sample();
        },
      },
      13,
    );
    const signal = new AbortController().signal;
    const tiles = await Promise.all(
      [child(0, 0), child(1, 0), child(0, 1), child(1, 1)].map((a) => source.load(a, signal)),
    );
    expect(tiles.every((tile) => tile !== undefined)).toBe(true);
    await source.load({ level: 15, x: 41, z: 81 }, signal);
    await source.load(parent, signal);
    expect(loads).toEqual(['13/10/20', '13/10/20']);

    const aborted = new AbortController();
    aborted.abort();
    expect(await source.load(child(0, 0), aborted.signal)).toBeUndefined();
  });
});
