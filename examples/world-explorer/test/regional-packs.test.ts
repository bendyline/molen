import { writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { sha256 } from '@bendyline/molen-pack';
import { openFilePack } from '@bendyline/molen-pack/node';
import { describe, expect, it } from 'vitest';
import { stageContentPacks } from '../../../docs-site/scripts/stage-content-packs.mjs';
import { buildRegionalPacks, groupRegionalModels } from '../scripts/build-regional-packs.mjs';

describe('regional content build', () => {
  it('rejects stale model metadata before building archives and still detects changes during a build', async () => {
    const root = await mkdtemp(join(tmpdir(), 'molen-regional-hashes-'));
    if (!resolve(root).startsWith(join(resolve(tmpdir()), 'molen-regional-hashes-')))
      throw new Error('Unexpected temporary directory');
    try {
      const source = join(root, 'source');
      const outDir = join(root, 'out');
      await mkdir(join(source, 'model'), { recursive: true });
      await writeFile(
        join(source, 'molen-pack.source.json'),
        JSON.stringify({ format: 'molen/pack-source@1', id: 'example.styles', version: '1' }),
      );
      const bytes = new Uint8Array(1000).fill(17);
      const sidecar = {
        format: 'molen/asset@1',
        kind: 'model',
        id: 'example.model',
        files: { main: 'model.glb' },
        hash: await sha256(bytes),
      };
      const path = join(source, 'model/asset.json');
      await writeFile(path, JSON.stringify(sidecar));
      await writeFile(join(source, 'model/model.glb'), bytes);
      await buildRegionalPacks(source, { outDir });
      const previous = await readFile(join(outDir, 'index.json'), 'utf8');
      const changed = new Uint8Array(1200).fill(23);
      await writeFile(join(source, 'model/model.glb'), changed);
      let built = 0;
      await expect(buildRegionalPacks(source, { outDir, onBuilt: () => built++ })).rejects.toThrow(
        'Stale model metadata before regional build: model/asset.json',
      );
      expect(built).toBe(0);
      expect(await readFile(join(outDir, 'index.json'), 'utf8')).toBe(previous);

      const staleHash = sidecar.hash;
      sidecar.hash = await sha256(changed);
      await writeFile(path, JSON.stringify(sidecar));
      await buildRegionalPacks(source, { outDir });
      const repaired = await readFile(join(outDir, 'index.json'), 'utf8');
      await expect(
        buildRegionalPacks(source, {
          outDir,
          onBuilt: () => writeFileSync(path, JSON.stringify({ ...sidecar, hash: staleHash })),
        }),
      ).rejects.toThrow('Model changed during regional build: model/asset.json');
      expect(await readFile(join(outDir, 'index.json'), 'utf8')).toBe(repaired);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    false,
    true,
  ])('stages the public site with a regional placement directory: %s', async (regional) => {
    const root = await mkdtemp(join(tmpdir(), 'molen-hosted-regions-'));
    if (
      !resolve(root).startsWith(`${resolve(tmpdir())}\\`) &&
      !resolve(root).startsWith(`${resolve(tmpdir())}/`)
    )
      throw new Error('Unexpected temporary directory');
    try {
      const content = join(root, 'content'),
        cache = join(root, 'cache'),
        hosted = join(root, 'hosted');
      await mkdir(join(content, 'worldgen/models'), { recursive: true });
      await mkdir(join(content, 'earth'), { recursive: true });
      await writeFile(
        join(content, 'worldgen/molen-pack.source.json'),
        JSON.stringify({
          format: 'molen/pack-source@1',
          id: 'example.styles',
          version: '1',
          provides: { stylepack: 'stylepack.json' },
        }),
      );
      await writeFile(join(content, 'worldgen/stylepack.json'), '{}');
      await writeFile(
        join(content, 'worldgen/models/asset.json'),
        JSON.stringify({
          format: 'molen/asset@1',
          kind: 'model',
          id: 'example.seattle',
          files: { main: 'model.glb' },
        }),
      );
      await writeFile(join(content, 'worldgen/models/model.glb'), new Uint8Array(1234).fill(17));
      await writeFile(
        join(content, 'earth/molen-pack.source.json'),
        JSON.stringify({
          format: 'molen/pack-source@1',
          id: 'example.earth',
          version: '1',
          provides: { structures: ['placements.json'] },
        }),
      );
      await writeFile(
        join(content, 'earth/placements.json'),
        JSON.stringify({
          format: 'molen/structure-placements@1',
          title: 'Test',
          entries: [
            {
              id: 'seattle',
              title: 'Seattle',
              status: 'preview',
              source: 'https://example.com',
              asset: 'example.seattle',
              anchor: [-122.3, 47.6],
            },
          ],
        }),
      );
      if (regional) {
        const text = await readFile(join(content, 'earth/placements.json'), 'utf8');
        await writeFile(
          join(content, 'earth/c2.json'),
          text.replace('molen/structure-placements@1', 'molen/structure-placement-data@1'),
        );
        await writeFile(
          join(content, 'earth/placements.json'),
          JSON.stringify({
            format: 'molen/structure-placement-index@1',
            cells: { c2: ['c2'] },
            shards: {
              c2: {
                path: 'c2.json',
                bytes: Buffer.byteLength(await readFile(join(content, 'earth/c2.json'))),
                count: 1,
                minLevel: 11,
              },
            },
          }),
        );
      }
      const first = await stageContentPacks(content, cache);
      expect(first).toContain('example.styles@1 + 1 model archives');
      expect(first).toContain('example.earth@1');
      await stageContentPacks(content, hosted, { reuseFromDir: cache });
      const index = JSON.parse(await readFile(join(hosted, 'index.json'), 'utf8'));
      const core = await openFilePack(join(hosted, index.packs['example.styles'].file));
      try {
        expect(core.has('models/asset.json')).toBe(true);
        expect(core.has('models/model.glb')).toBe(false);
        const routes = await core.readJson<{ files: Record<string, string> }>(
          'model-archives.json',
        );
        const archive = index.packs[routes.files['models/model.glb'] as string];
        expect(routes.files['models/model.glb']).toContain('.g_c2.');
        expect(await readFile(join(hosted, archive.file))).toEqual(
          await readFile(join(cache, archive.file)),
        );
        // A stale/unsafe cache route cannot become an output file or defeat rebuild.
        const stale = JSON.parse(await readFile(join(cache, 'index.json'), 'utf8'));
        stale.packs[routes.files['models/model.glb'] as string].file = '../outside.zip';
        await writeFile(join(cache, 'index.json'), JSON.stringify(stale));
        await stageContentPacks(content, join(root, 'uncached'), { reuseFromDir: cache });
        const safe = JSON.parse(await readFile(join(root, 'uncached/index.json'), 'utf8'));
        expect(safe.packs[routes.files['models/model.glb'] as string].file).toBe(archive.file);
      } finally {
        core.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('splits dense regions deterministically and rejects oversized bundles', () => {
    const models = ['c', 'a', 'b'].map((path) => ({ path, size: 6000, anchor: [-122.3, 47.6] }));
    const options = { id: 'example.styles', maxShardBytes: 10_000 };
    const shards = groupRegionalModels(models, options);
    expect(shards.map((s) => s.id)).toEqual([
      'example.styles.models.g_c2.p001',
      'example.styles.models.g_c2.p002',
      'example.styles.models.g_c2.p003',
    ]);
    expect(groupRegionalModels([...models].reverse(), options)).toEqual(shards);
    expect(() => groupRegionalModels([{ path: 'huge', size: 100_000 }], options)).toThrow(
      'exceeds',
    );
    const isolated = groupRegionalModels(
      [
        { path: 'a', size: 6000, anchor: [-122.3, 47.6] },
        { path: 'b', size: 11_000, anchor: [-122.3, 47.6] },
        { path: 'c', size: 6000, anchor: [-122.3, 47.6] },
      ],
      { ...options, maxSingleModelBytes: 20_000 },
    );
    expect(isolated.map((shard) => shard.models.length)).toEqual([1, 1, 1]);
    expect(isolated[1].maxArchiveBytes).toBe(20_000);
  });

  it('keeps metadata in the core and builds byte-identical routed ZIPs with exact selected paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'molen-regional-'));
    // Resolve the task-owned cleanup target before any later recursive removal.
    if (
      !resolve(root).startsWith(`${resolve(tmpdir())}\\`) &&
      !resolve(root).startsWith(`${resolve(tmpdir())}/`)
    )
      throw new Error('Unexpected temporary directory');
    try {
      const source = join(root, 'source'),
        out = join(root, 'out');
      await mkdir(source);
      await writeFile(
        join(source, 'molen-pack.source.json'),
        JSON.stringify({
          format: 'molen/pack-source@1',
          id: 'example.styles',
          version: '1',
          exclude: ['private/**'],
          provides: { stylepack: 'stylepack.json' },
        }),
      );
      await writeFile(join(source, 'stylepack.json'), '{}');
      for (const id of ['seattle', 'chicago', 'windmill']) {
        await mkdir(join(source, id));
        await writeFile(
          join(source, id, 'asset.json'),
          JSON.stringify({
            format: 'molen/asset@1',
            kind: 'model',
            id: `example.${id}`,
            files: { main: 'model.glb' },
          }),
        );
        await writeFile(join(source, id, 'model.glb'), new Uint8Array(10_000).fill(id.length));
      }
      const options = {
        outDir: out,
        placements: [
          { asset: 'example.seattle', anchor: [-122.3, 47.6] },
          { asset: 'example.chicago', anchor: [-87.6, 41.9] },
        ],
        maxShardBytes: 100_000,
      };
      const result = await buildRegionalPacks(source, options);
      expect(Object.keys(result.routes.archives)).toHaveLength(3);
      const core = await openFilePack(join(out, result.core.file));
      try {
        expect(core.has('seattle/asset.json')).toBe(true);
        expect(core.has('seattle/model.glb')).toBe(false);
        const routes = await core.readJson<{ files: Record<string, string> }>(
          'model-archives.json',
        );
        expect(routes.files['seattle/model.glb']).toContain('.g_c2.');
        expect(routes.files['chicago/model.glb']).toContain('.g_dp.');
        expect(routes.files['windmill/model.glb']).toContain('.shared.');
        const shard = await openFilePack(
          join(out, result.index.packs[routes.files['seattle/model.glb'] as string].file),
        );
        try {
          expect(new Uint8Array(await shard.readBytes('seattle/model.glb'))).toHaveLength(10_000);
        } finally {
          shard.close();
        }
      } finally {
        core.close();
      }
      const indexBefore = await readFile(join(out, 'index.json'), 'utf8');
      await buildRegionalPacks(source, options);
      expect(await readFile(join(out, 'index.json'), 'utf8')).toBe(indexBefore);
      let changed = false;
      await expect(
        buildRegionalPacks(source, {
          ...options,
          onBuilt: () => {
            if (!changed) {
              changed = true;
              writeFileSync(join(source, 'new-material.json'), '{}');
            }
          },
        }),
      ).rejects.toThrow('file list changed');
      expect(await readFile(join(out, 'index.json'), 'utf8')).toBe(indexBefore);
      await writeFile(
        join(source, 'seattle/asset.json'),
        JSON.stringify({
          format: 'molen/asset@1',
          kind: 'model',
          id: 'example.seattle',
          files: { main: '../chicago/model.glb' },
        }),
      );
      await expect(buildRegionalPacks(source, options)).rejects.toThrow('Invalid model member');
      await writeFile(
        join(source, 'seattle/asset.json'),
        JSON.stringify({
          format: 'molen/asset@1',
          kind: 'model',
          id: 'example.seattle',
          files: { main: 'missing.glb' },
        }),
      );
      await expect(buildRegionalPacks(source, options)).rejects.toThrow(
        'not an included source file',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
