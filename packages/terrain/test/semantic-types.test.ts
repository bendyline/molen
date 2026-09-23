import { describe, expect, it } from 'vitest';
import { assertTerrainSemanticTile, createEmptyTerrainSemanticTile } from '../src/semantic-types';

describe('normalized terrain semantics', () => {
  it('creates independent empty tiles', () => {
    const first = createEmptyTerrainSemanticTile();
    const second = createEmptyTerrainSemanticTile();
    first.landcover.push({
      class: 'forest',
      polygons: [
        {
          outer: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
      ],
    });
    expect(second.landcover).toEqual([]);
    expect(() => assertTerrainSemanticTile(first)).not.toThrow();
  });

  it('accepts buffered finite coordinates but rejects malformed geometry and metrics', () => {
    const buffered = createEmptyTerrainSemanticTile();
    buffered.transportation.push({
      class: 'road',
      lines: [
        [
          [-0.1, 0.5],
          [1.1, 0.5],
        ],
      ],
    });
    expect(() => assertTerrainSemanticTile(buffered)).not.toThrow();

    const malformed = createEmptyTerrainSemanticTile();
    malformed.buildings.push({
      height: -1,
      polygons: [
        {
          outer: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
      ],
    });
    expect(() => assertTerrainSemanticTile(malformed)).toThrow(/height must not be negative/);
  });
});

describe('semantic subclass fields', () => {
  it('accepts subclass, layer, and name but rejects empty strings', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings.push({
      class: 'building',
      subclass: 'garage',
      layer: -1,
      name: 'x',
      polygons: [
        {
          outer: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
      ],
    });
    expect(() => assertTerrainSemanticTile(tile)).not.toThrow();
    const bad = createEmptyTerrainSemanticTile();
    bad.landcover.push({
      class: 'forest',
      subclass: ' ',
      polygons: [
        {
          outer: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
      ],
    });
    expect(() => assertTerrainSemanticTile(bad)).toThrow(/subclass must be a non-empty string/);
  });
});

describe('degenerate semantic rings', () => {
  it('rejects a hole that encloses no area with the offending ring path', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings.push({
      height: 12,
      polygons: [
        {
          outer: [
            [0.2, 0.2],
            [0.8, 0.2],
            [0.8, 0.8],
            [0.2, 0.8],
          ],
          holes: [
            [
              [0.5, 0.5],
              [0.5, 0.5],
              [0.5, 0.5],
            ],
          ],
        },
      ],
    });
    expect(() => assertTerrainSemanticTile(tile)).toThrow(
      /\/buildings\/0\/polygons\/0\/holes\/0 must enclose an area/,
    );
  });

  it('rejects collinear outer rings but keeps small real footprints', () => {
    const collinear = createEmptyTerrainSemanticTile();
    collinear.landcover.push({
      class: 'forest',
      polygons: [
        {
          outer: [
            [0, 0],
            [0.5, 0.5],
            [1, 1],
          ],
        },
      ],
    });
    expect(() => assertTerrainSemanticTile(collinear)).toThrow(
      /\/landcover\/0\/polygons\/0\/outer must enclose an area/,
    );

    // A one-square-meter footprint on a ~2.4 km tile still validates.
    const tiny = createEmptyTerrainSemanticTile();
    tiny.buildings.push({
      polygons: [
        {
          outer: [
            [0.5, 0.5],
            [0.5004, 0.5],
            [0.5004, 0.5004],
            [0.5, 0.5004],
          ],
        },
      ],
    });
    expect(() => assertTerrainSemanticTile(tiny)).not.toThrow();
  });
});
