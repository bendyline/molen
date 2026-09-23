/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, driveScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

// Pixel coverage for the shipped game, from the first-person follow camera. The browser test next
// door proves the built Worker app boots, takes input and restarts; it captures frames nobody
// compares. This drives the same scene deterministically (fixed seed, fixed ticks) so the frames
// ARE comparable — and because the scene resolves through project.json, it also exercises the
// imported GLB models the dungeon dresses itself with.

describe('golden: lantern vault', () => {
  it('renders the vault and a torchlit walk down the hall', async () => {
    await mkdir(OUT, { recursive: true });

    const r = await driveScene({
      scenePath: join(process.cwd(), 'scene.json'),
      outDir: OUT,
      size: [640, 400],
      actions: [
        { at: 0, screenshot: 'start' },
        { at: 1, command: { type: 'move', payload: { dir: [0, -1] } } },
        { at: 40, command: { type: 'move', payload: { dir: [0, 0] } } },
        { at: 45, command: { type: 'attack', payload: {} } },
        { at: 55, screenshot: 'exploring' },
      ],
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          // A dead traveler freezes every gameplay system, so the frame would not be the one
          // this golden is about.
          { select: '#game .dungeonGame.status', op: 'eq', value: 'playing' },
          // Walked north up the hall from the z=12 spawn.
          { select: '#player .transform.pos[2]', op: 'lt', value: 11 },
          // The swing was adjudicated rather than swallowed.
          { select: '#game .dungeonGame.attackTick', op: 'gte', value: 0 },
        ],
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.ok, r.assertionsFormatted).toBe(true);
    expect(r.frames?.map((f) => f.name)).toEqual(['start', 'exploring']);
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
