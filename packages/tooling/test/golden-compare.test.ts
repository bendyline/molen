import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareGolden, diffImages } from '../src/golden';

// The golden comparison is the thing every image test's verdict rests on, so its own edge cases
// are worth pinning: a missing reference must fail rather than quietly become the reference.

let dir: string;
const previousUpdate = process.env.UPDATE_GOLDENS;

function png(width: number, height: number, rgb: [number, number, number]): Buffer {
  const image = new PNG({ width, height });
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = rgb[0];
    image.data[i + 1] = rgb[1];
    image.data[i + 2] = rgb[2];
    image.data[i + 3] = 255;
  }
  return PNG.sync.write(image);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-golden-'));
  process.env.UPDATE_GOLDENS = '0';
});

afterEach(async () => {
  if (previousUpdate === undefined) delete process.env.UPDATE_GOLDENS;
  else process.env.UPDATE_GOLDENS = previousUpdate;
  await rm(dir, { recursive: true, force: true });
});

describe('compareGolden', () => {
  it('fails when no golden is committed instead of adopting the candidate', async () => {
    const candidate = join(dir, 'candidate.png');
    const golden = join(dir, 'missing.png');
    await writeFile(candidate, png(8, 8, [10, 20, 30]));

    const result = await compareGolden(candidate, golden, join(dir, 'diff.png'));

    expect(result.ok).toBe(false);
    expect(result.created).toBe(false);
    expect(result.reason).toMatch(/no committed golden/);
    expect(result.reason).toMatch(/UPDATE_GOLDENS=1/);
    // Crucially, the candidate must NOT have been installed as the reference: a rerun has to
    // fail identically rather than pass because the first run wrote the file.
    await expect(readFile(golden)).rejects.toThrow();
    expect((await compareGolden(candidate, golden, join(dir, 'diff.png'))).ok).toBe(false);
  });

  it('records the golden only when UPDATE_GOLDENS=1', async () => {
    const candidate = join(dir, 'candidate.png');
    const golden = join(dir, 'recorded.png');
    await writeFile(candidate, png(8, 8, [10, 20, 30]));
    process.env.UPDATE_GOLDENS = '1';

    const recorded = await compareGolden(candidate, golden, join(dir, 'diff.png'));

    expect(recorded).toMatchObject({ ok: true, created: true });
    expect(await readFile(golden)).toEqual(await readFile(candidate));

    // And with it recorded, an ordinary run compares rather than re-records.
    process.env.UPDATE_GOLDENS = '0';
    expect(await compareGolden(candidate, golden, join(dir, 'diff.png'))).toMatchObject({
      ok: true,
      created: false,
      diffRatio: 0,
    });
  });

  it('reports a size mismatch rather than diffing mismatched buffers', async () => {
    const candidate = join(dir, 'candidate.png');
    const golden = join(dir, 'golden.png');
    await writeFile(candidate, png(8, 8, [10, 20, 30]));
    await writeFile(golden, png(16, 16, [10, 20, 30]));

    const result = await compareGolden(candidate, golden, join(dir, 'diff.png'));

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/size mismatch: 16x16 vs 8x8/);
  });

  it('fails a candidate that differs beyond the tolerance and passes one inside it', async () => {
    const golden = join(dir, 'golden.png');
    const far = join(dir, 'far.png');
    await writeFile(golden, png(20, 20, [0, 0, 0]));
    await writeFile(far, png(20, 20, [255, 255, 255]));

    const result = await compareGolden(far, golden, join(dir, 'diff.png'), { maxDiffRatio: 0.01 });
    expect(result.ok).toBe(false);
    expect(result.diffRatio).toBe(1);

    // The same pair passes once the tolerance admits every pixel — the knob is honoured, so a
    // test that sets one loose enough is making a visible choice, not inheriting a default.
    const lenient = await compareGolden(far, golden, join(dir, 'diff.png'), { maxDiffRatio: 1 });
    expect(lenient.ok).toBe(true);
  });
});

describe('diffImages', () => {
  it('compares two candidates without treating either as a reference', async () => {
    const a = join(dir, 'a.png');
    const b = join(dir, 'b.png');
    await writeFile(a, png(10, 10, [0, 0, 0]));
    await writeFile(b, png(10, 10, [0, 0, 0]));

    expect(await diffImages(a, b, join(dir, 'diff.png'))).toMatchObject({
      match: true,
      diffPixels: 0,
    });
  });
});
