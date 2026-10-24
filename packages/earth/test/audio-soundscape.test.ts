import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { type SoundbankDoc, weatherProfile } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  createEarthAudio,
  EARTH_AUDIO_ENVIRONMENT,
  type EarthAudioFrame,
} from '../src/client/audio';
import {
  earthAudioRegion,
  earthSoundscapeClips,
  earthSoundscapeSelection,
} from '../src/client/audio-soundscape';

const bank = JSON.parse(
  readFileSync(new URL('../../../content/sounds/sounds.soundbank.json', import.meta.url), 'utf8'),
) as SoundbankDoc;
const clips = earthSoundscapeClips([bank]);
const packs = {
  provided: () => [{ pack: { manifest: { id: 'molen.sounds' } }, path: 'sounds.soundbank.json' }],
  readJson: async <T>() => bank as T,
  assetProvider: () => ({ load: async () => new ArrayBuffer(0), loadText: async () => '' }),
};
const places = [
  { latitude: 48, longitude: 10 },
  { latitude: 40, longitude: -100 },
  { latitude: -10, longitude: -60 },
  { latitude: -25, longitude: 25 },
  { latitude: 15, longitude: 100 },
  { latitude: -30, longitude: 140 },
];

describe('World soundscape content and behavior', () => {
  it('ships at least 100 distinct, licensed and reachable World sounds', () => {
    const steps = Object.values(EARTH_AUDIO_ENVIRONMENT.footsteps!.surfaces!);
    const ids = new Set([
      ...clips.map((c) => c.id),
      EARTH_AUDIO_ENVIRONMENT.footsteps!.sound,
      ...steps,
    ]);
    expect(ids.size).toBeGreaterThanOrEqual(100);
    const hashes = new Set<string>();
    const clipHashes = new Set<string>();
    for (const id of ids) {
      const entry = bank.sounds[id]!;
      expect(entry.source.license, id).toBe('CC0-1.0');
      expect(entry.source.url, id).toMatch(/^https:\/\//);
      expect(entry.clips.length).toBeGreaterThan(0);
      for (const ref of entry.clips) {
        const hash = `sha256:${createHash('sha256')
          .update(readFileSync(new URL(`../../../content/sounds/${ref}`, import.meta.url)))
          .digest('hex')}`;
        if (ref === entry.clips[0]) expect(entry.hash, id).toBe(hash);
        expect(clipHashes.has(hash), `duplicate clip: ${ref}`).toBe(false);
        clipHashes.add(hash);
      }
      hashes.add(entry.hash!);
    }
    expect(hashes.size).toBe(ids.size);
    const reachable = new Set<string>();
    for (const place of places)
      for (let seconds = 0; seconds < 2400; seconds += 10)
        for (const id of Object.values(
          earthSoundscapeSelection(
            clips,
            earthAudioRegion(place.latitude, place.longitude),
            seconds,
          ),
        ))
          reachable.add(id);
    expect([...clips.map((c) => c.id)].filter((id) => !reachable.has(id))).toEqual([]);
  });

  it('changes day/night, dawn, cold, rain, regions, coasts and cabin exposure without warnings', async () => {
    const warnings: string[] = [];
    const renderer = {
      camera: { matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0, 1] } },
      getWorldOrigin: () => [0, 0, 0],
      sky: { frame: { daylight: 1 } },
    };
    const audio = await createEarthAudio(packs, renderer, {
      music: false,
      onWarning: (m) => warnings.push(m),
    });
    expect(audio).toBeDefined();
    let nowMs = 0;
    const base: Omit<EarthAudioFrame, 'nowMs'> = {
      mode: 'walk',
      position: [0, 2, 0],
      heightAboveGround: 2,
      location: places[0],
      solarHour: 7,
      weather: weatherProfile('sunny'),
      terrain: {
        streetDistance: Infinity,
        coastDistance: Infinity,
        riverDistance: Infinity,
        surface: 'grass',
      },
      regionalAmbience: { birds: 1, insects: 1 },
    };
    const run = (patch: Partial<EarthAudioFrame> = {}) => {
      for (let i = 0; i < 100; i++) {
        audio!.update({ ...base, ...patch, nowMs });
        nowMs += 250;
      }
      return audio!.layer.director.voices();
    };
    const category = (voices: ReturnType<typeof run>, name: string) =>
      voices.filter((v) => v.sound.startsWith(`world.${name}.`));
    const dawn = category(run(), 'birds')[0]!;
    expect(dawn.sound).toContain('.europe.');
    expect(category(run({ regionalAmbience: { birds: 0, insects: 0 } }), 'birds')).toHaveLength(1);
    expect(dawn.gain).toBeGreaterThan(category(run({ solarHour: 14 }), 'birds')[0]!.gain);
    const cabin = category(run({ mode: 'drive', inVehicle: true }), 'birds')[0]!;
    expect(cabin.gain).toBeCloseTo(dawn.gain * 0.18, 3);
    expect(category(run({ location: places[5] }), 'birds')[0]!.sound).toContain('.oceania.');
    renderer.sky.frame.daylight = 0;
    const night = run();
    expect(category(night, 'birds')).toHaveLength(0);
    expect(category(night, 'night')).toHaveLength(1);
    expect(category(run({ weather: weatherProfile('snow') }), 'night')).toHaveLength(0);
    renderer.sky.frame.daylight = 1;
    const rainy = run({ weather: weatherProfile('rain') });
    expect(category(rainy, 'rain')).toHaveLength(1);
    expect(category(rainy, 'birds')[0]?.gain ?? 0).toBeLessThan(dawn.gain);
    const coastal = run({
      terrain: { coastDistance: 15, riverDistance: Infinity, streetDistance: Infinity },
    });
    expect(category(coastal, 'coast')).toHaveLength(1);
    expect(category(run(), 'coast')).toHaveLength(0);
    expect(category(run({ heightAboveGround: 800 }), 'birds')).toHaveLength(0);
    expect(warnings).toEqual([]);
    audio!.dispose();
  });
});
