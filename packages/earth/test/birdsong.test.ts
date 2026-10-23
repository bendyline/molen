import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createEarthAudio } from '../src/client/audio';
import {
  type BirdsongLocation,
  type BirdsongProfile,
  birdsongLevel,
  loadBirdsongProfiles,
} from '../src/client/birdsong';

const catalog = JSON.parse(
  readFileSync(new URL('../../../content/sounds/birdsong.json', import.meta.url), 'utf8'),
) as {
  format: string;
  profiles: BirdsongProfile[];
};
const sources = JSON.parse(
  readFileSync(new URL('../../../content/sounds/sources.json', import.meta.url), 'utf8'),
) as {
  origins: Record<string, { license: string; page: string }>;
  sounds: Record<string, { clips: { origin: string }[] }>;
};
const bird = (id: string): BirdsongProfile => {
  const p = catalog.profiles.find((p) => p.sound === `ambience.birds.${id}`);
  if (!p) throw new Error(`Missing bird profile: ${id}`);
  return p;
};
const at = (
  latitude: number,
  longitude: number,
  month: number,
  hour = 6,
  sunAltitudeDeg = 2,
): BirdsongLocation => ({
  latitude,
  longitude,
  utcMs: Date.UTC(2026, month - 1, 15, hour) - longitude * 240_000,
  sunAltitudeDeg,
});
const provided = (role: string) =>
  role === 'birdsong'
    ? [{ pack: { manifest: { id: 'molen.sounds' } }, path: 'birdsong.json' }]
    : [];

describe('curated Earth birdsong', () => {
  it('validates the shipped catalog and traces every recording to a CC0 source', async () => {
    const warn = vi.fn();
    const loaded = await loadBirdsongProfiles(
      { provided, readJson: async <T>() => catalog as T },
      new Set(Object.keys(sources.sounds)),
      warn,
    );
    expect(warn).not.toHaveBeenCalled();
    expect(loaded).toEqual(catalog.profiles);
    for (const p of loaded) {
      for (const clip of sources.sounds[p.sound]?.clips ?? []) {
        expect(sources.origins[clip.origin]?.license).toBe('CC0-1.0');
        expect(sources.origins[clip.origin]?.page).toMatch(/^https:\/\/freesound\.org\/people\//);
      }
    }
  });

  it('keeps American and European songs in their authored areas', () => {
    expect(birdsongLevel(bird('mourning_dove'), at(32.7, -114.6, 5), 'scrub')).toBeGreaterThan(0.5);
    expect(birdsongLevel(bird('american_robin'), at(43.7, -79.4, 5), 'grass')).toBe(1);
    expect(birdsongLevel(bird('american_robin'), at(32.7, -114.6, 5), 'grass')).toBe(0);
    expect(birdsongLevel(bird('common_blackbird'), at(51.5, -0.1, 5), 'grass')).toBe(1);
    expect(birdsongLevel(bird('common_blackbird'), at(43.7, -79.4, 5), 'grass')).toBe(0);
  });

  it('uses the scene calendar and southern seasons rather than the machine date', () => {
    expect(birdsongLevel(bird('american_robin'), at(43.7, -79.4, 1), 'grass')).toBe(0);
    expect(birdsongLevel(bird('japanese_bush_warbler'), at(35.4, 139.6, 12), 'scrub')).toBe(0);
    expect(
      birdsongLevel(bird('japanese_bush_warbler'), at(35.4, 139.6, 6), 'scrub'),
    ).toBeGreaterThan(0.5);
    const south = bird('perth_kookaburras');
    expect(birdsongLevel(south, at(-31.95, 115.86, 11), 'forest')).toBeGreaterThan(
      birdsongLevel(south, at(-31.95, 115.86, 5), 'forest'),
    );
  });

  it('peaks at local dawn, quiets at noon, and never puts these daytime birds at night', () => {
    const robin = bird('american_robin');
    expect(birdsongLevel(robin, at(43.7, -79.4, 5), 'grass')).toBeGreaterThan(
      birdsongLevel(robin, at(43.7, -79.4, 5, 12, 55), 'grass'),
    );
    for (const p of catalog.profiles) {
      const [west, south, east, north] = p.bounds[0] as [number, number, number, number];
      expect(
        birdsongLevel(p, at((south + north) / 2, (west + east) / 2, 5, 0, -35), p.habitats[0]),
      ).toBe(0);
    }
  });

  it('does not substitute local mixed choruses across continents or habitats', () => {
    const amazon = bird('amazon_dawn');
    expect(birdsongLevel(amazon, at(-3.6, -64.9, 9), 'forest')).toBe(1);
    expect(birdsongLevel(amazon, at(-3.6, -64.9, 9), 'grass')).toBe(0);
    expect(birdsongLevel(amazon, at(-3.6, -64.9, 9, 18, 2), 'forest')).toBe(0);
    expect(birdsongLevel(amazon, at(0, 25, 9), 'forest')).toBe(0);
    expect(birdsongLevel(bird('knysna_morning'), at(-34, 23, 11), 'forest')).toBe(1);
    expect(birdsongLevel(bird('mauritius_morning'), at(-20.1, 57.6, 12), 'grass')).toBe(1);
    for (const p of catalog.profiles) {
      expect(birdsongLevel(p, at(-75, 0, 12), 'forest')).toBe(0);
      expect(birdsongLevel(p, undefined, 'forest')).toBe(0);
      expect(birdsongLevel(p, at(43.7, -79.4, 5), undefined)).toBe(0);
    }
  });

  it('rejects malformed catalogs and dangling sound references', async () => {
    for (const doc of [
      { ...catalog, profiles: [{ ...bird('american_robin'), months: [1] }] },
      catalog,
    ]) {
      const warn = vi.fn();
      const loaded = await loadBirdsongProfiles(
        { provided, readJson: async <T>() => doc as T },
        new Set(),
        warn,
      );
      expect(loaded).toEqual([]);
      expect(warn).toHaveBeenCalledOnce();
    }
  });

  it('selects actual voices, suppresses the generic chorus, and preserves altitude/car muting', async () => {
    const bank = {
      format: 'molen/soundbank@1',
      id: 'molen.sounds',
      sounds: Object.fromEntries(
        ['ambience.birds', ...catalog.profiles.map((p) => p.sound)].map((id) => [
          id,
          { clips: [`${id}.mp3`], source: { license: 'CC0-1.0' } },
        ]),
      ),
    };
    const packs = {
      provided: (role: string) =>
        role === 'soundbank'
          ? [{ pack: { manifest: { id: 'molen.sounds' } }, path: 'sounds.soundbank.json' }]
          : provided(role),
      readJson: async <T>(ref: string) => (ref.endsWith('/birdsong.json') ? catalog : bank) as T,
      assetProvider: () => ({ load: async () => new ArrayBuffer(0), loadText: async () => '' }),
    };
    const renderer = {
      camera: { matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0, 1] } },
      getWorldOrigin: () => [0, 0, 0],
    };
    const audio = await createEarthAudio(packs, renderer, { onWarning: () => {} });
    if (!audio) throw new Error('No audio');
    let nowMs = 0;
    const sounds = (location: BirdsongLocation, mode = 'walk', heightAboveGround = 2) => {
      nowMs += 300;
      audio.update({
        nowMs,
        mode,
        heightAboveGround,
        location,
        position: [0, heightAboveGround, 0],
        regionalAmbience: { birds: 1, insects: 0, habitat: 'grass' },
      });
      return audio.layer.director.voices().map((v) => v.sound);
    };
    const toronto = at(43.7, -79.4, 5);
    expect(sounds(toronto)).toContain('ambience.birds.american_robin');
    expect(sounds(toronto)).not.toContain('ambience.birds');
    expect(sounds(at(51.5, -0.1, 5))).toContain('ambience.birds.common_blackbird');
    expect(sounds(at(51.5, -0.1, 5))).not.toContain('ambience.birds.american_robin');
    expect(sounds(toronto, 'drive')).toEqual([]);
    expect(sounds(toronto, 'fly', 100)).toEqual([]);
    expect(sounds(at(-75, 0, 5))).toEqual([]);
    expect(sounds(toronto)).toContain('ambience.birds.american_robin');
    audio.dispose();
  });
});
