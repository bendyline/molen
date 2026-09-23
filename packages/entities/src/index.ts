/**
 * Ids and small helpers for the `molen.entities` content pack. The models and type documents are
 * content, not code: load the pack (or list it in a project's `packs`) and pass its type library.
 */
import type { TypeLibrary } from '@bendyline/molen-kernel/content';
import type { AircraftData, VehicleData } from '@bendyline/molen-schema';

export const MOLEN_AIRCRAFT_ENTITY_IDS = [
  'molen.entities.aircraft.p51d',
  'molen.entities.aircraft.oh6',
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

/** Stable asset/type ids of the `molen.entities` content pack. */
export const MOLEN_ENTITY_IDS = [
  'molen.entities.tree.conifer.pine',
  'molen.entities.tree.conifer.fir',
  'molen.entities.tree.deciduous.oak',
  'molen.entities.tree.deciduous.birch',
  'molen.entities.vegetation.shrub',
  'molen.entities.nature.boulder',
  'molen.entities.aircraft.p51d',
  'molen.entities.aircraft.oh6',
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
  'molen.entities.aircraft.oh6': 'assets/molen/entities/aircraft/oh6/model.glb',
  'molen.entities.vehicle.compact': 'assets/molen/entities/vehicle/compact/model.glb',
  'molen.entities.vehicle.sedan': 'assets/molen/entities/vehicle/sedan/model.glb',
  'molen.entities.vehicle.suv': 'assets/molen/entities/vehicle/suv/model.glb',
  'molen.entities.vehicle.pickup': 'assets/molen/entities/vehicle/pickup/model.glb',
  'molen.entities.vehicle.van': 'assets/molen/entities/vehicle/van/model.glb',
};

/** Resolved aircraft data for one of the pack's aircraft, from a type library holding it. */
export function molenAircraft(types: TypeLibrary, id: MolenAircraftEntityId): AircraftData {
  return types.component<AircraftData>(id, 'aircraft');
}

/** Resolved vehicle data for one of the pack's vehicles, from a type library holding it. */
export function molenVehicle(types: TypeLibrary, id: MolenVehicleEntityId): VehicleData {
  return types.component<VehicleData>(id, 'vehicle');
}

/**
 * Build the molen client `assets.index` mapping for this library from a directory holding the
 * `molen.entities` content pack's files (`molen pack extract`), served as static files. This
 * package ships no models; with the pack itself, use its asset provider instead.
 */
export function createMolenEntitiesAssetIndex(
  baseUrl: string | URL,
): Record<MolenEntityId, string> {
  return Object.fromEntries(
    MOLEN_ENTITY_IDS.map((id) => [id, new URL(MODEL_PATHS[id], baseUrl).href]),
  ) as Record<MolenEntityId, string>;
}
