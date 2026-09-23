import {
  applyKeyframeTo,
  buildWorld,
  componentHandle,
  stateHash,
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

describe('city-courier: authored scene + scripts', () => {
  // A pinned hash, not just run-to-run equality: two runs of the same build always agree, so
  // that check cannot see a refactor that moved the whole simulation. This literal can only be
  // updated on purpose, which is the point — it is the courier run's behaviour, frozen.
  it('matches the pinned state hash across engine versions', () => {
    const w = build();
    command(w, 'drive', { dir: [0, -1] });
    w.stepN(90);
    expect(stateHash(w)).toBe(
      'sha256:d5bb47f21578dd28540e1027fd1acfb282bebd1e26aa03ecba155ff87d16d6ef',
    );
  });

  it('runs the same world twice and continues from a checkpoint', () => {
    const a = build();
    const b = build();
    command(a, 'drive', { dir: [0, -1] });
    command(b, 'drive', { dir: [0, -1] });
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
        type: 'drive',
        payload: { dir: [20, 0] },
      }).accepted,
    ).toBe(false);
    w.stepN(30);
    command(w, 'restart');
    w.stepN(2);
    expect(data(w, 'game', 'courierGame').status).toBe('playing');
  });
  it('accelerates, brakes, and delivers the first beacon by driving', () => {
    const w = build();
    command(w, 'drive', { dir: [0, -1] });
    w.stepN(140);
    expect(data(w, 'game', 'courierGame').delivered).toBeGreaterThanOrEqual(1);
    const speed = Number(data(w, 'game', 'courierGame').speed);
    command(w, 'brake', { held: true });
    command(w, 'drive', { dir: [0, 0] });
    w.stepN(20);
    expect(Number(data(w, 'game', 'courierGame').speed)).toBeLessThan(speed * 0.3);
  });
  it('ends the run when the clock expires', () => {
    const manifest = scene();
    const script = manifest.scripts[0];
    if (script === undefined) throw new Error('Missing game script');
    script.config.duration = 1;
    const w = buildWorld(manifest);
    w.stepN(32);
    expect(data(w, 'game', 'courierGame').status).toBe('lost');
  });
});
