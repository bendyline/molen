import { readFileSync } from 'node:fs';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import {
  driveVehicle,
  installVehicles,
  mountEntity,
  unmountEntity,
  type VehicleEnvironment,
  VehicleState,
  type VehicleStateData,
} from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
import type { SnowCoverData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { MOLEN_CYCLE_ENTITY_IDS, MOLEN_VEHICLE_ENTITY_IDS, molenVehicle } from '../src/index';

const types = createTypeLibrary(
  ['vehicle', 'cycle'].map((name) =>
    JSON.parse(
      readFileSync(
        new URL(`../../../content/entities/types/${name}.types.json`, import.meta.url),
        'utf8',
      ),
    ),
  ),
);
const SKIS = 'molen.entities.cycle.skis';
const SNOWBOARD = 'molen.entities.cycle.snowboard';
const SLED = 'molen.entities.vehicle.snowmobile';
const SEDAN = 'molen.entities.vehicle.sedan';
/** Ground falling away ahead (+Z) at `degrees`. */
const hill = (degrees: number): VehicleEnvironment => {
  const grade = Math.tan((degrees * Math.PI) / 180);
  return { groundHeight: (_x, z) => -z * grade };
};
/** A world with one vehicle and its rider aboard, under an even snow cover (or none). */
function ride(id: string, env: VehicleEnvironment, depth?: number): World {
  const w = new World({ tickRate: 60, seed: 'snow' });
  installVehicles(w, env);
  if (depth !== undefined) {
    const snowCover: SnowCoverData = {
      level: -100_000,
      transition: 0,
      depth,
      depthGain: 0,
      maxDepth: 10,
    };
    w.spawnRaw({ weather: { snowCover } }, 'weather');
  }
  w.spawnRaw(types.components(id), 'ride');
  w.spawnRaw({ transform: { pos: [0.6, 0, 0], rot: [0, 0, 0, 1] } }, 'rider');
  expect(mountEntity(w, 'rider', 'ride')).toBe(true);
  return w;
}
const state = (w: World): VehicleStateData => w.get('ride', VehicleState) as VehicleStateData;
const travelled = (w: World): number => w.get('ride', Transform)?.pos[2] ?? 0;
const coast = { throttle: 0, steering: 0, brake: false };
const power = { throttle: 1, steering: 0, brake: false };

describe('snow rides', () => {
  it('are in the catalog with runners and no place in traffic or parking', () => {
    expect(MOLEN_CYCLE_ENTITY_IDS).toContain(SKIS);
    expect(MOLEN_CYCLE_ENTITY_IDS).toContain(SNOWBOARD);
    expect(MOLEN_VEHICLE_ENTITY_IDS).toContain(SLED);
    for (const id of [SKIS, SNOWBOARD, SLED]) {
      const { spec, visual } = molenVehicle(types, id);
      expect(spec.runners, id).toBeDefined();
      expect(visual.wheelNodes, id).toEqual([]);
    }
    expect(molenVehicle(types, SKIS).spec.cycle?.stance).toBe('standing');
    expect(molenVehicle(types, SKIS).spec.runners?.flat).toBe(true);
    expect(molenVehicle(types, SNOWBOARD).spec.cycle).toMatchObject({
      stance: 'sideways',
      kick: { stride: 2.4 },
    });
    // The sled drives on the car solver with handlebars, and only a regional fleet could park it.
    const sled = molenVehicle(types, SLED).spec;
    expect(sled.cycle).toBeUndefined();
    expect(sled.handlebar).toBeDefined();
    expect(types.components(SLED).ambientRole).toMatchObject({ role: 'car', weight: 0 });
    for (const id of [SKIS, SNOWBOARD]) expect(types.components(id).ambientRole).toBeUndefined();
  });

  it.each([
    [SKIS, 104],
    [SNOWBOARD, 97],
  ])('%s slides down a snowy 25 degree slope under gravity and stops on its edges', (id, kmh) => {
    const w = ride(id, hill(25), 0.6);
    driveVehicle(w, 'rider', coast);
    w.stepN(60 * 3);
    // Three seconds from a stand: already faster than a sprint.
    expect(state(w).speed).toBeGreaterThan(9);
    w.stepN(60 * 37);
    // Terminal speed, where the air and the snow's friction balance the slope.
    const top = state(w).speed * 3.6;
    expect(top).toBeGreaterThan(kmh - 8);
    expect(top).toBeLessThan(kmh + 8);
    expect(state(w).grounded).toBe(true);
    expect(Math.abs(state(w).yaw)).toBeLessThan(0.01);
    expect(state(w).snowDepth).toBeCloseTo(0.6, 6);
    // Still moving: the rider cannot step off.
    expect(unmountEntity(w, 'rider', hill(25))).toBe(false);
    driveVehicle(w, 'rider', { throttle: 0, steering: 0, brake: true });
    w.stepN(60 * 14);
    expect(state(w).speed).toBe(0);
    const stopped = travelled(w);
    w.stepN(120);
    expect(travelled(w)).toBe(stopped);
    expect(unmountEntity(w, 'rider', hill(25))).toBe(true);
  });

  it('carves the skis across the hill and loses speed doing it', () => {
    const w = ride(SKIS, hill(20), 0.6);
    driveVehicle(w, 'rider', coast);
    w.stepN(60 * 6);
    const before = state(w);
    driveVehicle(w, 'rider', { throttle: 0, steering: 1, brake: false });
    w.stepN(60 * 6);
    const after = state(w);
    expect(Math.abs(after.yaw - before.yaw)).toBeGreaterThan(1);
    expect(after.speed).toBeLessThan(before.speed);
    // The lean is the rider's: the skis themselves stay flat on the snow.
    expect(Math.abs(after.bodyRoll ?? 0)).toBeLessThanOrEqual(0.6 + 0.03);
  });

  it('poles the skis along the flat to a walking pace, and scrapes them to a stop on bare ground', () => {
    const snow = ride(SKIS, hill(0), 0.3);
    driveVehicle(snow, 'rider', power);
    snow.stepN(60 * 20);
    expect(state(snow).speed).toBeGreaterThan(3.5);
    expect(state(snow).speed).toBeLessThanOrEqual(4.55);
    const bare = ride(SKIS, hill(0));
    driveVehicle(bare, 'rider', power);
    bare.stepN(60 * 5);
    // Poling cannot beat the scrape of bare ground, and a slope there does not start them.
    expect(travelled(bare)).toBeLessThan(0.5);
    const slope = ride(SKIS, hill(12));
    driveVehicle(slope, 'rider', coast);
    slope.stepN(60 * 5);
    expect(state(slope).speed).toBe(0);
  });

  it('takes the snowmobile through snow that holds a sedan fast', () => {
    const deep = 0.5;
    const sled = ride(SLED, hill(0), deep);
    driveVehicle(sled, 'rider', power);
    sled.stepN(60 * 8);
    expect(state(sled).speed * 3.6).toBeGreaterThan(80);
    expect(state(sled).stuck).toBeUndefined();
    const sedan = ride(SEDAN, hill(0), deep);
    driveVehicle(sedan, 'rider', power);
    sedan.stepN(60 * 8);
    expect(travelled(sedan)).toBe(0);
    expect(state(sedan).stuck).toBe(true);
    // The sled brakes, backs up, and on bare pavement still gets along slowly.
    driveVehicle(sled, 'rider', { throttle: 0, steering: 0, brake: true });
    sled.stepN(60 * 8);
    expect(state(sled).speed).toBe(0);
    driveVehicle(sled, 'rider', { throttle: -1, steering: 0, brake: false });
    sled.stepN(60 * 3);
    expect(state(sled).speed).toBeLessThan(-1);
    const road = ride(SLED, hill(0));
    driveVehicle(road, 'rider', power);
    road.stepN(60 * 8);
    expect(state(road).speed).toBeGreaterThan(5);
    expect(state(road).speed).toBeLessThan(state(sled).speed + 40);
  });
});
