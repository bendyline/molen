/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { diffImages, driveScene, frameStats } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

// Pixel coverage for the shipped game, from the side-scrolling follow camera. The browser test
// next door proves the built Worker app boots, takes input and restarts; it measures no pixels.
// This drives the same scene deterministically and checks the frames without a reference image:
// open sky above the islands (the sky is the frame's backdrop), ground across the lower part, and
// a view that scrolls with the run.

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
      const stats = await frameStats(frame.path);
      expect(stats.coverage, `${frame.name} coverage`).toBeGreaterThan(0.15);
      expect(stats.colors, `${frame.name} colors`).toBeGreaterThanOrEqual(100);
      // Sky along the top, the islands' earth across the lower part.
      const sky = await frameStats(frame.path, { region: { x: 0, y: 0, width: 1, height: 0.12 } });
      expect(sky.coverage, `${frame.name} sky`).toBeLessThan(0.1);
      const ground = await frameStats(frame.path, {
        region: { x: 0, y: 0.6, width: 1, height: 0.2 },
      });
      expect(ground.coverage, `${frame.name} ground`).toBeGreaterThan(0.5);
    }
    // The follow camera went with the player, so the second frame is not the first.
    const [start, running] = (r.frames ?? []).map((f) => f.path) as [string, string];
    const moved = await diffImages(start, running, join(OUT, 'running.diff.png'));
    expect(moved.match, `running matches start but for ${moved.diffRatio}`).toBe(false);
  }, 120_000);
});
