import { AircraftState } from '@bendyline/molen-kernel/aircraft';
import { Mounted } from '@bendyline/molen-kernel/vehicles';
import { World } from '@bendyline/molen-kernel/world';
import type { AircraftStateData } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { createEarthAudio } from '../src/client/audio';
import { ENTITY_TYPES } from './entity-types';

const bank = {
  format: 'molen/soundbank@1',
  id: 'molen.sounds',
  sounds: Object.fromEntries(
    [
      'vehicle.engine.car',
      'vehicle.engine.diesel',
      'aircraft.engine.helicopter',
      'vehicle.engine.start',
      'vehicle.engine.stop',
      'vehicle.door.open',
      'vehicle.door.close',
      'aircraft.engine.piston',
      'ambience.wind',
      'ambience.birds',
      'ambience.city.traffic',
      'ambience.crickets',
    ].map((id) => [id, { clips: [`${id}.mp3`], source: { license: 'CC0-1.0' } }]),
  ),
};

const packs = {
  provided: () => [{ pack: { manifest: { id: 'molen.sounds' } }, path: 'sounds.soundbank.json' }],
  readJson: async <T>() => bank as T,
  assetProvider: () => ({
    load: async () => new ArrayBuffer(0),
    loadText: async () => '',
  }),
};
const renderer = {
  camera: { matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0, 1] } },
  getWorldOrigin: () => [0, 0, 0],
};

describe('createEarthAudio', () => {
  it('is silent without a sound bank', async () => {
    const empty = { ...packs, provided: () => [] };
    expect(await createEarthAudio(empty, renderer)).toBeUndefined();
  });

  it('fades birds and traffic with height above the ground and distance from the street', async () => {
    const audio = await createEarthAudio(packs, renderer, { onWarning: () => {} });
    if (!audio) throw new Error('no audio');
    const world = new World({ tickRate: 60 });
    world.spawnRaw(
      { transform: { pos: [5, 0, 0], rot: [0, 0, 0, 1] }, vehicle: {} as never },
      'parked-1',
    );
    audio.attachWorld(world);
    const gains = (nowMs: number, heightAboveGround: number, x = 0) => {
      audio.update({ nowMs, mode: 'walk', position: [x, heightAboveGround, 0], heightAboveGround });
      return Object.fromEntries(audio.layer.director.voices().map((v) => [v.sound, v.gain]));
    };
    const street = gains(0, 1.7);
    expect(street['ambience.city.traffic']).toBeGreaterThan(0.4);
    expect(street['ambience.birds']).toBeGreaterThan(0.2);
    const above = gains(300, 60);
    expect(above['ambience.city.traffic']).toBeLessThan(street['ambience.city.traffic'] as number);
    expect(above['ambience.birds']).toBeLessThan(street['ambience.birds'] as number);
    const high = gains(600, 600);
    expect(high['ambience.city.traffic']).toBeUndefined();
    expect(high['ambience.birds']).toBeUndefined();
    // Far from any street, on the ground: birds at full voice, no traffic.
    const field = gains(900, 1.7, 400);
    expect(field['ambience.city.traffic']).toBeUndefined();
    expect(field['ambience.birds']).toBeCloseTo(0.7);
    audio.dispose();
  });

  it('runs the engines the entity types declare: cars while driven, aircraft by rpm', async () => {
    const audio = await createEarthAudio(packs, renderer, { onWarning: () => {} });
    if (!audio) throw new Error('no audio');
    const world = new World({ tickRate: 60 });
    const at = (id: string, pos: [number, number, number]) => {
      const components = ENTITY_TYPES.components(id);
      components.transform = { pos, rot: [0, 0, 0, 1] };
      return components;
    };
    world.spawnRaw(at('molen.entities.vehicle.sedan', [3, 0, 0]), 'car-1');
    world.spawnRaw(at('molen.entities.vehicle.van', [-3, 0, 0]), 'van-1');
    world.spawnRaw(at('molen.entities.aircraft.p51d', [9, 0, 0]), 'aircraft-p51d');
    world.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'world-player');
    audio.attachWorld(world);
    const playing = (nowMs: number) => {
      audio.update({ nowMs, mode: 'walk', position: [0, 1.7, 0] });
      return audio.layer.director.voices().map((v) => `${v.sound}@${v.entity}`);
    };
    // Parked cars and a cold aircraft are silent.
    expect(playing(0).filter((v) => v.includes('engine'))).toEqual([]);
    world.set('world-player', Mounted, { vehicle: 'car-1', seat: 'driver' });
    playing(100);
    expect(playing(500)).toContain('vehicle.engine.car@car-1');
    expect(playing(600)).not.toContain('vehicle.engine.diesel@van-1');
    world.set('aircraft-p51d', AircraftState, {
      ...(world.get('aircraft-p51d', AircraftState) as AircraftStateData),
      rpm: 0.6,
    });
    expect(playing(700)).toContain('aircraft.engine.piston@aircraft-p51d');
    world.remove('world-player', Mounted);
    playing(800);
    expect(playing(2000)).not.toContain('vehicle.engine.car@car-1');
    audio.dispose();
  });
});
