import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, previewWorldgen } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

// Generation to pixels, closed: the default pack's lineup (one building of every footprint
// class) rendered through the worldgen preview page, on flat and sloped ground. The generated
// counts are asserted alongside the image so a geometry change is caught even where pixels
// stay within tolerance.

describe('golden: worldgen preview', () => {
  for (const ground of ['flat', 'slope'] as const) {
    it(`renders the lineup on ${ground} ground`, async () => {
      await mkdir(OUT, { recursive: true });
      const name = `worldgen-preview-${ground}`;
      const candidate = join(OUT, `${name}.png`);
      const r = await previewWorldgen({
        ground,
        size: [640, 360],
        outPath: candidate,
      });
      expect(r.ok, r.error).toBe(true);
      expect(r.stats?.buildingsRendered).toBe(10);
      expect(r.stats?.buildingsBoxed).toBe(0);
      expect(r.renderStats?.instances).toBeGreaterThan(0);
      expect(r.materialFailures).toEqual([]);
      const g = await compareGolden(
        candidate,
        join(GOLDENS, `${name}.png`),
        join(OUT, `${name}.diff.png`),
        {
          maxDiffRatio: 0.005,
        },
      );
      expect(
        g.ok,
        `${name} golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
      ).toBe(true);
    });
  }
});
