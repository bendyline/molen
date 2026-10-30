import { type AudioLayer, createAudioLayer } from '@bendyline/molen-client/audio';
import { AircraftState, initialAircraftState } from '@bendyline/molen-kernel/aircraft';
import { initialVehicleState, Mounted, VehicleState } from '@bendyline/molen-kernel/vehicles';
import { Transform, World } from '@bendyline/molen-kernel/world';
import { describe, expect, it, vi } from 'vitest';
import { VehicleAudio } from '../src/client/vehicle-audio';

const sounds = new Set([
  'aircraft.touchdown.tire',
  'vehicle.wiper.sweep',
  'vehicle.door.slide',
  'vehicle.door.open',
  'vehicle.door.close',
  'vehicle.engine.start',
  'vehicle.engine.stop',
  'aircraft.flaps.motor',
  'aircraft.gear.motor',
]);
function fixture() {
  const play = vi.fn(
    (_sound: string, _options: unknown): string => `voice-${play.mock.calls.length}`,
  );
  const stop = vi.fn();
  const audio = new VehicleAudio({ play, stop } as unknown as AudioLayer, sounds);
  const world = new World({ tickRate: 60 });
  world.spawnRaw(
    {
      transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
      vehicle: {
        spec: {
          bodyStyle: 'van',
          actuators: {
            doorFrontLeft: { seconds: 1.2 },
            doorRearRight: { seconds: 1.2 },
            wipers: { seconds: 1.4, mode: 'cycle' },
          },
        },
      },
      vehicleState: initialVehicleState(),
      audioSource: { sound: 'vehicle.engine.car' },
      mountable: {
        seats: [
          { id: 'driver', role: 'driver' },
          { id: 'guest', role: 'passenger' },
        ],
      },
    } as never,
    'car',
  );
  const advance = (now: number, positions: Record<string, number>) => {
    world.patch('car', VehicleState, { actuators: positions });
    audio.update(world, now, () => 'concrete');
  };
  return { play, stop, audio, world, advance };
}

describe('vehicle foley transitions', () => {
  function motorFixture(model = 'airplane', fixedGear = false, seconds = 4) {
    const f = fixture();
    f.world.spawnRaw(
      {
        transform: { pos: [10, 5, 0], rot: [0, 0, 0, 1] },
        aircraft: {
          spec: {
            model,
            [model]: { fixedGear, gearTransitTime: seconds, flapTransitTime: seconds },
          },
        },
        aircraftState: { ...initialAircraftState(), gearPosition: 1, flapPosition: 0 },
      } as never,
      'plane',
    );
    const step = (at: number, gearPosition: number, flapPosition: number) => {
      f.world.patch('plane', AircraftState, { gearPosition, flapPosition });
      f.audio.update(f.world, at, () => undefined);
    };
    step(0, 1, 0);
    return { ...f, step };
  }

  it('loops independent flap/gear motors through travel and reversal, then stops at a detent or lock', () => {
    const { play, stop, audio, world, step } = motorFixture();
    expect(play).not.toHaveBeenCalled();
    step(16, 0.9, 0.1);
    expect(play.mock.calls).toEqual([
      ['aircraft.gear.motor', { entity: 'plane', loop: true }],
      ['aircraft.flaps.motor', { entity: 'plane', loop: true }],
    ]);
    audio.update(world, 24, () => undefined); // Same snapshot between simulation ticks.
    step(32, 0.8, 0.2);
    step(48, 0.85, 0.25); // Reverse the gear without stacking a second loop.
    expect(play).toHaveBeenCalledTimes(2);
    expect(stop).not.toHaveBeenCalled();
    step(64, 0.9, 0.25); // A partial flap detent is stationary.
    expect(stop).toHaveBeenCalledWith('voice-2', 0.08);
    expect(stop).not.toHaveBeenCalledWith('voice-1', 0.08);
    step(80, 1, 0.25);
    expect(stop).toHaveBeenCalledWith('voice-1', 0.08);
    step(96, 1, 0.2); // Retracting the flaps starts a fresh loop.
    expect(play).toHaveBeenCalledTimes(3);
    step(112, 1, 0);
    expect(stop).toHaveBeenCalledWith('voice-3', 0.08);
  });

  it('stops motor loops on stale snapshots, teleports, removal and world detachment', () => {
    for (const reason of ['stale', 'teleport', 'removed', 'detach', 'clear', 'gap']) {
      const { audio, world, step, stop } = motorFixture();
      step(16, 0.9, 0.1);
      if (reason === 'stale') audio.update(world, 200, () => undefined);
      if (reason === 'teleport') {
        world.patch('plane', Transform, { pos: [10000, 5, 0] });
        step(32, 0.8, 0.2);
      }
      if (reason === 'removed') {
        world.destroy('plane');
        audio.update(world, 32, () => undefined);
      }
      if (reason === 'detach') audio.update(undefined, 32, () => undefined);
      if (reason === 'clear') audio.clear();
      if (reason === 'gap') step(1000, 0.8, 0.2);
      expect(stop, reason).toHaveBeenCalledTimes(2);
    }
  });

  it('keeps fixed/instant gear silent but supports retractable helicopter gear', () => {
    const fixed = motorFixture('airplane', true);
    fixed.step(16, 0.8, 0);
    expect(fixed.play).not.toHaveBeenCalled();
    const instant = motorFixture('airplane', false, 0);
    instant.step(16, 0.8, 0.2);
    expect(instant.play).not.toHaveBeenCalled();
    const helicopter = motorFixture('helicopter');
    helicopter.step(16, 0.8, 0.2);
    expect(helicopter.play.mock.calls.map(([sound]) => sound)).toEqual(['aircraft.gear.motor']);
  });

  it('reconciles motor handles into spatial loop voices and removes them when travel ends', () => {
    const { world } = motorFixture();
    const layer = createAudioLayer({
      banks: [
        {
          format: 'molen/soundbank@1',
          id: 'motors',
          sounds: Object.fromEntries(
            ['aircraft.flaps.motor', 'aircraft.gear.motor'].map((id) => [
              id,
              { clips: ['motor.mp3'], loop: true, bus: 'sfx', spatial: { maxDistance: 55 } },
            ]),
          ),
        },
      ],
      suspendWhenHidden: false,
    });
    layer.attachWorld(world);
    const audio = new VehicleAudio(layer, sounds);
    const frame = (now: number) => {
      audio.update(world, now, () => undefined);
      layer.update(now, { position: [10, 5, 0] });
    };
    frame(0);
    world.patch('plane', AircraftState, { gearPosition: 0.9, flapPosition: 0.1 });
    frame(16);
    expect(
      layer.director
        .voices()
        .map((v) => v.sound)
        .sort(),
    ).toEqual(['aircraft.flaps.motor', 'aircraft.gear.motor']);
    world.patch('plane', AircraftState, { gearPosition: 0, flapPosition: 1 });
    frame(32);
    expect(layer.director.voices()).toHaveLength(0);
    audio.clear();
    layer.dispose();
  });

  it('speaks on door travel/latching and each wiper half-cycle, never repeated render frames', () => {
    const { advance, play } = fixture();
    advance(0, {});
    advance(16, { doorFrontLeft: 0.1, doorRearRight: 0.1, wipers: 0.1 });
    expect(play.mock.calls.map(([id]) => id)).toEqual([
      'vehicle.door.open',
      'vehicle.door.slide',
      'vehicle.wiper.sweep',
    ]);
    play.mockClear();
    advance(24, { doorFrontLeft: 0.1, doorRearRight: 0.1, wipers: 0.1 });
    advance(32, { doorFrontLeft: 0.2, doorRearRight: 0.2, wipers: 0.2 });
    expect(play).not.toHaveBeenCalled();
    advance(160, { doorFrontLeft: 0.3, doorRearRight: 0.3, wipers: 0.6 });
    expect(play.mock.calls.map(([id]) => id)).toEqual(['vehicle.wiper.sweep']);
    play.mockClear();
    advance(200, { doorFrontLeft: 0.2, doorRearRight: 0.2, wipers: 0.7 });
    expect(play.mock.calls.map(([id]) => id)).toEqual(['vehicle.door.slide']);
    play.mockClear();
    advance(300, { doorFrontLeft: 0, doorRearRight: 0, wipers: 0 });
    expect(play.mock.calls.map(([id]) => id)).toEqual(['vehicle.door.close', 'vehicle.door.close']);
    play.mockClear();
    advance(316, { doorFrontLeft: 0, doorRearRight: 0, wipers: 0 });
    expect(play).not.toHaveBeenCalled();
  });

  it('does not start or stop an engine for a passenger, or fabricate a door slam on an articulated car', () => {
    const { world, audio, play, advance } = fixture();
    world.spawnRaw({}, 'guest');
    world.spawnRaw({}, 'driver');
    advance(0, {});
    world.set('guest', Mounted, { vehicle: 'car', seat: 'guest' });
    audio.boarding(world, 'car', true, 'guest');
    expect(play).not.toHaveBeenCalled();
    world.set('driver', Mounted, { vehicle: 'car', seat: 'driver' });
    audio.boarding(world, 'car', true, 'driver');
    expect(play.mock.calls.map(([id]) => id)).toEqual(['vehicle.engine.start']);
    play.mockClear();
    world.remove('guest', Mounted);
    audio.boarding(world, 'car', false);
    expect(play).not.toHaveBeenCalled();
    world.remove('driver', Mounted);
    audio.boarding(world, 'car', false);
    expect(play.mock.calls.map(([id]) => id)).toEqual(['vehicle.engine.stop']);
  });

  it.each([
    'concrete',
    'grass',
    undefined,
  ])('chirps once on a rolling paved touchdown (%s), with bounce and parked-spawn guards', (surface) => {
    const { world, audio, play } = fixture();
    world.spawnRaw(
      {
        transform: { pos: [10, 0, 0], rot: [0, 0, 0, 1] },
        aircraft: { spec: { model: 'airplane' } },
        aircraftState: initialAircraftState(),
      } as never,
      'plane',
    );
    const step = (at: number, grounded: boolean) => {
      world.patch('plane', AircraftState, {
        grounded,
        velocity: [0, -2, 35],
        verticalSpeed: -2,
        gearPosition: 1,
        altitudeAGL: grounded ? 0 : 0.6,
      });
      audio.update(world, at, () => surface);
    };
    step(0, true);
    expect(play).not.toHaveBeenCalled();
    step(100, false);
    step(250, true);
    expect(play).toHaveBeenCalledTimes(surface === 'concrete' ? 1 : 0);
    step(300, false);
    step(400, true);
    step(450, true);
    expect(play).toHaveBeenCalledTimes(surface === 'concrete' ? 1 : 0);
    play.mockClear();
    step(600, false);
    world.patch('plane', Transform, { pos: [10000, 0, 0] });
    step(700, true);
    expect(play).not.toHaveBeenCalled();
    audio.clear();
    step(710, true);
    expect(play).not.toHaveBeenCalled();
  });

  it('keeps skids, retracted gear, crashes, terrain waits and slow taxi contacts quiet', () => {
    for (const [model, patch] of [
      ['helicopter', {}],
      ['airplane', { gearPosition: 0 }],
      ['airplane', { crashed: true }],
      ['airplane', { waitingForTerrain: true }],
      ['airplane', { velocity: [0, 0, 2] }],
    ] as const) {
      const { world, audio, play } = fixture();
      world.spawnRaw(
        {
          transform: { pos: [0, 0, 0] },
          aircraft: { spec: { model } },
          aircraftState: {
            ...initialAircraftState(),
            velocity: [0, -2, 35],
            verticalSpeed: -2,
            gearPosition: 1,
            ...patch,
            grounded: false,
            altitudeAGL: 2,
          },
        } as never,
        'plane',
      );
      audio.update(world, 0, () => 'concrete');
      world.patch('plane', AircraftState, { grounded: true });
      audio.update(world, 200, () => 'concrete');
      expect(play).not.toHaveBeenCalled();
    }
  });
});
