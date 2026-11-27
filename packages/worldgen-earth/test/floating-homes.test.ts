import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import {
  type BuildingRequest,
  generateBuilding,
  type HeightSampler,
  MeshBufferBuilder,
} from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { buildingPieces } from '../src/kernel/building-parts';
import {
  associateFloatingHomes,
  FLOATING_HOME_LABEL,
  FLOATING_HOME_STYLE,
} from '../src/kernel/floating-homes';
import { semanticTileToBatch } from '../src/kernel/semantic-adapter';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();

const SIZE = 500;
const geom = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: SIZE,
  metersPerUnit: 1,
  levelBelowMax: 0,
};
/** A rectangle in meters as a tile-unit ring. */
const rect = (x: number, z: number, w: number, d: number): TerrainSemanticPoint[] =>
  (
    [
      [x, z],
      [x + w, z],
      [x + w, z + d],
      [x, z + d],
    ] as const
  ).map(([px, pz]): TerrainSemanticPoint => [px / SIZE, pz / SIZE]);
const building = (id: number, ring: TerrainSemanticPoint[]): TerrainBuildingFeature => ({
  id,
  class: 'building',
  polygons: [{ outer: ring }],
});
/** Level ground: a hydroflattened lake reads as one height across its surface. */
const level = (height: number): HeightSampler => ({
  sampleHeight: () => height,
  slopeAt: () => 0,
  normalAt: () => [0, 1, 0],
});

/**
 * A lake from 100 to 400 m with a row of four houseboats along a dock, a lone boathouse, three
 * sheds on a pier, a covered moorage the size of a warehouse, and a house on the shore.
 */
function lakeTile(waterClass = 'water'): TerrainSemanticTile {
  return {
    ...createEmptyTerrainSemanticTile(),
    water: [{ id: 'lake', class: waterClass, polygons: [{ outer: rect(100, 100, 300, 300) }] }],
    landcover: [{ id: 'pier', class: 'pier', polygons: [{ outer: rect(140, 300, 80, 12) }] }],
    buildings: [
      building(1, rect(150, 200, 8, 12)),
      building(2, rect(164, 200, 8, 12)),
      building(3, rect(178, 200, 8, 12)),
      building(4, rect(192, 200, 8, 12)),
      building(5, rect(330, 360, 7, 9)),
      building(6, rect(150, 301, 8, 10)),
      building(7, rect(165, 301, 8, 10)),
      building(8, rect(180, 301, 8, 10)),
      building(9, rect(210, 190, 30, 30)),
      building(10, rect(20, 20, 10, 12)),
    ],
  };
}

const floatingIds = (tile: TerrainSemanticTile, ground: HeightSampler): number[] =>
  [...associateFloatingHomes(tile, buildingPieces(tile.buildings), SIZE, ground).keys()]
    .map((piece) => piece.feature.id as number)
    .sort((a, b) => a - b);

describe('floating homes', () => {
  it('floats the row of houses moored on open water, nothing on a pier, alone or too large', () => {
    expect(floatingIds(lakeTile(), level(4))).toEqual([1, 2, 3, 4]);
  });

  it('rides at the surface the terrain draws: the lake samples plus its offset, or the sea', () => {
    const tile = lakeTile();
    const lake = associateFloatingHomes(tile, buildingPieces(tile.buildings), SIZE, level(4));
    expect([...lake.values()].map((home) => home.waterline)).toEqual([4.65, 4.65, 4.65, 4.65]);
    const sea = associateFloatingHomes(tile, buildingPieces(tile.buildings), SIZE, level(0.4), {
      seaLevel: 0,
    });
    expect([...sea.values()][0]?.waterline).toBeCloseTo(2.15, 6);
  });

  it('never floats a house in a swimming pool, or without ground to read the water from', () => {
    expect(floatingIds(lakeTile('swimming_pool'), level(4))).toEqual([]);
    const tile = lakeTile();
    expect(associateFloatingHomes(tile, buildingPieces(tile.buildings), SIZE, undefined).size).toBe(
      0,
    );
    expect(
      associateFloatingHomes(
        { ...tile, buildingsGeneralized: true },
        buildingPieces(tile.buildings),
        SIZE,
        level(4),
      ).size,
    ).toBe(0);
  });

  it('asks for the houseboat style and the waterline in the batch, and leaves the rest alone', () => {
    const batch = semanticTileToBatch(lakeTile(), geom, { pack }, level(4));
    const floating = batch.buildings.filter((b) => b.labels[0] === FLOATING_HOME_LABEL);
    expect(floating).toHaveLength(4);
    for (const request of floating) {
      expect(request.style).toBe(FLOATING_HOME_STYLE);
      expect(request.waterline).toBe(4.65);
    }
    const grounded = batch.buildings.filter((b) => b.labels[0] !== FLOATING_HOME_LABEL);
    expect(grounded).toHaveLength(6);
    for (const request of grounded) {
      expect(request.waterline).toBeUndefined();
      expect(request.style).not.toBe(FLOATING_HOME_STYLE);
    }
  });

  it('stands a floating home on a float at its waterline, whatever the ground under it', () => {
    const style = pack.archstyles[FLOATING_HOME_STYLE];
    if (style === undefined) throw new Error('no floating home style');
    const request: BuildingRequest = {
      identity: 'f:houseboat',
      labels: [FLOATING_HOME_LABEL, 'building'],
      outline: [
        [0, 0],
        [8, 0],
        [8, 12],
        [0, 12],
      ],
      waterline: 4.65,
      style: FLOATING_HOME_STYLE,
    };
    const builder = new MeshBufferBuilder();
    // The lake bed, far below: a grounded house would stand on it.
    const result = generateBuilding(
      { request, style, pack: { name: 'test', version: '1' }, ground: level(-6), tier: 0 },
      builder,
    );
    const base = result.record?.base ?? Number.NaN;
    expect(base).toBeGreaterThanOrEqual(4.65 + 0.35);
    expect(base).toBeLessThanOrEqual(4.65 + 0.6);
    const mesh = builder.finalize();
    let low = Number.POSITIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const y = mesh.positions[i + 1] as number;
      low = Math.min(low, y);
      if (y < 4.65) {
        minX = Math.min(minX, mesh.positions[i] as number);
        maxX = Math.max(maxX, mesh.positions[i] as number);
      }
    }
    // The float's hull reaches under the water, wider than the walls on both sides.
    expect(low).toBeCloseTo(4.65 - 0.8, 4);
    expect(minX).toBeLessThan(-0.3);
    expect(maxX).toBeGreaterThan(8.3);
    expect(mesh.groups.some((group) => group.slot === 'foundation')).toBe(true);
  });
});
