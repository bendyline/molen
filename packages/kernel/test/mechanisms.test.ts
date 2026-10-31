import { describe, expect, it } from 'vitest';
import {
  AircraftInput,
  AircraftState,
  IDLE_AIRCRAFT_INPUT,
  initialAircraftState,
  installAircraft,
  stepAircraft,
} from '../src/aircraft';
import { Transform, type TransformData } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import {
  driveVehicle,
  IDLE_VEHICLE_INPUT,
  initialVehicleState,
  installVehicles,
  mountEntity,
  unmountEntity,
  VehicleInput,
  VehicleState,
  vehicleMounts,
} from '../src/vehicles';
import { World } from '../src/world';
import { molenAircraft, molenVehicle } from './helpers/entities';

const flat = { groundHeight: () => 0 };
describe('vehicle mechanisms in the headless simulation', () => {
  it('steps parked car panels, preserves selections across mounting, and replays a reversal', () => {
    const vehicle = molenVehicle('molen.entities.vehicle.sedan');
    const spec = {
      ...vehicle.spec,
      actuators: { doorFrontLeft: { seconds: 10 }, headlights: { seconds: 0 } },
    };
    const w = new World({ tickRate: 60 });
    installVehicles(w, flat);
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        vehicle: { ...vehicle, spec },
        vehicleState: initialVehicleState(),
        vehicleInput: { ...IDLE_VEHICLE_INPUT, actuators: { doorFrontLeft: 1, headlights: true } },
        mountable: vehicleMounts(spec),
      },
      'car',
    );
    w.spawnRaw({ transform: { pos: [-1.8, 0, 0], rot: [0, 0, 0, 1] } }, 'pilot');
    w.stepN(180);
    expect(w.get('car', VehicleState)?.actuators?.doorFrontLeft).toBeCloseTo(0.3);
    expect(mountEntity(w, 'pilot', 'car')).toBe(true);
    expect(driveVehicle(w, 'pilot', IDLE_VEHICLE_INPUT)).toBe(true);
    expect(unmountEntity(w, 'pilot', flat)).toBe(true);
    expect(w.get('car', VehicleInput)?.actuators?.headlights).toBe(true);
    w.set('car', VehicleInput, {
      ...IDLE_VEHICLE_INPUT,
      actuators: { doorFrontLeft: 0, headlights: true },
    });
    const frame = takeKeyframe(w);
    w.stepN(120);
    expect(w.get('car', VehicleState)?.actuators?.doorFrontLeft).toBeCloseTo(0.1);
    const hash = stateHash(w);
    applyKeyframeTo(w, frame);
    w.stepN(120);
    expect(stateHash(w)).toBe(hash);
  });
  it('reverses airplane and helicopter landing gear while airborne', () => {
    for (const id of ['airliner', 'aw139']) {
      const original = molenAircraft(`molen.entities.aircraft.${id}`).spec;
      const spec = structuredClone(original);
      if (spec.airplane) spec.airplane.gearTransitTime = 10;
      if (spec.helicopter) {
        spec.helicopter.fixedGear = false;
        spec.helicopter.gearTransitTime = 10;
      }
      let result: {
        transform: TransformData;
        state: import('@bendyline/molen-schema').AircraftStateData;
      } = {
        transform: { pos: [0, 10000, 0], rot: [0, 0, 0, 1] } as TransformData,
        state: { ...initialAircraftState(), grounded: false, gearPosition: 0 },
      };
      for (let i = 0; i < 180; i++)
        result = stepAircraft(
          result.transform,
          result.state,
          { ...IDLE_AIRCRAFT_INPUT, gear: true },
          spec,
          1 / 60,
          flat,
        );
      expect(result.state.gearPosition).toBeCloseTo(0.3);
      for (let i = 0; i < 120; i++)
        result = stepAircraft(
          result.transform,
          result.state,
          { ...IDLE_AIRCRAFT_INPUT, gear: false },
          spec,
          1 / 60,
          flat,
        );
      expect(result.state.gearPosition).toBeCloseTo(0.1);
    }
  });
  it('adds drag progressively and initializes parked helicopter mechanisms', () => {
    const spec = molenAircraft('molen.entities.aircraft.airliner').spec;
    const t: TransformData = { pos: [0, 1000, 0], rot: [0, 0, 0, 1] };
    const state = {
      ...initialAircraftState(),
      grounded: false,
      velocity: [0, 0, 100] as [number, number, number],
    };
    const run = (speedBrake: number) =>
      stepAircraft(
        t,
        { ...state, actuators: { speedBrake } },
        { ...IDLE_AIRCRAFT_INPUT, actuators: { speedBrake } },
        spec,
        1 / 60,
        flat,
      ).state.velocity[2];
    expect(run(1)).toBeLessThan(run(0.5));
    expect(run(0.5)).toBeLessThan(run(0));
    const heli = molenAircraft('molen.entities.aircraft.aw139');
    const w = new World();
    installAircraft(w, flat);
    w.spawnRaw(
      {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        aircraft: heli,
        aircraftState: initialAircraftState(),
        aircraftInput: IDLE_AIRCRAFT_INPUT,
      },
      'heli',
    );
    w.stepN(1);
    expect(w.get('heli', AircraftState)?.gearPosition).toBe(1);
    w.set('heli', AircraftInput, { ...IDLE_AIRCRAFT_INPUT, actuators: { eject: true } });
    w.stepN(10);
    expect(w.get('heli', AircraftState)?.actuators?.eject).toBeGreaterThan(0);
    expect(w.get('heli', Transform)?.pos[1]).toBe(0);
  });
});
