import { describe, expect, it } from 'vitest';
import { FlyController } from '../src/navigation/fly';
import { FollowController } from '../src/navigation/follow';
import { idleNavigationInput, type NavigationInput } from '../src/navigation/input-source';
import { type NavigationEnvironment, OrbitController } from '../src/navigation/orbit';

const flat: NavigationEnvironment = { groundHeight: () => 0 };
const unloaded: NavigationEnvironment = { groundHeight: () => undefined };

function input(patch: Partial<NavigationInput> = {}): NavigationInput {
  return { ...idleNavigationInput(), ...patch };
}

function run(orbit: OrbitController, seconds: number, patch: Partial<NavigationInput> = {}) {
  let pose = orbit.update(0, input(), flat);
  for (let t = 0; t < seconds; t += 1 / 60) pose = orbit.update(1 / 60, input(patch), flat);
  return pose;
}

describe('orbit navigation', () => {
  const start = {
    target: [0, 0, 0] as [number, number, number],
    range: 1000,
    heading: 0,
    pitch: 0.5,
  };

  it('frames the target from behind the compass heading, tilted down by pitch', () => {
    const north = new OrbitController(start).update(0, input(), flat);
    // Looking north (-Z) means standing south (+Z) of the target and above it.
    expect(north.position[0]).toBeCloseTo(0, 6);
    expect(north.position[2]).toBeCloseTo(1000 * Math.cos(0.5), 6);
    expect(north.position[1]).toBeCloseTo(1000 * Math.sin(0.5), 6);
    expect(north.direction[2]).toBeLessThan(0);
    const east = new OrbitController({ ...start, heading: Math.PI / 2 }).update(0, input(), flat);
    expect(east.direction[0]).toBeGreaterThan(0.8);
    expect(east.position[0]).toBeLessThan(-800);
  });

  it('zooms geometrically and clamps range and pitch', () => {
    const orbit = new OrbitController(start, { minRange: 100, maxRange: 5000 });
    orbit.update(0, input({ zoom: Math.log(2) }), flat);
    orbit.set({});
    expect(orbit.state.range).toBeCloseTo(500, 6);
    orbit.set({ range: 1, pitch: 3 });
    expect(orbit.state.range).toBe(100);
    expect(orbit.state.pitch).toBeLessThan(Math.PI / 2);
  });

  it('pans the ground under the pointer and moves along the heading with keys', () => {
    const dragged = new OrbitController(start, { smoothing: 0 });
    dragged.update(1 / 60, input({ pan: [100, 0] }), flat);
    // Dragging right pulls the map right: the target moves west (-X) while facing north.
    expect(dragged.state.target[0]).toBeLessThan(0);
    const keyed = new OrbitController({ ...start, heading: Math.PI / 2 }, { smoothing: 0 });
    run(keyed, 0.5, { move: { forward: 1, right: 0, up: 0 } });
    expect(keyed.state.target[0]).toBeGreaterThan(300);
    expect(Math.abs(keyed.state.target[2])).toBeLessThan(1e-6);
  });

  it('rotates with drags and twists and eases toward the goal', () => {
    const orbit = new OrbitController(start);
    const first = orbit.update(1 / 60, input({ look: [200, 0] }), flat);
    expect(orbit.state.heading).toBeLessThan(0);
    expect(orbit.state.heading).toBeGreaterThan(-1);
    run(orbit, 1);
    expect(orbit.state.heading).toBeCloseTo(-1, 3);
    expect(first.position).not.toEqual(orbit.update(0, input(), flat).position);
    const twisted = new OrbitController(start, { smoothing: 0 });
    twisted.update(1 / 60, input({ twist: 0.3 }), flat);
    expect(twisted.state.heading).toBeCloseTo(-0.3, 9);
  });

  it('flies to a distant framing, rising mid-flight, and lands exactly', () => {
    const orbit = new OrbitController(start);
    orbit.flyTo({ target: [50_000, 0, 0], range: 800, heading: 1 }, { durationMs: 1000 });
    expect(orbit.flying).toBe(true);
    let peak = 0;
    for (let i = 0; i < 70; i++) {
      orbit.update(1 / 60, input(), flat);
      peak = Math.max(peak, orbit.state.range);
    }
    expect(peak).toBeGreaterThan(20_000);
    expect(orbit.flying).toBe(false);
    expect(orbit.state.target[0]).toBeCloseTo(50_000, 6);
    expect(orbit.state.range).toBeCloseTo(800, 6);
    expect(orbit.state.heading).toBeCloseTo(1, 9);
  });

  it('cancels a fly-to when the user takes over', () => {
    const orbit = new OrbitController(start);
    orbit.flyTo({ target: [5000, 0, 0] }, { durationMs: 1000 });
    orbit.update(0.2, input(), flat);
    orbit.update(1 / 60, input({ look: [10, 0] }), flat);
    expect(orbit.flying).toBe(false);
    run(orbit, 2);
    expect(orbit.state.target[0]).toBeLessThan(5000);
  });

  it('settles the target onto streamed ground and keeps the camera above it', () => {
    const orbit = new OrbitController({ ...start, pitch: 0.1, range: 200 }, { minClearance: 5 });
    const hill: NavigationEnvironment = { groundHeight: () => 300 };
    let pose = orbit.update(0, input(), unloaded);
    expect(pose.lookAt[1]).toBe(0);
    for (let i = 0; i < 120; i++) pose = orbit.update(1 / 60, input(), hill);
    expect(pose.lookAt[1]).toBeCloseTo(300, 0);
    expect(pose.position[1]).toBeGreaterThanOrEqual(305 - 1e-6);
  });
});

describe('fly navigation', () => {
  it('moves faster the higher it flies and never goes below the ground', () => {
    const low = new FlyController([0, 10, 0], { yaw: 0, pitch: 0 });
    const high = new FlyController([0, 5000, 0], { yaw: 0, pitch: 0 });
    const forward = input({ move: { forward: 1, right: 0, up: 0 } });
    low.update(1, forward, flat);
    high.update(0.1, forward, flat);
    expect(high.position[0] - 0).toBeGreaterThan((low.position[0] - 0) * 10);
    const diving = new FlyController([0, 10, 0], { yaw: 0, pitch: 0 }, { minClearance: 4 });
    for (let i = 0; i < 60; i++)
      diving.update(1 / 30, input({ move: { forward: 0, right: 0, up: -1 } }), flat);
    expect(diving.position[1]).toBe(4);
  });

  it('turns with look input and strafes along its right-hand side', () => {
    const fly = new FlyController([0, 100, 0], { yaw: -Math.PI / 2, pitch: 0 });
    const pose = fly.update(0.1, input({ move: { forward: 0, right: 1, up: 0 } }), flat);
    // Facing north, right is east.
    expect(pose.position[0]).toBeGreaterThan(0);
    fly.update(0.1, input({ look: [100, 0] }), flat);
    expect(fly.yaw).toBeGreaterThan(-Math.PI / 2);
  });
});

describe('follow navigation', () => {
  it('trails behind the subject and swings back after a look', () => {
    const follow = new FollowController({ distance: 6, height: 2, smoothing: 0 });
    const subject = { position: [0, 0, 0] as [number, number, number], heading: 0 };
    const pose = follow.update(1 / 60, subject, input(), flat);
    // Facing north, behind is south (+Z).
    expect(pose.position[2]).toBeCloseTo(6, 6);
    expect(pose.position[1]).toBeCloseTo(2, 6);
    follow.update(1 / 60, subject, input({ look: [300, 0] }), flat);
    const swung = follow.update(0, subject, input(), flat);
    expect(Math.abs(swung.position[0])).toBeGreaterThan(1);
    let settled = swung;
    for (let i = 0; i < 600; i++) settled = follow.update(1 / 60, subject, input(), flat);
    expect(Math.abs(settled.position[0])).toBeLessThan(0.05);
  });

  it('eases toward a moving subject instead of welding to it', () => {
    const follow = new FollowController({ smoothing: 0.5 });
    const at = (z: number) => ({ position: [0, 0, z] as [number, number, number], heading: 0 });
    follow.update(0, at(0), input(), flat);
    const lagging = follow.update(1 / 60, at(-10), input(), flat);
    expect(lagging.position[2]).toBeGreaterThan(-10 + 6);
    follow.reset();
    expect(follow.update(1 / 60, at(-10), input(), flat).position[2]).toBeCloseTo(-4, 1);
  });
});
