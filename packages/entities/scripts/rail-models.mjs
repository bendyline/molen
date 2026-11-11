/**
 * Registry of the rail rolling-stock builders, keyed by models/recipe.json `model`. Each takes
 * its recipe and returns the model (front +Z, +X the vehicle's left, y = 0 top of rail, z = 0
 * midway between the truck centres) plus the driver eye, seats, boarding points and interior
 * bindings generate-rail.mjs writes into the entity type. Node contract: `truck-front` /
 * `truck-rear` at rail level under each truck centre, wheelsets `axle-1` … `axle-n` front to rear
 * at the axle centres (one `-spin` child each), cab and saloon furniture under `close-detail`,
 * the locomotive throttle under `throttle-handle`, optional loads under `load`.
 */
import {
  autorack,
  boxcar,
  centerbeam,
  coveredHopper,
  gondola,
  tankCar,
  wellCar,
} from './rail-freight.mjs';
import { es44ac, gp38, mp36 } from './rail-locomotives.mjs';
import { bilevel } from './rail-passenger.mjs';

export const RAIL_BUILDERS = {
  es44ac,
  gp38,
  mp36,
  bilevel,
  boxcar,
  'covered-hopper': coveredHopper,
  'tank-car': tankCar,
  'well-car': wellCar,
  autorack,
  gondola,
  centerbeam,
};
