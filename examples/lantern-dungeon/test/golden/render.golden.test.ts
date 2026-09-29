/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { diffImages, driveScene, frameStats } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

// Pixel coverage for the shipped game, from the first-person follow camera. The browser test next
// door proves the built Worker app boots, takes input and restarts; it measures no pixels. This
// drives the same scene deterministically (fixed seed, fixed ticks) and checks the frames without
// a reference image: the vault is drawn (60-70% of the frame, 650-770 shades) and the view moves
// with the walk. Because the scene resolves through project.json, it also exercises the imported
// GLB models the dungeon dresses itself with.

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
          // this test is about.
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
      const stats = await frameStats(frame.path);
      expect(stats.coverage, `${frame.name} coverage`).toBeGreaterThan(0.3);
      expect(stats.colors, `${frame.name} colors`).toBeGreaterThanOrEqual(300);
    }
    // The follow camera went with the player, so the second frame is not the first.
    const [start, exploring] = (r.frames ?? []).map((f) => f.path) as [string, string];
    const moved = await diffImages(start, exploring, join(OUT, 'exploring.diff.png'));
    expect(moved.match, `exploring matches start but for ${moved.diffRatio}`).toBe(false);
  }, 120_000);
});
