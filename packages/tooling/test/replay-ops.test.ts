import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STATE_FORMAT, STATE_FORMAT_KEY } from '@bendyline/molen-kernel';
import type { Keyframe } from '@bendyline/molen-schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diffSnapshots, runReplayFile } from '../src/ops/index';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-replay-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const scene = {
  format: 'molen/scene@3',
  name: 'static',
  seed: 's',
  tickRate: 30,
  entities: [{ id: 'a', components: { transform: { pos: [1, 2, 3], rot: [0, 0, 0, 1] } } }],
};

function keyframe(over: Partial<Keyframe>): Keyframe {
  return {
    kind: 'keyframe',
    v: 1,
    engine: '0.0.1',
    tick: 0,
    tickRate: 30,
    seed: 's',
    nextEntitySeq: 0,
    rng: { algo: 'sfc32', state: [1, 2, 3, 4] },
    entities: {},
    plugins: {},
    ...over,
  };
}

describe('runReplayFile', () => {
  it('does not report an unrecorded replay as passing', async () => {
    const scenePath = join(dir, 'static.scene.json');
    await writeFile(scenePath, JSON.stringify(scene));
    const replayPath = join(dir, 'static.replay.json');
    await writeFile(
      replayPath,
      JSON.stringify({
        format: 'molen/replay@1',
        engine: '0.0.1',
        scene: 'static.scene.json',
        ticks: 5,
        commands: [],
      }),
    );
    const r = await runReplayFile({ path: replayPath });
    expect(r.ok).toBe(false);
    expect(r.actualHash).toMatch(/^sha256:/);
    expect(r.error).toContain('--record');
  });

  it('records and verifies state hash plus event count', async () => {
    const scenePath = join(dir, 'record.scene.json');
    await writeFile(scenePath, JSON.stringify(scene));
    const replayPath = join(dir, 'record.replay.json');
    await writeFile(
      replayPath,
      JSON.stringify({
        format: 'molen/replay@1',
        engine: '0.0.1',
        scene: 'record.scene.json',
        ticks: 3,
        commands: [],
      }),
    );
    const recorded = await runReplayFile({ path: replayPath, record: true });
    expect(recorded.ok).toBe(true);
    expect(recorded.expectedEventCount).toBe(0);
    const verified = await runReplayFile({ path: replayPath });
    expect(verified.ok).toBe(true);
    expect(verified.actualEventCount).toBe(0);
  });

  it('supports an initialKeyframe without a scene', async () => {
    const replayPath = join(dir, 'initial.replay.json');
    await writeFile(
      replayPath,
      JSON.stringify({
        format: 'molen/replay@1',
        engine: '0.0.1',
        initialKeyframe: keyframe({ entities: { p: { health: { hp: 2 } } } }),
        ticks: 2,
        commands: [],
      }),
    );
    expect((await runReplayFile({ path: replayPath, record: true })).ok).toBe(true);
    expect((await runReplayFile({ path: replayPath })).ok).toBe(true);
  });

  it('rejects fixtures recorded with an incompatible state format', async () => {
    const replayPath = join(dir, 'future.replay.json');
    await writeFile(
      replayPath,
      JSON.stringify({
        format: 'molen/replay@1',
        engine: '0.0.1',
        initialKeyframe: keyframe({ plugins: { [STATE_FORMAT_KEY]: STATE_FORMAT + 1 } }),
        ticks: 1,
        commands: [],
      }),
    );
    const result = await runReplayFile({ path: replayPath });
    expect(result.ok).toBe(false);
    expect(result.error).toContain(`state format ${STATE_FORMAT + 1}`);
    expect(result.error).toContain('--record');
  });

  // The package version is recorded metadata, not a gate: a fixture from another release stays
  // replayable as long as the simulation state format is unchanged.
  it('replays a fixture recorded by a different engine version', async () => {
    const scenePath = join(dir, 'other-engine.scene.json');
    await writeFile(scenePath, JSON.stringify(scene));
    const replayPath = join(dir, 'other-engine.replay.json');
    await writeFile(
      replayPath,
      JSON.stringify({
        format: 'molen/replay@1',
        engine: '9.0.0',
        scene: 'other-engine.scene.json',
        ticks: 1,
        commands: [],
      }),
    );
    const result = await runReplayFile({ path: replayPath });
    // Unrecorded, so it still reports "--record" — but never an engine-mismatch refusal.
    expect(result.error ?? '').not.toContain('does not match');
    expect(result.actualHash).toMatch(/^sha256:/);
  });

  it('fails when the expected hash does not match', async () => {
    const scenePath = join(dir, 's2.scene.json');
    await writeFile(scenePath, JSON.stringify(scene));
    const replayPath = join(dir, 's2.replay.json');
    await writeFile(
      replayPath,
      JSON.stringify({
        format: 'molen/replay@1',
        engine: '0.0.1',
        scene: 's2.scene.json',
        ticks: 1,
        commands: [],
        expected: { stateHash: 'sha256:deadbeef' },
      }),
    );
    const r = await runReplayFile({ path: replayPath });
    expect(r.ok).toBe(false);
    expect(r.expectedHash).toBe('sha256:deadbeef');
    expect(r.actualHash).not.toBe('sha256:deadbeef');
  });
});

describe('diffSnapshots', () => {
  it('reports added, removed, and changed components', async () => {
    const a = join(dir, 'a.keyframe.json');
    const b = join(dir, 'b.keyframe.json');
    await writeFile(
      a,
      JSON.stringify(keyframe({ entities: { p: { health: { hp: 10 }, tag: { name: 'x' } } } })),
    );
    await writeFile(
      b,
      JSON.stringify(keyframe({ entities: { p: { health: { hp: 3 }, armor: { v: 5 } } } })),
    );
    const r = await diffSnapshots({ a, b });
    expect(r.ok).toBe(true);
    const diffs = r.diffs ?? [];
    expect(diffs.find((d) => d.component === 'health')?.kind).toBe('changed');
    expect(diffs.find((d) => d.component === 'tag')?.kind).toBe('removed');
    expect(diffs.find((d) => d.component === 'armor')?.kind).toBe('added');
  });

  it('reports no differences for identical keyframes', async () => {
    const kf = keyframe({ entities: { p: { health: { hp: 1 } } } });
    const a = join(dir, 'same1.json');
    const b = join(dir, 'same2.json');
    await writeFile(a, JSON.stringify(kf));
    await writeFile(b, JSON.stringify(kf));
    const r = await diffSnapshots({ a, b });
    expect(r.diffs).toHaveLength(0);
  });
});
