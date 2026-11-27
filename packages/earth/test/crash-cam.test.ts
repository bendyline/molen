import { describe, expect, it } from 'vitest';
import {
  CrashCam,
  type CrashCamSubject,
  type CrashCamWorld,
  crashCamSettings,
} from '../src/client/crash-cam';

const OPEN: CrashCamWorld = { groundHeight: () => 0, blocked: () => undefined };
const DT = 1 / 60;

/** A sedan driving north (-z) at `speed`, `broken` parts gone, at `z`. */
function car(z: number, broken = 0): CrashCamSubject {
  return { id: 'car', kind: 'vehicle', center: [0, 0.8, z], heading: 0, radius: 2.6, broken };
}

/** Drive the camera through `seconds` of a subject given by time. */
function run(
  cam: CrashCam,
  seconds: number,
  at: (t: number) => CrashCamSubject | undefined,
  world: CrashCamWorld = OPEN,
  from = 0,
) {
  const frames = [];
  for (let t = from; t < from + seconds - 1e-9; t += DT) frames.push(cam.update(DT, at(t), world));
  return frames;
}

describe('crash camera', () => {
  it('cuts to a camera beside and ahead of a car as a part breaks off, and back once it rests', () => {
    const cam = new CrashCam({ enabled: true, seconds: 4 });
    // 20 m/s north for a second, then a part goes and it slides to a stop over two seconds.
    const at = (t: number): CrashCamSubject =>
      t < 1 ? car(-20 * t) : car(-20 - (20 * Math.min(t - 1, 2) - 5 * Math.min(t - 1, 2) ** 2), 1);
    const frames = run(cam, 12, at);
    const start = frames.findIndex((frame) => frame.started);
    expect(start).toBeGreaterThan(55);
    expect(frames[start]?.broke).toBe(1);
    const first = frames[start]?.pose;
    if (first === undefined) throw new Error('no shot');
    // Beside the path (x off the road) and ahead of where it broke (further north).
    expect(Math.abs(first.position[0])).toBeGreaterThan(8);
    expect(first.position[2]).toBeLessThan(-20);
    expect(first.position[1]).toBeGreaterThan(1.4);
    // Ends after the four seconds (at rest well before), and only once.
    const end = frames.findIndex((frame) => frame.ended);
    expect((end - start) * DT).toBeGreaterThan(3.9);
    expect((end - start) * DT).toBeLessThan(5);
    expect(frames.filter((frame) => frame.started)).toHaveLength(1);
    expect(frames[end]?.pose).toBeUndefined();
    expect(cam.active).toBe(false);
    // While it ran, it looked at the car and crept nearer.
    const mid = frames[start + 120]?.pose;
    const late = frames[end - 1]?.pose;
    if (mid === undefined || late === undefined) throw new Error('no shot');
    const reach = (pose: { position: number[]; lookAt: number[] }) =>
      Math.hypot(
        (pose.position[0] ?? 0) - (pose.lookAt[0] ?? 0),
        (pose.position[2] ?? 0) - (pose.lookAt[2] ?? 0),
      );
    expect(reach(late)).toBeLessThan(reach(first));
  });

  it('holds while the wreck still slides, and stretches for every part that breaks', () => {
    const cam = new CrashCam({ enabled: true, seconds: 2 });
    // Breaks at 0.5 s and again at 2 s, sliding at 6 m/s until 3.5 s.
    const at = (t: number): CrashCamSubject =>
      car(-6 * Math.min(t, 3.5), t < 0.5 ? 0 : t < 2 ? 1 : 2);
    const frames = run(cam, 10, at);
    const start = frames.findIndex((frame) => frame.started);
    const end = frames.findIndex((frame) => frame.ended);
    expect(frames.filter((frame) => frame.broke > 0)).toHaveLength(2);
    expect(frames.filter((frame) => frame.started)).toHaveLength(1);
    // Past the 2 s minimum: until it stopped at 3.5 s and had rested a little.
    expect(end * DT).toBeGreaterThan(3.5);
    expect((end - start) * DT).toBeLessThan(2 + 2 + 0.1);
  });

  it('stays out of the way of what blocks its view, and follows a wreck that runs on', () => {
    const cam = new CrashCam({ enabled: true, seconds: 6 });
    // A wall along the car's left: the camera stands on its right, or close in.
    const walled: CrashCamWorld = {
      groundHeight: () => 0,
      blocked: (from, to) => (to[0] > from[0] + 1 ? 1.5 : undefined),
    };
    const at = (t: number): CrashCamSubject => car(-30 * t, t < 0.5 ? 0 : 1);
    const frames = run(cam, 4, at, walled);
    const start = frames.findIndex((frame) => frame.started);
    const first = frames[start]?.pose;
    expect(first?.position[0]).toBeLessThan(-1);
    // Still going 30 m/s, 100 m on: the camera has kept after it rather than watched it shrink
    // away, and stayed on its own side.
    const shot = frames.slice(start);
    expect(shot.every((frame) => frame.pose !== undefined)).toBe(true);
    const last = shot[shot.length - 1]?.pose;
    if (last === undefined) throw new Error('no shot');
    const lastZ = -30 * (4 - DT);
    expect(Math.hypot(last.position[0], last.position[2] - lastZ)).toBeLessThan(30);
    expect(last.position[0]).toBeLessThan(-1);
  });

  it('sets up a new camera ahead of a wreck gone in a jump', () => {
    const cam = new CrashCam({ enabled: true, seconds: 6 });
    // Broken at 0.5 s; at 1 s it is somewhere else entirely (300 m on).
    const at = (t: number): CrashCamSubject =>
      car(t < 1 ? -10 * t : -300 - 10 * t, t < 0.5 ? 0 : 1);
    const frames = run(cam, 1.5, at);
    const last = frames[frames.length - 1]?.pose;
    if (last === undefined) throw new Error('no shot');
    expect(Math.abs(last.position[2] - (-300 - 15))).toBeLessThan(40);
  });

  it('does not cut when switched off, for a vehicle boarded already broken, or once cancelled', () => {
    const off = new CrashCam(crashCamSettings(false));
    const frames = run(off, 2, (t) => car(-10 * t, t < 1 ? 0 : 1));
    expect(frames.some((frame) => frame.started)).toBe(false);
    // The crash is still reported.
    expect(frames.some((frame) => frame.broke === 1)).toBe(true);

    const cam = new CrashCam(crashCamSettings({ seconds: 3 }));
    expect(cam.enabled).toBe(true);
    // Boarding a car that lost a part before: nothing new.
    expect(run(cam, 1, () => car(0, 3)).some((frame) => frame.started)).toBe(false);
    // On foot ends a shot; so does the view key (cancel).
    run(cam, 0.5, (t) => car(-10 * t, 4), OPEN, 1);
    expect(cam.active).toBe(true);
    expect(cam.update(DT, undefined, OPEN).ended).toBe(true);
    run(cam, 0.5, () => car(0, 0));
    run(cam, 0.1, () => car(0, 1));
    expect(cam.active).toBe(true);
    expect(cam.cancel()).toBe(true);
    expect(cam.active).toBe(false);
  });

  it('gives an aircraft a longer shot from further off, above the ground', () => {
    const cam = new CrashCam({ enabled: true, seconds: 4 });
    const plane = (t: number): CrashCamSubject => ({
      id: 'plane',
      kind: 'aircraft',
      center: [60 * Math.min(t, 1.5), 40 - 25 * Math.min(t, 1.5), 0],
      heading: Math.PI / 2,
      radius: 9,
      broken: t < 0.5 ? 0 : 1,
    });
    const frames = run(cam, 12, plane);
    const start = frames.findIndex((frame) => frame.started);
    const end = frames.findIndex((frame) => frame.ended);
    const first = frames[start]?.pose;
    if (first === undefined) throw new Error('no shot');
    expect(
      Math.hypot(first.position[0] - first.lookAt[0], first.position[2] - first.lookAt[2]),
    ).toBeGreaterThan(30);
    expect(first.position[1]).toBeGreaterThan(4);
    expect((end - start) * DT).toBeGreaterThan(5.9);
  });
});
