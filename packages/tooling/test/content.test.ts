import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildContentPack, runSimulation } from '../src/ops/index';
import { loadProject } from '../src/project';

const ENTITIES = resolve(__dirname, '../../../content/entities');

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-content-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const scene = {
  format: 'molen/scene@3',
  name: 'parked',
  seed: 'content',
  tickRate: 30,
  entities: [
    {
      id: 'car',
      type: 'molen.entities.vehicle.sedan',
      components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } },
    },
  ],
};

async function project(name: string, packs: unknown[]): Promise<string> {
  const projectDir = join(dir, name);
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, 'main.scene.json'), JSON.stringify(scene));
  await writeFile(
    join(projectDir, 'project.json'),
    JSON.stringify({
      format: 'molen/project@1',
      name,
      scenes: { main: 'main.scene.json' },
      packs,
    }),
  );
  return projectDir;
}

describe('project content packs', () => {
  it('adds pack types to the project and records where they came from', async () => {
    const projectDir = await project('local', [
      { id: 'molen.entities', source: relative(join(dir, 'local'), ENTITIES) },
    ]);
    const ctx = await loadProject(join(projectDir, 'project.json'));
    expect(ctx.resolvedTypes.has('molen.entities.vehicle.sedan')).toBe(true);
    expect(ctx.typeIssues).toEqual([]);
    expect(ctx.content.types?.packs).toEqual(['molen.entities@0.0.1']);

    const run = await runSimulation({ scenePath: join(projectDir, 'main.scene.json'), ticks: 5 });
    expect(run.error).toBeUndefined();
    expect(run.ok).toBe(true);
    expect(run.content).toEqual(ctx.content);
  });

  it('downloads a pinned pack once, then works from the cache and offline', async () => {
    const out = join(dir, 'served');
    const built = await buildContentPack({ sourceDir: ENTITIES, outDir: out });
    let requests = 0;
    const server: Server = createServer(async (request, response) => {
      requests++;
      try {
        response.writeHead(200).end(await readFile(join(out, (request.url ?? '/').slice(1))));
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/${built.file}`;
    const cache = join(dir, 'cache');
    process.env.MOLEN_CACHE_DIR = cache;
    try {
      const projectDir = await project('remote', [
        { id: 'molen.entities', source: url, contentHash: built.contentHash },
      ]);
      const first = await loadProject(join(projectDir, 'project.json'));
      expect(first.resolvedTypes.has('molen.entities.aircraft.p51d')).toBe(true);
      expect(requests).toBe(1);
      await loadProject(join(projectDir, 'project.json'));
      expect(requests).toBe(1);

      process.env.MOLEN_CACHE_DIR = join(dir, 'empty-cache');
      process.env.MOLEN_OFFLINE = '1';
      await expect(loadProject(join(projectDir, 'project.json'))).rejects.toThrow(
        /not in the cache .* MOLEN_OFFLINE is set/,
      );
    } finally {
      delete process.env.MOLEN_CACHE_DIR;
      delete process.env.MOLEN_OFFLINE;
      await new Promise((done) => server.close(done));
    }
  });

  it('refuses a pack whose content does not match its pin', async () => {
    const projectDir = await project('mismatch', [
      {
        id: 'molen.entities',
        source: relative(join(dir, 'mismatch'), ENTITIES),
        contentHash: `sha256:${'0'.repeat(64)}`,
      },
    ]);
    await expect(loadProject(join(projectDir, 'project.json'))).rejects.toThrow(
      /expected sha256:0+/,
    );
  });
});
