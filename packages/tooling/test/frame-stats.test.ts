import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { frameStats } from '../src/frame-stats';

let dir: string;

/** A `size` square of `background` with a red square covering its top-left quarter. */
async function frame(size: number, background: [number, number, number]): Promise<string> {
  const image = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inSquare = x < size / 2 && y < size / 2;
      image.data[i] = inSquare ? 220 : background[0];
      image.data[i + 1] = inSquare ? 30 : background[1];
      image.data[i + 2] = inSquare ? 30 : background[2];
      image.data[i + 3] = 255;
    }
  }
  const path = join(dir, `frame-${size}.png`);
  await writeFile(path, PNG.sync.write(image));
  return path;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-frame-stats-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('frameStats', () => {
  it('measures content against the most common color, for the frame or a region', async () => {
    const path = await frame(20, [40, 90, 200]);
    const whole = await frameStats(path);
    expect(whole.width).toBe(20);
    expect(whole.coverage).toBeCloseTo(0.25);
    expect(whole.colors).toBe(2);
    for (const [channel, expected] of whole.background.map((c, i) => [c, [40, 90, 200][i]]))
      expect(Math.abs((channel ?? 0) - (expected ?? 0))).toBeLessThanOrEqual(4);
    const square = await frameStats(path, { region: { x: 0, y: 0, width: 0.5, height: 0.5 } });
    expect(square.coverage).toBe(1);
    expect(square.mean).toEqual([220, 30, 30]);
    const rest = await frameStats(path, { region: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 } });
    expect(rest.coverage).toBe(0);
    expect(rest.luminance).toBeCloseTo((40 + 90 + 200) / 3);
  });

  it('reads the same at any resolution', async () => {
    const small = await frameStats(await frame(20, [10, 10, 10]));
    const large = await frameStats(await frame(64, [10, 10, 10]));
    expect(large.coverage).toBeCloseTo(small.coverage);
    expect(large.mean.map(Math.round)).toEqual(small.mean.map(Math.round));
  });
});
