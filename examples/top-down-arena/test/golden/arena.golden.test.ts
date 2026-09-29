/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { frameStats, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

describe('golden: top-down arena', () => {
  it('renders the arena with player + enemies (top-down)', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'arena.png');

    // scenePath (not inline): project discovery resolves the arena.* registry types and the
    // scene loader inlines scripts/*.js — no setup module, the arena is pure data.
    const r = await screenshotScene({
      scenePath: join(process.cwd(), 'scene.json'),
      ticks: 40, // enough for several enemies to spawn and approach
      size: [512, 512],
      // High, slightly-angled camera for a top-down view (true ortho is in the browser app).
      camera: { position: [0, 30, 13], lookAt: [0, 0, 0] },
      clearColor: '#1a1d24',
      outPath: candidate,
    });
    expect(r.ok, r.error).toBe(true);
    expect(r.renderStats?.entitiesRendered ?? 0).toBeGreaterThan(5); // walls + player + enemies

    // The player spawns at the origin, which the camera centers: a green square in the middle.
    const player = await frameStats(candidate, {
      region: { x: 0.49, y: 0.49, width: 0.02, height: 0.02 },
    });
    expect(player.coverage).toBeGreaterThan(0.9);
    expect(player.mean[1]).toBeGreaterThan(player.mean[0] + 60);
    // Walls and enemies around it.
    const stats = await frameStats(candidate);
    expect(stats.coverage).toBeGreaterThan(0.03);
  });
});
