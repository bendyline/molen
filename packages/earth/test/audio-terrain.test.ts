import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EarthAudioTerrain } from '../src/client/audio-terrain';

const empty = (): TerrainSemanticTile => ({
  format: 'molen/terrain-semantics@1',
  landcover: [],
  water: [],
  transportation: [],
  buildings: [],
});
const context = (x = 0): TerrainPyramidTileLayerContext => ({
  address: { level: 15, x: 0, z: 0 },
  pyramid: {} as TerrainPyramidTileLayerContext['pyramid'],
  descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
  origin: [x, 0],
  tileSize: 100,
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin: [x, 0],
    worldSize: [100, 100],
    height: { min: 0, max: 1 },
  }),
  surfaceResolution: 2,
  signal: new AbortController().signal,
});

describe('mapped World audio context', () => {
  it('finds a shore across tile boundaries, ignores lakes and artificial water tile seams', () => {
    const terrain = new EarthAudioTerrain(),
      root = new THREE.Group(),
      object = new THREE.Group();
    root.add(object);
    const tile = empty();
    tile.water = [
      {
        class: 'ocean',
        polygons: [
          {
            outer: [
              [0.1, 0],
              [1, 0],
              [1, 1],
              [0.1, 1],
            ],
          },
        ],
      },
    ];
    terrain.observer.added(object, tile, context(100));
    expect(terrain.sample(95, 50).coastDistance).toBeCloseTo(15);
    expect(terrain.sample(195, 50).coastDistance).toBeCloseTo(85); // not 5 m from the artificial edge
    tile.water[0]!.class = 'lake';
    expect(terrain.sample(95, 50).coastDistance).toBe(Infinity);
    expect(terrain.sample(95, 50).riverDistance).toBe(Infinity);
    tile.water = [
      {
        class: 'ocean',
        polygons: [
          {
            outer: [
              [-0.05, -0.05],
              [1.05, -0.05],
              [1.05, 1.05],
              [-0.05, 1.05],
            ],
          },
        ],
      },
    ];
    expect(terrain.sample(150, 50).coastDistance).toBe(Infinity);
    tile.water = [
      {
        class: 'stream',
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
        width: 2,
      },
    ];
    expect(terrain.sample(150, 55).riverDistance).toBeCloseTo(4);
    object.visible = false;
    expect(terrain.sample(150, 55).riverDistance).toBe(Infinity);
    object.visible = true;
    terrain.observer.removed(object);
    expect(terrain.sample(150, 55).riverDistance).toBe(Infinity);
  });
  it('uses road widths and mapped materials without requiring parked cars; roads beat landcover', () => {
    const terrain = new EarthAudioTerrain(),
      root = new THREE.Group(),
      road = new THREE.Group(),
      cover = new THREE.Group();
    root.add(road, cover);
    const roads = empty(),
      land = empty();
    roads.transportation = [
      {
        class: 'residential',
        surface: 'gravel',
        width: 6,
        lines: [
          [
            [0, 0.5],
            [1, 0.5],
          ],
        ],
      },
    ];
    land.landcover = [
      {
        class: 'forest',
        polygons: [
          {
            outer: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          },
        ],
      },
    ];
    terrain.observer.added(road, roads, context());
    terrain.observer.added(cover, land, context());
    expect(terrain.sample(50, 52)).toMatchObject({ streetDistance: 0, surface: 'gravel' });
    expect(terrain.sample(50, 60).streetDistance).toBeCloseTo(7);
    expect(terrain.sample(50, 60).surface).toBe('leaves');
    terrain.clear();
    expect(terrain.sample(50, 52).surface).toBeUndefined();
  });
});
