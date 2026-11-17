import { readFile } from 'node:fs/promises';
import {
  createEmptyTerrainSemanticTile,
  type TerrainBuildingFeature,
  type TerrainSemanticPoint,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import { FLAT_GROUND, generateBuilding, MeshBufferBuilder } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { buildingPieces } from '../src/kernel/building-parts';
import { useOwnsExterior } from '../src/kernel/building-use';
import { associatePartyWalls, isAttached } from '../src/kernel/party-walls';
import { createPlacesContent } from '../src/kernel/places';
import { createRegionalLibrary } from '../src/kernel/regional-content';
import { regionalCatalogSchema } from '../src/kernel/regional-content-schema';
import { createRegionalEnvironment } from '../src/kernel/regional-environment';
import { ATTACHED_LABEL, semanticTileToBatch } from '../src/kernel/semantic-adapter';
import { worshipCrowns } from '../src/kernel/worship';
import { loadDefaultAtlas, loadDefaultPack, loadDefaultPlacesDocs } from './helpers/pack';

const pack = await loadDefaultPack();
const atlas = await loadDefaultAtlas();
const places = createPlacesContent(await loadDefaultPlacesDocs());
const catalog = regionalCatalogSchema.parse(
  JSON.parse(
    await readFile(
      new URL('../../../content/worldgen/regional.catalog.json', import.meta.url),
      'utf8',
    ),
  ),
);
createRegionalLibrary([catalog], pack);

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
const building = (
  id: number,
  ring: TerrainSemanticPoint[],
  extra: Partial<TerrainBuildingFeature> = {},
): TerrainBuildingFeature => ({ id, class: 'building', polygons: [{ outer: ring }], ...extra });

/** A row of five 6 m fronts sharing their side walls, and a house standing clear of it. */
function street(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.buildings = [
    ...[0, 1, 2, 3, 4].map((i) => building(i + 1, rect(100 + i * 6, 100, 6, 12))),
    building(9, rect(200, 100, 10, 9)),
  ];
  return tile;
}

function adapt(tile: TerrainSemanticTile, regionId: string, withPlaces = false) {
  const region = atlas.regions.find((r) => r.id === regionId);
  if (!region) throw new Error(`Missing ${regionId}`);
  const regions = { atlas, resolve: () => region, intersecting: () => [region] };
  const environment = createRegionalEnvironment({ catalogs: [catalog] }, 1, regions);
  return semanticTileToBatch(tile, geom, {
    pack,
    environment,
    regions,
    ...(withPlaces ? { places } : {}),
  }).buildings;
}

describe('party walls', () => {
  it('finds the walls a row shares and leaves a free-standing house alone', () => {
    const pieces = buildingPieces(street().buildings);
    const walls = associatePartyWalls(pieces, SIZE);
    const of = (id: number) => walls.get(pieces.find((p) => p.feature.id === id) as never);
    // Edge 1 runs up the east side and edge 3 down the west.
    expect(of(1)?.edges).toEqual([1]);
    expect(of(3)?.edges).toEqual([1, 3]);
    expect(of(5)?.edges).toEqual([3]);
    expect(of(3)?.length).toBeCloseTo(24, 6);
    expect(of(3)?.perimeter).toBeCloseTo(36, 6);
    expect(of(9)).toBeUndefined();
    expect(isAttached(of(1))).toBe(true);
    expect(isAttached(of(9))).toBe(false);
    // A step in a party wall shorter than a door is not a wall of its own.
    expect(isAttached({ edges: [0], length: 2, perimeter: 40 })).toBe(false);
  });

  it('reaches across a mapping gap but not an alley, and ignores a tower on its podium', () => {
    const gap = (meters: number) => {
      const pieces = buildingPieces([
        building(1, rect(0, 0, 8, 10)),
        building(2, rect(8 + meters, 0, 8, 10)),
      ]);
      return associatePartyWalls(pieces, SIZE).size;
    };
    expect(gap(0.3)).toBe(2);
    expect(gap(1.5)).toBe(0);
    const stacked = buildingPieces([
      building(1, rect(0, 0, 30, 30)),
      building(2, rect(0, 0, 12, 12), { class: 'building_part', minHeight: 12, height: 60 }),
    ]);
    expect(associatePartyWalls(stacked, SIZE).size).toBe(0);
  });

  it('labels a row, blinds its shared walls and gives it the region row house', () => {
    const batch = adapt(street(), 'library.britain');
    const row = batch.filter((b) => b.labels.includes(ATTACHED_LABEL));
    expect(row).toHaveLength(5);
    expect(row.every((b) => /\.regional\.atlantic\.attached/.test(b.style ?? ''))).toBe(true);
    expect(row.map((b) => b.partyEdges?.length)).toEqual([1, 2, 2, 2, 1]);
    const free = batch.find((b) => !b.labels.includes(ATTACHED_LABEL));
    expect(free?.partyEdges).toBeUndefined();
    expect(free?.style).toMatch(/\.regional\.atlantic\.detached/);
  });
});

describe('a building is its region’s before it is anything else', () => {
  it.each([
    ['library.maghreb', 'arid', 'flat'],
    ['library.greece', 'mediterranean', 'pitched'],
    ['gr.aegean', 'aegean', 'flat'],
    ['library.south_asia', 'south_asian', 'flat'],
    ['library.britain', 'atlantic', 'pitched'],
    ['library.brazil', 'brazilian', 'pitched'],
  ] as const)('untyped footprints on unlabelled land in %s are %s', (regionId, family, roof) => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = Array.from({ length: 40 }, (_, i) =>
      building(i + 1, rect(20 + (i % 8) * 40, 20 + Math.floor(i / 8) * 40, 9 + (i % 4), 8)),
    );
    const batch = adapt(tile, regionId);
    expect(batch).toHaveLength(40);
    expect(batch.every((b) => b.style?.includes(`.regional.${family}.detached`))).toBe(true);
    const styles = [...new Set(batch.map((b) => b.style as string))].map(
      (id) => pack.archstyles[id],
    );
    const flatWeight = (id: (typeof styles)[number]) => {
      const low = id?.roof.choices.filter((c) => (c.when?.levelsMin ?? 0) <= 1) ?? [];
      const total = low.reduce((n, c) => n + c.weight, 0);
      return low.filter((c) => c.type === 'flat').reduce((n, c) => n + c.weight, 0) / total;
    };
    for (const id of styles)
      if (roof === 'flat') expect(flatWeight(id)).toBe(1);
      else expect(flatWeight(id)).toBeLessThan(0.3);
  });

  it('keeps a shop in a row in its building and gives a free-standing chain its store', () => {
    const tile = street();
    tile.landcover = [
      { class: 'residential', polygons: [{ outer: rect(0, 0, SIZE, SIZE) }] },
      { class: 'retail', polygons: [{ outer: rect(300, 80, 80, 60) }] },
    ];
    tile.buildings.push(building(20, rect(320, 100, 30, 20)));
    tile.pois = [
      { id: 500, class: 'restaurant', name: 'Taverna', point: [109 / SIZE, 106 / SIZE] },
      { id: 501, class: 'supermarket', name: 'Safeway', point: [335 / SIZE, 110 / SIZE] },
    ];
    const batch = adapt(tile, 'library.greece', true);
    const taverna = batch.find((b) => b.storefronts?.some((s) => s.identity === 'poi:500'));
    expect(taverna?.style).toMatch(/\.regional\.mediterranean\.attached/);
    expect(taverna?.storefronts).toHaveLength(1);
    expect(taverna?.appearance).toBeUndefined();
    const market = batch.find((b) => b.storefronts?.some((s) => s.identity === 'poi:501'));
    expect(market?.style).toBe('molen.worldgen.generic.store');
  });

  it('leaves a guest house in a town house and lets a hotel block be a hotel', () => {
    const lodging = { use: 'hotel', source: 'occupant' } as const;
    expect(useOwnsExterior(lodging, { area: 220 })).toBe(false);
    expect(useOwnsExterior(lodging, { area: 220, height: 24 })).toBe(true);
    expect(useOwnsExterior(lodging, { area: 900 })).toBe(true);
    expect(useOwnsExterior({ use: 'museum', source: 'identity' }, { area: 260 })).toBe(false);
    expect(useOwnsExterior({ use: 'school', source: 'land' }, { area: 320 })).toBe(true);
    expect(useOwnsExterior({ use: 'place_of_worship', source: 'identity' }, { area: 30 })).toBe(
      true,
    );
    // One of a row with no height mapped, or one occupant of a block of shops: the hotel moved
    // into a building of the town, however large the outline.
    expect(useOwnsExterior(lodging, { area: 1400, attached: true })).toBe(false);
    expect(useOwnsExterior(lodging, { area: 1400, attached: true, height: 24 })).toBe(true);
    expect(useOwnsExterior({ ...lodging, shared: true }, { area: 1400 })).toBe(false);
    expect(useOwnsExterior({ use: 'mall', source: 'occupant', shared: true }, { area: 9000 })).toBe(
      true,
    );
  });

  it('guesses no taller than the town where the map gives no height', () => {
    const hotelAt = (regionId: string, extra: Partial<TerrainBuildingFeature> = {}) => {
      const tile = createEmptyTerrainSemanticTile();
      tile.buildings = [building(1, rect(100, 100, 40, 30), extra)];
      tile.pois = [{ id: 7, class: 'hotel', name: 'Grand', point: [120 / SIZE, 115 / SIZE] }];
      const batch = adapt(tile, regionId);
      const built = batch[0];
      if (!built) throw new Error('no building');
      const style = pack.archstyles[built.style as string];
      if (!style) throw new Error(`no style ${built.style}`);
      const builder = new MeshBufferBuilder();
      const result = generateBuilding(
        {
          request: built,
          style,
          pack: { name: 'test', version: '1' },
          ground: FLAT_GROUND,
          tier: 0,
        },
        builder,
      );
      return { request: built, floors: result.recipe?.floors ?? 0 };
    };
    // The hotel style alone would guess five to twelve storeys anywhere in the world.
    const cyclades = hotelAt('gr.aegean');
    expect(cyclades.request.style).toBe('molen.worldgen.use.hotel');
    expect(cyclades.request.fallbackLevelsMax).toBe(3);
    expect(cyclades.floors).toBe(3);
    const naples = hotelAt('library.italy');
    expect(naples.request.fallbackLevelsMax).toBe(5);
    expect(naples.floors).toBe(5);
    // A mapped height or level count is the building's own, and no ceiling is put on it.
    const measured = hotelAt('gr.aegean', { height: 31 });
    expect(measured.request.fallbackLevelsMax).toBeUndefined();
    expect(measured.floors).toBeGreaterThanOrEqual(8);
    expect(hotelAt('gr.aegean', { levels: 9 }).floors).toBe(9);
  });

  it('draws a mapped tower as a shaft with tiers of openings', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = [
      building(1, rect(100, 100, 4.6, 4.6), { height: 102 }),
      building(2, rect(200, 100, 20, 20), { height: 36 }),
      building(3, rect(300, 100, 5, 8), { height: 30 }),
      building(4, rect(400, 100, 4.6, 4.6), { height: 102, levels: 30 }),
      // A slender part of a larger tower is that tower's, and keeps its storeys.
      building(5, rect(40, 300, 30, 30), { height: 120 }),
      building(6, rect(40, 300, 6, 6), { height: 120, class: 'building_part' }),
    ];
    const batch = adapt(tile, 'it.central');
    expect(batch.filter((b) => b.height === 120).every((b) => b.levels === undefined)).toBe(true);
    const [tower, block, pencil, surveyed] = batch;
    // The wall still reaches the mapped height; only the count of window rows changes.
    expect(tower?.height).toBe(102);
    expect(tower?.levels).toBe(9);
    expect(block?.levels).toBeUndefined();
    expect(pencil?.levels).toBeUndefined();
    // A level count the map gives is the building's own.
    expect(surveyed?.levels).toBe(30);
  });
});

describe('places of worship', () => {
  it('crowns each tradition as its region builds it', () => {
    expect(worshipCrowns('christian', 'library.greece', 300)).toEqual(['dome']);
    expect(worshipCrowns('christian', 'library.greece', 40)).toEqual(['dome']);
    expect(worshipCrowns('christian', 'library.britain', 400)).toEqual(['spire']);
    expect(worshipCrowns('christian', 'library.britain', 60)).toEqual([]);
    expect(worshipCrowns('christian', 'library.italy', 400)).toEqual(['belfry']);
    expect(worshipCrowns('muslim', 'library.maghreb', 600)).toEqual(['dome', 'minaret']);
    expect(worshipCrowns('muslim', 'library.south_asia', 60)).toEqual(['minaret']);
    expect(worshipCrowns('hindu', 'library.south_asia', 200)).toEqual(['shikhara']);
    expect(worshipCrowns('buddhist', 'jp', 500)).toEqual([]);
    expect(worshipCrowns(undefined, 'library.britain', 500)).toEqual([]);
  });

  it('reads a chapel’s religion off its POI and builds it in the region’s own materials', () => {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = [building(1, rect(100, 100, 6, 9)), building(2, rect(200, 100, 26, 14))];
    tile.pois = [
      {
        id: 1,
        class: 'place_of_worship',
        subclass: 'christian',
        name: 'Agios Nikolaos',
        point: [103 / SIZE, 104 / SIZE],
      },
      {
        id: 77,
        class: 'place_of_worship',
        subclass: 'muslim',
        point: [212 / SIZE, 106 / SIZE],
      },
    ];
    const batch = adapt(tile, 'library.greece');
    const chapel = batch.find((b) => b.identity.includes('1'));
    expect(chapel?.labels[0]).toBe('place_of_worship');
    expect(chapel?.style).toMatch(/\.regional\.mediterranean\.worship/);
    expect(chapel?.crown).toEqual(['dome']);
    const mosque = batch.find((b) => b.crown?.includes('minaret'));
    expect(mosque?.style).toMatch(/\.regional\.mediterranean\.worship/);
    expect(mosque?.crown).toEqual(['dome', 'minaret']);
  });
});

describe('invented streets follow the region', () => {
  /** A grid of unmapped residential streets, 100 m apart. */
  const grid = (): TerrainSemanticTile => {
    const tile = createEmptyTerrainSemanticTile();
    for (const n of [0.1, 0.3, 0.5, 0.7, 0.9])
      tile.transportation.push({
        class: 'minor_road',
        subclass: 'residential',
        lines: [
          [
            [0, n],
            [1, n],
          ],
          [
            [n, 0],
            [n, 1],
          ],
        ],
      });
    return tile;
  };
  const flat = {
    sampleHeight: () => 12,
    slopeAt: () => 0,
    normalAt: (): [number, number, number] => [0, 1, 0],
  };
  const invent = (regionId: string) => {
    const region = atlas.regions.find((r) => r.id === regionId);
    if (!region) throw new Error(`Missing ${regionId}`);
    const regions = { atlas, resolve: () => region, intersecting: () => [region] };
    const environment = createRegionalEnvironment({ catalogs: [catalog] }, 1, regions);
    return semanticTileToBatch(
      grid(),
      geom,
      { pack, environment, regions, buildingInfill: { seed: 719 } },
      flat,
    ).buildings.filter((b) => b.labels.includes('inferred'));
  };
  const span = (a: readonly number[], b: readonly number[]): number =>
    Math.hypot((a[0] as number) - (b[0] as number), (a[1] as number) - (b[1] as number));

  it('lays a Maghreb street out as rows of flat-roofed fronts at the street', () => {
    const town = invent('library.maghreb');
    const rows = town.filter((b) => /\.regional\.arid\.attached/.test(b.style ?? ''));
    // Most blocks are rows, each with two fronts where a suburb has one house.
    expect(rows.length / town.length).toBeGreaterThan(0.7);
    // (A suburb's count includes its garages.)
    expect(town.length).toBeGreaterThan(invent('us.pnw').length * 1.1);
    for (const house of rows) {
      expect(house.outline).toHaveLength(4);
      // The door is in the front wall, and the blind walls are the two that run back from it.
      const to = house.access?.to as [number, number];
      const front = house.outline.findIndex((a, i) => {
        const b = house.outline[(i + 1) % 4] as [number, number];
        return Math.abs(span(a, to) + span(to, b) - span(a, b)) < 1e-6;
      });
      expect(front).toBeGreaterThanOrEqual(0);
      const sides = [(front + 1) % 4, (front + 3) % 4].sort((a, b) => a - b);
      expect([...(house.partyEdges ?? [])].sort((a, b) => a - b)).toEqual(sides);
      // Close to the street: a footway and a doorstep, not a front yard.
      const from = house.access?.from as [number, number];
      expect(span(from, to)).toBeLessThan(3);
    }
  });

  it('keeps a Pacific Northwest street as houses standing in their yards', () => {
    const suburb = invent('us.pnw');
    expect(suburb.length).toBeGreaterThan(30);
    expect(suburb.some((b) => /\.attached/.test(b.style ?? ''))).toBe(false);
    expect(suburb.every((b) => /\.regional\.north_american\./.test(b.style ?? ''))).toBe(true);
    const homes = suburb.filter((b) => b.yard !== undefined || b.access !== undefined);
    const deep = homes.filter((b) => {
      const access = b.access;
      return access !== undefined && span(access.from, access.to) > 2.5;
    });
    expect(deep.length / homes.length).toBeGreaterThan(0.9);
  });

  it.each([
    ['library.britain', 'atlantic'],
    ['library.mainland_southeast_asia', 'southeast_asian'],
    ['library.mexico', 'latin'],
    ['it.central', 'tuscan'],
  ] as const)('builds rows in %s from the %s row house', (regionId, family) => {
    const town = invent(regionId);
    const rows = town.filter((b) => b.style?.includes(`.regional.${family}.attached`));
    expect(rows.length).toBeGreaterThan(town.length * 0.3);
    expect(town.every((b) => b.style?.includes(`.regional.${family}.`))).toBe(true);
  });
});

describe('the countryside', () => {
  it('builds a large footprint in fields as a barn and leaves the farmhouse a house', () => {
    const farm = (landuse?: string) => {
      const tile = createEmptyTerrainSemanticTile();
      tile.buildings = [building(1, rect(100, 100, 30, 18)), building(2, rect(150, 100, 12, 9))];
      if (landuse)
        tile.landcover = [{ class: landuse, polygons: [{ outer: rect(40, 40, 300, 200) }] }];
      return adapt(tile, 'library.north_america');
    };
    const [barn, house] = farm('farmland');
    expect(barn?.style).toMatch(/[.]regional[.]north_american[.]farm$/);
    expect(house?.style).toMatch(/[.]regional[.]north_american[.]detached/);
    // The same footprints with no fields mapped round them are a town's: a house and a house.
    for (const built of farm()) expect(built.style).toMatch(/[.]north_american[.]detached/);
    // In an orchard too; on a lawn a large building is not a barn.
    expect(farm('orchard')[0]?.style).toMatch(/[.]farm$/);
    expect(farm('grass')[0]?.style).not.toMatch(/[.]farm$/);
  });
});
