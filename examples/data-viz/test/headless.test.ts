import {
  type CameraTrackDoc,
  evaluateCameraTrack,
  registerCameraTrackSchema,
} from '@bendyline/molen-client/camera-track';
import { buildWorld, defineComponent, type World } from '@bendyline/molen-kernel';
import { runHeadless } from '@bendyline/molen-kernel/testing';
import { validate, validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import trackDoc from '../camera-track.json';
import sceneDoc from '../scene.json';
import { DATA, setup } from '../src/viz';

registerCameraTrackSchema();

const Bar = defineComponent<{ target: number; t: number }>('bar');
const Transform = defineComponent<{
  pos: [number, number, number];
  scale?: [number, number, number];
}>('transform');

function build(): World {
  const r = validate('scene', sceneDoc);
  if (!r.ok) throw new Error(r.formatted);
  return buildWorld(r.value, setup);
}

describe('data-viz (headless)', () => {
  it('binds the dataset to one bar per datum', () => {
    const w = build();
    expect(w.query(Bar).count()).toBe(DATA.length);
    expect(w.exists('bar-0')).toBe(true);
    expect(w.get('bar-3', Bar)?.target).toBe(DATA[3]?.value);
  });

  it('bars grow from the ground over time', () => {
    const w = build();
    const startH = w.get('bar-5', Transform)?.scale?.[1] ?? 0;
    w.stepN(40);
    const grownH = w.get('bar-5', Transform)?.scale?.[1] ?? 0;
    expect(grownH).toBeGreaterThan(startH);
    // reaches its target height (value * heightScale) once the animation completes
    expect(grownH).toBeCloseTo((DATA[5]?.value ?? 0) * 0.9, 1);
  });

  it('bar height encodes the data value (taller = bigger)', () => {
    const w = build();
    w.stepN(60);
    const hJun = w.get('bar-5', Transform)?.scale?.[1] ?? 0; // value 11 (max)
    const hJan = w.get('bar-0', Transform)?.scale?.[1] ?? 0; // value 4
    expect(hJun).toBeGreaterThan(hJan);
  });

  // Pinned: run-to-run equality cannot notice a databinding or easing change that moves both.
  it('matches the pinned state hash across engine versions', () => {
    expect(runHeadless(build, { ticks: 60 }).finalHash).toBe(
      'sha256:e0c4277d900fd86e892894c77a31cae5fbb0898140f72794de2294f14da58e30',
    );
  });

  it('is deterministic', () => {
    const a = runHeadless(build, { ticks: 60 });
    const b = runHeadless(build, { ticks: 60 });
    expect(a.finalHash).toBe(b.finalHash);
  });

  it('the camera track validates and orbits the chart', () => {
    const r = validateByKind('cameratrack', trackDoc);
    expect(r.ok).toBe(true);
    const track = trackDoc as CameraTrackDoc;
    const p0 = evaluateCameraTrack(track, 0).position;
    const p60 = evaluateCameraTrack(track, 60).position;
    expect(p0).not.toEqual(p60); // camera moved
  });
});
