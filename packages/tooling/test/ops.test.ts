import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineComponent } from '@bendyline/molen-kernel';
import type { SceneManifest } from '@bendyline/molen-schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  exportFrames,
  runSimulation,
  scaffoldExperience,
  screenshotScene,
  validateAsset,
} from '../src/ops/index';

const Counter = defineComponent<{ n: number }>('counter');

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-tooling-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const scene: SceneManifest = {
  format: 'molen/scene@3',
  name: 'tooling-demo',
  seed: 'tool-1',
  tickRate: 30,
  lateCommands: 'rewrite',
  keyframeInterval: 60,
  prefabs: { c: { components: { counter: { n: 0 } } } },
  entities: [
    { id: 'a', prefab: 'c' },
    { id: 'b', prefab: 'c' },
  ],
  scripts: [],
  commands: {},
  components: {},
};

// systems + command handlers for the demo scene
const setup = (world: import('@bendyline/molen-kernel').World): void => {
  world.addSystem(
    (w) => {
      for (const [id, c] of w.query(Counter)) w.patch(id, Counter, { n: c.n + 1 });
    },
    { name: 'tick-up' },
  );
};

describe('validateAsset', () => {
  it('accepts a valid scene file (kind auto-detected)', async () => {
    const p = join(dir, 'scene.json');
    await writeFile(p, JSON.stringify(scene));
    const r = await validateAsset({ path: p });
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('scene');
  });

  it('rejects an invalid document with a formatted block', async () => {
    const p = join(dir, 'bad.json');
    await writeFile(p, JSON.stringify({ format: 'molen/scene@3', name: 'x', tickRate: 'fast' }));
    const r = await validateAsset({ path: p });
    expect(r.ok).toBe(false);
    expect(r.formatted).toContain('/tickRate');
  });

  it('reports undetectable kind', async () => {
    const p = join(dir, 'mystery.json');
    await writeFile(p, JSON.stringify({ hello: 'world' }));
    const r = await validateAsset({ path: p });
    expect(r.ok).toBe(false);
    expect(r.formatted).toContain('could not detect schema kind');
  });

  it('reports non-JSON files', async () => {
    const p = join(dir, 'notjson.json');
    await writeFile(p, 'this is not json');
    const r = await validateAsset({ path: p });
    expect(r.ok).toBe(false);
    expect(r.formatted).toContain('not valid JSON');
  });

  it('stream-verifies terrain package file sizes and hashes', async () => {
    const payload = new TextEncoder().encode('dem');
    const archivePath = join(dir, 'elevation.pmtiles');
    const manifestPath = join(dir, 'terrain-package.json');
    await writeFile(archivePath, payload);
    await writeFile(
      manifestPath,
      JSON.stringify({
        format: 'molen/terrain-package@1',
        name: 'fixture',
        version: '1',
        coordinateSpace: { kind: 'local', units: 'meters', bounds: [0, 0, 1, 1] },
        tileMatrix: { maxLevel: 0 },
        elevation: {
          source: { kind: 'pmtiles', path: 'elevation.pmtiles' },
          encoding: 'png16',
          height: { min: 0, max: 1 },
        },
        attribution: [{ text: 'Fixture', license: 'CC0-1.0' }],
        provenance: {
          compiler: 'test',
          compilerVersion: '1',
          sources: [{ id: 'fixture', release: '1' }],
        },
        files: [
          {
            path: 'elevation.pmtiles',
            sha256: createHash('sha256').update(payload).digest('hex'),
            bytes: payload.byteLength,
          },
        ],
      }),
    );

    const valid = await validateAsset({ path: manifestPath, verifyFiles: true });
    expect(valid.ok).toBe(true);
    expect(valid.verifiedFiles).toBe(1);

    await writeFile(archivePath, 'bad');
    const corrupt = await validateAsset({ path: manifestPath, verifyFiles: true });
    expect(corrupt.ok).toBe(false);
    expect(corrupt.formatted).toContain('SHA-256');
  });
});

describe('runSimulation', () => {
  it('runs a scene for N ticks and reports a stable hash', async () => {
    const a = await runSimulation({ scene, ticks: 300, setup });
    const b = await runSimulation({ scene, ticks: 300, setup });
    expect(a.tick).toBe(300);
    expect(a.stateHash).toBe(b.stateHash);
    expect(a.stateHash).toMatch(/^sha256:/);
  });

  it('evaluates assertions with pass and fail cases', async () => {
    const r = await runSimulation({
      scene,
      ticks: 10,
      setup,
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [
          { select: 'has:counter', op: 'count', value: 2 }, // pass
          { select: '#a .counter.n', op: 'eq', value: 10 }, // pass (10 ticks)
          { select: '#a .counter.n', op: 'eq', value: 999 }, // fail
        ],
      },
    });
    expect(r.assertionResults).toHaveLength(3);
    expect(r.assertionResults[0]?.pass).toBe(true);
    expect(r.assertionResults[1]?.pass).toBe(true);
    expect(r.assertionResults[2]?.pass).toBe(false);
    expect(r.ok).toBe(false); // overall fails because one assertion failed
    expect(r.assertionsFormatted).toContain('2/3 assertions passed');
  });

  it('applies a command stream at the recorded tick', async () => {
    const r = await runSimulation({
      scene,
      ticks: 10,
      setup: (world) => {
        setup(world);
        world.registerCommand('reset', (w, cmd) => {
          const id = (cmd.payload as { id: string }).id;
          w.set(id, Counter, { n: 0 });
        });
      },
      commands: [
        {
          kind: 'command',
          seq: 0,
          source: 'local',
          tick: 5,
          tickExecuted: 5,
          type: 'reset',
          payload: { id: 'a' },
        },
      ],
      assertDoc: {
        format: 'molen/assert@1',
        // a was reset at tick 5, so after 10 ticks it counted ticks 6..10 = 5
        assertions: [{ select: '#a .counter.n', op: 'eq', value: 5 }],
      },
    });
    expect(r.ok).toBe(true);
  });

  it('surfaces a scene validation error', async () => {
    const r = await runSimulation({
      scene: { ...scene, tickRate: 0 } as unknown as SceneManifest,
      ticks: 1,
    });
    expect(r.error).toBeDefined();
  });
});

describe('ops never throw: failures come back as { ok: false }', () => {
  it('validateAsset on a missing path', async () => {
    const r = await validateAsset({ path: join(dir, 'does-not-exist.json') });
    expect(r.ok).toBe(false);
    expect(r.formatted).toMatch(/cannot read file/);
  });

  it('runSimulation with a missing setup module and with a missing commands file', async () => {
    const noModule = await runSimulation({
      scene,
      ticks: 1,
      setupModule: join(dir, 'nope.mjs'),
    });
    expect(noModule.ok).toBe(false);
    expect(noModule.error).toBeDefined();
    const noCommands = await runSimulation({
      scene,
      ticks: 1,
      commandsPath: join(dir, 'missing-cmds.json'),
    });
    expect(noCommands.ok).toBe(false);
    expect(noCommands.error).toMatch(/missing-cmds/);
  });

  it('screenshotScene and exportFrames with a missing setup module / track file', async () => {
    const shot = await screenshotScene({
      scene,
      ticks: 1,
      setupModule: join(dir, 'nope.mjs'),
      outPath: join(dir, 'never.png'),
    });
    expect(shot.ok).toBe(false);
    expect(shot.error).toMatch(/nope\.mjs/);
    const frames = await exportFrames({
      scene,
      from: 0,
      to: 1,
      trackPath: join(dir, 'missing-track.json'),
      outDir: join(dir, 'frames'),
    });
    expect(frames.ok).toBe(false);
    expect(frames.error).toMatch(/missing-track/);
  });

  it('runSimulation picks up the project manifest setup module without --setup', async () => {
    const projDir = join(dir, 'proj-setup');
    await mkdir(projDir, { recursive: true });
    await writeFile(
      join(projDir, 'project.json'),
      JSON.stringify({
        format: 'molen/project@1',
        name: 'proj-setup',
        scenes: { main: 'scene.json' },
        setup: 'setup.mjs',
      }),
    );
    await writeFile(
      join(projDir, 'scene.json'),
      JSON.stringify({
        format: 'molen/scene@3',
        name: 'main',
        entities: [{ id: 'c', components: { counter: { n: 0 } } }],
      }),
    );
    await writeFile(
      join(projDir, 'setup.mjs'),
      `export function setup(world) {
        world.registerCommand('bump', (w) => {
          w.set('c', { name: 'counter' }, { n: 7 });
        });
      }
      export default setup;`,
    );
    const r = await runSimulation({
      scenePath: 'main',
      projectPath: join(projDir, 'project.json'),
      ticks: 3,
      commands: [
        { kind: 'command', seq: 0, source: 'local', tick: 1, type: 'bump', payload: null },
      ],
      assertDoc: {
        format: 'molen/assert@1',
        assertions: [{ select: '#c .counter.n', op: 'eq', value: 7 }],
      },
    });
    expect(r.error).toBeUndefined();
    expect(r.ok, r.assertionsFormatted).toBe(true);
  });
});

describe('validateAsset with a project context', () => {
  it('reports a typo in a registry type reference with a pointer and did-you-mean', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-validate-project-'));
    const s = await scaffoldExperience({ name: 'typo', dir: parent });
    expect(s.ok).toBe(true);
    const projectDir = s.dir as string;
    const scenePath = join(projectDir, 'scenes', 'typo.scene.json');
    await writeFile(
      scenePath,
      JSON.stringify({
        format: 'molen/scene@3',
        name: 'typo',
        entities: [{ id: 'hero', type: 'typo.cub' }],
      }),
    );
    const r = await validateAsset({ path: scenePath });
    expect(r.ok).toBe(false);
    expect(r.formatted).toContain('/entities/0/type');
    expect(r.formatted).toContain('did you mean "typo.cube"?');
    // The scene loader (sim run) reports the same formatted issue instead of a kernel throw.
    const sim = await runSimulation({ scenePath, ticks: 1 });
    expect(sim.ok).toBe(false);
    expect(sim.error).toContain('unknown registry type "typo.cub"');
    // A correct reference validates clean.
    await writeFile(
      scenePath,
      JSON.stringify({
        format: 'molen/scene@3',
        name: 'typo',
        entities: [{ id: 'hero', type: 'typo.cube' }],
      }),
    );
    expect((await validateAsset({ path: scenePath })).ok).toBe(true);
  });
});
