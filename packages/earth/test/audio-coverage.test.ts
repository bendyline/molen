import { readFileSync } from 'node:fs';
import { evalWhen, mergeSoundProfiles, type SignalContext } from '@bendyline/molen-client/audio';
import { type SoundbankDoc, type SoundProfilesDoc, validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { soundscapeEntryIssue } from '../src/client/soundscape-catalog';

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(`../../../content/${path}`, import.meta.url), 'utf8')) as T;
const bank = read<SoundbankDoc>('sounds/sounds.soundbank.json');
const profilesDoc = read<SoundProfilesDoc>('sounds/sound-profiles.json');
const catalog = read<{ entries: { sound: string }[] }>('sounds/soundscape.json');
const TYPE_FILES = [
  'aircraft.types.json',
  'vehicle.types.json',
  'cycle.types.json',
  'rail.types.json',
  'transit.types.json',
  'watercraft.types.json',
];

/** The sounds a profile, the catalog or the Earth host may play, by where they are named. */
function referencedSounds(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, p] of Object.entries(profilesDoc.profiles)) {
    for (const layer of p.layers ?? []) {
      out.set(layer.sound, `profile ${id}/${layer.name}`);
      if (layer.triggerFrom?.sound) out.set(layer.triggerFrom.sound, `profile ${id}/${layer.name}`);
    }
    for (const key of ['horn', 'start', 'stop'] as const)
      if (p[key]) out.set(p[key] as string, `profile ${id}.${key}`);
  }
  for (const e of catalog.entries) out.set(e.sound, 'soundscape catalog');
  for (const s of [
    'street.horn.car',
    'street.horn.truck',
    'street.horn.scooter',
    'street.siren.north-america',
    'street.siren.europe',
    'street.siren.japan',
    'street.motorcycle-pass',
    'street.bus-pull-away',
    'street.dog',
    'street.crow.america',
    'street.crow.japan',
    'ambience.thunder.storm',
    'ambience.rain.roof',
    'vehicle.brake.air',
    'world.rail-crossing.north-america.457125',
    'world.rail-crossing.europe.574678',
    'world.rail-crossing.japan.872621',
  ])
    out.set(s, 'Earth host');
  return out;
}

describe('every vehicle has a voice', () => {
  it('validates the profile document', () => {
    const result = validate('sound-profiles', profilesDoc);
    expect(result.ok ? [] : result.formatted).toEqual([]);
  });

  it('builds a valid pack that provides the profiles where the client looks', () => {
    // A role the pack schema rejects fails the pack build, and the explorer keeps serving the
    // previous pack, in which no vehicle has a voice.
    const source = read<{ provides: Record<string, unknown> }>('sounds/molen-pack.source.json');
    const result = validate('pack-source', source);
    expect(result.ok ? [] : result.formatted).toEqual([]);
    expect(Object.keys(source.provides)).toEqual(
      expect.arrayContaining(['soundbank', 'sound-profiles', 'soundscape', 'birdsong']),
    );
  });

  it('matches every boardable entity type to a profile of its own family', () => {
    const set = mergeSoundProfiles([profilesDoc]);
    const unmatched: string[] = [];
    for (const file of TYPE_FILES) {
      const doc = read<{ types: Record<string, { components: Record<string, unknown> }> }>(
        `entities/types/${file}`,
      );
      for (const [id, type] of Object.entries(doc.types ?? doc)) {
        const components = { ...type.components, renderable: { ref: id } };
        const ctx = {
          listener: {
            position: [0, 0, 0],
            forward: [0, 0, -1],
            up: [0, 1, 0],
            speed: 0,
            distance: 0,
          },
          signals: {},
          source: {
            tick: 0,
            each: () => [],
            get: (_: string, c: string) => components[c] as never,
          },
          entity: id,
          motion: new Map(),
          occupied: new Set(),
          seconds: 0,
        } as unknown as SignalContext;
        const rule = set.match.find((r) => evalWhen(r.when, ctx));
        // The explicit type lists come first; a type caught only by a generic fallback rule
        // means the generator has not seen it.
        if (!rule || !Array.isArray(rule.when['renderable.ref'])) unmatched.push(id);
      }
    }
    expect(unmatched).toEqual([]);
  });

  it('names only sounds the bank has', () => {
    const missing = [...referencedSounds()]
      .filter(([sound]) => !bank.sounds[sound])
      .map(([sound, where]) => `${sound} (${where})`);
    expect(missing).toEqual([]);
  });

  it('keeps every catalog entry well formed and every generated sound sourced', () => {
    for (const entry of catalog.entries)
      expect(soundscapeEntryIssue(entry), entry.sound).toBeUndefined();
    for (const [id, s] of Object.entries(bank.sounds)) {
      expect(s.source.license, id).toBe('CC0-1.0');
      if (s.source.site === 'molen') expect(s.source.generator, id).toMatch(/^tools\/synth\.mjs /);
      else expect(s.source.url, id).toMatch(/^https:\/\//);
    }
  });
});
