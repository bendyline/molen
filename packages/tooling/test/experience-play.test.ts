import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseExperiencePlayScenario,
  playExperience,
  startExperienceServer,
  startPlayResources,
} from '../src/ops/experience-play';

const launchCalls: string[] = [];

// playExperience imports playwright lazily; the mock lets the leak be observed without Chromium.
vi.mock('playwright', () => ({
  chromium: {
    launch: async () => {
      launchCalls.push('launch');
      return {
        close: async () => {},
        newPage: async () => ({ on: () => {}, goto: async () => {} }),
      };
    },
  },
}));

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('experience play harness', () => {
  it('validates declarative browser actions and unique frame names', () => {
    const scenario = parseExperiencePlayScenario({
      format: 'molen/experience-play@1',
      name: 'sample traversal',
      viewport: [800, 450],
      probes: [{ name: 'status', selector: '#status' }],
      actions: [
        { type: 'wait-for-stable', selector: '#status', text: 'ready' },
        { type: 'keys', keys: ['w', 'Shift'], durationMs: 500 },
        { type: 'key-down', keys: ['w'] },
        { type: 'key-up', keys: ['w'] },
        { type: 'drag', selector: 'canvas', from: [0.5, 0.5], to: [0.75, 0.5] },
        { type: 'screenshot', name: 'after-move' },
      ],
    });
    expect(scenario.actions).toHaveLength(6);
    expect(() =>
      parseExperiencePlayScenario({
        format: 'molen/experience-play@1',
        name: 'duplicate',
        actions: [
          { type: 'screenshot', name: 'same' },
          { type: 'screenshot', name: 'same' },
        ],
      }),
    ).toThrow(/duplicate screenshot/);
  });

  it('hosts static apps with byte ranges for streamable archives', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'molen-play-test-'));
    temporaryDirectories.push(directory);
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'index.html'), '<h1>sample</h1>');
    await writeFile(join(directory, 'assets', 'world.pmtiles'), Buffer.from('0123456789'));
    const server = await startExperienceServer(directory);
    try {
      const response = await fetch(`${server.url}/assets/world.pmtiles`, {
        headers: { Range: 'bytes=2-5' },
      });
      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe('bytes 2-5/10');
      expect(await response.text()).toBe('2345');
      expect(await (await fetch(`${server.url}/deep/link`)).text()).toContain('sample');
      expect((await fetch(`${server.url}/assets/missing.pmtiles`)).status).toBe(404);
    } finally {
      await server.close();
    }
  });
  // A missing app dir must fail BEFORE Chromium starts: `Promise.all` used to reject on the
  // server's ENOENT while the launch was still pending, orphaning a live browser process.
  it('rejects a missing app directory without launching a browser', async () => {
    launchCalls.length = 0;
    const outDir = await mkdtemp(join(tmpdir(), 'molen-play-out-'));
    temporaryDirectories.push(outDir);
    const result = await playExperience({
      appDir: join(outDir, 'does-not-exist'),
      outDir,
      scenario: {
        format: 'molen/experience-play@1',
        name: 'missing app',
        actions: [{ type: 'screenshot', name: 'start' }],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/app directory not found/);
    expect(launchCalls).toEqual([]);
  });

  it('closes an orphaned browser when the server fails to start', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'molen-play-orphan-'));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, 'index.html'), '<h1>sample</h1>');
    let closed = false;
    await expect(
      startPlayResources(
        directory,
        async () => ({
          close: async () => {
            closed = true;
          },
        }),
        async () => {
          throw new Error('server failed');
        },
      ),
    ).rejects.toThrow(/server failed/);
    expect(closed).toBe(true);
  });

  it('never launches a browser for a path that is a file, not a directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'molen-play-file-'));
    temporaryDirectories.push(directory);
    const file = join(directory, 'index.html');
    await writeFile(file, '<h1>sample</h1>');
    let launched = false;
    await expect(
      startPlayResources(file, async () => {
        launched = true;
        return { close: async () => {} };
      }),
    ).rejects.toThrow(/not a directory/);
    expect(launched).toBe(false);
  });
});
