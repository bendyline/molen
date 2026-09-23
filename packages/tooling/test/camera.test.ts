import type { SceneManifest } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { cameraFromManifest } from '../src/ops/camera';

function scene(extra: Record<string, unknown>): SceneManifest {
  const r = validate('scene', { format: 'molen/scene@3', name: 'cam', ...extra });
  if (!r.ok) throw new Error(r.formatted);
  return r.value;
}

describe('cameraFromManifest', () => {
  it('maps fixed and free-fly to a perspective pose', () => {
    expect(
      cameraFromManifest(
        scene({ camera: { mode: 'fixed', position: [0, 6, 16], lookAt: [0, 0, 0] } }),
      ),
    ).toEqual({ camera: { position: [0, 6, 16], lookAt: [0, 0, 0] }, ortho: null });
    expect(
      cameraFromManifest(scene({ camera: { mode: 'free-fly', position: [1, 2, 3] } })),
    ).toEqual({ camera: { position: [1, 2, 3] }, ortho: null });
  });

  it('maps top-down-ortho to an ortho framing (the case that used to crash captures)', () => {
    expect(
      cameraFromManifest(
        scene({ camera: { mode: 'top-down-ortho', center: [0, 0], viewHeight: 26 } }),
      ),
    ).toEqual({ camera: null, ortho: { center: [0, 0], viewHeight: 26 } });
  });

  it('an explicit override wins; no camera block yields neither', () => {
    const s = scene({ camera: { mode: 'top-down-ortho', center: [0, 0], viewHeight: 26 } });
    expect(cameraFromManifest(s, { position: [0, 30, 13], lookAt: [0, 0, 0] })).toEqual({
      camera: { position: [0, 30, 13], lookAt: [0, 0, 0] },
      ortho: null,
    });
    expect(cameraFromManifest(scene({}))).toEqual({ camera: null, ortho: null });
  });
});
