import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { frameStats, rasterizeMaterial } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

// The ramp's darkest and lightest stops bound every baked texel.
const DARK = [0x3a, 0x3f, 0x2e];
const LIGHT = [0xa8, 0xa2, 0x82];

describe('golden: material graph', () => {
  it('bakes the same varied rock texture every time, within its ramp', async () => {
    await mkdir(OUT, { recursive: true });
    const bake = async (name: string): Promise<string> => {
      const outPath = join(OUT, `${name}.png`);
      const r = await rasterizeMaterial({
        outPath,
        inline: {
          format: 'molen/matgraph@1',
          size: [96, 96],
          seed: 4242,
          nodes: [
            { id: 'n1', type: 'noise', params: { kind: 'simplex', octaves: 5, scale: 6 } },
            {
              id: 'n2',
              type: 'ramp',
              input: 'n1',
              params: {
                stops: [
                  { t: 0, color: '#3a3f2e' },
                  { t: 0.5, color: '#6e6a4a' },
                  { t: 1, color: '#a8a282' },
                ],
              },
            },
          ],
          outputs: { baseColor: 'n2' },
        },
      });
      expect(r.ok).toBe(true);
      expect(r.width).toBe(96);
      return outPath;
    };
    const first = await bake('rock');
    const second = await bake('rock-again');
    expect(await readFile(second)).toEqual(await readFile(first));
    const stats = await frameStats(first);
    for (let channel = 0; channel < 3; channel++) {
      expect(stats.mean[channel]).toBeGreaterThanOrEqual(DARK[channel] as number);
      expect(stats.mean[channel]).toBeLessThanOrEqual(LIGHT[channel] as number);
    }
    // Five octaves of noise through the ramp: a varied surface, not one flat color.
    expect(stats.colors).toBeGreaterThanOrEqual(8);
  });
});
