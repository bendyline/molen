import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type ConsoleVehicleSubject, vehicleDeck } from '../src/console';
import {
  createSpeedometerView,
  SPEEDOMETER_SWEEP,
  speedometerScale,
  type VehicleVisual,
} from '../src/vehicles';

describe('speedometer scale', () => {
  it('numbers past the top speed in a step a real dial uses, eight intervals at most', () => {
    // An e-moped tops out at 13.5 m/s: about 30 mph, 49 km/h.
    expect(speedometerScale(13.5, 'mph')).toEqual({ full: 35, step: 5 });
    expect(speedometerScale(13.5, 'km/h')).toEqual({ full: 60, step: 10 });
    // A compact car's 51 m/s reads to 140 mph, like the real thing.
    expect(speedometerScale(51, 'mph')).toEqual({ full: 140, step: 20 });
    // A supercar's 93.5 m/s still fits eight numerals.
    expect(speedometerScale(93.5, 'km/h')).toEqual({ full: 400, step: 50 });
    // Slow things count in twos: a skateboard, a sailboat in knots.
    expect(speedometerScale(5.5, 'mph')).toEqual({ full: 16, step: 2 });
    expect(speedometerScale(5.2, 'kt')).toEqual({ full: 12, step: 2 });
  });
});

describe('speedometer view', () => {
  const needle = (view: ReturnType<typeof createSpeedometerView>): number =>
    view.scene.getObjectByName('speedometer-needle')?.rotation.z ?? Number.NaN;

  it('turns its needle clockwise from half past seven to half past four', () => {
    let speed = 0;
    const view = createSpeedometerView({ maxSpeed: 13.5, unit: 'mph', speed: () => speed });
    expect(view.kind).toBe('speed');
    expect(view.unit).toBe('mph');
    view.sync();
    expect(needle(view)).toBeCloseTo(SPEEDOMETER_SWEEP / 2);
    // Halfway up the face (17.5 mph) points straight up.
    speed = 17.5 / 2.2369362920544025;
    view.sync();
    expect(needle(view)).toBeCloseTo(0);
    // Reversing reads forward; past full scale the needle rests on its stop.
    speed = -17.5 / 2.2369362920544025;
    view.sync();
    expect(needle(view)).toBeCloseTo(0);
    speed = 100;
    view.sync();
    expect(needle(view)).toBeCloseTo(-SPEEDOMETER_SWEEP / 2);
    view.dispose();
  });

  it('reads nothing as zero', () => {
    const view = createSpeedometerView({ maxSpeed: 40, unit: 'km/h', speed: () => undefined });
    expect(needle(view)).toBeCloseTo(SPEEDOMETER_SWEEP / 2);
    expect(view.camera).toBeInstanceOf(THREE.OrthographicCamera);
    view.dispose();
  });
});

describe('vehicle deck speedometer', () => {
  const subject = (extra: Partial<ConsoleVehicleSubject>): ConsoleVehicleSubject => ({
    kind: 'vehicle',
    visual: { object: new THREE.Group(), signals: { speed: 5 } } as unknown as VehicleVisual,
    data: { spec: { maxSpeed: 13.5, cycle: {} }, visual: {} } as ConsoleVehicleSubject['data'],
    ...extra,
  });
  const context = { setAction: () => {}, mirror: false };

  it('puts a dial of the kit between the handlebars and the brake, shown with the gauges', () => {
    const items = vehicleDeck(subject({ speedUnit: 'mph' }), context);
    const speed = items.find((item) => item.id === 'speed');
    expect(speed).toMatchObject({ side: 'middle', gauge: true });
    const part = speed?.part?.();
    expect(part?.mask).toBe('circle');
    expect(part?.scene.getObjectByName('speedometer-needle')).toBeDefined();
    expect(part?.pose({})).toBe(true);
    expect(part?.pose({})).toBe(false);
    part?.dispose();
  });
});
