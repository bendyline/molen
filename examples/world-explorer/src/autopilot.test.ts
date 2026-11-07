import { describe, expect, it } from 'vitest';
import { type AutopilotOptions, autopilotOptions, autopilotPose } from './autopilot.js';

const options: AutopilotOptions = {
  mode: 'circle',
  speed: 100,
  radius: 1000,
  dive: 0.1,
  startSeconds: 0,
  turn: 1,
};

describe('explorer autopilot', () => {
  it('is off without the URL parameter and reads its numbers from it', () => {
    expect(autopilotOptions(new URLSearchParams('quality=high'))).toBeUndefined();
    const parsed = autopilotOptions(new URLSearchParams('autopilot=straight&speed=300&turn=left'));
    expect(parsed).toMatchObject({ mode: 'straight', speed: 300, turn: -1 });
  });

  it('holds still until the start time, then flies straight along the yaw', () => {
    const straight: AutopilotOptions = { ...options, mode: 'straight', startSeconds: 5 };
    expect(autopilotPose(straight, [10, 500, 20], 0, 4).position).toEqual([10, 500, 20]);
    const pose = autopilotPose(straight, [10, 500, 20], Math.PI / 2, 7);
    expect(pose.position[0]).toBeCloseTo(10);
    expect(pose.position[2]).toBeCloseTo(220);
    expect(pose.pitch).toBeCloseTo(-0.1);
  });

  it('starts a circle on the spot and closes it after one circumference', () => {
    const start = [100, 500, -40] as const;
    const first = autopilotPose(options, start, 0.7, 0);
    expect(first.position[0]).toBeCloseTo(start[0]);
    expect(first.position[2]).toBeCloseTo(start[2]);
    const lap = autopilotPose(options, start, 0.7, (2 * Math.PI * options.radius) / options.speed);
    expect(lap.position[0]).toBeCloseTo(start[0]);
    expect(lap.position[2]).toBeCloseTo(start[2]);
  });

  it('flies a circle along its nose, turning toward the requested side', () => {
    const start = [0, 0, 0] as const;
    for (const turn of [1, -1] as const) {
      const circle = { ...options, turn };
      const a = autopilotPose(circle, start, 0, 10);
      const b = autopilotPose(circle, start, 0, 10.01);
      const travel = Math.atan2(b.position[2] - a.position[2], b.position[0] - a.position[0]);
      expect(travel).toBeCloseTo(a.yaw, 2);
      expect(Math.sign(b.yaw - a.yaw)).toBe(turn);
    }
  });
});
