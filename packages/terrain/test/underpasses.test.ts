import { describe, expect, it } from 'vitest';
import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticLine,
  type TerrainTransportationFeature,
} from '../src/semantic-types';
import { withTerrainUnderpasses } from '../src/underpasses';

/** Tile edge in world units: points below are metres, stored as tile fractions. */
const SIZE = 1000;
const line = (...points: [number, number][]): TerrainSemanticLine =>
  points.map(([x, z]) => [x / SIZE, z / SIZE]);

function way(
  props: Partial<TerrainTransportationFeature>,
  ...points: [number, number][]
): TerrainTransportationFeature {
  return { class: 'major_road', subclass: 'tertiary', ...props, lines: [line(...points)] };
}

/**
 * The Avenue in Hurstville, Sydney (z15 tile 30138/19674), as the map has it: a street tagged as
 * a tunnel for the 26 m it passes beneath a private service road's bridge and the four
 * Illawarra line tracks' bridges, with the ordinary street at either end.
 */
function hurstville() {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation.push(
    way({ name: 'The Avenue' }, [494.6, 481.5], [495.8, 507.5]),
    way({ name: 'The Avenue', tunnel: true, id: 22 }, [495.8, 507.5], [497.8, 533.5]),
    way({ name: 'The Avenue' }, [497.8, 533.5], [498.6, 544.9]),
    way({ class: 'minor_road', subclass: 'service', bridge: true }, [487.9, 511.2], [505.5, 510.2]),
    way({ class: 'rail', subclass: 'rail', bridge: true }, [489.7, 514.7], [503.5, 514.0]),
    way({ class: 'rail', subclass: 'rail', bridge: true }, [489.9, 518.4], [503.5, 517.7]),
    way({ class: 'rail', subclass: 'rail', bridge: true }, [489.9, 523.6], [503.8, 522.6]),
    way({ class: 'rail', subclass: 'rail', bridge: true }, [490.2, 527.3], [504.0, 526.6]),
    // The cycleway beside the street goes on under the bridges, as the map has it, untagged.
    way({ class: 'path', subclass: 'cycleway' }, [501.8, 535.0], [500.8, 508.0]),
  );
  return tile;
}

describe('underpasses', () => {
  it('makes a street mapped as a tunnel beneath railway bridges the street under them', () => {
    const tile = hurstville();
    const result = withTerrainUnderpasses(tile, SIZE);
    expect(result).not.toBe(tile);
    const avenue = result.transportation[1];
    expect(avenue?.tunnel).toBeUndefined();
    expect(avenue).toMatchObject({ name: 'The Avenue', id: 22, subclass: 'tertiary' });
    expect(avenue?.lines).toEqual(tile.transportation[1]?.lines);
    // Everything else is the same feature it was.
    for (const i of [0, 2, 3, 4, 5, 6, 7, 8])
      expect(result.transportation[i]).toBe(tile.transportation[i]);
  });

  it('returns the tile itself when it has no tunnel or no bridge to account for one', () => {
    const plain = createEmptyTerrainSemanticTile();
    plain.transportation.push(way({}, [0, 500], [1000, 500]));
    expect(withTerrainUnderpasses(plain, SIZE)).toBe(plain);
    const bridgeless = createEmptyTerrainSemanticTile();
    bridgeless.transportation.push(way({ tunnel: true }, [400, 500], [430, 500]));
    expect(withTerrainUnderpasses(bridgeless, SIZE)).toBe(bridgeless);
  });

  it('keeps a bored tunnel that one bridge crosses on its way', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      way({ subclass: 'motorway', tunnel: true }, [300, 500], [700, 500]),
      way({ subclass: 'primary', bridge: true }, [500, 480], [500, 520]),
    );
    expect(withTerrainUnderpasses(tile, SIZE)).toBe(tile);
  });

  it('keeps a tunnel that runs on well past the bridges over it', () => {
    const tile = hurstville();
    // The same street tagged on for 40 m beyond the last track.
    (tile.transportation[1] as TerrainTransportationFeature).lines = [
      line([495.8, 507.5], [499.3, 567.5]),
    ];
    expect(withTerrainUnderpasses(tile, SIZE)).toBe(tile);
  });

  it('keeps an authored tunnel floor', () => {
    const tile = hurstville();
    (tile.transportation[1] as TerrainTransportationFeature).tunnelFloorElevation = 58;
    expect(withTerrainUnderpasses(tile, SIZE)).toBe(tile);
  });

  it('does not count a bridge that lands on the way as passing over it', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      way({ tunnel: true }, [400, 500], [420, 500]),
      // A ramp's deck that ends on the tunnel's line, and one joined end to end with it.
      way({ link: true, bridge: true }, [410, 460], [410, 500]),
      way({ bridge: true }, [380, 500], [400, 500]),
    );
    expect(withTerrainUnderpasses(tile, SIZE)).toBe(tile);
  });

  it('opens only the lines of a feature that pass beneath bridges', () => {
    const tile = hurstville();
    const avenue = tile.transportation[1] as TerrainTransportationFeature;
    avenue.lines.push(line([100, 100], [100, 300]));
    const result = withTerrainUnderpasses(tile, SIZE);
    const named = result.transportation.filter((f) => f.id === 22);
    expect(named.map((f) => [f.tunnel, f.lines.length])).toEqual([
      [true, 1],
      [undefined, 1],
    ]);
    expect(named[0]?.lines[0]).toEqual(line([100, 100], [100, 300]));
  });

  it('leaves a tunnel the tile does not see whole to its bore', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.transportation.push(
      // A subway's last 12 m before the tile's west edge, read on into the tile's buffer, under
      // a bridge: the far end is where the tile stopped reading it, not a portal.
      way({ class: 'rail', subclass: 'subway', tunnel: true }, [-6, 500], [12, 500]),
      way({ bridge: true }, [4, 480], [4, 520]),
    );
    expect(withTerrainUnderpasses(tile, SIZE)).toBe(tile);
  });

  it('keeps an underpass that goes on as a tunnel, and opens one mapped as two ways', () => {
    const tile = hurstville();
    // The street tagged on as a second tunnel way for 200 m past the bridges.
    tile.transportation.push(way({ tunnel: true }, [497.8, 533.5], [505, 733]));
    expect(withTerrainUnderpasses(tile, SIZE)).toBe(tile);
    // Split under the bridges instead: both halves are the street under them.
    const split = hurstville();
    split.transportation.splice(
      1,
      1,
      way({ name: 'The Avenue', tunnel: true }, [495.8, 507.5], [496.8, 520.5]),
      way({ name: 'The Avenue', tunnel: true }, [496.8, 520.5], [497.8, 533.5]),
    );
    const result = withTerrainUnderpasses(split, SIZE);
    expect(result.transportation.filter((f) => f.tunnel)).toEqual([]);
  });
});
