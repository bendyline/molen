import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRng, type World, type WorldSetup } from '@bendyline/molen-kernel';
// Import from the built package so import.meta.url resolves to dist/, where the capture bundle
// (dist/capture/) lives — the same path the published CLI/MCP use.
import { compareGolden, diffImages, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

// A fixed, deterministic cube scene rendered headlessly and diffed against a committed golden.
const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0'];

const setup: WorldSetup = (world: World): void => {
  const rng = createRng('golden-cubes');
  for (let i = 0; i < 16; i++) {
    world.spawnRaw({
      transform: { pos: [rng.range(-7, 7), rng.range(-4, 4), rng.range(-7, 7)], rot: [0, 0, 0, 1] },
      renderable: {
        kind: 'primitive',
        ref: 'box',
        materialRef: `palette:${PALETTE[rng.int(PALETTE.length)] as string}`,
      },
    });
  }
};

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

describe('golden: cubes', () => {
  it('renders a deterministic cube frame matching the golden', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'cubes.png');
    const golden = join(GOLDENS, 'cubes.png');
    const diff = join(OUT, 'cubes.diff.png');

    const shot = await screenshotScene({
      scene: { format: 'molen/scene@3', name: 'golden-cubes', seed: 'g', tickRate: 30 },
      setup,
      ticks: 1,
      camera: { position: [0, 6, 24], lookAt: [0, 0, 0] },
      size: [512, 288],
      outPath: candidate,
    });
    expect(shot.ok).toBe(true);
    expect(shot.renderStats?.entitiesRendered).toBe(16);

    const result = await compareGolden(candidate, golden, diff);
    if (!result.ok) {
      throw new Error(
        `golden mismatch (${result.diffRatio ?? '?'} diff): ${result.reason}. ` +
          `See ${diff}. Run with UPDATE_GOLDENS=1 to refresh.`,
      );
    }
    expect(result.ok).toBe(true);
  });

  it('detects when the render changes (intentional-change guard)', async () => {
    await mkdir(OUT, { recursive: true });
    const golden = join(GOLDENS, 'cubes.png');
    const changed = join(OUT, 'cubes-changed.png');
    const diff = join(OUT, 'cubes-changed.diff.png');

    // Render a visibly different scene (different camera) and confirm it does NOT match.
    const shot = await screenshotScene({
      scene: { format: 'molen/scene@3', name: 'golden-cubes', seed: 'g', tickRate: 30 },
      setup,
      ticks: 1,
      camera: { position: [20, 2, 4], lookAt: [0, 0, 0] },
      size: [512, 288],
      outPath: changed,
    });
    expect(shot.ok).toBe(true);

    // Only meaningful once a golden exists (skip the very first run that just created it).
    const { access } = await import('node:fs/promises');
    let goldenExists = true;
    try {
      await access(golden);
    } catch {
      goldenExists = false;
    }
    if (goldenExists) {
      const result = await diffImages(golden, changed, diff);
      expect(result.match).toBe(false);
    }
    await rm(diff, { force: true });
  });
});
