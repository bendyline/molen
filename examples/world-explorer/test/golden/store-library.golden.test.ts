import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { diffImages, frameStats, playExperience } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DIR = join(ROOT, 'test', 'golden');
const OUT = join(DIR, '__output__', 'store-library');

// The identity catalog, shared tenants and mapped furniture run through the real terrain worker.
// Classification owns the mapped tree. Frozen water and a hidden HUD keep the frames to the
// world. The frames are 640x360, like the worldgen preview's: software rendering cost follows
// pixel count, and at 1280x720 with a second Human-mode page this one test took 24 minutes in CI.
// No reference image: the checks are that both frames show the street, and that classification
// recolors it.

describe('golden: world explorer identity library', () => {
  it('renders recognized storefronts and mapped props', async () => {
    await mkdir(OUT, { recursive: true });
    const scenario = JSON.parse(
      await readFile(join(ROOT, 'test', 'visual', 'store-library.play.json'), 'utf8'),
    );
    // The legacy backend in fixed daylight, regardless of runner capabilities or time zone
    // (without `sky=daylight` the sky is noon in the browser's zone, which on a UTC runner is
    // before dawn here). Pin every page, including the navigation.
    const pin = (path: string): string =>
      `${path}${path.includes('?') ? '&' : '?'}backend=webgl&sky=daylight`;
    scenario.path = pin(scenario.path);
    for (const action of scenario.actions) {
      if (action.type === 'navigate') action.path = pin(action.path);
    }
    const r = await playExperience({ appDir: join(ROOT, 'dist'), scenario, outDir: OUT });
    expect(r.ok, r.error ?? JSON.stringify(r.diagnostics)).toBe(true);
    expect(r.diagnostics?.filter((d) => d.kind === 'page-error')).toEqual([]);
    const frames = r.frames ?? [];
    expect(frames.map((frame) => frame.name)).toEqual(['01-stores-human', '02-stores-classes']);
    const status = frames[0]?.probes?.status ?? '';
    expect(status).toMatch(/worldgen \d+ buildings/);
    expect(status).not.toMatch(/worldgen 0 buildings/);
    // Both frames show the street: about 43-64% of the frame, in 116 (classes) to 570 shades.
    for (const frame of frames) {
      const stats = await frameStats(frame.path);
      expect(stats.coverage, `${frame.name} coverage`).toBeGreaterThan(0.2);
      expect(stats.colors, `${frame.name} colors`).toBeGreaterThanOrEqual(40);
    }
    const [human, classes] = frames.map((frame) => frame.path) as [string, string];
    const recolored = await diffImages(human, classes, join(OUT, 'classes.diff.png'));
    expect(recolored.match, `classification matches human but for ${recolored.diffRatio}`).toBe(
      false,
    );
  });
});
