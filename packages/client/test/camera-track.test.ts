import { validate } from '@bendyline/molen-schema';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type CameraTrackDoc,
  evaluateCameraTrack,
  registerCameraTrackSchema,
} from '../src/camera-track';

beforeAll(() => registerCameraTrackSchema());

function track(over: Partial<CameraTrackDoc> = {}): CameraTrackDoc {
  return {
    format: 'molen/cameratrack@1',
    easing: 'linear',
    loop: false,
    keyframes: [
      { tick: 0, position: [0, 0, 0], lookAt: [0, 0, 0] },
      { tick: 10, position: [10, 0, 0], lookAt: [5, 0, 0] },
    ],
    ...over,
  };
}

describe('camera-track schema', () => {
  it('validates and applies defaults', () => {
    const r = validate('cameratrack' as never, {
      format: 'molen/cameratrack@1',
      keyframes: [{ tick: 0, position: [0, 0, 0], lookAt: [0, 0, 0] }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as CameraTrackDoc).easing).toBe('smooth');
  });

  it('rejects an empty keyframe list', () => {
    const r = validate('cameratrack' as never, { format: 'molen/cameratrack@1', keyframes: [] });
    expect(r.ok).toBe(false);
  });
});

describe('evaluateCameraTrack', () => {
  it('returns endpoints before/after the range', () => {
    const t = track();
    expect(evaluateCameraTrack(t, -5).position).toEqual([0, 0, 0]);
    expect(evaluateCameraTrack(t, 99).position).toEqual([10, 0, 0]);
  });

  it('linearly interpolates position and lookAt', () => {
    const p = evaluateCameraTrack(track(), 5);
    expect(p.position).toEqual([5, 0, 0]);
    expect(p.lookAt).toEqual([2.5, 0, 0]);
  });

  it('smooth easing differs from linear at the midpoint edges', () => {
    const lin = evaluateCameraTrack(track({ easing: 'linear' }), 2).position[0];
    const sm = evaluateCameraTrack(track({ easing: 'smooth' }), 2).position[0];
    expect(sm).toBeLessThan(lin as number); // smoothstep eases in
  });

  it('loops within the span', () => {
    const t = track({ loop: true });
    // tick 12 -> wraps to tick 2 in a 0..10 span
    expect(evaluateCameraTrack(t, 12).position).toEqual(evaluateCameraTrack(t, 2).position);
  });

  it('interpolates across three keyframes', () => {
    const t = track({
      keyframes: [
        { tick: 0, position: [0, 0, 0], lookAt: [0, 0, 0] },
        { tick: 10, position: [10, 0, 0], lookAt: [0, 0, 0] },
        { tick: 20, position: [10, 10, 0], lookAt: [0, 0, 0] },
      ],
      easing: 'linear',
    });
    expect(evaluateCameraTrack(t, 15).position).toEqual([10, 5, 0]);
  });
});
