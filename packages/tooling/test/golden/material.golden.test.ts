import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { compareGolden, rasterizeMaterial } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

describe('golden: material graph', () => {
  it('bakes a deterministic rock texture matching the golden', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'rock.png');
    const golden = join(GOLDENS, 'rock.png');
    const diff = join(OUT, 'rock.diff.png');

    const r = await rasterizeMaterial({
      outPath: candidate,
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

    const result = await compareGolden(candidate, golden, diff);
    if (!result.ok) {
      throw new Error(
        `golden mismatch (${result.diffRatio}): ${result.reason}. UPDATE_GOLDENS=1 to refresh.`,
      );
    }
    expect(result.ok).toBe(true);
  });
});
