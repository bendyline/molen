import { describe, expect, it } from 'vitest';
import { isBoostMode, setBoostMode } from '../src/boost';
import { Character, installCharacterController, MoveIntent } from '../src/character';
import { Transform } from '../src/component';
import { applyKeyframeTo, stateHash, takeKeyframe } from '../src/snapshot';
import { World } from '../src/world';

function charWorld(opts?: Parameters<typeof installCharacterController>[1]): World {
  const w = new World({ tickRate: 60, seed: 'fps' });
  installCharacterController(w, opts);
  return w;
}

function spawnChar(w: World, y: number): void {
  w.spawnRaw(
    {
      transform: { pos: [0, y, 0], rot: [0, 0, 0, 1] },
      character: { speed: 6, jumpSpeed: 8, gravity: 20, vy: 0, grounded: false },
    },
    'p',
  );
}

describe('character controller', () => {
  it('boosts horizontal travel, preserves jumping, and restores boost through checkpoints', () => {
    const normal = charWorld();
    const boosted = charWorld();
    for (const w of [normal, boosted]) {
      spawnChar(w, 0);
      w.step();
      w.set('p', MoveIntent, { dir: [1, 1], jump: true });
    }
    setBoostMode(boosted, true);
    normal.stepN(10);
    boosted.stepN(10);
    const p = normal.get('p', Transform)?.pos;
    const b = boosted.get('p', Transform)?.pos;
    expect(b?.[0]).toBeCloseTo((p?.[0] ?? 0) * 4, 8);
    expect(b?.[1]).toBe(p?.[1]);
    const restored = charWorld();
    applyKeyframeTo(restored, takeKeyframe(boosted));
    expect(isBoostMode(restored)).toBe(true);
    boosted.stepN(20);
    restored.stepN(20);
    expect(stateHash(restored)).toBe(stateHash(boosted));
    setBoostMode(restored, false);
    const before = restored.get('p', Transform)?.pos[0] ?? 0;
    restored.stepN(60);
    expect((restored.get('p', Transform)?.pos[0] ?? 0) - before).toBeCloseTo(6 / Math.sqrt(2), 6);
  });
  it('falls under gravity and lands on the ground', () => {
    const w = charWorld();
    spawnChar(w, 5);
    w.stepN(120); // 2s
    expect(w.get('p', Transform)?.pos[1]).toBeCloseTo(0, 3);
    expect(w.get('p', Character)?.grounded).toBe(true);
  });

  it('moves planarly from a move intent', () => {
    const w = charWorld();
    spawnChar(w, 0);
    w.set('p', MoveIntent, { dir: [1, 0], jump: false });
    w.stepN(30); // 0.5s at speed 6 -> ~3 units
    expect(w.get('p', Transform)?.pos[0]).toBeCloseTo(3, 1);
  });

  it('jumps from the ground then falls back', () => {
    const w = charWorld();
    spawnChar(w, 0);
    w.stepN(5); // settle on ground
    expect(w.get('p', Character)?.grounded).toBe(true);
    w.set('p', MoveIntent, { dir: [0, 0], jump: true });
    w.step(); // jump
    w.set('p', MoveIntent, { dir: [0, 0], jump: false });
    const yAfterJump = w.get('p', Transform)?.pos[1] ?? 0;
    expect(yAfterJump).toBeGreaterThan(0); // left the ground
    w.stepN(120); // comes back down
    expect(w.get('p', Transform)?.pos[1]).toBeCloseTo(0, 3);
  });

  it('rests on a pluggable ground height (e.g. terrain)', () => {
    const w = charWorld({ groundHeight: (x) => (x > 0 ? 3 : 0) });
    spawnChar(w, 5);
    w.set('p', MoveIntent, { dir: [1, 0], jump: false });
    w.stepN(120);
    // moved into the x>0 region, so it rests at height 3
    expect(w.get('p', Transform)?.pos[1]).toBeCloseTo(3, 2);
  });

  it('does not move faster on the diagonal', () => {
    const straight = charWorld();
    spawnChar(straight, 0);
    straight.set('p', MoveIntent, { dir: [1, 0], jump: false });
    straight.stepN(30);
    const sx = straight.get('p', Transform)?.pos[0] ?? 0;

    const diag = charWorld();
    spawnChar(diag, 0);
    diag.set('p', MoveIntent, { dir: [1, 1], jump: false });
    diag.stepN(30);
    const dp = diag.get('p', Transform)?.pos as [number, number, number];
    const diagDist = Math.hypot(dp[0], dp[2]);
    expect(diagDist).toBeCloseTo(sx, 1); // same total speed
  });

  it('is deterministic', () => {
    const run = (): string => {
      const w = charWorld();
      spawnChar(w, 4);
      w.set('p', MoveIntent, { dir: [1, 1], jump: true });
      w.stepN(60);
      return stateHash(w);
    };
    expect(run()).toBe(run());
  });
});
