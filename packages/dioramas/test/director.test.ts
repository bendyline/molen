import { describe, expect, it, vi } from 'vitest';
import { DioramaDirector } from '../src/client/director';
import type { DioramaDefinition, DioramaInstance } from '../src/types';

const definition: DioramaDefinition = {
  scene: { format: 'molen/scene@3', name: 'empty', entities: [] },
  bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('on-demand lifecycle', () => {
  it('uses the latest anchor when asynchronous visual construction finishes', async () => {
    const ready = deferred<DioramaInstance>();
    const create = vi.fn(() => ready.promise);
    const setPosition = vi.fn();
    const director = new DioramaDirector({ create });
    director.add({ id: 'field', position: [0, 0, 0], load: async () => definition });
    director.update([0, 0, 0], 0, 0);
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
    director.setPosition('field', [0, 3, 0]);
    ready.resolve({ update: vi.fn(), dispose: vi.fn(), setPosition });
    await director.whenIdle();
    expect(setPosition).toHaveBeenLastCalledWith([0, 3, 0]);
    director.setPosition('field', [0, 4, 0]);
    expect(setPosition).toHaveBeenLastCalledWith([0, 4, 0]);
    expect(create).toHaveBeenCalledOnce();
    director.dispose();
  });
  it('loads only nearby, honors schedules and hysteresis, and releases its slot', async () => {
    const dispose = vi.fn(),
      update = vi.fn(),
      load = vi.fn(async () => definition);
    const director = new DioramaDirector({ maxActive: 1, create: () => ({ dispose, update }) });
    director.add({
      id: 'a',
      position: [0, 0, 0],
      enterDistance: 10,
      exitDistance: 15,
      load,
      active: (time) => time >= 100,
    });
    director.update([0, 0, 0], 0, 0);
    director.update([20, 0, 0], 0, 100);
    await director.whenIdle();
    expect(load).not.toHaveBeenCalled();
    director.update([0, 0, 0], 0, 100);
    await director.whenIdle();
    expect(director.status('a')).toBe('playing');
    director.update([14, 0, 0], 0.1, 101);
    expect(update).toHaveBeenCalledWith(0.1);
    director.update([16, 0, 0], 0.1, 102);
    expect(dispose).toHaveBeenCalledTimes(1);
    director.update([0, 0, 0], 0, 200);
    await director.whenIdle();
    expect(load).toHaveBeenCalledTimes(2);
    director.update([0, 0, 0], 0, 0);
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it('counts loading slots and never resurrects a removed placement from a late load', async () => {
    const pending = deferred<DioramaDefinition>();
    const create = vi.fn(() => ({ dispose: vi.fn(), update: vi.fn() }));
    let signal: AbortSignal | undefined;
    const director = new DioramaDirector({ maxActive: 1, create });
    director.add({
      id: 'a',
      position: [0, 0, 0],
      load: async (s) => {
        signal = s;
        return pending.promise;
      },
    });
    const other = vi.fn(async () => definition);
    director.add({ id: 'b', position: [5, 0, 0], load: other });
    director.update([0, 0, 0], 0, 0);
    await Promise.resolve();
    expect(other).not.toHaveBeenCalled();
    director.remove('a');
    pending.resolve(definition);
    await director.whenIdle();
    expect(signal?.aborted).toBe(true);
    expect(create).not.toHaveBeenCalled();
    director.update([0, 0, 0], 0, 0);
    await director.whenIdle();
    expect(other).toHaveBeenCalledOnce();
  });

  it('disposes a visual that finishes construction after cancellation', async () => {
    const ready = deferred<DioramaInstance>();
    const create = vi.fn(() => ready.promise);
    const dispose = vi.fn();
    const director = new DioramaDirector({ create });
    director.add({ id: 'a', position: [0, 0, 0], load: async () => definition });
    director.update([0, 0, 0], 0, 0);
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    director.dispose();
    ready.resolve({ dispose, update: vi.fn() });
    await director.whenIdle();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('isolates load and script failures without retry storms', async () => {
    const load = vi.fn(async () => {
      throw new Error('offline');
    });
    const error = vi.fn();
    const director = new DioramaDirector({
      create: () => ({
        update: () => {
          throw new Error('script');
        },
        dispose: vi.fn(),
      }),
      onError: error,
    });
    director.add({ id: 'bad', position: [0, 0, 0], load });
    director.add({ id: 'script', position: [0, 0, 0], load: async () => definition });
    director.update([0, 0, 0], 0, 0);
    await director.whenIdle();
    for (let i = 0; i < 5; i++) director.update([0, 0, 0], 0.1, i);
    expect(load).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledTimes(2);
    expect(director.status('script')).toBe('failed');
    director.retry('bad');
    director.update([0, 0, 0], 0, 0);
    await director.whenIdle();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
