/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { diffImages, driveScene, frameStats } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

// A PLAYED scenario as a regression test: the agent harness runs the real game — move east,
// watch enemies spawn and chase — with frames captured mid-story and asserts on the outcome.
// Deterministic: same seed + same actions = the same frames.
describe('golden: arena drive scenario', () => {
  it('moves the player east while enemies spawn; frames + assertions hold', async () => {
    await mkdir(OUT, { recursive: true });
    const camera = {
      position: [0, 26, 12] as [number, number, number],
      lookAt: [0, 0, 0] as [number, number, number],
    };

    const r = await driveScene({
      scenePath: join(process.cwd(), 'scene.json'),
      outDir: OUT,
      size: [512, 384],
      clearColor: '#1a1d24',
      actions: [
        { at: 0, camera, screenshot: 'drive-start' },
        { at: 1, command: { type: 'move', payload: { dir: [1, 0] } } },
        { at: 40, command: { type: 'move', payload: { dir: [0, 0] } } },
        { at: 60, screenshot: 'drive-after' },
      ],
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          // Walked east (speed 9 for ~39 ticks at 30Hz ≈ 11.7, clamped by the east wall < 10).
          { select: '#player .transform.pos[0]', op: 'gte', value: 5 },
          { select: '#player .transform.pos[0]', op: 'lte', value: 10 },
          // The spawner has produced enemies by tick 60 (exact count varies: combat kills some).
          { select: 'tag:enemy', op: 'exists' },
        ],
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.ok, r.assertionsFormatted).toBe(true);
    expect(r.frames).toHaveLength(2);
    expect(r.frames?.[1]?.renderStats?.entitiesRendered ?? 0).toBeGreaterThan(5);
    // The player actually moved: the two frames differ.
    const start = r.frames?.[0]?.path as string;
    const after = r.frames?.[1]?.path as string;
    const framesDiffer = await diffImages(start, after, join(OUT, 'drive-frames.diff.png'), 0.001);
    expect(framesDiffer.match).toBe(false);

    // The green player starts in the middle of the fixed view and has left it.
    const center = { x: 0.49, y: 0.48, width: 0.02, height: 0.04 };
    const before = await frameStats(start, { region: center });
    expect(before.mean[1]).toBeGreaterThan(before.mean[0] + 60);
    // This played perspective view also covers the former static arena smoke capture.
    expect((await frameStats(start)).coverage).toBeGreaterThan(0.03);
    const later = await frameStats(after, { region: center });
    expect(later.mean[1]).toBeLessThan(later.mean[0] + 20);
  });
});
