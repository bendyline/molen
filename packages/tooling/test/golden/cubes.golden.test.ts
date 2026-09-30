import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRng, type World, type WorldSetup } from '@bendyline/molen-kernel';
// Import from the built package so import.meta.url resolves to dist/, where the capture bundle
// (dist/capture/) lives — the same path the published CLI/MCP use.
import { diffImages, frameStats, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

// A fixed, seeded cube scene rendered headlessly. The checks need no reference image: the same
// scene renders the same frame twice, the cubes are on screen, and another camera sees another
// frame.
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

const OUT = join(process.cwd(), 'test', 'golden', '__output__');

async function render(name: string, position: [number, number, number]): Promise<string> {
  await mkdir(OUT, { recursive: true });
  const outPath = join(OUT, `${name}.png`);
  const shot = await screenshotScene({
    scene: { format: 'molen/scene@3', name: 'golden-cubes', seed: 'g', tickRate: 30 },
    setup,
    ticks: 1,
    camera: { position, lookAt: [0, 0, 0] },
    size: [512, 288],
    outPath,
  });
  expect(shot.ok).toBe(true);
  expect(shot.renderStats?.entitiesRendered).toBe(16);
  return outPath;
}

describe('golden: cubes', () => {
  it('renders the same cube frame every time, with the cubes on screen', async () => {
    const first = await render('cubes', [0, 6, 24]);
    const second = await render('cubes-again', [0, 6, 24]);
    const same = await diffImages(first, second, join(OUT, 'cubes-again.diff.png'), 0);
    expect(same.match, `renders differ by ${same.diffRatio}`).toBe(true);
    const stats = await frameStats(first);
    // 16 small cubes cover about 1.6% of the frame in 24 shades.
    expect(stats.coverage).toBeGreaterThan(0.008);
    expect(stats.colors).toBeGreaterThanOrEqual(12);
  });

  it('renders a different frame from another camera', async () => {
    const front = await render('cubes', [0, 6, 24]);
    const side = await render('cubes-changed', [20, 2, 4]);
    const result = await diffImages(front, side, join(OUT, 'cubes-changed.diff.png'));
    expect(result.match).toBe(false);
  });
});
