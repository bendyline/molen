import { buildWorld, defineComponent, type World } from '@bendyline/molen-kernel';
import { runHeadless } from '@bendyline/molen-kernel/testing';
import type { Command } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { ARENA, arenaProject } from '../src/arena';

const Tag = defineComponent<{ name: string }>('tag');
const Transform = defineComponent<{ pos: [number, number, number] }>('transform');
const Health = defineComponent<{ hp: number }>('health');

/** The arena is pure data: no setup module, everything installs from scene.json. */
function build(): World {
  const { scene, types } = arenaProject();
  return buildWorld(scene, undefined, { types });
}

function countEnemies(w: World): number {
  let n = 0;
  for (const [, tag] of w.query(Tag)) if (tag.name === 'enemy') n++;
  return n;
}

const move = (dir: [number, number], seq = 0): Command => ({
  kind: 'command',
  seq,
  source: 'local',
  tick: 0,
  type: 'move',
  payload: { dir },
});

describe('top-down arena (headless, data + scripts only)', () => {
  it('scene validates and spawns the arena (walls + player)', () => {
    const w = build();
    expect(w.exists('player')).toBe(true);
    expect(w.exists('wall-n')).toBe(true);
    expect(w.get('player', Health)?.hp).toBe(10);
    expect(w.commandTypes()).toEqual(['move']);
  });

  it('spawner produces enemies over time', () => {
    const w = build();
    w.stepN(ARENA.spawnInterval * 3 + 1);
    expect(countEnemies(w)).toBeGreaterThanOrEqual(3);
  });

  it('move commands drive the player and walls stop it', () => {
    const w = build();
    // push east hard for a while; the east wall is at x=10, so the player is bounded.
    expect(w.submitCommand(move([1, 0])).accepted).toBe(true);
    w.stepN(60);
    const x = w.get('player', Transform)?.pos[0] ?? 0;
    expect(x).toBeGreaterThan(2); // moved east
    expect(x).toBeLessThan(ARENA.size / 2); // stopped by the wall
  });

  it('rejects a malformed move payload with a pointer into the payload', () => {
    const w = build();
    const r = w.submitCommand({ ...move([1, 0]), payload: { dir: 'east' } });
    expect(r.accepted).toBe(false);
    expect(r.reason).toContain('/dir');
    const outOfRange = w.submitCommand({ ...move([1, 0]), payload: { dir: [5, 0] } });
    expect(outOfRange.accepted).toBe(false);
  });

  it('enemies chase the player and damage it on contact', () => {
    const w = build();
    w.stepN(120); // enough for enemies to reach the stationary player at center
    const hp = w.get('player', Health)?.hp ?? 10;
    expect(hp).toBeLessThan(10); // took damage from at least one enemy
  });

  it('is deterministic (full game loop hash + events)', () => {
    const a = runHeadless(build, { ticks: 90 });
    const b = runHeadless(build, { ticks: 90 });
    expect(a.finalHash).toBe(b.finalHash);
    expect(a.events.length).toBe(b.events.length);
  });

  it('matches the pinned hash (a broad-phase or ordering change must not move it)', () => {
    // Pinned after continuation hash v2 and the registry-spawn migration; the kinematics grid broad phase is required to
    // reproduce the brute-force resolution sequence bit for bit.
    expect(runHeadless(build, { ticks: 90 }).finalHash).toBe(
      'sha256:471d0a560278ddde2286f11bb03b955c319f9b2ba0656dfb80a0d546aad69e4d',
    );
  });
});
