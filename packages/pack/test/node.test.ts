import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createPack } from '../src/build';
import {
  buildPack,
  extractPack,
  openDirPack,
  openFilePack,
  openPackAt,
  readPackSource,
} from '../src/node';
import { openPack } from '../src/pack';
import { sampleFiles } from './helpers';

const temps: string[] = [];
async function temp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'molen-pack-'));
  temps.push(dir);
  return dir;
}
afterEach(async () => {
  for (const dir of temps.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function writeSource(dir: string, config: Record<string, unknown> = {}): Promise<void> {
  for (const file of sampleFiles()) {
    await mkdir(dirname(join(dir, file.path)), { recursive: true });
    await writeFile(join(dir, file.path), file.bytes);
  }
  await writeFile(join(dir, '.DS_Store'), 'ignored');
  await writeFile(join(dir, 'models/roadster/source.psd'), 'layered source');
  await writeFile(
    join(dir, 'molen-pack.source.json'),
    JSON.stringify({
      format: 'molen/pack-source@1',
      id: 'example.vehicles',
      version: '1.0.0',
      license: 'CC0-1.0',
      notice: 'NOTICE.md',
      exclude: ['**/*.psd'],
      provides: { types: ['types/aircraft.types.json', 'types/vehicles.types.json'] },
      ...config,
    }),
  );
}

describe('node helpers', () => {
  it('reads a source directory, skipping dotfiles, excluded globs and its own config', async () => {
    const dir = await temp();
    await writeSource(dir);
    const source = await readPackSource(dir);
    expect(source.files.map((f) => f.path)).toEqual(
      sampleFiles()
        .map((f) => f.path)
        .sort(),
    );
  });

  it('builds a hashed file, records it in index.json, and rebuilds identically', async () => {
    const dir = await temp();
    const out = await temp();
    await writeSource(dir);
    const first = await buildPack(dir, { outDir: out });
    expect(first.file).toMatch(/^example\.vehicles-[0-9a-f]{12}\.zip$/);
    const index = JSON.parse(await readFile(first.indexPath, 'utf8'));
    expect(index).toEqual({
      format: 'molen/pack-index@1',
      packs: {
        'example.vehicles': {
          version: '1.0.0',
          file: first.file,
          contentHash: first.manifest.contentHash,
          size: first.size,
        },
      },
    });
    const again = await buildPack(dir, { outDir: out });
    expect(again.file).toBe(first.file);
    expect(await readdir(out)).toEqual([first.file, 'index.json'].sort());

    // A content change gives a new file and removes the previous build.
    await writeFile(join(dir, 'NOTICE.md'), 'changed');
    const changed = await buildPack(dir, { outDir: out });
    expect(changed.file).not.toBe(first.file);
    expect((await readdir(out)).sort()).toEqual([changed.file, 'index.json'].sort());
  });

  it('opens built files and source directories with the same content', async () => {
    const dir = await temp();
    const out = await temp();
    await writeSource(dir);
    const built = await buildPack(dir, { outDir: out });
    const fromFile = await openFilePack(built.path);
    const fromDir = await openDirPack(dir);
    expect(fromDir.manifest.contentHash).toBe(fromFile.manifest.contentHash);
    expect(fromDir.manifest.ids).toEqual(fromFile.manifest.ids);
    for (const path of fromFile.paths()) {
      expect(await fromDir.readBytes(path)).toEqual(await fromFile.readBytes(path));
    }
    fromFile.close();
    expect((await openPackAt(dir)).manifest.id).toBe('example.vehicles');
    const viaPath = await openPackAt(built.path);
    expect(viaPath.manifest.contentHash).toBe(built.manifest.contentHash);
    viaPath.close();
  });

  it('extracts a pack to a source directory that builds back to the same bytes', async () => {
    const dir = await temp();
    const out = await temp();
    const extracted = await temp();
    const rebuilt = await temp();
    await writeSource(dir);
    const built = await buildPack(dir, { outDir: out });
    const pack = await openFilePack(built.path);
    await extractPack(pack, extracted);
    pack.close();
    const again = await buildPack(extracted, { outDir: rebuilt });
    expect(again.fileSha256).toBe(built.fileSha256);
  });

  it('refuses a source directory without a valid config', async () => {
    const dir = await temp();
    await expect(readPackSource(dir)).rejects.toThrow(/molen-pack\.source\.json/);
    await writeFile(join(dir, 'molen-pack.source.json'), JSON.stringify({ format: 'nope' }));
    await expect(readPackSource(dir)).rejects.toThrow();
  });

  it('packs the default worldgen style pack into a fraction of its size', async () => {
    const source = await readPackSource(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/worldgen'),
    );
    const files = source.files;
    const raw = files.reduce((total, file) => total + file.bytes.length, 0);
    const { bytes } = await createPack(files, { id: 'molen.worldgen.default', version: '1' });
    // ~800 KB of JSON and small models: solid blocks bring it to about a tenth.
    expect(bytes.length).toBeLessThan(raw / 8);
    const pack = await openPack(bytes);
    for (const file of files) {
      expect(new Uint8Array(await pack.readBytes(file.path)), file.path).toEqual(file.bytes);
    }
  }, 30_000); // Packs, reopens and reads back every file of the default style pack.
});

describe('openDirPack', () => {
  it('checks an expected contentHash like a built pack does', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'molen-pack-pin-'));
    try {
      await writeFile(
        join(dir, 'molen-pack.source.json'),
        JSON.stringify({ format: 'molen/pack-source@1', id: 'example.pin', version: '1' }),
      );
      await writeFile(join(dir, 'a.json'), '{"a":1}');
      const pack = await openDirPack(dir);
      await expect(
        openDirPack(dir, { expect: { contentHash: pack.manifest.contentHash } }),
      ).resolves.toBeDefined();
      await expect(
        openPackAt(dir, { expect: { contentHash: `sha256:${'0'.repeat(64)}` } }),
      ).rejects.toThrow(/expected sha256:0+/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
