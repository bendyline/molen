import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, playExperience } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DIR = join(ROOT, 'test', 'golden');
const OUT = join(DIR, '__output__', 'store-library');
const GOLDENS = join(DIR, '__goldens__');

// The identity catalog, shared tenants and mapped furniture run through the real terrain worker.
// Classification owns the mapped tree. Frozen water and a hidden HUD stabilize the review.

describe('golden: world explorer identity library', () => {
  it('renders recognized storefronts and mapped props', async () => {
    await mkdir(OUT, { recursive: true });
    const scenario = JSON.parse(
      await readFile(join(ROOT, 'test', 'visual', 'store-library.play.json'), 'utf8'),
    );
    // These reference images belong to the legacy backend, regardless of runner capabilities.
    scenario.path += `${scenario.path.includes('?') ? '&' : '?'}backend=webgl&sky=daylight`;
    const r = await playExperience({ appDir: join(ROOT, 'dist'), scenario, outDir: OUT });
    expect(r.ok, r.error ?? JSON.stringify(r.diagnostics)).toBe(true);
    expect(r.diagnostics?.filter((d) => d.kind === 'page-error')).toEqual([]);
    const frames = r.frames ?? [];
    expect(frames.map((frame) => frame.name)).toEqual([
      '01-stores-human',
      '02-stores-classes',
      '03-retail-overview',
    ]);
    const status = frames[0]?.probes?.status ?? '';
    expect(status).toMatch(/worldgen \d+ buildings/);
    expect(status).not.toMatch(/worldgen 0 buildings/);
    for (const frame of frames) {
      const g = await compareGolden(
        frame.path,
        join(GOLDENS, `store-library-${frame.name}.png`),
        join(OUT, `${frame.name}.diff.png`),
        { maxDiffRatio: 0.01 },
      );
      expect(
        g.ok,
        `${frame.name} golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
      ).toBe(true);
    }
  }, 600_000);
});
