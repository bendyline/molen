import { describe, expect, it } from 'vitest';
import {
  AUDIO_SIGNALS,
  audioSignalIssues,
  audioSignalRefs,
  audioSoundRefs,
  SOUNDBANK_EXAMPLE,
} from '../src/audio';
import { componentIssues } from '../src/components';
import { validate } from '../src/formats';

const bank = (sounds: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  format: 'molen/soundbank@1',
  id: 'test.sounds',
  ...extra,
  sounds,
});

describe('soundbank format', () => {
  it('accepts the registered example', () => {
    const r = validate('soundbank', SOUNDBANK_EXAMPLE);
    expect(r.ok).toBe(true);
  });

  it('requires provenance and at least one clip', () => {
    expect(validate('soundbank', bank({ a: { clips: ['a.mp3'] } })).ok).toBe(false);
    expect(
      validate('soundbank', bank({ a: { clips: [], source: { license: 'CC0-1.0' } } })).ok,
    ).toBe(false);
  });

  it('rejects bad loop ranges, reversed pitch and escaping clip paths', () => {
    const r = validate(
      'soundbank',
      bank({
        a: {
          clips: ['../a.mp3'],
          loopStart: 2,
          loopEnd: 1,
          pitch: [1.2, 0.8],
          source: { license: 'CC0-1.0' },
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const codes = r.issues.map((i) => i.code).sort();
    expect(codes).toEqual(['clip_path', 'loop_range', 'pitch_range']);
  });

  it('enforces a bank-wide license policy', () => {
    const r = validate(
      'soundbank',
      bank({ a: { clips: ['a.mp3'], source: { license: 'CC-BY-4.0' } } }, { license: 'CC0-1.0' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.code).toBe('license_policy');
  });

  it('rejects malformed sound ids', () => {
    expect(
      validate('soundbank', bank({ 'Rain Loop': { clips: ['a.mp3'], source: { license: 'x' } } }))
        .ok,
    ).toBe(false);
  });
});

describe('audio components', () => {
  it('validates the documented shapes', () => {
    expect(
      componentIssues(
        'audioSource',
        {
          sound: 'vehicle.engine.car',
          loop: true,
          spatial: { refDistance: 3 },
          pitchFrom: {
            signal: 'vehicleState.speed',
            curve: [
              [0, 0.8],
              [30, 1.7],
            ],
          },
          triggerFrom: { signal: 'listener.distance', every: 0.75, sound: 'footstep.grass' },
          when: { 'weather.precipitation.kind': ['rain', 'snow'], 'sky.daylight': { min: 0.2 } },
        },
        '/audioSource',
      ),
    ).toEqual([]);
    expect(
      componentIssues(
        'audioZone',
        { sound: 'ambience.water', shape: { kind: 'box', halfExtents: [4, 2, 4] } },
        '/audioZone',
      ),
    ).toEqual([]);
  });

  it('accepts a list of bindings whose curves multiply', () => {
    const layer = {
      ambience: [
        {
          sound: 'ambience.birds',
          gainFrom: [
            {
              signal: 'listener.heightAboveGround',
              curve: [
                [3, 1],
                [200, 0],
              ],
            },
            {
              signal: 'host.streetDistance',
              curve: [
                [0, 0.3],
                [80, 1],
              ],
            },
          ],
        },
      ],
    };
    expect(componentIssues('audioEnvironment', layer, '/audioEnvironment')).toEqual([]);
    expect(
      componentIssues('audioEnvironment', { ambience: [{ sound: 'a', gainFrom: [] }] }, '/x'),
    ).not.toEqual([]);
    expect(audioSignalRefs('audioEnvironment', layer).map((r) => r.path)).toEqual([
      '/ambience/0/gainFrom/0/signal',
      '/ambience/0/gainFrom/1/signal',
    ]);
  });

  it('catches field typos with did-you-mean', () => {
    const issues = componentIssues('audioSource', { sound: 'x', pitchFrm: {} }, '/audioSource');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('accepts a scene carrying audio components', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'audio-test',
      entities: [
        {
          id: 'audio',
          components: {
            audioEnvironment: {
              ambience: [
                {
                  sound: 'ambience.wind',
                  gainFrom: {
                    signal: 'weather.windSpeed',
                    curve: [
                      [0, 0],
                      [10, 1],
                    ],
                  },
                },
              ],
              events: { crash: { sound: 'impact.heavy' } },
            },
          },
        },
      ],
    });
    expect(r.ok).toBe(true);
  });
});

describe('signals', () => {
  it('knows the built-ins and suggests near misses', () => {
    for (const name of Object.keys(AUDIO_SIGNALS)) expect(audioSignalIssues(name)).toEqual([]);
    expect(audioSignalIssues('vehicleState.speed')).toEqual([]);
    expect(audioSignalIssues('host.landcover')).toEqual([]);
    const miss = audioSignalIssues('weather.windspeed');
    expect(miss[0]?.hint).toContain('weather.windSpeed');
    expect(audioSignalIssues('speed')[0]?.code).toBe('audio_signal');
  });

  it('collects signal and sound references with pointers', () => {
    const env = {
      ambience: [{ sound: 'a', when: { 'sky.daylight': { min: 0.3 } } }],
      music: { playlist: ['m1', 'm2'] },
      footsteps: { sound: 'f', surfaces: { wood: 'f.wood' } },
    };
    expect(audioSignalRefs('audioEnvironment', env)).toEqual([
      { signal: 'sky.daylight', path: '/ambience/0/when/sky.daylight' },
    ]);
    expect(audioSoundRefs('audioEnvironment', env).map((r) => r.sound)).toEqual([
      'a',
      'm1',
      'm2',
      'f',
      'f.wood',
    ]);
  });
});
