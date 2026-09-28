import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { playExperience } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

// Engines are data on the molen.entities vehicle and aircraft types. This boards a car, the OH-6
// and the P-51 in the built explorer and reads the HUD's list of playing voices with their levels.
describe('browser: vehicle and aircraft engines', () => {
  it('runs a car engine while driven and aircraft engines from their rpm', async () => {
    const root = process.cwd();
    const scenario = JSON.parse(
      await readFile(join(root, 'test/visual/engines.play.json'), 'utf8'),
    );
    const pin = (path: string): string => `${path}${path.includes('?') ? '&' : '?'}backend=webgl`;
    scenario.path = pin(scenario.path);
    for (const action of scenario.actions) {
      if (action.type === 'navigate') action.path = pin(action.path);
    }
    const result = await playExperience({
      appDir: join(root, 'dist'),
      scenario,
      outDir: join(root, 'test/golden/__output__/engines'),
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.diagnostics?.filter((d) => d.kind === 'page-error')).toEqual([]);
    const at = new Map(result.frames?.map((f) => [f.name, levels(f.probes.sound)]));
    const engine = (frame: string, prefix: string): number | undefined =>
      [...(at.get(frame) ?? new Map<string, number>())].find(([sound]) =>
        sound.startsWith(prefix),
      )?.[1];

    expect(engine('01-parked', 'vehicle.engine')).toBeUndefined();
    const idle = engine('02-car-idle', 'vehicle.engine') as number;
    expect(idle).toBeGreaterThan(0);
    expect(engine('03-car-throttle', 'vehicle.engine')).toBeGreaterThan(idle);
    expect(engine('04-car-exited', 'vehicle.engine')).toBeUndefined();

    expect(engine('05-helicopter-cold', 'aircraft.engine')).toBeUndefined();
    expect(engine('06-helicopter-running', 'aircraft.engine.helicopter')).toBeGreaterThan(0);
    const mustangIdle = engine('07-mustang-idle', 'aircraft.engine.piston') as number;
    expect(mustangIdle).toBeGreaterThan(0);
    expect(engine('08-mustang-full-power', 'aircraft.engine.piston')).toBeGreaterThan(mustangIdle);
  });
});

/** "Playing ambience.birds 70%, vehicle.engine.car 55%" → Map { 'ambience.birds' => 70, … }. */
function levels(status: string | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const match of (status ?? '').matchAll(/([a-z0-9.-]+) (\d+)%/g))
    out.set(match[1] as string, Number(match[2]));
  return out;
}
