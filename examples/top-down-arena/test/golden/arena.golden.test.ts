/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

describe('golden: top-down arena', () => {
  it('renders the arena with player + enemies (top-down)', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'arena.png');
    const golden = join(GOLDENS, 'arena.png');
    const diff = join(OUT, 'arena.diff.png');

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

    const g = await compareGolden(candidate, golden, diff, { maxDiffRatio: 0.01 });
    expect(
      g.ok,
      `arena golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
    ).toBe(true);
  });
});
