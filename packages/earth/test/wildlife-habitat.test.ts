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
    land.landcover.push({ class: 'residential', polygons: [square] });
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
});
