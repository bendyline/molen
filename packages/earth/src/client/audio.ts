// The Earth soundscape: ambience from place, season, time of day and weather; footsteps on foot;
// streets as beds plus events (horns, sirens, dogs); every vehicle and aircraft voiced by its sound
// profile (engines, exhaust, tires, wind, cabin), with the cabin, building or tunnel around the ears
// shaping everything outside it. Shared by `mountEarthView` and hosts that compose their own view
// (the world explorer). It reads sound banks, sound profiles, the soundscape catalog and birdsong
// from content packs (`provides.soundbank`, `sound-profiles`, `soundscape`, `birdsong`); without a
// bank it stays silent.

import {
  type AudioLayer,
  type AudioLayerOptions,
  type AudioListenerSpace,
  type AudioListenerState,
  type AudioPackSetLike,
  type AudioRendererLike,
  type AudioReverb,
  attachAutoplayUnlock,
  createAudioLayer,
  listenerFromCamera,
  loadPackSoundbanks,
  loadPackSoundProfiles,
  mergeSoundProfiles,
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
import { type BirdsongLocation, birdsongLevel, loadBirdsongProfiles } from './birdsong';
import { climateTemperatureC, warmth } from './climate';
import { loadSoundscapeCatalog, selectSoundscape } from './soundscape-catalog';
import { StreetLife, trafficByHour } from './street-life';
import { VehicleAudio } from './vehicle-audio';

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
 * sounds require a known terrain height and fade with `listener.heightAboveGround` and
 * `host.streetDistance` (meters to the nearest mapped street, with nearby cars as a fallback).
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
      // Rushing air while the free camera or a parachute moves fast, on top of the weather's wind:
      // generated airflow, not a recording of wind in trees (which carries its park's birds and
      // traffic up with you). An aircraft's own profile voices the air over its airframe.
      sound: 'aircraft.wind',
      when: { 'listener.mode': ['fly', 'pilot', 'orbit'], 'listener.vehicle': { exists: false } },
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
  // Loud nearby engines lower the beds; the nearest eight vehicles in range are voiced.
  masking: 0.6,
  maxEmitters: 8,
};

/** Layers heard inside a cabin, past its muffling; added when the bank has their sounds. */
const CABIN_LAYERS: NonNullable<AudioEnvironmentData['ambience']> = [
  {
    sound: 'ambience.rain.roof',
    inside: true,
    when: { 'weather.precipitation.kind': 'rain', 'listener.space': 'cabin' },
    gainFrom: {
      signal: 'weather.precipitation.intensity',
      curve: [
        [0, 0],
        [0.2, 0.35],
        [1, 0.85],
      ],
    },
    gain: 0.55,
    fadeS: 0.6,
  },
];

export interface EarthAudioOptions {
  /** Replace the default rules (EARTH_AUDIO_ENVIRONMENT). */
  environment?: AudioEnvironmentData;
  /** Master volume 0–1 (default 1). */
  volume?: number;
  muted?: boolean;
  /**
   * Background music on (default true). Off, no track is loaded and the music bus is silent; a
   * host can still raise the bus and start a playlist itself (`layer.music`).
   */
  music?: boolean;
  /** Resume audio on the first gesture on this target (default the window). */
  unlockTarget?: EventTarget;
  /** Voice budget (default 40, or 24 on a touch-only device). */
  maxVoices?: number;
  /** Vehicles voiced at once besides the listener's own (default 8, or 3 on a touch-only device). */
  maxEmitters?: number;
  onWarning?: (message: string) => void;
}

export interface EarthAudioFrame {
  nowMs: number;
  /** Listener pose in world meters; default the renderer's camera. */
  position?: [number, number, number];
  forward?: [number, number, number];
  /** walk, drive, pilot, fly or orbit — drive/pilot default to an enclosed cabin. */
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
  location?: Pick<BirdsongLocation, 'latitude' | 'longitude'> &
    Partial<Pick<BirdsongLocation, 'utcMs' | 'sunAltitudeDeg'>>;
  /** Local solar hour from the rendered sky clock (0..24). */
  solarHour?: number;
  /** Mapped surface, streets and water; sampled by the host at a modest cadence. */
  terrain?: EarthAudioTerrainSample;
  /** Surface at a vehicle's contact point; used on touchdown, never inferred from the camera. */
  surfaceAt?: (x: number, z: number) => string | undefined;
  /** Override the mapped walking surface, e.g. an interior floor or a bridge deck. */
  surface?: string;
  /** Enclosed cabin: defaults to drive/pilot. Set false for open boats or outside cameras. */
  inVehicle?: boolean;
  indoors?: boolean;
  /**
   * The entity the listener drives or flies, in any view: its sound profile's cabin and interior
   * layers apply in the cockpit, and outside it is held near a chase camera.
   */
  vehicle?: string;
  /** The space around the ears; default cabin when `inVehicle`, building when `indoors`, else open. */
  space?: AudioListenerSpace;
  /** Reverberant surroundings outside that space: a tunnel bore, a street between towers. */
  reverb?: AudioReverb;
  /** The driver is holding the horn. */
  horn?: boolean;
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
/** Below this held time a horn tap still sounds as a short beep. */
const HORN_MIN_MS = 180;
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

/** 0..1: how many people are within earshot (ambient pedestrians within 30 m), for crowd beds. */
function crowdLevel(world: World | undefined, at: readonly number[]): number {
  if (!world) return 0;
  let n = 0;
  for (const [, agent, t] of world.query(AmbientAgent, Transform)) {
    if (agent.kind !== 'pedestrian') continue;
    if (Math.hypot(t.pos[0] - (at[0] ?? 0), t.pos[2] - (at[2] ?? 0)) < 30) n++;
  }
  return Math.min(1, n / 10);
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
  const sounds = new Set(banks.flatMap(({ doc }) => Object.keys(doc.sounds)));
  const curatedBirds = !options.environment && packs.provided('birdsong').length > 0;
  const birdProfiles = options.environment ? [] : await loadBirdsongProfiles(packs, sounds, warn);
  const catalog = options.environment
    ? undefined
    : await loadSoundscapeCatalog(packs, sounds, warn);
  const profileDocs = await loadPackSoundProfiles(packs, warn);
  // A catalog decides every bed by place; without one, curated birdsong replaces the broad bird
  // palettes everywhere, including places it does not cover.
  const clips = earthSoundscapeClips(banks, catalog).filter(
    (clip) => catalog !== undefined || !curatedBirds || clip.category !== 'birds',
  );
  const categories = [...new Set(clips.map((c) => c.category))];
  const birdLayer = EARTH_AUDIO_ENVIRONMENT.ambience?.find((a) => a.sound === 'ambience.birds');
  const environment = {
    ...EARTH_AUDIO_ENVIRONMENT,
    ambience: [
      ...(EARTH_AUDIO_ENVIRONMENT.ambience ?? []),
      ...CABIN_LAYERS.filter((layer) => sounds.has(layer.sound)),
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
  // A touch-only device (a phone, most tablets) gets fewer voices and fewer voiced vehicles.
  const touchOnly =
    typeof matchMedia === 'function' &&
    matchMedia('(pointer: coarse)').matches &&
    !matchMedia('(any-pointer: fine)').matches;
  const soundscape = options.environment ?? {
    ...earthSoundscapeEnvironment(environment, clips),
    maxVoices: options.maxVoices ?? (touchOnly ? 24 : 40),
    maxEmitters: options.maxEmitters ?? (touchOnly ? 3 : 8),
  };
  // Without music its playlist is left out, so no track is fetched or decoded (one decodes to
  // about 50 MB of samples); a silenced bus alone still loaded and played it.
  const { music: _playlist, ...withoutMusic } = soundscape;
  const layer = createAudioLayer({
    banks,
    provider: packs.assetProvider(),
    environment: options.music === false ? withoutMusic : soundscape,
    renderer,
    ...(profileDocs.length > 0 ? { profiles: mergeSoundProfiles(profileDocs) } : {}),
    ...(options.volume !== undefined ? { volume: options.volume } : {}),
    ...(options.muted !== undefined ? { muted: options.muted } : {}),
    onWarning: warn,
  });
  if (options.music === false) layer.setBusGain('music', 0);
  const detachUnlock = attachAutoplayUnlock(layer, options.unlockTarget);
  const vehicleAudio = new VehicleAudio(layer, sounds, (id) => layer.director.profileFor(id));
  const street = new StreetLife(layer, sounds);
  let horn: { handle: string; startedAt: number; released: boolean } | undefined;

  let world: World | undefined;
  let detach: (() => void)[] = [];
  const attachWorld = (next: World | undefined): void => {
    for (const d of detach) d();
    detach = [];
    vehicleAudio.clear();
    street.clear();
    world = next;
    if (!next) return;
    detach.push(layer.attachWorld(next));
    // Engines are data on the vehicle and aircraft types (an `audioSource` that runs while the
    // vehicle is occupied, or from the aircraft's rpm). Boarding a car adds the door and starter.
    detach.push(
      next.on('vehicle-mounted', (event) => {
        const { vehicle, seat } = event.payload as { vehicle?: string; seat?: string };
        if (vehicle) vehicleAudio.boarding(next, vehicle, true, seat);
      }),
    );
    detach.push(
      next.on('vehicle-unmounted', (event) => {
        const vehicle = (event.payload as { vehicle?: string }).vehicle;
        if (vehicle) vehicleAudio.boarding(next, vehicle, false);
      }),
    );
  };

  let streetDist = Number.POSITIVE_INFINITY;
  let crowd = 0;
  let streetCheckedAt = Number.NEGATIVE_INFINITY;
  let startedAt: number | undefined;
  return {
    layer,
    attachWorld,
    update(frame) {
      const position =
        frame.position ?? listenerFromCamera(renderer.camera, renderer.getWorldOrigin()).position;
      vehicleAudio.update(world, frame.nowMs, frame.surfaceAt ?? (() => undefined));
      startedAt ??= frame.nowMs;
      if (frame.nowMs - streetCheckedAt > STREET_CHECK_MS) {
        streetCheckedAt = frame.nowMs;
        streetDist = streetDistance(world, position);
        crowd = crowdLevel(world, position);
      }
      const distance = frame.terrain?.streetDistance ?? streetDist;
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
      const known = Number.isFinite(frame.heightAboveGround);
      // A weather preset's temperature is the same everywhere it is applied, so insects and frogs
      // follow the climate of the place, season and hour instead; snow means it is freezing.
      const groundY = known ? position[1] - (frame.heightAboveGround as number) : 0;
      const climate = frame.location
        ? climateTemperatureC({
            latitude: frame.location.latitude,
            longitude: frame.location.longitude,
            ...(frame.location.utcMs !== undefined ? { utcMs: frame.location.utcMs } : {}),
            ...(frame.solarHour !== undefined ? { solarHour: frame.solarHour } : {}),
            elevationM: groundY,
          })
        : (weather?.atmosphere?.temperatureK ?? 288.15) - 273.15;
      const temperatureC = snow ? Math.min(climate, -1) : climate;
      const cabin = frame.inVehicle ?? ['drive', 'pilot'].includes(frame.mode);
      const space: AudioListenerSpace =
        frame.space ?? (cabin ? 'cabin' : frame.indoors ? 'building' : 'open');
      const region = earthAudioRegion(frame.location?.latitude, frame.location?.longitude);
      const birdLocation =
        frame.location?.utcMs !== undefined && frame.location.sunAltitudeDeg !== undefined
          ? {
              ...frame.location,
              utcMs: frame.location.utcMs,
              sunAltitudeDeg: frame.location.sunAltitudeDeg,
            }
          : undefined;
      const barren = ['sand', 'beach', 'rock', 'bare_rock', 'snow', 'ice', 'glacier'].includes(
        frame.terrain?.habitat ?? '',
      );
      const wet =
        Math.min(
          frame.terrain?.lakeDistance ?? Infinity,
          frame.terrain?.riverDistance ?? Infinity,
        ) < 250 || ['wetland', 'marsh', 'swamp', 'bog'].includes(frame.terrain?.habitat ?? '');
      const night = Math.max(0, 1 - daylight / 0.3);
      const listener: Partial<AudioListenerState> = {
        mode: frame.mode,
        surface,
        indoors: frame.indoors ?? false,
        space,
        ...(frame.vehicle !== undefined ? { vehicle: frame.vehicle } : {}),
        ...(frame.reverb !== undefined ? { reverb: frame.reverb } : {}),
        ...(frame.position ? { position: frame.position, up: [0, 1, 0] } : {}),
        ...(frame.forward ? { forward: frame.forward } : {}),
        ...(frame.grounded !== undefined ? { grounded: frame.grounded } : {}),
        ...(frame.heightAboveGround !== undefined
          ? { heightAboveGround: Math.max(0, frame.heightAboveGround) }
          : {}),
      };
      const seconds = (frame.nowMs - startedAt) / 1000;
      const birdsong = birdProfiles.map(
        (p) =>
          birdsongLevel(p, birdLocation, frame.regionalAmbience?.habitat) *
          Math.max(0, Math.min(1, frame.regionalAmbience?.birds ?? 0)),
      );
      let selection: Record<string, string>;
      const levels: Record<string, number> = {};
      if (catalog && frame.location) {
        const picked = selectSoundscape(
          catalog,
          {
            latitude: frame.location.latitude,
            longitude: frame.location.longitude,
            ...(frame.location.utcMs !== undefined ? { utcMs: frame.location.utcMs } : {}),
            ...(frame.location.sunAltitudeDeg !== undefined
              ? { sunAltitudeDeg: frame.location.sunAltitudeDeg }
              : {}),
            ...(frame.solarHour !== undefined ? { solarHour: frame.solarHour } : {}),
            temperatureC,
            ...(frame.terrain?.habitat !== undefined ||
            frame.regionalAmbience?.habitat !== undefined
              ? { habitat: frame.regionalAmbience?.habitat ?? frame.terrain?.habitat }
              : {}),
            urban,
          },
          seconds,
        );
        selection = Object.fromEntries(
          Object.entries(picked.chosen).map(([category, id]) => [`soundscape.${category}`, id]),
        );
        for (const category of categories) levels[category] = picked.levels[category] ?? 0;
        // A curated recording of the birds that live here wins over the regional bed.
        if (Math.max(0, ...birdsong) > 0.15) levels.birds = 0;
      } else {
        selection = catalog ? {} : earthSoundscapeSelection(clips, region, seconds);
        for (const category of categories) levels[category] = catalog ? 0 : 1;
      }
      street.update({
        nowMs: frame.nowMs,
        position,
        ...(frame.location
          ? { latitude: frame.location.latitude, longitude: frame.location.longitude }
          : {}),
        hour,
        streetDistance: distance,
        ...(known ? { heightAboveGround: frame.heightAboveGround as number } : {}),
        storm: weather?.clouds?.type === 'cumulonimbus' && rain > 0.3,
        rain,
        ...(world ? { world } : {}),
      });
      // Hold to sound the horn; a tap still gives a short beep.
      if (frame.horn && frame.vehicle !== undefined && !horn) {
        const sound = layer.director.profileFor(frame.vehicle)?.horn ?? 'vehicle.horn';
        if (sounds.has(sound))
          horn = {
            handle: layer.play(sound, { entity: frame.vehicle, loop: true, outside: false }),
            startedAt: frame.nowMs,
            released: false,
          };
      }
      if (horn && (!frame.horn || frame.vehicle === undefined)) horn.released = true;
      if (horn?.released && frame.nowMs - horn.startedAt >= HORN_MIN_MS) {
        layer.stop(horn.handle, 0.06);
        horn = undefined;
      }
      layer.update(frame.nowMs, listener, {
        ...(weather ? { weather } : {}),
        host: {
          urban,
          // Streamed tiles may not cover the camera (especially when looking down from high
          // above). An absent height otherwise resolves to zero in the generic audio layer. A
          // cabin no longer silences them: its enclosure muffles everything outside.
          groundAmbience: known,
          terrainKnown: known,
          streetDistance: distance,
          intersectionDistance: frame.terrain?.intersectionDistance ?? Number.MAX_VALUE,
          coastDistance: frame.terrain?.coastDistance ?? Number.MAX_VALUE,
          riverDistance: frame.terrain?.riverDistance ?? Number.MAX_VALUE,
          lakeDistance: frame.terrain?.lakeDistance ?? Number.MAX_VALUE,
          highwayDistance: frame.terrain?.highwayDistance ?? Number.MAX_VALUE,
          // Kept for custom rules written against it; the enclosure now does this work.
          outdoorGain: 1,
          temperatureC,
          birdActivity:
            Math.max(0, Math.min(1, (daylight - 0.15) / 0.4)) *
            dawn *
            (1 - rain) *
            (urban ? 0.5 : 1) *
            (barren ? 0.1 : 1),
          nightActivity: night * warmth(temperatureC, 7, 16) * (1 - rain) * (barren ? 0 : 1),
          insectActivity:
            daylight * warmth(temperatureC, 13, 22) * (1 - rain) * 0.75 * (barren ? 0 : 1),
          // Frogs call on mild nights near water, and light rain does not stop them.
          frogActivity:
            night *
            warmth(temperatureC, 4, 11) *
            (1 - 0.4 * rain) *
            (wet ? 1 : 0.3) *
            (barren ? 0 : 1),
          rainActivity: rain,
          trafficActivity: trafficByHour(hour),
          railHorn: street.railHorn,
          crowd,
          ...selection,
          ...Object.fromEntries(
            Object.entries(levels).map(([category, level]) => [
              `soundscapeLevel.${category}`,
              level,
            ]),
          ),
          regionalBirds: Math.max(0, Math.min(1, frame.regionalAmbience?.birds ?? 1)),
          regionalInsects: Math.max(0, Math.min(1, frame.regionalAmbience?.insects ?? 1)),
          // Once a curated catalog is present, uncovered places/seasons stay quiet.
          genericBirds: !curatedBirds,
          ...Object.fromEntries(birdsong.map((level, i) => [`birdsong${i}`, level])),
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
