import { randomBytes } from 'node:crypto';
import { createPack, createPackSet, openPack, type Pack } from '@bendyline/molen-pack';
import { describe, expect, it, vi } from 'vitest';
import { openPacksFromIndex } from '../src/client/content';
import { type ModelArchivesDoc, withModelArchives } from '../src/client/model-archives';

const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

async function fixture() {
  const seattle = await createPack([{ path: 'models/needle.glb', bytes: randomBytes(180_000) }], {
    id: 'example.models.g_c2.p001',
    version: '1.0.0',
  });
  const chicago = await createPack([{ path: 'models/willis.glb', bytes: randomBytes(180_000) }], {
    id: 'example.models.g_dp.p001',
    version: '1.0.0',
  });
  const doc: ModelArchivesDoc = {
    format: 'molen/model-archives@1',
    archives: Object.fromEntries(
      [seattle, chicago].map((pack) => [
        pack.manifest.id,
        { contentHash: pack.manifest.contentHash },
      ]),
    ),
    files: { 'models/needle.glb': seattle.manifest.id, 'models/willis.glb': chicago.manifest.id },
    ids: { 'example.needle': 'models/needle.glb', 'example.willis': 'models/willis.glb' },
  };
  const makeCore = async (routes = doc) => {
    const built = await createPack(
      [
        { path: 'model-archives.json', bytes: json(routes) },
        { path: 'styles.json', bytes: json({ materials: ['glass'] }) },
      ],
      {
        id: 'example.styles',
        version: '1.0.0',
        provides: { 'model-archives': 'model-archives.json' },
      },
    );
    return { ...built, pack: await openPack(built.bytes) };
  };
  return { seattle, chicago, doc, makeCore };
}

describe('regional model archives', () => {
  it('uses real ZIP ranges through host fetch, opens Seattle only, and preserves logical paths and asset ids', async () => {
    const { seattle, chicago, makeCore } = await fixture();
    const core = await makeCore();
    const archives = [core, seattle, chicago];
    const index = {
      format: 'molen/pack-index@1',
      packs: Object.fromEntries(
        archives.map((pack) => [
          pack.manifest.id,
          {
            file: `${pack.manifest.id}.zip`,
            size: pack.bytes.length,
            contentHash: pack.manifest.contentHash,
            version: '1.0.0',
          },
        ]),
      ),
    };
    const requests: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith('index.json')) return Response.json(index);
      const archive = archives.find((pack) => url.endsWith(`${pack.manifest.id}.zip`));
      if (!archive) throw new Error(`Unexpected URL ${url}`);
      const range = new Headers(init?.headers).get('range');
      if (!range) return new Response(archive.bytes);
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) throw new Error(`Unexpected range ${range}`);
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, archive.bytes.length - Number(match[2]));
      const end = match[1] ? Number(match[2]) : archive.bytes.length - 1;
      return new Response(archive.bytes.slice(start, end + 1), {
        status: 206,
        headers: { 'content-range': `bytes ${start}-${end}/${archive.bytes.length}` },
      });
    });
    const packs = createPackSet(
      await openPacksFromIndex('https://host.test/index.json', ['example.styles'], fetchImpl),
    );
    try {
      expect(requests.some((url) => url.includes('.models.'))).toBe(false);
      const [first, second] = await Promise.all([
        packs.readBytes('pack:example.styles/models/needle.glb'),
        packs.readBytes('example.needle'),
      ]);
      expect(first).toEqual(second);
      expect(new Uint8Array(first)).toHaveLength(180_000);
      expect(requests.filter((url) => url.includes(seattle.manifest.id))).toHaveLength(2); // one open + model range
      expect(requests.some((url) => url.includes(chicago.manifest.id))).toBe(false);
      expect(packs.resolve('models/unlisted.glb')).toBeUndefined();
      await expect(packs.readBytes('models/unlisted.glb')).rejects.toThrow('no pack provides');
    } finally {
      packs.close();
      core.pack.close();
    }
  });

  it('retries failed opens, retains active reads and evicts idle handles', async () => {
    const { seattle, chicago, makeCore } = await fixture();
    const { pack: core } = await makeCore();
    const closes: ReturnType<typeof vi.fn>[] = [];
    let fail = true;
    const opener = vi.fn(async (id: string) => {
      if (fail) {
        fail = false;
        throw new Error('temporary failure');
      }
      const pack = await openPack((id === seattle.manifest.id ? seattle : chicago).bytes);
      const original = pack.close.bind(pack);
      const close = vi.fn(original);
      pack.close = close;
      closes.push(close);
      return pack;
    });
    const pack = await withModelArchives(core, opener, { maxOpenArchives: 1 });
    await expect(pack.readBytes('example.needle')).rejects.toThrow('temporary failure');
    await pack.readBytes('example.needle');
    await pack.readBytes('example.willis');
    expect(closes[0]).toHaveBeenCalledOnce();
    await pack.readBytes('example.needle');
    expect(opener).toHaveBeenCalledTimes(4);
    expect(closes[1]).toHaveBeenCalledOnce();
    pack.close();
    pack.close();
    expect(closes[2]).toHaveBeenCalledOnce();
    await expect(pack.readBytes('example.needle')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('closes late archive opens and cancels one caller without poisoning concurrent callers', async () => {
    const { seattle, makeCore } = await fixture();
    let finish!: (pack: Pack) => void;
    const opener = vi.fn(
      () =>
        new Promise<Pack>((resolve) => {
          finish = resolve;
        }),
    );
    const pack = await withModelArchives((await makeCore()).pack, opener);
    const cancel = new AbortController();
    const canceled = pack.readBytes('example.needle', { signal: cancel.signal });
    const live = pack.readBytes('example.needle');
    cancel.abort();
    await expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
    const archive = await openPack(seattle.bytes);
    finish(archive);
    expect(new Uint8Array(await live)).toHaveLength(180_000);
    expect(opener).toHaveBeenCalledOnce();
    pack.close();
    const latePack = await withModelArchives((await makeCore()).pack, opener);
    const pending = latePack.readBytes('example.needle');
    await Promise.resolve();
    latePack.close();
    const late = await openPack(seattle.bytes);
    const close = vi.spyOn(late, 'close');
    finish(late);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps a busy archive pinned while another region is read', async () => {
    const { seattle, chicago, makeCore } = await fixture();
    const archive = await openPack(seattle.bytes);
    const close = vi.spyOn(archive, 'close');
    const read = archive.readBytes.bind(archive);
    let resume!: () => void;
    const blocked = new Promise<void>((resolve) => {
      resume = resolve;
    });
    archive.readBytes = async (...args) => {
      await blocked;
      return read(...args);
    };
    const pack = await withModelArchives(
      (await makeCore()).pack,
      async (id) => (id === seattle.manifest.id ? archive : openPack(chicago.bytes)),
      { maxOpenArchives: 0 },
    );
    const busy = pack.readBytes('example.needle');
    await pack.readBytes('example.willis');
    expect(close).not.toHaveBeenCalled();
    resume();
    expect(new Uint8Array(await busy)).toHaveLength(180_000);
    expect(close).toHaveBeenCalledOnce();
    pack.close();
  });

  it.each([
    '../outside.glb',
    '/absolute.glb',
    'models\\evil.glb',
    'C:/drive.glb',
    'models/./evil.glb',
  ])('rejects invalid route %s before opening any archive', async (path) => {
    const { doc, makeCore, seattle } = await fixture();
    const { pack: core } = await makeCore({
      ...doc,
      files: { [path]: seattle.manifest.id },
      ids: {},
    });
    const opener = vi.fn();
    await expect(withModelArchives(core, opener)).rejects.toThrow('Invalid model archive route');
    expect(opener).not.toHaveBeenCalled();
    core.close();
  });

  it('rejects unknown archives and hash mismatches without exposing unregistered members', async () => {
    const { doc, makeCore, chicago } = await fixture();
    const bad = (
      await makeCore({ ...doc, files: { 'models/fake.glb': 'example.unknown' }, ids: {} })
    ).pack;
    await expect(withModelArchives(bad, vi.fn())).rejects.toThrow('Invalid model archive route');
    bad.close();
    const wrong = await openPack(chicago.bytes);
    const close = vi.spyOn(wrong, 'close');
    const pack = await withModelArchives((await makeCore()).pack, async () => wrong);
    expect(pack.has('models/unlisted.glb')).toBe(false);
    await expect(pack.readBytes('example.needle')).rejects.toThrow('identity/hash mismatch');
    expect(close).toHaveBeenCalledOnce();
    pack.close();
  });

  it('returns a monolithic pack unchanged', async () => {
    const built = await createPack([{ path: 'model.glb', bytes: json('legacy') }], {
      id: 'example.legacy',
      version: '1',
    });
    const pack = await openPack(built.bytes);
    expect(await withModelArchives(pack, vi.fn())).toBe(pack);
    pack.close();
  });
});
