/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { frameStats, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

// No explicit camera: the scene's own `top-down-ortho` block frames the capture, exactly as
// the browser app sees it. (Before scene@3 + the ortho-aware harness this crashed the capture.)
describe('golden: top-down arena, scene camera (ortho)', () => {
  it('renders the arena straight down from the scene camera block', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'arena-ortho.png');

    const r = await screenshotScene({
      scenePath: join(process.cwd(), 'scene.json'),
      ticks: 40,
      size: [512, 512],
      clearColor: '#1a1d24',
      outPath: candidate,
    });
    expect(r.ok, r.error).toBe(true);
    expect(r.renderStats?.entitiesRendered ?? 0).toBeGreaterThan(5);

    // The player spawns at the origin, which the camera centers: a green square in the middle.
    const player = await frameStats(candidate, {
      region: { x: 0.49, y: 0.49, width: 0.02, height: 0.02 },
    });
    expect(player.coverage).toBeGreaterThan(0.9);
    expect(player.mean[1]).toBeGreaterThan(player.mean[0] + 60);
    // Walls and enemies around it.
    const stats = await frameStats(candidate);
    expect(stats.coverage).toBeGreaterThan(0.06);
  });
});
