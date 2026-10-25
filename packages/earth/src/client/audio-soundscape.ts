import { hash32, type SoundbankInput } from '@bendyline/molen-client/audio';
import type {
  AudioEnvironmentData,
  AudioSignalBinding,
  SoundbankDoc,
} from '@bendyline/molen-schema';

export interface EarthSoundscapeClip {
  id: string;
  category: string;
  region: string;
}
/** Recording regions are broad sound palettes, not a claim to exact local species coverage. */
export function earthAudioRegion(latitude = 45, longitude = 0): string {
  if (Math.abs(latitude) > 66) return 'polar';
  if (longitude < -30) return latitude < 28 ? 'latin-america' : 'north-america';
  if (longitude > 110 && latitude < -10) return 'oceania';
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
): EarthSoundscapeClip[] {
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
      result[`soundscape.${category}`] =
        pool[
          (Math.floor(Math.max(0, seconds) / (83 + (hash32(category) % 37))) +
            hash32(region, category)) %
            pool.length
        ]!.id;
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
  const ambience = (base.ambience ?? [])
    .filter(
      (layer) =>
        !categories.has(replaced[layer.sound] ?? '') ||
        // Keep speed-driven rushing air alongside the new weather-driven wind beds.
        (layer.sound === 'ambience.wind' && layer.when?.['listener.mode'] !== undefined),
    )
    .map((layer) => ({
      ...layer,
      gainFrom: [
        ...(Array.isArray(layer.gainFrom)
          ? layer.gainFrom
          : layer.gainFrom
            ? [layer.gainFrom]
            : []),
        OUTDOOR_GAIN,
      ],
    }));
  for (const clip of clips) {
    const drives: AudioSignalBinding[] = [OUTDOOR_GAIN];
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
      default:
        continue;
    }
    // A missing streamed terrain sample must not resolve to ground-level volume.
    if (['birds', 'night', 'insects', 'coast', 'river', 'traffic'].includes(clip.category))
      drives.push(identity('host.terrainKnown'));
    ambience.push({
      sound: clip.id,
      when: { [`host.soundscape.${clip.category}`]: clip.id },
      gain,
      gainFrom: drives,
      fadeS: 5,
    });
  }
  return { ...base, ambience, maxVoices: 16 };
}
