/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { diffImages, driveScene, frameStats } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

// Pixel coverage for the shipped game. The browser test next door proves the built Worker app
// boots and takes input, but it measures no pixels — a renderer change that drew the city black
// would pass it. This drives the same scene deterministically through the headless capture path
// (fixed seed, fixed ticks, no wall clock) and checks the frames need no reference image: the
// city is drawn (about a third of the frame, 180-220 shades) and the camera follows the drive.

describe('golden: city courier', () => {
  it('renders the city from the follow camera and after driving', async () => {
    await mkdir(OUT, { recursive: true });

    const r = await driveScene({
      scenePath: join(process.cwd(), 'scene.json'),
      outDir: OUT,
      size: [640, 400],
      actions: [
        { at: 0, screenshot: 'start' },
        { at: 1, command: { type: 'drive', payload: { dir: [0, -1] } } },
        { at: 55, command: { type: 'drive', payload: { dir: [0, 0] } } },
        { at: 70, screenshot: 'driving' },
      ],
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          // Still a live run at capture time: a lost/won frame would be a different picture.
          { select: '#game .courierGame.status', op: 'eq', value: 'playing' },
          // Drove north up the avenue from the z=12 spawn, and stayed on the map.
          { select: '#player .transform.pos[2]', op: 'lt', value: 6 },
          { select: '#player .transform.pos[2]', op: 'gt', value: -6 },
        ],
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.ok, r.assertionsFormatted).toBe(true);
    expect(r.frames?.map((f) => f.name)).toEqual(['start', 'driving']);
    // A blank render would still "pass" a pixel diff against a blank golden, so pin the scene.
    expect(r.frames?.[0]?.renderStats?.entitiesRendered ?? 0).toBeGreaterThan(20);

    for (const frame of r.frames ?? []) {
      const stats = await frameStats(frame.path);
      expect(stats.coverage, `${frame.name} coverage`).toBeGreaterThan(0.15);
      expect(stats.colors, `${frame.name} colors`).toBeGreaterThanOrEqual(90);
    }
    // The follow camera went with the player, so the second frame is not the first.
    const [start, driving] = (r.frames ?? []).map((f) => f.path) as [string, string];
    const moved = await diffImages(start, driving, join(OUT, 'driving.diff.png'));
    expect(moved.match, `driving matches start but for ${moved.diffRatio}`).toBe(false);
  }, 120_000);
});
