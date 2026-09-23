/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, diffImages, driveScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

// A PLAYED scenario as a regression test: the agent harness runs the real game — move east,
// watch enemies spawn and chase — with frames captured mid-story and asserts on the outcome.
// Deterministic: same seed + same actions = the same frames, so the "after" frame is a golden.
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
    // Two candidates, not a reference image: `diffImages` is the plain comparison. `compareGolden`
    // would treat `after` as a golden and record it when absent.
    const framesDiffer = await diffImages(start, after, join(OUT, 'drive-frames.diff.png'), 0.001);
    expect(framesDiffer.match).toBe(false);

    // And the played outcome is pixel-stable against the committed golden.
    const g = await compareGolden(
      after,
      join(GOLDENS, 'drive-after.png'),
      join(OUT, 'drive-after.diff.png'),
      { maxDiffRatio: 0.01 },
    );
    expect(
      g.ok,
      `drive golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
    ).toBe(true);
  });
});
