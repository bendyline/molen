import type { SnowCoverData, VehicleSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import type { TransformData } from '../src/component';
import {
  initialVehicleState,
  snowDrag,
  stepVehicle,
  type VehicleEnvironment,
  type VehicleInputData,
  type VehicleStateData,
  vehicleSurface,
} from '../src/vehicles';
import { molenVehicle } from './helpers/entities';

const sedan = molenVehicle('molen.entities.vehicle.sedan').spec;
const offroad = molenVehicle('molen.entities.vehicle.offroad').spec;
const skateboard = molenVehicle('molen.entities.cycle.skateboard').spec;
/** Skis as the kernel sees them: a balanced pair of runners with edges, pushed by poling. */
const skis: VehicleSpec = {
  ...skateboard,
  runners: { friction: 0.05, pushSpeed: 4 },
  rollingResistance: 0,
  aerodynamicResistance: 0.0042,
  grip: 7,
  // A hockey stop: edges set across the hill hold about 0.6 g.
  brakeDeceleration: 6,
  maxSpeed: 38,
  maxSlope: 0.95,
  supportTolerance: 0.3,
  // Fixed loads on the two contacts: a standing rider's weight does not pitch onto the tips
  // under air drag, which would turn the pair tail-first at speed.
  pitchStiffness: 0,
};
/** Snow exactly `depth` meters deep everywhere, whatever the height. */
const snow = (depth: number): SnowCoverData => ({
  level: -100_000,
  transition: 0,
  depth,
  depthGain: 0,
  maxDepth: 10,
});
type Drive = { transform: TransformData; state: VehicleStateData };
const parked = (speed = 0): Drive => ({
  transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
  state: { ...initialVehicleState(), speed },
});
/** Ground falling away ahead (+Z) at `degrees`; 0 is flat. */
const slope = (degrees: number): VehicleEnvironment['groundHeight'] => {
  const grade = Math.tan((degrees * Math.PI) / 180);
  return (_x, z) => -z * grade;
};
function drive(
  seconds: number,
  controls: (state: VehicleStateData, time: number) => VehicleInputData,
  spec: VehicleSpec,
  env: VehicleEnvironment,
  start = parked(),
  watch: (result: Drive) => void = () => {},
): Drive {
  let result = start;
  // Stand the vehicle on its ground first.
  result.transform.pos[1] = env.groundHeight(0, 0) ?? 0;
  for (let tick = 0; tick < Math.round(seconds * 60); tick++) {
    result = stepVehicle(
      result.transform,
      result.state,
      controls(result.state, tick / 60),
      spec,
      1 / 60,
      { ...env, time: tick / 60 },
    );
    watch(result);
  }
  return result;
}
const floored = (): VehicleInputData => ({ throttle: 1, steering: 0, brake: false });
const coasting = (): VehicleInputData => ({ throttle: 0, steering: 0, brake: false });
const braking = (): VehicleInputData => ({ throttle: 0, steering: 0, brake: true });
const flat = slope(0);

describe('wheels in lying snow', () => {
  it('leaves a snow-free drive exactly as it was', () => {
    const bare = drive(4, floored, sedan, { groundHeight: flat });
    // A cover whose line is far above the car changes nothing, bit for bit.
    const below = drive(4, floored, sedan, {
      groundHeight: flat,
      weather: { snowCover: { level: 3000 } },
    });
    expect(below).toEqual(bare);
    expect(bare.state.snowDepth).toBeUndefined();
    expect(bare.state.stuck).toBeUndefined();
    expect(bare.state.surfaceGrip).toBeUndefined();
  });

  it('grips like snow, and reports the depth under the wheels', () => {
    const env: VehicleEnvironment = { groundHeight: flat, weather: { snowCover: snow(0.04) } };
    const stop = (weather: VehicleEnvironment): number =>
      drive(12, braking, sedan, weather, parked(20)).transform.pos[2];
    expect(stop(env)).toBeGreaterThan(stop({ groundHeight: flat }) * 1.8);
    const rolling = drive(1, coasting, sedan, env, parked(10));
    expect(rolling.state.snowDepth).toBeCloseTo(0.04, 6);
    expect(rolling.state.surfaceGrip).toBeCloseTo(0.35, 6);
    // Falling snow on top of lying snow costs little more than the cover already did.
    const falling = drive(1, coasting, sedan, {
      ...env,
      weather: { ...env.weather, precipitation: { kind: 'snow', intensity: 0.7 } },
    });
    expect(falling.state.surfaceGrip).toBeCloseTo(0.35, 6);
  });

  it('keeps less of it on a ploughed road than on open ground', () => {
    const weather = { snowCover: snow(0.3) };
    const on = (kind: string | undefined): VehicleStateData =>
      drive(1, coasting, sedan, {
        groundHeight: flat,
        weather,
        ...(kind === undefined ? {} : { surface: () => vehicleSurface(kind) }),
      }).state;
    expect(on('asphalt').snowDepth).toBeCloseTo(0.09, 6);
    expect(on('grass').snowDepth).toBeCloseTo(0.3, 6);
    // No surface report: the snow lies as deep as the weather says.
    expect(on(undefined).snowDepth).toBeCloseTo(0.3, 6);
  });

  it('drags harder the deeper it lies against the wheel', () => {
    expect(snowDrag(0, 0.33)).toEqual({ packed: 0, deep: 0 });
    const shallow = snowDrag(0.05, 0.33);
    const deep = snowDrag(0.25, 0.33);
    expect(shallow.packed).toBeCloseTo(0.6, 6);
    expect(shallow.deep).toBeLessThan(0.25);
    expect(deep.packed).toBeCloseTo(0.6, 6);
    expect(deep.deep).toBeGreaterThan(4);
    // A bigger wheel rides over the same snow more easily, and off-road tread helps.
    expect(snowDrag(0.25, 0.45).deep).toBeLessThan(deep.deep * 0.6);
    expect(snowDrag(0.25, 0.33, 1).deep).toBeCloseTo(deep.deep * 0.6, 6);
  });

  it('lets a sedan through road snow and bogs it down in a deep field', () => {
    const through = (depth: number, spec = sedan): Drive =>
      drive(6, floored, spec, { groundHeight: flat, weather: { snowCover: snow(depth) } });
    const road = through(0.05);
    expect(road.transform.pos[2]).toBeGreaterThan(20);
    expect(road.state.stuck).toBeUndefined();
    const field = through(0.3);
    expect(field.transform.pos[2]).toBe(0);
    expect(field.state.speed).toBe(0);
    expect(field.state.stuck).toBe(true);
    // Off-road tires on all four wheels still make way where the sedan cannot.
    const truck = through(0.3, offroad);
    expect(truck.transform.pos[2]).toBeGreaterThan(5);
    expect(truck.state.stuck).toBeUndefined();
    // Half a meter stops it too.
    expect(through(0.6, offroad).state.stuck).toBe(true);
  });

  it('stops a car that drives off the road into deep snow, and does not call a parked one stuck', () => {
    const env: VehicleEnvironment = { groundHeight: flat, weather: { snowCover: snow(0.35) } };
    let farthest = 0;
    const end = drive(8, floored, sedan, env, parked(15), (r) => {
      farthest = Math.max(farthest, r.state.speed);
    });
    // It ploughs on for a few car lengths, then the snow has it.
    expect(farthest).toBeLessThanOrEqual(15);
    expect(end.state.speed).toBe(0);
    expect(end.state.stuck).toBe(true);
    expect(end.transform.pos[2]).toBeGreaterThan(5);
    expect(end.transform.pos[2]).toBeLessThan(80);
    // Lifting off, it simply stands there.
    expect(drive(1, coasting, sedan, env, end).state.stuck).toBeUndefined();
  });
});

describe('runners', () => {
  const snowy = (degrees: number, depth = 0.5): VehicleEnvironment => ({
    groundHeight: slope(degrees),
    weather: { snowCover: snow(depth) },
  });

  it('slide downhill from rest under gravity and reach a terminal speed', () => {
    let peak = 0;
    const run = drive(30, coasting, skis, snowy(25), parked(), (r) => {
      peak = Math.max(peak, r.state.speed);
    });
    // 25 degrees: gravity 4.1 m/s² against 0.44 of friction and the air, about 106 km/h.
    expect(run.state.speed).toBeGreaterThan(26);
    expect(run.state.speed).toBeLessThan(33);
    expect(peak).toBeLessThanOrEqual(skis.maxSpeed);
    expect(run.state.grounded).toBe(true);
    // Three seconds in, it is already moving at a run: 3.7 m/s² net.
    expect(drive(3, coasting, skis, snowy(25)).state.speed).toBeGreaterThan(9);
    // Deep snow does not bog runners, and they are never stuck.
    expect(run.state.stuck).toBeUndefined();
    expect(run.state.snowDepth).toBeCloseTo(0.5, 6);
  });

  it('stand on a slope too gentle to beat their friction, and on any slope under the brake', () => {
    // tan(2°) = 0.035, under the 0.05 friction coefficient.
    const gentle = drive(5, coasting, skis, snowy(2));
    expect(gentle.state.speed).toBe(0);
    expect(gentle.transform.pos[2]).toBe(0);
    // A glide across it runs out instead of creeping on for ever.
    const glide = drive(40, coasting, skis, snowy(2), parked(3));
    expect(glide.state.speed).toBe(0);
    const held = drive(5, braking, skis, snowy(25));
    expect(held.state.speed).toBe(0);
    expect(held.transform.pos[2]).toBe(0);
  });

  it('stop on the brake from speed, on their edges', () => {
    const start = drive(8, coasting, skis, snowy(20));
    expect(start.state.speed).toBeGreaterThan(15);
    const stop = drive(12, braking, skis, snowy(20), start);
    expect(stop.state.speed).toBe(0);
  });

  it('are pushed along the flat only to a poling pace', () => {
    const poled = drive(20, floored, skis, snowy(0));
    expect(poled.state.speed).toBeGreaterThan(3);
    expect(poled.state.speed).toBeLessThanOrEqual(4.05);
  });

  it('scrape to a stop off the snow and will not slide there', () => {
    const bare: VehicleEnvironment = { groundHeight: slope(10) };
    expect(drive(5, coasting, skis, bare).state.speed).toBe(0);
    const scraped = drive(6, coasting, skis, { groundHeight: flat }, parked(8));
    expect(scraped.state.speed).toBe(0);
    expect(scraped.transform.pos[2]).toBeLessThan(15);
    // The same glide on snow carries on for a long way.
    expect(drive(6, coasting, skis, snowy(0), parked(8)).state.speed).toBeGreaterThan(4);
  });

  it('lie on a slope across them and hold a traverse on their edges', () => {
    // Ground falling away to the right (-X) at 20 degrees; the skis point across it.
    const grade = Math.tan((20 * Math.PI) / 180);
    const traverse: VehicleEnvironment = {
      groundHeight: (x) => x * grade,
      weather: { snowCover: snow(0.5) },
    };
    const end = drive(4, coasting, skis, traverse, parked(6));
    // Right side down is positive roll: the skis sit on the hill, not half buried in it.
    expect(end.state.roll).toBeCloseTo((20 * Math.PI) / 180, 2);
    // The edges hold: after 20 m along the hill it has slipped down it by less than a meter.
    expect(end.transform.pos[2]).toBeGreaterThan(15);
    expect(Math.abs(end.transform.pos[0])).toBeLessThan(1);
    // A wheeled cycle on the same hill still balances upright on its tire line.
    expect(drive(2, coasting, skateboard, traverse, parked(3)).state.roll).toBe(0);
  });

  it('turn across the fall line and lose their speed', () => {
    const start = drive(6, coasting, skis, snowy(20));
    const turned = drive(
      6,
      () => ({ throttle: 0, steering: 1, brake: false }),
      skis,
      snowy(20),
      start,
    );
    expect(Math.abs(turned.state.yaw)).toBeGreaterThan(1);
    expect(turned.state.speed).toBeLessThan(start.state.speed);
  });
});
