import {
  createTerrainSemanticDecoderWorker,
  terrainSemanticTileContentHash,
  terrainSemanticTileFromPacket,
  terrainSemanticTilePacket,
} from '@bendyline/molen-terrain/client';
import {
  createEmptyTerrainSemanticTile,
  packTerrainSemanticTile,
  polygonArea,
  type TerrainSemanticPolygon,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { applyMapOverrides, mapOverrideTileKey } from '../src/kernel/map-override-tile';
import {
  createMapOverrideSet,
  type MapOverride,
  type ResolvedMapOverride,
  resolveMapOverride,
} from '../src/kernel/map-overrides';
import { projectWgs84 } from '../src/kernel/projection';
import type { TileGeometry } from '../src/kernel/semantic-adapter';
import { PROTOMAPS_TILE_BUFFER } from '../src/kernel/tile-edges';

// On the equator a frame meter is a projected meter, so the numbers below can be read off: an
// 800 m tile centered on the override, where a frame point [x, z] is [0.5 + x/800, 0.5 + z/800].
const CENTER: [number, number] = [10, 0];
const SIZE = 800;
const [CX] = projectWgs84(...CENTER);
const geometry = (extra: Partial<TileGeometry> = {}): TileGeometry => ({
  level: 15,
  x: 3,
  z: 4,
  originX: CX - SIZE / 2,
  originZ: -SIZE / 2,
  size: SIZE,
  metersPerUnit: 1,
  levelBelowMax: 0,
  ...extra,
});
/** The 80 m by 60 m rectangle u 0.45..0.55, v 0.4625..0.5375. */
const override = (extra: Partial<MapOverride> = {}): ResolvedMapOverride =>
  resolveMapOverride({ id: 'lot', area: { center: CENTER, size: [80, 60] }, ...extra });
const box = (u0: number, v0: number, u1: number, v1: number): TerrainSemanticPolygon => ({
  outer: [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ],
});
const area = (polygons: readonly TerrainSemanticPolygon[]): number =>
  polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
const tile = (extra: Partial<TerrainSemanticTile> = {}): TerrainSemanticTile => ({
  ...createEmptyTerrainSemanticTile(),
  ...extra,
});
/** `source` as a decoder worker hands it over: with a packet and a content hash. */
async function decoded(source: TerrainSemanticTile, hash = 'source'): Promise<TerrainSemanticTile> {
  const packet = packTerrainSemanticTile(source);
  let reply: (event: { data: unknown }) => void = () => {};
  const decoder = createTerrainSemanticDecoderWorker({
    addEventListener: (_type, listener) => {
      reply = listener;
    },
    postMessage: (message) =>
      reply({ data: { id: (message as { id: number }).id, ...structuredClone(packet), hash } }),
  });
  const result = await decoder.decode(new Uint8Array(), {
    address: { level: 15, x: 3, z: 4 },
    content: 'all',
    encoding: 'mvt',
    layers: ['building'],
  });
  decoder.dispose();
  return result;
}

describe('map overrides applied to a tile', () => {
  it('returns the tile itself when no override edits it', () => {
    const source = tile({ buildings: [{ id: 1, polygons: [box(0.1, 0.1, 0.2, 0.2)] }] });
    expect(applyMapOverrides(source, geometry(), [])).toBe(source);
    // Below the override's level.
    expect(applyMapOverrides(source, geometry({ level: 10 }), [override()])).toBe(source);
    // A tile far from it.
    expect(applyMapOverrides(source, geometry({ originX: CX + 5000 }), [override()])).toBe(source);
    // Reached, with nothing to clear and nothing placed.
    expect(
      applyMapOverrides(source, geometry(), [
        override({ clear: { vegetation: false, parking: false } }),
      ]),
    ).toBe(source);
  });

  it('removes a mapped building mostly inside the rectangle and keeps one mostly outside', () => {
    const source = tile({
      buildings: [
        { id: 'in', polygons: [box(0.52, 0.49, 0.57, 0.51)] }, // 60% inside
        { id: 'out', polygons: [box(0.53, 0.49, 0.58, 0.51)] }, // 40% inside
        { id: 'away', polygons: [box(0.1, 0.1, 0.2, 0.2)] },
      ],
    });
    const before = structuredClone(source);
    const result = applyMapOverrides(source, geometry(), [override()]);
    expect(result.buildings.map((feature) => feature.id)).toEqual(['out', 'away']);
    expect(result.buildings[0]).toBe(source.buildings[1]);
    expect(result.buildings[1]).toBe(source.buildings[2]);
    // The input is never changed, and what was not edited is the same object.
    expect(source).toEqual(before);
    expect(result.water).toBe(source.water);
    expect(result.transportation).toBe(source.transportation);
    // Buildings stay as mapped when the override keeps them.
    const kept = applyMapOverrides(source, geometry(), [override({ clear: { buildings: false } })]);
    expect(kept.buildings).toBe(source.buildings);
  });

  it('lets a building part go or stay with its outline', () => {
    const source = tile({
      buildings: [
        // An outline mostly outside, with a part of it wholly inside the rectangle.
        { id: 'kept', class: 'building', polygons: [box(0.53, 0.49, 0.58, 0.51)] },
        { id: 'kept-part', class: 'building_part', polygons: [box(0.535, 0.495, 0.545, 0.505)] },
        // An outline two thirds inside (u 0.44 to 0.47), with a part of it wholly outside.
        { id: 'gone', class: 'building', polygons: [box(0.44, 0.47, 0.47, 0.49)] },
        { id: 'gone-part', class: 'building_part', polygons: [box(0.441, 0.471, 0.449, 0.489)] },
        // A part with no outline decides for itself.
        { id: 'orphan', class: 'building_part', polygons: [box(0.5, 0.52, 0.51, 0.53)] },
      ],
    });
    const result = applyMapOverrides(source, geometry(), [override()]);
    expect(result.buildings.map((feature) => feature.id)).toEqual(['kept', 'kept-part']);
  });

  it('trims a footprint the tile does not hold whole, and every footprint when asked to clip', () => {
    const building = { id: 'b', polygons: [box(0.52, 0.49, 0.57, 0.51)] };
    const total = area(building.polygons);
    // Merged with its neighbors on a coarse tile: dropping it whole would take a block with it.
    const generalized = applyMapOverrides(
      tile({ buildings: [building], buildingsGeneralized: true }),
      geometry(),
      [override()],
    );
    expect(generalized.buildings).toHaveLength(1);
    expect(area(generalized.buildings[0]?.polygons ?? [])).toBeCloseTo(total * 0.4, 9);
    expect(generalized.buildings[0]?.id).toBe('b');
    // Cut at the tile's clip line: the neighbor holds another share of the same footprint.
    const edge = { id: 'e', polygons: [box(-PROTOMAPS_TILE_BUFFER, 0.49, 0.5, 0.51)] };
    const clipped = applyMapOverrides(tile({ buildings: [edge] }), geometry(), [override()]);
    expect(clipped.buildings).toHaveLength(1);
    expect(area(clipped.buildings[0]?.polygons ?? [])).toBeCloseTo(
      (0.45 + PROTOMAPS_TILE_BUFFER) * 0.02,
      9,
    );
    // 'clip' cuts at the rectangle whatever share is inside.
    const asked = applyMapOverrides(tile({ buildings: [building] }), geometry(), [
      override({ clear: { buildings: 'clip' } }),
    ]);
    expect(area(asked.buildings[0]?.polygons ?? [])).toBeCloseTo(total * 0.4, 9);
    // A footprint wholly inside leaves nothing.
    const inside = applyMapOverrides(
      tile({ buildings: [{ id: 'i', polygons: [box(0.48, 0.48, 0.52, 0.52)] }] }),
      geometry(),
      [override({ clear: { buildings: 'clip' } })],
    );
    expect(inside.buildings).toEqual([]);
  });

  it('takes the rectangle out of the land cover and covers it', () => {
    const forest = { id: 'forest', class: 'wood', polygons: [box(0, 0, 1, 1)] };
    const park = { id: 'park', class: 'park', polygons: [box(0.48, 0.48, 0.52, 0.52)] };
    const lawn = { id: 'lawn', class: 'grass', polygons: [box(0.1, 0.1, 0.2, 0.2)] };
    const reserve = { id: 'reserve', class: 'nature_reserve', polygons: [box(0, 0, 1, 1)] };
    const source = tile({ landcover: [forest, park, lawn, reserve] });
    const result = applyMapOverrides(source, geometry(), [override({ surface: 'plaza' })]);
    const rectangle = 0.1 * 0.075;
    const byId = new Map(result.landcover.map((feature) => [feature.id, feature]));
    // A small park inside is gone; the forest has a hole; what is elsewhere is the same object.
    expect(byId.has('park')).toBe(false);
    expect(area(byId.get('forest')?.polygons ?? [])).toBeCloseTo(1 - rectangle, 9);
    expect(byId.get('lawn')).toBe(lawn);
    // A protection boundary says nothing about the ground and stays whole.
    expect(byId.get('reserve')).toBe(reserve);
    const cover = result.landcover.at(-1);
    expect(cover).toMatchObject({
      id: 'override:lot:ground',
      class: 'cleared',
      subclass: 'pedestrian',
      density: 0,
    });
    expect(area(cover?.polygons ?? [])).toBeCloseTo(rectangle, 9);
    // Vegetation kept: only parking ground goes, and nothing covers the rectangle.
    const lot = {
      id: 'lot',
      class: 'landuse',
      subclass: 'parking',
      polygons: [box(0.4, 0.4, 0.6, 0.6)],
    };
    const keptPlants = applyMapOverrides(tile({ landcover: [forest, lot] }), geometry(), [
      override({ clear: { vegetation: false } }),
    ]);
    expect(keptPlants.landcover.map((feature) => feature.id)).toEqual(['forest', 'lot']);
    expect(keptPlants.landcover[0]).toBe(forest);
    expect(area(keptPlants.landcover[1]?.polygons ?? [])).toBeCloseTo(0.04 - rectangle, 9);
  });

  it('clips the cover to the tile like map data when the rectangle runs past its edge', () => {
    // A tile whose east edge runs through the middle of the rectangle: u 0.95 to 1.05.
    const west = geometry({ originX: CX - SIZE });
    const result = applyMapOverrides(tile(), west, [override()]);
    const us = (result.landcover.at(-1)?.polygons[0]?.outer ?? []).map((point) => point[0]);
    expect(Math.min(...us)).toBeCloseTo(0.95, 9);
    expect(Math.max(...us)).toBeCloseTo(1 + PROTOMAPS_TILE_BUFFER, 9);
  });

  it('clears mapped points by what they are', () => {
    const pois = [
      { id: 'tree', class: 'tree', point: [0.5, 0.5] as [number, number] },
      { id: 'bench', class: 'bench', point: [0.5, 0.5] as [number, number] },
      { id: 'cafe', class: 'cafe', point: [0.5, 0.5] as [number, number] },
      { id: 'stop', class: 'bus_stop', point: [0.5, 0.5] as [number, number] },
      { id: 'signal', class: 'traffic_signals', point: [0.56, 0.5] as [number, number] }, // 8 m outside
      { id: 'far-tree', class: 'tree', point: [0.7, 0.7] as [number, number] },
    ];
    const ids = (clear: MapOverride['clear']): unknown[] =>
      (applyMapOverrides(tile({ pois }), geometry(), [override({ clear })]).pois ?? []).map(
        (poi) => poi.id,
      );
    expect(ids({})).toEqual(['stop', 'signal', 'far-tree']);
    expect(ids({ vegetation: false })).toEqual(['tree', 'stop', 'signal', 'far-tree']);
    expect(ids({ props: false })).toEqual(['bench', 'stop', 'signal', 'far-tree']);
    expect(ids({ buildings: false })).toEqual(['cafe', 'stop', 'signal', 'far-tree']);
    // Controls go with the roads, a little beyond the rectangle.
    expect(ids({ roads: true })).toEqual(['far-tree']);
    const untouched = tile({ pois: [pois[5] as (typeof pois)[number]] });
    expect(
      applyMapOverrides(untouched, geometry(), [override({ clear: { vegetation: false } })]).pois,
    ).toBe(untouched.pois);
  });

  it('cuts parking access with the parking, and roads only when asked', () => {
    const across = (v: number): [number, number][] => [
      [0.3, v],
      [0.7, v],
    ];
    const source = tile({
      transportation: [
        { id: 'aisle', class: 'service', service: 'parking_aisle', lines: [across(0.5)] },
        { id: 'street', class: 'residential', lines: [across(0.5), across(0.9)] },
        { id: 'bridge', class: 'primary', bridge: true, lines: [across(0.5)] },
        { id: 'rail', class: 'rail', lines: [across(0.5)] },
        { id: 'runway', class: 'aeroway', subclass: 'runway', lines: [across(0.5)] },
        { id: 'elsewhere', class: 'residential', lines: [across(0.2)] },
      ],
    });
    const byId = (result: TerrainSemanticTile) =>
      new Map(result.transportation.map((feature) => [feature.id, feature]));
    const parking = byId(applyMapOverrides(source, geometry(), [override()]));
    expect(parking.get('aisle')?.lines).toEqual([
      [
        [0.3, 0.5],
        [0.45, 0.5],
      ],
      [
        [0.55, 0.5],
        [0.7, 0.5],
      ],
    ]);
    for (const id of ['street', 'bridge', 'rail', 'runway', 'elsewhere'])
      expect(parking.get(id), id).toBe(source.transportation.find((feature) => feature.id === id));
    const roads = byId(
      applyMapOverrides(source, geometry(), [override({ clear: { roads: true } })]),
    );
    expect(roads.get('street')?.lines).toHaveLength(3);
    // The line that does not cross the rectangle, and the points of the one that does, are the tile's own.
    expect(roads.get('street')?.lines[2]).toBe(source.transportation[1]?.lines[1]);
    expect(roads.get('street')?.lines[0]?.[0]).toBe(source.transportation[1]?.lines[0]?.[0]);
    expect(roads.get('street')?.lines[0]?.[1]?.[0]).toBeCloseTo(0.45, 12);
    for (const id of ['bridge', 'rail', 'runway', 'elsewhere'])
      expect(roads.get(id), id).toBe(source.transportation.find((feature) => feature.id === id));
    // A road wholly inside is gone.
    const inner = tile({
      transportation: [
        {
          id: 'lane',
          class: 'residential',
          lines: [
            [
              [0.47, 0.5],
              [0.53, 0.5],
            ],
          ],
        },
      ],
    });
    expect(
      applyMapOverrides(inner, geometry(), [override({ clear: { roads: true } })]).transportation,
    ).toEqual([]);
    const none = applyMapOverrides(source, geometry(), [override({ clear: { parking: false } })]);
    expect(none.transportation).toBe(source.transportation);
  });

  it('cuts a road along a turned rectangle, not its bounding box', () => {
    // A square turned 45 degrees: its corner reaches u 0.5 + 40*sqrt(2)/800 on the center line.
    const turned = override({
      area: { center: CENTER, size: [80, 80], heading: Math.PI / 4 },
      clear: { roads: true },
    });
    const reach = (40 * Math.SQRT2) / SIZE;
    const street = tile({
      transportation: [
        {
          id: 'street',
          class: 'residential',
          lines: [
            [
              [0.3, 0.5],
              [0.7, 0.5],
            ],
            // Through the bounding box's corner, clear of the rectangle itself.
            [
              [0.3, 0.5 - reach * 0.95],
              [0.7, 0.5 - reach * 0.95 + 1e-9],
            ],
          ],
        },
      ],
    });
    const result = applyMapOverrides(street, geometry(), [turned]);
    const lines = result.transportation[0]?.lines ?? [];
    expect(lines[0]?.[1]?.[0]).toBeCloseTo(0.5 - reach, 9);
    expect(lines[1]?.[0]?.[0]).toBeCloseTo(0.5 + reach, 9);
    // The second line crosses the turned square's corner region only slightly.
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('injects a host building whole into every tile it reaches, under one id', () => {
    // A shed straddling the tile's east edge: 30 m in this tile, 30 m in the next.
    const shed = override({
      area: { center: [CENTER[0], 0], size: [80, 60] },
      buildings: [
        {
          id: 'shed',
          rect: { center: [0, 0], size: [60, 20] },
          height: 9,
          use: 'warehouse',
          style: 'molen.worldgen.generic.warehouse',
          wall: '#b9b4a8',
          trim: '#75604a',
          name: 'Shed',
        },
      ],
    });
    const west = geometry({ originX: CX - SIZE });
    const east = geometry({ originX: CX });
    const far = geometry({ originX: CX + SIZE });
    const [inWest, inEast] = [west, east].map((geom) =>
      applyMapOverrides(tile(), geom, [shed]).buildings.find(
        (feature) => feature.id === 'override:lot:shed',
      ),
    );
    expect(inWest).toMatchObject({
      class: 'building',
      subclass: 'warehouse',
      height: 9,
      name: 'Shed',
      tags: {
        'molen:override': 'lot',
        'molen:style': 'molen.worldgen.generic.warehouse',
        'molen:wall': '#b9b4a8',
        'molen:trim': '#75604a',
      },
    });
    // The same footprint, unclipped, in each tile's own coordinates.
    expect(inWest?.polygons).toHaveLength(1);
    const uWest = (inWest?.polygons[0]?.outer ?? []).map((point) => point[0]);
    const uEast = (inEast?.polygons[0]?.outer ?? []).map((point) => point[0]);
    expect(Math.min(...uWest)).toBeCloseTo(1 - 30 / SIZE, 9);
    expect(Math.max(...uWest)).toBeCloseTo(1 + 30 / SIZE, 9);
    expect(Math.min(...uEast)).toBeCloseTo(-30 / SIZE, 9);
    expect(Math.max(...uEast)).toBeCloseTo(30 / SIZE, 9);
    // A tile neither the rectangle nor the building reaches is left alone.
    const untouched = tile();
    expect(applyMapOverrides(untouched, far, [shed])).toBe(untouched);
  });

  it('carries host props on the tiles that draw them', () => {
    const lot = override({
      props: [
        { id: 'lamp', kind: 'street_lamp', position: [0, 0], height: 6 },
        {
          id: 'oak',
          kind: 'tree',
          position: [10, 10],
          height: 12,
          crownDiameter: 8,
          leafType: 'broadleaved',
        },
        {
          id: 'crate',
          model: 'builtin:rock',
          position: [-10, 0],
          heading: 0.5,
          scale: [1, 2, 1],
          color: '#8899aa',
        },
      ],
    });
    const pois = applyMapOverrides(tile(), geometry(), [lot]).pois ?? [];
    expect(pois).toEqual([
      {
        id: 'override:lot:lamp',
        class: 'street_lamp',
        point: [0.5, 0.5],
        heading: 0,
        height: 6,
        tags: { 'molen:override': 'lot' },
      },
      {
        id: 'override:lot:oak',
        class: 'tree',
        point: [0.5125, 0.5125],
        heading: 0,
        height: 12,
        crownDiameter: 8,
        leafType: 'broadleaved',
        tags: { 'molen:override': 'lot' },
      },
      {
        id: 'override:lot:crate',
        class: 'molen_prop',
        point: [0.4875, 0.5],
        heading: -0.5,
        tags: {
          'molen:override': 'lot',
          'molen:model': 'builtin:rock',
          'molen:scale': '1,2,1',
          'molen:color': '#8899aa',
        },
      },
    ]);
    // One level above the finest still draws them; coarser tiles do not carry them.
    expect(
      applyMapOverrides(tile(), geometry({ level: 14, levelBelowMax: 1 }), [lot]).pois,
    ).toHaveLength(3);
    expect(
      applyMapOverrides(tile(), geometry({ level: 13, levelBelowMax: 2 }), [lot]).pois,
    ).toBeUndefined();
    // A tile the props' points do not reach gets none, though the rectangle's cover reaches it.
    const east = geometry({ originX: CX + 30 });
    expect(applyMapOverrides(tile(), east, [lot]).pois).toBeUndefined();
  });

  it('crosses to a worker as the base packet and an edit, under a hash that names the edit', async () => {
    const source = await decoded(
      tile({
        buildings: [
          { id: 'in', polygons: [box(0.48, 0.48, 0.52, 0.52)] },
          { id: 'away', polygons: [box(0.1, 0.1, 0.2, 0.2)] },
        ],
        landcover: [{ id: 'forest', class: 'wood', polygons: [box(0, 0, 1, 1)] }],
        transportation: [
          {
            id: 'aisle',
            class: 'service',
            service: 'parking_aisle',
            lines: [
              [
                [0.3, 0.5],
                [0.7, 0.5],
              ],
            ],
          },
        ],
        pois: [{ id: 'tree', class: 'tree', point: [0.5, 0.5] }],
      }),
    );
    expect(terrainSemanticTileContentHash(source)).toBe('source');
    const lot = (height: number): MapOverride => ({
      id: 'lot',
      area: { center: CENTER, size: [80, 60] },
      buildings: [{ id: 'shed', rect: { size: [48, 30] }, height }],
      props: [{ id: 'lamp', kind: 'street_lamp', position: [28, 18] }],
    });
    const set = createMapOverrideSet([lot(9)]);
    const edit = (): TerrainSemanticTile =>
      applyMapOverrides(source, geometry(), set.forTile(geometry()));
    const first = edit();
    const packet = terrainSemanticTilePacket(first);
    if (packet === undefined) throw new Error('edited tile has no packet');
    expect(packet.points).toBe(terrainSemanticTilePacket(source)?.points);
    expect(packet.edits).toHaveLength(1);
    expect(Object.keys(packet.edits?.[0] ?? {}).sort()).toEqual([
      'buildings',
      'landcover',
      'pois',
      'transportation',
    ]);
    expect(terrainSemanticTileFromPacket(structuredClone(packet))).toEqual(first);
    const hash = terrainSemanticTileContentHash(first);
    expect(hash).toBe(`source|${mapOverrideTileKey(geometry(), set.forTile(geometry()))}`);
    // A changed override is a different edit; the same override again is the same one.
    set.set(lot(12));
    expect(terrainSemanticTileContentHash(edit())).not.toBe(hash);
    set.set(lot(9));
    expect(terrainSemanticTileContentHash(edit())).toBe(hash);
    expect(edit()).toEqual(first);
  });
});
