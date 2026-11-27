import type {
  AircraftEngineSpec,
  AircraftInputData,
  AircraftSpec,
  AircraftStateData,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  AircraftThrottleRamp,
  aircraftReheatDetent,
  aircraftThrottleReading,
  createAircraftExhaust,
  createAircraftVisual,
  IDLE_NOZZLE_OPENING,
  jetNozzleOpening,
  jetPlumeShape,
} from '../src/aircraft';

const JET: AircraftEngineSpec & { id: string } = {
  id: 'engine-1',
  position: [0, 2.18, -5.3],
  thrustAxis: [0, 0, 1],
  power: 1e7,
  idleRpm: 0.18,
  spoolRate: 0.2,
  rotorAngularSpeed: 150,
  propulsion: 'jet',
  dryThrust: 65200,
  afterburnerThrust: 105700,
  afterburnerDetent: 0.85,
};
/** rpm the jet reaches at its military-power detent. */
const MIL_RPM = 0.18 + 0.82 * 0.85;
const EXHAUST = {
  engine: 'engine-1',
  position: [0, 2.18, -6.35] as [number, number, number],
  radius: 0.57,
  closedRadius: 0.42,
};
const FIGHTER = {
  label: 'Test fighter',
  model: 'airplane',
  mass: 17500,
  span: 13,
  length: 19,
  height: 5.6,
  centerOfMass: [0, 2.3, 0],
  pilotEye: [0, 3.4, 6.8],
  hardLandingSpeed: 4,
  hardLandingRoll: 0.2,
  hardLandingPitch: 0.28,
  maxSupportStep: 0.5,
  collisionProbes: [[0, 2.3, 0]],
  engines: [JET],
  visual: { rotors: [], gearNodes: [], flaps: [], ailerons: [], exhausts: [EXHAUST] },
} as unknown as AircraftSpec;
const INPUT = {
  power: 1,
  pitch: 0,
  roll: 0,
  yaw: 0,
  gear: false,
  flaps: false,
  engine: true,
  brake: false,
} as AircraftInputData;
const flying = (rpm: number, afterburner: number): AircraftStateData =>
  ({
    rpm,
    rotorAngle: 0,
    airspeed: 150,
    mach: 0.45,
    velocity: [0, 0, 150],
    engines: {
      'engine-1': { rpm, rotorAngle: 0, failed: false, thrust: 60000, combustion: 1, afterburner },
    },
  }) as unknown as AircraftStateData;

describe('variable nozzle schedule', () => {
  it('stands open stopped and at idle, closes at military power and opens with reheat', () => {
    const at = (rpm: number, afterburner = 0) =>
      jetNozzleOpening(JET, { rpm, rotorAngle: 0, failed: false, thrust: 0, afterburner });
    expect(at(0)).toBeCloseTo(IDLE_NOZZLE_OPENING);
    expect(at(0.18)).toBeCloseTo(IDLE_NOZZLE_OPENING);
    expect(at(MIL_RPM)).toBe(0);
    expect(at(MIL_RPM, 0.4)).toBeCloseTo(0.4);
    expect(at(1, 1)).toBe(1);
    // Closing as the engine winds up.
    expect(at(0.5)).toBeLessThan(IDLE_NOZZLE_OPENING);
    expect(at(0.5)).toBeGreaterThan(at(0.65) ?? 1);
  });

  it('belongs only to afterburning jets', () => {
    expect(jetNozzleOpening({ ...JET, afterburnerThrust: undefined }, undefined)).toBeUndefined();
    expect(jetNozzleOpening({ ...JET, propulsion: 'propeller' }, undefined)).toBeUndefined();
  });
});

describe('afterburner flame', () => {
  const shape = (rpm: number, afterburner: number, nozzle: number, mach = 0.4, density = 1) =>
    jetPlumeShape(
      EXHAUST,
      JET,
      { rpm, rotorAngle: 0, failed: false, thrust: 0, combustion: 1, afterburner },
      nozzle,
      mach,
      density,
    );

  it('has no flame without reheat, only the hot tailpipe at military power', () => {
    const mil = shape(MIL_RPM, 0, 0);
    expect(mil.length).toBe(0);
    expect(mil.reheat).toBe(0);
    expect(mil.tailpipe).toBeCloseTo(1);
    expect(shape(0.18, 0, 0.8).tailpipe).toBe(0);
  });

  it('follows the nozzle between its closed and open exits', () => {
    expect(shape(MIL_RPM, 0, 0).exitRadius).toBeCloseTo(0.42);
    expect(shape(1, 1, 1).exitRadius).toBeCloseTo(0.57);
  });

  it('grows with reheat, in thin air, and spaces its diamonds by the jet Mach number', () => {
    const low = shape(1, 0.2, 0.2);
    const full = shape(1, 1, 1);
    expect(full.length).toBeGreaterThan(2 * low.length);
    // About 5.5 open-exit diameters at full reheat at sea level.
    expect(full.length / (2 * 0.57)).toBeCloseTo(5.5, 1);
    expect(shape(1, 1, 1, 0.4, 0.3).length).toBeGreaterThan(full.length);
    // A supersonic jet at full power has shock cells about one to two diameters apart, wider
    // apart in fast flight where ram pressure raises the nozzle pressure ratio.
    expect(full.jetMach).toBeGreaterThan(1.2);
    expect(full.cell / (2 * 0.57)).toBeGreaterThan(1);
    expect(full.cell / (2 * 0.57)).toBeLessThan(2.5);
    expect(shape(1, 1, 1, 1.4).cell).toBeGreaterThan(full.cell);
  });

  it('goes out with a failed engine', () => {
    const failed = jetPlumeShape(
      EXHAUST,
      JET,
      { rpm: 1, rotorAngle: 0, failed: true, thrust: 0, afterburner: 1 },
      1,
      0.4,
      1,
    );
    expect(failed.length).toBe(0);
    expect(failed.tailpipe).toBe(0);
  });
});

describe('flame mesh', () => {
  it('is absent for an aircraft that declares no exhausts', () => {
    const spec = { ...FIGHTER, visual: { ...FIGHTER.visual, exhausts: undefined } };
    expect(createAircraftExhaust(new THREE.Group(), spec as AircraftSpec)).toBeUndefined();
  });

  it('draws behind the exit with reheat lit, and hides when it goes out', () => {
    const model = new THREE.Group();
    const exhaust = createAircraftExhaust(model, FIGHTER);
    if (exhaust === undefined) throw new Error('no exhaust visual');
    expect(exhaust.object.parent).toBe(model);
    expect(exhaust.object.castShadow).toBe(false);
    const camera = new THREE.Vector3(-20, 4, -15);
    exhaust.update(flying(1, 1), { 'engine-1': 1 }, camera, 1, 3);
    expect(exhaust.object.visible).toBe(true);
    const position = exhaust.object.geometry.getAttribute('position');
    const color = exhaust.object.geometry.getAttribute('color');
    let lit = 0;
    let farthest = 0;
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getZ(i))).toBe(true);
      if (color.getX(i) + color.getY(i) + color.getZ(i) <= 0) continue;
      lit++;
      // Nothing lit ahead of the exit, beyond a glow disc's radius.
      expect(position.getZ(i)).toBeLessThan(-6.35 + 0.7);
      farthest = Math.min(farthest, position.getZ(i));
    }
    expect(lit).toBeGreaterThan(20);
    expect(farthest).toBeLessThan(-6.35 - 4);
    // Every lit vertex sits inside the fixed bounds the renderer culls by.
    const bounds = exhaust.object.geometry.boundingSphere;
    for (let i = 0; i < position.count; i++)
      if (color.getX(i) > 0)
        expect(bounds?.containsPoint(new THREE.Vector3().fromBufferAttribute(position, i))).toBe(
          true,
        );
    exhaust.update(flying(0.18, 0), { 'engine-1': 0.8 }, camera, 1, 3.1);
    expect(exhaust.object.visible).toBe(false);
  });

  it('is never hit by a ray, so cameras and pointers see through it', () => {
    const model = new THREE.Group();
    const exhaust = createAircraftExhaust(model, FIGHTER);
    exhaust?.update(flying(1, 1), { 'engine-1': 1 }, new THREE.Vector3(0, 2.2, -30), 1, 0);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 2.18, -30), new THREE.Vector3(0, 0, 1));
    model.updateMatrixWorld(true);
    expect(ray.intersectObject(model, true)).toHaveLength(0);
  });

  it('still draws for a camera parked at infinity, as hosts do to leave a cockpit out', () => {
    const model = new THREE.Group();
    const exhaust = createAircraftExhaust(model, FIGHTER);
    exhaust?.update(
      flying(1, 1),
      { 'engine-1': 1 },
      new THREE.Vector3(Infinity, Infinity, Infinity),
      1,
      0,
    );
    expect(exhaust?.object.visible).toBe(true);
    const position = exhaust?.object.geometry.getAttribute('position');
    for (let i = 0; i < (position?.count ?? 0); i++)
      expect(Number.isFinite(position?.getX(i))).toBe(true);
    // The camera that drew it then turns it.
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 30, -20);
    camera.updateMatrixWorld();
    exhaust?.object.onBeforeRender(
      {} as THREE.WebGLRenderer,
      new THREE.Scene(),
      camera,
      exhaust.object.geometry,
      exhaust.object.material as THREE.Material,
      null as unknown as THREE.Group,
    );
    exhaust?.update(flying(1, 1), { 'engine-1': 1 }, undefined, 1, 0.1);
    // Seen from above, the strips lie flat: their width runs across x.
    const xs = Array.from({ length: position?.count ?? 0 }, (_, i) => position?.getX(i) ?? 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.8);
  });

  it('is posed by the aircraft visual, which publishes each nozzle opening with an actuator lag', () => {
    const model = new THREE.Group();
    const visual = createAircraftVisual(model, FIGHTER);
    visual.updateView([-20, 4, -15]);
    visual.update(flying(0.18, 0), INPUT, 100, { airDensity: 1.2 }, 0);
    expect(visual.signals['engines.engine-1.nozzle']).toBeCloseTo(IDLE_NOZZLE_OPENING);
    visual.update(flying(1, 1), INPUT, 100, { airDensity: 1.2 }, 0.1);
    const moving = visual.signals['engines.engine-1.nozzle'] ?? 0;
    expect(moving).toBeGreaterThan(IDLE_NOZZLE_OPENING);
    expect(moving).toBeLessThan(1);
    visual.update(flying(1, 1), INPUT, 100, { airDensity: 1.2 }, 5);
    expect(visual.signals['engines.engine-1.nozzle']).toBeCloseTo(1, 3);
    expect(model.getObjectByName('aircraft-exhaust-flames')?.visible).toBe(true);
    visual.dispose();
  });
});

describe('throttle past military power', () => {
  it('reads 0–100% to the detent, MIL at it and the reheat range beyond', () => {
    expect(aircraftReheatDetent(FIGHTER)).toBe(0.85);
    expect(aircraftThrottleReading(FIGHTER, 0.425).label).toBe('50%');
    expect(aircraftThrottleReading(FIGHTER, 0.85).label).toBe('MIL');
    const half = aircraftThrottleReading(FIGHTER, 0.925);
    expect(half.label).toBe('AB 50%');
    expect(half.dry).toBe(1);
    expect(half.reheat).toBeCloseTo(0.5);
    const plain = { ...FIGHTER, engines: [{ ...JET, afterburnerThrust: undefined }] };
    expect(aircraftReheatDetent(plain as AircraftSpec)).toBeUndefined();
    expect(aircraftThrottleReading(plain as AircraftSpec, 1).label).toBe('100%');
  });

  it('catches a held push at the detent; a fresh push carries on into reheat', () => {
    const ramp = new AircraftThrottleRamp();
    let lever = 0.5;
    for (let i = 0; i < 20; i++) lever = ramp.step(lever, 0.05, 0.85);
    expect(lever).toBe(0.85);
    expect(ramp.caught).toBe(true);
    lever = ramp.step(lever, 0, 0.85);
    expect(ramp.caught).toBe(false);
    for (let i = 0; i < 20; i++) lever = ramp.step(lever, 0.05, 0.85);
    expect(lever).toBe(1);
    // Pulling back passes the detent freely.
    lever = ramp.step(lever, 0, 0.85);
    for (let i = 0; i < 10; i++) lever = ramp.step(lever, -0.05, 0.85);
    expect(lever).toBeCloseTo(0.5);
    // Without an afterburner a held push runs to the stop.
    const plain = new AircraftThrottleRamp();
    let other = 0.5;
    for (let i = 0; i < 20; i++) other = plain.step(other, 0.05, undefined);
    expect(other).toBe(1);
  });
});
