import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { playExperience } from '@bendyline/molen-tooling';
import { expect, it } from 'vitest';

it('flies into the mapped Mount Baker tunnel without being lifted onto the ridge', async () => {
  const scenario = JSON.parse(
    await readFile(join(process.cwd(), 'test/visual/tunnels.play.json'), 'utf8'),
  );
  const result = await playExperience({
    appDir: join(process.cwd(), 'dist'),
    scenario,
    outDir: join(process.cwd(), 'test/golden/__output__/tunnels'),
  });
  expect(result.ok, result.error).toBe(true);
  expect(result.diagnostics?.filter((d) => d.kind === 'page-error')).toEqual([]);
  const frames = new Map(result.frames?.map((frame) => [frame.name, frame.probes]));
  const position = (name: string): { longitude: number; altitude: number } => {
    const text = frames.get(name)?.location;
    const longitude = text?.match(/Lon ([\d.-]+)°/),
      altitude = text?.match(/Altitude ([\d.-]+) m/);
    if (!longitude || !altitude) throw new Error(`Missing tunnel camera telemetry: ${text}`);
    return { longitude: Number(longitude[1]), altitude: Number(altitude[1]) };
  };
  const before = position('01-portal'),
    inside = position('02-inside');
  expect(inside.longitude).toBeLessThan(before.longitude - 0.0002);
  // The inferred road grade here is 34–37 m; the ridge above it reaches about 80 m.
  expect(inside.altitude).toBeGreaterThan(30);
  expect(inside.altitude).toBeLessThan(45);
});
