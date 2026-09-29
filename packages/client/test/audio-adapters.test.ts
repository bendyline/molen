import { readFileSync } from 'node:fs';
import type { EngineEvent, JsonObject } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { entitySourceFromClient, listenerFromCamera } from '../src/audio';

describe('entitySourceFromClient', () => {
  it('memoizes reads per mirrored tick and forwards every event', () => {
    let gets = 0;
    const events: ((e: EngineEvent, t: number) => void)[] = [];
    const client = {
      tick: 3 as number | undefined,
      entities: () => ['a', 'b'],
      get(id: string, c: string): JsonObject | undefined {
        gets++;
        return c === 'audioSource' && id === 'b' ? { sound: 'x' } : undefined;
      },
      onEvent(type: string, cb: (e: EngineEvent, t: number) => void) {
        expect(type).toBe('*');
        events.push(cb);
        return () => {};
      },
    };
    const source = entitySourceFromClient(client, { tickRate: 20 });
    expect([...source.each('audioSource')]).toEqual([['b', { sound: 'x' }]]);
    expect([...source.each('audioSource')]).toHaveLength(1);
    expect(source.get('b', 'audioSource')).toEqual({ sound: 'x' });
    expect(gets).toBe(2);
    client.tick = 4;
    source.each('audioSource');
    expect(gets).toBe(4);
    expect(source.tickRate).toBe(20);
    const seen: string[] = [];
    source.onEvent?.((e) => seen.push(e.type));
    events[0]?.({ type: 'crash', payload: null }, 4);
    expect(seen).toEqual(['crash']);
  });
});

describe('listenerFromCamera', () => {
  it('reads pose from the world matrix and adds the floating origin back', () => {
    // Camera at render-space (1, 2, 3), identity rotation: looks down -Z with +Y up.
    const elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1];
    const pose = listenerFromCamera({ matrixWorld: { elements } }, [1000, 0, -500]);
    expect(pose.position).toEqual([1001, 2, -497]);
    expect(pose.forward).toEqual([-0, -0, -1]);
    expect(pose.up).toEqual([0, 1, 0]);
  });
});

describe('/audio boundary', () => {
  it('ships without importing three at runtime', () => {
    const built = new URL('../dist/audio.mjs', import.meta.url);
    const text = readFileSync(built, 'utf8');
    expect(/from\s*["']three/.test(text)).toBe(false);
  });
});

describe('loadPackSoundbanks', () => {
  it('roots clip refs in their pack and skips invalid banks', async () => {
    const { loadPackSoundbanks } = await import('../src/audio');
    const docs: Record<string, unknown> = {
      'pack:molen.sounds/sounds.soundbank.json': {
        format: 'molen/soundbank@1',
        id: 'molen.sounds',
        sounds: { 'ui.click': { clips: ['audio/ui/click.mp3'], source: { license: 'CC0-1.0' } } },
      },
      'pack:bad/banks/b.json': { format: 'molen/soundbank@1' },
    };
    const warnings: string[] = [];
    const banks = await loadPackSoundbanks(
      {
        provided: () => [
          { pack: { manifest: { id: 'molen.sounds' } }, path: 'sounds.soundbank.json' },
          { pack: { manifest: { id: 'bad' } }, path: 'banks/b.json' },
        ],
        readJson: async <T>(ref: string) => docs[ref] as T,
      },
      (m) => warnings.push(m),
    );
    expect(banks.map((b) => b.base)).toEqual(['pack:molen.sounds/']);
    expect(warnings).toHaveLength(1);
  });
});
