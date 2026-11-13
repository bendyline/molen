import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { diffImages, frameStats, playExperience } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

// A map override through the built viewer: the Box sample stands where one building of the
// lineup fixture stood, given in the page address, and U takes it back while the page runs. The
// frames are compared with each other, never with a reference image (a software rasterizer is
// only deterministic per machine): the same view twice is the same frame, the replaced view
// differs from the mapped one where the building is and nowhere else, and the undone view is the
// mapped one again.
describe('browser: replacing a building', () => {
  it('shows a sample where a mapped building stood, and the map again once undone', async () => {
    const root = process.cwd();
    const scenario = JSON.parse(
      await readFile(join(root, 'test/visual/replace-building.play.json'), 'utf8'),
    );
    const pinned = (path: string): string =>
      `${path}${path.includes('?') ? '&' : '?'}backend=webgl`;
    scenario.path = pinned(scenario.path);
    for (const action of scenario.actions)
      if (action.type === 'navigate') action.path = pinned(action.path);
    const out = join(root, 'test/golden/__output__/replace-building');
    const result = await playExperience({ appDir: join(root, 'dist'), scenario, outDir: out });
    expect(result.ok, result.error).toBe(true);
    expect(result.diagnostics?.filter((d) => d.kind === 'page-error')).toEqual([]);
    const frames = new Map(result.frames?.map((frame) => [frame.name, frame]));
    const path = (name: string): string => {
      const frame = frames.get(name);
      if (frame === undefined) throw new Error(`Missing frame ${name}`);
      return frame.path;
    };
    // The sample came from the page address, and undoing it said so.
    expect(frames.get('02-replaced')?.probes.overrides).toContain('Box placed');
    expect(frames.get('03-undone')?.probes.overrides).toContain('Undone');
    // The view is lit (mean brightness 150 or so). Unlit, ground and buildings are all black and
    // every comparison below is between empty frames.
    expect(
      (await frameStats(path('01-before'))).luminance,
      'the first view is dark',
    ).toBeGreaterThan(60);

    // The replaced view is still: two captures of it are one frame.
    const still = await diffImages(
      path('02-replaced'),
      path('02-replaced-again'),
      join(out, 'diff-replaced-again.png'),
    );
    expect(still.diffPixels).toBe(0);

    // The box is not the building that stood there: 2.5% of the frame differed (12,773 pixels of
    // 960x540), the courtyard block and the ground cleared around the box.
    const replaced = await diffImages(
      path('01-before'),
      path('02-replaced'),
      join(out, 'diff-replaced.png'),
      0,
    );
    expect(replaced.diffRatio).toBeGreaterThan(0.008);
    expect(replaced.diffRatio).toBeLessThan(0.08);
    // The difference is where the block stands, upper middle: there the cleared ground and the
    // box's roof read darker than the block (mean brightness 167.5 before, 160.2 after)...
    const block = { x: 0.35, y: 0.12, width: 0.3, height: 0.42 };
    const blockBefore = await frameStats(path('01-before'), { region: block });
    const blockAfter = await frameStats(path('02-replaced'), { region: block });
    expect(blockBefore.luminance - blockAfter.luminance).toBeGreaterThan(2);
    // ...and nowhere else: the open ground in the lower part of the frame did not change at all
    // (153.04 in both).
    const ground = { x: 0, y: 0.6, width: 1, height: 0.4 };
    const groundBefore = await frameStats(path('01-before'), { region: ground });
    const groundAfter = await frameStats(path('02-replaced'), { region: ground });
    expect(Math.abs(groundAfter.luminance - groundBefore.luminance)).toBeLessThan(0.5);

    // Undone while the page runs, the tiles are built again from the map as it was: no pixel
    // differed from the first view. A little room, as this compares two page loads.
    const undone = await diffImages(
      path('01-before'),
      path('03-undone'),
      join(out, 'diff-undone.png'),
      0,
    );
    expect(undone.diffRatio).toBeLessThan(0.0005);
  });
});
