import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import { renderedGroundSampler } from '../src/rendered-ground';
import {
  clipRoadLine,
  gradeRoadEarthworks,
  roadEarthworkLines,
  roadProfileHeight,
} from '../src/road-earthworks';
import type { TerrainSemanticPoint, TerrainTransportationFeature } from '../src/semantic-types';

const SIZE = 400;
const RANGE = { min: -50, max: 250 };

/** A tile whose samples follow `ground` exactly, as elevation tiles sharing an edge do. */
function field(
  ground: (x: number, z: number) => number,
  origin: [number, number] = [0, 0],
  side = 65,
): Heightfield {
  const grid = new Float32Array(side * side);
  for (let row = 0; row < side; row++)
    for (let column = 0; column < side; column++)
      grid[row * side + column] =
        (ground(origin[0] + (column / (side - 1)) * SIZE, origin[1] + (row / (side - 1)) * SIZE) -
          RANGE.min) /
        (RANGE.max - RANGE.min);
  return new Heightfield(grid, side, side, { origin, worldSize: [SIZE, SIZE], height: RANGE });
}
const road = (
  line: TerrainSemanticPoint[],
  extra: Partial<TerrainTransportationFeature> = {},
): TerrainTransportationFeature => ({
  class: 'minor_road',
  subclass: 'residential',
  width: 10,
  lines: [line],
  ...extra,
});
/** Rendered ground of a field, on the grid roads are draped on. */
const surface = (graded: Heightfield, origin: [number, number] = [0, 0]) =>
  renderedGroundSampler(graded, origin, SIZE, graded.cols);

describe('road earthworks', () => {
  // A hillside falling 20% toward +z, rippled as coarse elevation samples are.
  const hillside = (x: number, z: number): number =>
    z * 0.2 + 1.2 * Math.sin(x / 9) * Math.cos(z / 11);

  it('levels a road across a hillside and leaves the hill beyond it alone', () => {
    const lines = roadEarthworkLines(
      [
        road([
          [0, 0.5],
          [1, 0.5],
        ]),
      ],
      [0, 0],
      SIZE,
    );
    const natural = field(hillside);
    const graded = gradeRoadEarthworks(natural, lines, hillside);
    expect(graded).not.toBe(natural);
    const before = surface(natural),
      after = surface(graded);
    let worstBefore = 0,
      worstAfter = 0;
    for (let x = 40; x <= 360; x += 7) {
      worstBefore = Math.max(worstBefore, Math.abs(before(x, 195) - before(x, 205)) / 10);
      worstAfter = Math.max(worstAfter, Math.abs(after(x, 195) - after(x, 205)) / 10);
    }
    // 20% of crossfall and more before; level to a few millimeters a meter after.
    expect(worstBefore).toBeGreaterThan(0.15);
    expect(worstAfter).toBeLessThan(0.004);
    // The road sits where the hill had it, not above or below.
    expect(after(200, 200)).toBeCloseTo(40, 0);
    // Far up and down the slope nothing moved.
    for (const z of [40, 360]) expect(after(200, z)).toBeCloseTo(before(200, z), 6);
  });

  it('carries a road over the ripples in the samples on a slowly changing profile', () => {
    const lines = roadEarthworkLines(
      [
        road([
          [0, 0.5],
          [1, 0.5],
        ]),
      ],
      [0, 0],
      SIZE,
    );
    const natural = field(hillside);
    const graded = gradeRoadEarthworks(natural, lines, hillside);
    const roughness = (ground: (x: number, z: number) => number): number => {
      let total = 0;
      for (let x = 60; x <= 340; x += 5)
        total += Math.abs(ground(x - 12, 200) + ground(x + 12, 200) - 2 * ground(x, 200));
      return total;
    };
    expect(roughness(surface(graded))).toBeLessThan(roughness(surface(natural)) * 0.35);
  });

  it('gives two streets on one slope each their own bench', () => {
    const slope = (_x: number, z: number): number => z * 0.2;
    const lines = roadEarthworkLines(
      [
        road([
          [0, 0.3],
          [1, 0.3],
        ]),
        road([
          [0, 0.7],
          [1, 0.7],
        ]),
      ],
      [0, 0],
      SIZE,
    );
    const after = surface(gradeRoadEarthworks(field(slope), lines, slope));
    for (const [z, height] of [
      [120, 24],
      [280, 56],
    ] as const) {
      expect(after(200, z)).toBeCloseTo(height, 1);
      expect(Math.abs(after(200, z - 5) - after(200, z + 5))).toBeLessThan(0.05);
    }
    // The block between them takes up the difference.
    expect(after(200, 200)).toBeGreaterThan(30);
    expect(after(200, 200)).toBeLessThan(50);
  });

  it('grades the edge two tiles share to the same heights from either side', () => {
    const features = [
      road([
        [0.6, 0.1],
        [1, 0.45],
      ]),
    ];
    const beyond = [
      road([
        [0, 0.45],
        [0.5, 0.9],
      ]),
    ];
    // Both tiles are given both tiles' lines, each cut to its own square.
    const lines = [
      ...roadEarthworkLines(features, [0, 0], SIZE),
      ...roadEarthworkLines(beyond, [SIZE, 0], SIZE),
    ];
    const west = gradeRoadEarthworks(field(hillside), lines, hillside);
    const east = gradeRoadEarthworks(field(hillside, [SIZE, 0]), lines, hillside);
    let moved = 0;
    for (let z = 0; z <= SIZE; z += SIZE / 64) {
      expect(west.sampleHeight(SIZE, z)).toBeCloseTo(east.sampleHeight(SIZE, z), 9);
      moved = Math.max(moved, Math.abs(west.sampleHeight(SIZE, z) - hillside(SIZE, z)));
    }
    expect(moved).toBeGreaterThan(0.5);
  });

  it('leaves water as it is beside a road, and grades nothing on a grid too coarse to hold one', () => {
    const shore = (_x: number, z: number): number => (z > 215 ? 0 : 4);
    const lines = roadEarthworkLines(
      [
        road([
          [0, 0.5],
          [1, 0.5],
        ]),
      ],
      [0, 0],
      SIZE,
    );
    const natural = field(shore);
    const water = (_x: number, z: number): boolean => z > 215;
    const dry = surface(gradeRoadEarthworks(natural, lines, shore));
    const wet = surface(gradeRoadEarthworks(natural, lines, shore, { water }));
    // Without the map's water the bench would fill the lake's edge, a few meters out.
    expect(dry(200, 218.75)).toBeGreaterThan(1);
    expect(wet(200, 218.75)).toBeCloseTo(0, 4);
    expect(gradeRoadEarthworks(natural, lines, shore, { surfaceResolution: 9 })).toBe(natural);
    expect(gradeRoadEarthworks(natural, [], shore)).toBe(natural);
  });

  it('grades for roads and railways on the ground only', () => {
    const line: TerrainSemanticPoint[] = [
      [0, 0.5],
      [1, 0.5],
    ];
    const count = (feature: TerrainTransportationFeature): number =>
      roadEarthworkLines([feature], [0, 0], SIZE).length;
    expect(count(road(line))).toBe(1);
    expect(count(road(line, { class: 'rail', subclass: 'rail' }))).toBe(1);
    expect(count(road(line, { bridge: true }))).toBe(0);
    expect(count(road(line, { tunnel: true }))).toBe(0);
    expect(count(road(line, { class: 'path', subclass: 'footway' }))).toBe(0);
    expect(count(road(line, { class: 'ferry' }))).toBe(0);
    // Stations a few meters apart, cut to the tile.
    const [stations] = roadEarthworkLines(
      [
        road([
          [-0.2, 0.5],
          [1.2, 0.5],
        ]),
      ],
      [100, 0],
      SIZE,
    );
    expect(stations?.bounds).toEqual([100, 200, 500, 200]);
    expect(stations?.points.length).toBe(81 * 2);
  });

  it('splits a line by a box without overlap or gap', () => {
    const line: TerrainSemanticPoint[] = [
      [-0.5, 0.5],
      [0.5, 0.5],
      [1.5, 0.5],
      [1.5, 1.5],
    ];
    const box = [0, 0, 1, 1] as const;
    expect(clipRoadLine(line, box)).toEqual([
      [
        [0, 0.5],
        [0.5, 0.5],
        [1, 0.5],
      ],
    ]);
    expect(clipRoadLine(line, box, true)).toEqual([
      [
        [-0.5, 0.5],
        [0, 0.5],
      ],
      [
        [1, 0.5],
        [1.5, 0.5],
        [1.5, 1.5],
      ],
    ]);
  });

  it('reads a profile along the road: exact on a plane, averaged over a bump', () => {
    const plane = (x: number, z: number): number => 3 + 0.1 * x - 0.05 * z;
    expect(roadProfileHeight(plane, 50, 20, 0.6, 0.8)).toBeCloseTo(plane(50, 20), 9);
    const bump = (x: number): number => (Math.abs(x) < 4 ? 2 : 0);
    const along = roadProfileHeight(bump, 0, 0, 1, 0);
    expect(along).toBeGreaterThan(0.3);
    expect(along).toBeLessThan(0.5);
    // Across the road's direction the bump is not on its line at all, but for the point itself.
    expect(roadProfileHeight((x) => bump(x), 0, 0, 0, 1)).toBeCloseTo(2, 9);
  });
});
