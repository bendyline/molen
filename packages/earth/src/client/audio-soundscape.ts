import { hash32, type SoundbankInput } from '@bendyline/molen-client/audio';
import type {
  AudioEnvironmentData,
  AudioSignalBinding,
  SoundbankDoc,
} from '@bendyline/molen-schema';
import type { SoundscapeEntry } from './soundscape-catalog';

export interface EarthSoundscapeClip {
  id: string;
  category: string;
  region: string;
}
/** The latitude of the US–Mexico border west of the Gulf, roughly, by longitude. */
function borderLatitude(longitude: number): number {
  if (longitude <= -108) return 32.5;
  if (longitude <= -106.5) return 31.8;
  // Down the Rio Grande from El Paso to Brownsville.
  return 31.8 + ((longitude + 106.5) / 9.1) * (25.9 - 31.8);
}

/**
 * Recording regions are broad sound palettes, not a claim to exact local species coverage. Only
 * packs without a soundscape catalog use them; a catalog names each bed's own bounds.
 */
export function earthAudioRegion(latitude = 45, longitude = 0): string {
  if (Math.abs(latitude) > 66) return 'polar';
  // Hawaii's birds and insects are Pacific island ones, not Mexican or Californian.
  if (longitude >= -161 && longitude < -154 && latitude >= 18 && latitude < 23) return 'oceania';
  if (longitude < -30) {
    if (longitude < -97.4)
      return latitude >= borderLatitude(longitude) ? 'north-america' : 'latin-america';
    // East of Texas the Gulf and the Florida Straits are the line.
    return latitude >= 24.4 ? 'north-america' : 'latin-america';
  }
  if (longitude > 110 && latitude < -10) return 'oceania';
  // The Levant, Arabia and Iran have no beds of their own: the global palettes stand in.
  if (
    longitude >= 34 &&
    longitude < 63 &&
    latitude >= 12 &&
    latitude < 42 &&
    !(longitude < 36 && latitude < 31.5)
  )
    return 'middle-east';
  if (longitude >= -20 && longitude < 52 && latitude < 36 && latitude > -36) return 'africa';
  return longitude < 60 && latitude >= 30 ? 'europe' : 'asia';
}
export const OUTDOOR_GAIN: AudioSignalBinding = {
  signal: 'host.outdoorGain',
  curve: [
    [0, 0],
    [1, 1],
  ],
  smoothS: 1.2,
};
const ground: AudioSignalBinding = {
  signal: 'listener.heightAboveGround',
  curve: [
    [3, 1],
    [20, 0.65],
    [80, 0.2],
    [200, 0],
  ],
};
const identity = (signal: string): AudioSignalBinding => ({
  signal,
  curve: [
    [0, 0],
    [1, 1],
  ],
});

export function earthSoundscapeClips(
  banks: readonly (SoundbankDoc | SoundbankInput)[],
  catalog?: readonly SoundscapeEntry[],
): EarthSoundscapeClip[] {
  // A catalog names every bed and its category; region tags no longer apply.
  if (catalog)
    return catalog
      .map((e) => ({ id: e.sound, category: e.category, region: 'catalog' }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const entries = new Map<string, EarthSoundscapeClip>();
  for (const bank of banks)
    for (const [id, sound] of Object.entries(('doc' in bank ? bank.doc : bank).sounds)) {
      entries.delete(id); // A later bank can replace or remove a sound's Earth metadata.
      const category = sound.tags?.find((t) => t.startsWith('earth:category:'))?.slice(15);
      if (category && sound.loop)
        entries.set(id, {
          id,
          category,
          region: sound.tags?.find((t) => t.startsWith('earth:region:'))?.slice(13) ?? 'global',
        });
    }
  return [...entries.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** One long-lived bed per category, with staggered rotation and crossfades between recordings. */
export function earthSoundscapeSelection(
  clips: EarthSoundscapeClip[],
  region: string,
  seconds: number,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const category of new Set(clips.map((c) => c.category))) {
    let pool = clips.filter((c) => c.category === category && c.region === region);
    if (pool.length === 0)
      pool = clips.filter((c) => c.category === category && c.region === 'global');
    if (region === 'polar' && ['birds', 'night', 'insects'].includes(category)) pool = [];
    if (pool.length)
      result[`soundscape.${category}`] = (
        pool[
          (Math.floor(Math.max(0, seconds) / (83 + (hash32(category) % 37))) +
            hash32(region, category)) %
            pool.length
        ] as EarthSoundscapeClip
      ).id;
  }
  return result;
}

export function earthSoundscapeEnvironment(
  base: AudioEnvironmentData,
  clips: EarthSoundscapeClip[],
): AudioEnvironmentData {
  const categories = new Set(clips.map((c) => c.category));
  const replaced: Record<string, string> = {
    'ambience.birds': 'birds',
    'ambience.crickets': 'night',
    'ambience.wind': 'wind',
    'ambience.rain': 'rain',
    'ambience.city.traffic': 'traffic',
  };
  // A cabin or building muffles these through the listener's enclosure; no gain rule needed.
  const ambience = (base.ambience ?? []).filter(
    (layer) =>
      !categories.has(replaced[layer.sound] ?? '') ||
      // Keep speed-driven rushing air alongside the new weather-driven wind beds.
      (layer.sound === 'ambience.wind' && layer.when?.['listener.mode'] !== undefined),
  );
  for (const clip of clips) {
    // How strongly the catalog says this bed belongs here now (1 without a catalog).
    const drives: AudioSignalBinding[] = [
      { ...identity(`host.soundscapeLevel.${clip.category}`), smoothS: 3 },
    ];
    let gain = 0.3;
    switch (clip.category) {
      case 'birds':
        drives.push(ground, identity('host.birdActivity'));
        gain = 0.42;
        break;
      case 'night':
        drives.push(ground, identity('host.nightActivity'));
        gain = 0.32;
        break;
      case 'insects':
        drives.push(ground, identity('host.insectActivity'));
        gain = 0.22;
        break;
      case 'wind':
        drives.push({
          signal: 'weather.windSpeed',
          curve: [
            [0, 0],
            [1, 0.08],
            [5, 0.35],
            [15, 0.65],
            [30, 0.35],
          ],
        });
        gain = 0.34;
        break;
      case 'gust':
        drives.push({
          signal: 'weather.windSpeed',
          curve: [
            [0, 0],
            [8, 0],
            [15, 0.5],
            [30, 1],
          ],
        });
        gain = 0.3;
        break;
      case 'rain':
        drives.push(identity('host.rainActivity'));
        gain = 0.5;
        break;
      case 'coast':
        drives.push(ground, {
          signal: 'host.coastDistance',
          curve: [
            [0, 1],
            [30, 0.9],
            [120, 0.4],
            [400, 0.04],
            [600, 0],
          ],
          smoothS: 2,
        });
        gain = 0.45;
        break;
      case 'river':
        drives.push(ground, {
          signal: 'host.riverDistance',
          curve: [
            [0, 1],
            [10, 0.8],
            [40, 0.3],
            [100, 0],
          ],
          smoothS: 2,
        });
        gain = 0.28;
        break;
      case 'traffic':
        drives.push(
          {
            signal: 'listener.heightAboveGround',
            curve: [
              [3, 1],
              [30, 0.7],
              [100, 0.3],
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
            smoothS: 1,
          },
          identity('host.trafficActivity'),
        );
        gain = 0.3;
        break;
      case 'frogs':
        drives.push(ground, identity('host.frogActivity'));
        gain = 0.3;
        break;
      case 'lake':
        drives.push(ground, {
          signal: 'host.lakeDistance',
          curve: [
            [0, 1],
            [15, 0.8],
            [60, 0.3],
            [150, 0],
          ],
          smoothS: 2,
        });
        gain = 0.3;
        break;
      case 'harbor':
        drives.push(ground, {
          signal: 'host.coastDistance',
          curve: [
            [0, 1],
            [60, 0.6],
            [250, 0],
          ],
          smoothS: 2,
        });
        gain = 0.32;
        break;
      case 'highway':
        drives.push(
          {
            signal: 'listener.heightAboveGround',
            curve: [
              [3, 1],
              [40, 0.7],
              [150, 0.3],
              [500, 0],
            ],
          },
          {
            signal: 'host.highwayDistance',
            curve: [
              [0, 1],
              [60, 0.6],
              [250, 0.25],
              [700, 0],
            ],
            smoothS: 1.5,
          },
          identity('host.trafficActivity'),
        );
        gain = 0.32;
        break;
      case 'crowd':
        drives.push(
          {
            signal: 'listener.heightAboveGround',
            curve: [
              [3, 1],
              [15, 0.4],
              [40, 0],
            ],
          },
          { ...identity('host.crowd'), smoothS: 2 },
        );
        gain = 0.28;
        break;
      case 'crossing':
        // This recording contains an audible pedestrian signal, not a generic road bed.
        // Missing junction data is deliberately silent, even alongside a busy street.
        drives.push(
          {
            signal: 'listener.heightAboveGround',
            curve: [
              [3, 1],
              [10, 0.5],
              [25, 0],
            ],
          },
          identity('host.terrainKnown'),
          {
            signal: 'host.intersectionDistance',
            curve: [
              [0, 1],
              [12, 0.7],
              [30, 0.2],
              [55, 0],
            ],
            smoothS: 0.2,
          },
        );
        gain = 0.24;
        break;
      default:
        continue;
    }
    // A missing streamed terrain sample must not resolve to ground-level volume.
    if (
      [
        'birds',
        'night',
        'insects',
        'frogs',
        'coast',
        'river',
        'lake',
        'harbor',
        'traffic',
      ].includes(clip.category)
    )
      drives.push(identity('host.terrainKnown'));
    ambience.push({
      sound: clip.id,
      when: { [`host.soundscape.${clip.category}`]: clip.id },
      gain,
      gainFrom: drives,
      fadeS: clip.category === 'crossing' ? 0.3 : 5,
    });
  }
  return { ...base, ambience, maxVoices: 16 };
}
