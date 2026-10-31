import { afterEach, expect, it, vi } from 'vitest';
import { createPlayback } from '../../../examples/shared/playback';

afterEach(() => vi.unstubAllGlobals());

it('pauses the example worker and manual render loop on blur, preserving a user pause', () => {
  const win = new EventTarget();
  const button = Object.assign(new EventTarget(), { remove: vi.fn() });
  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    hasFocus: () => true,
    createElement: () => button,
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  const frames = new Map<number, (now: number) => void>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle));
  const client = { tick: 0, control: vi.fn(), renderFrame: vi.fn() };
  const playback = createPlayback({
    client,
    canvas: Object.assign(new EventTarget(), { dataset: {} }) as HTMLCanvasElement,
    container: { append: vi.fn() } as unknown as HTMLElement,
  });
  expect(frames.size).toBe(1);
  const draws = client.renderFrame.mock.calls.length;
  win.dispatchEvent(new Event('blur'));
  expect(client.control).toHaveBeenLastCalledWith({ action: 'pause' });
  expect(frames.size).toBe(0);
  playback.draw();
  expect(client.renderFrame).toHaveBeenCalledTimes(draws);
  win.dispatchEvent(new Event('focus'));
  expect(client.control).toHaveBeenLastCalledWith({ action: 'resume' });
  expect(frames.size).toBe(1);
  playback.setPaused(true);
  win.dispatchEvent(new Event('blur'));
  win.dispatchEvent(new Event('focus'));
  expect(playback.paused).toBe(true);
  expect(frames.size).toBe(0);
  playback.dispose();
  client.control.mockClear();
  win.dispatchEvent(new Event('blur'));
  expect(client.control).not.toHaveBeenCalled();
});
