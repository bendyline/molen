import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { playExperience } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

// Exercise real keyboard events, mode switches, and streaming through the built viewer.
// The scenario uses lightweight semantic meshes so software rendering does not hide input bugs
// behind the dense vegetation fixture. Its waits also assert jumping and subsequent landing.
describe('browser: walk navigation', () => {
  it('enters at human height, walks without flying, jumps, and returns to flight', async () => {
    const root = process.cwd();
    const scenario = JSON.parse(
      await readFile(join(root, 'test/visual/walk-mode.play.json'), 'utf8'),
    );
    scenario.path += `${scenario.path.includes('?') ? '&' : '?'}backend=webgl`;
    const result = await playExperience({
      appDir: join(root, 'dist'),
      scenario,
      outDir: join(root, 'test/golden/__output__/walk-navigation'),
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.diagnostics?.filter((d) => d.kind === 'page-error')).toEqual([]);
    const frames = new Map(result.frames?.map((frame) => [frame.name, frame.probes]));
    expect(frames.get('01-walk-human-scale')?.navigation).toContain('1.7m eye height · On ground');
    for (const frame of frames.values()) {
      expect(frame?.location).toMatch(/Lat -?\d+\.\d{7}° · Lon -?\d+\.\d{7}° \(WGS84\)/);
      expect(frame?.location).toMatch(/Altitude -?\d+\.\d{2} m · Heading/);
      expect(frame?.location).toMatch(/Yaw -?\d+\.\d{5} rad · Pitch -?\d+\.\d{5} rad/);
    }
    expect(frames.get('02-walk-forward')?.location).not.toBe(
      frames.get('02-bare-before-walk')?.location,
    );
    const before = position(frames.get('02-bare-before-walk')?.status);
    const after = position(frames.get('02-walk-forward')?.status);
    expect(after[0] - before[0]).toBeGreaterThan(0);
    expect(after[0] - before[0]).toBeLessThan(0.0002);
    expect(after[1]).toBe(before[1]);
    expect(position(frames.get('03-no-flight-on-foot')?.status)).toEqual(after);
    expect(frames.get('05-landed')?.navigation).toContain('On ground');
    expect(frames.get('06-fly')?.navigation).toContain('Fly mode');
    expect(position(frames.get('06-fly')?.status)[2] - after[2]).toBeGreaterThan(30);
  });
});

function position(status: string | undefined): [number, number, number] {
  const match = status?.match(/lat ([\d.-]+)\s+lon ([\d.-]+)\s+altitude ([\d.-]+)m/);
  if (match === undefined || match === null) throw new Error(`Missing camera telemetry: ${status}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
