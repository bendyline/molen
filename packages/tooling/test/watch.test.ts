import { mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverSimulationWatchPaths, simWatch } from '../src/ops/watch';

const scene = {
  format: 'molen/scene@3',
  name: 'watch',
  scripts: [{ id: 'logic', path: 'scripts/logic.js' }],
};

describe('simulation watch dependencies and lifecycle', () => {
  it('discovers project, type, asset, script, terrain, and missing inputs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'molen-watch-deps-'));
    await mkdir(join(dir, 'scenes'), { recursive: true });
    await mkdir(join(dir, 'assets', 'crate'), { recursive: true });
    await writeFile(
      join(dir, 'project.json'),
      JSON.stringify({
        format: 'molen/project@1',
        scenes: { main: 'scenes/main.json' },
        types: ['types/missing.json'],
        assets: { crate: 'assets/crate/asset.json' },
      }),
    );
    await writeFile(
      join(dir, 'scenes', 'main.json'),
      JSON.stringify({
        ...scene,
        terrain: { descriptor: 'terrain.json', heightmap: 'height.png' },
      }),
    );
    await writeFile(
      join(dir, 'assets', 'crate', 'asset.json'),
      JSON.stringify({
        files: { main: 'model.glb', variants: { low: 'low.glb' } },
        collision: { trimesh: { bin: 'collision.bin' } },
      }),
    );
    const paths = await discoverSimulationWatchPaths({
      scenePath: 'main',
      projectPath: join(dir, 'project.json'),
      commandsPath: join(dir, 'missing-commands.json'),
      ticks: 1,
    });
    for (const expected of [
      'project.json',
      'types/missing.json',
      'scenes/main.json',
      'scenes/scripts/logic.js',
      'scenes/terrain.json',
      'scenes/height.png',
      'assets/crate/asset.json',
      'assets/crate/model.glb',
      'assets/crate/low.glb',
      'assets/crate/collision.bin',
      'missing-commands.json',
    ]) {
      expect(paths.has(join(dir, expected)), expected).toBe(true);
    }
  });

  it('survives atomic scene replacement and stops callbacks after close', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'molen-watch-rename-'));
    await mkdir(join(dir, 'scripts'), { recursive: true });
    const scenePath = join(dir, 'scene.json');
    await writeFile(scenePath, JSON.stringify(scene));
    await writeFile(join(dir, 'scripts', 'logic.js'), `molen.on('tick', () => {});`);
    let runs = 0;
    let resolveSecond: (() => void) | undefined;
    const second = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });
    const handle = await simWatch({
      scenePath,
      ticks: 1,
      onRun: () => {
        runs++;
        if (runs === 2) resolveSecond?.();
      },
    });
    const replacement = join(dir, 'replacement.json');
    await writeFile(replacement, JSON.stringify({ ...scene, seed: 2 }));
    await rename(replacement, scenePath);
    await Promise.race([
      second,
      new Promise((_, reject) => setTimeout(() => reject(new Error('watch timed out')), 2_000)),
    ]);
    handle.close();
    const atClose = runs;
    await writeFile(scenePath, JSON.stringify({ ...scene, seed: 3 }));
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(runs).toBe(atClose);
  });
});
