import {
  createEmptyTerrainSemanticTile,
  type TerrainBuiltUpCoverage,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { inferBuildingFootprints } from '../src/kernel/building-infill';
import { createBuiltUpGate } from '../src/kernel/built-up-gate';
import type { TileGeometry } from '../src/kernel/semantic-adapter';

/** A 960 m tile under an 8 x 8 grid of 120 m cells: blocks are 4 x 4 cells, 480 m. */
const geom: TileGeometry = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 960,
  metersPerUnit: 1,
  levelBelowMax: 0,
};
const flat = {
  sampleHeight: () => 12,
  slopeAt: () => 0,
  normalAt: (): [number, number, number] => [0, 1, 0],
};
function coverage(value: (column: number, row: number) => number): TerrainBuiltUpCoverage {
  const values: number[] = [];
  for (let row = 0; row < 8; row++)
    for (let column = 0; column < 8; column++) values.push(value(column, row));
  return { source: 'fixture', year: 2020, columns: 8, rows: 8, box: [0, 0, 1, 1], values };
}
function rectangle(x0: number, z0: number, x1: number, z1: number): TerrainSemanticPolygon {
  return {
    outer: [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
  };
}
/** A residential street grid every 96 m, dense enough for infill everywhere in the tile. */
function streets(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  for (let n = 0.05; n < 1; n += 0.1) {
    tile.transportation.push({
      class: 'minor_road',
      subclass: 'residential',
      lines: [
        [
          [0, n],
          [1, n],
        ],
        [
          [n, 0],
          [n, 1],
        ],
      ],
    });
  }
  return tile;
}
const infer = (
  tile: TerrainSemanticTile,
  settings: Parameters<typeof inferBuildingFootprints>[2] = { seed: 7 },
) => inferBuildingFootprints(tile, geom, settings, flat);
const centre = (feature: { polygons: TerrainSemanticPolygon[] }): [number, number] => {
  const ring = feature.polygons[0]?.outer ?? [];
  return [
    ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
    ring.reduce((sum, p) => sum + p[1], 0) / ring.length,
  ];
};

describe('built-up gate', () => {
  it('is absent without evidence', () => {
    expect(createBuiltUpGate(createEmptyTerrainSemanticTile(), 960)).toBeUndefined();
  });

  it('groups cells into blocks nearest 480 m and compares evidence with footprints', () => {
    const tile = createEmptyTerrainSemanticTile();
    // West half 40% built by the evidence; the north-west block's footprints cover 30% of it.
    tile.builtUp = coverage((column) => (column < 4 ? 0.4 : 0.05));
    tile.buildings.push({ class: 'building', polygons: [rectangle(0, 0, 0.5, 0.15)] });
    const gate = createBuiltUpGate(tile, 960);
    expect(gate).toMatchObject({ columns: 2, rows: 2, box: [0, 0, 1, 1], any: true });
    expect(gate?.evidence.map((value) => +value.toFixed(3))).toEqual([0.4, 0.05, 0.4, 0.05]);
    expect(gate?.mapped.map((value) => +value.toFixed(3))).toEqual([0.3, 0, 0, 0]);
    // North-west: 0.40 - 0.30 is under the 0.15 the evidence must lead by. South-west: open.
    expect(gate?.allows(0.2, 0.2)).toBe(false);
    expect(gate?.allows(0.2, 0.8)).toBe(true);
    expect(gate?.allows(0.8, 0.8)).toBe(false);
    // Points past the tile read the nearest block.
    expect(gate?.allows(-0.05, 0.9)).toBe(true);
    expect(gate?.allows(1.05, 0.9)).toBe(false);
    expect(createBuiltUpGate(tile, 960, { minDeficit: 0.05 })?.allows(0.2, 0.2)).toBe(true);
    expect(() => createBuiltUpGate(tile, 960, { minDeficit: 2 })).toThrow();
  });

  it('spreads a footprint over the blocks it crosses and counts only its part inside the tile', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.builtUp = coverage(() => 0.5);
    // A shed across the two northern blocks, and one hanging half out of the tile's west edge.
    tile.buildings.push({ class: 'building', polygons: [rectangle(0.25, 0.1, 0.75, 0.2)] });
    tile.buildings.push({ class: 'building', polygons: [rectangle(-0.1, 0.6, 0.1, 0.7)] });
    const gate = createBuiltUpGate(tile, 960);
    expect(gate?.mapped.map((value) => +value.toFixed(3))).toEqual([0.1, 0.1, 0.04, 0]);
  });

  it('uses finer blocks for larger cells and the whole coverage for a tile smaller than a block', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.builtUp = coverage(() => 0.3);
    // The same 8 x 8 cells over a 3,840 m tile are 480 m each: one cell to a block.
    expect(createBuiltUpGate(tile, 3840)).toMatchObject({ columns: 8, rows: 8 });
    // Over a 240 m tile they are 30 m each: all 64 make one block.
    expect(createBuiltUpGate(tile, 240)).toMatchObject({ columns: 1, rows: 1 });
  });
});

describe('building infill under built-up evidence', () => {
  it('invents as before without evidence, and when told to ignore it', () => {
    const plain = infer(streets());
    expect(plain.length).toBeGreaterThan(100);
    const tile = streets();
    tile.builtUp = coverage(() => 0);
    expect(infer(tile, { seed: 7, builtUp: false })).toEqual(plain);
  });

  it('invents nothing where the evidence says nothing is built', () => {
    const tile = streets();
    tile.builtUp = coverage(() => 0);
    expect(infer(tile)).toEqual([]);
  });

  it('keeps exactly the lots of the open blocks', () => {
    const plain = infer(streets());
    const tile = streets();
    // Evidence in the west half only.
    tile.builtUp = coverage((column) => (column < 4 ? 0.45 : 0.02));
    const gated = infer(tile);
    expect(gated.length).toBeGreaterThan(30);
    expect(gated.length).toBeLessThan(plain.length * 0.7);
    expect(gated.every((feature) => centre(feature)[0] < 0.53)).toBe(true);
    // Away from the closed half the lots are the ones the ungated tile lays out, unchanged.
    const interior = (list: typeof plain) =>
      list
        .filter((feature) => centre(feature)[0] < 0.35)
        .sort((p, q) => (String(p.id) < String(q.id) ? -1 : 1));
    expect(interior(gated)).toEqual(interior(plain));
  });

  it('stops inventing where the footprints already account for the evidence', () => {
    const tile = streets();
    tile.builtUp = coverage(() => 0.3);
    expect(infer(tile).length).toBeGreaterThan(100);
    // Mapped buildings over a quarter of the north-west block: 0.30 - 0.25 leaves no room there.
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++)
        tile.buildings.push({
          class: 'building',
          polygons: [rectangle(0.06 + i * 0.1, 0.06 + j * 0.1, 0.11 + i * 0.1, 0.11 + j * 0.1)],
        });
    const gated = infer(tile);
    expect(gated.length).toBeGreaterThan(50);
    expect(gated.some((feature) => centre(feature)[0] < 0.48 && centre(feature)[1] < 0.48)).toBe(
      false,
    );
  });
});
