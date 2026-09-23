import {
  applyKeyframeTo,
  buildWorld,
  componentHandle,
  stateHash,
  Transform,
  takeKeyframe,
  type World,
} from '@bendyline/molen-kernel';
import type { JsonObject } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { scene } from '../src/scene';

const build = (): World => buildWorld(scene());
function command(w: World, type: string, payload: JsonObject = {}): void {
  const result = w.submitCommand({
    kind: 'command',
    source: type,
    seq: w.tick * 10 + w.commandTypes().indexOf(type),
    tick: w.tick,
    type,
    payload,
  });
  expect(result.accepted, result.reason).toBe(true);
}
function data(w: World, id: string, name: string): JsonObject {
  const value = w.get(id, componentHandle(name));
  if (value === undefined) throw new Error(`Missing ${id}.${name}`);
  return value;
}

describe('lantern-dungeon: authored scene + scripts', () => {
  // A pinned hash, not just run-to-run equality: two runs of the same build always agree, so
  // that check cannot see a refactor that moved the whole simulation. This literal can only be
  // updated on purpose, which is the point — it is the vault run's behaviour, frozen.
  it('matches the pinned state hash across engine versions', () => {
    const w = build();
    command(w, 'move', { dir: [0, -1] });
    w.stepN(90);
    expect(stateHash(w)).toBe(
      'sha256:45971e1a7d2fe696864e335d72d73f6ff5fea31455659dcce44b7ce4a63f2d80',
    );
  });

  it('runs the same world twice and continues from a checkpoint', () => {
    const a = build();
    const b = build();
    command(a, 'move', { dir: [0, -1] });
    command(b, 'move', { dir: [0, -1] });
    a.stepN(20);
    b.stepN(20);
    expect(stateHash(a)).toBe(stateHash(b));
    const c = build();
    applyKeyframeTo(c, takeKeyframe(a));
    a.stepN(30);
    c.stepN(30);
    expect(stateHash(a)).toBe(stateHash(c));
  });
  it('rejects malformed input and restarts through the declared command', () => {
    const w = build();
    expect(
      w.submitCommand({
        kind: 'command',
        source: 'bad',
        seq: 0,
        tick: 0,
        type: 'move',
        payload: { dir: [20, 0] },
      }).accepted,
    ).toBe(false);
    w.stepN(30);
    command(w, 'restart');
    w.stepN(2);
    expect(data(w, 'game', 'dungeonGame').status).toBe('playing');
  });
  it('blocks the locked gate and requires the key', () => {
    const w = build();
    w.patch('player', Transform, { pos: [0, 0, -0.5] });
    command(w, 'interact');
    w.stepN(2);
    expect(data(w, 'game', 'dungeonGame').doorOpen).toBe(false);
    command(w, 'move', { dir: [0, -1] });
    w.stepN(25);
    expect(w.get('player', Transform)?.pos[2]).toBeGreaterThan(-2.4);
  });
  it('rolls deterministic melee damage, respects cooldowns, and can heal', () => {
    const w = build();
    w.patch('player', Transform, { pos: [0, 0, 5] });
    command(w, 'attack');
    w.stepN(2);
    const hp = data(w, 'sentinel0', 'sentinel').hp;
    expect(hp).toBeLessThan(14);
    command(w, 'attack');
    w.stepN(2);
    expect(data(w, 'sentinel0', 'sentinel').hp).toBe(hp);
    w.patch('game', componentHandle('dungeonGame'), { health: 40 });
    command(w, 'heal');
    w.stepN(2);
    expect(data(w, 'game', 'dungeonGame').health).toBe(85);
    expect(data(w, 'game', 'dungeonGame').potions).toBe(0);
  });
});

it('cancels a gate animation when restarting during its opening tween', () => {
  const w = build();
  w.patch('player', Transform, { pos: [0, 0, -0.5] });
  w.patch('game', componentHandle('dungeonGame'), { key: true });
  command(w, 'interact');
  w.stepN(12);
  expect(w.get('gate', Transform)?.pos[1]).toBeGreaterThan(1.5);
  command(w, 'restart');
  w.stepN(40);
  expect(w.get('gate', Transform)?.pos[1]).toBe(1.5);
  expect(w.has('gate', componentHandle('collider'))).toBe(true);
});

it('restarts a sword swing at the accepted attack tick and resets it with the game', () => {
  const w = build();
  w.stepN(20);
  command(w, 'attack');
  w.stepN(2);
  const attack = data(w, 'held-sword', 'renderable').animation;
  expect(attack).toMatchObject({
    clip: 'attack',
    loop: 'once',
    startTick: data(w, 'game', 'dungeonGame').attackTick,
  });
  command(w, 'restart');
  w.stepN(2);
  expect(data(w, 'held-sword', 'renderable').animation).toMatchObject({
    clip: 'attack',
    paused: true,
  });
  command(w, 'attack');
  w.stepN(2);
  expect(data(w, 'held-sword', 'renderable').animation).not.toHaveProperty('paused');
});
