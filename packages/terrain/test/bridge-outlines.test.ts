import { describe, expect, it } from 'vitest';
import {
  TERRAIN_BRIDGE_OUTLINE_SHARE,
  terrainBridgeDeckShares,
  withoutTerrainBridgeOutlines,
} from '../src/bridge-outlines';
import {
  packTerrainSemanticTile,
  rememberTerrainSemanticTilePacket,
  terrainSemanticTileFromPacket,
  terrainSemanticTilePacket,
} from '../src/semantic-packet';
import {
  createEmptyTerrainSemanticTile,
  setTerrainSemanticTileContentHash,
  type TerrainLandcoverFeature,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  terrainSemanticTileContentHash,
} from '../src/semantic-types';

/** Tile edge in world units. */
const SIZE = 1000;
/** World units to a meter at Seattle's latitude (1 / cos 47.5°). */
const SCALE = 1.48;
/** Meters east and north of the tile's middle, as tile fractions. */
const at = (east: number, north: number): [number, number] => [
  (500 + east * SCALE) / SIZE,
  (500 - north * SCALE) / SIZE,
];

function way(
  props: Partial<TerrainTransportationFeature>,
  ...points: [number, number][]
): TerrainTransportationFeature {
  return { class: 'major_road', ...props, lines: [points.map(([e, n]) => at(e, n))] };
}

function area(...points: [number, number][]): TerrainSemanticPolygon {
  return { outer: points.map(([e, n]) => at(e, n)) };
}

/** A square `side` meters across with its south-west corner at `east, north`. */
function square(east: number, north: number, side: number): TerrainSemanticPolygon {
  return area(
    [east, north],
    [east + side, north],
    [east + side, north + side],
    [east, north + side],
  );
}

/**
 * Martin Luther King Jr Way S (SR 900) crossing I-5 at 47.4994, -122.2735 (z15 tile 5254/11458)
 * as the map has it: the northbound carriageway's bridge, the bridge's outline (OSM
 * `man_made=bridge`, which the basemap files as a pedestrian area), and I-5 beneath both.
 */
function mlkOverI5(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation.push(
    way(
      {
        subclass: 'primary',
        oneway: true,
        bridge: true,
        name: 'Martin Luther King Junior Way South',
      },
      [-85.2, 34.7],
      [-75.7, 28.4],
      [-50.1, 15.3],
      [26.1, -21.6],
      [36.8, -28.9],
    ),
    way(
      { class: 'highway', subclass: 'motorway', oneway: true, ref: 'I 5' },
      [-273.2, 342.3],
      [84.6, -167.0],
    ),
    way(
      { class: 'highway', subclass: 'motorway', oneway: true, ref: 'I 5' },
      [74.5, -117.6],
      [-15.4, 9.5],
      [-244.0, 342.3],
    ),
  );
  tile.landcover.push({
    class: 'pedestrian',
    polygons: [
      area(
        [34.2, -33.1],
        [24.5, -26.8],
        [12.2, -20.0],
        [-61.0, 14.5],
        [-71.1, 20.0],
        [-88.0, 30.4],
        [-82.2, 39.1],
        [-71.9, 32.5],
        [-56.6, 24.0],
        [8.4, -6.5],
        [24.3, -14.5],
        [40.1, -24.2],
      ),
    ],
  });
  return tile;
}

const classes = (tile: TerrainSemanticTile): string[] => tile.landcover.map((f) => f.class);

describe('bridge outlines', () => {
  it('leaves out a bridge outline the map files as a pedestrian area', () => {
    const tile = mlkOverI5();
    const [outline] = tile.landcover[0]?.polygons ?? [];
    expect(terrainBridgeDeckShares(tile, SIZE).get(outline as TerrainSemanticPolygon)).toBe(1);
    const result = withoutTerrainBridgeOutlines(tile, SIZE);
    expect(result).not.toBe(tile);
    expect(result.landcover).toEqual([]);
    // Only the land cover changes; the tile it came from is left as it was.
    expect(result.transportation).toBe(tile.transportation);
    expect(classes(tile)).toEqual(['pedestrian']);
  });

  it('keeps a plaza a footbridge lands in, and paved land no bridge crosses', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      way({ class: 'path', subclass: 'footway', bridge: true }, [-60, 30], [30, 30]),
      // A pedestrian street through a plaza, on the ground.
      way({ class: 'path', subclass: 'pedestrian' }, [100, -100], [100, 100]),
    );
    tile.landcover.push(
      { class: 'pedestrian', polygons: [square(0, 0, 60)] },
      { class: 'pedestrian', polygons: [square(80, -20, 40)] },
    );
    const shares = terrainBridgeDeckShares(tile, SIZE);
    const landing = shares.get(tile.landcover[0]?.polygons[0] as TerrainSemanticPolygon);
    expect(landing).toBeGreaterThan(0);
    expect(landing).toBeLessThan(TERRAIN_BRIDGE_OUTLINE_SHARE);
    // No bridge comes near the second plaza at all.
    expect(shares.has(tile.landcover[1]?.polygons[0] as TerrainSemanticPolygon)).toBe(false);
    expect(withoutTerrainBridgeOutlines(tile, SIZE)).toBe(tile);
  });

  it('keeps other land along a deck: a parking lot or a park under a viaduct', () => {
    const tile = mlkOverI5();
    const footprint = tile.landcover[0]?.polygons[0] as TerrainSemanticPolygon;
    tile.landcover = [
      { class: 'parking', polygons: [footprint] },
      { class: 'park', polygons: [footprint] },
    ];
    expect(withoutTerrainBridgeOutlines(tile, SIZE)).toBe(tile);
  });

  it('drops only the outline from a feature that also has a plaza', () => {
    const tile = mlkOverI5();
    const outline = tile.landcover[0]?.polygons[0] as TerrainSemanticPolygon;
    const plaza = square(-150, -150, 50);
    const feature: TerrainLandcoverFeature = { class: 'pedestrian', polygons: [outline, plaza] };
    const park: TerrainLandcoverFeature = { class: 'park', polygons: [square(100, 100, 50)] };
    tile.landcover = [feature, park];
    const result = withoutTerrainBridgeOutlines(tile, SIZE);
    expect(result.landcover).toHaveLength(2);
    expect(result.landcover[0]).toEqual({ class: 'pedestrian', polygons: [plaza] });
    expect(result.landcover[1]).toBe(park);
  });

  it('carries the tile packet and content hash over with the edit', () => {
    const tile = mlkOverI5();
    const park: TerrainLandcoverFeature = { class: 'park', polygons: [square(100, 100, 50)] };
    tile.landcover.push(park);
    rememberTerrainSemanticTilePacket(tile, packTerrainSemanticTile(tile));
    setTerrainSemanticTileContentHash(tile, 'mlk');
    const result = withoutTerrainBridgeOutlines(tile, SIZE);
    expect(classes(result)).toEqual(['park']);
    const packet = terrainSemanticTilePacket(result);
    if (packet === undefined) throw new Error('the edited tile lost its packet');
    const received = terrainSemanticTileFromPacket(structuredClone(packet));
    expect(received.landcover).toEqual(result.landcover);
    expect(received.transportation).toEqual(tile.transportation);
    expect(terrainSemanticTileContentHash(result)).toBe(`mlk|bridge-outlines@1:${SIZE}`);
  });

  it('works the same out a second time from the same lists', () => {
    const tile = mlkOverI5();
    const first = withoutTerrainBridgeOutlines(tile, SIZE);
    const again = withoutTerrainBridgeOutlines({ ...tile }, SIZE);
    expect(again.landcover).toBe(first.landcover);
    // A different road list is a different question.
    const bare = withoutTerrainBridgeOutlines({ ...tile, transportation: [] }, SIZE);
    expect(classes(bare)).toEqual(['pedestrian']);
  });
});
