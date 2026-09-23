import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { typescriptNotFoundError } from '../src/ops/check-scripts';
import { runReplayFile, scaffoldExperience, validateAsset } from '../src/ops/index';

const exec = promisify(execFile);

describe('review F06/F09/F10: external project tooling', () => {
  it('replays with the project default setup and validates the final type merge', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-review-project-'));
    const created = await scaffoldExperience({ name: 'demo', dir: parent });
    expect(created.ok).toBe(true);
    if (created.dir === undefined)
      throw new Error(created.error ?? 'scaffold produced no directory');
    const dir = created.dir;
    const commands = JSON.parse(await readFile(join(dir, 'cmds.json'), 'utf8'));
    const path = join(dir, 'demo.replay.json');
    await writeFile(
      path,
      JSON.stringify({
        format: 'molen/replay@1',
        engine: '0.0.1',
        scene: 'scenes/main.scene.json',
        commands,
        ticks: 30,
      }),
    );
    const recorded = await runReplayFile({
      path,
      setupModule: join(dir, 'setup.mjs'),
      record: true,
    });
    expect(recorded.ok, recorded.error).toBe(true);
    const replay = await runReplayFile({ path });
    expect(replay.ok, replay.error ?? replay.report).toBe(true);
    const scenePath = join(dir, 'scenes/main.scene.json');
    const scene = JSON.parse(await readFile(scenePath, 'utf8'));
    scene.entities[0].components = { transform: { pos: 'bad' } };
    await writeFile(scenePath, JSON.stringify(scene));
    const validation = await validateAsset({ path: scenePath });
    expect(validation.ok).toBe(false);
    expect(validation.formatted).toContain('/transform/pos');
  });
  it('finds shipped documentation from a copied distribution outside the checkout', async () => {
    // realpath: on macOS tmpdir() is under the /var -> /private/var symlink, and Node resolves
    // symlinks when loading the copied dist, so locateDocsRoot reports the canonical path.
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'molen-review-installed-')));
    const dist = join(dir, 'installed', 'dist');
    await cp(resolve('dist'), dist, { recursive: true });
    await symlink(
      resolve('node_modules'),
      join(dir, 'installed', 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const code = `const { searchDocs } = await import(${JSON.stringify(pathToFileURL(join(dist, 'index.mjs')).href)}); console.log(JSON.stringify(await searchDocs({query: 'onCommand'})));`;
    const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', code], {
      cwd: dir,
    });
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.root).toBe(dist);
    expect(result.hits.length).toBeGreaterThan(0);
  });
});
// `molen scripts check` compiles with the project's own TypeScript. Installed from npm nothing
// provides it until the scaffold's install runs, so the install must be declared (optional peer)
// and must come first in everything the scaffold prints.
describe('scripts check needs the project install first', () => {
  it('declares typescript as an optional peer dependency (and keeps the devDependency)', async () => {
    const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
    expect(pkg.peerDependencies?.typescript).toBeDefined();
    expect(pkg.peerDependenciesMeta?.typescript?.optional).toBe(true);
    expect(pkg.devDependencies?.typescript).toBeDefined();
    expect(pkg.dependencies?.typescript).toBeUndefined();
  });

  it('names the directory to install into when typescript cannot be resolved', () => {
    const message = typescriptNotFoundError('/tmp/my-project');
    expect(message).toContain('/tmp/my-project');
    expect(message).toMatch(/npm install/);
  });

  it('scaffold prints (and writes) the install before any command that needs TypeScript', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-review-install-order-'));
    const created = await scaffoldExperience({ name: 'demo', dir: parent });
    expect(created.ok, created.error).toBe(true);
    const steps = created.nextSteps ?? [];
    const install = steps.findIndex((step) => /\b(npm|pnpm) install\b/.test(step));
    const check = steps.findIndex((step) => step.includes('molen scripts check'));
    expect(install).toBeGreaterThanOrEqual(0);
    expect(check).toBeGreaterThanOrEqual(0);
    expect(install).toBeLessThan(check);

    // Compare COMMAND lines, not prose: the install section names the command it enables.
    const lines = (await readFile(join(created.dir as string, 'README.md'), 'utf8')).split('\n');
    const readmeInstall = lines.findIndex((line) => /^(npm|pnpm) install\b/.test(line));
    const readmeCheck = lines.findIndex((line) => /^molen scripts check\b/.test(line));
    expect(readmeInstall).toBeGreaterThanOrEqual(0);
    expect(readmeCheck).toBeGreaterThanOrEqual(0);
    expect(readmeInstall).toBeLessThan(readmeCheck);
  });
});
