import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WildlifeHabitatTiles } from '../src/client/wildlife-habitat';

const square = {
  outer: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ] as [number, number][],
};
function context(size = 400): TerrainPyramidTileLayerContext {
  return {
    address: { level: 15, x: 0, z: 0 },
    pyramid: {} as TerrainPyramidTileLayerContext['pyramid'],
    descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
    heightfield: new Heightfield(new Float32Array(9).fill(0.5), 3, 3, {
      origin: [0, 0],
      worldSize: [size, size],
      height: { min: 0, max: 10 },
    }),
    origin: [0, 0],
    tileSize: size,
    surfaceResolution: 3,
    signal: new AbortController().signal,
  };
}
function empty(): TerrainSemanticTile {
  return {
    format: 'molen/terrain-semantics@1',
    landcover: [],
    water: [],
    buildings: [],
    transportation: [],
  };
}
function setup() {
  const root = new THREE.Group(),
    cover = new THREE.Group(),
    features = new THREE.Group();
  root.add(cover, features);
  const index = new WildlifeHabitatTiles(root, 0);
  const land = empty();
  land.landcover.push({ class: 'forest', subclass: 'evergreen', polygons: [square] });
  index.observer('landcover').added(cover, land, context());
  return { root, cover, features, index, land };
}

describe('wildlife mapped habitat', () => {
  it('requires displayed feature coverage and recognizes source class when subtype is botanical', () => {
    const { index, features } = setup();
    index.sync([100, 5, 100], 300);
    expect(index.sample(100, 100, 0.5)).toBeUndefined();
    index.observer('features').added(features, empty(), context());
    index.sync([100, 5, 100], 300);
    expect(index.sample(100, 100, 0.5)).toMatchObject({
      kind: 'forest',
      safe: true,
      height: 5,
      water: false,
    });
    features.visible = false;
    index.sync([100, 5, 100], 300);
    expect(index.sample(100, 100, 0.5)).toBeUndefined();
  });

  it('answers a kept sample again until a tile under the point changes', () => {
    const { index, features, root } = setup();
    index.observer('features').added(features, empty(), context());
    index.sync([100, 5, 100], 300);
    const kept = index.sample(100, 100, 0.5, true);
    expect(kept).toMatchObject({ kind: 'forest', safe: true });
    expect(index.sample(100, 100, 0.5, true)).toBe(kept);
    expect(index.sample(100, 100, 0.5)).not.toBe(kept);
    // A finer features tile now holds the point: sampled again, against it.
    const finer = new THREE.Group();
    root.add(finer);
    const road = empty();
    road.transportation.push({
      class: 'primary',
      lines: [
        [
          [0, 0.25],
          [1, 0.25],
        ],
      ],
    });
    index.observer('features').added(finer, road, { ...context(200), tileSize: 200 });
    index.sync([100, 5, 100], 300);
    const fresh = index.sample(100, 50, 0.5, true);
    expect(fresh?.safe).toBe(false);
    expect(index.sample(100, 100, 0.5, true)).not.toBe(kept);
  });

  it('excludes buffered roads and buildings while preserving courtyard holes', () => {
    const { index, features } = setup();
    const tile = empty();
    tile.transportation.push({
      class: 'road',
      width: 8,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    });
    tile.buildings.push({
      polygons: [
        {
          outer: [
            [0.1, 0.1],
            [0.4, 0.1],
            [0.4, 0.4],
            [0.1, 0.4],
          ],
          holes: [
            [
              [0.2, 0.2],
              [0.3, 0.2],
              [0.3, 0.3],
              [0.2, 0.3],
            ],
          ],
        },
      ],
    });
    index.observer('features').added(features, tile, context());
    index.sync([100, 5, 100], 300);
    expect(index.sample(300, 202, 0.5)?.safe).toBe(false);
    expect(index.sample(300, 190, 0.5)?.safe).toBe(true);
    expect(index.sample(60, 60, 0.5)?.safe).toBe(false);
    expect(index.sample(100, 100, 0.5)?.safe).toBe(true);
  });

  it('shares the rendered water datum and keeps islands dry', () => {
    const { index, features } = setup();
    const tile = empty();
    tile.water.push({
      class: 'lake',
      polygons: [
        {
          ...square,
          holes: [
            [
              [0.4, 0.4],
              [0.6, 0.4],
              [0.6, 0.6],
              [0.4, 0.6],
            ],
          ],
        },
      ],
    });
    index.observer('features').added(features, tile, context());
    index.sync([100, 5, 100], 300);
    expect(index.sample(100, 100, 0.2)).toMatchObject({
      water: true,
      height: 5.65,
      kind: 'freshwater',
      waterDistance: 0,
    });
    expect(index.sample(200, 200, 0.2)).toMatchObject({ water: false, height: 5, kind: 'forest' });
    expect(index.sample(200, 200, 0.2)?.waterDistance).toBeCloseTo(40);
  });

  it('selects the finest displayed tile and never uses a hidden fallback for habitat', () => {
    const { root, index, features } = setup();
    index.observer('features').added(features, empty(), context());
    const fine = new THREE.Group();
    root.add(fine);
    const land = empty();
    land.landcover.push({ class: 'commercial', polygons: [square] });
    index.observer('landcover').added(fine, land, context(200));
    index.sync([100, 5, 100], 300);
    expect(index.sample(100, 100, 0.5)?.safe).toBe(false);
    expect(index.sample(300, 300, 0.5)?.safe).toBe(true);
    index.observer('landcover').removed(fine);
    index.sync([100, 5, 100], 300);
    expect(index.sample(100, 100, 0.5)?.safe).toBe(true);
    index.clear();
    expect(index.sample(100, 100, 0.5)).toBeUndefined();
  });

  /** One 400 m tile of the given land cover and human features, both displayed. */
  function town(
    landcover: TerrainSemanticTile['landcover'],
    features: Partial<TerrainSemanticTile> = {},
  ): WildlifeHabitatTiles {
    const root = new THREE.Group(),
      cover = new THREE.Group(),
      built = new THREE.Group();
    root.add(cover, built);
    const index = new WildlifeHabitatTiles(root, 0);
    index.observer('landcover').added(cover, { ...empty(), landcover }, context());
    index.observer('features').added(built, { ...empty(), ...features }, context());
    index.sync([200, 5, 200], 300);
    return index;
  }
  const rectangle = (x0: number, z0: number, x1: number, z1: number) => ({
    outer: [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ] as [number, number][],
  });

  it('makes residential land a yard between its houses and streets, which keep their buffers', () => {
    // A house at 40..80 m and an 8 m street along z = 200 m, on a residential tile.
    const index = town([{ class: 'residential', polygons: [square] }], {
      buildings: [{ polygons: [rectangle(0.1, 0.1, 0.2, 0.2)] }],
      transportation: [
        {
          class: 'minor_road',
          width: 8,
          lines: [
            [
              [0, 0.5],
              [1, 0.5],
            ],
          ],
        },
      ],
    });
    // The lawn.
    expect(index.sample(120, 120, 0.2)).toMatchObject({
      kind: 'yard',
      safe: true,
      overflight: false,
    });
    // Inside the house, and within its 1 m buffer plus the animal's margin.
    expect(index.sample(60, 60, 0.2)).toMatchObject({ safe: false, overflight: false });
    expect(index.sample(81, 60, 0.2)).toMatchObject({ safe: false, overflight: false });
    expect(index.sample(81.5, 60, 0.2)).toMatchObject({ kind: 'yard', safe: true });
    // On the street and within its 2 m buffer: still a yard, closed to all but flight.
    expect(index.sample(300, 200, 0.2)).toMatchObject({
      kind: 'yard',
      safe: false,
      overflight: true,
    });
    expect(index.sample(300, 206, 0.2)).toMatchObject({ safe: false, overflight: true });
    expect(index.sample(300, 206.5, 0.2)).toMatchObject({ safe: true, overflight: false });
  });

  it('keeps built-up land and unknown ground closed, to flight as well', () => {
    for (const use of [
      'commercial',
      'industrial',
      'retail',
      'construction',
      'landfill',
      'quarry',
      'airport',
      'aerodrome',
      'urban_area',
    ])
      expect(town([{ class: use, polygons: [square] }]).sample(120, 120, 0.2), use).toMatchObject({
        kind: 'unknown',
        safe: false,
        overflight: false,
      });
    // No land cover under the point, with and without a street on it.
    const street = {
      transportation: [
        {
          class: 'minor_road',
          width: 8,
          lines: [
            [
              [0, 0.5],
              [1, 0.5],
            ] as [number, number][],
          ],
        },
      ],
    };
    const bare = town([{ class: 'residential', polygons: [rectangle(0, 0, 0.25, 1)] }], street);
    expect(bare.sample(300, 120, 0.2)).toMatchObject({
      kind: 'unknown',
      safe: false,
      overflight: false,
    });
    expect(bare.sample(300, 200, 0.2)).toMatchObject({
      kind: 'unknown',
      safe: false,
      overflight: false,
    });
    expect(bare.sample(50, 200, 0.2)).toMatchObject({ kind: 'yard', overflight: true });
  });

  it('lets a park, lawn or wood mapped on residential land win in either order', () => {
    const residential = { class: 'residential', polygons: [square] };
    for (const [use, kind] of [
      ['park', 'park'],
      ['grass', 'grass'],
      ['wood', 'forest'],
      ['meadow', 'meadow'],
      ['wetland', 'wetland'],
      ['garden', 'park'],
      ['cemetery', 'park'],
      ['village_green', 'park'],
      ['recreation_ground', 'park'],
      ['golf_course', 'park'],
    ] as const) {
      const green = { class: use, polygons: [rectangle(0.5, 0.5, 0.75, 0.75)] };
      for (const landcover of [
        [residential, green],
        [green, residential],
      ]) {
        const index = town(landcover);
        expect(index.sample(250, 250, 0.2), use).toMatchObject({ kind, safe: true });
        expect(index.sample(120, 120, 0.2), use).toMatchObject({ kind: 'yard', safe: true });
      }
    }
    // Between two habitats neither of which is the residential land, the later still wins.
    const lawn = { class: 'grass', polygons: [rectangle(0.5, 0.5, 0.75, 0.75)] };
    const park = { class: 'park', polygons: [square] };
    expect(town([park, lawn]).sample(250, 250, 0.2)?.kind).toBe('grass');
    expect(town([lawn, park]).sample(250, 250, 0.2)?.kind).toBe('park');
  });
});
