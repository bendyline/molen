/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, driveScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

// Pixel coverage for the shipped game, from the side-scrolling follow camera. The browser test
// next door proves the built Worker app boots, takes input and restarts; it captures frames
// nobody compares. This drives the same scene deterministically so the frames ARE comparable.

describe('golden: skybound', () => {
  it('renders the islands and a run-and-jump to the east', async () => {
    await mkdir(OUT, { recursive: true });

    const r = await driveScene({
      scenePath: join(process.cwd(), 'scene.json'),
      outDir: OUT,
      size: [640, 400],
      // Kept short on purpose: running east past the first ledge drops the player into the void,
      // and a respawn would silently reset x to 0 — the capture would then be of the spawn, not
      // of a run, while every loose assertion still passed.
      actions: [
        { at: 0, screenshot: 'start' },
        { at: 1, command: { type: 'move', payload: { dir: [1, 0] } } },
        { at: 10, command: { type: 'jump', payload: { held: true } } },
        { at: 18, command: { type: 'jump', payload: { held: false } } },
        { at: 22, command: { type: 'move', payload: { dir: [0, 0] } } },
        { at: 34, screenshot: 'running' },
      ],
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          { select: '#game .skyGame.status', op: 'eq', value: 'playing' },
          // Ran east from the x=0 spawn and is still on the level, not in the void.
          { select: '#player .transform.pos[0]', op: 'gt', value: 2 },
          { select: '#player .transform.pos[1]', op: 'gt', value: -5 },
          // Never fell: a respawn would have put the player back at the spawn mid-capture.
          { select: '#game .skyGame.lives', op: 'eq', value: 3 },
        ],
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.ok, r.assertionsFormatted).toBe(true);
    expect(r.frames?.map((f) => f.name)).toEqual(['start', 'running']);
    expect(r.frames?.[0]?.renderStats?.entitiesRendered ?? 0).toBeGreaterThan(20);

    for (const frame of r.frames ?? []) {
      const g = await compareGolden(
        frame.path,
        join(GOLDENS, `${frame.name}.png`),
        join(OUT, `${frame.name}.diff.png`),
        { maxDiffRatio: 0.01 },
      );
      expect(
        g.ok,
        `${frame.name} golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
      ).toBe(true);
    }
  }, 120_000);
});
