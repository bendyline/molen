import type { JsonObject, SoundbankDoc, SoundProfilesDoc } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  AudioDirector,
  type AudioEntitySource,
  type AudioEnvironmentData,
  loudnessToGain,
  mergeSoundbanks,
  mergeSoundProfiles,
  type VoiceCommand,
} from '../src/audio';

const src = { license: 'CC0-1.0' };
const BANK: SoundbankDoc = {
  format: 'molen/soundbank@1',
  id: 'test',
  sounds: {
    'bed.birds': { clips: ['birds.mp3'], loop: true, bus: 'ambience', source: src },
    'bed.roof-rain': { clips: ['roof.mp3'], loop: true, bus: 'ambience', source: src },
    'engine.out': { clips: ['out.mp3'], loop: true, source: src },
    'engine.in': { clips: ['in.mp3'], loop: true, source: src },
    'engine.legacy': { clips: ['legacy.mp3'], loop: true, source: src },
    tires: { clips: ['tires.mp3'], loop: true, source: src },
  },
};

const PROFILES: SoundProfilesDoc = {
  format: 'molen/sound-profiles@1',
  id: 'test',
  components: ['vehicle'],
  match: [
    { profile: 'van', when: { 'renderable.ref': 'van' } },
    { profile: 'car', when: { 'vehicle.kind': 'car' } },
  ],
  profiles: {
    car: {
      cabin: { isolationDb: 30, cutoffHz: 600 },
      layers: [
        { name: 'engine', sound: 'engine.out' },
        { name: 'cabin', sound: 'engine.in', perspective: 'interior' },
        {
          name: 'tires',
          sound: 'tires',
          gainFrom: {
            signal: 'self.speed',
            curve: [
              [1, 0],
              [20, 1],
            ],
          },
        },
      ],
    },
    van: { extends: 'car', layers: [{ name: 'engine', sound: 'engine.legacy' }] },
  },
};

class Source implements AudioEntitySource {
  tick = 0;
  tickRate = 30;
  readonly entities = new Map<string, Record<string, JsonObject>>();
  each(component: string): [string, JsonObject][] {
    const out: [string, JsonObject][] = [];
    for (const [id, c] of this.entities) if (c[component]) out.push([id, c[component]]);
    return out;
  }
  get(id: string, component: string): JsonObject | undefined {
    return this.entities.get(id)?.[component];
  }
  car(id: string, pos: [number, number, number], extra: Record<string, JsonObject> = {}): void {
    this.entities.set(id, {
      transform: { pos, rot: [0, 0, 0, 1] },
      vehicle: { kind: 'car' },
      audioSource: { sound: 'engine.legacy' },
      ...extra,
    });
  }
}

type Start = Extract<VoiceCommand, { op: 'start' }>;
const starts = (cmds: VoiceCommand[]) => cmds.filter((c): c is Start => c.op === 'start');

function director(env: AudioEnvironmentData = {}) {
  return new AudioDirector({
    bank: mergeSoundbanks([BANK]),
    environment: env,
    profiles: mergeSoundProfiles([PROFILES]),
  });
}

/** Run frames 50 ms apart and return every command. */
function run(
  d: AudioDirector,
  frames: number,
  input: Parameters<AudioDirector['update']>[0],
  from = 0,
): VoiceCommand[] {
  const out: VoiceCommand[] = [];
  for (let i = 0; i < frames; i++) out.push(...d.update({ ...input, nowMs: from + i * 50 }));
  return out;
}

describe('sound profiles', () => {
  it('replaces an entity audioSource with its profile layers, extends and all', () => {
    const s = new Source();
    s.car('a', [3, 0, 0]);
    s.car('b', [5, 0, 0], { renderable: { ref: 'van' } });
    const d = director();
    const sounds = starts(run(d, 2, { nowMs: 0, source: s })).map(
      (c) => `${c.voice.split('~')[0]}`,
    );
    expect(sounds).toContain('prof:a:engine');
    expect(sounds).toContain('prof:b:engine');
    expect(sounds.some((v) => v.startsWith('src:'))).toBe(false);
    const b = starts(run(d, 1, { nowMs: 0, source: s }));
    expect(b).toEqual([]);
    expect(d.voices().find((v) => v.key === 'prof:b:engine')?.sound).toBe('engine.legacy');
    // Interior layers wait for a listener in the cabin.
    expect(d.voices().some((v) => v.key.endsWith(':cabin'))).toBe(false);
  });

  it('plays interior layers inside, muffles exterior ones, and applies the profile cabin', () => {
    const s = new Source();
    s.car('a', [0, 1, 0]);
    const d = director();
    const cmds = run(d, 12, {
      nowMs: 0,
      source: s,
      listener: { position: [0, 1.2, 0], space: 'cabin', vehicle: 'a' },
    });
    const cabin = starts(cmds).find((c) => c.voice.startsWith('prof:a:cabin'));
    const engine = starts(cmds).find((c) => c.voice.startsWith('prof:a:engine'));
    expect(cabin?.outside).toBeUndefined();
    expect(engine?.outside).toBe(true);
    const enclosure = cmds.find((c) => c.op === 'enclosure');
    expect(enclosure).toMatchObject({ enclosure: { isolationDb: 30, cutoffHz: 600 } });
  });

  it('voices only the nearest emitters but always the listener vehicle', () => {
    const s = new Source();
    for (let i = 0; i < 6; i++) s.car(`c${i}`, [10 + i * 10, 0, 0]);
    s.car('mine', [300, 0, 0]);
    const d = director({ maxEmitters: 2 });
    run(d, 2, { nowMs: 0, source: s, listener: { position: [0, 0, 0], vehicle: 'mine' } });
    const entities = new Set(d.voices().map((v) => v.entity));
    expect(entities).toEqual(new Set(['mine', 'c0', 'c1']));
  });

  it('does not let silent parked vehicles crowd out the ones that sound', () => {
    const s = new Source();
    // Six parked cars nearer than the one moving car; only moving ones make tire noise.
    for (let i = 0; i < 6; i++)
      s.entities.set(`parked${i}`, {
        transform: { pos: [5 + i, 0, 0], rot: [0, 0, 0, 1] },
        vehicle: { kind: 'bike' },
        renderable: { ref: 'quiet' },
      });
    s.car('moving', [40, 0, 0]);
    const profiles = mergeSoundProfiles([
      {
        ...PROFILES,
        match: [{ profile: 'quiet', when: { 'renderable.ref': 'quiet' } }, ...PROFILES.match],
        profiles: {
          ...PROFILES.profiles,
          quiet: {
            layers: [
              {
                name: 'tires',
                sound: 'tires',
                gainFrom: {
                  signal: 'self.speed',
                  curve: [
                    [1, 0],
                    [20, 1],
                  ],
                },
              },
            ],
          },
        },
      },
    ]);
    const d = new AudioDirector({
      bank: mergeSoundbanks([BANK]),
      environment: { maxEmitters: 2 },
      profiles,
    });
    run(d, 2, { nowMs: 0, source: s });
    expect(new Set(d.voices().map((v) => v.entity))).toEqual(new Set(['moving']));
  });

  it('reads the first engine of a record keyed by engine ids', () => {
    // Engine state is keyed by id (main, left, engine-1...); a profile shared by a fleet says 0.
    const s = new Source();
    s.entities.set('jet', {
      transform: { pos: [5, 0, 0], rot: [0, 0, 0, 1] },
      aircraft: { kind: 'jet', spec: { model: 'airplane' } },
      aircraftState: {
        engines: { 'engine-1': { afterburner: 1 }, 'engine-2': { afterburner: 0 } },
      },
    });
    const profiles = mergeSoundProfiles([
      {
        format: 'molen/sound-profiles@1',
        id: 'jets',
        components: ['aircraft'],
        match: [{ profile: 'jet', when: { 'aircraft.kind': 'jet' } }],
        profiles: {
          jet: {
            layers: [
              {
                name: 'reheat',
                sound: 'engine.out',
                gainFrom: {
                  signal: 'aircraftState.engines.0.afterburner',
                  curve: [
                    [0, 0],
                    [1, 1],
                  ],
                },
              },
            ],
          },
        },
      },
    ]);
    const d = new AudioDirector({ bank: mergeSoundbanks([BANK]), profiles });
    run(d, 4, { nowMs: 0, source: s });
    expect(d.voices().find((v) => v.key === 'prof:jet:reheat')?.gain ?? 0).toBeGreaterThan(0.1);
  });

  it('holds the listener vehicle near a chase camera', () => {
    const s = new Source();
    s.car('a', [0, 0, 20]);
    const d = director();
    run(d, 2, { nowMs: 0, source: s, listener: { position: [0, 0, 0], vehicle: 'a' } });
    const pos = d.voices().find((v) => v.key === 'prof:a:engine')?.position ?? [0, 0, 0];
    expect(Math.hypot(...pos)).toBeCloseTo(6, 5);
  });
});

describe('listener spaces', () => {
  it('routes beds outside the enclosure and inside layers past it', () => {
    const d = director({
      ambience: [{ sound: 'bed.birds' }, { sound: 'bed.roof-rain', inside: true }],
    });
    const cmds = run(d, 2, { nowMs: 0, listener: { space: 'building' } });
    const byVoice = Object.fromEntries(starts(cmds).map((c) => [c.sound, c.outside === true]));
    expect(byVoice).toEqual({ 'bed.birds': true, 'bed.roof-rain': false });
    expect(cmds.find((c) => c.op === 'enclosure')).toMatchObject({
      enclosure: { isolationDb: 26, reverb: 'room' },
    });
  });

  it('adds tunnel reverberation, less of it through a cabin', () => {
    const open = director();
    const tunnel = run(open, 1, { nowMs: 0, listener: { space: 'tunnel' } }).find(
      (c) => c.op === 'enclosure',
    );
    expect(tunnel).toMatchObject({ enclosure: { isolationDb: 0, reverb: 'tunnel', wet: 0.6 } });
    const cabin = run(director(), 1, {
      nowMs: 0,
      listener: { space: 'cabin', reverb: 'tunnel' },
    }).find((c) => c.op === 'enclosure');
    expect(cabin).toMatchObject({ enclosure: { isolationDb: 22, reverb: 'tunnel' } });
  });
});

describe('moving sources', () => {
  it('raises the pitch of an approaching source and lowers a receding one', () => {
    const pitchAt = (dir: 1 | -1): number => {
      const s = new Source();
      const from = dir > 0 ? 50 : 20;
      s.entities.set('x', {
        transform: { pos: [from, 0, 0] },
        audioSource: { sound: 'engine.legacy' },
      });
      const d = new AudioDirector({ bank: mergeSoundbanks([BANK]) });
      for (let i = 0; i <= 10; i++) {
        (s.entities.get('x') as Record<string, JsonObject>).transform = {
          pos: [from - dir * i * 1.5, 0, 0],
        };
        d.update({ nowMs: i * 50, source: s });
      }
      return d.voices().find((v) => v.entity === 'x')?.pitch ?? 1;
    };
    // 30 m/s: about 9% up toward, 8% down away.
    expect(pitchAt(1)).toBeGreaterThan(1.07);
    expect(pitchAt(-1)).toBeLessThan(0.94);
  });

  it('lets a loud nearby source mask the beds', () => {
    const s = new Source();
    const d = new AudioDirector({
      bank: mergeSoundbanks([BANK]),
      environment: { ambience: [{ sound: 'bed.birds' }] },
    });
    run(d, 4, { nowMs: 0, source: s });
    const quiet = d.voices().find((v) => v.sound === 'bed.birds')?.gain ?? 0;
    s.entities.set('x', { transform: { pos: [1, 0, 0] }, audioSource: { sound: 'engine.legacy' } });
    run(d, 60, { nowMs: 0, source: s }, 200);
    const masked = d.voices().find((v) => v.sound === 'bed.birds')?.gain ?? 0;
    expect(quiet).toBeCloseTo(1, 5);
    expect(masked).toBeLessThan(0.6);
  });
});

describe('volume', () => {
  it('follows loudness: half way is half as loud', () => {
    expect(loudnessToGain(1)).toBe(1);
    expect(loudnessToGain(0)).toBe(0);
    expect(20 * Math.log10(loudnessToGain(0.5))).toBeCloseTo(-10, 5);
  });
});
