import { createParkedVehicleInstances } from '@bendyline/molen-client/vehicles';
import type { VehiclePlacement } from '@bendyline/molen-schema';
import {
  pickParkedVehicle,
  type TerrainParkedVehicle,
  tagTerrainObject,
} from '@bendyline/molen-terrain/client';
import type { InteriorStreamingOptions } from '@bendyline/molen-worldgen/client';

/** What fits under a deck and in a bay; buses and motorhomes park elsewhere. */
const MAX_HEIGHT = 2.1;
const MAX_LENGTH = 5.4;
const MAX_WIDTH = 2.3;
/** Cars within this reach of the player are live vehicles; the rest stay instances. */
const LIVE_RADIUS = 38;
const LIVE_RISE = 7;
const MAX_LIVE = 48;
const PAINT = [
  '#b7c0c5',
  '#566d82',
  '#914c40',
  '#e0dccc',
  '#3e4b50',
  '#8d989b',
  '#2f3338',
] as const;

/**
 * Fill a car park's stalls from the regional fleet. Every car is drawn from one instanced mesh per
 * body size, but only those near the player become entities, through `userData.vehiclesNear`:
 * a garage holds more cars than a whole resident city block of curbside parking.
 */
export function createGarageFurnisher(
  vehicles: readonly TerrainParkedVehicle[],
): NonNullable<InteriorStreamingOptions['furnish']> {
  const fleet = vehicles.filter(
    ({ spec }) => spec.height <= MAX_HEIGHT && spec.length <= MAX_LENGTH && spec.width <= MAX_WIDTH,
  );
  return (plan, group, origin) => {
    const cars = plan.parking?.cars ?? [];
    if (cars.length === 0 || fleet.length === 0) return;
    const placements: VehiclePlacement[] = [];
    for (const car of cars) {
      const vehicle = pickParkedVehicle(fleet, car.seed);
      if (!vehicle) continue;
      const palette = vehicle.colors?.length ? vehicle.colors : PAINT;
      placements.push({
        id: `garage-car:${plan.identity}:${car.id}`,
        kind: vehicle.id,
        color: palette[Math.floor(car.seed * 7919) % palette.length] as string,
        spec: vehicle.spec,
        position: [car.position[0] + origin[0], car.position[1], car.position[2] + origin[1]],
        yaw: car.yaw,
      });
    }
    group.add(createParkedVehicleInstances(placements, origin));
    group.userData.vehiclesNear = (position: readonly [number, number, number]) =>
      nearby(placements, position);
    // EarthVehicles only visits groups tagged as holding parked cars.
    tagTerrainObject('parked-vehicles', group);
  };
}

function nearby(
  placements: readonly VehiclePlacement[],
  [x, y, z]: readonly [number, number, number],
): VehiclePlacement[] {
  const found: { placement: VehiclePlacement; distance: number }[] = [];
  for (const placement of placements) {
    const [px, py, pz] = placement.position;
    if (Math.abs(py - y) > LIVE_RISE) continue;
    const distance = Math.hypot(px - x, pz - z);
    if (distance <= LIVE_RADIUS) found.push({ placement, distance });
  }
  return found
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_LIVE)
    .map(({ placement }) => placement);
}
