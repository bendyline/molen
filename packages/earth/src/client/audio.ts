// The Earth soundscape: ambience from weather, time of day and how the viewer moves, footsteps on
// foot, city traffic near streets, and door and starter sounds when the player boards a car. The
// engines themselves are data on the molen.entities vehicle and aircraft types. Shared by
// `mountEarthView` and hosts that compose their own view (the world explorer). It reads sound
// banks from content packs (`provides.soundbank`); without one it stays silent.

import {
  type AudioLayer,
  type AudioLayerOptions,
  type AudioListenerState,
  type AudioPackSetLike,
  type AudioRendererLike,
  attachAutoplayUnlock,
  createAudioLayer,
  loadPackSoundbanks,
} from '@bendyline/molen-client/audio';
import { Aircraft } from '@bendyline/molen-kernel/aircraft';
import { Vehicle } from '@bendyline/molen-kernel/vehicles';
import { Transform, type World } from '@bendyline/molen-kernel/world';
import type {
  AudioEnvironmentData,
  AudioSignalBinding,
  WeatherData,
} from '@bendyline/molen-schema';

/** Sources in trees and grass (birds, crickets): full on the ground, gone by about 200 m up. */
const NEAR_GROUND: AudioSignalBinding = {
  signal: 'listener.heightAboveGround',
  curve: [
    [3, 1],
    [15, 0.7],
    [40, 0.35],
    [100, 0.1],
    [200, 0],
  ],
};

/**
 * Soundscape rules for Earth views: every decision is data the audio director evaluates. Ground
 * sounds read two host signals the Earth audio supplies each frame: `listener.heightAboveGround`
 * and `host.streetDistance` (meters to the nearest street, measured to the nearest parked car).
 */
export const EARTH_AUDIO_ENVIRONMENT: AudioEnvironmentData = {
  buses: { music: 0.45, ambience: 0.85 },
  ambience: [
    {
      sound: 'ambience.rain',
      when: { 'weather.precipitation.kind': 'rain' },
      gainFrom: {
        signal: 'weather.precipitation.intensity',
        curve: [
          [0, 0],
          [0.2, 0.4],
          [1, 1],
        ],
      },
    },
    {
      sound: 'ambience.wind',
      gainFrom: {
        signal: 'weather.windSpeed',
        curve: [
          [0, 0.06],
          [5, 0.3],
          [15, 0.9],
        ],
      },
      fadeS: 3,
    },
    {
      // Rushing air while flying fast, on top of the weather's wind.
      sound: 'ambience.wind',
      when: { 'listener.mode': ['fly', 'pilot', 'orbit'] },
      gainFrom: {
        signal: 'listener.speed',
        curve: [
          [0, 0],
          [40, 0.25],
          [250, 0.9],
        ],
      },
    },
    {
      // Birds sing in the trees at ground level: they fade as you climb, and busy streets
      // drown them out.
      sound: 'ambience.birds',
      when: { 'sky.daylight': { min: 0.35 }, 'weather.precipitation.kind': 'none' },
      gainFrom: [
        NEAR_GROUND,
        {
          signal: 'host.streetDistance',
          curve: [
            [0, 0.35],
            [60, 0.8],
            [150, 1],
          ],
          smoothS: 0.8,
        },
      ],
      gain: 0.7,
      fadeS: 4,
    },
    {
      // Traffic comes from the roads: it fades with height and with distance from the nearest
      // street, and carries further up than birdsong.
      sound: 'ambience.city.traffic',
      gainFrom: [
        {
          signal: 'listener.heightAboveGround',
          curve: [
            [3, 1],
            [30, 0.7],
            [100, 0.3],
            [300, 0.08],
            [500, 0],
          ],
        },
        {
          signal: 'host.streetDistance',
          curve: [
            [0, 1],
            [40, 0.55],
            [120, 0.2],
            [250, 0],
          ],
          smoothS: 0.8,
        },
      ],
      gain: 0.45,
      fadeS: 4,
    },
    {
      sound: 'ambience.crickets',
      when: { 'sky.daylight': { max: 0.15 }, 'weather.precipitation.kind': 'none' },
      gainFrom: NEAR_GROUND,
      gain: 0.6,
      fadeS: 4,
    },
  ],
  footsteps: {
    sound: 'footstep.grass',
    surfaces: { concrete: 'footstep.concrete', snow: 'footstep.snow', wood: 'footstep.wood' },
    strideM: 0.8,
    when: { 'listener.mode': 'walk' },
  },
  music: {
    playlist: ['music.ambient.first-light', 'music.ambient.lifewave'],
    mode: 'shuffle',
    crossfadeS: 6,
  },
};

export interface EarthAudioOptions {
  /** Replace the default rules (EARTH_AUDIO_ENVIRONMENT). */
  environment?: AudioEnvironmentData;
  /** Master volume 0–1 (default 1). */
  volume?: number;
  muted?: boolean;
  /** Background music on (default true). */
  music?: boolean;
  /** Resume audio on the first gesture on this target (default the window). */
  unlockTarget?: EventTarget;
  onWarning?: (message: string) => void;
}

export interface EarthAudioFrame {
  nowMs: number;
  /** Listener pose in world meters; default the renderer's camera. */
  position?: [number, number, number];
  forward?: [number, number, number];
  /** walk, drive, pilot, fly or orbit — the `listener.mode` signal. */
  mode: string;
  grounded?: boolean;
  /**
   * Height of the listener above the ground in meters (camera Y minus terrain height). Ground
   * ambience fades as it grows; leave it out when the terrain height is unknown.
   */
  heightAboveGround?: number;
  /** Weather to hear; default the renderer's current weather. */
  weather?: WeatherData;
}

export interface EarthAudio {
  readonly layer: AudioLayer;
  /** Call once per rendered frame. */
  update(frame: EarthAudioFrame): void;
  /** Read engines and events from this world (EarthVehicles.world); undefined detaches. */
  attachWorld(world: World | undefined): void;
  dispose(): void;
}

/** How often the street distance is re-measured (it walks every car in the loaded tiles). */
const STREET_CHECK_MS = 250;
/** Closer than this to a street, footsteps sound on pavement. */
const PAVEMENT_M = 25;

/**
 * Horizontal meters to the nearest street, measured to the nearest car: parked cars only spawn
 * along streets. Infinity when no car is loaded nearby. Aircraft do not count.
 */
function streetDistance(world: World | undefined, at: readonly number[]): number {
  if (!world) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const [id] of world.query(Vehicle)) {
    if (world.get(id, Aircraft) !== undefined) continue;
    const pos = world.get(id, Transform)?.pos;
    if (!pos) continue;
    best = Math.min(best, Math.hypot(pos[0] - (at[0] ?? 0), pos[2] - (at[2] ?? 0)));
  }
  return best;
}

/**
 * Start Earth audio from the sound banks in `packs`, or resolve undefined when none is present.
 * The renderer supplies the default listener (its camera) and sky/weather signals.
 */
export async function createEarthAudio(
  packs: AudioPackSetLike & { assetProvider(): NonNullable<AudioLayerOptions['provider']> },
  renderer: AudioRendererLike,
  options: EarthAudioOptions = {},
): Promise<EarthAudio | undefined> {
  const warn = options.onWarning ?? ((m: string) => console.warn(`audio: ${m}`));
  const banks = await loadPackSoundbanks(packs, warn);
  if (banks.length === 0) return undefined;
  const layer = createAudioLayer({
    banks,
    provider: packs.assetProvider(),
    environment: options.environment ?? EARTH_AUDIO_ENVIRONMENT,
    renderer,
    ...(options.volume !== undefined ? { volume: options.volume } : {}),
    ...(options.muted !== undefined ? { muted: options.muted } : {}),
    onWarning: warn,
  });
  if (options.music === false) layer.setBusGain('music', 0);
  const detachUnlock = attachAutoplayUnlock(layer, options.unlockTarget);

  let world: World | undefined;
  let detach: (() => void)[] = [];
  const attachWorld = (next: World | undefined): void => {
    for (const d of detach) d();
    detach = [];
    world = next;
    if (!next) return;
    detach.push(layer.attachWorld(next));
    // Engines are data on the vehicle and aircraft types (an `audioSource` that runs while the
    // vehicle is occupied, or from the aircraft's rpm). Boarding a car adds the door and starter.
    const isCar = (vehicle: string): boolean => next.get(vehicle, Aircraft) === undefined;
    detach.push(
      next.on('vehicle-mounted', (event) => {
        const vehicle = (event.payload as { vehicle?: string }).vehicle;
        if (!vehicle || !isCar(vehicle)) return;
        layer.play('vehicle.door.close', { entity: vehicle });
        layer.play('vehicle.engine.start', { entity: vehicle });
      }),
    );
    detach.push(
      next.on('vehicle-unmounted', (event) => {
        const vehicle = (event.payload as { vehicle?: string }).vehicle;
        if (!vehicle || !isCar(vehicle)) return;
        layer.play('vehicle.engine.stop', { entity: vehicle });
        layer.play('vehicle.door.open', { entity: vehicle });
      }),
    );
  };

  let street = Number.POSITIVE_INFINITY;
  let streetCheckedAt = Number.NEGATIVE_INFINITY;
  let lastPosition: readonly number[] = [0, 0, 0];
  return {
    layer,
    attachWorld,
    update(frame) {
      const position = frame.position ?? lastPosition;
      if (frame.position) lastPosition = frame.position;
      if (frame.nowMs - streetCheckedAt > STREET_CHECK_MS) {
        streetCheckedAt = frame.nowMs;
        street = streetDistance(world, position);
      }
      const urban = street < PAVEMENT_M;
      const weather = frame.weather ?? renderer.weather?.data;
      const surface =
        weather?.precipitation?.kind === 'snow' ? 'snow' : urban ? 'concrete' : 'grass';
      const listener: Partial<AudioListenerState> = {
        mode: frame.mode,
        surface,
        ...(frame.position ? { position: frame.position, up: [0, 1, 0] } : {}),
        ...(frame.forward ? { forward: frame.forward } : {}),
        ...(frame.grounded !== undefined ? { grounded: frame.grounded } : {}),
        ...(frame.heightAboveGround !== undefined
          ? { heightAboveGround: Math.max(0, frame.heightAboveGround) }
          : {}),
      };
      layer.update(frame.nowMs, listener, {
        ...(weather ? { weather } : {}),
        host: { urban, streetDistance: street },
      });
    },
    dispose() {
      attachWorld(undefined);
      detachUnlock();
      layer.dispose();
    },
  };
}
