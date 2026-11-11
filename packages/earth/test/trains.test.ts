import { readFileSync } from 'node:fs';
import { createParkedVehicleBatch } from '@bendyline/molen-client/vehicles';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { VehicleState } from '@bendyline/molen-kernel/vehicles';
import { Transform } from '@bendyline/molen-kernel/world';
import type { VehicleData, VehiclePlacement } from '@bendyline/molen-schema';
import { tagTerrainObject } from '@bendyline/molen-terrain/client';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { earthRailCars } from '../src/client/content';
import { EarthRailNetwork } from '../src/client/rail';
import { EarthTrains } from '../src/client/trains';
import { EarthVehicles } from '../src/client/vehicles';

const TYPES = createTypeLibrary(
  ['rail.types.json', 'transit.types.json'].map((name) =>
    JSON.parse(
      readFileSync(new URL(`../../../content/entities/types/${name}`, import.meta.url), 'utf8'),
    ),
  ),
);
const HOPPER = 'molen.entities.rail.covered_hopper';

/** Points every 10 m along +Z at x. */
function line(x: number, from: number, to: number): [number, number][] {
  return Array.from({ length: Math.round((to - from) / 10) + 1 }, (_, i) => [x, from + i * 10]);
}

/**
 * A main line up the Z axis, a yard track beside it, and a cut of hoppers standing on the main
 * line ahead at z = 400.
 */
function setup() {
  const root = new THREE.Group();
  const rail = new EarthRailNetwork();
  rail.network.set('tile', [
    { points: line(0, -800, 800), tags: { detail: 'rail', service: '', name: 'Main' } },
    { points: line(60, -800, 800), tags: { detail: 'rail', service: 'yard', name: '' } },
  ]);
  const spec = TYPES.component<VehicleData>(HOPPER, 'vehicle').spec;
  const length = spec.rail?.couplerLength ?? spec.length;
  const standing: VehiclePlacement[] = [0, 1, 2].map((i) => ({
    id: `rail-car:${i}`,
    kind: HOPPER,
    color: '#aaaaaa',
    spec,
    position: [0, 0.21, 400 + i * length],
    yaw: 0,
  }));
  const tile = new THREE.Group();
  tile.userData.vehicles = standing;
  tagTerrainObject('parked-vehicles', tile);
  tile.add(createParkedVehicleBatch(standing));
  root.add(tile);
  const vehicles = new EarthVehicles({
    root,
    sampleHeight: () => 0,
    loadModel: async () => new THREE.Group(),
    types: TYPES,
    track: rail.network,
  });
  vehicles.sync(0);
  const trains = new EarthTrains({ vehicles, rail, types: TYPES });
  return { root, vehicles, trains, standing };
}

function run(vehicles: EarthVehicles, trains: EarthTrains, seconds: number, throttle = 0): void {
  for (let i = 0; i < seconds * 30; i++) {
    trains.update(1 / 30);
    vehicles.update(1 / 30, { throttle, steering: 0, brake: false });
  }
}

describe('trains among standing cars', () => {
  it('stands a library of yard rolling stock: freight, yard engines and light rail', () => {
    const cars = earthRailCars(TYPES);
    const ids = cars.map((car) => car.id);
    expect(ids).toContain(HOPPER);
    expect(ids).toContain('molen.entities.rail.emd_gp38_2');
    expect(ids).toContain('molen.entities.transit.lightrail');
    // Coaches and commuter locomotives stay out of freight yards.
    expect(ids).not.toContain('molen.entities.rail.bombardier_bilevel_coach');
    expect(ids).not.toContain('molen.entities.rail.mpi_mp36ph_3c');
    // Paints come from the consists the locomotives lead; loads take their own.
    expect(cars.find((car) => car.id === HOPPER)?.colors?.length).toBeGreaterThan(0);
    expect(cars.find((car) => car.spec.rail?.profile === 'flat')?.colors).toContain('#e9e4d6');
  });

  it("stops a driver's train against standing cars instead of running through them", () => {
    const { vehicles, trains, standing } = setup();
    expect(vehicles.parkedRailCars()).toHaveLength(3);
    const train = trains.spawn('freight', 0, 0, { yaw: 0 });
    expect(train).toBeDefined();
    if (!train) return;
    expect(trains.board(train, 'driver')).toBe(true);
    run(vehicles, trains, 240, 1);
    const lead = train.cars[0] as string;
    const front =
      (vehicles.world.get(lead, Transform)?.pos[2] ?? 0) +
      (vehicles.world.get(lead, VehicleState) ? 11.15 : 0);
    const first = standing[0] as VehiclePlacement;
    const rear = first.position[2] - (first.spec.rail?.couplerLength ?? 0) / 2;
    expect(front).toBeLessThan(rear + 1.5);
    expect(front).toBeGreaterThan(rear - 6);
    expect(Math.abs(vehicles.world.get(lead, VehicleState)?.speed ?? 1)).toBeLessThan(0.5);
  });

  it('keeps switchers working yard tracks clear of standing cars and the main line', () => {
    const { vehicles, trains } = setup();
    trains.yard([0, 0, 0], { max: 1, radius: 400 });
    const switcher = trains.list().find((train) => train.kind === 'yard');
    expect(switcher).toBeDefined();
    if (!switcher) return;
    expect(switcher.autonomous).toBe(true);
    const x = () => vehicles.world.get(switcher.cars[0] as string, Transform)?.pos[0] ?? 0;
    expect(x()).toBeCloseTo(60, 0);
    let moved = 0;
    let last = vehicles.world.get(switcher.cars[0] as string, Transform)?.pos[2] ?? 0;
    for (let i = 0; i < 90; i++) {
      run(vehicles, trains, 1);
      const z = vehicles.world.get(switcher.cars[0] as string, Transform)?.pos[2] ?? 0;
      moved += Math.abs(z - last);
      last = z;
      expect(
        Math.abs(vehicles.world.get(switcher.cars[0] as string, VehicleState)?.speed ?? 0),
      ).toBeLessThan(5.5);
    }
    // It worked: ran some hundreds of meters at switching speed, still on its yard track.
    expect(moved).toBeGreaterThan(100);
    expect(x()).toBeCloseTo(60, 0);
  });
});
