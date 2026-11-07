import { describe, expect, it } from 'vitest';
import { TerrainCameraTrack } from '../src/pyramid-motion';

/** Sample a track along `at(seconds)` at 20 Hz. */
function fly(
  track: TerrainCameraTrack,
  seconds: number,
  at: (time: number) => readonly number[],
): void {
  for (let time = 0; time <= seconds + 1e-9; time += 0.05) track.sample(time * 1000, at(time));
}

describe('camera track prediction', () => {
  it('reports nothing until the track has run, so an isolated move is not travel', () => {
    const track = new TerrainCameraTrack(1_000);
    track.sample(0, [0, 0, 0]);
    track.sample(100, [50, 0, 0]);
    expect(track.speed).toBe(0);
    fly(track, 2, (time) => [250 * time, 0, 0]);
    expect(track.speed).toBeGreaterThan(100);
  });

  it('extrapolates a straight flight along its velocity', () => {
    const track = new TerrainCameraTrack(1_000);
    fly(track, 4, (time) => [250 * time, 900 + 10 * time, -100 * time]);
    expect(track.speed).toBeCloseTo(Math.hypot(250, 100), 0);
    const ahead = track.predict(10);
    expect(ahead?.position[0]).toBeCloseTo(250 * 14, -1);
    expect(ahead?.position[1]).toBeCloseTo(900 + 140, 0);
    expect(ahead?.position[2]).toBeCloseTo(-100 * 14, -1);
    expect(ahead?.turn).toBeCloseTo(0, 2);
  });

  it('follows the arc of a steady turn rather than its tangent', () => {
    const radius = 4_000;
    const speed = 250;
    const rate = speed / radius;
    const onCircle = (time: number): [number, number, number] => [
      radius * Math.sin(rate * time),
      900,
      radius * (1 - Math.cos(rate * time)),
    ];
    const track = new TerrainCameraTrack(1_000);
    fly(track, 12, onCircle);
    const ahead = track.predict(20);
    const actual = onCircle(32);
    const error = Math.hypot(
      (ahead?.position[0] ?? 0) - actual[0],
      (ahead?.position[2] ?? 0) - actual[2],
    );
    // The tangent from here misses by about 2.6 km over the same 5 km of travel.
    expect(error).toBeLessThan(400);
    expect(ahead?.turn).toBeCloseTo(rate * 20, 1);
  });

  it('starts over after a teleport or a long gap', () => {
    const track = new TerrainCameraTrack(1_000);
    fly(track, 3, (time) => [250 * time, 0, 0]);
    track.sample(3_100, [50_000, 0, 0]);
    expect(track.speed).toBe(0);
    fly(track, 3, (time) => [250 * time, 0, 0]);
    track.sample(30_000, [10, 0, 0]);
    expect(track.speed).toBe(0);
  });

  it('starts over after a teleport even on the frame after a fast sample', () => {
    const track = new TerrainCameraTrack(1_000);
    fly(track, 3, (time) => [250 * time, 0, 0]);
    expect(track.speed).toBeGreaterThan(200);
    // 2 ms later: far too soon to measure a speed, but a jump like this is not travel.
    track.sample(3_002, [50_000, 0, 0]);
    expect(track.speed).toBe(0);
  });

  it('settles to rest when the camera stops', () => {
    const track = new TerrainCameraTrack(1_000);
    fly(track, 3, (time) => [250 * time, 0, 0]);
    for (let time = 3; time < 8; time += 0.05) track.sample(time * 1000, [750, 0, 0]);
    expect(track.speed).toBeLessThan(1);
  });
});
