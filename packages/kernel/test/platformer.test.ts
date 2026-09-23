import { describe, expect, it } from 'vitest';
import { Transform } from '../src/component';
import { installPlatformer, PlatformBody, PlatformIntent } from '../src/platformer';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { World } from '../src/world';

function build(oneWay = false): World {
  const w = new World({ tickRate: 30 });
  installPlatformer(w);
  w.spawnRaw(
    {
      transform: { pos: [0, -0.5, 0], rot: [0, 0, 0, 1] },
      platformSolid: { halfExtents: [4, 0.5], oneWay },
    },
    'floor',
  );
  w.spawnRaw(
    {
      transform: { pos: [0, 3, 2], rot: [0, 0, 0, 1] },
      platformBody: { halfExtents: [0.4, 0.6] },
      platformIntent: { move: 0 },
    },
    'hero',
  );
  return w;
}
describe('platformer XY collision and jump service', () => {
  it('lands exactly on a solid and preserves the authored Z plane', () => {
    const w = build();
    w.stepN(60);
    expect(w.get('hero', Transform)?.pos).toEqual([0, 0.6, 2]);
    expect(w.get('hero', PlatformBody)?.grounded).toBe(true);
  });
  it('sweeps high-speed falls through a thin floor without tunneling', () => {
    const w = build();
    w.patch('hero', PlatformBody, { vel: [0, -10000] });
    w.step();
    expect(w.get('hero', Transform)?.pos[1]).toBeCloseTo(0.6);
  });
  it('stops at walls and ceilings, including high-speed movement', () => {
    const w = build();
    w.spawnRaw(
      {
        transform: { pos: [3, 3, 0], rot: [0, 0, 0, 1] },
        platformSolid: { halfExtents: [0.01, 5] },
      },
      'wall',
    );
    w.patch('hero', PlatformBody, { speed: 10000, acceleration: 1e6 });
    w.patch('hero', PlatformIntent, { move: 1 });
    w.step();
    expect(w.get('hero', Transform)?.pos[0]).toBeCloseTo(2.59);
    w.spawnRaw(
      {
        transform: { pos: [0, 5, 0], rot: [0, 0, 0, 1] },
        platformSolid: { halfExtents: [4, 0.1] },
      },
      'ceiling',
    );
    w.patch('hero', PlatformBody, { vel: [0, 1000] });
    w.patch('hero', PlatformIntent, { move: 0 });
    w.step();
    expect(w.get('hero', Transform)?.pos[1]).toBeCloseTo(4.3);
    expect(w.get('hero', PlatformBody)?.grounded).toBe(false);
  });
  it('passes upward through a one-way platform, then lands from above', () => {
    const w = build(true);
    w.patch('hero', Transform, { pos: [0, -2, 2] });
    w.patch('hero', PlatformBody, { vel: [0, 15] });
    w.stepN(14);
    expect(w.get('hero', Transform)?.pos[1]).toBeGreaterThan(1);
    w.stepN(40);
    expect(w.get('hero', Transform)?.pos[1]).toBeCloseTo(0.6);
  });
  it('consumes jump edges, and releasing early gives a shorter jump', () => {
    const a = build();
    const b = build();
    a.stepN(60);
    b.stepN(60);
    for (const w of [a, b]) {
      w.patch('hero', PlatformIntent, { jump: true, jumpHeld: true });
      w.step();
    }
    expect(a.get('hero', PlatformIntent)?.jump).toBe(false);
    b.patch('hero', PlatformIntent, { jumpHeld: false });
    a.stepN(8);
    b.stepN(8);
    expect(a.get('hero', Transform)?.pos[1]).toBeGreaterThan(
      Number(b.get('hero', Transform)?.pos[1]) + 0.6,
    );
  });
  it('buffers a press shortly before landing', () => {
    const w = build();
    w.patch('hero', Transform, { pos: [0, 0.8, 2] });
    w.patch('hero', PlatformBody, { vel: [0, -6] });
    w.patch('hero', PlatformIntent, { jump: true });
    w.stepN(2);
    expect(Number(w.get('hero', PlatformBody)?.vel?.[1])).toBeGreaterThan(5);
  });
  it('permits a jump during coyote grace and rejects one after grace expires', () => {
    for (const [delay, allowed] of [
      [1, true],
      [6, false],
    ] as const) {
      const w = build();
      w.stepN(60);
      w.destroy('floor');
      w.stepN(delay);
      w.patch('hero', PlatformIntent, { jump: true });
      w.step();
      expect(Number(w.get('hero', PlatformBody)?.vel?.[1]) > 0).toBe(allowed);
    }
  });
  it('continues identically after restoring a checkpoint mid-jump', () => {
    const a = build();
    a.stepN(60);
    a.patch('hero', PlatformIntent, { jump: true, move: 1 });
    a.stepN(3);
    const b = build();
    applyKeyframeTo(b, takeKeyframe(a));
    a.stepN(25);
    b.stepN(25);
    expect(stateHash(a)).toBe(stateHash(b));
  });
});
