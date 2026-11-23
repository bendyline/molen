import type {
  TerrainPyramidTileLayerContext,
  TerrainSemanticTile,
} from '@bendyline/molen-terrain/client';
import { Heightfield } from '@bendyline/molen-terrain/kernel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EarthLocator, placeExtent } from '../src/client/locator';

const empty = (): TerrainSemanticTile => ({
  format: 'molen/terrain-semantics@1',
  landcover: [],
  water: [],
  transportation: [],
  buildings: [],
});
/** The pyramid's root square: level-15 tiles are 1 km, level-13 tiles 4 km. */
const ROOT = 1000 * 2 ** 15;
const context = (
  origin: [number, number],
  tileSize: number,
  level = 15,
): TerrainPyramidTileLayerContext => ({
  address: { level, x: Math.floor(origin[0] / tileSize), z: Math.floor(origin[1] / tileSize) },
  pyramid: {
    origin: [0, 0],
    rootSize: ROOT,
  } as unknown as TerrainPyramidTileLayerContext['pyramid'],
  descriptor: {} as TerrainPyramidTileLayerContext['descriptor'],
  origin,
  tileSize,
  heightfield: new Heightfield(new Float32Array(4), 2, 2, {
    origin,
    worldSize: [tileSize, tileSize],
    height: { min: 0, max: 1 },
  }),
  surfaceResolution: 2,
  signal: new AbortController().signal,
});

/** A 1 km tile at the origin: Buena Road north–south at x = 500, Highland Drive east–west at z = 500. */
function crossroads(): TerrainSemanticTile {
  const tile = empty();
  tile.transportation = [
    {
      class: 'major_road',
      subclass: 'primary',
      name: 'Buena Road',
      ref: 'WA 22',
      width: 10,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    },
    {
      class: 'minor_road',
      subclass: 'residential',
      name: 'Highland Drive',
      width: 8,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    },
    // Unnamed roads, railways and tunnels never name a street.
    {
      class: 'minor_road',
      lines: [
        [
          [0.2, 0],
          [0.2, 1],
        ],
      ],
    },
    {
      class: 'rail',
      name: 'BNSF Yakima Valley Subdivision',
      lines: [
        [
          [0.7, 0],
          [0.7, 1],
        ],
      ],
    },
    {
      class: 'highway',
      name: 'Under Tunnel',
      tunnel: true,
      lines: [
        [
          [0.9, 0],
          [0.9, 1],
        ],
      ],
    },
  ];
  return tile;
}

describe('EarthLocator', () => {
  it('names the street underfoot, prefers the road along the heading at a junction, and stops at the radius', () => {
    const locator = new EarthLocator();
    locator.observer.added(new THREE.Group(), crossroads(), context([0, 0], 1000));
    // On Buena Road, west of the junction.
    expect(locator.locate(503, 200).street).toEqual({
      name: 'Buena Road',
      ref: 'WA 22',
      class: 'major_road',
      subclass: 'primary',
      distance: 0,
    });
    // Beside it: meters to its edge (5 m half-width).
    expect(locator.locate(520, 200).street?.distance).toBeCloseTo(15, 9);
    // At the junction both are underfoot: the heading decides (0 = north, PI/2 = east).
    expect(locator.locate(500, 500, { heading: 0 }).street?.name).toBe('Buena Road');
    expect(locator.locate(500, 500, { heading: Math.PI / 2 }).street?.name).toBe('Highland Drive');
    expect(locator.locate(500, 500, { heading: -Math.PI / 2 }).street?.name).toBe('Highland Drive');
    // Past the radius, beside the unnamed road, the railway or the tunnel: no street.
    expect(locator.locate(560, 200).street).toBeUndefined();
    expect(locator.locate(560, 200, { streetRadius: 60 }).street?.name).toBe('Buena Road');
    expect(locator.locate(200, 100).street).toBeUndefined();
    expect(locator.locate(700, 100).street).toBeUndefined();
    expect(locator.locate(900, 100).street).toBeUndefined();
  });

  it('forgets a tile’s streets when it is evicted, and reads the finest rendered tile holding the place', () => {
    const locator = new EarthLocator();
    const object = new THREE.Group();
    locator.observer.added(object, crossroads(), context([0, 0], 1000));
    locator.observer.removed(object);
    expect(locator.locate(500, 200).street).toBeUndefined();
    // Only a 4 km tile holds the place (a release whose road tiles end at zoom 13): it answers.
    locator.observer.added(new THREE.Group(), crossroads(), context([-1500, -1500], 4000, 13));
    expect(locator.locate(500, 200).street?.name).toBe('Buena Road');
    // A finer tile over it naming nothing there wins over the coarse tile's generalized lines.
    locator.observer.added(new THREE.Group(), empty(), context([0, 0], 1000));
    expect(locator.locate(500, 200).street).toBeUndefined();
  });

  it('reads a rendered tile as fine as the street source, loading no street tile', () => {
    const locator = new EarthLocator();
    // A zoom-15 tile drawn with zoom-15 roads (road detail): it already has the side streets.
    locator.observer.added(new THREE.Group(), crossroads(), context([0, 0], 1000));
    const asked: string[] = [];
    locator.useStreets({
      level: 15,
      load: async (address) => {
        asked.push(`${address.level}/${address.x}/${address.z}`);
        return undefined;
      },
    });
    expect(locator.locate(503, 200).street?.name).toBe('Buena Road');
    expect(asked).toEqual([]);
  });

  it('takes streets from the street source once its tiles load, and the rendered tiles until then', async () => {
    const locator = new EarthLocator();
    // The rendered 4 km tile (zoom 13) names main roads only: Main Road at x = 200, Second Avenue
    // at x = 1200, both north–south.
    const rendered = empty();
    rendered.transportation = [
      {
        class: 'major_road',
        name: 'Main Road',
        lines: [
          [
            [0.05, 0],
            [0.05, 1],
          ],
        ],
      },
      {
        class: 'major_road',
        name: 'Second Avenue',
        lines: [
          [
            [0.3, 0],
            [0.3, 1],
          ],
        ],
      },
    ];
    locator.observer.added(new THREE.Group(), rendered, context([0, 0], 4000, 13));
    // The 1 km street tiles (zoom 15): (0, 0) names the side street at x = 200; (0, 1) has only
    // an unnamed lane there; (1, 0) is missing.
    const side = empty();
    side.transportation = [
      {
        class: 'minor_road',
        subclass: 'residential',
        name: 'Carrer de Jovellanos',
        lines: [
          [
            [0.2, 0],
            [0.2, 1],
          ],
        ],
      },
    ];
    const lane = empty();
    lane.transportation = [
      {
        class: 'minor_road',
        lines: [
          [
            [0.2, 0],
            [0.2, 1],
          ],
        ],
      },
    ];
    const tiles: Record<string, TerrainSemanticTile | undefined> = { '0/0': side, '0/1': lane };
    const asked: string[] = [];
    const signals: AbortSignal[] = [];
    locator.useStreets({
      level: 15,
      load: async (address, signal) => {
        asked.push(`${address.level}/${address.x}/${address.z}`);
        signals.push(signal);
        return tiles[`${address.x}/${address.z}`];
      },
    });
    // Before the street tile arrives, the rendered tile answers.
    expect(locator.locate(200, 300).street?.name).toBe('Main Road');
    expect(asked).toEqual(['15/0/0']);
    await Promise.resolve();
    expect(locator.locate(200, 300).street).toMatchObject({
      name: 'Carrer de Jovellanos',
      subclass: 'residential',
    });
    // Loaded once.
    expect(asked).toEqual(['15/0/0']);
    // A street tile with roads but none named there: no street, not the coarse tile's.
    locator.locate(200, 1300);
    await Promise.resolve();
    expect(locator.locate(200, 1300).street).toBeUndefined();
    // Where the source has no tile, the rendered tiles answer.
    locator.locate(1200, 300);
    await Promise.resolve();
    expect(locator.locate(1200, 300).street?.name).toBe('Second Avenue');
    // No street wanted: nothing loads.
    const before = asked.length;
    expect(locator.locate(3500, 3500, { street: false }).street).toBeUndefined();
    expect(asked.length).toBe(before);
    // A wide radius loads the 3 × 3 around the place at most, and keeps the tile in use.
    locator.locate(200, 300, { streetRadius: 5000 });
    expect(asked.length - before).toBeLessThanOrEqual(8);
    await Promise.resolve();
    expect(locator.locate(200, 300).street?.name).toBe('Carrer de Jovellanos');
    // Clearing cancels what is in flight.
    locator.locate(2500, 2500);
    locator.clear();
    expect(signals.at(-1)?.aborted).toBe(true);
  });

  it('puts a place in the settlement nearest for its size, and in a district only within it', () => {
    const locator = new EarthLocator();
    const tile = empty();
    // A 20 km tile, origin at (0, 0): Seattle's label at (5000, 5000), Bellevue's 10 km east.
    tile.places = [
      {
        class: 'locality',
        subclass: 'city',
        name: 'Seattle',
        population: 737015,
        point: [0.25, 0.25],
      },
      {
        class: 'locality',
        subclass: 'city',
        name: 'Bellevue',
        population: 151854,
        point: [0.75, 0.25],
      },
      { class: 'neighbourhood', subclass: 'suburb', name: 'Fremont', point: [0.25, 0.15] },
      { class: 'locality', subclass: 'village', name: 'Buena', population: 990, point: [0.5, 0.9] },
    ];
    const object = new THREE.Group();
    locator.observer.added(object, tile, context([0, 0], 20_000));
    // Two kilometres north of downtown Seattle: in Seattle, in Fremont.
    const fremont = locator.locate(5000, 3000);
    expect(fremont.locality).toMatchObject({ name: 'Seattle', kind: 'city', within: true });
    expect(fremont.locality?.distance).toBeCloseTo(2000, 6);
    expect(fremont.district).toMatchObject({ name: 'Fremont', kind: 'suburb', within: true });
    // Downtown Bellevue is Bellevue, though inside Seattle's estimated reach.
    expect(locator.locate(14_500, 5000).locality?.name).toBe('Bellevue');
    // Two kilometres from a village of a thousand people: near it, not in it, and in no district.
    const outside = locator.locate(10_000, 20_000);
    expect(outside.locality).toMatchObject({ name: 'Buena', kind: 'village', within: false });
    expect(outside.district).toBeUndefined();
    // Far from every settlement: nothing.
    expect(locator.locate(10_000, 40_000).locality).toBeUndefined();
    // Labels outlive their tile, so the city still names the ground under finer tiles.
    locator.observer.removed(object);
    expect(locator.locate(5000, 3000).locality?.name).toBe('Seattle');
    locator.clear();
    expect(locator.locate(5000, 3000)).toEqual({});
  });

  it('estimates a place’s extent from its kind and population', () => {
    expect(placeExtent('village', 990)).toBe(1200);
    expect(placeExtent('city', 737015)).toBeCloseTo(15 * Math.sqrt(737015), 6);
    expect(placeExtent('city', 40_000_000)).toBe(25_000);
    expect(placeExtent('neighbourhood', undefined)).toBe(600);
    expect(placeExtent('something_else', undefined)).toBe(1000);
  });
});
