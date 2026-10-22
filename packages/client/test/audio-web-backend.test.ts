import { describe, expect, it, vi } from 'vitest';
import { WebAudioBackend } from '../src/audio/web-audio-backend';

function fixture(maxDecodedBytes: number) {
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime() {},
    linearRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const sources: { onended?: () => void }[] = [];
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    close: async () => {},
    createGain: () => ({ gain: parameter(), connect() {}, disconnect() {} }),
    createDynamicsCompressor: () => ({
      threshold: parameter(),
      knee: parameter(),
      ratio: parameter(),
      attack: parameter(),
      release: parameter(),
      connect() {},
      disconnect() {},
    }),
    decodeAudioData: async () => ({ length: 1000, numberOfChannels: 1 }),
    createBufferSource: () => {
      const source = {
        onended: undefined as (() => void) | undefined,
        playbackRate: parameter(),
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
      };
      sources.push(source);
      return source;
    },
  } as unknown as AudioContext;
  const load = vi.fn(async (_ref: string) => new ArrayBuffer(4));
  const backend = new WebAudioBackend({ context, provider: { load }, maxDecodedBytes });
  return { backend, load, sources };
}

describe('Web Audio decoded clip budget', () => {
  it('evicts the least recently used inactive audio as the listener travels', async () => {
    const { backend, load } = fixture(8000); // two 4000-byte PCM buffers
    await backend.preload(['forest']);
    await backend.preload(['beach']);
    await backend.preload(['forest']);
    await backend.preload(['rain']);
    await backend.preload(['forest']);
    expect(load.mock.calls.map(([ref]) => ref)).toEqual(['forest', 'beach', 'rain']);
    await backend.preload(['beach']);
    expect(load.mock.calls.map(([ref]) => ref)).toEqual(['forest', 'beach', 'rain', 'beach']);
    backend.dispose();
  });

  it('keeps playing and fading clips pinned even when they exceed the cache budget', async () => {
    const { backend, load, sources } = fixture(0);
    backend.apply([
      {
        op: 'start',
        voice: 'coast',
        sound: 'coast',
        ref: 'coast.mp3',
        loop: true,
        gain: 0.3,
        pitch: 1,
        bus: 'ambience',
      },
    ]);
    await backend.preload(['coast.mp3']);
    backend.apply([{ op: 'stop', voice: 'coast', fadeS: 5 }]);
    await backend.preload(['coast.mp3']);
    expect(load).toHaveBeenCalledTimes(1);
    sources[0]?.onended?.();
    await backend.preload(['coast.mp3']);
    expect(load).toHaveBeenCalledTimes(2);
    backend.dispose();
  });
});
