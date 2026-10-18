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
  listenerFromCamera,
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
import {
  earthAudioRegion,
  earthSoundscapeClips,
  earthSoundscapeEnvironment,
  earthSoundscapeSelection,
} from './audio-soundscape';
import type { EarthAudioTerrainSample } from './audio-terrain';

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
 * and `host.streetDistance` (meters to the nearest mapped street, with nearby cars as a fallback).
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
      gainFrom: [
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
    surfaces: {
      concrete: 'footstep.concrete',
      snow: 'footstep.snow',
      wood: 'footstep.wood',
      stone: 'footstep.stone',
      gravel: 'footstep.gravel',
      sand: 'footstep.sand',
      dirt: 'footstep.dirt',
      leaves: 'footstep.leaves',
      mud: 'footstep.mud',
      metal: 'footstep.metal',
      carpet: 'footstep.carpet',
    },
    strideM: 0.75,
    gain: 0.45,
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
  /** Optional habitat levels (0..1) for legacy ambience; regional recordings use mapped habitat. */
  regionalAmbience?: { birds: number; insects: number };
  /** Geographic location selects the recording palette. */
  location?: { latitude: number; longitude: number };
  /** Local solar hour from the rendered sky clock (0..24). */
  solarHour?: number;
  /** Mapped surface, streets and water; sampled by the host at a modest cadence. */
  terrain?: EarthAudioTerrainSample;
  /** Override the mapped walking surface, e.g. an interior floor or a bridge deck. */
  surface?: string;
  /** Enclosed cabin: defaults to drive/pilot. Set false for open boats or outside cameras. */
  inVehicle?: boolean;
  indoors?: boolean;
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
  const clips = earthSoundscapeClips(banks);
  const layer = createAudioLayer({
    banks,
    provider: packs.assetProvider(),
    environment: options.environment ?? earthSoundscapeEnvironment(EARTH_AUDIO_ENVIRONMENT, clips),
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
  let startedAt: number | undefined;
  return {
    layer,
    attachWorld,
    update(frame) {
      const position =
        frame.position ?? listenerFromCamera(renderer.camera, renderer.getWorldOrigin()).position;
      startedAt ??= frame.nowMs;
      if (frame.nowMs - streetCheckedAt > STREET_CHECK_MS) {
        streetCheckedAt = frame.nowMs;
        street = streetDistance(world, position);
      }
      const distance = frame.terrain?.streetDistance ?? street;
      const urban = distance < PAVEMENT_M;
      const weather = frame.weather ?? renderer.weather?.data;
      const snow = weather?.precipitation?.kind === 'snow';
      const rain =
        weather?.precipitation?.kind === 'rain' ? (weather.precipitation.intensity ?? 0) : 0;
      const mapped = frame.surface ?? frame.terrain?.surface;
      const baseSurface = mapped ?? (urban ? 'concrete' : 'grass');
      const surface =
        frame.surface ??
        (snow && !frame.indoors
          ? 'snow'
          : rain > 0.5 && ['dirt', 'leaves'].includes(baseSurface)
            ? 'mud'
            : baseSurface);
      const daylight = renderer.sky?.frame?.daylight ?? 1;
      const hour = frame.solarHour ?? 12;
      const dawn = hour >= 4 && hour <= 9 ? 1 : 0.65;
      const warm = Math.max(
        0,
        Math.min(1, ((weather?.atmosphere?.temperatureK ?? 288.15) - 278.15) / 12),
      );
      const cabin = frame.inVehicle ?? ['drive', 'pilot'].includes(frame.mode);
      const region = earthAudioRegion(frame.location?.latitude, frame.location?.longitude);
      const barren = ['sand', 'beach', 'rock', 'bare_rock', 'snow', 'ice', 'glacier'].includes(
        frame.terrain?.habitat ?? '',
      );
      const listener: Partial<AudioListenerState> = {
        mode: frame.mode,
        surface,
        indoors: frame.indoors ?? false,
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
          streetDistance: distance,
          coastDistance: frame.terrain?.coastDistance ?? Number.MAX_VALUE,
          riverDistance: frame.terrain?.riverDistance ?? Number.MAX_VALUE,
          outdoorGain: cabin ? 0.18 : frame.indoors ? 0.28 : 1,
          birdActivity:
            Math.max(0, Math.min(1, (daylight - 0.15) / 0.4)) *
            dawn *
            (1 - rain) *
            (urban ? 0.5 : 1) *
            (barren ? 0.1 : 1),
          nightActivity: Math.max(0, 1 - daylight / 0.3) * warm * (1 - rain) * (barren ? 0 : 1),
          insectActivity: daylight * warm * (1 - rain) * 0.75 * (barren ? 0 : 1),
          rainActivity: rain,
          trafficActivity: 0.4 + 0.6 * daylight,
          ...earthSoundscapeSelection(clips, region, (frame.nowMs - startedAt) / 1000),
          regionalBirds: Math.max(0, Math.min(1, frame.regionalAmbience?.birds ?? 1)),
          regionalInsects: Math.max(0, Math.min(1, frame.regionalAmbience?.insects ?? 1)),
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
