import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { playExperience } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';
import { explorerPerformanceTier } from '../../src/performance-policy';

// Live quality changes must retain the camera and mounted viewer. This intentionally avoids
// FPS assertions: software rendering in CI is useful for lifecycle coverage, not device ratings.
describe('browser: live device quality', () => {
  it('switches manual and Auto quality without reloading or moving the camera', async () => {
    const root = process.cwd();
    const scenario = JSON.parse(
      await readFile(join(root, 'test/visual/live-quality.play.json'), 'utf8'),
    );
    scenario.path += `${scenario.path.includes('?') ? '&' : '?'}backend=webgl`;
    const result = await playExperience({
      appDir: join(root, 'dist'),
      scenario,
      outDir: join(root, 'test/golden/__output__/live-quality'),
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.diagnostics?.filter((diagnostic) => diagnostic.kind === 'page-error')).toEqual(
      [],
    );
    const frames = new Map(result.frames?.map((frame) => [frame.name, frame.probes]));
    const initial = position(frames.get('01-before-navigation')?.status);
    const moved = position(frames.get('02-before-quality-switch')?.status);
    expect(moved).not.toEqual(initial);
    for (const name of ['03-economy', '04-high', '05-auto']) {
      expect(position(frames.get(name)?.status), name).toEqual(moved);
      expect(frames.get(name)?.performance).toBeTruthy();
    }
    expect(frames.get('03-economy')?.quality?.toLowerCase()).toContain('economy');
    expect(frames.get('04-high')?.quality?.toLowerCase()).toContain('high');
    expect(frames.get('05-auto')?.quality?.toLowerCase()).toContain('auto');
    const performance = frames.get('05-auto')?.performance ?? '';
    const tierName = performance.match(/Auto · ([^·]+) ·/)?.[1]?.trim();
    const tier = Array.from({ length: 6 }, (_, level) => explorerPerformanceTier(level)).find(
      (candidate) => candidate.name === tierName,
    );
    expect(tier, performance).toBeDefined();
    const resolution = performance.match(/resolution (\d+)×(\d+)/);
    expect(resolution, performance).not.toBeNull();
    expect(Number(resolution?.[1]) * Number(resolution?.[2])).toBeLessThanOrEqual(
      tier?.maxPixels ?? 0,
    );
  });
});

function position(status: string | undefined): [number, number, number] {
  const match = status?.match(/lat ([\d.-]+)\s+lon ([\d.-]+)\s+altitude ([\d.-]+)m/);
  if (!match) throw new Error(`Missing camera telemetry: ${status}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
