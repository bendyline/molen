import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { probeAudio } from '../src/audio-probe';
import { checkSoundbank, importSound, planAudio } from '../src/ops/index';

/** A mono 16-bit PCM WAV of `seconds` silence. */
function wav(seconds: number, rate = 8000): Uint8Array {
  const samples = Math.round(seconds * rate);
  const b = new Uint8Array(44 + samples * 2);
  const v = new DataView(b.buffer);
  const put = (at: number, s: string): void => {
    for (const [i, c] of [...s].entries()) v.setUint8(at + i, c.charCodeAt(0));
  };
  put(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  put(36, 'data');
  v.setUint32(40, samples * 2, true);
  return b;
}

describe('probeAudio', () => {
  it('reads WAV durations and rejects unknown data', () => {
    expect(probeAudio(wav(0.5))).toMatchObject({ format: 'wav', durationS: 0.5, channels: 1 });
    expect(probeAudio(new Uint8Array([1, 2, 3, 4])).format).toBe('unknown');
  });
});

describe('import_sound + check_soundbank', () => {
  it('imports with provenance, appends variations and enforces the license policy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'molen-audio-'));
    const bankPath = join(dir, 'bank', 'sounds.soundbank.json');
    await writeFile(join(dir, 'a.wav'), wav(0.5));
    await writeFile(join(dir, 'b.wav'), wav(0.25));
    const first = await importSound({
      file: join(dir, 'a.wav'),
      id: 'ui.beep',
      bankPath,
      license: 'CC0-1.0',
      source: 'https://example.com/beep',
      description: 'A beep.',
    });
    expect(first.ok).toBe(true);
    expect(first.entry).toMatchObject({
      clips: ['audio/a.wav'],
      durationS: 0.5,
      source: { license: 'CC0-1.0', url: 'https://example.com/beep' },
    });
    const second = await importSound({
      file: join(dir, 'b.wav'),
      id: 'ui.beep',
      bankPath,
      license: 'CC0-1.0',
      append: true,
    });
    expect(second.entry?.clips).toEqual(['audio/a.wav', 'audio/b.wav']);

    const bank = JSON.parse(await readFile(bankPath, 'utf8'));
    await writeFile(bankPath, JSON.stringify({ ...bank, license: 'CC0-1.0' }));
    const rejected = await importSound({
      file: join(dir, 'a.wav'),
      id: 'ui.other',
      bankPath,
      license: 'CC-BY-4.0',
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toContain('license');

    expect((await checkSoundbank({ bankPath })).ok).toBe(true);
    await writeFile(join(dir, 'bank', 'audio', 'a.wav'), wav(0.9));
    const broken = await checkSoundbank({ bankPath });
    expect(broken.ok).toBe(false);
    expect(broken.issues.map((i) => i.path)).toContain('/sounds/ui.beep/hash');
  });
});

describe('plan_audio', () => {
  it('reports loops, one-shots, script events and unknown ids for a headless run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'molen-plan-'));
    const bankPath = join(dir, 'bank.json');
    const src = { license: 'CC0-1.0' };
    await writeFile(
      bankPath,
      JSON.stringify({
        format: 'molen/soundbank@1',
        id: 'test',
        sounds: {
          'ambience.rain': { clips: ['rain.mp3'], loop: true, bus: 'ambience', source: src },
          'engine.car': { clips: ['engine.mp3'], loop: true, source: src },
          'impact.heavy': { clips: ['hit.mp3'], durationS: 0.5, source: src },
          'ui.click': { clips: ['click.mp3'], durationS: 0.1, source: src },
        },
      }),
    );
    const r = await planAudio({
      bankPaths: [bankPath],
      ticks: 30,
      weather: 'rain',
      scene: {
        format: 'molen/scene@3',
        name: 'plan',
        camera: { mode: 'fixed', position: [0, 5, 10], lookAt: [0, 0, 0] },
        entities: [
          {
            id: 'audio',
            components: {
              audioEnvironment: {
                ambience: [
                  { sound: 'ambience.rain', when: { 'weather.precipitation.kind': 'rain' } },
                ],
                events: { bang: { sound: 'impact.heavy' } },
              },
            },
          },
          {
            id: 'car',
            components: {
              transform: { pos: [2, 0, 0], rot: [0, 0, 0, 1] },
              audioSource: {
                sound: 'engine.car',
                pitchFrom: {
                  signal: 'car.speed',
                  curve: [
                    [0, 1],
                    [1, 2],
                  ],
                },
              },
            },
          },
          { id: 'typo', components: { audioSource: { sound: 'engine.carr' } } },
        ],
        scripts: [
          {
            id: 's',
            code: `molen.on('tick', () => {
              if (molen.tick === 5) molen.emit('bang', { entity: 'car' });
              if (molen.tick === 10) molen.audio.play('ui.click');
            });`,
          },
        ],
      } as never,
    });
    expect(r.error).toBeUndefined();
    expect(r.voices.map((v) => v.sound).sort()).toEqual(['ambience.rain', 'engine.car']);
    expect(r.voices.find((v) => v.sound === 'engine.car')?.entity).toBe('car');
    expect(r.oneShots.map((s) => [s.tick, s.sound])).toEqual([
      [6, 'impact.heavy'],
      [11, 'ui.click'],
    ]);
    expect(r.oneShots[0]?.position).toEqual([2, 0, 0]);
    expect(r.events.map((e) => e.type)).toEqual(['audio.play']);
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.message).toContain('did you mean "engine.car"');
    expect(r.timeline).toContain('ambience.rain');
  });
});
