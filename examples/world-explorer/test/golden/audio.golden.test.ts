import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { playExperience } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

// Sound is not in any image: this plays the built explorer and reads the HUD's list of playing
// voices with their levels, checking that the soundscape follows the weather, the navigation mode
// and the listener's height above the ground.
describe('browser: explorer soundscape', () => {
  it('fades birdsong as you climb away from the ground and plays rain when it rains', async () => {
    const root = process.cwd();
    const scenario = JSON.parse(await readFile(join(root, 'test/visual/audio.play.json'), 'utf8'));
    scenario.path += `${scenario.path.includes('?') ? '&' : '?'}backend=webgl`;
    const result = await playExperience({
      appDir: join(root, 'dist'),
      scenario,
      outDir: join(root, 'test/golden/__output__/audio'),
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.diagnostics?.filter((d) => d.kind === 'page-error')).toEqual([]);
    const frames = new Map(result.frames?.map((f) => [f.name, levels(f.probes.sound)]));
    const walk = frames.get('01-walk');
    const low = frames.get('02-fly-low');
    const high = frames.get('03-fly-high');
    const rain = frames.get('04-rain');
    expect(walk?.get('ambience.birds')).toBeGreaterThan(0);
    expect([...(walk?.keys() ?? [])].some((s) => s.startsWith('music.'))).toBe(true);
    // Birdsong comes from the ground: a few dozen meters up it is quieter, and it keeps fading as
    // you climb (the scenario climbs until it stops altogether, about 200 m up).
    const onFoot = walk?.get('ambience.birds') as number;
    const flyingLow = low?.get('ambience.birds') as number;
    expect(flyingLow).toBeLessThan(onFoot);
    expect(high?.get('ambience.birds') ?? 0).toBeLessThan(flyingLow);
    expect(rain?.has('ambience.rain')).toBe(true);
    expect(rain?.has('ambience.birds')).toBe(false);
  });
});

/** "Playing ambience.birds 70%, ambience.wind 6%" → Map { 'ambience.birds' => 70, … }. */
function levels(status: string | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const match of (status ?? '').matchAll(/([a-z0-9.-]+) (\d+)%/g))
    out.set(match[1] as string, Number(match[2]));
  return out;
}
