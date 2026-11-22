import { describe, expect, it } from 'vitest';
import type { TerrainPyramidTileAddress } from '../src/pyramid-types';
import type { TerrainSemanticTileLoader } from '../src/semantic-overzoom';
import { createRoadDetailTerrainSemanticSource } from '../src/semantic-road-detail';
import {
  setTerrainSemanticTileContentHash,
  type TerrainSemanticTile,
  type TerrainTransportationFeature,
  terrainSemanticTileContentHash,
} from '../src/semantic-types';

const road = (name: string, u: number): TerrainTransportationFeature => ({
  class: 'minor_road',
  subclass: 'residential',
  name,
  lines: [
    [
      [u, 0],
      [u, 1],
    ],
  ],
});

const tileWith = (transportation: TerrainTransportationFeature[], hash?: string) => {
  const tile: TerrainSemanticTile = {
    format: 'molen/terrain-semantics@1',
    landcover: [],
    water: [
      {
        class: 'water',
        polygons: [
          {
            outer: [
              [0, 0],
              [0.1, 0],
              [0.1, 0.1],
            ],
          },
        ],
      },
    ],
    transportation,
    buildings: [],
  };
  if (hash !== undefined) setTerrainSemanticTileContentHash(tile, hash);
  return tile;
};

/** Feature tiles: one object per address (as a cached source returns), main roads only. */
function featureSource(): TerrainSemanticTileLoader & { loads: string[] } {
  const tiles = new Map<string, TerrainSemanticTile>();
  const loads: string[] = [];
  return {
    loads,
    async load(address: TerrainPyramidTileAddress) {
      const key = `${address.level}/${address.x}/${address.z}`;
      loads.push(key);
      let tile = tiles.get(key);
      if (tile === undefined) {
        tile = tileWith([{ ...road('Main Road', 0.5), class: 'major_road' }], `base-${key}`);
        tiles.set(key, tile);
      }
      return tile;
    },
  };
}

/** Detail tiles at level 15: (0, 0) has two side streets, (1, 0) has only buildings, (2, 0) fails. */
function detailSource(): TerrainSemanticTileLoader & { loads: string[] } {
  const loads: string[] = [];
  const side = tileWith(
    [road('Carrer Major', 0.25), road('Carrer de Jovellanos', 0.75)],
    'z15-0-0',
  );
  const bare = tileWith([]);
  return {
    loads,
    async load(address: TerrainPyramidTileAddress) {
      loads.push(`${address.level}/${address.x}/${address.z}`);
      if (address.x === 2) throw new Error('network');
      return address.x === 0 ? side : address.x === 1 ? bare : undefined;
    },
  };
}

const signal = new AbortController().signal;

describe('createRoadDetailTerrainSemanticSource', () => {
  it('gives tiles at the detail level its roads and keeps the rest of the feature tile', async () => {
    const base = featureSource();
    const source = createRoadDetailTerrainSemanticSource(base, detailSource(), {
      level: 15,
      tileSize: 1000,
    });
    const tile = await source.load({ level: 15, x: 0, z: 0 }, signal);
    expect(tile?.transportation.map((r) => r.name)).toEqual([
      'Carrer Major',
      'Carrer de Jovellanos',
    ]);
    expect(tile?.water).toHaveLength(1);
    // The same object every time (readers cache by it), with a content hash from both parts.
    expect(await source.load({ level: 15, x: 0, z: 0 }, signal)).toBe(tile);
    expect(terrainSemanticTileContentHash(tile as TerrainSemanticTile)).toBe(
      'base-15/0/0|roads>15/0/0=z15-0-0',
    );
  });

  it('leaves coarser tiles alone and cuts the detail roads to a finer tile', async () => {
    const base = featureSource();
    const detail = detailSource();
    const source = createRoadDetailTerrainSemanticSource(base, detail, {
      level: 15,
      tileSize: 1000,
    });
    const coarse = await source.load({ level: 14, x: 0, z: 0 }, signal);
    expect(coarse?.transportation.map((r) => r.name)).toEqual(['Main Road']);
    expect(detail.loads).toEqual([]);
    // Level 16, the western half of detail tile (0, 0): only Carrer Major (u = 0.25 → 0.5) is in it.
    const fine = await source.load({ level: 16, x: 0, z: 1 }, signal);
    expect(fine?.transportation.map((r) => r.name)).toEqual(['Carrer Major']);
    expect(fine?.transportation[0]?.lines[0]?.[0]?.[0]).toBeCloseTo(0.5, 9);
  });

  it('keeps the feature tile’s roads where the detail tile is missing, has no roads, or fails', async () => {
    const base = featureSource();
    const detail = detailSource();
    const source = createRoadDetailTerrainSemanticSource(base, detail, {
      level: 15,
      tileSize: 1000,
    });
    for (const x of [1, 2, 3]) {
      const tile = await source.load({ level: 15, x, z: 0 }, signal);
      expect(tile?.transportation.map((r) => r.name)).toEqual(['Main Road']);
    }
    // A failed detail tile is asked for again; a loaded one is not.
    await source.load({ level: 15, x: 2, z: 0 }, signal);
    await source.load({ level: 15, x: 1, z: 0 }, signal);
    expect(detail.loads.filter((key) => key === '15/2/0')).toHaveLength(2);
    expect(detail.loads.filter((key) => key === '15/1/0')).toHaveLength(1);
  });
});
