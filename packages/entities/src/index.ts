import type { AircraftData, ComponentMap, VehicleData } from '@bendyline/molen-schema';
import aircraftTypes from '../types/aircraft.types.json' with { type: 'json' };
import entityTypes from '../types/entities.types.json' with { type: 'json' };
import vehicleTypes from '../types/vehicle.types.json' with { type: 'json' };

export const MOLEN_AIRCRAFT_ENTITY_IDS = [
  'molen.entities.aircraft.p51d',
  'molen.entities.aircraft.h500md',
] as const;

export const MOLEN_VEHICLE_ENTITY_IDS = [
  'molen.entities.vehicle.compact',
  'molen.entities.vehicle.sedan',
  'molen.entities.vehicle.suv',
  'molen.entities.vehicle.pickup',
  'molen.entities.vehicle.van',
] as const;

export type MolenAircraftEntityId = (typeof MOLEN_AIRCRAFT_ENTITY_IDS)[number];
export type MolenVehicleEntityId = (typeof MOLEN_VEHICLE_ENTITY_IDS)[number];

/** Stable asset/type ids shipped by the Molen entities collection. */
export const MOLEN_ENTITY_IDS = [
  'molen.entities.tree.conifer.pine',
  'molen.entities.tree.conifer.fir',
  'molen.entities.tree.deciduous.oak',
  'molen.entities.tree.deciduous.birch',
  'molen.entities.vegetation.shrub',
  'molen.entities.nature.boulder',
  'molen.entities.aircraft.p51d',
  'molen.entities.aircraft.h500md',
  'molen.entities.vehicle.compact',
  'molen.entities.vehicle.sedan',
  'molen.entities.vehicle.suv',
  'molen.entities.vehicle.pickup',
  'molen.entities.vehicle.van',
] as const;

export type MolenEntityId = (typeof MOLEN_ENTITY_IDS)[number];

const MODEL_PATHS: Record<MolenEntityId, string> = {
  'molen.entities.tree.conifer.pine': 'assets/tree/conifer/pine/model.glb',
  'molen.entities.tree.conifer.fir': 'assets/tree/conifer/fir/model.glb',
  'molen.entities.tree.deciduous.oak': 'assets/tree/deciduous/oak/model.glb',
  'molen.entities.tree.deciduous.birch': 'assets/tree/deciduous/birch/model.glb',
  'molen.entities.vegetation.shrub': 'assets/vegetation/shrub/model.glb',
  'molen.entities.nature.boulder': 'assets/nature/boulder/model.glb',
  'molen.entities.aircraft.p51d': 'assets/molen/entities/aircraft/p51d/model.glb',
  'molen.entities.aircraft.h500md': 'assets/molen/entities/aircraft/h500md/model.glb',
  'molen.entities.vehicle.compact': 'assets/molen/entities/vehicle/compact/model.glb',
  'molen.entities.vehicle.sedan': 'assets/molen/entities/vehicle/sedan/model.glb',
  'molen.entities.vehicle.suv': 'assets/molen/entities/vehicle/suv/model.glb',
  'molen.entities.vehicle.pickup': 'assets/molen/entities/vehicle/pickup/model.glb',
  'molen.entities.vehicle.van': 'assets/molen/entities/vehicle/van/model.glb',
};

interface RawTypeDef {
  extends?: string;
  components?: ComponentMap;
}

const TYPE_DEFS: Record<string, RawTypeDef> = {
  ...(entityTypes.types as Record<string, RawTypeDef>),
  ...(aircraftTypes.types as Record<string, RawTypeDef>),
  ...(vehicleTypes.types as Record<string, RawTypeDef>),
};

function mergeObjects(base: unknown, override: unknown): unknown {
  if (
    base !== null &&
    override !== null &&
    typeof base === 'object' &&
    typeof override === 'object' &&
    !Array.isArray(base) &&
    !Array.isArray(override)
  ) {
    const merged = { ...(base as Record<string, unknown>) };
    for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
      merged[key] = mergeObjects(merged[key], value);
    }
    return merged;
  }
  return override;
}

/** Resolve an entity's external type components, including inherited defaults. */
export function getMolenEntityComponents(id: string, seen: string[] = []): ComponentMap {
  if (seen.includes(id)) throw new Error(`entity type cycle: ${[...seen, id].join(' -> ')}`);
  const def = TYPE_DEFS[id];
  if (def === undefined) throw new Error(`unknown Molen entity type "${id}"`);
  const base =
    def.extends === undefined ? {} : getMolenEntityComponents(def.extends, [...seen, id]);
  return mergeObjects(base, def.components ?? {}) as ComponentMap;
}

/** Fully resolved external aircraft component data for a concrete entity type. */
export function getMolenAircraft(id: MolenAircraftEntityId): AircraftData {
  return getMolenEntityComponents(id).aircraft as unknown as AircraftData;
}

/** Fully resolved external vehicle component data for a concrete entity type. */
export function getMolenVehicle(id: MolenVehicleEntityId): VehicleData {
  return getMolenEntityComponents(id).vehicle as unknown as VehicleData;
}

/**
 * Build the existing molen client `assets.index` mapping for this library.
 *
 * `baseUrl` should point at the published package root (or a copied static directory). When used
 * directly from the package, the default resolves beside `dist/` into the shipped asset tree.
 */
export function createMolenEntitiesAssetIndex(
  baseUrl: string | URL = new URL('../', import.meta.url),
): Record<MolenEntityId, string> {
  return Object.fromEntries(
    MOLEN_ENTITY_IDS.map((id) => [id, new URL(MODEL_PATHS[id], baseUrl).href]),
  ) as Record<MolenEntityId, string>;
}
