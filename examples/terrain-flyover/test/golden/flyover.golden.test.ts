/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { generateHeightmapPng } from '@bendyline/molen-terrain/kernel';
import { compareGolden, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';
import { FLYOVER_CAMERA, HEIGHTMAP_SEED, HEIGHTMAP_SIZE } from '../../src/flyover';
import terrainDoc from '../../terrain.json';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');
const GOLDENS = join(DIR, '__goldens__');

describe('golden: terrain flyover', () => {
  it('renders the island terrain matching the golden', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'flyover.png');
    const golden = join(GOLDENS, 'flyover.png');
    const diff = join(OUT, 'flyover.diff.png');

    const png = generateHeightmapPng({
      size: HEIGHTMAP_SIZE,
      seed: HEIGHTMAP_SEED,
      octaves: 6,
      island: true,
    });

    const r = await screenshotScene({
      scene: { format: 'molen/scene@3', name: 'flyover', seed: 's', tickRate: 30 },
      ticks: 1,
      size: [512, 288],
      camera: FLYOVER_CAMERA,
      terrain: { descriptor: terrainDoc, heightmapPng: png },
      outPath: candidate,
    });
    expect(r.ok, r.error).toBe(true);
    // 16 chunks meshed; camera-distance LOD reduces the far chunks' density.
    expect(r.renderStats?.triangles ?? 0).toBeGreaterThan(50000);

    const g = await compareGolden(candidate, golden, diff, { maxDiffRatio: 0.005 });
    expect(
      g.ok,
      `flyover golden diff ${g.diffRatio} (UPDATE_GOLDENS=1 to refresh)${g.reason === undefined ? '' : ` — ${g.reason}`}`,
    ).toBe(true);
  });
});
