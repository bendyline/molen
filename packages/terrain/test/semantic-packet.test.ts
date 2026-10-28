import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createOverzoomTerrainSemanticSource } from '../src/semantic-overzoom';
import {
  composeTerrainSemanticTile,
  deriveTerrainSemanticTilePacket,
  keepTerrainSemanticTile,
  packTerrainSemanticTile,
  rememberTerrainSemanticTilePacket,
  terrainSemanticTileFromPacket,
  terrainSemanticTilePacket,
} from '../src/semantic-packet';
import {
  createEmptyTerrainSemanticTile,
  setTerrainSemanticTileContentHash,
  type TerrainSemanticTile,
  terrainSemanticTileContentHash,
} from '../src/semantic-types';

describe('semantic tile packets', () => {
  it('keeps a tile as its packet, decoding it afresh once the tile is collected', async () => {
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;
    const arrived = (): {
      keep: () => TerrainSemanticTile;
      expected: TerrainSemanticTile;
      first: WeakRef<TerrainSemanticTile>;
    } => {
      const source = createEmptyTerrainSemanticTile();
      source.buildings.push({
        polygons: [
          {
            outer: [
              [0.1, 0.1],
              [0.3, 0.1],
              [0.3, 0.3],
            ],
          },
        ],
        height: 12,
      });
      const packet = packTerrainSemanticTile(source);
      const tile = terrainSemanticTileFromPacket(structuredClone(packet));
      rememberTerrainSemanticTilePacket(tile, packet);
      setTerrainSemanticTileContentHash(tile, 'content');
      const keep = keepTerrainSemanticTile(tile);
      if (keep() !== tile) throw new Error('kept tile is not the tile');
      return { keep, expected: structuredClone(tile), first: new WeakRef(tile) };
    };
    const { keep, expected, first } = arrived();
    // A WeakRef's target lives to the end of the task that made or read it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    gc();
    expect(first.deref()).toBeUndefined();
    const again = keep();
    expect(again).toEqual(expected);
    expect(terrainSemanticTilePacket(again)).toBeDefined();
    expect(terrainSemanticTileContentHash(again)).toBe('content');
    expect(keep()).toBe(again);
    // A tile made here, without a packet, is kept as it is.
    const local = createEmptyTerrainSemanticTile();
    expect(keepTerrainSemanticTile(local)()).toBe(local);
  });

  it('keeps shared objects and lines shared, as a structured clone would', () => {
    const tile = createEmptyTerrainSemanticTile();
    const ring: [number, number][] = [
      [0.1, 0.1],
      [0.2, 0.1],
      [0.2, 0.2],
    ];
    const polygons = [{ outer: ring }];
    tile.landcover.push({ class: 'parking', polygons }, { class: 'plaza', polygons });
    tile.transportation.push({ class: 'path', lines: [ring, ring] });
    const packet = packTerrainSemanticTile(tile);
    const copy = terrainSemanticTileFromPacket(structuredClone(packet));
    expect(copy).toEqual(tile);
    expect(copy.landcover[1]?.polygons).toBe(copy.landcover[0]?.polygons);
    expect(copy.transportation[0]?.lines[1]).toBe(copy.transportation[0]?.lines[0]);
    // One copy of the shared ring's points.
    expect(packet.points).toHaveLength(ring.length * 2);
  });

  it('composes land cover onto a feature tile, packet included', () => {
    const features = createEmptyTerrainSemanticTile();
    features.buildings.push({
      id: 3,
      class: 'building',
      polygons: [
        {
          outer: [
            [0.1, 0.1],
            [0.2, 0.1],
            [0.2, 0.2],
          ],
        },
      ],
    });
    const land = createEmptyTerrainSemanticTile();
    land.landcover.push({
      class: 'park',
      polygons: [
        {
          outer: [
            [0.5, 0.5],
            [0.9, 0.5],
            [0.9, 0.9],
          ],
        },
      ],
    });
    land.pois = [{ class: 'bus_stop', point: [0.6, 0.6] }];
    for (const tile of [features, land])
      rememberTerrainSemanticTilePacket(tile, packTerrainSemanticTile(tile));
    for (const pois of [false, true]) {
      const composed = composeTerrainSemanticTile(features, land, { pois });
      const packet = terrainSemanticTilePacket(composed);
      expect(packet?.landcover).toBeDefined();
      if (packet === undefined) throw new Error('composed tile has no packet');
      expect(terrainSemanticTileFromPacket(structuredClone(packet))).toEqual(composed);
      expect(composed.pois).toEqual(pois ? land.pois : undefined);
    }
  });

  it('carries a derived tile as its base packet and edits, in order', () => {
    const square = (x: number): [number, number][] => [
      [x, 0.1],
      [x + 0.05, 0.1],
      [x + 0.05, 0.15],
    ];
    const base = createEmptyTerrainSemanticTile();
    for (let i = 0; i < 5; i++)
      base.buildings.push({ id: i, class: 'building', polygons: [{ outer: square(i / 10) }] });
    base.transportation.push(
      { class: 'primary', lines: [square(0.1), square(0.3)] },
      { class: 'path', lines: [square(0.5)] },
    );
    base.landcover.push({ class: 'park', polygons: [{ outer: square(0.7) }] });
    rememberTerrainSemanticTilePacket(base, packTerrainSemanticTile(base));
    // Footprints replaced by a landmark: two dropped, one cut.
    const filtered = {
      ...base,
      buildings: [
        base.buildings[0],
        { ...base.buildings[2], polygons: [{ outer: square(0.25) }] },
        base.buildings[4],
      ],
    } as typeof base;
    deriveTerrainSemanticTilePacket(base, filtered);
    // ...then a road split under a bridge, on top of that.
    const first = base.transportation[0] as (typeof base.transportation)[number];
    const roads = {
      ...filtered,
      transportation: [
        { ...first, lines: [first.lines[0] as [number, number][]] },
        { ...first, lines: [first.lines[1] as [number, number][]] },
        base.transportation[1],
      ],
    } as typeof base;
    deriveTerrainSemanticTilePacket(filtered, roads);
    for (const tile of [filtered, roads]) {
      const packet = terrainSemanticTilePacket(tile);
      if (packet === undefined) throw new Error('derived tile has no packet');
      expect(packet.points).toBe(terrainSemanticTilePacket(base)?.points);
      expect(terrainSemanticTileFromPacket(structuredClone(packet))).toEqual(tile);
    }
    expect(terrainSemanticTilePacket(roads)?.edits).toHaveLength(2);
  });

  it('derives no packet when a new feature shares a part with a kept one, or more changed', () => {
    const line: [number, number][] = [
      [0.1, 0.1],
      [0.2, 0.2],
    ];
    const base = createEmptyTerrainSemanticTile();
    base.transportation.push({ class: 'primary', lines: [line] }, { class: 'path', lines: [] });
    rememberTerrainSemanticTilePacket(base, packTerrainSemanticTile(base));
    const sharing = {
      ...base,
      transportation: [base.transportation[0], { class: 'service', lines: [line] }],
    } as typeof base;
    deriveTerrainSemanticTilePacket(base, sharing);
    expect(terrainSemanticTilePacket(sharing)).toBeUndefined();
    const relit = { ...base, transportation: [base.transportation[0]], water: [] } as typeof base;
    deriveTerrainSemanticTilePacket(base, relit);
    expect(terrainSemanticTilePacket(relit)).toBeUndefined();
    const unpacked = createEmptyTerrainSemanticTile();
    const fromUnpacked = { ...unpacked, buildings: [] };
    deriveTerrainSemanticTilePacket(unpacked, fromUnpacked);
    expect(terrainSemanticTilePacket(fromUnpacked)).toBeUndefined();
  });

  it('carries an overzoomed tile as its ancestor packet, alone and composed', async () => {
    const ancestor = (landcover: boolean): TerrainSemanticTile => {
      const tile = createEmptyTerrainSemanticTile();
      if (landcover)
        tile.landcover.push({
          class: 'park',
          polygons: [
            {
              outer: [
                [0.1, 0.1],
                [0.9, 0.1],
                [0.9, 0.9],
                [0.1, 0.9],
              ],
            },
          ],
        });
      else {
        tile.transportation.push({
          class: 'primary',
          lines: [
            [
              [0, 0.3],
              [1, 0.35],
            ],
          ],
        });
        tile.buildings.push({
          id: 1,
          polygons: [
            {
              outer: [
                [0.6, 0.6],
                [0.7, 0.6],
                [0.7, 0.7],
              ],
            },
          ],
        });
      }
      rememberTerrainSemanticTilePacket(tile, packTerrainSemanticTile(tile));
      setTerrainSemanticTileContentHash(tile, landcover ? 'land' : 'features');
      return tile;
    };
    const features = createOverzoomTerrainSemanticSource({ load: async () => ancestor(false) }, 3);
    const land = createOverzoomTerrainSemanticSource({ load: async () => ancestor(true) }, 3);
    const signal = new AbortController().signal;
    const address = { level: 5, x: 18, z: 7 };
    const tile = (await features.load(address, signal)) as TerrainSemanticTile;
    const packet = terrainSemanticTilePacket(tile);
    expect(packet?.overzoom).toEqual({ from: { level: 3, x: 4, z: 1 }, to: address });
    if (packet === undefined) throw new Error('overzoomed tile has no packet');
    expect(terrainSemanticTileFromPacket(structuredClone(packet))).toEqual(tile);
    expect(terrainSemanticTileContentHash(tile)).toBe('features|overzoom:3/4/1>5/18/7:');
    const composed = composeTerrainSemanticTile(
      tile,
      (await land.load(address, signal)) as TerrainSemanticTile,
    );
    const both = terrainSemanticTilePacket(composed);
    if (both === undefined) throw new Error('composed overzoomed tile has no packet');
    expect(terrainSemanticTileFromPacket(structuredClone(both))).toEqual(composed);
  });

  it('has a packet only for a tile that arrived as one', () => {
    const tile = createEmptyTerrainSemanticTile();
    expect(terrainSemanticTilePacket(tile)).toBeUndefined();
  });
});
