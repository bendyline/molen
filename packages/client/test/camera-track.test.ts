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

describe('camera-track cuts, tracking and field of view', () => {
  it('jumps to a cut keyframe instead of interpolating into it', () => {
    const t = track({
      keyframes: [
        { tick: 0, position: [0, 0, 0], lookAt: [0, 0, 0] },
        { tick: 10, position: [10, 0, 0], lookAt: [5, 0, 0], cut: true },
      ],
    });
    expect(evaluateCameraTrack(t, 9).position).toEqual([0, 0, 0]);
    expect(evaluateCameraTrack(t, 10).position).toEqual([10, 0, 0]);
  });

  it('offsets relative keyframes from an entity at playback time', () => {
    const t = track({
      keyframes: [{ tick: 0, position: [0, 2, 6], lookAt: [0, 1, 0], relativeTo: 'ana' }],
    });
    const pose = evaluateCameraTrack(t, 0, {
      resolve: (id) => (id === 'ana' ? [3, 0, -1] : undefined),
    });
    expect(pose.position).toEqual([3, 2, 5]);
    expect(pose.lookAt).toEqual([3, 1, -1]);
    // without a resolver the offsets stand as points
    expect(evaluateCameraTrack(t, 0).position).toEqual([0, 2, 6]);
  });

  it('interpolates fov and carries it forward', () => {
    const t = track({
      keyframes: [
        { tick: 0, position: [0, 0, 0], lookAt: [0, 0, 1], fov: 60 },
        { tick: 10, position: [0, 0, 0], lookAt: [0, 0, 1], fov: 40 },
        { tick: 20, position: [0, 0, 0], lookAt: [0, 0, 1] },
      ],
    });
    expect(evaluateCameraTrack(t, 5).fov).toBe(50);
    expect(evaluateCameraTrack(t, 15).fov).toBe(40);
  });

  it('validates an inline scene track and rejects an unknown relativeTo', () => {
    const scene = (relativeTo: string) =>
      validate('scene', {
        format: 'molen/scene@3',
        name: 'film',
        entities: [{ id: 'ana', components: { transform: { pos: [0, 0, 0] } } }],
        cameraTrack: {
          keyframes: [{ tick: 0, position: [0, 2, 6], lookAt: [0, 1, 0], relativeTo }],
        },
      });
    expect(scene('ana').ok).toBe(true);
    const bad = scene('anna');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.formatted).toContain('did you mean "ana"?');
  });
});
