import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { diffImages, frameStats, screenshotScene } from '@bendyline/molen-tooling';
import { expect, it } from 'vitest';

it('renders retained laminate cracks and released safety-glass granules deterministically', async () => {
  const output = join(process.cwd(), 'test/golden/__output__');
  await mkdir(output, { recursive: true });
  const render = async (name: string, ticks: number): Promise<string> => {
    const path = join(output, `${name}.png`);
    const result = await screenshotScene({
      scenePath: join(process.cwd(), 'test/fixtures/glass.scene.json'),
      ticks,
      camera: { position: [0, 2.3, 10], lookAt: [0, 1.4, 0] },
      size: [960, 540],
      outPath: path,
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.renderStats?.entitiesRendered).toBe(5);
    expect(result.renderStats?.drawCalls).toBeLessThan(15);
    return path;
  };
  const intact = await render('glass-intact', 0);
  const broken = await render('glass-broken', 12);
  const repeated = await render('glass-repeated', 12);
  const gone = await render('glass-debris-expired', 250);
  expect((await diffImages(broken, repeated, join(output, 'glass-repeat.diff.png'), 0)).match).toBe(
    true,
  );
  expect((await diffImages(intact, broken, join(output, 'glass-break.diff.png'), 0)).match).toBe(
    false,
  );
  expect((await diffImages(broken, gone, join(output, 'glass-expire.diff.png'), 0)).match).toBe(
    false,
  );
  // Local captures cover about 25% with the comparison rig, far above a blank frame.
  expect((await frameStats(broken)).coverage).toBeGreaterThan(0.1);
});
