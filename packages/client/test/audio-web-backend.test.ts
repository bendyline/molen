import { describe, expect, it, vi } from 'vitest';
import { WebAudioBackend } from '../src/audio/web-audio-backend';

function fixture(maxDecodedBytes: number) {
  const parameter = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const sources: { onended?: () => void }[] = [];
  const filters: {
    frequency: ReturnType<typeof parameter>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const oscillators: {
    frequency: ReturnType<typeof parameter>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    close: async () => {},
    createGain: () => ({ gain: parameter(), connect() {}, disconnect() {} }),
    createBiquadFilter: () => {
      const filter = { frequency: parameter(), Q: parameter(), connect() {}, disconnect: vi.fn() };
      filters.push(filter);
      return filter;
    },
    createOscillator: () => {
      const oscillator = {
        frequency: parameter(),
        connect() {},
        start() {},
        stop: vi.fn(),
        disconnect: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    },
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
  return { backend, load, sources, filters, oscillators };
}

describe('Web Audio decoded clip budget', () => {
  it('modulates the rotor at audio rate and releases its oscillator after the voice ends', async () => {
    const { backend, filters, oscillators, sources } = fixture(8000);
    backend.apply([
      {
        op: 'start',
        voice: 'rotor',
        sound: 'rotor',
        ref: 'rotor.mp3',
        loop: true,
        bus: 'sfx',
        gain: 0.6,
        pitch: 1,
        tone: { lowpassHz: 2000, pulseHz: 8, pulseDepth: 0.2 },
      },
    ]);
    // Changes during decode must reach the eventual source as well.
    backend.apply([
      { op: 'set', voice: 'rotor', tone: { lowpassHz: 5000, pulseHz: 8, pulseDepth: 0.5 } },
    ]);
    await backend.preload(['rotor.mp3']);
    expect(filters).toHaveLength(1);
    expect(oscillators).toHaveLength(1);
    expect(filters[0]!.frequency.setTargetAtTime).toHaveBeenLastCalledWith(
      5000,
      0,
      expect.any(Number),
    );
    expect(oscillators[0]!.frequency.setTargetAtTime).toHaveBeenLastCalledWith(
      8,
      0,
      expect.any(Number),
    );
    backend.apply([{ op: 'stop', voice: 'rotor', fadeS: 0.1 }]);
    sources[0]!.onended?.();
    expect(oscillators[0]!.stop).toHaveBeenCalledOnce();
    expect(filters[0]!.disconnect).toHaveBeenCalledOnce();
    expect(backend.stats().voices).toBe(0);
    backend.dispose();
  });
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
