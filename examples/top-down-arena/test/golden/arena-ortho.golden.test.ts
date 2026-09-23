/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

// No explicit camera: the scene's own `top-down-ortho` block frames the capture, exactly as
// the browser app sees it. (Before scene@3 + the ortho-aware harness this crashed the capture.)
describe('golden: top-down arena, scene camera (ortho)', () => {
  it('renders the arena straight down from the scene camera block', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'arena-ortho.png');
    const golden = join(GOLDENS, 'arena-ortho.png');
    const diff = join(OUT, 'arena-ortho.diff.png');

    const r = await screenshotScene({
      scenePath: join(process.cwd(), 'scene.json'),
      ticks: 40,
      size: [512, 512],
      clearColor: '#1a1d24',
      outPath: candidate,
    });
    expect(r.ok, r.error).toBe(true);
    expect(r.renderStats?.entitiesRendered ?? 0).toBeGreaterThan(5);

    const g = await compareGolden(candidate, golden, diff, { maxDiffRatio: 0.01 });
    expect(
      g.ok,
      `arena-ortho golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
    ).toBe(true);
  });
});
