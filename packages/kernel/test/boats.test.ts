import type { BoatSpec } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  type BoatEnvironment,
  BoatInput,
  BoatState,
  boatSupport,
  driveBoat,
  initialBoatState,
  installBoats,
  sampleWaves,
  stepBoat,
} from '../src/boats';
import { Transform, type TransformData } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { Mounted, mountEntity, unmountEntity, vehicleLocalPoint } from '../src/vehicles';
import { World } from '../src/world';

const spec: BoatSpec = {
  label: 'Launch',
  width: 2,
  length: 6,
  height: 2,
  draft: 0.5,
  mass: 1200,
  thrust: 3600,
  maxSpeed: 14,
  reverseSpeed: 3,
  turnRate: 0.5,
  turnResponse: 1,
  lateralDrag: 2,
  buoyancyFrequency: 1.2,
  driverEye: [0.5, 1.2, 0],
};
const flat: BoatEnvironment = { waterAt: () => ({ height: 0, depth: 20 }) };
const transform: TransformData = { pos: [0, 0, 0], rot: [0, 0, 0, 1] };
function setup(env: BoatEnvironment = flat) {
  const w = new World({ tickRate: 60, seed: 'boats' });
  installBoats(w, env);
  w.spawnRaw(
    {
      transform,
      boat: {
        kind: 'test.boat',
        spec,
        visual: { wheelNodes: [], frontWheelNodes: [], paintMaterial: 'hull' },
      },
      boatState: initialBoatState(),
      mountable: {
        seats: [
          { id: 'driver', role: 'driver', position: [0.5, 1.2, 0] },
          { id: 'guest', role: 'passenger', position: [-0.5, 1.2, 0] },
        ],
        entries: [[1.5, 1, 0]],
        exits: [
          [2, 0.5, 0],
          [-2, 0.5, 0],
        ],
        reach: 3,
      },
    },
    'boat',
  );
  for (const id of ['driver', 'guest', 'other'])
    w.spawnRaw({ transform: { pos: [1, 1, 0], rot: [0, 0, 0, 1] } }, id);
  return w;
}
const full = { throttle: 1, steering: 0, anchor: false };
function run(input = full, env = flat, seconds = 5) {
  const w = setup(env);
  expect(mountEntity(w, 'driver', 'boat')).toBe(true);
  driveBoat(w, 'driver', input);
  w.stepN(seconds * 60);
  return w;
}

describe('boats', () => {
  it('accelerates forward, reverses and turns with momentum', () => {
    const w = run();
    const speed = w.get('boat', BoatState)?.speed ?? 0;
    expect(speed).toBeGreaterThan(8);
    expect(speed).toBeLessThan(spec.maxSpeed);
    expect(w.get('boat', Transform)?.pos[2]).toBeGreaterThan(25);
    driveBoat(w, 'driver', { ...full, throttle: 0 });
    w.stepN(30);
    expect(w.get('boat', BoatState)?.speed).toBeGreaterThan(speed * 0.7);
    const reverse = run({ ...full, throttle: -1 });
    expect(reverse.get('boat', Transform)?.pos[2]).toBeLessThan(-5);
    expect(run({ ...full, steering: 1 }).get('boat', Transform)?.pos[0]).toBeLessThan(-3);
    expect(run({ ...full, throttle: 0, steering: 1 }).get('boat', BoatState)?.yaw).toBe(0);
  });
  it('only lets the driver control the helm and carries passengers through the full hull rotation', () => {
    const w = setup({
      ...flat,
      conditions: { waves: [{ amplitude: 0.6, wavelength: 15, direction: 0.6, speed: 3 }] },
    });
    expect(mountEntity(w, 'driver', 'boat')).toBe(true);
    expect(mountEntity(w, 'guest', 'boat', 'guest')).toBe(true);
    expect(mountEntity(w, 'other', 'boat', 'guest')).toBe(false);
    expect(driveBoat(w, 'guest', full)).toBe(false);
    expect(driveBoat(w, 'driver', full)).toBe(true);
    w.stepN(60);
    const t = w.get('boat', Transform) as TransformData;
    expect(w.get('guest', Transform)?.pos).toEqual(vehicleLocalPoint(t, [-0.5, 1.2, 0]));
    expect(Math.abs(w.get('boat', BoatState)?.pitch ?? 0)).toBeGreaterThan(0.005);
    expect(unmountEntity(w, 'guest', { groundHeight: () => 0.5 })).toBe(false);
  });
  it('checks all hull corners for shores and measured shallow water, pauses on missing tiles', () => {
    expect(
      boatSupport({ waterAt: (x) => (x > 0.8 ? null : { height: 0 }) }, 0, 0, 0, spec).grounded,
    ).toBe(true);
    expect(
      boatSupport({ waterAt: () => ({ height: 0, depth: 0.2 }) }, 0, 0, 0, spec).grounded,
    ).toBe(true);
    const w = run(full, { waterAt: (_x, z) => (z > 10 ? null : { height: 0 }) });
    expect(w.get('boat', Transform)?.pos[2]).toBeLessThan(7.4);
    expect(w.get('boat', BoatState)?.grounded).toBe(true);
    const result = stepBoat(transform, initialBoatState(), full, spec, 1, {
      waterAt: () => undefined,
    });
    expect(result.transform.pos).toEqual(transform.pos);
    expect(result.state.waitingForWater).toBe(true);
  });
  it('drifts in current until anchored; a moving hull cannot drop anchor or board', () => {
    const env = { ...flat, conditions: { current: [2, 0] as [number, number] } };
    const w = run({ ...full, throttle: 0 }, env);
    expect(w.get('boat', Transform)?.pos[0]).toBeGreaterThan(7);
    expect(mountEntity(w, 'guest', 'boat', 'guest')).toBe(false);
    driveBoat(w, 'driver', { ...full, throttle: 0, anchor: true });
    w.stepN(1);
    expect(w.get('boat', BoatState)?.anchored).toBe(false);
    const moored = run({ throttle: 0, steering: 0, anchor: true }, env);
    expect(moored.get('boat', Transform)?.pos).toEqual([0, 0, 0]);
  });
  it('allows dry dock exits at deck level and leaves the helm alone when a passenger alights', () => {
    const w = setup();
    mountEntity(w, 'driver', 'boat');
    mountEntity(w, 'guest', 'boat', 'guest');
    expect(unmountEntity(w, 'guest', { groundHeight: () => undefined })).toBe(false);
    const before = w.get('boat', BoatInput);
    expect(unmountEntity(w, 'guest', { groundHeight: () => 0.5, canExit: (p) => p[0] > 0 })).toBe(
      true,
    );
    expect(w.get('boat', BoatInput)).toEqual(before);
    expect(w.get('guest', Mounted)).toBeUndefined();
    expect(w.get('guest', Transform)?.pos).toEqual([2, 0.52, 0]);
  });
  it('resumes exactly from a keyframe with waves, current, seats and input', () => {
    const env = {
      ...flat,
      conditions: {
        current: [0.3, -0.2] as [number, number],
        waves: [{ amplitude: 0.3, wavelength: 20, direction: 1, speed: 3 }],
      },
    };
    const w = run({ ...full, steering: 0.2 }, env, 2);
    const frame = takeKeyframe(w);
    w.stepN(180);
    const restored = setup(env);
    applyKeyframeTo(restored, frame);
    restored.stepN(180);
    expect(stateHash(restored)).toBe(stateHash(w));
    expect(sampleWaves(env.conditions, 12, 6, 9)).toEqual(sampleWaves(env.conditions, 12, 6, 9));
  });
});
