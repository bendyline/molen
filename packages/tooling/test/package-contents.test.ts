import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const gate = await import(resolve(__dirname, '../../../scripts/check-package-contents.mjs'));
const root = resolve(__dirname, '../../..');
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('package content gate', () => {
  it('passes the workspace as it stands', () => {
    expect(gate.checkWorkspace()).toEqual([]);
  });

  it('rejects content files, content directories and data-sized chunks', () => {
    expect(gate.checkPackedFile('dist/index.mjs', 40_000)).toEqual([]);
    expect(gate.checkPackedFile('dist/p51d/model.glb', 1000)[0]).toMatch(/content file \(\.glb\)/);
    expect(gate.checkPackedFile('assets/tree/asset.json', 100)[0]).toMatch(/content directory/);
    expect(gate.checkPackedFile('dist/index.mjs', 440_000)[0]).toMatch(/430 KB of JavaScript/);
    expect(gate.checkFilesField(['dist', 'packs/*'])).toEqual([
      '"files" publishes packs/*; content ships in content packs',
    ]);
  });

  it('rejects source that bundles repository content or names a content host', () => {
    const dir = join(root, 'packages/example');
    const file = join(dir, 'src/index.ts');
    const reach = gate.checkSourceFile(
      file,
      dir,
      "import types from '../../../content/entities/types/vehicle.types.json' with { type: 'json' };",
    );
    expect(reach[0]).toMatch(/outside the package; load it as content/);
    const host = gate.checkSourceFile(file, dir, "fetch('https://molen.dev/packs/sky.zip');");
    expect(host[0]).toMatch(/src\/index.ts:1: names molen.dev/);
    // Documentation links are not a content host.
    expect(gate.checkSourceFile(file, dir, "'See https://molen.dev/guide/scripting'")).toEqual([]);
    // Small JSON inside the package is fine (the `molen new` template prints such an import).
    const template = "const T = `import scene from '../scenes/main.scene.json';`;";
    expect(gate.checkSourceFile(file, dir, template)).toEqual([]);
  });

  it('reads a real tarball and names a planted model', () => {
    const dir = mkdtempSync(join(tmpdir(), 'molen-contents-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'package/dist'), { recursive: true });
    writeFileSync(join(dir, 'package/package.json'), '{}');
    writeFileSync(join(dir, 'package/dist/index.mjs'), 'export {};\n');
    writeFileSync(join(dir, 'package/dist/model.glb'), Buffer.alloc(700));
    const archive = join(dir, 'example.tgz');
    // COPYFILE_DISABLE keeps macOS tar from adding AppleDouble `._*` twins.
    execFileSync('tar', ['-czf', archive, '-C', dir, 'package'], {
      env: { ...process.env, COPYFILE_DISABLE: '1' },
    });
    const entries = gate.tarballEntries(archive);
    expect(entries).toContainEqual({ path: 'package/dist/model.glb', size: 700 });
    expect(gate.checkTarballEntries('@example/x', entries, join(root, 'packages/x'))).toEqual([
      '@example/x: dist/model.glb: a content file (.glb); content ships in content packs',
    ]);
  });
});
