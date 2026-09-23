import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, playExperience } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DIR = join(ROOT, 'test', 'golden');
const OUT = join(DIR, '__output__', 'worldgen-synthetic');
const GOLDENS = join(DIR, '__goldens__');

// The synthetic lineup (one building of every footprint class on a road, land bands with props)
// played through the built explorer: styled buildings in Human mode and instanced props in
// Land classes mode. Frozen water and a hidden HUD keep the frames stable; a 1% pixel tolerance
// absorbs SwiftShader noise, and the HUD probe pins the generated counts.

describe('golden: world explorer synthetic worldgen', () => {
  it('renders the lineup and its props', async () => {
    await mkdir(OUT, { recursive: true });
    const scenario = JSON.parse(
      await readFile(join(ROOT, 'test', 'visual', 'worldgen-lineup.play.json'), 'utf8'),
    );
    // These reference images belong to the legacy backend, regardless of runner capabilities.
    scenario.path += `${scenario.path.includes('?') ? '&' : '?'}backend=webgl&sky=daylight`;
    const r = await playExperience({ appDir: join(ROOT, 'dist'), scenario, outDir: OUT });
    expect(r.ok, r.error ?? JSON.stringify(r.diagnostics)).toBe(true);
    expect(r.diagnostics?.filter((d) => d.kind === 'page-error')).toEqual([]);
    const frames = r.frames ?? [];
    expect(frames.map((frame) => frame.name)).toEqual(['01-lineup-human', '02-lineup-classes']);
    const status = frames[0]?.probes?.status ?? '';
    expect(status).toMatch(/worldgen \d+ buildings/);
    expect(status).not.toMatch(/worldgen 0 buildings/);
    for (const frame of frames) {
      const g = await compareGolden(
        frame.path,
        join(GOLDENS, `worldgen-synthetic-${frame.name}.png`),
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
