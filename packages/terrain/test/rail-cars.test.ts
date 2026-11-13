import type { VehicleSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { terrainLinePath } from '../src/line-path';
import { placeTerrainYardCars } from '../src/rail-cars';
import { type TerrainRailLine, terrainRailTrack } from '../src/rail-features';
import type { TerrainParkedVehicle } from '../src/surface-styles';

const SIZE = 800;

function spec(length: number, profile: string, bodyStyle: string): VehicleSpec {
  return {
    label: profile,
    bodyStyle,
    width: 3.2,
    length,
    height: 4.6,
    centerOfMass: [0, 1.8, 0],
    wheelbase: length * 0.75,
    wheelTrack: 1.5,
    wheelRadius: 0.457,
    mass: 100_000,
    engineForce: 1,
    maxSpeed: 31,
    reverseSpeed: 30,
    brakeDeceleration: 0.45,
    maxSteer: 0,
    grip: 3,
    driverEye: [0, 2.5, 0],
    steeringRate: 1,
    steeringFadeSpeed: 18,
    rollingResistance: 0.012,
    aerodynamicResistance: 1e-5,
    terrainAlignRate: 2,
    supportTolerance: 0.1,
    maxStepHeight: 0.4,
    maxSlope: 0.07,
    rail: { truckCenters: length * 0.75, couplerLength: length + 1, profile },
  } as VehicleSpec;
}

const CARS: TerrainParkedVehicle[] = [
  { id: 'hopper', spec: spec(16.9, 'hopper', 'freight-car'), weight: 2, colors: ['#aaaaaa'] },
  { id: 'tank', spec: spec(17, 'tank', 'freight-car'), colors: ['#1d1e20'] },
  { id: 'switcher', spec: spec(17.3, 'locomotive', 'locomotive') },
  { id: 'coach', spec: spec(25.3, 'coach', 'passenger-car') },
];

/** A straight yard track across a tile at world origin `ox`, and its turnout at `switchAt`. */
function yard(ox: number, switchAt?: number) {
  const feature = {
    class: 'rail',
    subclass: 'rail',
    service: 'yard',
    lines: [
      [
        [0, 0.5],
        [1, 0.5],
      ] as [number, number][],
    ],
  };
  const line: TerrainRailLine = {
    feature,
    path: terrainLinePath(feature.lines[0] as [number, number][], SIZE),
    width: 4,
  };
  const turnouts =
    switchAt === undefined
      ? []
      : [
          {
            x: switchAt - ox,
            z: SIZE / 2,
            dx: 1,
            dz: 0,
            side: 1 as const,
            line: 0,
            distance: switchAt - ox,
            mapped: true,
          },
        ];
  return placeTerrainYardCars({
    lines: [line],
    tracks: [terrainRailTrack(feature)],
    turnouts,
    crossings: [],
    railHead: () => 4.53,
    origin: [ox, 1000],
    size: SIZE,
    cars: CARS,
    occupancy: 1.3,
    max: 500,
  });
}

describe('rolling stock standing in yards', () => {
  it('fills a yard track with coupled cuts clear of the switch, the same every time', () => {
    const cars = yard(0, 400);
    expect(cars.length).toBeGreaterThan(15);
    expect(yard(0, 400)).toEqual(cars);
    // Never a coach in a freight yard; engines only now and then.
    expect(cars.every((car) => car.kind !== 'coach')).toBe(true);
    expect(cars.filter((car) => car.kind === 'switcher').length).toBeLessThan(cars.length / 4);
    for (const car of cars) {
      const half = (car.spec.rail?.couplerLength ?? 0) / 2;
      expect(Math.abs(car.position[0] - 400)).toBeGreaterThan(32 - half);
      expect(car.position[1]).toBeCloseTo(4.53, 6);
      expect(car.position[2]).toBeCloseTo(1000 + SIZE / 2, 6);
    }
    // Cars of a cut stand coupler to coupler.
    const sorted = [...cars].sort((a, b) => a.position[0] - b.position[0]);
    let coupled = 0;
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1] as (typeof sorted)[number];
      const b = sorted[i] as (typeof sorted)[number];
      const gap =
        b.position[0] -
        a.position[0] -
        ((a.spec.rail?.couplerLength ?? 0) + (b.spec.rail?.couplerLength ?? 0)) / 2;
      expect(gap).toBeGreaterThan(-1e-6);
      if (Math.abs(gap) < 1e-6) coupled++;
    }
    expect(coupled).toBeGreaterThan(cars.length / 2);
  });

  it('agrees with a neighbouring tile about the cars on their shared stretch', () => {
    // Two tiles overlapping by half: blocks are anchored in the world, so the cars a block
    // places are the same whichever tile places them.
    const a = yard(0);
    const b = yard(400);
    const key = (car: (typeof a)[number]) => `${car.kind}@${car.position[0].toFixed(3)}`;
    const shared = (cars: typeof a) =>
      cars.filter((car) => car.position[0] > 520 && car.position[0] < 760).map(key);
    expect(shared(a).length).toBeGreaterThan(3);
    expect(shared(b)).toEqual(shared(a));
  });

  it('leaves main lines, disused track and light rail without its own cars empty', () => {
    const main = {
      class: 'rail',
      subclass: 'rail',
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ] as [number, number][],
      ],
    };
    const path = terrainLinePath(main.lines[0] as [number, number][], SIZE);
    const place = (feature: typeof main & { service?: string }) =>
      placeTerrainYardCars({
        lines: [{ feature, path, width: 4 }],
        tracks: [terrainRailTrack(feature)],
        turnouts: [],
        crossings: [],
        railHead: () => 0,
        origin: [0, 0],
        size: SIZE,
        cars: CARS,
        max: 500,
      });
    expect(place(main)).toEqual([]);
    expect(place({ ...main, subclass: 'disused', service: 'yard' })).toEqual([]);
    expect(place({ ...main, subclass: 'light_rail', service: 'yard' })).toEqual([]);
  });
});
