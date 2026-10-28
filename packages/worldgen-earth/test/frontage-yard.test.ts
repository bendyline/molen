import {
  createEmptyTerrainSemanticTile,
  type TerrainSemanticTile,
} from '@bendyline/molen-terrain/kernel';
import type { ArchStyleDoc, BuildingYard, Vec2 } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { inferBuildingFootprints } from '../src/kernel/building-infill';
import { createFrontageYard } from '../src/kernel/frontage-yard';
import { corridor, lineNearPolygon, segmentDistance } from '../src/kernel/infill-geometry';
import { semanticTileToBatch } from '../src/kernel/semantic-adapter';
import { loadDefaultPack } from './helpers/pack';

const pack = await loadDefaultPack();
const geom = {
  level: 15,
  x: 0,
  z: 0,
  originX: 0,
  originZ: 0,
  size: 480,
  metersPerUnit: 1,
  levelBelowMax: 0,
};
const style = pack.archstyles['molen.worldgen.regional.southwestern.detached'] as ArchStyleDoc;
const fixture = (): TerrainSemanticTile => ({
  ...createEmptyTerrainSemanticTile(),
  transportation: [
    {
      class: 'residential',
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    },
  ],
  landcover: [
    {
      class: 'residential',
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
  ],
});

describe('inferred driveways and yards', () => {
  it('keeps every fence clear of paths, driveways, houses and the public street', () => {
    const homes = inferBuildingFootprints(fixture(), geom, true, undefined, [], () => ({
      ...style,
      lotFences: [{ kind: 'masonry', weight: 1 }],
    }));
    expect(homes.length).toBeGreaterThan(40);
    let checked = 0;
    for (const home of homes.filter((f) => f.infill.part === 'home')) {
      const garage = homes.find(
        (f) => f.infill.lotId === home.infill.lotId && f.infill.part === 'garage',
      );
      const yard = home.infill.yard as BuildingYard;
      const drive = garage?.infill.access ?? yard.driveway;
      expect(drive).toBeDefined();
      expect(drive?.width).toBeGreaterThanOrEqual(2);
      expect(drive?.lift).toBeGreaterThan(0.18);
      if (yard.driveway)
        expect(
          segmentDistance(
            home.infill.access.from,
            home.infill.access.to,
            yard.driveway.from,
            yard.driveway.to,
          ),
        ).toBeGreaterThan((home.infill.access.width + yard.driveway.width) / 2);
      if (garage) expect(yard.driveway).toBeUndefined();
      for (const [a, b] of yard.fence?.segments ?? []) {
        for (const access of [home.infill.access, drive].filter((v) => v !== undefined))
          expect(lineNearPolygon(a, b, corridor(access.from, access.to, access.width), 0.2)).toBe(
            false,
          );
        for (const part of [home, ...(garage ? [garage] : [])])
          expect(
            lineNearPolygon(
              a,
              b,
              { outer: (part.polygons[0]?.outer ?? []).map(([x, z]): Vec2 => [x * 480, z * 480]) },
              0.1,
            ),
          ).toBe(false);
        expect(segmentDistance(a, b, [0, 240], [480, 240])).toBeGreaterThan(4);
        checked++;
      }
      expect(garage?.infill.yard).toBeUndefined();
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('repeats decoration across reloads and thinning without changing house geometry', () => {
    const tile = fixture(),
      a = inferBuildingFootprints(tile, geom, { seed: 9 });
    expect(inferBuildingFootprints(structuredClone(tile), geom, { seed: 9 })).toEqual(a);
    const b = inferBuildingFootprints(tile, geom, { seed: 9, density: 0.4 });
    expect(b.length).toBeGreaterThan(5);
    for (const home of b) expect(home).toEqual(a.find((f) => f.id === home.id));
    const withStyles = inferBuildingFootprints(tile, geom, { seed: 9 }, undefined, [], () => ({
      ...style,
      lotPlans: undefined,
      lotFences: [{ kind: 'rail', weight: 1 }],
    }));
    const footprint = (list: typeof a) =>
      list.map(({ id, polygons, levels }) => ({ id, polygons, levels }));
    expect(footprint(withStyles)).toEqual(footprint(a));
    expect(a.some((f) => !f.infill.yard?.fence)).toBe(true);
    expect(a.some((f) => f.infill.yard?.fence)).toBe(true);
  });

  it('suppresses blocked decoration and excludes vegetation from new driveways and fence lines', () => {
    const yard = createFrontageYard({
      identity: 'yard',
      style: { ...style, lotFences: [{ kind: 'timber', weight: 1 }] },
      width: 12,
      halfLot: 7,
      front: -3,
      back: 17,
      curb: -5,
      hasGarage: false,
      entrances: [{ x: 0, width: 1.2 }],
      at: (x, z) => [x, z],
      clear: () => false,
    });
    expect(yard).toEqual({});
    const batch = semanticTileToBatch(fixture(), geom, { pack, buildingInfill: true });
    const driveways = batch.buildings.flatMap((b) => (b.yard?.driveway ? [b.yard.driveway] : []));
    expect(driveways.length).toBeGreaterThan(10);
    for (const drive of driveways)
      expect(batch.scatter?.exclusions).toContainEqual({
        ring: corridor(drive.from, drive.to, drive.width).outer,
        radius: 0.5,
        kind: 'roads',
      });
    const commercial = fixture();
    if (commercial.landcover[0]) commercial.landcover[0].class = 'commercial';
    expect(inferBuildingFootprints(commercial, geom, true).every((f) => !f.infill.yard)).toBe(true);
  });
});
