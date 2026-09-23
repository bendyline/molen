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

describe('skybound: authored scene + scripts', () => {
  // A pinned hash, not just run-to-run equality: two runs of the same build always agree, so
  // that check cannot see a refactor that moved the whole simulation. This literal can only be
  // updated on purpose, which is the point — it is the skybound run's behaviour, frozen.
  it('matches the pinned state hash across engine versions', () => {
    const w = build();
    command(w, 'move', { dir: [1, 0] });
    w.stepN(90);
    expect(stateHash(w)).toBe(
      'sha256:e0632b2ae9a5ba9d279e6706949f7adfa5295a5e54c63845f9cb00e7e94e2653',
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
    expect(data(w, 'game', 'skyGame').status).toBe('playing');
  });
  it('jumps, collects seeds, falls, and respawns with one fewer life', () => {
    const w = build();
    w.step();
    command(w, 'move', { dir: [1, 0] });
    w.stepN(18);
    expect(data(w, 'game', 'skyGame').coins).toBeGreaterThan(0);
    command(w, 'jump', { held: true });
    w.stepN(8);
    expect(w.get('player', Transform)?.pos[1]).toBeGreaterThan(2);
    w.patch('player', Transform, { pos: [9, -7, 0] });
    w.step();
    expect(data(w, 'game', 'skyGame').lives).toBe(2);
    expect(w.get('player', Transform)?.pos[0]).toBe(0);
  });
  it('saves a checkpoint and restarts all collectibles and lives', () => {
    const w = build();
    w.patch('player', Transform, { pos: [38, 1.25, 0] });
    w.step();
    expect(data(w, 'game', 'skyGame').checkpoint).toBe(1);
    w.patch('player', Transform, { pos: [42, -7, 0] });
    w.step();
    expect(w.get('player', Transform)?.pos[0]).toBe(38);
    command(w, 'restart');
    w.stepN(2);
    expect(data(w, 'game', 'skyGame').lives).toBe(3);
    expect(data(w, 'game', 'skyGame').checkpoint).toBe(0);
  });
});

it('keeps a fast jump tap when press and release arrive in the same simulation tick', () => {
  const w = build();
  w.step();
  for (const [seq, held] of [
    [0, true],
    [1, false],
  ] as const) {
    const result = w.submitCommand({
      kind: 'command',
      source: 'tap',
      seq,
      tick: w.tick + 1,
      type: 'jump',
      payload: { held },
    });
    expect(result.accepted).toBe(true);
  }
  w.stepN(4);
  expect(w.get('player', Transform)?.pos[1]).toBeGreaterThan(1.6);
});
