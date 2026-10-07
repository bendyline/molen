import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPack, type PackFile } from '../src/build';
import { hostedVersionDir, hostPacks, recordInPackIndex } from '../src/node';
import { isDirectoryPackUrl, openDirectoryPack, openPack, PackIntegrityError } from '../src/pack';
import { encode, sampleFiles } from './helpers';

const temps: string[] = [];
async function temp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'molen-pack-dir-'));
  temps.push(dir);
  return dir;
}
afterEach(async () => {
  for (const dir of temps.splice(0)) await rm(dir, { recursive: true, force: true });
});

const CDN = 'https://cdn.test/';

/** Built zips plus their index, the way a release writes them. */
async function builtPacks(files: PackFile[] = sampleFiles()): Promise<string> {
  const dir = await temp();
  const built = await createPack(files, { id: 'example.pack', version: '1.0.0' });
  const file = 'example.pack-0001.zip';
  await writeFile(join(dir, file), built.bytes);
  return recordInPackIndex(dir, 'example.pack', {
    version: '1.0.0',
    file,
    contentHash: built.manifest.contentHash,
    size: built.bytes.length,
  });
}

/** A static host over `root`: plain GETs and single byte ranges, like a CDN or R2. */
function cdn(root: string): typeof fetch & { requests: string[] } {
  const requests: string[] = [];
  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await readFile(join(root, decodeURIComponent(url.pathname))));
    } catch {
      return new Response('not found', { status: 404 });
    }
    const range = new Headers(init?.headers).get('range')?.match(/^bytes=(\d+)-(\d+)$/);
    if (range === undefined || range === null) return new Response(bytes, { status: 200 });
    const start = Number(range[1]);
    const end = Number(range[2]);
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: { 'content-range': `bytes ${start}-${end}/${bytes.length}`, etag: '"v1"' },
    });
  };
  return Object.assign(handler as typeof fetch, { requests });
}

describe('unzipped packs', () => {
  it('recognizes a manifest URL', () => {
    expect(isDirectoryPackUrl('https://cdn.test/_a/molen.sky/405f4d03dd0f/molen-pack.json')).toBe(
      true,
    );
    expect(isDirectoryPackUrl('packs/molen.sky/1/molen-pack.json?v=2')).toBe(true);
    expect(isDirectoryPackUrl('https://cdn.test/packs/molen.sky-405f4d03dd0f.zip')).toBe(false);
    expect(isDirectoryPackUrl('https://cdn.test/molen-pack.json.zip')).toBe(false);
  });

  it('publishes versioned directories that read back byte for byte', async () => {
    const out = await temp();
    const hosted = await hostPacks(await builtPacks(), { outDir: out });
    const entry = hosted.index.packs['example.pack'];
    if (entry === undefined) throw new Error('example.pack is not in the hosted index');
    const version = hostedVersionDir(entry.contentHash);
    expect(entry.file).toBe(`example.pack/${version}/molen-pack.json`);
    expect(hosted.written).toEqual(['example.pack']);
    expect(JSON.parse(await readFile(join(out, 'index.json'), 'utf8'))).toEqual(hosted.index);

    // Every file is loose: the zip's solid blocks are gone, the contentHash is unchanged.
    const manifest = JSON.parse(await readFile(join(out, entry.file), 'utf8'));
    expect(manifest.blocks).toEqual({});
    expect(Object.values(manifest.entries).some((e) => 'block' in (e as object))).toBe(false);
    expect(entry.size).toBe((await readFile(join(out, entry.file))).length);

    const fetch = cdn(out);
    const pack = await openPack(new URL(entry.file, CDN), {
      fetch,
      integrity: 'sha256',
      expect: { contentHash: entry.contentHash },
    });
    expect(pack.paths()).toEqual(
      sampleFiles()
        .map((f) => f.path)
        .sort(),
    );
    for (const file of sampleFiles()) {
      expect(new Uint8Array(await pack.readBytes(file.path))).toEqual(file.bytes);
    }
    // One request per non-empty file, then reads come from the pack's cache.
    const before = fetch.requests.length;
    await pack.readText('NOTICE.md');
    expect(fetch.requests.length).toBe(before);
    expect(fetch.requests).not.toContain(`/example.pack/${version}/models/roadster/empty.bin`);
    pack.close();
  });

  it('skips version directories that are already complete', async () => {
    const out = await temp();
    const index = await builtPacks();
    await hostPacks(index, { outDir: out });
    const again = await hostPacks(index, { outDir: out });
    expect(again.written).toEqual([]);
    expect(again.reused).toEqual(['example.pack']);
  });

  it('rewrites a version directory whose manifest was never written', async () => {
    const out = await temp();
    const index = await builtPacks();
    const first = await hostPacks(index, { outDir: out });
    const file = first.index.packs['example.pack']?.file as string;
    await rm(join(out, file));
    const again = await hostPacks(index, { outDir: out });
    expect(again.written).toEqual(['example.pack']);
    expect((await readFile(join(out, file))).length).toBeGreaterThan(0);
  });

  it('publishes only the packs asked for', async () => {
    const out = await temp();
    const hosted = await hostPacks(await builtPacks(), { outDir: out, include: () => false });
    expect(hosted.index.packs).toEqual({});
  });

  it('escapes each path segment when fetching', async () => {
    const out = await temp();
    const files = [{ path: 'docs/a b#c.txt', bytes: encode('spaced') }];
    const hosted = await hostPacks(await builtPacks(files), { outDir: out });
    const entry = hosted.index.packs['example.pack'] as { file: string };
    const pack = await openPack(new URL(entry.file, CDN), { fetch: cdn(out) });
    expect(await pack.readText('docs/a b#c.txt')).toBe('spaced');
  });

  it('fails a file whose bytes do not match the manifest', async () => {
    const out = await temp();
    const hosted = await hostPacks(await builtPacks(), { outDir: out });
    const entry = hosted.index.packs['example.pack'] as { file: string };
    const dir = join(out, entry.file, '..');
    await writeFile(join(dir, 'NOTICE.md'), 'tampered');
    const short = await openPack(new URL(entry.file, CDN), { fetch: cdn(out) });
    await expect(short.readText('NOTICE.md')).rejects.toThrow();
    const notice = sampleFiles().find((f) => f.path === 'NOTICE.md') as PackFile;
    await writeFile(join(dir, 'NOTICE.md'), new Uint8Array(notice.bytes.length));
    const checked = await openPack(new URL(entry.file, CDN), {
      fetch: cdn(out),
      integrity: 'sha256',
    });
    await expect(checked.readText('NOTICE.md')).rejects.toBeInstanceOf(PackIntegrityError);
  });

  it('refuses a manifest with solid blocks and a mismatched contentHash', async () => {
    const out = await temp();
    const built = await createPack(sampleFiles(), { id: 'example.pack', version: '1.0.0' });
    expect(Object.keys(built.manifest.blocks).length).toBeGreaterThan(0);
    await writeFile(join(out, 'molen-pack.json'), JSON.stringify(built.manifest));
    await expect(
      openDirectoryPack(new URL('molen-pack.json', CDN), { fetch: cdn(out) }),
    ).rejects.toThrow(/solid blocks/);

    const hosted = await hostPacks(await builtPacks(), { outDir: out });
    const entry = hosted.index.packs['example.pack'] as { file: string };
    await expect(
      openDirectoryPack(new URL(entry.file, CDN), {
        fetch: cdn(out),
        expect: { contentHash: `sha256:${'0'.repeat(64)}` },
      }),
    ).rejects.toThrow(/expected sha256:0000/);
  });

  it('reports a missing manifest as an HTTP error', async () => {
    const out = await temp();
    await expect(
      openDirectoryPack(new URL('missing/molen-pack.json', CDN), { fetch: cdn(out) }),
    ).rejects.toThrow(/404/);
  });
});
