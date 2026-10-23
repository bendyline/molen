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
import { componentHandle, Transform, type World } from '@bendyline/molen-kernel/world';
import type {
  AudioEnvironmentData,
  AudioSignalBinding,
  WeatherData,
} from '@bendyline/molen-schema';
import { type BirdsongLocation, birdsongLevel, loadBirdsongProfiles } from './birdsong';

/** Sources in trees and grass (birds, crickets): full on the ground, gone by 60 m up. */
const NEAR_GROUND: AudioSignalBinding = {
  signal: 'listener.heightAboveGround',
  curve: [
    [3, 1],
    [10, 0.55],
    [25, 0.15],
    [60, 0],
  ],
};

// Use a gain factor so a lost terrain sample cannot restart a ground loop during the director's
// condition hysteresis. Existing voices still fade out normally.
const GROUND_AMBIENCE: AudioSignalBinding = {
  signal: 'host.groundAmbience',
  curve: [
    [0, 0],
    [1, 1],
  ],
};

/**
 * Soundscape rules for Earth views: every decision is data the audio director evaluates. Ground
 * sounds require `host.groundAmbience` (known terrain height, outside a vehicle) and fade with
 * `listener.heightAboveGround` and `host.streetDistance` (meters to the nearest street, measured
 * to the nearest car).
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
        GROUND_AMBIENCE,
        NEAR_GROUND,
        {
          signal: 'host.genericBirds',
          curve: [
            [0, 0],
            [1, 1],
          ],
        },
        {
          signal: 'host.regionalBirds',
          curve: [
            [0, 0],
            [1, 1],
          ],
          smoothS: 4,
        },
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
        GROUND_AMBIENCE,
        {
          signal: 'listener.heightAboveGround',
          curve: [
            [3, 1],
            [10, 0.6],
            [30, 0.2],
            [100, 0],
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
      gainFrom: [
        GROUND_AMBIENCE,
        NEAR_GROUND,
        {
          signal: 'host.regionalInsects',
          curve: [
            [0, 0],
            [1, 1],
          ],
          smoothS: 4,
        },
      ],
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
  // Cars striking walls, each other or aircraft (installVehicles emits both, at the car).
  events: {
    'vehicle-impact': { sound: 'impact.metal.heavy' },
    'vehicle-bump': { sound: 'impact.metal.light', gain: 0.7 },
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
  /** walk, drive, pilot, fly or orbit — drive/pilot suppress outdoor ground ambience. */
  mode: string;
  grounded?: boolean;
  /**
   * Height of the listener above the ground in meters (camera Y minus terrain height). Ground
   * ambience fades as it grows; leave it out when the terrain height is unknown to silence
   * ground ambience until a valid sample is available.
   */
  heightAboveGround?: number;
  /** Weather to hear; default the renderer's current weather. */
  weather?: WeatherData;
  /** Optional habitat levels (0..1); omission preserves generic legacy ambience. */
  regionalAmbience?: { birds: number; insects: number; habitat?: string };
  /** Geographic listener and sky clock for recordings supplied by a pack's `birdsong` role. */
  location?: BirdsongLocation;
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
const AmbientAgent = componentHandle('ambientAgent');

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
  // Moving ambient traffic marks streets too (cars only: walkers, trains and aircraft do not).
  for (const [, agent, t] of world.query(AmbientAgent, Transform)) {
    if (agent.kind !== 'car') continue;
    best = Math.min(best, Math.hypot(t.pos[0] - (at[0] ?? 0), t.pos[2] - (at[2] ?? 0)));
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
  const curatedBirds = !options.environment && packs.provided('birdsong').length > 0;
  const birdProfiles = options.environment
    ? []
    : await loadBirdsongProfiles(
        packs,
        new Set(banks.flatMap(({ doc }) => Object.keys(doc.sounds))),
        warn,
      );
  const birdLayer = EARTH_AUDIO_ENVIRONMENT.ambience?.find((a) => a.sound === 'ambience.birds');
  const environment = options.environment ?? {
    ...EARTH_AUDIO_ENVIRONMENT,
    ambience: [
      ...(EARTH_AUDIO_ENVIRONMENT.ambience ?? []),
      ...birdProfiles.map((p, i) => ({
        ...birdLayer,
        sound: p.sound,
        when: { 'weather.precipitation.kind': 'none' },
        gainFrom: [
          ...(Array.isArray(birdLayer?.gainFrom)
            ? birdLayer.gainFrom.filter(
                (binding) =>
                  binding.signal !== 'host.genericBirds' && binding.signal !== 'host.regionalBirds',
              )
            : []),
          {
            signal: `host.birdsong${i}`,
            curve: [
              [0, 0],
              [1, 1],
            ] as [number, number][],
            smoothS: 2,
          },
        ],
      })),
    ],
  };
  const layer = createAudioLayer({
    banks,
    provider: packs.assetProvider(),
    environment,
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
        host: {
          urban,
          // Streamed tiles may not cover the camera (especially when looking down from high
          // above). An absent height otherwise resolves to zero in the generic audio layer.
          groundAmbience:
            Number.isFinite(frame.heightAboveGround) &&
            frame.mode !== 'drive' &&
            frame.mode !== 'pilot',
          streetDistance: street,
          regionalBirds: Math.max(0, Math.min(1, frame.regionalAmbience?.birds ?? 1)),
          regionalInsects: Math.max(0, Math.min(1, frame.regionalAmbience?.insects ?? 1)),
          // Once a curated catalog is present, uncovered places/seasons stay quiet.
          genericBirds: !curatedBirds,
          ...Object.fromEntries(
            birdProfiles.map((p, i) => [
              `birdsong${i}`,
              birdsongLevel(p, frame.location, frame.regionalAmbience?.habitat) *
                Math.max(0, Math.min(1, frame.regionalAmbience?.birds ?? 0)),
            ]),
          ),
        },
      });
    },
    dispose() {
      attachWorld(undefined);
      detachUnlock();
      layer.dispose();
    },
  };
}
