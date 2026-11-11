/**
 * Rolling stock standing in yards and on sidings: deterministic cuts of coupled cars along the
 * tracks a tile draws, as parked-vehicle placements (the same contract as cars parked at a curb,
 * so a host turns the near ones into entities and draws the rest as stand-ins).
 *
 * Tracks are split into blocks at stations fixed in the world (where the track's position along
 * its dominant axis crosses a multiple of the block length), so neighbouring tiles and a coarser
 * tile's copy of a yard agree on which blocks hold cars and what they hold. A tile places a block
 * when the block's first station lies in it, running on to the end of its piece of track.
 */
import type { VehiclePlacement, VehicleSpec } from '@bendyline/molen-schema';
import { sampleTerrainLine, type TerrainLinePath } from './line-path';
import {
  type TerrainRailCrossing,
  type TerrainRailLine,
  type TerrainRailTrack,
  type TerrainRailTurnout,
  terrainRailHash,
  terrainRailMastStations,
} from './rail-features';
import type { TerrainParkedVehicle } from './surface-styles';

/** Meters between the world-fixed stations that split tracks into blocks. */
const BLOCK = 75;
/** Track kept clear on each side of a turnout's points, and of a level crossing, meters. */
const SWITCH_CLEAR = 32;
const CROSSING_CLEAR = 14;
/** Share of blocks holding cars, by how the track is used. */
const OCCUPANCY: Readonly<Record<string, number>> = { yard: 0.78, siding: 0.5, spur: 0.62 };

export interface TerrainYardCarInput {
  lines: readonly TerrainRailLine[];
  tracks: readonly (TerrainRailTrack | undefined)[];
  turnouts: readonly TerrainRailTurnout[];
  crossings: readonly TerrainRailCrossing[];
  /** Absolute height of track `line`'s rail heads at tile-local X/Z. */
  railHead(line: number, x: number, z: number): number;
  origin: readonly [number, number];
  size: number;
  /** The rail vehicle types to stand in yards (specs with `rail`). */
  cars: readonly TerrainParkedVehicle[];
  /** Scales the share of blocks holding cars (default 1). */
  occupancy?: number;
  /** Most cars this tile places. */
  max: number;
}

/** A pool of one kind of rolling stock, drawn by weight. */
interface Pool {
  vehicles: TerrainParkedVehicle[];
  total: number;
}
function pool(vehicles: TerrainParkedVehicle[]): Pool {
  return { vehicles, total: vehicles.reduce((sum, v) => sum + (v.weight ?? 1), 0) };
}
function draw(from: Pool, u: number): TerrainParkedVehicle | undefined {
  let pick = u * from.total;
  for (const vehicle of from.vehicles) {
    pick -= vehicle.weight ?? 1;
    if (pick < 0) return vehicle;
  }
  return from.vehicles.at(-1);
}
const coupled = (spec: VehicleSpec): number => spec.rail?.couplerLength ?? spec.length + 0.8;

/** Meters along `path` nearest X/Z. */
function along(path: TerrainLinePath, x: number, z: number): { distance: number; offset: number } {
  let best = { distance: 0, offset: Number.POSITIVE_INFINITY };
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1] as readonly [number, number];
    const b = path.points[i] as readonly [number, number];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length2 = dx * dx + dz * dz;
    const t =
      length2 > 1e-12 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2)) : 0;
    const offset = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
    if (offset < best.offset)
      best = { distance: (path.distances[i - 1] as number) + Math.sqrt(length2) * t, offset };
  }
  return best;
}

/**
 * Cars standing on the yard, siding and spur tracks of a tile (heavy rail: freight cars and
 * the odd idle locomotive; light rail: its own cars in its yards), clear of turnouts and road
 * crossings. Placements are absolute world positions, keyed by where each car stands.
 */
export function placeTerrainYardCars(input: TerrainYardCarInput): VehiclePlacement[] {
  const placements: VehiclePlacement[] = [];
  const rail = input.cars.filter((car) => car.spec.rail !== undefined && (car.weight ?? 1) > 0);
  const freight = pool(rail.filter((car) => car.spec.bodyStyle === 'freight-car'));
  const engines = pool(rail.filter((car) => car.spec.bodyStyle === 'locomotive'));
  const light = pool(rail.filter((car) => car.spec.bodyStyle === 'light-rail'));
  if (freight.vehicles.length === 0 && light.vehicles.length === 0) return placements;
  const [ox, oz] = input.origin;
  const inTile = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < input.size && z < input.size;
  for (let line = 0; line < input.lines.length && placements.length < input.max; line++) {
    const track = input.tracks[line];
    const path = (input.lines[line] as TerrainRailLine).path;
    if (!track || track.disused || path.length < 30) continue;
    const share = OCCUPANCY[track.service];
    if (share === undefined) continue;
    const heavy = track.mode === 'heavy';
    if (heavy ? freight.vehicles.length === 0 : track.mode !== 'light' && track.mode !== 'tram')
      continue;
    if (!heavy && (track.service !== 'yard' || light.vehicles.length === 0)) continue;
    // Stretches cars keep off: the points of turnouts on or off this track, and road crossings.
    const clear: [number, number][] = [];
    for (const turnout of input.turnouts) {
      if (turnout.line === line)
        clear.push([turnout.distance - SWITCH_CLEAR, turnout.distance + SWITCH_CLEAR]);
      else if (turnout.diverging === line) {
        const at = along(path, turnout.x, turnout.z);
        if (at.offset < 4) clear.push([at.distance - SWITCH_CLEAR, at.distance + SWITCH_CLEAR]);
      }
    }
    for (const crossing of input.crossings)
      for (const t of crossing.tracks)
        if (t.line === line) clear.push([t.distance - CROSSING_CLEAR, t.distance + CROSSING_CLEAR]);
    const free = (from: number, to: number): boolean => clear.every(([a, b]) => to < a || from > b);
    const stations = terrainRailMastStations(path, input.origin, BLOCK);
    for (let b = 0; b < stations.length && placements.length < input.max; b++) {
      const station = stations[b] as (typeof stations)[number];
      if (!inTile(station.x, station.z)) continue;
      const wx = ox + station.x,
        wz = oz + station.z;
      if (terrainRailHash(wx, wz, 11) >= share * (input.occupancy ?? 1)) continue;
      // The block runs to the next station, or on to the end of this piece of track.
      const end = Math.min(path.length - 2, (stations[b + 1]?.distance ?? path.length) - 1.5);
      let s = station.distance + 0.5 + terrainRailHash(wx, wz, 12) * 6;
      const random = (salt: number): number => terrainRailHash(wx, wz, 20 + salt);
      let draws = 0;
      // A block holds one kind of car (a unit train's cut) or a mixed manifest, now and then
      // with an idle engine or two at its head.
      const unit = heavy ? draw(freight, random(draws++)) : draw(light, random(draws++));
      const mixed = heavy && random(draws++) < 0.45;
      const engineCount =
        heavy && engines.vehicles.length > 0 && random(draws++) < 0.12
          ? 1 + Math.floor(random(draws++) * 2)
          : 0;
      const palette = (car: TerrainParkedVehicle): string | undefined =>
        car.colors?.length
          ? car.colors[Math.floor(random(draws++) * car.colors.length) % car.colors.length]
          : undefined;
      let blockColor: string | undefined;
      let blockCar: TerrainParkedVehicle | undefined;
      let blockLeft = 0;
      for (let k = 0; placements.length < input.max; k++) {
        let car: TerrainParkedVehicle | undefined;
        let color: string | undefined;
        if (k < engineCount) car = draw(engines, random(draws++));
        else if (!heavy) car = unit;
        else if (!mixed) {
          car = unit;
          blockColor ??= car ? palette(car) : undefined;
          color = blockColor;
        } else {
          if (blockLeft <= 0 || !blockCar) {
            blockCar = draw(freight, random(draws++));
            blockColor = blockCar ? palette(blockCar) : undefined;
            blockLeft = 2 + Math.floor(random(draws++) * 4);
          }
          blockLeft--;
          car = blockCar;
          color = blockColor;
        }
        if (!car) break;
        const length = coupled(car.spec);
        if (s + length > end) break;
        const centre = s + length / 2;
        s += length;
        if (!free(centre - length / 2, centre + length / 2)) continue;
        const half = (car.spec.rail?.truckCenters ?? car.spec.wheelbase) / 2;
        const front = sampleTerrainLine(path, centre + half);
        const rear = sampleTerrainLine(path, centre - half);
        const yf = input.railHead(line, front.x, front.z);
        const yr = input.railHead(line, rear.x, rear.z);
        const span = Math.hypot(front.x - rear.x, front.z - rear.z) || 1;
        // Either way round: cars are coupled as they come.
        const turned = random(draws++) < 0.5;
        const yaw = Math.atan2(front.x - rear.x, front.z - rear.z) + (turned ? Math.PI : 0);
        const x = ox + (front.x + rear.x) / 2,
          z = oz + (front.z + rear.z) / 2;
        placements.push({
          id: `rail-car:${Math.round(x * 10)}:${Math.round(z * 10)}`,
          kind: car.id,
          color: color ?? palette(car) ?? '#5a4a3e',
          spec: car.spec,
          position: [x, (yf + yr) / 2, z],
          yaw,
          pitch: Math.atan2(turned ? yf - yr : yr - yf, span),
        });
      }
    }
  }
  return placements;
}
