import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TerrainPoiFeature, TerrainSemanticTile } from '@bendyline/molen-terrain/kernel';
import {
  FLAT_GROUND,
  generateInteriorGeometry,
  generateInteriorPlan,
  generateWorldgenBatch,
  type InteriorSite,
  type ResolvedStylePack,
} from '@bendyline/molen-worldgen/kernel';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildingPieces } from '../src/kernel/building-parts';
import { associateParkingStructures, parkingLevels } from '../src/kernel/parking-structures';
import { semanticTileToBatch, type TileGeometry } from '../src/kernel/semantic-adapter';
import { loadDefaultPack } from './helpers/pack';

const here = dirname(fileURLToPath(import.meta.url));
const SOUTHEAST = 35184406129138,
  WEST = 35184402847707,
  NORTHEAST = 35184534018354,
  MALL = 35184401323719;

interface Fixture {
  size: number;
  tile: TerrainSemanticTile;
}
let fixture: Fixture;
let pack: ResolvedStylePack;
beforeAll(async () => {
  fixture = JSON.parse(
    await readFile(resolve(here, 'fixtures/bellevue-square-parking.semantic.json'), 'utf8'),
  ) as Fixture;
  pack = await loadDefaultPack();
});
function geometry(): TileGeometry {
  return {
    level: 15,
    x: 5260,
    z: 11442,
    originX: 0,
    originZ: 0,
    size: fixture.size,
    metersPerUnit: 1,
    levelBelowMax: 0,
  };
}
const sites = (): InteriorSite[] => {
  const batch = semanticTileToBatch(fixture.tile, geometry(), { pack }, FLAT_GROUND);
  const output = generateWorldgenBatch({
    ...batch,
    ground: FLAT_GROUND,
    interiors: true,
  });
  return output.records.flatMap((record) => (record.interior ? [record.interior] : []));
};
const garages = (): InteriorSite[] => sites().filter((site) => site.parking !== undefined);
const site = (id: number): InteriorSite => {
  const found = garages().find((candidate) => candidate.identity.includes(String(id)));
  if (!found) throw new Error(`no garage ${id}`);
  return found;
};

describe('parking structure detection', () => {
  it('finds the footprints a parking POI shares a source id with, and nothing else', () => {
    const found = associateParkingStructures(
      fixture.tile,
      buildingPieces(fixture.tile.buildings),
      fixture.size,
    );
    const levels = new Map([...found].map(([piece, s]) => [piece.feature.id, s.levels]));
    expect(levels).toEqual(
      new Map([
        [SOUTHEAST, 2],
        [WEST, 4],
        [NORTHEAST, 6],
      ]),
    );
    // Bellevue Square has an unnamed parking POI in it; it is a mall with parking, not a garage.
    expect(levels.has(MALL)).toBe(false);
    expect(
      [...found]
        .map(([piece, s]) => [piece.feature.id, s.name])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ).toEqual([
      [WEST, 'West Parking Garage'],
      [SOUTHEAST, 'Southeast Parking Garage'],
      [NORTHEAST, 'Northeast Parking Garage'],
    ]);
  });

  it('undoes the height Protomaps derived from building:levels', () => {
    expect(parkingLevels(8, undefined)).toBe(2);
    expect(parkingLevels(14, undefined)).toBe(4);
    expect(parkingLevels(20, undefined)).toBe(6);
    expect(parkingLevels(14, 5)).toBe(5);
    // Unmapped height: a plausible deck, never a tower.
    expect(parkingLevels(undefined, undefined)).toBe(3);
    expect(parkingLevels(2.5, undefined)).toBe(1);
    expect(parkingLevels(200, undefined)).toBe(14);
  });

  it('reads the mapped entrances on the footprint walls', () => {
    const found = associateParkingStructures(
      fixture.tile,
      buildingPieces(fixture.tile.buildings),
      fixture.size,
    );
    const entrances = new Map([...found].map(([p, s]) => [p.feature.id, s.entrances.length]));
    expect(entrances.get(SOUTHEAST)).toBeGreaterThanOrEqual(6);
    expect(entrances.get(NORTHEAST)).toBeGreaterThanOrEqual(1);
  });

  it('takes a garage by name when the structure and its parking are mapped apart', () => {
    const named = (name: string): TerrainPoiFeature => ({
      id: 1,
      class: 'parking',
      name,
      point: [0.84, 0.85],
    });
    const anonymous = fixture.tile.buildings.map((b) => ({ ...b, id: `b${b.id}` }));
    const count = (name: string): number =>
      associateParkingStructures(
        { ...fixture.tile, buildings: anonymous, pois: [named(name)] },
        buildingPieces(anonymous),
        fixture.size,
      ).size;
    expect(count('Lincoln Square Parking Garage')).toBe(1);
    expect(count('Kaufhof Parkhaus')).toBe(1);
    expect(count('丹波口立体駐車場')).toBe(1);
    // A POI that only says parking is as likely the basement of a tower.
    expect(count('Residential Parking Lot')).toBe(0);
    expect(count('Public')).toBe(0);
  });

  it('ignores footprints too small to ramp, and towers with parking in them', () => {
    const small = {
      ...fixture.tile,
      buildings: fixture.tile.buildings.filter((b) => b.id === SOUTHEAST),
    };
    expect(associateParkingStructures(small, buildingPieces(small.buildings), 20).size).toBe(0);
    const tall = {
      ...small,
      buildings: small.buildings.map((b) => ({ ...b, height: 89 })),
    };
    expect(
      associateParkingStructures(tall, buildingPieces(tall.buildings), fixture.size).size,
    ).toBe(0);
  });
});

describe('Bellevue Square garages', () => {
  it('keeps the mall a mall', () => {
    const mall = sites().find((candidate) => candidate.identity.includes(String(MALL)));
    expect(mall?.parking).toBeUndefined();
  });

  it('gives every real garage the storeys the map says it has, plus its roof deck', () => {
    expect(garages()).toHaveLength(3);
    for (const [id, levels] of [
      [SOUTHEAST, 2],
      [WEST, 4],
      [NORTHEAST, 6],
    ] as const) {
      const storeys = site(id).storeys ?? [];
      expect(storeys).toHaveLength(levels + 1);
      expect(storeys.at(-1)?.open).toBe(true);
      for (let i = 0; i + 1 < storeys.length; i++) {
        const rise = (storeys[i + 1]?.floor ?? 0) - (storeys[i]?.floor ?? 0);
        expect(rise).toBeGreaterThan(2.8);
        expect(rise).toBeLessThan(3.6);
        // Clear headroom for a van between deck and ceiling.
        if (!storeys[i]?.open)
          expect((storeys[i]?.ceiling ?? 0) - (storeys[i]?.floor ?? 0)).toBeGreaterThan(2.4);
      }
    }
  });

  it('fits a continuous ramp from the ground to the roof of each', () => {
    for (const id of [SOUTHEAST, WEST, NORTHEAST]) {
      const garage = site(id);
      const ramps = garage.parking?.ramps ?? [];
      const decks = (garage.storeys?.length ?? 0) - 1;
      expect(ramps).toHaveLength(decks);
      ramps.forEach((ramp, index) => {
        expect(ramp.lower).toBe(index);
        expect(ramp.upper).toBe(index + 1);
        const [x0, z0, x1, z1] = ramp.bounds;
        const run = ramp.axis === 'x' ? x1 - x0 : z1 - z0;
        const rise =
          (garage.storeys?.[ramp.upper]?.floor ?? 0) - (garage.storeys?.[ramp.lower]?.floor ?? 0);
        // Steeper than one in five would stop being a ramp a driver takes without thinking.
        expect(rise / run).toBeLessThanOrEqual(0.2);
        // A scissor: each lane climbs back the way the last came, from where it arrived.
        const next = ramps[index + 1];
        if (next) expect(next.climb).toBe(-ramp.climb);
      });
    }
  });

  it('opens its walls, with a vehicle door that fits the aisle', () => {
    for (const id of [SOUTHEAST, WEST, NORTHEAST]) {
      const garage = site(id);
      const doors = garage.openings.filter((o) => o.kind === 'door');
      expect(doors.length).toBeGreaterThanOrEqual(1);
      for (const door of doors) {
        expect(door.end - door.start).toBeCloseTo(garage.parking?.aisleWidth ?? 0, 3);
        expect(door.top - (garage.floor - 0.1)).toBeGreaterThanOrEqual(2.3);
      }
      const open = garage.openings.filter((o) => o.kind === 'open');
      expect(open.length).toBeGreaterThan(20);
      expect(garage.openings.some((o) => o.kind === 'window')).toBe(false);
    }
  });

  it('places mapped doors on the walls the map puts them', () => {
    const garage = site(SOUTHEAST);
    const door = garage.openings.find((o) => o.kind === 'door');
    expect(door).toBeDefined();
    const entrances = fixture.tile.pois
      ?.filter((poi) => poi.class === 'parking_entrance')
      .map((poi) => [poi.point[0] * fixture.size, poi.point[1] * fixture.size] as const);
    const distance = Math.min(
      ...(entrances ?? []).map(([x, z]) =>
        Math.hypot(x - garage.entrance[0], z - garage.entrance[1]),
      ),
    );
    expect(distance).toBeLessThan(8);
  });

  it('parks cars on every storey, thinning with height, under the geometry budget', () => {
    for (const id of [SOUTHEAST, WEST, NORTHEAST]) {
      const garage = site(id);
      const catalog = pack.interiors;
      if (!catalog) throw new Error('pack has no interiors');
      const plan = generateInteriorPlan(garage, { catalog });
      const parking = plan.parking;
      expect(parking?.stalls.length).toBeGreaterThan(30);
      expect(parking?.columns.length).toBeGreaterThan(8);
      const perLevel = (plan.storeys ?? []).map(
        (_, level) => parking?.cars.filter((car) => car.level === level).length ?? 0,
      );
      expect(perLevel.every((cars) => cars > 0)).toBe(true);
      expect(perLevel[0]).toBeGreaterThan(perLevel.at(-1) ?? 0);
      expect(parking?.cars.length).toBeLessThanOrEqual(1500);
      const geometry = generateInteriorGeometry(plan, catalog);
      expect(geometry.structure.triangleCount).toBeGreaterThan(100);
      // Interior streaming refuses anything over its 16 MiB resident cap.
      expect(geometry.bytes).toBeLessThan(12 * 1024 * 1024);
    }
  });

  it('regenerates the same cars in the same stalls', () => {
    const catalog = pack.interiors;
    if (!catalog) throw new Error('pack has no interiors');
    const garage = site(SOUTHEAST);
    const first = generateInteriorPlan(garage, { catalog }).parking?.cars;
    expect(generateInteriorPlan(garage, { catalog }).parking?.cars).toEqual(first);
    // A lower cap keeps a subset of the same cars instead of reshuffling them.
    const fewer = generateInteriorPlan(garage, { catalog, maxParkedCars: 100 }).parking?.cars;
    const ids = new Set(first?.map((car) => car.id));
    expect(fewer?.length).toBeGreaterThan(0);
    expect(fewer?.every((car) => ids.has(car.id))).toBe(true);
  });
});
