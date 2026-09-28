import { describe, expect, it } from 'vitest';
import {
  AUDIO_MUSIC,
  AUDIO_PLAY,
  AUDIO_STOP,
  AudioEnvironment,
  audioEnvironmentOf,
  audioScriptApi,
} from '../src/audio';
import { installScripting } from '../src/scripting';
import { stateHash } from '../src/snapshot';
import { runHeadless } from '../src/testing';
import { World } from '../src/world';

const SCRIPT = `
  molen.on('tick', () => {
    if (molen.tick === 2) {
      const h = molen.audio.play('impact.heavy', { entity: 'car', gain: 0.8 });
      molen.audio.play('ui.click');
      molen.audio.stop(h, 0.5);
    }
    if (molen.tick === 4) molen.audio.music('music.ambient.dawn', { crossfadeS: 2 });
    if (molen.tick === 5) molen.audio.music(null);
  });
`;

function build(withAudio: boolean): () => World {
  return () => {
    const w = new World({ tickRate: 30, seed: 'audio' });
    w.spawnRaw({ tag: { name: 'car' } }, 'car');
    installScripting(w, [
      { id: 'sound', source: withAudio ? SCRIPT : `molen.on('tick', () => {});` },
    ]);
    return w;
  };
}

describe('molen.audio', () => {
  it('emits audio.* events a headless run records', () => {
    const run = runHeadless(build(true), { ticks: 8 });
    const audio = run.events.filter((e) => e.event.type.startsWith('audio.'));
    expect(audio.map((e) => [e.tick, e.event.type])).toEqual([
      [2, AUDIO_PLAY],
      [2, AUDIO_PLAY],
      [2, AUDIO_STOP],
      [4, AUDIO_MUSIC],
      [5, AUDIO_MUSIC],
    ]);
    expect(audio[0]?.event.payload).toEqual({
      handle: 'impact.heavy@2#0',
      sound: 'impact.heavy',
      entity: 'car',
      gain: 0.8,
    });
    expect(audio[1]?.event.payload).toMatchObject({ handle: 'ui.click@2#1' });
    expect(audio[2]?.event.payload).toEqual({ handle: 'impact.heavy@2#0', fadeS: 0.5 });
    expect(audio[3]?.event.payload).toEqual({ playlist: ['music.ambient.dawn'], crossfadeS: 2 });
    expect(audio[4]?.event.payload).toEqual({ playlist: null });
  });

  it('never changes the state hash', () => {
    const a = build(true)();
    const b = build(false)();
    a.stepN(8);
    b.stepN(8);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('is a frozen core verb', () => {
    const w = new World({ tickRate: 30, seed: 'x' });
    expect(() =>
      installScripting(w, [{ id: 'bad', source: `molen.audio.play = () => 'x';` }]),
    ).toThrow();
  });

  it('works on a main-thread world without scripts', () => {
    const w = new World({ tickRate: 30, seed: 'x' });
    const seen: string[] = [];
    w.on('*', (e) => seen.push(e.type));
    audioScriptApi(w).play('ui.click');
    expect(seen).toEqual([AUDIO_PLAY]);
  });

  it('finds the audioEnvironment singleton', () => {
    const w = new World({ tickRate: 30, seed: 'x' });
    expect(audioEnvironmentOf(w)).toBeUndefined();
    w.spawnRaw({ audioEnvironment: { buses: { music: 0.5 } } }, 'audio');
    expect(audioEnvironmentOf(w)).toEqual({ buses: { music: 0.5 } });
    expect(w.get('audio', AudioEnvironment)?.buses?.music).toBe(0.5);
  });
});
