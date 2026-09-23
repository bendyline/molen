import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '@bendyline/molen-schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildContentPack,
  extractContentPack,
  fetchContentPack,
  inspectContentPack,
  verifyContentPack,
} from '../src/ops/index';

const sedan = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../content/entities/assets/molen/entities/vehicle/sedan',
);

let dir: string;
let source: string;
let out: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-pack-ops-'));
  source = join(dir, 'source');
  out = join(dir, 'out');
  await mkdir(join(source, 'models'), { recursive: true });
  await cp(sedan, join(source, 'models/sedan'), { recursive: true });
  await writeFile(join(source, 'NOTICE.md'), '# Notice\n\nTest content.\n');
  await writeFile(
    join(source, 'molen-pack.source.json'),
    JSON.stringify({
      format: 'molen/pack-source@1',
      id: 'test.vehicles',
      version: '1.0.0',
      license: 'MIT',
      notice: 'NOTICE.md',
    }),
  );
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('content pack ops', () => {
  it('builds, inspects and verifies a pack of a real model', async () => {
    const built = await buildContentPack({ sourceDir: source, outDir: out });
    expect(built).toMatchObject({ ok: true, id: 'test.vehicles', files: 3 });
    expect(built.file).toMatch(/^test\.vehicles-[0-9a-f]{12}\.zip$/);

    const info = await inspectContentPack({ source: built.path as string });
    expect(info).toMatchObject({
      ok: true,
      id: 'test.vehicles',
      files: 3,
      ids: { 'molen.entities.vehicle.sedan': 'models/sedan/model.glb' },
    });
    expect(info.fileSize).toBe(built.size);

    const verified = await verifyContentPack({ source: built.path as string });
    expect(verified).toMatchObject({ ok: true, checked: 3, validated: 1, issues: [] });
    // The unbuilt source directory verifies the same way.
    expect(await verifyContentPack({ source })).toMatchObject({ ok: true, validated: 1 });
  });

  it('reports a sidecar whose hash no longer matches its model', async () => {
    const tampered = join(dir, 'tampered');
    await cp(source, tampered, { recursive: true });
    const glb = await readFile(join(tampered, 'models/sedan/model.glb'));
    glb[glb.length - 1] = (glb[glb.length - 1] as number) ^ 0xff;
    await writeFile(join(tampered, 'models/sedan/model.glb'), glb);
    const r = await verifyContentPack({ source: tampered });
    expect(r.ok).toBe(false);
    expect(r.issues?.[0]?.message).toMatch(/sidecar hash .* does not match/);
  });

  it('extracts a pack', async () => {
    const built = await buildContentPack({ sourceDir: source, outDir: out });
    const target = join(dir, 'extracted');
    const r = await extractContentPack({ source: built.path as string, outDir: target });
    expect(r).toMatchObject({ ok: true, id: 'test.vehicles', files: 3 });
    expect(await readFile(join(target, 'models/sedan/model.glb'))).toEqual(
      await readFile(join(sedan, 'model.glb')),
    );
    expect((await readdir(target)).sort()).toEqual([
      'NOTICE.md',
      'models',
      'molen-pack.source.json',
    ]);
  });

  describe('fetch', () => {
    let server: Server;
    let base: string;
    beforeAll(async () => {
      await buildContentPack({ sourceDir: source, outDir: out });
      server = createServer(async (request, response) => {
        try {
          const body = await readFile(join(out, (request.url ?? '/').slice(1)));
          response.writeHead(200).end(body);
        } catch {
          response.writeHead(404).end();
        }
      });
      await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    });
    afterAll(async () => {
      await new Promise((done) => server.close(done));
    });

    it('downloads packs from an index and pins them in project.json', async () => {
      const project = join(dir, 'project');
      await mkdir(project, { recursive: true });
      await writeFile(
        join(project, 'project.json'),
        JSON.stringify({ format: 'molen/project@1', name: 'demo' }),
      );
      const r = await fetchContentPack({ url: `${base}index.json`, cwd: project });
      expect(r.ok).toBe(true);
      const [pack] = r.packs ?? [];
      expect(pack?.id).toBe('test.vehicles');
      const manifest = validate(
        'project',
        JSON.parse(await readFile(join(project, 'project.json'), 'utf8')),
      );
      if (!manifest.ok) throw new Error(manifest.formatted);
      expect(manifest.value.packs).toEqual([
        { id: 'test.vehicles', source: `packs/${pack?.file}`, contentHash: pack?.contentHash },
      ]);
      // The pinned file verifies offline.
      expect(
        await verifyContentPack({ source: join(project, 'packs', pack?.file as string) }),
      ).toMatchObject({
        ok: true,
      });
      // Fetching again replaces the entry instead of adding a second one.
      await fetchContentPack({ url: `${base}index.json`, cwd: project });
      const again = JSON.parse(await readFile(join(project, 'project.json'), 'utf8'));
      expect(again.packs).toHaveLength(1);
    });

    it('reports a missing pack id or an unreachable URL', async () => {
      expect(
        await fetchContentPack({ url: `${base}index.json`, ids: ['nope'], cwd: dir }),
      ).toMatchObject({
        ok: false,
        error: expect.stringMatching(/lists no pack "nope"/),
      });
      expect(await fetchContentPack({ url: `${base}missing.zip`, cwd: dir })).toMatchObject({
        ok: false,
        error: expect.stringMatching(/HTTP 404/),
      });
    });
  });
});
