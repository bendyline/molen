import {
  type AmbientVehicleType,
  createFleetLibrary,
  type FleetCatalog,
} from '@bendyline/molen-ambient/kernel';
import type { TerrainParkedVehicle } from '@bendyline/molen-terrain/client';
import { createRegionResolver, type RegionAtlasDoc } from '@bendyline/molen-worldgen-earth/kernel';

export interface EarthFleetContent {
  catalogs: FleetCatalog[];
  atlas?: RegionAtlasDoc;
}
export interface EarthFleetOptions {
  /** Distinct road model types per market, default 16; paint adds variation without geometry. */
  maxModels?: number;
}
export interface EarthFleet {
  profileAt(x: number, z: number): string;
  carsAt(x: number, z: number): readonly AmbientVehicleType[];
  parkedAt(x: number, z: number): readonly TerrainParkedVehicle[];
}

/** Reuse the atlas polygons, restricted to fleet bindings (architectural overlays cannot hide them). */
export function createEarthFleet(
  content: EarthFleetContent,
  cars: readonly AmbientVehicleType[],
  parked: readonly TerrainParkedVehicle[],
  metersPerUnit: number,
  options: EarthFleetOptions = {},
): EarthFleet {
  const library = createFleetLibrary(
    content.catalogs,
    new Set(cars.map((c) => c.id)),
    options.maxModels,
  );
  const regions = content.atlas
    ? createRegionResolver(
        {
          ...content.atlas,
          regions: content.atlas.regions.filter((r) => library.regions.has(r.id)),
        },
        { metersPerUnit },
      )
    : undefined;
  const carPools = new Map<string, AmbientVehicleType[]>();
  const parkedPools = new Map<string, TerrainParkedVehicle[]>();
  const mixAt = (x: number, z: number) => library.select(regions?.resolve(x, z)?.id);
  return {
    profileAt: (x, z) => mixAt(x, z).profile,
    carsAt(x, z) {
      const mix = mixAt(x, z);
      let pool = carPools.get(mix.profile);
      if (!pool) {
        pool = cars
          .filter((c) => mix.weights.has(c.id))
          .map((c) => ({ ...c, weight: mix.weights.get(c.id) as number }));
        carPools.set(mix.profile, pool);
      }
      return pool;
    },
    parkedAt(x, z) {
      const mix = mixAt(x, z);
      let pool = parkedPools.get(mix.profile);
      if (!pool) {
        pool = parked
          .filter((c) => mix.weights.has(c.id))
          .map((c) => ({ ...c, weight: mix.weights.get(c.id) as number }));
        parkedPools.set(mix.profile, pool);
      }
      return pool;
    },
  };
}
