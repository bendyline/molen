import { afterEach, expect, it, vi } from 'vitest';
import { createAudioLayer, createRecordingBackend } from '../src/audio';

afterEach(() => vi.unstubAllGlobals());

it('keeps a host audio suspension when visibility returns, including hidden startup', () => {
  const doc = Object.assign(new EventTarget(), { hidden: true });
  vi.stubGlobal('document', doc);
  const suspended = vi.fn();
  const layer = createAudioLayer({
    banks: [],
    backend: { ...createRecordingBackend(), setSuspended: suspended },
  });
  expect(suspended).toHaveBeenLastCalledWith(true);
  layer.setSuspended(true);
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  expect(suspended).toHaveBeenLastCalledWith(true);
  layer.setSuspended(false);
  expect(suspended).toHaveBeenLastCalledWith(false);
  layer.dispose();
  suspended.mockClear();
  doc.dispatchEvent(new Event('visibilitychange'));
  expect(suspended).not.toHaveBeenCalled();
});
