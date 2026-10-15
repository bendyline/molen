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

/** Ambient-traffic aircraft: seen from the ground, not flyable (no `aircraft` component). */
export const MOLEN_AMBIENT_AIRCRAFT_ENTITY_IDS = ['molen.entities.aircraft.airliner'] as const;

/** Buses and rail cars for ambient traffic (`ambientRole`, no `vehicle` component). */
export const MOLEN_TRANSIT_ENTITY_IDS = [
  'molen.entities.transit.bus',
  'molen.entities.transit.lightrail',
] as const;

export const MOLEN_VEHICLE_ENTITY_IDS = [
  'molen.entities.vehicle.compact',
  'molen.entities.vehicle.sedan',
  'molen.entities.vehicle.suv',
  'molen.entities.vehicle.pickup',
  'molen.entities.vehicle.van',
  'molen.entities.vehicle.sports_coupe',
  'molen.entities.vehicle.station_wagon',
  'molen.entities.vehicle.electric_hatchback',
  'molen.entities.vehicle.taxi',
  'molen.entities.vehicle.offroad',
  'molen.entities.vehicle.box_truck',
] as const;

/** Rideable motorcycles and bicycles, sharing the vehicle and mountable capabilities. */
export const MOLEN_CYCLE_ENTITY_IDS = [
  'molen.entities.cycle.standard_motorcycle',
  'molen.entities.cycle.cruiser_motorcycle',
  'molen.entities.cycle.motor_scooter',
  'molen.entities.cycle.city_bicycle',
  'molen.entities.cycle.road_bicycle',
  'molen.entities.cycle.cargo_bicycle',
] as const;

/** Ambient watercraft; the origin is the waterline. */
export const MOLEN_WATERCRAFT_ENTITY_IDS = [
  'molen.entities.watercraft.speedboat',
  'molen.entities.watercraft.sailboat',
  'molen.entities.watercraft.fishing_boat',
  'molen.entities.watercraft.tugboat',
  'molen.entities.watercraft.container_ship',
  'molen.entities.watercraft.bulk_carrier',
  'molen.entities.watercraft.passenger_ferry',
  'molen.entities.watercraft.car_ferry',
] as const;

export type MolenCycleEntityId = (typeof MOLEN_CYCLE_ENTITY_IDS)[number];
export type MolenWatercraftEntityId = (typeof MOLEN_WATERCRAFT_ENTITY_IDS)[number];

export type MolenAircraftEntityId = (typeof MOLEN_AIRCRAFT_ENTITY_IDS)[number];
export type MolenVehicleEntityId = (typeof MOLEN_VEHICLE_ENTITY_IDS)[number];
export type MolenTransitEntityId = (typeof MOLEN_TRANSIT_ENTITY_IDS)[number];

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
  'molen.entities.aircraft.airliner',
  'molen.entities.vehicle.compact',
  'molen.entities.vehicle.sedan',
  'molen.entities.vehicle.suv',
  'molen.entities.vehicle.pickup',
  'molen.entities.vehicle.van',
  'molen.entities.transit.bus',
  'molen.entities.transit.lightrail',
  'molen.entities.vehicle.sports_coupe',
  'molen.entities.vehicle.station_wagon',
  'molen.entities.vehicle.electric_hatchback',
  'molen.entities.vehicle.taxi',
  'molen.entities.vehicle.offroad',
  'molen.entities.vehicle.box_truck',
  'molen.entities.cycle.standard_motorcycle',
  'molen.entities.cycle.cruiser_motorcycle',
  'molen.entities.cycle.motor_scooter',
  'molen.entities.cycle.city_bicycle',
  'molen.entities.cycle.road_bicycle',
  'molen.entities.cycle.cargo_bicycle',
  'molen.entities.watercraft.speedboat',
  'molen.entities.watercraft.sailboat',
  'molen.entities.watercraft.fishing_boat',
  'molen.entities.watercraft.tugboat',
  'molen.entities.watercraft.container_ship',
  'molen.entities.watercraft.bulk_carrier',
  'molen.entities.watercraft.passenger_ferry',
  'molen.entities.watercraft.car_ferry',
] as const;

export type MolenEntityId = (typeof MOLEN_ENTITY_IDS)[number];

const MODEL_PATHS: Record<MolenEntityId, string> = {
  'molen.entities.vehicle.sports_coupe': 'assets/molen/entities/vehicle/sports_coupe/model.glb',
  'molen.entities.vehicle.station_wagon': 'assets/molen/entities/vehicle/station_wagon/model.glb',
  'molen.entities.vehicle.electric_hatchback':
    'assets/molen/entities/vehicle/electric_hatchback/model.glb',
  'molen.entities.vehicle.taxi': 'assets/molen/entities/vehicle/taxi/model.glb',
  'molen.entities.vehicle.offroad': 'assets/molen/entities/vehicle/offroad/model.glb',
  'molen.entities.vehicle.box_truck': 'assets/molen/entities/vehicle/box_truck/model.glb',
  'molen.entities.cycle.standard_motorcycle':
    'assets/molen/entities/cycle/standard_motorcycle/model.glb',
  'molen.entities.cycle.cruiser_motorcycle':
    'assets/molen/entities/cycle/cruiser_motorcycle/model.glb',
  'molen.entities.cycle.motor_scooter': 'assets/molen/entities/cycle/motor_scooter/model.glb',
  'molen.entities.cycle.city_bicycle': 'assets/molen/entities/cycle/city_bicycle/model.glb',
  'molen.entities.cycle.road_bicycle': 'assets/molen/entities/cycle/road_bicycle/model.glb',
  'molen.entities.cycle.cargo_bicycle': 'assets/molen/entities/cycle/cargo_bicycle/model.glb',
  'molen.entities.watercraft.speedboat': 'assets/molen/entities/watercraft/speedboat/model.glb',
  'molen.entities.watercraft.sailboat': 'assets/molen/entities/watercraft/sailboat/model.glb',
  'molen.entities.watercraft.fishing_boat':
    'assets/molen/entities/watercraft/fishing_boat/model.glb',
  'molen.entities.watercraft.tugboat': 'assets/molen/entities/watercraft/tugboat/model.glb',
  'molen.entities.watercraft.container_ship':
    'assets/molen/entities/watercraft/container_ship/model.glb',
  'molen.entities.watercraft.bulk_carrier':
    'assets/molen/entities/watercraft/bulk_carrier/model.glb',
  'molen.entities.watercraft.passenger_ferry':
    'assets/molen/entities/watercraft/passenger_ferry/model.glb',
  'molen.entities.watercraft.car_ferry': 'assets/molen/entities/watercraft/car_ferry/model.glb',

  'molen.entities.tree.conifer.pine': 'assets/tree/conifer/pine/model.glb',
  'molen.entities.tree.conifer.fir': 'assets/tree/conifer/fir/model.glb',
  'molen.entities.tree.deciduous.oak': 'assets/tree/deciduous/oak/model.glb',
  'molen.entities.tree.deciduous.birch': 'assets/tree/deciduous/birch/model.glb',
  'molen.entities.vegetation.shrub': 'assets/vegetation/shrub/model.glb',
  'molen.entities.nature.boulder': 'assets/nature/boulder/model.glb',
  'molen.entities.aircraft.p51d': 'assets/molen/entities/aircraft/p51d/model.glb',
  'molen.entities.aircraft.oh6': 'assets/molen/entities/aircraft/oh6/model.glb',
  'molen.entities.aircraft.airliner': 'assets/molen/entities/aircraft/airliner/model.glb',
  'molen.entities.vehicle.compact': 'assets/molen/entities/vehicle/compact/model.glb',
  'molen.entities.vehicle.sedan': 'assets/molen/entities/vehicle/sedan/model.glb',
  'molen.entities.vehicle.suv': 'assets/molen/entities/vehicle/suv/model.glb',
  'molen.entities.vehicle.pickup': 'assets/molen/entities/vehicle/pickup/model.glb',
  'molen.entities.vehicle.van': 'assets/molen/entities/vehicle/van/model.glb',
  'molen.entities.transit.bus': 'assets/molen/entities/transit/bus/model.glb',
  'molen.entities.transit.lightrail': 'assets/molen/entities/transit/lightrail/model.glb',
};

/** Resolved aircraft data for one of the pack's aircraft, from a type library holding it. */
export function molenAircraft(types: TypeLibrary, id: MolenAircraftEntityId): AircraftData {
  return types.component<AircraftData>(id, 'aircraft');
}

/** Resolved vehicle data for one of the pack's vehicles, from a type library holding it. */
export function molenVehicle(
  types: TypeLibrary,
  id: MolenVehicleEntityId | MolenCycleEntityId,
): VehicleData {
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
