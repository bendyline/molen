/// <reference types="node" />
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { generateHeightmapPng } from '@bendyline/molen-terrain/kernel';
import { frameStats, screenshotScene } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';
import { FLYOVER_CAMERA, HEIGHTMAP_SEED, HEIGHTMAP_SIZE } from '../../src/flyover';
import terrainDoc from '../../terrain.json';

const DIR = join(process.cwd(), 'test', 'golden');
const OUT = join(DIR, '__output__');

describe('golden: terrain flyover', () => {
  it('renders the island terrain under open sky', async () => {
    await mkdir(OUT, { recursive: true });
    const candidate = join(OUT, 'flyover.png');

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

    // The sky is the frame's backdrop and fills the top; the island's green slopes fill the lower
    // middle.
    const sky = await frameStats(candidate, { region: { x: 0, y: 0, width: 1, height: 0.2 } });
    expect(sky.coverage).toBeLessThan(0.1);
    const island = await frameStats(candidate, {
      region: { x: 0.3, y: 0.55, width: 0.4, height: 0.3 },
    });
    expect(island.coverage).toBeGreaterThan(0.9);
    expect(island.mean[1]).toBeGreaterThan(island.mean[0]);
    expect(island.mean[1]).toBeGreaterThan(island.mean[2]);
    // Lit relief rather than one flat shade.
    expect(island.colors).toBeGreaterThanOrEqual(4);
  });
});
